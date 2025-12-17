import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Service from '#models/service'
import Availability from '#models/availability'
import TimeOff from '#models/time-off'
import Booking from '#models/booking'

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
  declare isActive: boolean

  @column()
  declare isOnboarded: boolean

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

  get bookingUrl() {
    return `https://${this.slug}.bookme.ng`
  }
}
