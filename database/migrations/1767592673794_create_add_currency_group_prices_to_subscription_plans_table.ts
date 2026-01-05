import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'subscription_plans'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add prices for different currency groups
      // African countries (NGN)
      table.integer('price_ngn').nullable().comment('Price in kobo for African countries')
      
      // International currencies
      table.integer('price_usd_group').nullable().comment('Price in cents for USD countries')
      table.integer('price_gbp').nullable().comment('Price in pence for GBP countries')
      table.integer('price_eur').nullable().comment('Price in cents for EUR countries')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('price_ngn')
      table.dropColumn('price_usd_group')
      table.dropColumn('price_gbp')
      table.dropColumn('price_eur')
    })
  }
}
