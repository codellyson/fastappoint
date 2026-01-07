import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Business from '#models/business'
import Booking from '#models/booking'

export default class Transaction extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare businessId: number

  @column()
  declare bookingId: number | null

  @column()
  declare amount: number

  @column()
  declare platformFee: number

  @column()
  declare businessAmount: number

  @column()
  declare status: 'pending' | 'success' | 'failed' | 'refunded'

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
}
