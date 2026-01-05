import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Business from '#models/business'
import SubscriptionPlan from '#models/subscription_plan'
import subscriptionService from '../services/subscription_service.js'
import env from '#start/env'

export default class SubscriptionsController {
  /**
   * Show pricing page with all available plans
   */
  async index({ view }: HttpContext) {
    const plans = await SubscriptionPlan.query().where('isActive', true).orderBy('sortOrder', 'asc')

    return view.render('pages/subscriptions/index', {
      plans,
    })
  }

  /**
   * Show plan selection page (for new signups or upgrades)
   */
  async select({ view, auth, response }: HttpContext) {
    if (!auth.user) {
      return response.redirect().toRoute('auth.signup.show')
    }

    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)
    const currentSubscription = await business.getCurrentSubscription()
    const plans = await SubscriptionPlan.query()
      .where('isActive', true)
      .where('price', '>', 0)
      .orderBy('sortOrder', 'asc')
      .limit(3)

    // Check if trial is expired and calculate days remaining
    let trialExpired = false
    let trialDaysRemaining = 0

    if (currentSubscription?.status === 'trialing' && currentSubscription.trialEndsAt) {
      trialExpired = currentSubscription.trialEndsAt < DateTime.now()
      if (!trialExpired) {
        trialDaysRemaining = Math.ceil(currentSubscription.trialEndsAt.diffNow('days').days)
      }
    }

    return view.render('pages/subscriptions/select', {
      business,
      currentSubscription,
      plans,
      trialExpired,
      trialDaysRemaining,
    })
  }

  /**
   * Show current subscription management page
   */
  async manage({ view, auth, response }: HttpContext) {
    if (!auth.user) {
      return response.redirect().toRoute('auth.login.show')
    }

    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)
    const subscription = await business.getCurrentSubscription()
    const plans = await SubscriptionPlan.query().where('isActive', true).orderBy('sortOrder', 'asc')

    // Calculate trial days remaining if on trial
    let trialDaysRemaining = 0
    if (subscription?.status === 'trialing' && subscription.trialEndsAt) {
      if (subscription.trialEndsAt > DateTime.now()) {
        trialDaysRemaining = Math.ceil(subscription.trialEndsAt.diffNow('days').days)
      }
    }

    return view.render('pages/subscriptions/manage', {
      business,
      subscription,
      plans,
      trialDaysRemaining,
    })
  }

  /**
   * Subscribe to a plan
   */
  async subscribe({ request, response, auth, session }: HttpContext) {
    if (!auth.user) {
      return response.redirect().toRoute('auth.login.show')
    }

    const { planId } = request.only(['planId'])

    const plan = await SubscriptionPlan.findOrFail(planId)

    try {
      // All plans require payment - redirect to payment
      return response.redirect().toRoute('subscriptions.payment', { planId: plan.id })
    } catch (error: any) {
      session.flash('error', error.message || 'Failed to create subscription')
      return response.redirect().back()
    }
  }

  /**
   * Show payment page for subscription
   */
  async payment({ view, auth, params, response }: HttpContext) {
    if (!auth.user) {
      return response.redirect().toRoute('auth.login.show')
    }

    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)
    const plan = await SubscriptionPlan.findOrFail(params.planId)

    if (plan.name === 'free') {
      return response.redirect().toRoute('subscriptions.select')
    }

    const paystackPublicKey = env.get('PAYSTACK_PUBLIC_KEY')

    return view.render('pages/subscriptions/payment', {
      business,
      plan,
      paystackPublicKey,
    })
  }

  /**
   * Verify subscription payment and activate
   */
  async verify({ params, request, response, auth, session }: HttpContext) {
    if (!auth.user) {
      return response.redirect().toRoute('auth.login.show')
    }

    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)
    const plan = await SubscriptionPlan.findOrFail(params.planId)
    const reference = request.qs().reference

    if (!reference) {
      session.flash('error', 'Payment reference is required')
      return response.redirect().back()
    }

    try {
      // Verify payment with Paystack
      const secretKey = env.get('PAYSTACK_SECRET_KEY')
      if (secretKey) {
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
          message?: string
          data?: {
            status: string
            authorization?: {
              authorization_code: string
            }
          }
        }

        if (!data.status || data.data?.status !== 'success') {
          console.error('[SUBSCRIPTION] Payment verification failed:', data)
          session.flash(
            'error',
            'Payment verification failed. Please contact support if payment was deducted.'
          )
          return response.redirect().toRoute('subscriptions.select')
        }

        // Extract authorization code for recurring billing
        const authorizationCode = data.data?.authorization?.authorization_code

        // Create subscription
        const subscription = await subscriptionService.createSubscription(
          business,
          plan,
          business.email,
          authorizationCode
        )

        console.log('[SUBSCRIPTION] Created subscription:', {
          subscriptionId: subscription.id,
          planId: plan.id,
          businessId: business.id,
        })

        // Refresh business to get updated status
        await business.refresh()

        session.flash('success', `Successfully subscribed to ${plan.displayName} plan!`)

        // Redirect to onboarding if not yet onboarded, otherwise to manage
        if (!business.isOnboarded) {
          return response.redirect().toRoute('onboarding.show')
        }
        return response.redirect().toRoute('subscriptions.manage')
      } else {
        // Dev mode - create subscription without verification
        console.log('[SUBSCRIPTION] Dev mode: Creating subscription without payment verification')
        await subscriptionService.createSubscription(business, plan, business.email)

        // Refresh business to get updated status
        await business.refresh()

        session.flash('success', `Successfully subscribed to ${plan.displayName} plan!`)

        // Redirect to onboarding if not yet onboarded, otherwise to manage
        if (!business.isOnboarded) {
          return response.redirect().toRoute('onboarding.show')
        }
        return response.redirect().toRoute('subscriptions.manage')
      }
    } catch (error: any) {
      console.error('[SUBSCRIPTION] Error creating subscription:', error)
      session.flash(
        'error',
        error.message || 'Failed to activate subscription. Please contact support.'
      )
      return response.redirect().toRoute('subscriptions.select')
    }
  }

  /**
   * Cancel subscription
   */
  async cancel({ response, auth, session }: HttpContext) {
    if (!auth.user) {
      return response.redirect().toRoute('auth.login.show')
    }

    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)
    const subscription = await business.getCurrentSubscription()

    if (!subscription) {
      session.flash('error', 'No active subscription found')
      return response.redirect().back()
    }

    try {
      await subscriptionService.cancelSubscription(subscription, false)
      session.flash(
        'success',
        'Subscription will be cancelled at the end of the current billing period'
      )
    } catch (error: any) {
      session.flash('error', error.message || 'Failed to cancel subscription')
    }

    return response.redirect().back()
  }

  /**
   * Resume cancelled subscription
   */
  async resume({ response, auth, session }: HttpContext) {
    if (!auth.user) {
      return response.redirect().toRoute('auth.login.show')
    }

    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)
    const subscription = await business.getCurrentSubscription()

    if (!subscription) {
      session.flash('error', 'No subscription found')
      return response.redirect().back()
    }

    try {
      await subscriptionService.resumeSubscription(subscription)
      session.flash('success', 'Subscription resumed successfully')
    } catch (error: any) {
      session.flash('error', error.message || 'Failed to resume subscription')
    }

    return response.redirect().back()
  }

  /**
   * Upgrade or downgrade subscription
   */
  async change({ request, response, auth, session }: HttpContext) {
    if (!auth.user) {
      return response.redirect().toRoute('auth.login.show')
    }

    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)
    const { planId } = request.only(['planId'])

    const plan = await SubscriptionPlan.findOrFail(planId)

    try {
      // Cancel current subscription
      const currentSubscription = await business.getCurrentSubscription()
      if (currentSubscription && currentSubscription.status === 'active') {
        await subscriptionService.cancelSubscription(currentSubscription, true)
      }

      // Subscribe to new plan
      if (plan.name === 'free') {
        await subscriptionService.createSubscription(business, plan, business.email)
        session.flash('success', `Successfully changed to ${plan.displayName} plan`)
        return response.redirect().toRoute('subscriptions.manage')
      }

      // For paid plans, redirect to payment
      return response.redirect().toRoute('subscriptions.payment', { planId: plan.id })
    } catch (error: any) {
      session.flash('error', error.message || 'Failed to change subscription')
      return response.redirect().back()
    }
  }
}
