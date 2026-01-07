import type { HttpContext } from '@adonisjs/core/http'
import Booking from '#models/booking'
import Business from '#models/business'
import Transaction from '#models/transaction'
import { DateTime } from 'luxon'
import refundService from '../services/refund_service.js'

export default class BookingsController {
  async index({ view, auth, request }: HttpContext) {
    const user = auth.user!
    const page = Number(request.qs().page) || 1
    const status = request.qs().status || 'all'
    const date = request.qs().date || ''
    const search = request.qs().search?.trim() || ''

    const business = await Business.findOrFail(user.businessId)

    const query = Booking.query()
      .where('businessId', business.id)
      .preload('service')
      .preload('staff')
      .orderBy('date', 'desc')
      .orderBy('startTime', 'desc')

    if (status !== 'all') {
      query.where('status', status)
    }

    if (date) {
      query.where('date', date)
    }

    if (search) {
      query.where((q) => {
        q.whereILike('customerName', `%${search}%`)
          .orWhereILike('customerEmail', `%${search}%`)
          .orWhereILike('customerPhone', `%${search}%`)
      })
    }

    const bookings = await query.paginate(page, 20)
    bookings.baseUrl('/bookings')

    // Get transaction currencies and amounts for paid bookings
    const paidBookingIds = bookings
      .all()
      .filter((b) => b.paymentStatus === 'paid')
      .map((b) => b.id)

    const transactions =
      paidBookingIds.length > 0
        ? await Transaction.query()
            .whereIn('bookingId', paidBookingIds)
            .where('status', 'success')
            .select('bookingId', 'currency', 'amount')
            .exec()
        : []

    const bookingCurrencyMap: Record<number, string> = {}
    const bookingAmountMap: Record<number, number> = {}
    for (const transaction of transactions) {
      if (transaction.bookingId && !bookingCurrencyMap[transaction.bookingId]) {
        bookingCurrencyMap[transaction.bookingId] =
          transaction.currency || business.currency || 'NGN'
        bookingAmountMap[transaction.bookingId] = transaction.amount
      }
    }

    return view.render('pages/bookings/index', {
      bookings,
      business,
      status,
      date,
      search,
      bookingCurrencyMap,
      bookingAmountMap,
    })
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

    // Get transaction for this booking if paid
    let transaction: Transaction | null = null
    if (booking.paymentStatus === 'paid') {
      transaction = await Transaction.query()
        .where('bookingId', booking.id)
        .where('status', 'success')
        .orderBy('createdAt', 'desc')
        .first()
    }

    return view.render('pages/bookings/show', { booking, transaction })
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

  async refund({ params, request, response, auth, session }: HttpContext) {
    const user = auth.user!
    const booking = await Booking.query()
      .where('id', params.id)
      .where('businessId', user.businessId!)
      .preload('service')
      .first()

    if (!booking) {
      return response.notFound('Booking not found')
    }

    if (booking.paymentStatus !== 'paid') {
      session.flash('error', 'Only paid bookings can be refunded')
      return response.redirect().back()
    }

    const { amount, reason } = request.only(['amount', 'reason'])

    if (!reason || reason.trim().length === 0) {
      session.flash('error', 'Refund reason is required')
      return response.redirect().back()
    }

    const result = await refundService.processRefund({
      bookingId: booking.id,
      amount: amount ? Number.parseFloat(amount) : undefined,
      reason: reason.trim(),
      initiatedBy: 'business',
    })

    if (result.success) {
      session.flash('success', result.message)
    } else {
      session.flash('error', result.message)
    }

    return response.redirect().back()
  }
}
