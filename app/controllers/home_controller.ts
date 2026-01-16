import type { HttpContext } from '@adonisjs/core/http'
import FeaturedBusiness from '#models/featured-business'
import SubscriptionPlan from '#models/subscription_plan'
import currencyService from '#services/currency_service'
import { DateTime } from 'luxon'

export default class HomeController {
  async index({ view, request }: HttpContext) {
    // Fetch active featured businesses
    const featuredBusinesses = await FeaturedBusiness.query()
      .where('status', 'active')
      .where('expiresAt', '>', DateTime.now().toSQL()!)
      .preload('business')
      .orderBy('startsAt', 'desc')
      .limit(10)

    // Fetch active subscription plans
    const plans = await SubscriptionPlan.query()
      .where('isActive', true)
      .where('price', '>', 0)
      .orderBy('sortOrder', 'asc')
      .limit(3)

    const currencyOverride = request.qs().currency

    // Detect currency from user's locale
    const acceptLanguage = request.header('accept-language') || ''
    const currency =
      currencyOverride || currencyService.detectCurrencyFromLocale(acceptLanguage) || 'NGN'

    return view.render('pages/landing', {
      featuredBusinesses,
      plans,
      currency,
    })
  }

  async pricing({ view, request }: HttpContext) {
    const plans = await SubscriptionPlan.query()
      .where('isActive', true)
      .where('price', '>', 0)
      .orderBy('sortOrder', 'asc')
      .limit(3)

    let currency = request.qs().currency

    if (!currency) {
      const acceptLanguage = request.header('accept-language') || ''
      currency = currencyService.detectCurrencyFromLocale(acceptLanguage)
    }

    currency = currency || 'NGN'

    return view.render('pages/pricing', {
      plans,
      currency,
    })
  }
}
