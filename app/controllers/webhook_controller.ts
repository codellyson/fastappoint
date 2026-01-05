import type { HttpContext } from '@adonisjs/core/http'
import { createHmac } from 'node:crypto'
import env from '#start/env'
import { DateTime } from 'luxon'
import Booking from '#models/booking'
import Business from '#models/business'
import Subscription from '#models/subscription'
import SubscriptionPayment from '#models/subscription_payment'
import Transaction from '#models/transaction'
import emailService from '#services/email_service'
import subscriptionService from '../services/subscription_service.js'
import receiptService from '../services/receipt_service.js'
import withdrawalService from '../services/withdrawal_service.js'
import stripeService from '../services/stripe_service.js'

export default class WebhookController {
  async paystack({ request, response }: HttpContext) {
    const secretKey = env.get('PAYSTACK_SECRET_KEY')

    if (!secretKey) {
      console.error('[WEBHOOK] PAYSTACK_SECRET_KEY not configured')
      return response.status(500).send('Server configuration error')
    }

    const signature = request.header('x-paystack-signature')
    const rawBody = request.raw()

    if (!signature || !rawBody) {
      return response.status(400).send('Invalid request')
    }

    const expectedSignature = createHmac('sha512', secretKey).update(rawBody).digest('hex')

    if (signature !== expectedSignature) {
      console.error('[WEBHOOK] Invalid Paystack signature')
      return response.status(401).send('Invalid signature')
    }

    const payload = request.body()
    const event = payload.event
    const data = payload.data

    console.log(`[WEBHOOK] Received event: ${event}`)

    try {
      switch (event) {
        case 'charge.success':
          await this.handleChargeSuccess(data)
          break
        case 'charge.failed':
          await this.handleChargeFailed(data)
          break
        case 'refund.processed':
          await this.handleRefund(data)
          break
        case 'subscription.create':
        case 'subscription.enable':
        case 'subscription.disable':
        case 'invoice.payment_failed':
        case 'invoice.payment_succeeded':
          await subscriptionService.handleWebhook(event, data)
          break
        case 'transfer.success':
          await this.handleTransferSuccess(data)
          break
        case 'transfer.failed':
          await this.handleTransferFailed(data)
          break
        case 'transfer.reversed':
          await this.handleTransferReversed(data)
          break
        default:
          console.log(`[WEBHOOK] Unhandled event: ${event}`)
      }
    } catch (error) {
      console.error(`[WEBHOOK] Error processing ${event}:`, error)
      return response.status(500).send('Processing error')
    }

    return response.status(200).send('OK')
  }

  private async handleChargeSuccess(data: Record<string, unknown>) {
    const reference = data.reference as string
    const metadata = data.metadata as Record<string, unknown> | undefined

    let booking: Booking | null = null

    if (metadata?.booking_id) {
      booking = await Booking.query()
        .where('id', metadata.booking_id as number)
        .preload('business')
        .preload('service')
        .first()
    }

    if (!booking) {
      booking = await Booking.query()
        .whereILike('paymentReference', `%${reference}%`)
        .preload('business')
        .preload('service')
        .first()
    }

    if (!booking) {
      console.log(`[WEBHOOK] No booking found for reference: ${reference}`)
      return
    }

    // Idempotency check: Use provider reference to prevent duplicate processing
    const existingTransaction = await Transaction.query()
      .where('providerReference', reference)
      .where('status', 'success')
      .first()

    if (existingTransaction) {
      console.log(`[WEBHOOK] Transaction already processed for reference: ${reference}`)
      // Ensure booking status is correct
      if (booking.paymentStatus !== 'paid') {
        booking.paymentStatus = 'paid'
        booking.status = 'confirmed'
        await booking.save()
      }
      return
    }

    // Use database transaction for atomicity
    try {
      await Booking.transaction(async (trx) => {
        // Reload booking within transaction to get latest state
        const bookingInTrx = await Booking.query({ client: trx }).where('id', booking!.id).first()

        if (!bookingInTrx) {
          throw new Error('Booking not found in transaction')
        }

        // Double-check payment status within transaction
        if (bookingInTrx.paymentStatus === 'paid') {
          console.log(`[WEBHOOK] Booking #${bookingInTrx.id} already paid (checked in transaction)`)
          return
        }

        // Update booking
        bookingInTrx.paymentStatus = 'paid'
        bookingInTrx.status = 'confirmed'
        await bookingInTrx.useTransaction(trx).save()

        // Create transaction record
        const amount = (data.amount as number) / 100
        const platformFee = Math.round(amount * 0.025)

        const transaction = new Transaction()
        transaction.businessId = bookingInTrx.businessId
        transaction.bookingId = bookingInTrx.id
        transaction.amount = amount
        transaction.platformFee = platformFee
        transaction.businessAmount = amount - platformFee
        transaction.status = 'success'
        transaction.provider = 'paystack'
        transaction.reference = bookingInTrx.paymentReference || reference
        transaction.providerReference = reference
        await transaction.useTransaction(trx).save()

        // Update booking reference for email
        booking = bookingInTrx
      })

      // Get transaction for receipt generation
      const transaction = await Transaction.query()
        .where('bookingId', booking.id)
        .where('status', 'success')
        .where('providerReference', reference)
        .first()

      // Generate receipt asynchronously
      if (transaction) {
        receiptService.generateReceipt(booking, transaction).catch((error: unknown) => {
          console.error('[WEBHOOK] Failed to generate receipt:', error)
        })
      }

      // Send emails outside transaction
      const dateFormatted = booking.date.toFormat('EEEE, MMMM d, yyyy')

      // Get currency - Paystack typically uses business currency or NGN
      const paymentCurrency = booking.business.currency || 'NGN'

      await emailService.sendBookingConfirmation({
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        businessName: booking.business.name,
        serviceName: booking.service.name,
        date: dateFormatted,
        time: `${booking.startTime} - ${booking.endTime}`,
        duration: booking.service.formattedDuration,
        amount: transaction?.amount || booking.amount,
        currency: paymentCurrency,
        reference: booking.paymentReference?.substring(0, 8).toUpperCase() || '',
      })

      await emailService.sendBusinessNotification({
        businessEmail: booking.business.email,
        businessName: booking.business.name,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        serviceName: booking.service.name,
        date: dateFormatted,
        time: `${booking.startTime} - ${booking.endTime}`,
        amount: booking.amount,
      })

      console.log(`[WEBHOOK] Booking #${booking.id} confirmed via webhook`)
    } catch (error) {
      console.error(`[WEBHOOK] Error processing charge.success for booking #${booking.id}:`, error)
      throw error
    }
  }

  private async handleChargeFailed(data: Record<string, unknown>) {
    const reference = data.reference as string
    const metadata = data.metadata as Record<string, unknown> | undefined

    let booking: Booking | null = null

    if (metadata?.booking_id) {
      booking = await Booking.find(metadata.booking_id as number)
    }

    if (!booking) {
      booking = await Booking.query().whereILike('paymentReference', `%${reference}%`).first()
    }

    if (!booking) {
      console.log(`[WEBHOOK] No booking found for failed charge: ${reference}`)
      return
    }

    // Check if transaction already exists (idempotency)
    const existingTransaction = await Transaction.query()
      .where('providerReference', reference)
      .first()

    if (existingTransaction) {
      console.log(`[WEBHOOK] Failed transaction already recorded for reference: ${reference}`)
      return
    }

    // Update booking payment attempts and error
    booking.paymentAttempts = (booking.paymentAttempts || 0) + 1
    booking.lastPaymentError = (data.gateway_response as string) || 'Payment failed'
    await booking.save()

    // Send payment failure notification email
    await booking.load('business')
    await booking.load('service')
    const appUrl = env.get('APP_URL', `https://${env.get('APP_DOMAIN', 'fastappoint.com')}`)
    const paymentUrl = `${appUrl}/book/${booking.business.slug}/booking/${booking.id}/payment`
    const manageUrl = `${appUrl}/book/${booking.business.slug}/booking/${booking.id}/manage`

    await emailService
      .sendPaymentFailureNotification({
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        businessName: booking.business.name,
        serviceName: booking.service.name,
        amount: booking.amount,
        errorMessage: booking.lastPaymentError || 'Payment failed',
        bookingUrl: manageUrl,
        paymentUrl: paymentUrl,
      })
      .catch((error) => {
        console.error('[WEBHOOK] Failed to send payment failure email:', error)
      })

    await Transaction.create({
      businessId: booking.businessId,
      bookingId: booking.id,
      amount: (data.amount as number) / 100,
      platformFee: 0,
      businessAmount: 0,
      status: 'failed',
      provider: 'paystack',
      reference: booking.paymentReference || reference,
      providerReference: reference,
    })

    console.log(`[WEBHOOK] Recorded failed charge for booking #${booking.id}`)
  }

  private async handleRefund(data: Record<string, unknown>) {
    const transactionRef = data.transaction_reference as string

    const transaction = await Transaction.query().where('providerReference', transactionRef).first()

    if (!transaction) {
      console.log(`[WEBHOOK] No transaction found for refund: ${transactionRef}`)
      return
    }

    transaction.status = 'refunded'
    await transaction.save()

    if (transaction.bookingId) {
      const booking = await Booking.find(transaction.bookingId)
      if (booking) {
        booking.paymentStatus = 'refunded'
        booking.status = 'cancelled'
        await booking.save()
      }
    }

    console.log(`[WEBHOOK] Processed refund for transaction #${transaction.id}`)
  }

  private async handleTransferSuccess(data: Record<string, unknown>) {
    const reference = data.reference as string
    console.log(`[WEBHOOK] Processing transfer success for reference: ${reference}`)
    await withdrawalService.handleTransferSuccess(reference)
  }

  private async handleTransferFailed(data: Record<string, unknown>) {
    const reference = data.reference as string
    const reason = (data.reason as string) || 'Transfer failed'
    console.log(`[WEBHOOK] Processing transfer failure for reference: ${reference}`)
    await withdrawalService.handleTransferFailed(reference, reason)
  }

  private async handleTransferReversed(data: Record<string, unknown>) {
    const reference = data.reference as string
    const reason = (data.reason as string) || 'Transfer was reversed'
    console.log(`[WEBHOOK] Processing transfer reversal for reference: ${reference}`)
    await withdrawalService.handleTransferReversed(reference, reason)
  }

  async stripe({ request, response }: HttpContext) {
    if (!stripeService.isConfigured()) {
      console.error('[WEBHOOK] Stripe is not configured')
      return response.status(500).send('Server configuration error')
    }

    const signature = request.header('stripe-signature')
    const rawBody = request.raw()

    if (!signature || !rawBody) {
      return response.status(400).send('Invalid request')
    }

    const event = stripeService.verifyWebhookSignature(rawBody, signature)

    if (!event) {
      console.error('[WEBHOOK] Invalid Stripe signature')
      return response.status(401).send('Invalid signature')
    }

    console.log(`[WEBHOOK] Received Stripe event: ${event.type}`)

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handleStripePaymentSuccess(event.data.object as any)
          break
        case 'payment_intent.payment_failed':
          await this.handleStripePaymentFailed(event.data.object as any)
          break
        case 'account.updated':
          await this.handleStripeAccountUpdated(event.data.object as any)
          break
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleStripeSubscriptionUpdated(event.data.object as any)
          break
        case 'customer.subscription.deleted':
          await this.handleStripeSubscriptionDeleted(event.data.object as any)
          break
        case 'invoice.payment_succeeded':
          await this.handleStripeInvoicePaymentSucceeded(event.data.object as any)
          break
        case 'invoice.payment_failed':
          await this.handleStripeInvoicePaymentFailed(event.data.object as any)
          break
        default:
          console.log(`[WEBHOOK] Unhandled Stripe event: ${event.type}`)
      }
    } catch (error) {
      console.error(`[WEBHOOK] Error processing Stripe event ${event.type}:`, error)
      return response.status(500).send('Processing error')
    }

    return response.status(200).send('OK')
  }

  private async handleStripePaymentSuccess(paymentIntent: {
    id: string
    amount: number
    metadata: Record<string, string>
  }) {
    const bookingId = paymentIntent.metadata.booking_id
    if (!bookingId) {
      console.log(`[WEBHOOK] No booking_id in payment intent metadata: ${paymentIntent.id}`)
      return
    }

    let booking = await Booking.query()
      .where('id', Number.parseInt(bookingId))
      .preload('business')
      .preload('service')
      .first()

    if (!booking) {
      console.log(`[WEBHOOK] No booking found for payment intent: ${paymentIntent.id}`)
      return
    }

    const existingTransaction = await Transaction.query()
      .where('providerReference', paymentIntent.id)
      .where('status', 'success')
      .first()

    if (existingTransaction) {
      console.log(`[WEBHOOK] Transaction already processed for payment intent: ${paymentIntent.id}`)
      if (booking.paymentStatus !== 'paid') {
        booking.paymentStatus = 'paid'
        booking.status = 'confirmed'
        await booking.save()
      }
      return
    }

    if (!booking) {
      console.log(`[WEBHOOK] No booking found for payment intent: ${paymentIntent.id}`)
      return
    }

    try {
      await Booking.transaction(async (trx) => {
        const bookingInTrx = await Booking.query({ client: trx }).where('id', booking!.id).first()

        if (!bookingInTrx) {
          throw new Error('Booking not found in transaction')
        }

        if (bookingInTrx.paymentStatus === 'paid') {
          console.log(`[WEBHOOK] Booking #${bookingInTrx.id} already paid (checked in transaction)`)
          return
        }

        bookingInTrx.paymentStatus = 'paid'
        bookingInTrx.status = 'confirmed'
        await bookingInTrx.useTransaction(trx).save()

        const amount = paymentIntent.amount / 100
        const platformFee = Math.round(amount * 0.025)

        const transaction = new Transaction()
        transaction.businessId = bookingInTrx.businessId
        transaction.bookingId = bookingInTrx.id
        transaction.amount = amount
        transaction.platformFee = platformFee
        transaction.businessAmount = amount - platformFee
        transaction.status = 'success'
        transaction.provider = 'stripe'
        transaction.reference = bookingInTrx.paymentReference || paymentIntent.id
        transaction.providerReference = paymentIntent.id
        await transaction.useTransaction(trx).save()

        booking = bookingInTrx
      })

      const transaction = await Transaction.query()
        .where('bookingId', booking.id)
        .where('status', 'success')
        .where('providerReference', paymentIntent.id)
        .first()

      if (transaction) {
        receiptService.generateReceipt(booking, transaction).catch((error: unknown) => {
          console.error('[WEBHOOK] Failed to generate receipt:', error)
        })
      }

      const dateFormatted = booking.date.toFormat('EEEE, MMMM d, yyyy')

      // Get currency from payment intent for Stripe - retrieve full payment intent
      let paymentCurrency = booking.business.currency || 'NGN'
      try {
        const fullPaymentIntent = await stripeService.retrievePaymentIntent(paymentIntent.id)
        paymentCurrency = fullPaymentIntent.currency.toUpperCase()
      } catch (error) {
        console.warn('[WEBHOOK] Could not retrieve payment intent for currency:', error)
      }

      await emailService.sendBookingConfirmation({
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        businessName: booking.business.name,
        serviceName: booking.service.name,
        date: dateFormatted,
        time: `${booking.startTime} - ${booking.endTime}`,
        duration: booking.service.formattedDuration,
        amount: transaction?.amount || booking.amount,
        currency: paymentCurrency,
        reference: booking.paymentReference?.substring(0, 8).toUpperCase() || '',
      })

      await emailService.sendBusinessNotification({
        businessEmail: booking.business.email,
        businessName: booking.business.name,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        serviceName: booking.service.name,
        date: dateFormatted,
        time: `${booking.startTime} - ${booking.endTime}`,
        amount: booking.amount,
      })

      console.log(`[WEBHOOK] Booking #${booking.id} confirmed via Stripe webhook`)
    } catch (error) {
      console.error(
        `[WEBHOOK] Error processing payment_intent.succeeded for booking #${booking.id}:`,
        error
      )
      throw error
    }
  }

  private async handleStripePaymentFailed(paymentIntent: {
    id: string
    metadata: Record<string, string>
    last_payment_error?: { message?: string }
  }) {
    const bookingId = paymentIntent.metadata.booking_id
    if (!bookingId) {
      return
    }

    const booking = await Booking.find(Number.parseInt(bookingId))
    if (!booking) {
      return
    }

    booking.paymentAttempts = (booking.paymentAttempts || 0) + 1
    booking.lastPaymentError = paymentIntent.last_payment_error?.message || 'Payment failed'
    await booking.save()

    await booking.load('business')
    await booking.load('service')
    const appUrl = env.get('APP_URL', `https://${env.get('APP_DOMAIN', 'fastappoint.com')}`)
    const paymentUrl = `${appUrl}/book/${booking.business.slug}/booking/${booking.id}/payment`
    const manageUrl = `${appUrl}/book/${booking.business.slug}/booking/${booking.id}/manage`

    await emailService
      .sendPaymentFailureNotification({
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        businessName: booking.business.name,
        serviceName: booking.service.name,
        amount: booking.amount,
        errorMessage: booking.lastPaymentError || 'Payment failed',
        bookingUrl: manageUrl,
        paymentUrl: paymentUrl,
      })
      .catch((error) => {
        console.error('[WEBHOOK] Failed to send payment failure email:', error)
      })

    await Transaction.create({
      businessId: booking.businessId,
      bookingId: booking.id,
      amount: 0,
      platformFee: 0,
      businessAmount: 0,
      status: 'failed',
      provider: 'stripe',
      reference: booking.paymentReference || paymentIntent.id,
      providerReference: paymentIntent.id,
    })

    console.log(`[WEBHOOK] Recorded failed Stripe payment for booking #${booking.id}`)
  }

  private async handleStripeAccountUpdated(account: {
    id: string
    charges_enabled: boolean
    payouts_enabled: boolean
    details_submitted: boolean
  }) {
    const business = await Business.query().where('stripeAccountId', account.id).first()
    if (!business) {
      return
    }

    business.stripeChargesEnabled = account.charges_enabled
    business.stripePayoutsEnabled = account.payouts_enabled
    business.stripeAccountStatus = account.details_submitted ? 'complete' : 'incomplete'
    await business.save()

    console.log(`[WEBHOOK] Updated Stripe account status for business #${business.id}`)
  }

  private async handleStripeSubscriptionUpdated(subscription: {
    id: string
    status: string
    current_period_start: number
    current_period_end: number
    cancel_at_period_end: boolean
    metadata: Record<string, string>
  }) {
    const subscriptionRecord = await Subscription.query()
      .where('stripeSubscriptionId', subscription.id)
      .first()

    if (!subscriptionRecord) {
      return
    }

    subscriptionRecord.status =
      subscription.status === 'active'
        ? 'active'
        : subscription.status === 'trialing'
          ? 'trialing'
          : subscription.status === 'past_due'
            ? 'past_due'
            : 'cancelled'
    subscriptionRecord.currentPeriodStart = DateTime.fromSeconds(subscription.current_period_start)
    subscriptionRecord.currentPeriodEnd = DateTime.fromSeconds(subscription.current_period_end)
    subscriptionRecord.cancelAtPeriodEnd = subscription.cancel_at_period_end

    if (subscription.status === 'cancelled') {
      subscriptionRecord.cancelledAt = DateTime.now()
    }

    await subscriptionRecord.save()

    const business = await Business.findOrFail(subscriptionRecord.businessId)
    business.subscriptionStatus =
      subscription.status === 'active'
        ? 'active'
        : subscription.status === 'past_due'
          ? 'past_due'
          : 'cancelled'
    business.subscriptionEndsAt = subscriptionRecord.currentPeriodEnd
    await business.save()

    console.log(`[WEBHOOK] Updated Stripe subscription ${subscription.id}`)
  }

  private async handleStripeSubscriptionDeleted(subscription: {
    id: string
    metadata: Record<string, string>
  }) {
    const subscriptionRecord = await Subscription.query()
      .where('stripeSubscriptionId', subscription.id)
      .first()

    if (!subscriptionRecord) {
      return
    }

    subscriptionRecord.status = 'cancelled'
    subscriptionRecord.cancelledAt = DateTime.now()
    await subscriptionRecord.save()

    const business = await Business.findOrFail(subscriptionRecord.businessId)
    business.subscriptionStatus = 'cancelled'
    business.subscriptionEndsAt = DateTime.now()
    await business.save()

    console.log(`[WEBHOOK] Cancelled Stripe subscription ${subscription.id}`)
  }

  private async handleStripeInvoicePaymentSucceeded(invoice: {
    id: string
    subscription: string | null
    amount_paid: number
    currency: string
    metadata: Record<string, string>
  }) {
    if (!invoice.subscription) {
      return
    }

    const subscriptionRecord = await Subscription.query()
      .where('stripeSubscriptionId', invoice.subscription)
      .first()

    if (!subscriptionRecord) {
      return
    }

    await SubscriptionPayment.create({
      subscriptionId: subscriptionRecord.id,
      amount: invoice.amount_paid / 100,
      status: 'success',
      stripeInvoiceId: invoice.id,
      paidAt: DateTime.now(),
    })

    subscriptionRecord.status = 'active'
    await subscriptionRecord.save()

    const business = await Business.findOrFail(subscriptionRecord.businessId)
    business.subscriptionStatus = 'active'
    await business.save()

    console.log(
      `[WEBHOOK] Recorded successful invoice payment for subscription ${invoice.subscription}`
    )
  }

  private async handleStripeInvoicePaymentFailed(invoice: {
    id: string
    subscription: string | null
    metadata: Record<string, string>
  }) {
    if (!invoice.subscription) {
      return
    }

    const subscriptionRecord = await Subscription.query()
      .where('stripeSubscriptionId', invoice.subscription)
      .first()

    if (!subscriptionRecord) {
      return
    }

    subscriptionRecord.status = 'past_due'
    await subscriptionRecord.save()

    const business = await Business.findOrFail(subscriptionRecord.businessId)
    business.subscriptionStatus = 'past_due'
    await business.save()

    console.log(
      `[WEBHOOK] Recorded failed invoice payment for subscription ${invoice.subscription}`
    )
  }
}
