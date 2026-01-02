import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'withdrawal_requests'

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
        .integer('bank_account_id')
        .unsigned()
        .references('id')
        .inTable('business_bank_accounts')
        .onDelete('SET NULL')
        .nullable()
      table.decimal('amount', 12, 2).notNullable()
      table
        .enum('status', ['pending', 'processing', 'completed', 'failed', 'cancelled'])
        .notNullable()
        .defaultTo('pending')
      table.string('paystack_transfer_code', 255).nullable()
      table.string('paystack_reference', 255).nullable()
      table.text('failure_reason').nullable()
      table.timestamp('processed_at').nullable()
      table.integer('processed_by').unsigned().nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Index for quick lookups
      table.index(['business_id', 'status'])
      table.index(['paystack_reference'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

