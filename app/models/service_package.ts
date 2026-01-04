import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Business from './business.js'

export default class ServicePackage extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare businessId: number

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare image: string | null

  @column()
  declare serviceIds: number[]

  @column()
  declare packagePrice: number

  @column()
  declare originalPrice: number

  @column()
  declare discountAmount: number

  @column()
  declare durationMinutes: number

  @column()
  declare isActive: boolean

  @column()
  declare sortOrder: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Business)
  declare business: BelongsTo<typeof Business>

  // Computed property for savings percentage
  get savingsPercent(): number {
    if (this.originalPrice <= 0) return 0
    return Math.round(((this.originalPrice - this.packagePrice) / this.originalPrice) * 100)
  }
}
