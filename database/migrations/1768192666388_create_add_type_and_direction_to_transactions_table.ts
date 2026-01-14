import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transactions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add type column to distinguish payment, withdrawal, refund, etc.
      table
        .enum('type', ['payment', 'withdrawal', 'refund', 'platform_fee'])
        .defaultTo('payment')
        .notNullable()
        .after('status')

      // Add direction column for credit (money in) vs debit (money out)
      table.enum('direction', ['credit', 'debit']).defaultTo('credit').notNullable().after('type')

      // Add withdrawalRequestId to link withdrawals to withdrawal_requests
      table.integer('withdrawal_request_id').unsigned().nullable().after('booking_id')

      // Add foreign key constraint
      table
        .foreign('withdrawal_request_id')
        .references('id')
        .inTable('withdrawal_requests')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['withdrawal_request_id'])
      table.dropColumn('withdrawal_request_id')
      table.dropColumn('direction')
      table.dropColumn('type')
    })
  }
}