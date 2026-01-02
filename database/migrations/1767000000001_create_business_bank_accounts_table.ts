import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'business_bank_accounts'

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
      table.string('account_name', 255).notNullable()
      table.string('account_number', 20).notNullable()
      table.string('bank_code', 10).notNullable()
      table.string('bank_name', 255).notNullable()
      table.string('paystack_recipient_code', 255).nullable()
      table.boolean('is_primary').defaultTo(false)
      table.boolean('is_verified').defaultTo(false)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Ensure uniqueness of account per business
      table.unique(['business_id', 'account_number', 'bank_code'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

