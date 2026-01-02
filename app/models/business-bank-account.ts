import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Business from '#models/business'

export default class BusinessBankAccount extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare businessId: number

  @column()
  declare accountName: string

  @column()
  declare accountNumber: string

  @column()
  declare bankCode: string

  @column()
  declare bankName: string

  @column()
  declare paystackRecipientCode: string | null

  @column()
  declare isPrimary: boolean

  @column()
  declare isVerified: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Business)
  declare business: BelongsTo<typeof Business>

  /**
   * Get masked account number (e.g., ****6789)
   */
  get maskedAccountNumber(): string {
    if (this.accountNumber.length <= 4) {
      return this.accountNumber
    }
    return '****' + this.accountNumber.slice(-4)
  }
}

