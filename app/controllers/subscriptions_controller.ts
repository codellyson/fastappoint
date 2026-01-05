import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Business from '#models/business'
import SubscriptionPlan from '#models/subscription_plan'
import Subscription from '#models/subscription'
import subscriptionService from '../services/subscription_service.js'
import stripeService from '../services/stripe_service.js'
import currencyService from '../services/currency_service.js'
import env from '#start/env'
import Stripe from 'stripe'

export default class SubscriptionsController {
  /**
   * Detect buyer's currency based on location
   * Uses browser language, Accept-Language header, Cloudflare country header, or defaults to NGN
   */
  private detectBuyerCurrency(request: HttpContext['request']): string {
    // Allow override via query parameter for testing (e.g., ?currency=USD)
    const currencyOverride = request.qs().currency
    if (currencyOverride) {
      return currencyOverride.toUpperCase()
    }

    // Try to detect from Cloudflare country header (if using Cloudflare)
    const countryCode = request.header('cf-ipcountry')
    if (countryCode) {
      const currency = currencyService.detectCurrencyFromCountry(countryCode)
      if (currency) {
        return currency
      }
    }

    // Try to detect from Accept-Language header
    const acceptLanguage = request.header('accept-language') || ''
    if (acceptLanguage) {
      const detected = currencyService.detectCurrencyFromLocale(acceptLanguage)
      if (detected) {
        return detected
      }
    }

    // Default to NGN for African markets
    return 'NGN'
  }

  /**
   * Show pricing page with all available plans
   */
  async index({ view, request }: HttpContext) {
    const plans = await SubscriptionPlan.query().where('isActive', true).orderBy('sortOrder', 'asc')
    
    // Subscription prices are location-based (buyer's location determines currency)
    const currency = this.detectBuyerCurrency(request)

    return view.render('pages/subscriptions/index', {
      plans,
      currency,
    })
  }

  /**
   * Show plan selection page (for new signups or upgrades)
   */
  async select({ view, auth, response, request }: HttpContext) {
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

    // Detect buyer's currency based on location (browser language, IP, etc.)
    // This is for subscription payments - buyer's location determines currency
    let currency = this.detectBuyerCurrency(request)

    return view.render('pages/subscriptions/select', {
      business,
      currentSubscription,
      plans,
      trialExpired,
      trialDaysRemaining,
      currency,
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

    // Use subscription currency if available (location-based payment)
    // For Stripe subscriptions without currency, try to detect from Stripe price
    let currency = subscription?.currency
    if (!currency && subscription?.stripeSubscriptionId && stripeService.isConfigured()) {
      try {
        const stripeSub = await stripeService.retrieveSubscription(subscription.stripeSubscriptionId)
        if (stripeSub.items?.data?.[0]?.price?.currency) {
          currency = stripeSub.items.data[0].price.currency.toUpperCase()
        }
      } catch (error) {
        console.warn('[SUBSCRIPTION] Could not retrieve currency from Stripe:', error)
      }
    }
    // Fallback to business currency or default
    currency = currency || business.currency || 'NGN'

    return view.render('pages/subscriptions/manage', {
      business,
      subscription,
      plans,
      trialDaysRemaining,
      currency,
    })
  }

  /**
   * Subscribe to a plan
   */
  async subscribe({ request, response, auth, session }: HttpContext) {
    if (!auth.user) {
      return response.redirect().toRoute('auth.login.show')
    }

    const { planId, currency } = request.only(['planId', 'currency'])

    const plan = await SubscriptionPlan.findOrFail(planId)

    try {
      // All plans require payment - redirect to payment with currency
      const currencyParam = currency || (await Business.findOrFail(auth.user!.businessId)).currency || 'NGN'
      return response.redirect().toRoute('subscriptions.payment', { planId: plan.id }, { qs: { currency: currencyParam } })
    } catch (error: any) {
      session.flash('error', error.message || 'Failed to create subscription')
      return response.redirect().back()
    }
  }

  /**
   * Show payment page for subscription
   */
  async payment({ view, auth, params, response, request, session }: HttpContext) {
    if (!auth.user) {
      return response.redirect().toRoute('auth.login.show')
    }

    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)
    const plan = await SubscriptionPlan.findOrFail(params.planId)

    if (plan.name === 'free') {
      return response.redirect().toRoute('subscriptions.select')
    }

    // Detect buyer's currency based on location - subscription payments are location-based
    const currency = this.detectBuyerCurrency(request)

    const paystackPublicKey = env.get('PAYSTACK_PUBLIC_KEY')
    const stripePublicKey = env.get('STRIPE_PUBLIC_KEY')

    // Paystack only supports NGN and a few African currencies
    const paystackSupportedCurrencies = ['NGN', 'ZAR', 'KES', 'GHS', 'UGX']
    const isPaystackCurrency = paystackSupportedCurrencies.includes(currency.toUpperCase())
    
    // Automatically determine the correct payment provider based on buyer's currency
    let paymentProvider: 'paystack' | 'stripe'
    
    if (isPaystackCurrency) {
      // Use Paystack for supported currencies
      paymentProvider = 'paystack'
    } else {
      // Non-Paystack currencies require Stripe
      // Check if platform has Stripe configured (not business-specific)
      if (!stripeService.isConfigured() || !stripePublicKey) {
        session.flash(
          'error',
          `${currency} payments require Stripe, which is not configured on this platform. Please contact support or use a Paystack-supported currency.`
        )
        return response.redirect().toRoute('subscriptions.select')
      }
      paymentProvider = 'stripe'
    }

    // Sync plan to Stripe if using Stripe (use the determined currency)
    if (paymentProvider === 'stripe' && stripeService.isConfigured()) {
      await subscriptionService.syncPlanToStripe(plan, currency)
      await plan.refresh()
    }

    return view.render('pages/subscriptions/payment', {
      business,
      plan,
      paymentProvider,
      paystackPublicKey,
      stripePublicKey,
      currency,
    })
  }

  /**
   * Create Stripe payment intent for subscription
   * Creates a subscription and returns the payment intent for the first invoice
   */
  async createPaymentIntent({ params, request, response, auth }: HttpContext) {
    if (!auth.user) {
      return response.status(401).json({ error: 'Unauthorized' })
    }

    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)
    const plan = await SubscriptionPlan.findOrFail(params.planId)

    // Detect buyer's currency from location
    const currency = this.detectBuyerCurrency(request)

    if (!stripeService.isConfigured()) {
      return response.status(400).json({ error: 'Stripe is not configured' })
    }

    try {
      // Ensure plan has Stripe price ID for the correct currency
      await subscriptionService.syncPlanToStripe(plan, currency)
      await plan.refresh()

      if (!plan.stripePriceId) {
        return response.status(400).json({ error: 'Failed to create Stripe price for plan' })
      }

      // Get or create Stripe customer
      // Check if business has an existing subscription with a customer ID
      const existingSubscription = await Subscription.query()
        .where('businessId', business.id)
        .whereNotNull('stripeCustomerId')
        .first()
      
      let customerId = existingSubscription?.stripeCustomerId || business.stripeAccountId
      
      if (!customerId) {
        const customer = await stripeService.createCustomer(business.email, business.name, {
          business_id: business.id.toString(),
        })
        customerId = customer.id
        // Note: customerId will be stored in the subscription record, not business
      }

      // Create subscription with payment intent
      // This creates an incomplete subscription with a payment intent for the first invoice
      const subscription = await stripeService.createSubscription(
        customerId,
        plan.stripePriceId,
        {
          business_id: business.id.toString(),
          plan_id: plan.id.toString(),
        }
      )

      // Extract payment intent from subscription's latest invoice
      const stripeSub = subscription as any
      const invoice = stripeSub.latest_invoice
      
      // Handle both expanded and non-expanded invoice
      let paymentIntent: Stripe.PaymentIntent | null = null
      
      if (typeof invoice === 'object' && invoice.payment_intent) {
        if (typeof invoice.payment_intent === 'object') {
          paymentIntent = invoice.payment_intent as Stripe.PaymentIntent
        } else {
          // Payment intent is just an ID, retrieve it
          paymentIntent = await stripeService.retrievePaymentIntent(invoice.payment_intent)
        }
      }

      if (!paymentIntent || !paymentIntent.client_secret) {
        return response.status(400).json({ error: 'Failed to create payment intent' })
      }

      return response.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      })
    } catch (error: any) {
      console.error('[SUBSCRIPTION] Error creating payment intent:', error)
      return response.status(500).json({ error: error.message || 'Failed to create payment intent' })
    }
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
    const paymentIntentId = request.qs().payment_intent
    
    // Detect buyer's currency - subscription payments are location-based
    const currency = this.detectBuyerCurrency(request)

    // Determine payment provider based on buyer's currency, not business settings
    const paystackSupportedCurrencies = ['NGN', 'ZAR', 'KES', 'GHS', 'UGX']
    const isPaystackCurrency = paystackSupportedCurrencies.includes(currency.toUpperCase())
    const paymentProvider = isPaystackCurrency ? 'paystack' : 'stripe'

    try {
      // Handle Stripe payment
      if (paymentProvider === 'stripe' && paymentIntentId && stripeService.isConfigured()) {
        const paymentIntent = await stripeService.retrievePaymentIntent(paymentIntentId)

        if (paymentIntent.status !== 'succeeded') {
          session.flash('error', 'Payment was not successful. Please try again.')
          return response.redirect().toRoute('subscriptions.select')
        }

        const subscription = await subscriptionService.createSubscription(
          business,
          plan,
          business.email,
          undefined,
          paymentIntentId,
          currency // Already detected from buyer's location at top of method
        )

        console.log('[SUBSCRIPTION] Created Stripe subscription:', {
          subscriptionId: subscription.id,
          planId: plan.id,
          businessId: business.id,
        })

        await business.refresh()
        session.flash('success', `Successfully subscribed to ${plan.displayName} plan!`)

        if (!business.isOnboarded) {
          return response.redirect().toRoute('onboarding.show')
        }
        return response.redirect().toRoute('subscriptions.manage')
      }

      // Handle Paystack payment
      if (!reference) {
        session.flash('error', 'Payment reference is required')
        return response.redirect().back()
      }

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

        // Create subscription with buyer's currency (location-based)
        const subscription = await subscriptionService.createSubscription(
          business,
          plan,
          business.email,
          authorizationCode,
          undefined,
          currency // Already detected from buyer's location
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
