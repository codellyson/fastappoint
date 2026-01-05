import type { HttpContext } from '@adonisjs/core/http'
import FeaturedBusiness from '#models/featured-business'
import SubscriptionPlan from '#models/subscription_plan'
import { DateTime } from 'luxon'

export default class HomeController {
  async index({ view }: HttpContext) {
    // Fetch active featured businesses
    const featuredBusinesses = await FeaturedBusiness.query()
      .where('status', 'active')
      .where('expiresAt', '>', DateTime.now().toSQL()!)
      .preload('business')
      .orderBy('startsAt', 'desc')
      .limit(10)

    return view.render('pages/landing', {
      featuredBusinesses,
    })
  }

  async pricing({ view }: HttpContext) {
    const plans = await SubscriptionPlan.query()
      .where('isActive', true)
      .where('price', '>', 0)
      .orderBy('sortOrder', 'asc')
      .limit(3)

    return view.render('pages/pricing', {
      plans,
    })
  }
}
