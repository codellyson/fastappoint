import { BaseCommand } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'
import Booking from '#models/booking'
import emailService from '#services/email_service'
import env from '#start/env'

export default class ExpirePayments extends BaseCommand {
  static commandName = 'payments:expire'
  static description =
    'Expire bookings with pending payments that have exceeded their expiration time'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('Checking for expired payment bookings...')

    const now = DateTime.now()

    // Find bookings that are pending payment and have expired
    const expiredBookings = await Booking.query()
      .where('status', 'pending_payment')
      .where('paymentStatus', 'pending')
      .whereNotNull('paymentExpiresAt')
      .where('paymentExpiresAt', '<', now.toSQL()!)
      .preload('business')
      .preload('service')

    this.logger.info(`Found ${expiredBookings.length} expired payment bookings`)

    let expired = 0

    for (const booking of expiredBookings) {
      try {
        // Cancel the booking
        booking.status = 'cancelled'
        booking.paymentStatus = 'pending'
        booking.cancelledAt = DateTime.now()
        booking.cancellationReason = 'Payment expired - booking not completed within time limit'
        await booking.save()

        // Send notification email to customer
        const appUrl = env.get('APP_URL', `https://${env.get('APP_DOMAIN', 'fastappoint.com')}`)
        const bookingUrl = `${appUrl}/book/${booking.business.slug}`

        await emailService.send({
          to: booking.customerEmail,
          subject: `Payment Expired - ${booking.business.name}`,
          html: this.getPaymentExpiredEmail(
            booking.customerName,
            booking.business.name,
            booking.service.name,
            booking.date.toFormat('EEEE, MMMM d, yyyy'),
            `${booking.startTime} - ${booking.endTime}`,
            bookingUrl
          ),
        })

        expired++
        this.logger.info(`Expired booking #${booking.id} for ${booking.customerEmail}`)
      } catch (error) {
        this.logger.error(`Failed to expire booking #${booking.id}:`, error)
      }
    }

    this.logger.success(`Expired ${expired} payment bookings`)
  }

  private getPaymentExpiredEmail(
    customerName: string,
    businessName: string,
    serviceName: string,
    date: string,
    time: string,
    bookingUrl: string
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
          .button { display: inline-block; padding: 12px 24px; background-color: #5A45FF; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Expired</h1>
          </div>
          <div class="content">
            <p>Hi ${customerName},</p>
            <p>We're sorry, but your payment for the following booking was not completed within the time limit:</p>
            <ul>
              <li><strong>Business:</strong> ${businessName}</li>
              <li><strong>Service:</strong> ${serviceName}</li>
              <li><strong>Date:</strong> ${date}</li>
              <li><strong>Time:</strong> ${time}</li>
            </ul>
            <p>The booking has been cancelled and the time slot has been released.</p>
            <p>If you'd like to book again, please visit the booking page:</p>
            <a href="${bookingUrl}" class="button">Book Again</a>
            <p>If you have any questions, please contact ${businessName} directly.</p>
            <p>Best regards,<br>FastAppoint Team</p>
          </div>
        </div>
      </body>
      </html>
    `
  }
}
