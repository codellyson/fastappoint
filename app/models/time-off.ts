import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Business from '#models/business'
import User from '#models/user'

export default class TimeOff extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare businessId: number

  @column()
  declare userId: number | null

  @column()
  declare title: string | null

  @column.dateTime()
  declare startDatetime: DateTime

  @column.dateTime()
  declare endDatetime: DateTime

  @column()
  declare isAllDay: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Business)
  declare business: BelongsTo<typeof Business>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
