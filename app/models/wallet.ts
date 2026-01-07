import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Business from '#models/business'
import WalletTransaction from '#models/wallet_transaction'

export default class Wallet extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare businessId: number

  @column()
  declare currency: string

  @column()
  declare balance: number

  @column()
  declare availableBalance: number

  @column()
  declare heldBalance: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Business)
  declare business: BelongsTo<typeof Business>

  @hasMany(() => WalletTransaction)
  declare transactions: HasMany<typeof WalletTransaction>

  /**
   * Get or create wallet for a business and currency
   */
  static async getOrCreate(businessId: number, currency: string): Promise<Wallet> {
    let wallet = await Wallet.query()
      .where('businessId', businessId)
      .where('currency', currency.toUpperCase())
      .first()

    if (!wallet) {
      wallet = await Wallet.create({
        businessId,
        currency: currency.toUpperCase(),
        balance: 0,
        availableBalance: 0,
        heldBalance: 0,
      })
    }

    return wallet
  }
}
