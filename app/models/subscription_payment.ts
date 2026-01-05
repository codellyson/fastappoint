import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Subscription from '#models/subscription'

export default class SubscriptionPayment extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare subscriptionId: number

  @column()
  declare amount: number // in kobo

  @column()
  declare status: 'success' | 'failed' | 'pending'

  @column()
  declare paystackReference: string | null

  @column()
  declare paystackTransactionReference: string | null

  @column()
  declare stripeInvoiceId: string | null

  @column.dateTime()
  declare paidAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Subscription)
  declare subscription: BelongsTo<typeof Subscription>

  get formattedAmount() {
    return `₦${(this.amount / 100).toLocaleString()}`
  }
}
