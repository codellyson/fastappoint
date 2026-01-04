import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'portfolio_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('business_id').unsigned().references('id').inTable('businesses').onDelete('CASCADE')
      table.string('title', 100).notNullable()
      table.text('description').nullable()
      table.string('image').notNullable()
      table.integer('service_id').unsigned().references('id').inTable('services').onDelete('SET NULL').nullable()
      table.integer('sort_order').defaultTo(0)
      table.boolean('is_featured').defaultTo(false)
      table.boolean('is_active').defaultTo(true)
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
