import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('business_id')
        .unsigned()
        .references('id')
        .inTable('businesses')
        .onDelete('CASCADE')
        .nullable()
      table.string('full_name').notNullable()
      table.string('email').notNullable().unique()
      table.string('phone').nullable()
      table.string('password').notNullable()
      table.string('avatar').nullable()
      table.enum('role', ['owner', 'admin', 'staff']).notNullable().defaultTo('staff')
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
