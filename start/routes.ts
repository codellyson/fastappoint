import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'

const AuthController = () => import('#controllers/auth-controller')
const OnboardingController = () => import('#controllers/onboarding-controller')
const DashboardController = () => import('#controllers/dashboard-controller')
const BookingController = () => import('#controllers/booking-controller')
const BookingsController = () => import('#controllers/bookings-controller')
const ServicesController = () => import('#controllers/services-controller')
const StaffController = () => import('#controllers/staff-controller')
const SettingsController = () => import('#controllers/settings-controller')
const TimeOffController = () => import('#controllers/time-off-controller')
const FeaturedController = () => import('#controllers/featured-controller')
const ThemeController = () => import('#controllers/theme-controller')
const WebhookController = () => import('#controllers/webhook-controller')
const SubscriptionsController = () => import('#controllers/subscriptions_controller')

const HomeController = () => import('#controllers/home-controller')
router.get('/', [HomeController, 'index']).as('home')

router
  .group(() => {
    router.get('/signup', [AuthController, 'showSignup']).as('auth.signup.show')
    router
      .post('/signup', [AuthController, 'signup'])
      .as('auth.signup')
      .use(middleware.rateLimit({ store: 'signup', maxAttempts: 5, decayMinutes: 15 }))
    router.get('/login', [AuthController, 'showLogin']).as('auth.login.show')
    router
      .post('/login', [AuthController, 'login'])
      .as('auth.login')
      .use(middleware.rateLimit({ store: 'login', maxAttempts: 5, decayMinutes: 15 }))
    router.get('/forgot-password', [AuthController, 'showForgotPassword']).as('auth.forgot.show')
    router
      .post('/forgot-password', [AuthController, 'forgotPassword'])
      .as('auth.forgot')
      .use(middleware.rateLimit({ store: 'forgot', maxAttempts: 3, decayMinutes: 60 }))
    router.get('/reset-password', [AuthController, 'showResetPassword']).as('auth.reset.show')
    router
      .post('/reset-password', [AuthController, 'resetPassword'])
      .as('auth.reset')
      .use(middleware.rateLimit({ store: 'reset', maxAttempts: 5, decayMinutes: 15 }))
  })
  .use(middleware.guest())

router.post('/logout', [AuthController, 'logout']).as('auth.logout').use(middleware.auth())

router
  .group(() => {
    router
      .get('/account/delete', [AuthController, 'showDeleteAccount'])
      .as('auth.account.delete.show')
    router.post('/account/delete', [AuthController, 'deleteAccount']).as('auth.account.delete')
  })
  .use(middleware.auth())

router
  .group(() => {
    router.get('/onboarding', [OnboardingController, 'show']).as('onboarding.show')
    router
      .post('/onboarding/details', [OnboardingController, 'updateDetails'])
      .as('onboarding.details')
    router
      .post('/onboarding/service', [OnboardingController, 'addService'])
      .as('onboarding.service.add')
    router
      .post('/onboarding/service/:id/delete', [OnboardingController, 'deleteService'])
      .as('onboarding.service.delete')
    router
      .post('/onboarding/availability', [OnboardingController, 'saveAvailability'])
      .as('onboarding.availability')
    router
      .post('/onboarding/complete', [OnboardingController, 'complete'])
      .as('onboarding.complete')

    router.get('/dashboard', [DashboardController, 'index']).as('dashboard')

    router.get('/bookings', [BookingsController, 'index']).as('bookings.index')
    router.get('/bookings/:id', [BookingsController, 'show']).as('bookings.show')
    router
      .post('/bookings/:id/complete', [BookingsController, 'markComplete'])
      .as('bookings.complete')
    router.post('/bookings/:id/cancel', [BookingsController, 'cancel']).as('bookings.cancel')

    router.get('/services', [ServicesController, 'index']).as('services.index')
    router.get('/services/new', [ServicesController, 'create']).as('services.create')
    router.post('/services', [ServicesController, 'store']).as('services.store')
    router.get('/services/:id/edit', [ServicesController, 'edit']).as('services.edit')
    router.post('/services/:id', [ServicesController, 'update']).as('services.update')
    router.post('/services/:id/toggle', [ServicesController, 'toggleActive']).as('services.toggle')
    router.post('/services/:id/delete', [ServicesController, 'destroy']).as('services.destroy')

    router.get('/staff', [StaffController, 'index']).as('staff.index')
    router.get('/staff/new', [StaffController, 'create']).as('staff.create')
    router.post('/staff', [StaffController, 'store']).as('staff.store')
    router.get('/staff/:id/edit', [StaffController, 'edit']).as('staff.edit')
    router.post('/staff/:id', [StaffController, 'update']).as('staff.update')
    router.post('/staff/:id/toggle', [StaffController, 'toggleActive']).as('staff.toggle')
    router.post('/staff/:id/delete', [StaffController, 'destroy']).as('staff.destroy')
    router
      .get('/staff/:id/availability', [StaffController, 'showAvailability'])
      .as('staff.availability')
    router
      .post('/staff/:id/availability', [StaffController, 'saveAvailability'])
      .as('staff.availability.save')

    router.get('/settings', [SettingsController, 'index']).as('settings.index')
    router.get('/settings/profile', [SettingsController, 'profile']).as('settings.profile')
    router
      .post('/settings/profile', [SettingsController, 'updateProfile'])
      .as('settings.profile.update')
    router
      .get('/settings/cancellation', [SettingsController, 'cancellation'])
      .as('settings.cancellation')
    router
      .post('/settings/cancellation', [SettingsController, 'updateCancellation'])
      .as('settings.cancellation.update')
    router.get('/settings/payments', [SettingsController, 'payments']).as('settings.payments')
    router
      .post('/settings/payments', [SettingsController, 'updatePayments'])
      .as('settings.payments.update')
    router
      .get('/settings/booking-page', [SettingsController, 'bookingPage'])
      .as('settings.booking-page')

    router.get('/settings/theme', [ThemeController, 'index']).as('settings.theme')
    router
      .get('/settings/theme/templates', [ThemeController, 'selectTemplate'])
      .as('settings.theme.templates')
    router
      .post('/settings/theme/templates', [ThemeController, 'applyTemplate'])
      .as('settings.theme.apply')
    router
      .get('/settings/theme/customize', [ThemeController, 'customize'])
      .as('settings.theme.customize')
    router
      .post('/settings/theme/customize', [ThemeController, 'updateCustomization'])
      .as('settings.theme.customize.update')
    router.get('/settings/theme/content', [ThemeController, 'content']).as('settings.theme.content')
    router
      .post('/settings/theme/content', [ThemeController, 'updateContent'])
      .as('settings.theme.content.update')
    router
      .get('/settings/theme/social', [ThemeController, 'socialLinks'])
      .as('settings.theme.social')
    router
      .post('/settings/theme/social', [ThemeController, 'updateSocialLinks'])
      .as('settings.theme.social.update')
    router.get('/settings/theme/preview', [ThemeController, 'preview']).as('settings.theme.preview')

    router.get('/time-off', [TimeOffController, 'index']).as('time-off.index')
    router.get('/time-off/new', [TimeOffController, 'create']).as('time-off.create')
    router.post('/time-off', [TimeOffController, 'store']).as('time-off.store')
    router.get('/time-off/:id/edit', [TimeOffController, 'edit']).as('time-off.edit')
    router.post('/time-off/:id', [TimeOffController, 'update']).as('time-off.update')
    router.post('/time-off/:id/delete', [TimeOffController, 'destroy']).as('time-off.destroy')

    router.get('/featured', [FeaturedController, 'index']).as('featured.index')
    router.get('/featured/purchase/:plan', [FeaturedController, 'purchase']).as('featured.purchase')
    router.post('/featured/initiate', [FeaturedController, 'initiate']).as('featured.initiate')
    router.get('/featured/:id/payment', [FeaturedController, 'payment']).as('featured.payment')
    router.get('/featured/:id/verify', [FeaturedController, 'verify']).as('featured.verify')
    router.get('/featured/:id/cancel', [FeaturedController, 'cancel']).as('featured.cancel')

    router.get('/subscriptions', [SubscriptionsController, 'index']).as('subscriptions.index')
    router
      .get('/subscriptions/select', [SubscriptionsController, 'select'])
      .as('subscriptions.select')
    router
      .get('/subscriptions/manage', [SubscriptionsController, 'manage'])
      .as('subscriptions.manage')
    router
      .post('/subscriptions/subscribe', [SubscriptionsController, 'subscribe'])
      .as('subscriptions.subscribe')
    router
      .get('/subscriptions/:planId/payment', [SubscriptionsController, 'payment'])
      .as('subscriptions.payment')
    router
      .get('/subscriptions/:planId/verify', [SubscriptionsController, 'verify'])
      .as('subscriptions.verify')
    router
      .post('/subscriptions/cancel', [SubscriptionsController, 'cancel'])
      .as('subscriptions.cancel')
    router
      .post('/subscriptions/resume', [SubscriptionsController, 'resume'])
      .as('subscriptions.resume')
    router
      .post('/subscriptions/change', [SubscriptionsController, 'change'])
      .as('subscriptions.change')
  })
  .use(middleware.auth())

router.get('/book/find', [BookingController, 'findBooking']).as('book.find')
router
  .post('/book/lookup', [BookingController, 'lookupBooking'])
  .as('book.lookup')
  .use(middleware.rateLimit({ store: 'lookup', maxAttempts: 10, decayMinutes: 5 }))

router
  .group(() => {
    router.get('/:slug', [BookingController, 'show']).as('book.show')
    router
      .get('/:slug/service/:serviceId/slots', [BookingController, 'getTimeSlots'])
      .as('book.slots')
      .use(middleware.rateLimit({ store: 'slots', maxAttempts: 60, decayMinutes: 1 }))
    router
      .post('/:slug/service/:serviceId', [BookingController, 'createBooking'])
      .as('book.create')
      .use(middleware.rateLimit({ store: 'booking', maxAttempts: 10, decayMinutes: 5 }))
    router
      .get('/:slug/booking/:bookingId/payment', [BookingController, 'showPayment'])
      .as('book.payment')
    router
      .get('/:slug/booking/:bookingId/verify', [BookingController, 'verifyPayment'])
      .as('book.verify')
    router
      .get('/:slug/booking/:bookingId/confirmation', [BookingController, 'confirmBooking'])
      .as('book.confirmation')
    router
      .get('/:slug/booking/:bookingId/manage', [BookingController, 'manageBooking'])
      .as('book.manage')
    router
      .post('/:slug/booking/:bookingId/cancel', [BookingController, 'cancelBooking'])
      .as('book.cancel')
      .use(middleware.rateLimit({ store: 'cancel', maxAttempts: 5, decayMinutes: 5 }))
    router
      .get('/:slug/booking/:bookingId/reschedule', [BookingController, 'showReschedule'])
      .as('book.reschedule.show')
    router
      .post('/:slug/booking/:bookingId/reschedule', [BookingController, 'rescheduleBooking'])
      .as('book.reschedule')
      .use(middleware.rateLimit({ store: 'reschedule', maxAttempts: 5, decayMinutes: 5 }))
  })
  .prefix('/book')

router.get('/api/featured', [FeaturedController, 'getActiveFeatured']).as('api.featured')

router.post('/webhooks/paystack', [WebhookController, 'paystack']).as('webhooks.paystack')
