/**
 * Stripe Service - Stub Implementation
 *
 * This is a stub service to maintain compatibility with subscription code.
 * Stripe has been removed in favor of Flutterwave for payments.
 * Subscriptions functionality is currently disabled.
 */

class StripeService {
  isConfigured(): boolean {
    return false
  }

  async createCustomer(_email: string, _name: string, _metadata?: Record<string, string>) {
    throw new Error('Stripe is no longer supported. Please use Flutterwave for payments.')
  }

  async createSubscription(
    _customerId: string,
    _priceId: string,
    _metadata?: Record<string, string>
  ) {
    throw new Error('Stripe is no longer supported. Subscriptions are currently disabled.')
  }

  async retrieveSubscription(_subscriptionId: string) {
    throw new Error('Stripe is no longer supported. Subscriptions are currently disabled.')
  }

  async cancelSubscription(_subscriptionId: string, _cancelImmediately?: boolean) {
    throw new Error('Stripe is no longer supported. Subscriptions are currently disabled.')
  }

  async resumeSubscription(_subscriptionId: string) {
    throw new Error('Stripe is no longer supported. Subscriptions are currently disabled.')
  }

  async createProduct(_name: string, _description?: string) {
    throw new Error('Stripe is no longer supported. Subscriptions are currently disabled.')
  }

  async createPrice(
    _productId: string,
    _amount: number,
    _currency: string,
    _interval: 'month' | 'year'
  ) {
    throw new Error('Stripe is no longer supported. Subscriptions are currently disabled.')
  }

  async retrievePrice(_priceId: string) {
    throw new Error('Stripe is no longer supported. Subscriptions are currently disabled.')
  }

  async retrievePaymentIntent(_paymentIntentId: string) {
    throw new Error('Stripe is no longer supported. Please use Flutterwave for payments.')
  }

  verifyWebhookSignature(_body: string, _signature: string) {
    return null
  }
}

export default new StripeService()
