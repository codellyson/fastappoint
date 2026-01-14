import Flutterwave from 'flutterwave-node-v3'
import env from '#start/env'
import axios from 'axios'

interface PaymentMetadata {
  businessId: string
  bookingId?: string
  serviceName?: string
  planId?: string
  planName?: string
  [key: string]: string | number | undefined
}

class FlutterwaveService {
  private flw: any = null
  private publicKey: string | null = null
  private secretKey: string | null = null
  private baseUrl = 'https://api.flutterwave.com/v3'

  constructor() {
    this.publicKey = env.get('FLUTTERWAVE_PUBLIC_KEY') || null
    this.secretKey = env.get('FLUTTERWAVE_SECRET_KEY') || null

    if (this.publicKey && this.secretKey) {
      this.flw = new Flutterwave(this.publicKey, this.secretKey)
    }
  }

  isConfigured(): boolean {
    return this.flw !== null && this.publicKey !== null && this.secretKey !== null
  }

  /**
   * Initialize payment - creates a payment link using Flutterwave Standard
   */
  async initializePayment(
    amount: number,
    currency: string,
    customerEmail: string,
    customerName: string,
    redirectUrl: string,
    metadata: PaymentMetadata
  ) {
    if (!this.secretKey) {
      throw new Error('Flutterwave is not configured')
    }

    try {
      // Generate appropriate tx_ref and descriptions based on payment type
      const isSubscription = !!metadata.planId
      const txRef = isSubscription
        ? `subscription-${metadata.planId}-${metadata.businessId}-${Date.now()}`
        : `booking-${metadata.bookingId}-${Date.now()}`

      const title = isSubscription ? 'Subscription Payment' : 'Booking Payment'
      const description = isSubscription
        ? `Payment for ${metadata.planName} subscription`
        : `Payment for ${metadata.serviceName}`

      const payload = {
        tx_ref: txRef,
        amount: amount,
        currency: currency.toUpperCase(),
        redirect_url: redirectUrl,
        customer: {
          email: customerEmail,
          name: customerName,
        },
        customizations: {
          title: title,
          description: description,
          logo: '', // Add your logo URL here if you have one
        },
        meta: metadata,
      }

      const response = await axios.post(`${this.baseUrl}/payments`, payload, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.data.status === 'success') {
        return {
          success: true,
          paymentLink: response.data.data.link,
          reference: payload.tx_ref,
        }
      } else {
        throw new Error(response.data.message || 'Payment initialization failed')
      }
    } catch (error: any) {
      console.error('[FLUTTERWAVE] Error initializing payment:', error.response?.data || error)
      throw error
    }
  }

  /**
   * Verify payment transaction
   */
  async verifyTransaction(transactionId: string) {
    if (!this.flw) {
      throw new Error('Flutterwave is not configured')
    }

    try {
      const response = await this.flw.Transaction.verify({ id: transactionId })

      if (response.status === 'success' && response.data) {
        return {
          success: true,
          data: response.data,
          status: response.data.status,
          amount: response.data.amount,
          currency: response.data.currency,
          reference: response.data.tx_ref,
          metadata: response.data.meta,
        }
      } else {
        return {
          success: false,
          message: response.message || 'Verification failed',
        }
      }
    } catch (error) {
      console.error('[FLUTTERWAVE] Error verifying transaction:', error)
      throw error
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(signature: string): boolean {
    const webhookSecret = env.get('FLUTTERWAVE_WEBHOOK_SECRET')
    if (!webhookSecret) {
      console.warn('[FLUTTERWAVE] Webhook secret not configured')
      return false
    }

    try {
      // Flutterwave sends the secret hash in the header
      // Just compare directly
      return signature === webhookSecret
    } catch (error) {
      console.error('[FLUTTERWAVE] Webhook verification failed:', error)
      return false
    }
  }

  /**
   * Get list of supported currencies
   * Flutterwave supports 150+ currencies
   */
  getSupportedCurrencies(): string[] {
    return [
      // Major currencies
      'USD',
      'EUR',
      'GBP',
      'CAD',
      'AUD',
      'JPY',
      'CHF',
      'CNY',
      'INR',
      // African currencies
      'NGN',
      'GHS',
      'KES',
      'UGX',
      'ZAR',
      'TZS',
      'XAF',
      'XOF',
      'ZMW',
      'RWF',
      // Middle East
      'AED',
      'SAR',
      'EGP',
      // Latin America
      'BRL',
      'MXN',
      'ARS',
      // Asia Pacific
      'SGD',
      'HKD',
      'MYR',
      'PHP',
      'THB',
      'IDR',
      'VND',
      // Europe
      'SEK',
      'NOK',
      'DKK',
      'PLN',
      'CZK',
      'HUF',
      // Others
      'NZD',
      'ILS',
      'TRY',
      // And 100+ more...
    ]
  }

  /**
   * Check if currency is supported
   */
  isCurrencySupported(_currency: string): boolean {
    // Flutterwave supports 150+ currencies, so we'll assume most are supported
    // You can expand the list above if you want to be more specific
    return true // For now, accept all currencies
  }
}

export default new FlutterwaveService()
