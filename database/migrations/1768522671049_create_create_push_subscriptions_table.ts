import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'push_subscriptions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.string('endpoint', 500).notNullable()
      table.text('keys').notNullable() // JSON string of p256dh and auth keys
      table.string('device_name', 100).nullable()
      table.string('user_agent', 500).nullable()
      table.boolean('is_active').defaultTo(true)

      table.timestamp('created_at')
      table.timestamp('updated_at')

      // Index for faster lookups
      table.index(['user_id', 'is_active'])
      // Unique constraint on endpoint to prevent duplicates
      table.unique(['endpoint'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}