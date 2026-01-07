import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'wallets'

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
      table.string('currency', 3).notNullable().defaultTo('NGN')
      table.decimal('balance', 15, 2).notNullable().defaultTo(0)
      table.decimal('available_balance', 15, 2).notNullable().defaultTo(0)
      table.decimal('held_balance', 15, 2).notNullable().defaultTo(0)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['business_id', 'currency'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
