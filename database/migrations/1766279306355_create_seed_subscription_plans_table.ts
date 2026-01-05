import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'subscription_plans'

  async up() {
    // Insert default subscription plans (no free plan - using 5-day trial instead)
    await this.db.table('subscription_plans').multiInsert([
      {
        name: 'starter',
        display_name: 'Starter',
        price: 500000, // ₦5,000 (in kobo) - Legacy field
        price_usd: 3000, // $30.00 (in cents) - Legacy field
        currency: 'NGN', // Legacy field
        price_ngn: 500000, // ₦5,000 (in kobo) for African countries
        price_usd_group: 3000, // $30.00 (in cents) for USD countries
        price_gbp: 2400, // £24.00 (in pence) for GBP countries
        price_eur: 2800, // €28.00 (in cents) for EUR countries
        interval: 'monthly',
        max_staff: 3,
        max_bookings_per_month: null, // unlimited
        features: JSON.stringify([
          'basic_booking_page',
          'email_notifications',
          'unlimited_bookings',
          'support',
        ]),
        description: 'For growing businesses',
        is_active: true,
        sort_order: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: 'pro',
        display_name: 'Pro',
        price: 1000000, // ₦10,000 (in kobo) - Legacy field
        price_usd: 6000, // $60.00 (in cents) - Legacy field
        currency: 'NGN', // Legacy field
        price_ngn: 1000000, // ₦10,000 (in kobo) for African countries
        price_usd_group: 6000, // $60.00 (in cents) for USD countries
        price_gbp: 4800, // £48.00 (in pence) for GBP countries
        price_eur: 5600, // €56.00 (in cents) for EUR countries
        interval: 'monthly',
        max_staff: 10,
        max_bookings_per_month: null, // unlimited
        features: JSON.stringify([
          'basic_booking_page',
          'email_notifications',
          'sms_notifications',
          'unlimited_bookings',
          'analytics',
          'custom_domain',
          'support',
        ]),
        description: 'For established businesses',
        is_active: true,
        sort_order: 2,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: 'business',
        display_name: 'Business',
        price: 2000000, // ₦20,000 (in kobo) - Legacy field
        price_usd: 12000, // $120.00 (in cents) - Legacy field
        currency: 'NGN', // Legacy field
        price_ngn: 2000000, // ₦20,000 (in kobo) for African countries
        price_usd_group: 12000, // $120.00 (in cents) for USD countries
        price_gbp: 9600, // £96.00 (in pence) for GBP countries
        price_eur: 11200, // €112.00 (in cents) for EUR countries
        interval: 'monthly',
        max_staff: null, // unlimited
        max_bookings_per_month: null, // unlimited
        features: JSON.stringify([
          'basic_booking_page',
          'email_notifications',
          'sms_notifications',
          'unlimited_bookings',
          'unlimited_staff',
          'analytics',
          'custom_domain',
          'api_access',
          'priority_support',
        ]),
        description: 'For large businesses',
        is_active: true,
        sort_order: 3,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ])
  }

  async down() {
    await this.db
      .from('subscription_plans')
      .whereIn('name', ['starter', 'pro', 'business'])
      .delete()
  }
}
