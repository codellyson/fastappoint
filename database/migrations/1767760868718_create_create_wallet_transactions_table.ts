import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'wallet_transactions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('wallet_id')
        .unsigned()
        .references('id')
        .inTable('wallets')
        .onDelete('CASCADE')
        .notNullable()
      table
        .integer('business_id')
        .unsigned()
        .references('id')
        .inTable('businesses')
        .onDelete('CASCADE')
        .notNullable()
      table
        .integer('transaction_id')
        .unsigned()
        .references('id')
        .inTable('transactions')
        .onDelete('SET NULL')
        .nullable()
      table
        .integer('withdrawal_request_id')
        .unsigned()
        .references('id')
        .inTable('withdrawal_requests')
        .onDelete('SET NULL')
        .nullable()
      table.enum('type', ['credit', 'debit', 'hold', 'release', 'refund']).notNullable()
      table.decimal('amount', 15, 2).notNullable()
      table.decimal('balance_before', 15, 2).notNullable()
      table.decimal('balance_after', 15, 2).notNullable()
      table.string('currency', 3).notNullable()
      table.string('reference').nullable()
      table.text('description').nullable()
      table.json('metadata').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['wallet_id'])
      table.index(['business_id'])
      table.index(['transaction_id'])
      table.index(['withdrawal_request_id'])
      table.index(['type'])
      table.index(['created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
