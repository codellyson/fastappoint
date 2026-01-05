import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'subscriptions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('stripe_subscription_id').nullable().unique()
      table.string('stripe_customer_id').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('stripe_subscription_id')
      table.dropColumn('stripe_customer_id')
    })
  }
}