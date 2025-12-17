import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import env from '#start/env'
import Business from '#models/business'
import Booking from '#models/booking'
import { bookingValidator } from '#validators/booking-validator'
import { errors } from '@vinejs/vine'
import { randomUUID } from 'node:crypto'
import emailService from '#services/email-service'

export default class BookingController {
  async show({ params, view, response }: HttpContext) {
    const business = await Business.query()
      .where('slug', params.slug)
      .where('isActive', true)
      .where('isOnboarded', true)
      .preload('services', (query) => query.where('isActive', true).orderBy('sortOrder'))
      .preload('availabilities', (query) => query.where('isActive', true))
      .first()

    if (!business) {
      return response.status(404).send('Business not found')
    }

    return view.render('pages/book/index', { business })
  }

  async getTimeSlots({ params, request, response }: HttpContext) {
    const { slug, serviceId } = params
    const dateStr = request.qs().date

    if (!dateStr) {
      return response.badRequest({ error: 'Date is required' })
    }

    const business = await Business.query()
      .where('slug', slug)
      .where('isActive', true)
      .preload('services', (query) => query.where('id', serviceId))
      .preload('availabilities', (query) => query.where('isActive', true))
      .first()

    if (!business || business.services.length === 0) {
      return response.notFound({ error: 'Business or service not found' })
    }

    const service = business.services[0]
    const selectedDate = DateTime.fromISO(dateStr)
    const dayOfWeek = selectedDate.weekday % 7

    const availability = business.availabilities.find((a) => a.dayOfWeek === dayOfWeek)
    if (!availability) {
      return response.json({ slots: [], message: 'Closed on this day' })
    }

    const existingBookings = await Booking.query()
      .where('businessId', business.id)
      .where('date', selectedDate.toISODate()!)
      .whereNotIn('status', ['cancelled'])

    const slots = this.generateTimeSlots(
      availability.startTime,
      availability.endTime,
      service.durationMinutes,
      existingBookings.map((b) => ({ start: b.startTime, end: b.endTime }))
    )

    return response.json({ slots })
  }

  private generateTimeSlots(
    startTime: string,
    endTime: string,
    durationMinutes: number,
    bookedSlots: Array<{ start: string; end: string }>
  ) {
    const slots: Array<{ time: string; available: boolean }> = []
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)

    let currentHour = startHour
    let currentMin = startMin

    const endInMinutes = endHour * 60 + endMin

    while (currentHour * 60 + currentMin + durationMinutes <= endInMinutes) {
      const timeStr = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`
      const slotEndMin = currentHour * 60 + currentMin + durationMinutes
      const slotEndHour = Math.floor(slotEndMin / 60)
      const slotEndMinute = slotEndMin % 60
      const slotEndStr = `${slotEndHour.toString().padStart(2, '0')}:${slotEndMinute.toString().padStart(2, '0')}`

      const isBooked = bookedSlots.some((booked) => {
        return this.timesOverlap(timeStr, slotEndStr, booked.start, booked.end)
      })

      slots.push({ time: timeStr, available: !isBooked })

      currentMin += 30
      if (currentMin >= 60) {
        currentHour++
        currentMin -= 60
      }
    }

    return slots
  }

  private timesOverlap(start1: string, end1: string, start2: string, end2: string) {
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number)
      return h * 60 + m
    }
    const s1 = toMinutes(start1)
    const e1 = toMinutes(end1)
    const s2 = toMinutes(start2)
    const e2 = toMinutes(end2)
    return s1 < e2 && e1 > s2
  }

  async createBooking({ params, request, response, session }: HttpContext) {
    const business = await Business.query()
      .where('slug', params.slug)
      .where('isActive', true)
      .preload('services', (query) => query.where('id', params.serviceId))
      .first()

    if (!business || business.services.length === 0) {
      return response.notFound({ error: 'Business or service not found' })
    }

    try {
      const data = await request.validateUsing(bookingValidator)
      const service = business.services[0]

      const selectedDate = DateTime.fromISO(data.date)
      const [startHour, startMin] = data.time.split(':').map(Number)
      const endMinutes = startHour * 60 + startMin + service.durationMinutes
      const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`

      const existingBooking = await Booking.query()
        .where('businessId', business.id)
        .where('date', selectedDate.toISODate()!)
        .whereNotIn('status', ['cancelled'])
        .where((query) => {
          query
            .where((q) => {
              q.where('startTime', '<', endTime).where('endTime', '>', data.time)
            })
        })
        .first()

      if (existingBooking) {
        session.flash('error', 'This time slot is no longer available')
        return response.redirect().back()
      }

      const booking = await Booking.create({
        businessId: business.id,
        serviceId: service.id,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone || null,
        date: selectedDate,
        startTime: data.time,
        endTime: endTime,
        status: 'pending_payment',
        amount: service.price,
        paymentStatus: 'pending',
        paymentReference: randomUUID(),
      })

      return response.redirect().toRoute('book.payment', {
        slug: params.slug,
        bookingId: booking.id,
      })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        session.flash('error', 'Please fill in all required fields')
        return response.redirect().back()
      }
      throw error
    }
  }

  async showPayment({ params, view, response }: HttpContext) {
    const booking = await Booking.query()
      .where('id', params.bookingId)
      .preload('business')
      .preload('service')
      .first()

    if (!booking || booking.business.slug !== params.slug) {
      return response.notFound('Booking not found')
    }

    if (booking.paymentStatus === 'paid') {
      return response.redirect().toRoute('book.confirmation', {
        slug: params.slug,
        bookingId: booking.id,
      })
    }

    const paystackPublicKey = env.get('PAYSTACK_PUBLIC_KEY', 'pk_test_xxxxx')
    return view.render('pages/book/payment', { booking, paystackPublicKey })
  }

  async confirmBooking({ params, view, response }: HttpContext) {
    const booking = await Booking.query()
      .where('id', params.bookingId)
      .preload('business')
      .preload('service')
      .first()

    if (!booking || booking.business.slug !== params.slug) {
      return response.notFound('Booking not found')
    }

    return view.render('pages/book/confirmation', { booking })
  }

  async verifyPayment({ params, request, response }: HttpContext) {
    const reference = request.qs().reference
    const booking = await Booking.query()
      .where('id', params.bookingId)
      .preload('business')
      .preload('service')
      .first()

    if (!booking || booking.business.slug !== params.slug) {
      return response.notFound('Booking not found')
    }

    const secretKey = env.get('PAYSTACK_SECRET_KEY')
    let paymentSuccess = false

    if (secretKey) {
      try {
        const paystackResponse = await fetch(
          `https://api.paystack.co/transaction/verify/${reference}`,
          {
            headers: {
              Authorization: `Bearer ${secretKey}`,
            },
          }
        )
        const data = await paystackResponse.json()

        if (data.status && data.data.status === 'success') {
          booking.paymentStatus = 'paid'
          booking.status = 'confirmed'
          await booking.save()
          paymentSuccess = true
        }
      } catch (error) {
        console.error('Payment verification error:', error)
      }
    } else {
      booking.paymentStatus = 'paid'
      booking.status = 'confirmed'
      await booking.save()
      paymentSuccess = true
    }

    if (paymentSuccess) {
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
    }

    return response.redirect().toRoute('book.confirmation', {
      slug: params.slug,
      bookingId: booking.id,
    })
  }
}
