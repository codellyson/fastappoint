import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'businesses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('slug').notNullable().unique()
      table.string('name').notNullable()
      table.string('email').notNullable().unique()
      table.string('phone').nullable()
      table.string('logo').nullable()
      table.text('description').nullable()
      table.string('category').notNullable().defaultTo('other')
      table.string('currency').notNullable().defaultTo('NGN')
      table.string('timezone').notNullable().defaultTo('Africa/Lagos')
      table.text('cancellation_policy').nullable()
      table.integer('cancellation_hours').notNullable().defaultTo(24)
      table.boolean('allow_installments').notNullable().defaultTo(false)
      table.string('subscription_tier').notNullable().defaultTo('free')
      table.string('subscription_status').notNullable().defaultTo('active')
      table.timestamp('subscription_ends_at').nullable()
      table.string('paystack_subaccount_code').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.boolean('is_onboarded').notNullable().defaultTo(false)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
