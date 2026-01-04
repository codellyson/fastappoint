import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'service_packages'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('business_id')
        .unsigned()
        .references('id')
        .inTable('businesses')
        .onDelete('CASCADE')
      table.string('name', 255).notNullable()
      table.text('description').nullable()
      table.string('image').nullable()
      table.specificType('service_ids', 'integer[]').notNullable()
      table.decimal('package_price', 10, 2).notNullable()
      table.decimal('original_price', 10, 2).notNullable() // Sum of individual service prices
      table.decimal('discount_amount', 10, 2).defaultTo(0)
      table.integer('duration_minutes').notNullable()
      table.boolean('is_active').defaultTo(true)
      table.integer('sort_order').defaultTo(0)

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
