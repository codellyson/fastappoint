import { DateTime } from 'luxon'
import env from '#start/env'
import Booking from '#models/booking'
import Transaction from '#models/transaction'
import emailService from '#services/email-service'

interface RefundRequest {
  bookingId: number
  amount?: number // Optional: for partial refunds
  reason: string
  initiatedBy: 'business' | 'customer' | 'admin'
}

class RefundService {
  private secretKey: string | null

  constructor() {
    this.secretKey = env.get('PAYSTACK_SECRET_KEY') || null
  }

  /**
   * Process a refund for a booking
   */
  async processRefund(request: RefundRequest): Promise<{ success: boolean; message: string; refundReference?: string }> {
    const booking = await Booking.query()
      .where('id', request.bookingId)
      .preload('business')
      .preload('service')
      .first()

    if (!booking) {
      return { success: false, message: 'Booking not found' }
    }

    if (booking.paymentStatus !== 'paid') {
      return { success: false, message: 'Booking is not paid, cannot refund' }
    }

    const transaction = await Transaction.query()
      .where('bookingId', booking.id)
      .where('status', 'success')
      .orderBy('createdAt', 'desc')
      .first()

    if (!transaction || !transaction.providerReference) {
      return { success: false, message: 'Transaction not found or invalid' }
    }

    const refundAmount = request.amount || transaction.amount
    if (refundAmount > transaction.amount) {
      return { success: false, message: 'Refund amount cannot exceed transaction amount' }
    }

    if (!this.secretKey) {
      return { success: false, message: 'Payment provider not configured' }
    }

    try {
      // Initiate refund via Paystack
      const response = await fetch('https://api.paystack.co/refund', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction: transaction.providerReference,
          amount: refundAmount * 100, // Convert to kobo
          currency: 'NGN',
          customer_note: request.reason,
        }),
      })

      const data = await response.json() as {
        status: boolean
        message?: string
        data?: {
          transaction?: { reference: string }
          reference: string
        }
      }

      if (data.status && data.data) {
        // Update transaction status
        if (refundAmount === transaction.amount) {
          transaction.status = 'refunded'
        } else {
          // Partial refund - keep status as success but note the refund
          // You might want to add a partial_refunded status
        }
        await transaction.save()

        // Update booking
        if (refundAmount === transaction.amount) {
          booking.paymentStatus = 'refunded'
          booking.status = 'cancelled'
          booking.cancellationReason = `Refunded: ${request.reason}`
          booking.cancelledAt = DateTime.now()
        }
        await booking.save()

        // Send notification emails
        await this.sendRefundNotifications(booking, refundAmount, request.reason, request.initiatedBy)

        return {
          success: true,
          message: 'Refund processed successfully',
          refundReference: data.data.transaction?.reference || data.data.reference,
        }
      } else {
        return { success: false, message: (data as { message?: string }).message || 'Refund failed' }
      }
    } catch (error: any) {
      console.error('[Refund] Error processing refund:', error)
      return { success: false, message: error.message || 'Failed to process refund' }
    }
  }

  /**
   * Send refund notification emails
   */
  private async sendRefundNotifications(
    booking: Booking,
    amount: number,
    reason: string,
    initiatedBy: string
  ): Promise<void> {
    // Email to customer
    await emailService.send({
      to: booking.customerEmail,
      subject: `Refund Processed - ${booking.business.name}`,
      html: this.getRefundCustomerEmail(booking, amount, reason),
    })

    // Email to business
    await emailService.send({
      to: booking.business.email,
      subject: `Refund Processed for Booking #${booking.id}`,
      html: this.getRefundBusinessEmail(booking, amount, reason, initiatedBy),
    })
  }

  private getRefundCustomerEmail(booking: Booking, amount: number, reason: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #5A45FF; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Refund Processed</h1>
          </div>
          <div class="content">
            <p>Hi ${booking.customerName},</p>
            <p>Your refund has been processed successfully.</p>
            <p><strong>Refund Amount:</strong> ₦${amount.toLocaleString()}</p>
            <p><strong>Reason:</strong> ${reason}</p>
            <p>The refund will be credited back to your original payment method within 3-5 business days.</p>
            <p>If you have any questions, please contact ${booking.business.name}.</p>
            <p>Best regards,<br>FastAppoint Team</p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  private getRefundBusinessEmail(
    booking: Booking,
    amount: number,
    reason: string,
    initiatedBy: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #5A45FF; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Refund Processed</h1>
          </div>
          <div class="content">
            <p>Hi ${booking.business.name},</p>
            <p>A refund has been processed for the following booking:</p>
            <ul>
              <li><strong>Booking ID:</strong> #${booking.id}</li>
              <li><strong>Customer:</strong> ${booking.customerName}</li>
              <li><strong>Service:</strong> ${booking.service.name}</li>
              <li><strong>Refund Amount:</strong> ₦${amount.toLocaleString()}</li>
              <li><strong>Reason:</strong> ${reason}</li>
              <li><strong>Initiated By:</strong> ${initiatedBy}</li>
            </ul>
            <p>Best regards,<br>FastAppoint Team</p>
          </div>
        </div>
      </body>
      </html>
    `
  }
}

export default new RefundService()

