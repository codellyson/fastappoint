import type { HttpContext } from '@adonisjs/core/http'
import Business from '#models/business'
import FeaturedBusiness from '#models/featured-business'
import { DateTime } from 'luxon'
import env from '#start/env'
import { randomBytes } from 'node:crypto'

export default class FeaturedController {
  async index({ view, auth }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    const currentFeatured = await FeaturedBusiness.query()
      .where('businessId', business.id)
      .where('status', 'active')
      .where('expiresAt', '>', DateTime.now().toSQL()!)
      .first()

    const history = await FeaturedBusiness.query()
      .where('businessId', business.id)
      .orderBy('createdAt', 'desc')
      .limit(10)

    return view.render('pages/featured/index', {
      business,
      currentFeatured,
      history,
      plans: FeaturedBusiness.PLANS,
    })
  }

  async purchase({ view, auth, params }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)
    const planKey = params.plan as keyof typeof FeaturedBusiness.PLANS

    const plan = FeaturedBusiness.PLANS[planKey]
    if (!plan) {
      return view.render('pages/featured/index', {
        business,
        plans: FeaturedBusiness.PLANS,
        error: 'Invalid plan selected',
      })
    }

    return view.render('pages/featured/purchase', {
      business,
      planKey,
      plan,
    })
  }

  async initiate({ request, response, auth, session }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)
    const { plan: planKey, workspaceImage, displayName } = request.only([
      'plan',
      'workspaceImage',
      'displayName',
    ])

    const plan = FeaturedBusiness.PLANS[planKey as keyof typeof FeaturedBusiness.PLANS]
    if (!plan) {
      session.flash('error', 'Invalid plan selected')
      return response.redirect().back()
    }

    const paymentReference = `FT-${randomBytes(8).toString('hex').toUpperCase()}`

    const featured = await FeaturedBusiness.create({
      businessId: business.id,
      plan: planKey,
      durationDays: plan.duration,
      amount: plan.amount,
      paymentReference,
      status: 'pending',
      workspaceImage: workspaceImage || business.logo,
      displayName: displayName || business.name,
    })

    return response.redirect().toRoute('featured.payment', { id: featured.id })
  }

  async payment({ view, auth, params, response }: HttpContext) {
    const user = auth.user!
    const featured = await FeaturedBusiness.query()
      .where('id', params.id)
      .preload('business')
      .first()

    if (!featured || featured.business.id !== user.businessId) {
      return response.notFound('Featured listing not found')
    }

    if (featured.status !== 'pending') {
      return response.redirect().toRoute('featured.index')
    }

    const paystackPublicKey = env.get('PAYSTACK_PUBLIC_KEY')

    return view.render('pages/featured/payment', {
      featured,
      paystackPublicKey,
    })
  }

  async verify({ params, request, response, session }: HttpContext) {
    const reference = request.qs().reference
    const featured = await FeaturedBusiness.query()
      .where('id', params.id)
      .preload('business')
      .first()

    if (!featured) {
      return response.notFound('Featured listing not found')
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
        const data = (await paystackResponse.json()) as {
          status: boolean
          data: { status: string }
        }

        if (data.status && data.data.status === 'success') {
          paymentSuccess = true
        }
      } catch (error) {
        console.error('Payment verification error:', error)
      }
    } else {
      paymentSuccess = true
    }

    if (paymentSuccess) {
      const startsAt = DateTime.now()
      const expiresAt = startsAt.plus({ days: featured.durationDays })

      featured.merge({
        status: 'active',
        paystackReference: reference,
        startsAt,
        expiresAt,
      })
      await featured.save()

      session.flash('success', 'Your business is now featured!')
      return response.redirect().toRoute('featured.index')
    }

    session.flash('error', 'Payment verification failed')
    return response.redirect().toRoute('featured.payment', { id: featured.id })
  }

  async cancel({ params, response, auth, session }: HttpContext) {
    const user = auth.user!
    const featured = await FeaturedBusiness.query()
      .where('id', params.id)
      .preload('business')
      .first()

    if (!featured || featured.business.id !== user.businessId) {
      return response.notFound('Featured listing not found')
    }

    if (featured.status === 'pending') {
      featured.status = 'cancelled'
      await featured.save()
      session.flash('success', 'Featured listing cancelled')
    }

    return response.redirect().toRoute('featured.index')
  }

  async getActiveFeatured({ response }: HttpContext) {
    const featured = await FeaturedBusiness.query()
      .where('status', 'active')
      .where('expiresAt', '>', DateTime.now().toSQL()!)
      .preload('business')
      .orderBy('createdAt', 'desc')
      .limit(20)

    return response.json(
      featured.map((f) => ({
        id: f.id,
        name: f.displayName || f.business.name,
        image: f.workspaceImage || f.business.logo,
        slug: f.business.slug,
        category: f.business.category,
      }))
    )
  }
}

