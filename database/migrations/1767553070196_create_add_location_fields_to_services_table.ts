import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'services'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Location type: business (at business location), client (travel to client), virtual (online), flexible (customer chooses)
      table
        .enum('location_type', ['business', 'client', 'virtual', 'flexible'])
        .defaultTo('business')
        .notNullable()

      // Travel fee for client location services
      table.decimal('travel_fee', 10, 2).defaultTo(0)

      // Travel radius in kilometers
      table.integer('travel_radius_km').nullable()

      // Virtual meeting URL for virtual services
      table.string('virtual_meeting_url', 500).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('location_type')
      table.dropColumn('travel_fee')
      table.dropColumn('travel_radius_km')
      table.dropColumn('virtual_meeting_url')
    })
  }
}
