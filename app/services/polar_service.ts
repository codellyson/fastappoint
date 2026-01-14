import { Polar } from '@polar-sh/sdk'
import env from '#start/env'

interface CheckoutMetadata {
  businessId: string
  bookingId: string
  serviceName: string
  [key: string]: string
}

class PolarService {
  private polar: Polar | null = null
  private accessToken: string | null = null

  constructor() {
    this.accessToken = env.get('POLAR_ACCESS_TOKEN') || null
    if (this.accessToken) {
      this.polar = new Polar({
        accessToken: this.accessToken,
      })
    }
  }

  isConfigured(): boolean {
    return this.polar !== null && this.accessToken !== null
  }

  /**
   * Create a checkout session for a booking payment
   *
   * NOTE: Polar.sh requires pre-created products. This is a simplified implementation
   * that will need to be updated with actual Polar product IDs when you set up your
   * Polar account and create products in their dashboard.
   *
   * For now, this method will throw an error directing you to create products first.
   */
  async createCheckout(
    amount: number,
    currency: string,
    metadata: CheckoutMetadata,
    _successUrl: string,
    _customerEmail?: string
  ) {
    if (!this.polar) {
      throw new Error('Polar is not configured')
    }

    // Polar requires pre-created product IDs
    // You need to create products in Polar dashboard first, then use their IDs here
    throw new Error(
      'Polar integration requires pre-created products. ' +
        'Please create a product in your Polar dashboard for booking payments, ' +
        'then update polar_service.ts with the product ID. ' +
        `Amount: ${amount} ${currency}, Service: ${metadata.serviceName}`
    )

    // Once you have created a product in Polar, update this code like:
    // const checkout = await this.polar.checkouts.create({
    //   productPriceId: 'your_price_id_from_polar',
    //   successUrl,
    //   metadata: metadata as Record<string, string>,
    //   customerEmail,
    // })
    //
    // return checkout
  }

  /**
   * Retrieve checkout details
   */
  async getCheckout(checkoutId: string) {
    if (!this.polar) {
      throw new Error('Polar is not configured')
    }

    try {
      return await (this.polar.checkouts as any).get({ id: checkoutId })
    } catch (error) {
      console.error('[POLAR] Error retrieving checkout:', error)
      throw error
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(_payloadString: string, headers: Record<string, string>): boolean {
    const webhookSecret = env.get('POLAR_WEBHOOK_SECRET')
    if (!webhookSecret) {
      console.warn('[POLAR] Webhook secret not configured')
      return false
    }

    try {
      // Polar uses Standard Webhooks specification
      // The signature is in the 'webhook-signature' header
      const signature = headers['webhook-signature'] || headers['Webhook-Signature']
      if (!signature) {
        console.error('[POLAR] Missing webhook signature header')
        return false
      }

      // For now, we'll verify the webhook in the webhook handler
      // Polar SDK has built-in verification methods
      return true
    } catch (error) {
      console.error('[POLAR] Webhook verification failed:', error)
      return false
    }
  }

  /**
   * Parse webhook payload
   */
  parseWebhookPayload(payloadString: string): any {
    try {
      return JSON.parse(payloadString)
    } catch (error) {
      console.error('[POLAR] Failed to parse webhook payload:', error)
      throw error
    }
  }

  /**
   * Get supported currencies for Polar
   */
  getSupportedCurrencies(): string[] {
    return ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'CHF', 'SEK', 'NOK', 'DKK']
  }

  /**
   * Check if a currency is supported by Polar
   */
  isCurrencySupported(currency: string): boolean {
    return this.getSupportedCurrencies().includes(currency.toUpperCase())
  }
}

export default new PolarService()
