import { BaseCommand } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'
import Booking from '#models/booking'
import emailService from '#services/email_service'
import env from '#start/env'

export default class SendReminders extends BaseCommand {
  static commandName = 'reminders:send'
  static description = 'Send email reminders for upcoming bookings'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('Checking for bookings that need reminders...')

    const now = DateTime.now()

    const reminders24h = await this.getBookingsFor24hReminder(now)
    const reminders1h = await this.getBookingsFor1hReminder(now)

    this.logger.info(`Found ${reminders24h.length} bookings for 24h reminder`)
    this.logger.info(`Found ${reminders1h.length} bookings for 1h reminder`)

    let sent24h = 0
    let sent1h = 0

    for (const booking of reminders24h) {
      const success = await this.sendReminder(booking, '24h')
      if (success) {
        booking.reminder24hSentAt = DateTime.now()
        await booking.save()
        sent24h++
      }
    }

    for (const booking of reminders1h) {
      const success = await this.sendReminder(booking, '1h')
      if (success) {
        booking.reminder1hSentAt = DateTime.now()
        await booking.save()
        sent1h++
      }
    }

    this.logger.success(`Reminders sent: ${sent24h} (24h), ${sent1h} (1h)`)
  }

  private async getBookingsFor24hReminder(now: DateTime): Promise<Booking[]> {
    // Get bookings that are 20-28 hours away (giving a window for the cron to catch them)
    const minTime = now.plus({ hours: 20 })
    const maxTime = now.plus({ hours: 28 })

    const bookings = await Booking.query()
      .where('status', 'confirmed')
      .where('paymentStatus', 'paid')
      .whereNull('reminder_24h_sent_at')
      .where('date', '>=', minTime.toISODate()!)
      .where('date', '<=', maxTime.toISODate()!)
      .preload('business')
      .preload('service')
      .preload('staff')

    // Filter by business settings and exact time window
    return bookings.filter((booking) => {
      // Check if business has 24h reminders enabled
      if (booking.business.reminder24hEnabled === false) {
        return false
      }

      // Calculate exact booking datetime
      const [hour, minute] = booking.startTime.split(':').map(Number)
      const bookingDateTime = booking.date.set({ hour, minute })
      const hoursUntilBooking = bookingDateTime.diff(now, 'hours').hours

      // Send reminder if booking is 20-28 hours away
      return hoursUntilBooking >= 20 && hoursUntilBooking <= 28
    })
  }

  private async getBookingsFor1hReminder(now: DateTime): Promise<Booking[]> {
    // Get bookings for today and tomorrow (in case of late night bookings)
    const today = now.toISODate()!
    const tomorrow = now.plus({ days: 1 }).toISODate()!

    const bookings = await Booking.query()
      .where('status', 'confirmed')
      .where('paymentStatus', 'paid')
      .whereNull('reminder_1h_sent_at')
      .whereIn('date', [today, tomorrow])
      .preload('business')
      .preload('service')
      .preload('staff')

    // Filter by business settings and exact time window (45 min to 90 min before)
    return bookings.filter((booking) => {
      // Check if business has 1h reminders enabled
      if (booking.business.reminder1hEnabled === false) {
        return false
      }

      // Calculate exact booking datetime
      const [hour, minute] = booking.startTime.split(':').map(Number)
      const bookingDateTime = booking.date.set({ hour, minute })
      const minutesUntilBooking = bookingDateTime.diff(now, 'minutes').minutes

      // Send reminder if booking is 45-90 minutes away
      return minutesUntilBooking >= 45 && minutesUntilBooking <= 90
    })
  }

  private async sendReminder(booking: Booking, type: '24h' | '1h'): Promise<boolean> {
    const dateFormatted = booking.date.toFormat('EEEE, MMMM d, yyyy')
    const appUrl = env.get('APP_URL', 'http://localhost:3333')
    const manageUrl = `${appUrl}/book/${booking.business.slug}/booking/${booking.id}/manage`

    try {
      await emailService.sendBookingReminder({
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        businessName: booking.business.name,
        serviceName: booking.service.name,
        date: dateFormatted,
        time: `${booking.startTime} - ${booking.endTime}`,
        staffName: booking.staff?.fullName,
        reminderType: type,
        manageUrl,
      })
      this.logger.info(
        `Sent ${type} reminder for booking #${booking.id} to ${booking.customerEmail}`
      )
      return true
    } catch (error) {
      this.logger.error(`Failed to send reminder for booking #${booking.id}: ${error}`)
      return false
    }
  }
}
