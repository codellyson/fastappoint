import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Business from '#models/business'
import Service from '#models/service'
import User from '#models/user'

export default class Booking extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare businessId: number

  @column()
  declare serviceId: number | null

  @column()
  declare staffId: number | null

  @column()
  declare customerName: string

  @column()
  declare customerEmail: string

  @column()
  declare customerPhone: string | null

  @column.date()
  declare date: DateTime

  @column()
  declare startTime: string

  @column()
  declare endTime: string

  @column()
  declare status: 'pending_payment' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'

  @column()
  declare amount: number

  @column()
  declare paymentStatus: 'pending' | 'paid' | 'refunded' | 'partial'

  @column()
  declare paymentReference: string | null

  @column()
  declare notes: string | null

  @column.dateTime()
  declare cancelledAt: DateTime | null

  @column()
  declare cancellationReason: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Business)
  declare business: BelongsTo<typeof Business>

  @belongsTo(() => Service)
  declare service: BelongsTo<typeof Service>

  @belongsTo(() => User, { foreignKey: 'staffId' })
  declare staff: BelongsTo<typeof User>

  get isPast() {
    const bookingDateTime = this.date.set({
      hour: Number.parseInt(this.endTime.split(':')[0]),
      minute: Number.parseInt(this.endTime.split(':')[1]),
    })
    return bookingDateTime < DateTime.now()
  }

  get isUpcoming() {
    return !this.isPast && this.status === 'confirmed'
  }
}
