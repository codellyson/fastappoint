import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory'] as const),

  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  APP_URL: Env.schema.string.optional(),
  APP_DOMAIN: Env.schema.string.optional(),

  PAYSTACK_SECRET_KEY: Env.schema.string.optional(),
  PAYSTACK_PUBLIC_KEY: Env.schema.string.optional(),

  BREVO_API_KEY: Env.schema.string.optional(),
  FROM_EMAIL: Env.schema.string.optional(),
  FROM_NAME: Env.schema.string.optional(),

  TERMII_API_KEY: Env.schema.string.optional(),
  TERMII_SENDER_ID: Env.schema.string.optional(),

  REQUEST_TIMEOUT: Env.schema.number.optional(),

  R2_ENABLED: Env.schema.string.optional(),
  R2_ACCOUNT_ID: Env.schema.string.optional(),
  R2_ACCESS_KEY_ID: Env.schema.string.optional(),
  R2_SECRET_ACCESS_KEY: Env.schema.string.optional(),
  R2_BUCKET_NAME: Env.schema.string.optional(),
  R2_PUBLIC_URL: Env.schema.string.optional(),
})
