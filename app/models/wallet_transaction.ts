import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Wallet from '#models/wallet'
import Business from '#models/business'
import Transaction from '#models/transaction'
import WithdrawalRequest from '#models/withdrawal-request'

export default class WalletTransaction extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare walletId: number

  @column()
  declare businessId: number

  @column()
  declare transactionId: number | null

  @column()
  declare withdrawalRequestId: number | null

  @column()
  declare type: 'credit' | 'debit' | 'hold' | 'release' | 'refund'

  @column()
  declare amount: number

  @column()
  declare balanceBefore: number

  @column()
  declare balanceAfter: number

  @column()
  declare currency: string

  @column()
  declare reference: string | null

  @column()
  declare description: string | null

  @column()
  declare metadata: Record<string, unknown> | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Wallet)
  declare wallet: BelongsTo<typeof Wallet>

  @belongsTo(() => Business)
  declare business: BelongsTo<typeof Business>

  @belongsTo(() => Transaction)
  declare transaction: BelongsTo<typeof Transaction>

  @belongsTo(() => WithdrawalRequest)
  declare withdrawalRequest: BelongsTo<typeof WithdrawalRequest>
}
