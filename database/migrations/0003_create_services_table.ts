import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'services'

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
      table.string('name').notNullable()
      table.text('description').nullable()
      table.integer('duration_minutes').notNullable().defaultTo(60)
      table.decimal('price', 12, 2).notNullable()
      table.string('image').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.integer('sort_order').notNullable().defaultTo(0)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
