import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'customers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('email', 255).notNullable().unique()
      table.string('name', 255).notNullable()
      table.string('phone', 50).nullable()
      table.string('password', 255).nullable() // Nullable for guest customers
      table.string('remember_me_token', 255).nullable()
      table.boolean('is_verified').defaultTo(false)
      table.string('verification_token', 255).nullable()
      table.timestamp('email_verified_at').nullable()
      table.text('notes').nullable() // Customer preferences, allergies, etc.
      table.timestamp('last_booking_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    // Add customer_id to bookings table
    this.schema.alterTable('bookings', (table) => {
      table.integer('customer_id').unsigned().nullable().references('id').inTable('customers').onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable('bookings', (table) => {
      table.dropColumn('customer_id')
    })
    this.schema.dropTable(this.tableName)
  }
}
