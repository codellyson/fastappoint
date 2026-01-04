import type { HttpContext } from '@adonisjs/core/http'
import Business from '#models/business'
import Booking from '#models/booking'
import { DateTime } from 'luxon'

export default class DashboardController {
  async index({ view, auth, response }: HttpContext) {
    const user = auth.user!

    if (!user.businessId) {
      return view.render('pages/dashboard', { business: null, stats: null, upcomingBookings: [] })
    }

    const business = await Business.query()
      .where('id', user.businessId)
      .preload('services')
      .firstOrFail()

    if (!business.isOnboarded) {
      return response.redirect().toRoute('onboarding.show')
    }

    const today = DateTime.now().toISODate()

    const upcomingBookings = await Booking.query()
      .where('businessId', business.id)
      .where('status', 'confirmed')
      .where('date', '>=', today!)
      .preload('service')
      .preload('staff')
      .orderBy('date', 'asc')
      .orderBy('startTime', 'asc')
      .limit(5)

    const todayBookings = await Booking.query()
      .where('businessId', business.id)
      .where('date', today!)
      .whereIn('status', ['confirmed', 'completed'])
      .count('* as total')

    const monthStart = DateTime.now().startOf('month').toISODate()
    const monthBookings = await Booking.query()
      .where('businessId', business.id)
      .where('date', '>=', monthStart!)
      .whereIn('status', ['confirmed', 'completed'])
      .count('* as total')

    const monthRevenue = await Booking.query()
      .where('businessId', business.id)
      .where('date', '>=', monthStart!)
      .where('paymentStatus', 'paid')
      .sum('amount as total')

    const stats = {
      todayBookings: Number(todayBookings[0].$extras.total) || 0,
      monthBookings: Number(monthBookings[0].$extras.total) || 0,
      monthRevenue: Number(monthRevenue[0].$extras.total) || 0,
      servicesCount: business.services.length,
    }

    // Get subscription/trial info
    const subscription = await business.getCurrentSubscription()
    let trialDaysRemaining = 0
    let trialExpired = false

    if (subscription?.status === 'trialing' && subscription.trialEndsAt) {
      trialExpired = subscription.trialEndsAt < DateTime.now()
      if (!trialExpired) {
        trialDaysRemaining = Math.ceil(subscription.trialEndsAt.diffNow('days').days)
      }
    }

    return view.render('pages/dashboard', {
      business,
      stats,
      upcomingBookings,
      subscription,
      trialDaysRemaining,
      trialExpired,
    })
  }
}
