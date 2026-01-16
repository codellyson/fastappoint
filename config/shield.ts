import { defineConfig } from '@adonisjs/shield'

const shieldConfig = defineConfig({
  csp: {
    enabled: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        'https://js.paystack.co',
        'https://js.stripe.com',
        'https://cdn.jsdelivr.net',
        'https://cdn.tailwindcss.com',
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com',
        'https://fonts.bunny.net',
        'https://cdn.tailwindcss.com',
        'https://cdn.jsdelivr.net',
      ],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://fonts.bunny.net', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc: [
        "'self'",
        'https://api.paystack.co',
        'https://*.paystack.co',
        'https://api.stripe.com',
        'https://*.stripe.com',
        'https://cdn.jsdelivr.net',
        'ws://localhost:*',
        'http://localhost:*',
      ],
      frameSrc: [
        "'self'",
        'https://checkout.paystack.com',
        'https://js.stripe.com',
        'https://hooks.stripe.com',
      ],
      frameAncestors: ["'none'"],
      formAction: ["'self'", 'https://accounts.google.com'],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
    },
    reportOnly: false,
  },

  csrf: {
    enabled: true,
    exceptRoutes: [
      '/api/*',
      '/webhooks/*',
      '/reset-password',
      '/book/*/embed',
      '/book/*/service/*/slots',
      '/subscriptions/*/verify',
      '/api/push/subscribe',
      '/api/push/unsubscribe',
      '/api/push/test',
      '/webhooks/flutterwave',
    ],
    enableXsrfCookie: false,
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  },

  xFrame: {
    enabled: true,
    action: 'DENY',
  },

  hsts: {
    enabled: true,
    maxAge: '180 days',
    includeSubDomains: true,
    preload: true,
  },

  contentTypeSniffing: {
    enabled: true,
  },
})

export default shieldConfig
