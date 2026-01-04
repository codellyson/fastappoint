import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'businesses'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('reminder_24h_enabled').defaultTo(true)
      table.boolean('reminder_1h_enabled').defaultTo(true)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('reminder_24h_enabled')
      table.dropColumn('reminder_1h_enabled')
    })
  }
}
