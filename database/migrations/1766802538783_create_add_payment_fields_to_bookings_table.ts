import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'bookings'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('payment_expires_at').nullable().after('payment_reference')
      table.integer('payment_attempts').notNullable().defaultTo(0).after('payment_expires_at')
      table.text('last_payment_error').nullable().after('payment_attempts')
      table.string('idempotency_key').nullable().unique().after('last_payment_error')
      table.index(['payment_expires_at', 'status'], 'bookings_payment_expiry_idx')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex('bookings_payment_expiry_idx')
      table.dropColumn('payment_expires_at')
      table.dropColumn('payment_attempts')
      table.dropColumn('last_payment_error')
      table.dropColumn('idempotency_key')
    })
  }
}
