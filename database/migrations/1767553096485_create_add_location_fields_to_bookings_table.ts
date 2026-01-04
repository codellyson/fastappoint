import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'bookings'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Location type selected for the booking (for flexible services)
      table.enum('location_type', ['business', 'client', 'virtual']).nullable()

      // Client address for client-location bookings
      table.string('client_address', 500).nullable()

      // Travel fee charged for this booking
      table.decimal('travel_fee', 10, 2).defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('location_type')
      table.dropColumn('client_address')
      table.dropColumn('travel_fee')
    })
  }
}
