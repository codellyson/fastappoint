import type { HttpContext } from '@adonisjs/core/http'
import { createHmac } from 'node:crypto'
import env from '#start/env'
import Booking from '#models/booking'
import Transaction from '#models/transaction'
import User from '#models/user'
import emailService from '#services/email_service'
import subscriptionService from '../services/subscription_service.js'
import receiptService from '../services/receipt_service.js'
import withdrawalService from '../services/withdrawal_service.js'
import polarService from '../services/polar_service.js'
import flutterwaveService from '../services/flutterwave_service.js'
import pushNotificationService from '../services/push_notification_service.js'
import currencyService from '../services/currency_service.js'
import db from '@adonisjs/lucid/services/db'

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

    // Check if this is a subscription payment (format: sub-{planId}-{businessId}-{timestamp})
    const subscriptionMatch = reference.match(/^sub-(\d+)-(\d+)-\d+$/)
    if (subscriptionMatch) {
      await this.handlePaystackSubscriptionPayment(data)
      return
    }

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
        const currency =
          (data.currency as string)?.toUpperCase() || bookingInTrx.business.currency || 'NGN'

        const transaction = new Transaction()
        transaction.businessId = bookingInTrx.businessId
        transaction.bookingId = bookingInTrx.id
        transaction.amount = amount
        transaction.platformFee = platformFee
        transaction.businessAmount = amount - platformFee
        transaction.status = 'success'
        transaction.provider = 'paystack'
        transaction.type = 'payment'
        transaction.direction = 'credit'
        transaction.reference = bookingInTrx.paymentReference || reference
        transaction.providerReference = reference
        transaction.currency = currency
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

      // Send push notifications to business owner
      const businessOwner = await User.query()
        .where('businessId', booking.businessId)
        .where('role', 'owner')
        .first()

      if (businessOwner) {
        // Notify about new confirmed booking
        pushNotificationService
          .sendNewBookingNotification(businessOwner.id, {
            id: booking.id,
            customerName: booking.customerName,
            serviceName: booking.service.name,
            time: `${booking.date.toFormat('MMM d')} at ${booking.startTime}`,
          })
          .catch((error) => {
            console.error('[WEBHOOK Push] Failed to send booking notification:', error)
          })

        // Notify about payment received
        pushNotificationService
          .sendPaymentConfirmation(businessOwner.id, {
            id: transaction?.id || 0,
            amount: currencyService.formatPrice(
              transaction?.amount || booking.amount,
              paymentCurrency,
              false
            ),
            bookingId: booking.id,
          })
          .catch((error) => {
            console.error('[WEBHOOK Push] Failed to send payment notification:', error)
          })
      }

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

    const currency = (data.currency as string)?.toUpperCase() || booking.business.currency || 'NGN'
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
      currency,
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

  /**
   * Handle Flutterwave webhooks
   */
  async flutterwave({ request, response }: HttpContext) {
    if (!flutterwaveService.isConfigured()) {
      console.error('[WEBHOOK] Flutterwave is not configured')
      return response.status(503).send('Flutterwave webhook handler not configured')
    }

    try {
      // Verify webhook signature
      const signature = request.header('verif-hash')

      if (!signature) {
        console.error('[WEBHOOK] Missing Flutterwave webhook signature')
        return response.status(400).send('Missing signature')
      }

      if (!flutterwaveService.verifyWebhookSignature(signature)) {
        console.error('[WEBHOOK] Invalid Flutterwave webhook signature')
        return response.status(400).send('Invalid signature')
      }

      const payload = request.body()
      const event = payload.event
      const data = payload.data

      console.log(`[WEBHOOK] Flutterwave event received: ${event}`)

      // Handle different event types
      switch (event) {
        case 'charge.completed':
          await this.handleFlutterwaveChargeCompleted(data)
          break

        default:
          console.log(`[WEBHOOK] Unhandled Flutterwave event: ${event}`)
      }

      return response.status(200).send('OK')
    } catch (error) {
      console.error('[WEBHOOK] Error processing Flutterwave webhook:', error)
      return response.status(500).send('Internal server error')
    }
  }

  /**
   * Handle successful Flutterwave charge
   */
  private async handleFlutterwaveChargeCompleted(data: any) {
    try {
      const { tx_ref: transactionReference, status, amount, currency, id: transactionId } = data

      if (status !== 'successful') {
        console.log(`[WEBHOOK] Flutterwave charge not successful: ${status}`)
        return
      }

      // Check if this is a subscription payment (format: subscription-{planId}-{businessId}-{timestamp})
      const subscriptionMatch = transactionReference.match(/^subscription-(\d+)-(\d+)-\d+$/)
      if (subscriptionMatch) {
        await this.handleFlutterwaveSubscriptionPayment(data)
        return
      }

      // Extract booking ID from transaction reference (format: booking-{id}-{timestamp})
      const bookingMatch = transactionReference.match(/^booking-(\d+)-\d+$/)
      if (!bookingMatch) {
        console.error(`[WEBHOOK] Invalid Flutterwave tx_ref format: ${transactionReference}`)
        return
      }

      const bookingId = Number.parseInt(bookingMatch[1])

      const booking = await Booking.query()
        .where('id', bookingId)
        .preload('business')
        .preload('service')
        .first()

      if (!booking) {
        console.error(`[WEBHOOK] Booking not found for tx_ref: ${transactionReference}`)
        return
      }

      // Idempotency check
      if (booking.paymentStatus === 'paid' && booking.status === 'confirmed') {
        console.log(`[WEBHOOK] Booking ${bookingId} already processed, skipping`)
        return
      }

      // Calculate platform fee (2.5%)
      const platformFee = Math.round(amount * 0.025)

      // Update booking and create transaction record in a database transaction
      await db.transaction(async (trx) => {
        // Update booking
        booking.paymentStatus = 'paid'
        booking.status = 'confirmed'
        booking.paymentReference = transactionReference
        await booking.useTransaction(trx).save()

        // Create transaction record
        const transaction = new Transaction()
        transaction.businessId = booking.businessId
        transaction.bookingId = booking.id
        transaction.amount = amount
        transaction.platformFee = platformFee
        transaction.businessAmount = amount - platformFee
        transaction.status = 'success'
        transaction.provider = 'flutterwave'
        transaction.type = 'payment'
        transaction.direction = 'credit'
        transaction.reference = transactionReference
        transaction.providerReference = transactionId
        transaction.currency = currency
        await transaction.useTransaction(trx).save()
      })

      // Send confirmation email
      try {
        await emailService.sendBookingConfirmation({
          customerName: booking.customerName,
          customerEmail: booking.customerEmail,
          businessName: booking.business.name,
          serviceName: booking.service?.name || '',
          date: booking.date.toFormat('EEE, MMM d, yyyy'),
          time: booking.startTime,
          duration: `${booking.service?.durationMinutes || 30} minutes`,
          amount,
          currency,
          reference: transactionReference,
        })
      } catch (error) {
        console.error('[EMAIL] Failed to send booking confirmation:', error)
      }

      // Send push notifications to business owner
      const businessOwner = await User.query()
        .where('businessId', booking.businessId)
        .where('role', 'owner')
        .first()

      if (businessOwner) {
        // Notify about new confirmed booking
        pushNotificationService
          .sendNewBookingNotification(businessOwner.id, {
            id: booking.id,
            customerName: booking.customerName,
            serviceName: booking.service?.name || '',
            time: `${booking.date.toFormat('MMM d')} at ${booking.startTime}`,
          })
          .catch((error) => {
            console.error('[WEBHOOK Push] Failed to send booking notification:', error)
          })

        // Notify about payment received
        pushNotificationService
          .sendPaymentConfirmation(businessOwner.id, {
            id: 0, // transaction not created yet
            amount: currencyService.formatPrice(amount, currency, false),
            bookingId: booking.id,
          })
          .catch((error) => {
            console.error('[WEBHOOK Push] Failed to send payment notification:', error)
          })
      }

      // Generate receipt
      const transaction = await Transaction.query()
        .where('bookingId', booking.id)
        .where('status', 'success')
        .where('providerReference', transactionId)
        .first()

      if (transaction) {
        try {
          await receiptService.generateReceipt(booking, transaction)
          console.log(`[WEBHOOK] Receipt generated for booking ${booking.id}`)
        } catch (error) {
          console.error('[WEBHOOK] Failed to generate receipt:', error)
        }
      }

      console.log(`[WEBHOOK] Successfully processed Flutterwave charge for booking ${booking.id}`)
    } catch (error) {
      console.error('[WEBHOOK] Error handling Flutterwave charge.completed:', error)
      throw error
    }
  }

  /**
   * Handle Flutterwave subscription payment
   */
  private async handleFlutterwaveSubscriptionPayment(data: any) {
    try {
      const { tx_ref: transactionReference, status, amount, currency } = data

      if (status !== 'successful') {
        console.log(`[WEBHOOK] Flutterwave subscription payment not successful: ${status}`)
        return
      }

      // Extract planId and businessId from reference (format: subscription-{planId}-{businessId}-{timestamp})
      const match = transactionReference.match(/^subscription-(\d+)-(\d+)-\d+$/)
      if (!match) {
        console.error(`[WEBHOOK] Invalid subscription tx_ref format: ${transactionReference}`)
        return
      }

      const planId = Number.parseInt(match[1])
      const businessId = Number.parseInt(match[2])

      console.log(
        `[WEBHOOK] Processing subscription payment for business ${businessId}, plan ${planId}`
      )

      // Check if subscription already exists (idempotency)
      const existingSubscription = await db
        .from('subscriptions')
        .where('business_id', businessId)
        .where('status', 'active')
        .orderBy('created_at', 'desc')
        .first()

      if (existingSubscription) {
        console.log(
          `[WEBHOOK] Active subscription already exists for business ${businessId}, skipping creation`
        )
        return
      }

      // Load business and plan
      const BusinessModule = await import('#models/business')
      const SubscriptionPlanModule = await import('#models/subscription_plan')
      const Business = BusinessModule.default
      const SubscriptionPlan = SubscriptionPlanModule.default

      const business = await Business.findOrFail(businessId)
      const plan = await SubscriptionPlan.findOrFail(planId)

      // Create subscription - this ensures subscription is created even if user doesn't complete redirect
      const subscription = await subscriptionService.createSubscription(
        business,
        plan,
        business.email,
        undefined, // No authorization code for one-time payments
        transactionReference, // Store payment reference
        currency.toUpperCase()
      )

      console.log(
        `[WEBHOOK] Created subscription ${subscription.id} for business ${businessId}, plan ${plan.displayName}`
      )

      // Send subscription confirmation email to business owner
      try {
        const businessOwner = await User.query()
          .where('businessId', businessId)
          .where('role', 'owner')
          .first()

        if (businessOwner) {
          await emailService.sendSubscriptionPaymentConfirmation({
            businessEmail: businessOwner.email,
            businessName: business.name,
            planName: plan.displayName,
            amount: amount,
            currency: currency.toUpperCase(),
            reference: transactionReference,
          })
          console.log(
            `[WEBHOOK] Sent subscription confirmation email to ${businessOwner.email} for ${plan.displayName} plan`
          )
        }
      } catch (emailError) {
        console.error('[WEBHOOK] Failed to send subscription confirmation email:', emailError)
      }
    } catch (error) {
      console.error('[WEBHOOK] Error handling Flutterwave subscription payment:', error)
      throw error
    }
  }

  /**
   * Handle Paystack subscription payment
   */
  private async handlePaystackSubscriptionPayment(data: Record<string, unknown>) {
    try {
      const reference = data.reference as string
      const status = data.status as string
      const currency = (data.currency as string) || 'NGN'

      if (status !== 'success') {
        console.log(`[WEBHOOK] Paystack subscription payment not successful: ${status}`)
        return
      }

      // Extract planId and businessId from reference (format: sub-{planId}-{businessId}-{timestamp})
      const match = reference.match(/^sub-(\d+)-(\d+)-\d+$/)
      if (!match) {
        console.error(`[WEBHOOK] Invalid subscription reference format: ${reference}`)
        return
      }

      const planId = Number.parseInt(match[1])
      const businessId = Number.parseInt(match[2])

      console.log(
        `[WEBHOOK] Processing Paystack subscription payment for business ${businessId}, plan ${planId}`
      )

      // Check if subscription already exists (idempotency)
      const existingSubscription = await db
        .from('subscriptions')
        .where('business_id', businessId)
        .where('status', 'active')
        .orderBy('created_at', 'desc')
        .first()

      if (existingSubscription) {
        console.log(
          `[WEBHOOK] Active subscription already exists for business ${businessId}, skipping creation`
        )
        return
      }

      // Load business and plan
      const BusinessModule = await import('#models/business')
      const SubscriptionPlanModule = await import('#models/subscription_plan')
      const Business = BusinessModule.default
      const SubscriptionPlan = SubscriptionPlanModule.default

      const business = await Business.findOrFail(businessId)
      const plan = await SubscriptionPlan.findOrFail(planId)

      // Create subscription - this ensures subscription is created even if user doesn't complete redirect
      const subscription = await subscriptionService.createSubscription(
        business,
        plan,
        business.email,
        undefined, // No authorization code for one-time payments
        reference, // Store payment reference
        currency.toUpperCase()
      )

      console.log(
        `[WEBHOOK] Created subscription ${subscription.id} for business ${businessId}, plan ${plan.displayName}`
      )

      // Send subscription confirmation email to business owner
      try {
        const businessOwner = await User.query()
          .where('businessId', businessId)
          .where('role', 'owner')
          .first()

        if (businessOwner) {
          const amountValue = typeof data.amount === 'number' ? data.amount : Number(data.amount)
          await emailService.sendSubscriptionPaymentConfirmation({
            businessEmail: businessOwner.email,
            businessName: business.name,
            planName: plan.displayName,
            amount: amountValue / 100, // Convert kobo to naira
            currency: currency,
            reference: reference,
          })
          console.log(
            `[WEBHOOK] Sent subscription confirmation email to ${businessOwner.email} for ${plan.displayName} plan`
          )
        }
      } catch (emailError) {
        console.error('[WEBHOOK] Failed to send subscription confirmation email:', emailError)
      }
    } catch (error) {
      console.error('[WEBHOOK] Error handling Paystack subscription payment:', error)
      throw error
    }
  }
}
