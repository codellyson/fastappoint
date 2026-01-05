import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'subscription_plans'

  async up() {
    // Update existing plans with currency group prices
    // If currency group prices are not set, populate them from existing price fields

    // Starter plan
    const starterPlan = await this.db.from('subscription_plans').where('name', 'starter').first()
    if (starterPlan && (!starterPlan.price_ngn || !starterPlan.price_usd_group)) {
      await this.db
        .from('subscription_plans')
        .where('name', 'starter')
        .update({
          price_ngn: starterPlan.price_ngn || starterPlan.price || 500000, // ₦5,000
          price_usd_group: starterPlan.price_usd_group || starterPlan.price_usd || 3000, // $30.00
          price_gbp: starterPlan.price_gbp || 2400, // £24.00 (approximate conversion)
          price_eur: starterPlan.price_eur || 2800, // €28.00 (approximate conversion)
          updated_at: new Date(),
        })
    }

    // Pro plan
    const proPlan = await this.db.from('subscription_plans').where('name', 'pro').first()
    if (proPlan && (!proPlan.price_ngn || !proPlan.price_usd_group)) {
      await this.db
        .from('subscription_plans')
        .where('name', 'pro')
        .update({
          price_ngn: proPlan.price_ngn || proPlan.price || 1000000, // ₦10,000
          price_usd_group: proPlan.price_usd_group || proPlan.price_usd || 6000, // $60.00
          price_gbp: proPlan.price_gbp || 4800, // £48.00 (approximate conversion)
          price_eur: proPlan.price_eur || 5600, // €56.00 (approximate conversion)
          updated_at: new Date(),
        })
    }

    // Business plan
    const businessPlan = await this.db.from('subscription_plans').where('name', 'business').first()
    if (businessPlan && (!businessPlan.price_ngn || !businessPlan.price_usd_group)) {
      await this.db
        .from('subscription_plans')
        .where('name', 'business')
        .update({
          price_ngn: businessPlan.price_ngn || businessPlan.price || 2000000, // ₦20,000
          price_usd_group: businessPlan.price_usd_group || businessPlan.price_usd || 12000, // $120.00
          price_gbp: businessPlan.price_gbp || 9600, // £96.00 (approximate conversion)
          price_eur: businessPlan.price_eur || 11200, // €112.00 (approximate conversion)
          updated_at: new Date(),
        })
    }
  }

  async down() {
    // Reset currency group prices to null
    await this.db
      .from('subscription_plans')
      .whereIn('name', ['starter', 'pro', 'business'])
      .update({
        price_ngn: null,
        price_usd_group: null,
        price_gbp: null,
        price_eur: null,
        updated_at: new Date(),
      })
  }
}
