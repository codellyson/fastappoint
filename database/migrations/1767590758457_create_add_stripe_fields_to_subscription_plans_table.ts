import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'subscription_plans'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('stripe_product_id').nullable()
      table.string('stripe_price_id').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('stripe_product_id')
      table.dropColumn('stripe_price_id')
    })
  }
}