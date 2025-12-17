import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transactions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('business_id')
        .unsigned()
        .references('id')
        .inTable('businesses')
        .onDelete('CASCADE')
        .notNullable()
      table
        .integer('booking_id')
        .unsigned()
        .references('id')
        .inTable('bookings')
        .onDelete('SET NULL')
        .nullable()
      table.decimal('amount', 12, 2).notNullable()
      table.decimal('platform_fee', 12, 2).notNullable().defaultTo(0)
      table.decimal('business_amount', 12, 2).notNullable()
      table.enum('status', ['pending', 'success', 'failed', 'refunded']).notNullable().defaultTo('pending')
      table.string('provider').notNullable().defaultTo('paystack')
      table.string('reference').notNullable().unique()
      table.string('provider_reference').nullable()
      table.json('metadata').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
