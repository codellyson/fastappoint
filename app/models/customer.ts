import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Booking from '#models/booking'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class Customer extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare email: string

  @column()
  declare name: string

  @column()
  declare phone: string | null

  @column({ serializeAs: null })
  declare password: string | null

  @column()
  declare rememberMeToken: string | null

  @column()
  declare isVerified: boolean

  @column()
  declare verificationToken: string | null

  @column.dateTime()
  declare emailVerifiedAt: DateTime | null

  @column()
  declare notes: string | null

  @column.dateTime()
  declare lastBookingAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => Booking)
  declare bookings: HasMany<typeof Booking>

  /**
   * Check if customer has a password set (registered account vs guest)
   */
  get hasAccount(): boolean {
    return !!this.password
  }

  /**
   * Get display name (first name only)
   */
  get firstName(): string {
    return this.name.split(' ')[0]
  }

  /**
   * Get initials for avatar
   */
  get initials(): string {
    const parts = this.name.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return this.name.substring(0, 2).toUpperCase()
  }
}
