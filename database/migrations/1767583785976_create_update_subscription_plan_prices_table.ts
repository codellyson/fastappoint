import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'subscription_plans'

  async up() {
    await this.db
      .from('subscription_plans')
      .where('name', 'pro')
      .update({ price: 1000000, updated_at: new Date() })

    await this.db
      .from('subscription_plans')
      .where('name', 'business')
      .update({ price: 2000000, updated_at: new Date() })

    const starterPlan = await this.db.from('subscription_plans').where('name', 'starter').first()
    if (starterPlan) {
      const features = JSON.parse(starterPlan.features || '[]')
      if (!features.includes('support')) {
        features.push('support')
        await this.db
          .from('subscription_plans')
          .where('name', 'starter')
          .update({ features: JSON.stringify(features), updated_at: new Date() })
      }
    }

    const proPlan = await this.db.from('subscription_plans').where('name', 'pro').first()
    if (proPlan) {
      const features = JSON.parse(proPlan.features || '[]')
      if (!features.includes('support')) {
        features.push('support')
        await this.db
          .from('subscription_plans')
          .where('name', 'pro')
          .update({ features: JSON.stringify(features), updated_at: new Date() })
      }
    }
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
