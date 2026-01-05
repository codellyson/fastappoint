import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Business from '#models/business'
import SubscriptionPlan from '#models/subscription_plan'
import SubscriptionPayment from '#models/subscription_payment'

export default class Subscription extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare businessId: number

  @column()
  declare planId: number | null

  @column()
  declare status: 'active' | 'past_due' | 'cancelled' | 'trialing'

  @column()
  declare paystackSubscriptionCode: string | null

  @column()
  declare paystackCustomerCode: string | null

  @column()
  declare stripeSubscriptionId: string | null

  @column()
  declare stripeCustomerId: string | null

  @column()
  declare currency: string | null // Currency used for payment (location-based)

  @column.dateTime()
  declare currentPeriodStart: DateTime | null

  @column.dateTime()
  declare currentPeriodEnd: DateTime | null

  @column()
  declare cancelAtPeriodEnd: boolean

  @column.dateTime()
  declare cancelledAt: DateTime | null

  @column.dateTime()
  declare trialEndsAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Business)
  declare business: BelongsTo<typeof Business>

  @belongsTo(() => SubscriptionPlan, {
    foreignKey: 'planId',
  })
  declare plan: BelongsTo<typeof SubscriptionPlan>

  @hasMany(() => SubscriptionPayment)
  declare payments: HasMany<typeof SubscriptionPayment>

  get isActive() {
    return this.status === 'active' && this.currentPeriodEnd && this.currentPeriodEnd > DateTime.now()
  }

  get isTrialing() {
    return this.status === 'trialing' && this.trialEndsAt && this.trialEndsAt > DateTime.now()
  }

  get isExpired() {
    if (!this.currentPeriodEnd) return false
    return this.currentPeriodEnd < DateTime.now()
  }

  get daysUntilRenewal() {
    if (!this.currentPeriodEnd) return 0
    const diff = this.currentPeriodEnd.diff(DateTime.now(), 'days').days
    return Math.max(0, Math.ceil(diff))
  }
}
