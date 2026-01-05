import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import Business from '#models/business'
import subscriptionService from '../services/subscription_service.js'
import { DateTime } from 'luxon'

export default class SubscriptionMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options?: { feature?: string }) {
    const user = ctx.auth.user

    if (!user) {
      return ctx.response.unauthorized('Authentication required')
    }

    const business = await Business.findOrFail(user.businessId)

    // Check specific feature if provided
    if (options?.feature) {
      switch (options.feature) {
        case 'add_staff':
          const staffCheck = await subscriptionService.canAddStaff(business.id)
          if (!staffCheck.allowed) {
            ctx.session.flash('error', staffCheck.reason || 'Cannot add more staff')
            return ctx.response.redirect().toRoute('subscriptions.select')
          }
          break

        case 'create_booking':
          const bookingCheck = await subscriptionService.canCreateBooking(business.id)
          if (!bookingCheck.allowed) {
            ctx.session.flash('error', bookingCheck.reason || 'Monthly booking limit reached')
            return ctx.response.redirect().toRoute('subscriptions.select')
          }
          break
      }
    }

    // Check if subscription is active or trial is valid
    const subscription = await business.getCurrentSubscription()

    if (!subscription) {
      ctx.session.flash('error', 'No active subscription. Please choose a plan to continue.')
      return ctx.response.redirect().toRoute('subscriptions.select')
    }

    // Check if trial is expired
    if (subscription.status === 'trialing') {
      if (subscription.trialEndsAt && subscription.trialEndsAt < DateTime.now()) {
        ctx.session.flash('error', 'Your 5-day free trial has expired. Please choose a plan to continue.')
        return ctx.response.redirect().toRoute('subscriptions.select')
      }
    }

    // Check if subscription is cancelled or past_due
    if (subscription.status === 'cancelled' || subscription.status === 'past_due') {
      ctx.session.flash('error', 'Your subscription is not active. Please renew to continue.')
      return ctx.response.redirect().toRoute('subscriptions.manage')
    }

    // Check if subscription is expired
    if (subscription.status === 'active' && subscription.currentPeriodEnd && subscription.currentPeriodEnd < DateTime.now()) {
      ctx.session.flash('error', 'Your subscription has expired. Please renew to continue.')
      return ctx.response.redirect().toRoute('subscriptions.manage')
    }

    return next()
  }
}

