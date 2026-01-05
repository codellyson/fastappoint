import Stripe from 'stripe'
import env from '#start/env'
import Business from '#models/business'

class StripeService {
  private stripe: Stripe | null = null
  private secretKey: string | null = null

  constructor() {
    this.secretKey = env.get('STRIPE_SECRET_KEY') || null
    if (this.secretKey) {
      this.stripe = new Stripe(this.secretKey, {
        apiVersion: '2025-12-15.clover',
      })
    }
  }

  isConfigured(): boolean {
    return this.stripe !== null && this.secretKey !== null
  }

  async createAccount(business: Business, email: string): Promise<Stripe.Account> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured')
    }

    const account = await this.stripe.accounts.create({
      type: 'express',
      country: 'NG',
      email,
      business_type: 'individual',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        name: business.name,
        support_email: business.email,
        support_phone: business.phone || undefined,
      },
    })

    return account
  }

  async createAccountLink(
    accountId: string,
    returnUrl: string,
    refreshUrl: string
  ): Promise<Stripe.AccountLink> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured')
    }

    const accountLink = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    })

    return accountLink
  }

  async getAccount(accountId: string): Promise<Stripe.Account> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured')
    }

    return await this.stripe.accounts.retrieve(accountId)
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    metadata: Record<string, string>
  ): Promise<Stripe.PaymentIntent> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured')
    }

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    })

    return paymentIntent
  }

  async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured')
    }

    return await this.stripe.paymentIntents.retrieve(paymentIntentId)
  }

  async createTransfer(
    amount: number,
    currency: string,
    destination: string,
    metadata: Record<string, string>
  ): Promise<Stripe.Transfer> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured')
    }

    const transfer = await this.stripe.transfers.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      destination,
      metadata,
    })

    return transfer
  }

  async createLoginLink(accountId: string): Promise<Stripe.LoginLink> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured')
    }

    return await this.stripe.accounts.createLoginLink(accountId)
  }

  async createCustomer(email: string, name: string, metadata?: Record<string, string>): Promise<Stripe.Customer> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured')
    }

    return await this.stripe.customers.create({
      email,
      name,
      metadata,
    })
  }

  async createProduct(name: string, description?: string): Promise<Stripe.Product> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured')
    }

    return await this.stripe.products.create({
      name,
      description,
    })
  }

  async createPrice(
    productId: string,
    amount: number,
    currency: string,
    interval: 'month' | 'year'
  ): Promise<Stripe.Price> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured')
    }

    return await this.stripe.prices.create({
      product: productId,
      unit_amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      recurring: {
        interval,
      },
    })
  }

  async createSubscription(
    customerId: string,
    priceId: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.Subscription> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured')
    }

    return await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      metadata,
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    })
  }

  async retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured')
    }

    return await this.stripe.subscriptions.retrieve(subscriptionId)
  }

  async retrievePrice(priceId: string): Promise<Stripe.Price> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured')
    }
    return await this.stripe.prices.retrieve(priceId)
  }

  async cancelSubscription(
    subscriptionId: string,
    cancelImmediately = false
  ): Promise<Stripe.Subscription> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured')
    }

    if (cancelImmediately) {
      return await this.stripe.subscriptions.cancel(subscriptionId)
    }

    return await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    })
  }

  async resumeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured')
    }

    return await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    })
  }

  async updateSubscription(
    subscriptionId: string,
    newPriceId: string
  ): Promise<Stripe.Subscription> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured')
    }

    const subscription = await this.retrieveSubscription(subscriptionId)
    const subscriptionItemId = subscription.items.data[0]?.id

    if (!subscriptionItemId) {
      throw new Error('Subscription item not found')
    }

    return await this.stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscriptionItemId,
          price: newPriceId,
        },
      ],
      proration_behavior: 'always_invoice',
    })
  }

  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string
  ): Stripe.Event | null {
    if (!this.stripe) {
      return null
    }

    const webhookSecret = env.get('STRIPE_WEBHOOK_SECRET')
    if (!webhookSecret) {
      return null
    }

    try {
      return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret)
    } catch (error) {
      console.error('[STRIPE] Webhook signature verification failed:', error)
      return null
    }
  }
}

export default new StripeService()

