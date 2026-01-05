import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'businesses'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('payment_provider').defaultTo('paystack').comment('paystack or stripe')
      table.string('stripe_account_id').nullable()
      table.string('stripe_account_status').nullable()
      table.text('stripe_onboarding_url').nullable()
      table.boolean('stripe_charges_enabled').defaultTo(false)
      table.boolean('stripe_payouts_enabled').defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('payment_provider')
      table.dropColumn('stripe_account_id')
      table.dropColumn('stripe_account_status')
      table.dropColumn('stripe_onboarding_url')
      table.dropColumn('stripe_charges_enabled')
      table.dropColumn('stripe_payouts_enabled')
    })
  }
}
