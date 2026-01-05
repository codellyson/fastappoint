import type { HttpContext } from '@adonisjs/core/http'
import { createHmac } from 'node:crypto'
import env from '#start/env'
import Booking from '#models/booking'
import Transaction from '#models/transaction'
import emailService from '#services/email_service'
import subscriptionService from '../services/subscription_service.js'
import receiptService from '#services/receipt_service'
import withdrawalService from '#services/withdrawal_service'

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
        receiptService.generateReceipt(booking, transaction).catch((error: any) => {
          console.error('[WEBHOOK] Failed to generate receipt:', error)
        })
      }

      // Send emails outside transaction
      const dateFormatted = booking.date.toFormat('EEEE, MMMM d, yyyy')

      await emailService.sendBookingConfirmation({
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        businessName: booking.business.name,
        serviceName: booking.service.name,
        date: dateFormatted,
        time: `${booking.startTime} - ${booking.endTime}`,
        duration: booking.service.formattedDuration,
        amount: booking.amount,
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
}
