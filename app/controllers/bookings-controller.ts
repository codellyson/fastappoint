import type { HttpContext } from '@adonisjs/core/http'
import Booking from '#models/booking'
import Business from '#models/business'
import { DateTime } from 'luxon'

export default class BookingsController {
  async index({ view, auth, request }: HttpContext) {
    const user = auth.user!
    const page = request.qs().page || 1
    const status = request.qs().status || 'all'
    const date = request.qs().date || ''

    const business = await Business.findOrFail(user.businessId)

    const query = Booking.query()
      .where('businessId', business.id)
      .preload('service')
      .orderBy('date', 'desc')
      .orderBy('startTime', 'desc')

    if (status !== 'all') {
      query.where('status', status)
    }

    if (date) {
      query.where('date', date)
    }

    const bookings = await query.paginate(page, 20)

    return view.render('pages/bookings/index', { bookings, business, status, date })
  }

  async show({ params, view, auth, response }: HttpContext) {
    const user = auth.user!
    const booking = await Booking.query()
      .where('id', params.id)
      .where('businessId', user.businessId!)
      .preload('service')
      .preload('staff')
      .preload('business')
      .first()

    if (!booking) {
      return response.notFound('Booking not found')
    }

    return view.render('pages/bookings/show', { booking })
  }

  async markComplete({ params, response, auth, session }: HttpContext) {
    const user = auth.user!
    const booking = await Booking.query()
      .where('id', params.id)
      .where('businessId', user.businessId!)
      .first()

    if (!booking) {
      return response.notFound('Booking not found')
    }

    booking.status = 'completed'
    await booking.save()

    session.flash('success', 'Booking marked as completed')
    return response.redirect().back()
  }

  async cancel({ params, request, response, auth, session }: HttpContext) {
    const user = auth.user!
    const booking = await Booking.query()
      .where('id', params.id)
      .where('businessId', user.businessId!)
      .first()

    if (!booking) {
      return response.notFound('Booking not found')
    }

    const reason = request.input('reason', 'Cancelled by business')
    booking.status = 'cancelled'
    booking.cancelledAt = DateTime.now()
    booking.cancellationReason = reason
    await booking.save()

    session.flash('success', 'Booking cancelled')
    return response.redirect().back()
  }
}
