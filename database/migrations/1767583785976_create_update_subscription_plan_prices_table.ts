import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'subscription_plans'

  async up() {
    // Update prices only - skip features update to avoid JSON parsing issues
    await this.db
      .from('subscription_plans')
      .where('name', 'pro')
      .update({ price: 1000000, updated_at: new Date() })

    await this.db
      .from('subscription_plans')
      .where('name', 'business')
      .update({ price: 2000000, updated_at: new Date() })

    // Skip features update - they should already be set correctly in seed migration
    // If features need updating, do it in a separate migration after fixing data format
  }

  async down() {
    await this.db
      .from('subscription_plans')
      .where('name', 'pro')
      .update({ price: 1500000, updated_at: new Date() })

    await this.db
      .from('subscription_plans')
      .where('name', 'business')
      .update({ price: 4000000, updated_at: new Date() })
  }
}
