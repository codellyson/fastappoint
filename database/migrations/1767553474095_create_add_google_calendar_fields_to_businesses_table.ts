import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'businesses'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Google Calendar integration
      table.boolean('google_calendar_enabled').defaultTo(false)
      table.text('google_access_token').nullable()
      table.text('google_refresh_token').nullable()
      table.timestamp('google_token_expires_at').nullable()
      table.string('google_calendar_id', 255).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('google_calendar_enabled')
      table.dropColumn('google_access_token')
      table.dropColumn('google_refresh_token')
      table.dropColumn('google_token_expires_at')
      table.dropColumn('google_calendar_id')
    })
  }
}
