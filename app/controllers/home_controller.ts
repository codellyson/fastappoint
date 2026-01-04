import type { HttpContext } from '@adonisjs/core/http'
import FeaturedBusiness from '#models/featured-business'
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
}
