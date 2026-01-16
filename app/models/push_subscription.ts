import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from './user.js'

export default class PushSubscription extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare endpoint: string

  @column()
  declare keys: string // JSON string containing p256dh and auth keys

  @column()
  declare deviceName: string | null

  @column()
  declare userAgent: string | null

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  // Helper methods
  public getKeys(): { p256dh: string; auth: string } {
    return JSON.parse(this.keys)
  }

  public setKeys(keys: { p256dh: string; auth: string }) {
    this.keys = JSON.stringify(keys)
  }
}
