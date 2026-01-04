import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Business from '#models/business'
import Service from '#models/service'
import User from '#models/user'
import ServicePackage from '#models/service_package'
import Customer from '#models/customer'

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

  @column.dateTime()
  declare paymentExpiresAt: DateTime | null

  @column()
  declare paymentAttempts: number

  @column()
  declare lastPaymentError: string | null

  @column()
  declare idempotencyKey: string | null

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

  @column.dateTime()
  declare reminder24hSentAt: DateTime | null

  @column.dateTime()
  declare reminder1hSentAt: DateTime | null

  @column()
  declare depositAmount: number

  @column()
  declare balanceDue: number

  @column.dateTime()
  declare balancePaidAt: DateTime | null

  @column()
  declare packageId: number | null

  @column()
  declare locationType: 'business' | 'client' | 'virtual' | null

  @column()
  declare clientAddress: string | null

  @column()
  declare travelFee: number

  @column()
  declare googleEventId: string | null

  @column()
  declare customerId: number | null

  @belongsTo(() => Business)
  declare business: BelongsTo<typeof Business>

  @belongsTo(() => Service)
  declare service: BelongsTo<typeof Service>

  @belongsTo(() => User, { foreignKey: 'staffId' })
  declare staff: BelongsTo<typeof User>

  @belongsTo(() => ServicePackage)
  declare package: BelongsTo<typeof ServicePackage>

  @belongsTo(() => Customer)
  declare customer: BelongsTo<typeof Customer>

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

  get isPaymentExpired() {
    if (!this.paymentExpiresAt) return false
    return DateTime.now() > this.paymentExpiresAt
  }

  get canRetryPayment() {
    return this.paymentAttempts < 3 && !this.isPaymentExpired
  }

  get hasDeposit() {
    return this.depositAmount > 0
  }

  get isDepositPaid() {
    return this.hasDeposit && this.paymentStatus !== 'pending'
  }

  get isBalancePaid() {
    return this.balancePaidAt !== null
  }

  get isFullyPaid() {
    if (!this.hasDeposit) {
      return this.paymentStatus === 'paid'
    }
    return this.isDepositPaid && this.isBalancePaid
  }

  get locationTypeLabel() {
    const labels: Record<string, string> = {
      business: 'At Business Location',
      client: 'At Client Location',
      virtual: 'Virtual/Online',
    }
    return this.locationType ? labels[this.locationType] : null
  }

  get hasTravelFee() {
    return this.travelFee > 0
  }

  get totalWithTravelFee() {
    return this.amount + (this.travelFee || 0)
  }
}
