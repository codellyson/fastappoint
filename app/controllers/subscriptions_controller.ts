import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Business from '#models/business'
import SubscriptionPlan from '#models/subscription_plan'
import subscriptionService from '../services/subscription_service.js'
import currencyService from '../services/currency_service.js'
import flutterwaveService from '../services/flutterwave_service.js'
import env from '#start/env'

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
      console.log('[SUBSCRIPTION] Detected currency from Accept-Language header:', detected)
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
    // Fallback to business currency or default
    const currency = subscription?.currency || business.currency || 'NGN'

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
      // const currencyParam =
      //   currency || (await Business.findOrFail(auth.user!.businessId)).currency || 'NGN'
      return response
        .redirect()
        .toRoute('subscriptions.payment', { planId: plan.id }, { qs: { currency: currency } })
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

    // Paystack supports NGN, ZAR, KES, GHS, UGX, XOF
    const paystackSupportedCurrencies = ['NGN', 'ZAR', 'KES', 'GHS', 'UGX', 'XOF']
    const isPaystackCurrency = paystackSupportedCurrencies.includes(currency.toUpperCase())

    // Automatically determine the correct payment provider based on buyer's currency
    let paymentProvider: 'paystack' | 'flutterwave'

    if (isPaystackCurrency) {
      // Use Paystack for African currencies
      paymentProvider = 'paystack'
    } else {
      // Use Flutterwave for international currencies
      if (!flutterwaveService.isConfigured()) {
        session.flash(
          'error',
          `${currency} payments require Flutterwave, which is not configured on this platform. Please contact support.`
        )
        return response.redirect().toRoute('subscriptions.select')
      }
      paymentProvider = 'flutterwave'
    }

    return view.render('pages/subscriptions/payment', {
      business,
      plan,
      paymentProvider,
      paystackPublicKey,
      currency,
    })
  }

  /**
   * Initialize one-time payment for subscription
   * Returns payment data for Paystack (inline) or Flutterwave (redirect)
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
    console.log('[SUBSCRIPTION] Detected currency:', currency)

    // Determine payment provider based on buyer's currency
    const paystackSupportedCurrencies = ['NGN', 'ZAR', 'KES', 'GHS', 'UGX', 'XOF']
    const isPaystackCurrency = paystackSupportedCurrencies.includes(currency.toUpperCase())
    console.log('[SUBSCRIPTION] Is Paystack currency:', isPaystackCurrency)
    const paymentProvider = isPaystackCurrency ? 'paystack' : 'flutterwave'
    console.log('[SUBSCRIPTION] Payment provider:', paymentProvider)

    // Check if selected provider is configured
    const paystackPublicKey = env.get('PAYSTACK_PUBLIC_KEY')
    if (paymentProvider === 'paystack' && !paystackPublicKey) {
      console.log('[SUBSCRIPTION] Paystack public key is not configured')
      return response.status(400).json({ error: 'Paystack is not configured' })
    }
    if (paymentProvider === 'flutterwave' && !flutterwaveService.isConfigured()) {
      console.log('[SUBSCRIPTION] Flutterwave is not configured')
      return response.status(400).json({ error: 'Flutterwave is not configured' })
    }

    try {
      const appUrl = env.get('APP_URL')
      const callbackUrl = `${appUrl}/subscriptions/${plan.id}/verify`

      // Get plan price for buyer's currency (returns in smallest unit: cents/kobo)
      const amountInCents = plan.getPriceForCurrency(currency)
      console.log('[SUBSCRIPTION] Plan price for', currency, ':', amountInCents)

      if (paymentProvider === 'paystack') {
        // Return data for Paystack inline payment (frontend handles)
        return response.json({
          paymentProvider: 'paystack',
          publicKey: paystackPublicKey,
          email: user.email,
          amount: amountInCents, // Paystack expects amount in cents
          currency: currency,
          reference: `sub-${plan.id}-${business.id}-${Date.now()}`,
          callbackUrl: callbackUrl,
          metadata: {
            businessId: business.id.toString(),
            planId: plan.id.toString(),
            planName: plan.displayName,
          },
        })
      } else {
        // Initialize Flutterwave payment (redirect)
        const result = await flutterwaveService.initializePayment(
          amountInCents / 100, // Flutterwave expects decimal amount
          currency,
          user.email,
          user.fullName || user.email,
          `${callbackUrl}?provider=flutterwave`,
          {
            businessId: business.id.toString(),
            planId: plan.id.toString(),
            planName: plan.displayName,
          }
        )

        if (!result.success || !result.paymentLink) {
          return response.status(400).json({ error: 'Failed to initialize Flutterwave payment' })
        }

        return response.json({
          paymentProvider: 'flutterwave',
          paymentLink: result.paymentLink,
          reference: result.reference,
          currency: currency,
          amount: amountInCents,
        })
      }
    } catch (error: any) {
      console.error('[SUBSCRIPTION] Error creating payment:', error)
      return response.status(500).json({ error: error.message || 'Failed to create payment' })
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
    const provider = request.qs().provider // 'paystack' or 'flutterwave'

    // Detect buyer's currency - subscription payments are location-based
    const currency = this.detectBuyerCurrency(request)

    // Determine payment provider
    const paystackSupportedCurrencies = ['NGN', 'ZAR', 'KES', 'GHS', 'UGX', 'XOF']
    const isPaystackCurrency = paystackSupportedCurrencies.includes(currency.toUpperCase())
    const paymentProvider = provider || (isPaystackCurrency ? 'paystack' : 'flutterwave')

    try {
      // Handle Flutterwave payment
      if (paymentProvider === 'flutterwave') {
        if (!reference) {
          session.flash('error', 'Payment reference is required')
          return response.redirect().back()
        }

        // Extract transaction ID from reference (format: booking-{id}-{timestamp})
        const transactionId = reference.split('-')[1]

        const verification = await flutterwaveService.verifyTransaction(transactionId)

        if (!verification.success || verification.status !== 'successful') {
          console.error('[SUBSCRIPTION] Flutterwave payment verification failed:', verification)
          session.flash(
            'error',
            'Payment verification failed. Please contact support if payment was deducted.'
          )
          return response.redirect().toRoute('subscriptions.select')
        }

        // Create subscription with one-time payment
        const subscription = await subscriptionService.createSubscription(
          business,
          plan,
          business.email,
          undefined, // No authorization code for one-time payments
          reference, // Store payment reference
          currency
        )

        console.log('[SUBSCRIPTION] Created Flutterwave subscription:', {
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
          console.error('[SUBSCRIPTION] Paystack payment verification failed:', data)
          session.flash(
            'error',
            'Payment verification failed. Please contact support if payment was deducted.'
          )
          return response.redirect().toRoute('subscriptions.select')
        }

        // Create subscription with one-time payment (no authorization code needed)
        const subscription = await subscriptionService.createSubscription(
          business,
          plan,
          business.email,
          undefined, // No authorization code for one-time payments
          reference, // Store payment reference
          currency
        )

        console.log('[SUBSCRIPTION] Created Paystack subscription:', {
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
      } else {
        // Dev mode - create subscription without verification
        console.log('[SUBSCRIPTION] Dev mode: Creating subscription without payment verification')
        await subscriptionService.createSubscription(business, plan, business.email)

        await business.refresh()
        session.flash('success', `Successfully subscribed to ${plan.displayName} plan!`)

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
