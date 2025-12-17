import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'time_offs'

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
      table
        .integer('user_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .nullable()
      table.string('title').nullable()
      table.timestamp('start_datetime').notNullable()
      table.timestamp('end_datetime').notNullable()
      table.boolean('is_all_day').notNullable().defaultTo(false)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
