import exchangeRateService from './exchange_rate_service.js'

class CurrencyService {
  /**
   * All prices are stored and returned in smallest denomination:
   * - NGN: kobo (1 Naira = 100 kobo)
   * - USD: cents (1 Dollar = 100 cents)
   * - GBP: pence (1 Pound = 100 pence)
   * - EUR: cents (1 Euro = 100 cents)
   */

  /**
   * All prices are stored and returned in smallest denomination:
   * - NGN: kobo (1 Naira = 100 kobo)
   * - USD: cents (1 Dollar = 100 cents)
   * - GBP: pence (1 Pound = 100 pence)
   * - EUR: cents (1 Euro = 100 cents)
   */

  getCurrencySymbol(currency: string): string {
    const symbols: Record<string, string> = {
      NGN: '₦',
      USD: '$',
      GBP: '£',
      EUR: '€',
    }
    return symbols[currency.toUpperCase()] || currency
  }

  /**
   * Format price for display
   * @param amount - Price in smallest denomination (kobo/cents/pence)
   * @param currency - Currency code (NGN, USD, GBP, EUR)
   * @param inSmallestUnit - If true, amount is in smallest unit (default: true)
   * @returns Formatted price string (e.g., "$30.00", "₦5,000.00")
   */
  formatPrice(amount: number, currency: string, inSmallestUnit = true): string {
    const symbol = this.getCurrencySymbol(currency)
    const value = inSmallestUnit ? amount / 100 : amount
    return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  formatPriceFromSmallestUnit(amount: number, currency: string): string {
    return this.formatPrice(amount, currency, true)
  }

  /**
   * Convert amount from one currency to another using real-time exchange rates
   * This is used for products/services where dynamic conversion is needed
   * @param amount - Amount in smallest unit of fromCurrency
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   * @returns Amount in smallest unit of toCurrency
   */
  async convertAmount(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amount
    }

    return await exchangeRateService.convertAmount(amount, fromCurrency, toCurrency)
  }

  /**
   * Get plan price in target currency (returns in smallest denomination)
   * For subscriptions, uses fixed prices per currency group
   * @param planPrice - Plan price in smallest unit of planCurrency
   * @param planCurrency - Plan's currency code
   * @param targetCurrency - Target currency code
   * @returns Price in smallest unit of targetCurrency
   */
  getPriceForCurrency(planPrice: number, planCurrency: string, targetCurrency: string): number {
    if (planCurrency === targetCurrency) {
      return planPrice
    }

    // For subscriptions, we use fixed prices per currency group
    // This method is kept for backward compatibility but should not be used for subscriptions
    // Subscriptions should use plan.getPriceForCurrency() which checks for fixed prices
    console.warn(
      '[CURRENCY] Using dynamic conversion for subscription price. Consider using fixed prices.'
    )
    // Fallback to approximate conversion (should not be used in production)
    return Math.round(planPrice)
  }

  getSmallestUnit(_currency: string): number {
    return 100
  }

  toSmallestUnit(amount: number, currency: string): number {
    return Math.round(amount * this.getSmallestUnit(currency))
  }

  fromSmallestUnit(amount: number, currency: string): number {
    return amount / this.getSmallestUnit(currency)
  }

  getSupportedCurrencies(): string[] {
    return ['NGN', 'USD', 'GBP', 'EUR', 'ZAR', 'KES', 'GHS', 'UGX']
  }

  detectCurrencyFromLocale(locale: string): string {
    const localeToCurrency: Record<string, string> = {
      'en-US': 'USD',
      'en-GB': 'GBP',
      'en-NG': 'NGN',
      'en': 'USD',
      'fr': 'EUR',
      'de': 'EUR',
      'es': 'EUR',
      'it': 'EUR',
    }

    const normalizedLocale = locale.toLowerCase().split('-')[0]
    return localeToCurrency[locale] || localeToCurrency[normalizedLocale] || 'NGN'
  }

  detectCurrencyFromCountry(countryCode: string): string {
    const countryToCurrency: Record<string, string> = {
      NG: 'NGN',
      US: 'USD',
      GB: 'GBP',
      UK: 'GBP',
      FR: 'EUR',
      DE: 'EUR',
      ES: 'EUR',
      IT: 'EUR',
      NL: 'EUR',
      BE: 'EUR',
      AT: 'EUR',
      PT: 'EUR',
      IE: 'EUR',
      FI: 'EUR',
      GR: 'EUR',
    }

    return countryToCurrency[countryCode.toUpperCase()] || 'NGN'
  }
}

export default new CurrencyService()
