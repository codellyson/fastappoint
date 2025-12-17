import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Business from '#models/business'
import User from '#models/user'

export default class Availability extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare businessId: number

  @column()
  declare userId: number | null

  @column()
  declare dayOfWeek: number

  @column()
  declare startTime: string

  @column()
  declare endTime: string

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Business)
  declare business: BelongsTo<typeof Business>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  static dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  get dayName() {
    return Availability.dayNames[this.dayOfWeek]
  }
}
