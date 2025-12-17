import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import Business from '#models/business'
import User from '#models/user'

export default class Service extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare businessId: number

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare durationMinutes: number

  @column()
  declare price: number

  @column()
  declare image: string | null

  @column()
  declare isActive: boolean

  @column()
  declare sortOrder: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Business)
  declare business: BelongsTo<typeof Business>

  @manyToMany(() => User, {
    pivotTable: 'staff_services',
    pivotForeignKey: 'service_id',
    pivotRelatedForeignKey: 'user_id',
  })
  declare staff: ManyToMany<typeof User>

  get formattedDuration() {
    const hours = Math.floor(this.durationMinutes / 60)
    const mins = this.durationMinutes % 60
    if (hours === 0) return `${mins}min`
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}min`
  }
}
