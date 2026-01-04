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
  declare depositType: 'none' | 'percentage' | 'fixed'

  @column()
  declare depositAmount: number

  @column()
  declare locationType: 'business' | 'client' | 'virtual' | 'flexible'

  @column()
  declare travelFee: number

  @column()
  declare travelRadiusKm: number | null

  @column()
  declare virtualMeetingUrl: string | null

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

  get hasDeposit() {
    return this.depositType !== 'none' && this.depositAmount > 0
  }

  get calculatedDepositAmount() {
    if (this.depositType === 'none' || !this.depositAmount) {
      return 0
    }
    if (this.depositType === 'percentage') {
      return Math.round((this.price * this.depositAmount) / 100)
    }
    return this.depositAmount
  }

  get balanceAfterDeposit() {
    return this.price - this.calculatedDepositAmount
  }

  get locationTypeLabel() {
    const labels: Record<string, string> = {
      business: 'At Business Location',
      client: 'At Client Location',
      virtual: 'Virtual/Online',
      flexible: 'Flexible (Customer Chooses)',
    }
    return labels[this.locationType] || 'At Business Location'
  }

  get hasTravelFee() {
    return (this.locationType === 'client' || this.locationType === 'flexible') && this.travelFee > 0
  }

  get isVirtual() {
    return this.locationType === 'virtual'
  }

  get isFlexible() {
    return this.locationType === 'flexible'
  }
}
