import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Add deposit fields to services
    this.schema.alterTable('services', (table) => {
      table.string('deposit_type', 20).defaultTo('none') // none, percentage, fixed
      table.decimal('deposit_amount', 10, 2).defaultTo(0)
    })

    // Add deposit tracking fields to bookings
    this.schema.alterTable('bookings', (table) => {
      table.decimal('deposit_amount', 10, 2).defaultTo(0)
      table.decimal('balance_due', 10, 2).defaultTo(0)
      table.timestamp('balance_paid_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable('services', (table) => {
      table.dropColumn('deposit_type')
      table.dropColumn('deposit_amount')
    })

    this.schema.alterTable('bookings', (table) => {
      table.dropColumn('deposit_amount')
      table.dropColumn('balance_due')
      table.dropColumn('balance_paid_at')
    })
  }
}
