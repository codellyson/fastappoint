import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Business from '#models/business'
import BusinessBankAccount from '#models/business-bank-account'

export default class WithdrawalRequest extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare businessId: number

  @column()
  declare bankAccountId: number | null

  @column()
  declare amount: number

  @column()
  declare status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

  @column()
  declare paystackTransferCode: string | null

  @column()
  declare paystackReference: string | null

  @column()
  declare failureReason: string | null

  @column.dateTime()
  declare processedAt: DateTime | null

  @column()
  declare processedBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Business)
  declare business: BelongsTo<typeof Business>

  @belongsTo(() => BusinessBankAccount, {
    foreignKey: 'bankAccountId',
  })
  declare bankAccount: BelongsTo<typeof BusinessBankAccount>

  /**
   * Check if the withdrawal can be cancelled
   */
  get canBeCancelled(): boolean {
    return this.status === 'pending'
  }

  /**
   * Get status badge color class
   */
  get statusBadgeClass(): string {
    switch (this.status) {
      case 'completed':
        return 'bg-success/10 text-success'
      case 'processing':
        return 'bg-warning/10 text-warning'
      case 'failed':
        return 'bg-error/10 text-error'
      case 'cancelled':
        return 'bg-sand-5 text-sand-11'
      default:
        return 'bg-primary/10 text-primary'
    }
  }

  /**
   * Get human-readable status
   */
  get statusLabel(): string {
    switch (this.status) {
      case 'completed':
        return 'Completed'
      case 'processing':
        return 'Processing'
      case 'failed':
        return 'Failed'
      case 'cancelled':
        return 'Cancelled'
      default:
        return 'Pending'
    }
  }
}

