import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, hasOne } from '@adonisjs/lucid/orm'
import type { HasMany, HasOne } from '@adonisjs/lucid/types/relations'
import env from '#start/env'
import User from '#models/user'
import Service from '#models/service'
import Availability from '#models/availability'
import TimeOff from '#models/time-off'
import Booking from '#models/booking'
import BusinessTheme from '#models/business-theme'
import Subscription from '#models/subscription'
import BusinessBankAccount from '#models/business-bank-account'
import WithdrawalRequest from '#models/withdrawal-request'

export default class Business extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare slug: string

  @column()
  declare name: string

  @column()
  declare email: string

  @column()
  declare phone: string | null

  @column()
  declare logo: string | null

  @column()
  declare description: string | null

  @column()
  declare category: string

  @column()
  declare currency: string

  @column()
  declare timezone: string

  @column()
  declare cancellationPolicy: string | null

  @column()
  declare cancellationHours: number

  @column()
  declare allowInstallments: boolean

  @column()
  declare subscriptionTier: 'free' | 'starter' | 'pro' | 'business'

  @column()
  declare subscriptionStatus: 'active' | 'past_due' | 'cancelled'

  @column.dateTime()
  declare subscriptionEndsAt: DateTime | null

  @column()
  declare paystackSubaccountCode: string | null

  @column()
  declare paymentProvider: 'paystack' | 'stripe'

  @column()
  declare stripeAccountId: string | null

  @column()
  declare stripeAccountStatus: string | null

  @column()
  declare stripeOnboardingUrl: string | null

  @column()
  declare stripeChargesEnabled: boolean

  @column()
  declare stripePayoutsEnabled: boolean

  @column()
  declare isActive: boolean

  @column()
  declare isOnboarded: boolean

  @column()
  declare reminder24hEnabled: boolean

  @column()
  declare reminder1hEnabled: boolean

  @column()
  declare googleCalendarEnabled: boolean

  @column()
  declare googleAccessToken: string | null

  @column()
  declare googleRefreshToken: string | null

  @column.dateTime()
  declare googleTokenExpiresAt: DateTime | null

  @column()
  declare googleCalendarId: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => User)
  declare users: HasMany<typeof User>

  @hasMany(() => Service)
  declare services: HasMany<typeof Service>

  @hasMany(() => Availability)
  declare availabilities: HasMany<typeof Availability>

  @hasMany(() => TimeOff)
  declare timeOffs: HasMany<typeof TimeOff>

  @hasMany(() => Booking)
  declare bookings: HasMany<typeof Booking>

  @hasOne(() => BusinessTheme)
  declare theme: HasOne<typeof BusinessTheme>

  @hasOne(() => Subscription)
  declare subscription: HasOne<typeof Subscription>

  @hasMany(() => BusinessBankAccount)
  declare bankAccounts: HasMany<typeof BusinessBankAccount>

  @hasMany(() => WithdrawalRequest)
  declare withdrawalRequests: HasMany<typeof WithdrawalRequest>

  get bookingUrl() {
    const isDev = env.get('NODE_ENV') === 'development'
    const port = env.get('PORT', 3333)

    if (isDev) {
      return `http://${this.slug}.localhost:${port}`
    }

    const domain = env.get('APP_DOMAIN', 'fastappoint.com')
    return `https://${this.slug}.${domain}`
  }

  async getActiveSubscription() {
    return await Subscription.query()
      .where('businessId', this.id)
      .where('status', 'active')
      .where('currentPeriodEnd', '>', DateTime.now().toSQL()!)
      .preload('plan')
      .first()
  }

  async getCurrentSubscription() {
    return await Subscription.query()
      .where('businessId', this.id)
      .orderBy('createdAt', 'desc')
      .preload('plan')
      .first()
  }
}
