import type { HttpContext } from '@adonisjs/core/http'
import Business from '#models/business'
import stripeService from '#services/stripe_service'
import env from '#start/env'

export default class StripeController {
  async createAccount({ auth, response, session }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    if (!stripeService.isConfigured()) {
      session.flash('error', 'Stripe is not configured. Please contact support.')
      return response.redirect().back()
    }

    try {
      if (business.stripeAccountId) {
        const account = await stripeService.getAccount(business.stripeAccountId)
        business.stripeAccountStatus = account.details_submitted ? 'complete' : 'incomplete'
        business.stripeChargesEnabled = account.charges_enabled
        business.stripePayoutsEnabled = account.payouts_enabled
        await business.save()

        if (account.details_submitted && account.charges_enabled) {
          session.flash('success', 'Your Stripe account is already set up and ready to accept payments.')
          return response.redirect().toRoute('settings.payments')
        }
      }

      if (!business.stripeAccountId) {
        const account = await stripeService.createAccount(business, business.email)
        business.stripeAccountId = account.id
        business.paymentProvider = 'stripe'
        business.stripeAccountStatus = 'pending'
        await business.save()
      }

      const appUrl = env.get('APP_URL', `https://${env.get('APP_DOMAIN', 'fastappoint.com')}`)
      const returnUrl = `${appUrl}/settings/payments/stripe/return`
      const refreshUrl = `${appUrl}/settings/payments/stripe/refresh`

      const accountLink = await stripeService.createAccountLink(
        business.stripeAccountId!,
        returnUrl,
        refreshUrl
      )

      business.stripeOnboardingUrl = accountLink.url
      await business.save()

      return response.redirect(accountLink.url)
    } catch (error: unknown) {
      console.error('[STRIPE] Error creating account:', error)
      session.flash(
        'error',
        error instanceof Error ? error.message : 'Failed to create Stripe account. Please try again.'
      )
      return response.redirect().back()
    }
  }

  async return({ auth, response, session }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    if (!business.stripeAccountId) {
      session.flash('error', 'Stripe account not found')
      return response.redirect().toRoute('settings.payments')
    }

    try {
      const account = await stripeService.getAccount(business.stripeAccountId)
      business.stripeAccountStatus = account.details_submitted ? 'complete' : 'incomplete'
      business.stripeChargesEnabled = account.charges_enabled
      business.stripePayoutsEnabled = account.payouts_enabled
      await business.save()

      if (account.details_submitted && account.charges_enabled) {
        session.flash('success', 'Stripe account setup completed successfully! You can now accept payments.')
      } else {
        session.flash(
          'warning',
          'Stripe account setup is incomplete. Please complete all required information to start accepting payments.'
        )
      }

      return response.redirect().toRoute('settings.payments')
    } catch (error: unknown) {
      console.error('[STRIPE] Error retrieving account:', error)
      session.flash('error', 'Failed to verify Stripe account status. Please try again.')
      return response.redirect().toRoute('settings.payments')
    }
  }

  async refresh({ auth, response, session }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    if (!business.stripeAccountId) {
      session.flash('error', 'Stripe account not found')
      return response.redirect().toRoute('settings.payments')
    }

    try {
      const appUrl = env.get('APP_URL', `https://${env.get('APP_DOMAIN', 'fastappoint.com')}`)
      const returnUrl = `${appUrl}/settings/payments/stripe/return`
      const refreshUrl = `${appUrl}/settings/payments/stripe/refresh`

      const accountLink = await stripeService.createAccountLink(
        business.stripeAccountId,
        returnUrl,
        refreshUrl
      )

      business.stripeOnboardingUrl = accountLink.url
      await business.save()

      return response.redirect(accountLink.url)
    } catch (error: unknown) {
      console.error('[STRIPE] Error refreshing account link:', error)
      session.flash('error', 'Failed to refresh Stripe onboarding. Please try again.')
      return response.redirect().toRoute('settings.payments')
    }
  }

  async dashboard({ auth, response, session }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    if (!business.stripeAccountId) {
      session.flash('error', 'Stripe account not found')
      return response.redirect().toRoute('settings.payments')
    }

    try {
      const loginLink = await stripeService.createLoginLink(business.stripeAccountId)
      return response.redirect(loginLink.url)
    } catch (error: unknown) {
      console.error('[STRIPE] Error creating login link:', error)
      session.flash('error', 'Failed to access Stripe dashboard. Please try again.')
      return response.redirect().toRoute('settings.payments')
    }
  }
}

