import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'bookings'

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
        .integer('service_id')
        .unsigned()
        .references('id')
        .inTable('services')
        .onDelete('SET NULL')
        .nullable()
      table
        .integer('staff_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
        .nullable()
      table.string('customer_name').notNullable()
      table.string('customer_email').notNullable()
      table.string('customer_phone').nullable()
      table.date('date').notNullable()
      table.time('start_time').notNullable()
      table.time('end_time').notNullable()
      table
        .enum('status', ['pending_payment', 'confirmed', 'completed', 'cancelled', 'no_show'])
        .notNullable()
        .defaultTo('pending_payment')
      table.decimal('amount', 12, 2).notNullable()
      table
        .enum('payment_status', ['pending', 'paid', 'refunded', 'partial'])
        .notNullable()
        .defaultTo('pending')
      table.string('payment_reference').nullable()
      table.text('notes').nullable()
      table.timestamp('cancelled_at').nullable()
      table.string('cancellation_reason').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['business_id', 'date'])
      table.index(['staff_id', 'date'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
