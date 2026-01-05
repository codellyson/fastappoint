import env from '#start/env'

interface ExchangeRateResponse {
  success: boolean
  rates?: Record<string, number>
  error?: {
    code: number
    type: string
    info: string
  }
}

class ExchangeRateService {
  private baseUrl = 'https://api.exchangerate-api.com/v4/latest'
  private cache: Map<string, { rates: Record<string, number>; timestamp: number }> = new Map()
  private cacheTimeout = 60 * 60 * 1000 // 1 hour cache

  constructor() {
    // API key can be used in the future for premium exchange rate APIs
    // Currently using free tier which doesn't require API key
    void env.get('EXCHANGE_RATE_API_KEY')
  }

  /**
   * Get exchange rates from API with caching
   * @param baseCurrency - Base currency code (default: USD)
   * @returns Exchange rates object
   */
  async getRates(baseCurrency = 'USD'): Promise<Record<string, number>> {
    const cacheKey = baseCurrency.toUpperCase()
    const cached = this.cache.get(cacheKey)

    // Return cached rates if still valid
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.rates
    }

    try {
      const response = await fetch(`${this.baseUrl}/${baseCurrency}`)
      const data = (await response.json()) as ExchangeRateResponse

      if (!response.ok || !data.rates) {
        console.error('[EXCHANGE_RATE] API error:', data.error)
        // Return fallback rates if API fails
        return this.getFallbackRates(baseCurrency)
      }

      // Cache the rates
      this.cache.set(cacheKey, {
        rates: data.rates,
        timestamp: Date.now(),
      })

      return data.rates
    } catch (error) {
      console.error('[EXCHANGE_RATE] Error fetching rates:', error)
      return this.getFallbackRates(baseCurrency)
    }
  }

  /**
   * Convert amount from one currency to another using real-time rates
   * @param amount - Amount in smallest unit of fromCurrency
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   * @returns Amount in smallest unit of toCurrency
   */
  async convertAmount(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amount
    }

    // Get rates with USD as base (most common)
    const rates = await this.getRates('USD')

    // Convert to USD first, then to target currency
    const fromRate = rates[fromCurrency.toUpperCase()] || 1
    const toRate = rates[toCurrency.toUpperCase()] || 1

    if (!fromRate || !toRate) {
      console.warn(
        `[EXCHANGE_RATE] Rate not found for ${fromCurrency} or ${toCurrency}, using fallback`
      )
      return this.fallbackConvert(amount, fromCurrency, toCurrency)
    }

    // Convert via USD: (amount / 100 / fromRate) * toRate * 100
    // Simplified: amount * toRate / fromRate
    const converted = (amount * toRate) / fromRate
    return Math.round(converted)
  }

  /**
   * Get exchange rate between two currencies
   * @param fromCurrency - Source currency
   * @param toCurrency - Target currency
   * @returns Exchange rate (1 fromCurrency = X toCurrency)
   */
  async getRate(fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) {
      return 1
    }

    const rates = await this.getRates('USD')
    const fromRate = rates[fromCurrency.toUpperCase()] || 1
    const toRate = rates[toCurrency.toUpperCase()] || 1

    if (!fromRate || !toRate) {
      return 1
    }

    return toRate / fromRate
  }

  /**
   * Fallback rates if API fails (approximate rates)
   */
  private getFallbackRates(baseCurrency: string): Record<string, number> {
    // These are approximate fallback rates
    const fallbackRates: Record<string, Record<string, number>> = {
      USD: {
        USD: 1,
        NGN: 1666.67,
        GBP: 0.79,
        EUR: 0.92,
      },
      NGN: {
        NGN: 1,
        USD: 0.0006,
        GBP: 0.00047,
        EUR: 0.00055,
      },
    }

    return fallbackRates[baseCurrency.toUpperCase()] || fallbackRates.USD
  }

  /**
   * Fallback conversion using approximate rates
   */
  private fallbackConvert(amount: number, fromCurrency: string, toCurrency: string): number {
    const rates = this.getFallbackRates('USD')
    const fromRate = rates[fromCurrency.toUpperCase()] || 1
    const toRate = rates[toCurrency.toUpperCase()] || 1

    const converted = (amount * toRate) / fromRate
    return Math.round(converted)
  }

  /**
   * Clear the cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.cache.clear()
  }
}

export default new ExchangeRateService()
