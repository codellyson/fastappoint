import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Business from '#models/business'
import Booking from '#models/booking'
import WithdrawalRequest from '#models/withdrawal-request'

export default class Transaction extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare businessId: number

  @column()
  declare bookingId: number | null

  @column()
  declare withdrawalRequestId: number | null

  @column()
  declare amount: number

  @column()
  declare platformFee: number

  @column()
  declare businessAmount: number

  @column()
  declare status: 'pending' | 'success' | 'failed' | 'refunded'

  @column()
  declare type: 'payment' | 'withdrawal' | 'refund' | 'platform_fee'

  @column()
  declare direction: 'credit' | 'debit'

  @column()
  declare provider: string

  @column()
  declare reference: string

  @column()
  declare providerReference: string | null

  @column()
  declare currency: string | null

  @column()
  declare metadata: Record<string, unknown> | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Business)
  declare business: BelongsTo<typeof Business>

  @belongsTo(() => Booking)
  declare booking: BelongsTo<typeof Booking>

  @belongsTo(() => WithdrawalRequest)
  declare withdrawalRequest: BelongsTo<typeof WithdrawalRequest>

  /**
   * Get business balance for a specific currency
   * Calculates: SUM(payments) - SUM(withdrawals)
   */
  static async getBusinessBalance(businessId: number, currency: string): Promise<number> {
    // Sum of successful payments (credits)
    const creditsResult = await Transaction.query()
      .where('businessId', businessId)
      .where('currency', currency.toUpperCase())
      .where('status', 'success')
      .where('type', 'payment')
      .sum('businessAmount as total')
      .first()

    // Sum of completed withdrawals (debits)
    const debitsResult = await Transaction.query()
      .where('businessId', businessId)
      .where('currency', currency.toUpperCase())
      .where('status', 'success')
      .where('type', 'withdrawal')
      .sum('businessAmount as total')
      .first()

    const totalCredits = Number(creditsResult?.$extras.total || 0)
    const totalDebits = Number(debitsResult?.$extras.total || 0)

    return totalCredits - totalDebits
  }

  /**
   * Get all currencies a business has transactions in
   */
  static async getBusinessCurrencies(businessId: number): Promise<string[]> {
    const result = await Transaction.query()
      .where('businessId', businessId)
      .where('status', 'success')
      .distinct('currency')
      .select('currency')

    return result.map((r) => r.currency || 'NGN').filter(Boolean)
  }

  /**
   * Get business balances for all currencies
   */
  static async getBusinessBalances(
    businessId: number
  ): Promise<Array<{ currency: string; balance: number }>> {
    const currencies = await this.getBusinessCurrencies(businessId)

    const balances = await Promise.all(
      currencies.map(async (currency) => ({
        currency,
        balance: await this.getBusinessBalance(businessId, currency),
      }))
    )

    return balances
  }
}
