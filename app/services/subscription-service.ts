import env from '#start/env'
import Business from '#models/business'
import Subscription from '#models/subscription'
import SubscriptionPlan from '#models/subscription_plan'
import SubscriptionPayment from '#models/subscription_payment'
import { DateTime } from 'luxon'

class SubscriptionService {
  private secretKey: string | null

  constructor() {
    this.secretKey = env.get('PAYSTACK_SECRET_KEY') || null
  }

  /**
   * Create a 7-day free trial subscription
   */
  async createTrial(business: Business): Promise<Subscription> {
    // Cancel any existing active subscription
    await this.cancelActiveSubscription(business.id)

    const trialEndsAt = DateTime.now().plus({ days: 7 })

    const subscription = await Subscription.create({
      businessId: business.id,
      planId: null, // No plan during trial
      status: 'trialing',
      currentPeriodStart: DateTime.now(),
      currentPeriodEnd: trialEndsAt,
      trialEndsAt: trialEndsAt,
      cancelAtPeriodEnd: false,
    })

    // Update business subscription fields
    business.subscriptionTier = 'starter' // Default tier during trial
    business.subscriptionStatus = 'active'
    business.subscriptionEndsAt = trialEndsAt
    await business.save()

    return subscription
  }

  /**
   * Create a subscription for a business
   */
  async createSubscription(
    business: Business,
    plan: SubscriptionPlan,
    email: string,
    authorizationCode?: string
  ): Promise<Subscription> {
    // Cancel any existing active subscription
    await this.cancelActiveSubscription(business.id)

    // For now, create subscription directly without Paystack subscription API
    // This allows immediate activation after payment
    // Recurring billing can be set up later via webhooks
    
    const now = DateTime.now()
    const periodEnd = now.plus({
      months: plan.interval === 'yearly' ? 12 : 1,
    })

    // Create subscription record
    const subscription = await Subscription.create({
      businessId: business.id,
      planId: plan.id,
      status: 'active',
      paystackSubscriptionCode: null, // Will be set up later if needed for recurring
      paystackCustomerCode: business.paystackSubaccountCode || null,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    })

    // Update business subscription fields
    business.subscriptionTier = plan.name as any
    business.subscriptionStatus = 'active'
    business.subscriptionEndsAt = subscription.currentPeriodEnd
    await business.save()

    // If authorization code provided, save it for future recurring billing setup
    if (authorizationCode && this.secretKey) {
      // Create Paystack customer if needed
      let customerCode = business.paystackSubaccountCode
      if (!customerCode) {
        customerCode = await this.createPaystackCustomer(email, business.name)
        business.paystackSubaccountCode = customerCode
        await business.save()
      }
      
      // Store authorization for future recurring billing setup
      // For now, we'll handle renewals manually or via webhooks
    }

    return subscription
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscription: Subscription, cancelImmediately = false): Promise<void> {
    if (subscription.paystackSubscriptionCode && this.secretKey) {
      try {
        await fetch(`https://api.paystack.co/subscription/${subscription.paystackSubscriptionCode}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        })
      } catch (error) {
        console.error('Error cancelling Paystack subscription:', error)
      }
    }

    if (cancelImmediately) {
      subscription.status = 'cancelled'
      subscription.cancelledAt = DateTime.now()
      subscription.currentPeriodEnd = DateTime.now()
    } else {
      subscription.cancelAtPeriodEnd = true
    }

    await subscription.save()

    // Update business
    const business = await Business.findOrFail(subscription.businessId)
    if (cancelImmediately) {
      business.subscriptionStatus = 'cancelled'
      business.subscriptionEndsAt = DateTime.now()
    }

    await business.save()
  }

  /**
   * Resume a cancelled subscription
   */
  async resumeSubscription(subscription: Subscription): Promise<void> {
    if (subscription.paystackSubscriptionCode && this.secretKey) {
      try {
        await fetch(`https://api.paystack.co/subscription/${subscription.paystackSubscriptionCode}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        })
      } catch (error) {
        console.error('Error resuming Paystack subscription:', error)
      }
    }

    subscription.cancelAtPeriodEnd = false
    subscription.cancelledAt = null
    await subscription.save()

    const business = await Business.findOrFail(subscription.businessId)
    business.subscriptionStatus = 'active'
    await business.save()
  }

  /**
   * Check if trial is expired
   */
  async isTrialExpired(businessId: number): Promise<boolean> {
    const business = await Business.findOrFail(businessId)
    const subscription = await business.getCurrentSubscription()

    if (!subscription || subscription.status !== 'trialing') {
      return false
    }

    if (!subscription.trialEndsAt) {
      return false
    }

    return subscription.trialEndsAt < DateTime.now()
  }

  /**
   * Check if business can add more staff
   */
  async canAddStaff(businessId: number): Promise<{ allowed: boolean; reason?: string }> {
    const business = await Business.findOrFail(businessId)
    
    // Check if trial is expired
    const trialExpired = await this.isTrialExpired(businessId)
    if (trialExpired) {
      return {
        allowed: false,
        reason: 'Your 7-day free trial has expired. Please choose a plan to continue.',
      }
    }

    const subscription = await business.getCurrentSubscription()
    
    // During trial, allow unlimited (or use starter plan limits)
    if (subscription?.status === 'trialing') {
      const starterPlan = await SubscriptionPlan.findBy('name', 'starter')
      if (starterPlan && starterPlan.maxStaff) {
        const staffCount = await business.related('users').query().where('isActive', true).count('* as total')
        const currentStaff = Number(staffCount[0].$extras.total)
        if (currentStaff >= starterPlan.maxStaff) {
          return {
            allowed: false,
            reason: `Trial allows up to ${starterPlan.maxStaff} staff. Choose a plan to add more.`,
          }
        }
      }
      return { allowed: true }
    }

    const plan = subscription?.plan
    if (!plan) {
      return { allowed: false, reason: 'No subscription plan found. Please choose a plan.' }
    }

    if (plan.isUnlimitedStaff) {
      return { allowed: true }
    }

    const staffCount = await business.related('users').query().where('isActive', true).count('* as total')
    const currentStaff = Number(staffCount[0].$extras.total)

    if (currentStaff >= plan.maxStaff!) {
      return {
        allowed: false,
        reason: `Your ${plan.displayName} plan allows up to ${plan.maxStaff} staff. Upgrade to add more.`,
      }
    }

    return { allowed: true }
  }

  /**
   * Check if business can create more bookings this month
   */
  async canCreateBooking(businessId: number): Promise<{ allowed: boolean; reason?: string }> {
    const business = await Business.findOrFail(businessId)
    
    // Check if trial is expired
    const trialExpired = await this.isTrialExpired(businessId)
    if (trialExpired) {
      return {
        allowed: false,
        reason: 'Your 7-day free trial has expired. Please choose a plan to continue.',
      }
    }

    const subscription = await business.getCurrentSubscription()
    
    // During trial, allow unlimited bookings
    if (subscription?.status === 'trialing') {
      return { allowed: true }
    }

    const plan = subscription?.plan
    if (!plan) {
      return { allowed: false, reason: 'No subscription plan found. Please choose a plan.' }
    }

    if (plan.isUnlimitedBookings) {
      return { allowed: true }
    }

    const startOfMonth = DateTime.now().startOf('month')
    const endOfMonth = DateTime.now().endOf('month')

    const bookingsCount = await business
      .related('bookings')
      .query()
      .whereBetween('created_at', [startOfMonth.toSQL()!, endOfMonth.toSQL()!])
      .count('* as total')

    const currentBookings = Number(bookingsCount[0].$extras.total)

    if (currentBookings >= plan.maxBookingsPerMonth!) {
      return {
        allowed: false,
        reason: `Your ${plan.displayName} plan allows ${plan.maxBookingsPerMonth} bookings per month. Upgrade for unlimited.`,
      }
    }

    return { allowed: true }
  }

  /**
   * Handle Paystack subscription webhook
   */
  async handleWebhook(event: string, data: any): Promise<void> {
    switch (event) {
      case 'subscription.create':
      case 'subscription.enable':
        await this.handleSubscriptionActive(data)
        break
      case 'subscription.disable':
        await this.handleSubscriptionDisabled(data)
        break
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(data)
        break
      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(data)
        break
    }
  }

  private async handleSubscriptionActive(data: any): Promise<void> {
    const subscription = await Subscription.findBy('paystackSubscriptionCode', data.subscription_code)
    if (subscription) {
      subscription.status = 'active'
      await subscription.save()
    }
  }

  private async handleSubscriptionDisabled(data: any): Promise<void> {
    const subscription = await Subscription.findBy('paystackSubscriptionCode', data.subscription_code)
    if (subscription) {
      subscription.status = 'cancelled'
      subscription.cancelledAt = DateTime.now()
      await subscription.save()

      const business = await Business.findOrFail(subscription.businessId)
      business.subscriptionStatus = 'cancelled'
      await business.save()
    }
  }

  private async handlePaymentFailed(data: any): Promise<void> {
    const subscription = await Subscription.findBy('paystackSubscriptionCode', data.subscription.subscription_code)
    if (subscription) {
      subscription.status = 'past_due'
      await subscription.save()

      const business = await Business.findOrFail(subscription.businessId)
      business.subscriptionStatus = 'past_due'
      await business.save()
    }
  }

  private async handlePaymentSucceeded(data: any): Promise<void> {
    const subscription = await Subscription.findBy('paystackSubscriptionCode', data.subscription.subscription_code)
    if (subscription) {
      // Record payment
      await SubscriptionPayment.create({
        subscriptionId: subscription.id,
        amount: data.amount,
        status: 'success',
        paystackReference: data.reference,
        paystackTransactionReference: data.transaction?.reference,
        paidAt: DateTime.fromISO(data.paid_at),
      })

      // Update subscription period
      subscription.status = 'active'
      subscription.currentPeriodStart = DateTime.fromISO(data.subscription.next_payment_date)
      subscription.currentPeriodEnd = DateTime.fromISO(data.subscription.next_payment_date).plus({ months: 1 })
      await subscription.save()

      const business = await Business.findOrFail(subscription.businessId)
      business.subscriptionStatus = 'active'
      business.subscriptionEndsAt = subscription.currentPeriodEnd
      await business.save()
    }
  }

  private async cancelActiveSubscription(businessId: number): Promise<void> {
    const activeSubscription = await Subscription.query()
      .where('businessId', businessId)
      .where('status', 'active')
      .first()

    if (activeSubscription) {
      await this.cancelSubscription(activeSubscription, true)
    }
  }

  private async createPaystackCustomer(email: string, name: string): Promise<string> {
    const response = await fetch('https://api.paystack.co/customer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, name }),
    })

    const data = await response.json() as {
      status: boolean
      message?: string
      data?: { customer_code: string }
    }
    if (!data.status) {
      throw new Error(data.message || 'Failed to create Paystack customer')
    }

    return data.data!.customer_code
  }

  // @ts-ignore - unused but may be needed for future recurring billing
  private async createPaystackSubscription(
    customerCode: string,
    planCode: string,
    authorizationCode?: string
  ): Promise<any> {
    const body: any = {
      customer: customerCode,
      plan: planCode,
    }

    if (authorizationCode) {
      body.authorization = authorizationCode
    }

    const response = await fetch('https://api.paystack.co/subscription', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json() as {
      status: boolean
      message?: string
      data: any
    }
    if (!data.status) {
      throw new Error(data.message || 'Failed to create Paystack subscription')
    }

    return data.data
  }
}

export default new SubscriptionService()

