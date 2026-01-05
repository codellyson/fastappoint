import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Subscription from '#models/subscription'
import currencyService from '../services/currency_service.js'

export default class SubscriptionPlan extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string // free, starter, pro, business

  @column()
  declare displayName: string

  @column()
  declare price: number // Always in smallest unit: kobo (NGN), cents (USD/GBP/EUR) - Legacy field

  @column()
  declare priceUsd: number | null // Price in cents (smallest unit for USD) - Legacy field

  @column()
  declare currency: string // Legacy field - default currency

  // Currency group prices (fixed prices per region)
  @column({ columnName: 'price_ngn' })
  declare priceNgn: number | null // Price in kobo for African countries

  @column({ columnName: 'price_usd_group' })
  declare priceUsdGroup: number | null // Price in cents for USD countries

  @column({ columnName: 'price_gbp' })
  declare priceGbp: number | null // Price in pence for GBP countries

  @column({ columnName: 'price_eur' })
  declare priceEur: number | null // Price in cents for EUR countries

  @column()
  declare interval: 'monthly' | 'yearly'

  @column()
  declare maxStaff: number | null // null = unlimited

  @column()
  declare maxBookingsPerMonth: number | null // null = unlimited

  @column()
  declare features: string[] | null // JSON array

  @column()
  declare description: string | null

  @column()
  declare isActive: boolean

  @column()
  declare sortOrder: number

  @column()
  declare paystackPlanCode: string | null

  @column()
  declare stripeProductId: string | null

  @column()
  declare stripePriceId: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => Subscription)
  declare subscriptions: HasMany<typeof Subscription>

  /**
   * Get formatted price in plan's default currency
   * @returns Formatted price string (e.g., "₦5,000.00")
   */
  get formattedPrice() {
    return currencyService.formatPrice(this.price, this.currency || 'NGN', true)
  }

  /**
   * Get formatted price in specified currency
   * @param currency - Target currency code
   * @returns Formatted price string
   */
  getFormattedPrice(currency: string): string {
    const price = this.getPriceForCurrency(currency)
    return currencyService.formatPrice(price, currency, true)
  }

  /**
   * Get price in target currency (returns in smallest denomination)
   * Uses fixed prices per currency group for subscriptions
   * @param currency - Target currency code
   * @returns Price in smallest unit (kobo/cents/pence)
   */
  getPriceForCurrency(currency: string): number {
    const currencyUpper = currency.toUpperCase()

    // Use fixed prices per currency group
    switch (currencyUpper) {
      case 'NGN':
        return this.priceNgn || this.price || 0
      case 'USD':
        return this.priceUsdGroup || this.priceUsd || this.price || 0
      case 'GBP':
        return this.priceGbp || this.price || 0
      case 'EUR':
        return this.priceEur || this.price || 0
      default:
        // Fallback to legacy price or default currency
        if (currencyUpper === this.currency?.toUpperCase()) {
          return this.price
        }
        // Try to find closest match
        if (this.priceNgn) return this.priceNgn
        if (this.priceUsdGroup) return this.priceUsdGroup
        if (this.priceGbp) return this.priceGbp
        if (this.priceEur) return this.priceEur
        return this.price || 0
    }
  }

  /**
   * Get currency group for a given currency
   * @param currency - Currency code
   * @returns Currency group ('african' | 'international')
   */
  getCurrencyGroup(currency: string): 'african' | 'international' {
    const africanCurrencies = ['NGN', 'ZAR', 'KES', 'GHS', 'UGX', 'TZS', 'ETB']
    return africanCurrencies.includes(currency.toUpperCase()) ? 'african' : 'international'
  }

  get isUnlimitedStaff() {
    return this.maxStaff === null
  }

  get isUnlimitedBookings() {
    return this.maxBookingsPerMonth === null
  }
}
