import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'subscription_plans'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('currency').defaultTo('NGN').notNullable()
      table.integer('price_usd').nullable().comment('Price in cents for USD')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('currency')
      table.dropColumn('price_usd')
    })
  }
}