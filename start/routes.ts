import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'

const AuthController = () => import('#controllers/auth_controller')
const OnboardingController = () => import('#controllers/onboarding_controller')
const DashboardController = () => import('#controllers/dashboard_controller')
const BookingController = () => import('#controllers/booking_controller')
const BookingsController = () => import('#controllers/bookings_controller')
const ServicesController = () => import('#controllers/services_controller')
const StaffController = () => import('#controllers/staff_controller')
const SettingsController = () => import('#controllers/settings_controller')
const TimeOffController = () => import('#controllers/time_off_controller')
const FeaturedController = () => import('#controllers/featured_controller')
const ThemeController = () => import('#controllers/theme_controller')
const WebhookController = () => import('#controllers/webhook_controller')
const PortfoliosController = () => import('#controllers/portfolios_controller')
const PackagesController = () => import('#controllers/packages_controller')
const SubscriptionsController = () => import('#controllers/subscriptions_controller')
const WithdrawalsController = () => import('#controllers/withdrawals_controller')

const GoogleCalendarController = () => import('#controllers/google_calendar_controller')
const CustomerAuthsController = () => import('#controllers/customer_auths_controller')
const BlogController = () => import('#controllers/blog_controller')
const HomeController = () => import('#controllers/home_controller')
router.get('/', [HomeController, 'index']).as('home')
router.get('/pricing', [HomeController, 'pricing']).as('pricing')

// Blog routes
router.get('/blog', [BlogController, 'index']).as('blog.index')
router.get('/blog/:slug', [BlogController, 'show']).as('blog.show')

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
  })
  .use(middleware.auth())

router
  .group(() => {
    router.get('/dashboard', [DashboardController, 'index']).as('dashboard')

    router.get('/bookings', [BookingsController, 'index']).as('bookings.index')
    router.get('/bookings/:id', [BookingsController, 'show']).as('bookings.show')
    router
      .post('/bookings/:id/complete', [BookingsController, 'markComplete'])
      .as('bookings.complete')
    router.post('/bookings/:id/cancel', [BookingsController, 'cancel']).as('bookings.cancel')
    router.post('/bookings/:id/refund', [BookingsController, 'refund']).as('bookings.refund')

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
    router
      .get('/settings/notifications', [SettingsController, 'notifications'])
      .as('settings.notifications')
    router
      .post('/settings/notifications', [SettingsController, 'updateNotifications'])
      .as('settings.notifications.update')

    // Withdrawals routes
    router
      .get('/settings/withdrawals', [WithdrawalsController, 'index'])
      .as('settings.withdrawals.index')
    router
      .get('/settings/withdrawals/bank-accounts', [WithdrawalsController, 'bankAccounts'])
      .as('settings.withdrawals.bank-accounts')
    router
      .get('/settings/withdrawals/bank-accounts/add', [WithdrawalsController, 'addBankAccountForm'])
      .as('settings.withdrawals.bank-accounts.add')
    router
      .post('/settings/withdrawals/bank-accounts', [WithdrawalsController, 'storeBankAccount'])
      .as('settings.withdrawals.bank-accounts.store')
    router
      .post('/settings/withdrawals/bank-accounts/:id/primary', [
        WithdrawalsController,
        'setPrimaryBankAccount',
      ])
      .as('settings.withdrawals.bank-accounts.primary')
    router
      .post('/settings/withdrawals/bank-accounts/:id/delete', [
        WithdrawalsController,
        'deleteBankAccount',
      ])
      .as('settings.withdrawals.bank-accounts.delete')
    router
      .post('/settings/withdrawals/bank-accounts/verify', [
        WithdrawalsController,
        'verifyBankAccount',
      ])
      .as('settings.withdrawals.bank-accounts.verify')
    router
      .post('/settings/withdrawals/request', [WithdrawalsController, 'requestWithdrawal'])
      .as('settings.withdrawals.request')
    router
      .post('/settings/withdrawals/:id/cancel', [WithdrawalsController, 'cancelWithdrawal'])
      .as('settings.withdrawals.cancel')
    router
      .get('/settings/withdrawals/history', [WithdrawalsController, 'history'])
      .as('settings.withdrawals.history')
    router.get('/api/banks', [WithdrawalsController, 'getBanks']).as('api.banks')

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

    // Google Calendar integration
    router
      .get('/settings/integrations/google', [GoogleCalendarController, 'show'])
      .as('settings.google-calendar')
    router
      .post('/settings/integrations/google/connect', [GoogleCalendarController, 'connect'])
      .as('settings.google-calendar.connect')
    router
      .get('/settings/integrations/google/callback', [GoogleCalendarController, 'callback'])
      .as('settings.google-calendar.callback')
    router
      .post('/settings/integrations/google/calendar', [GoogleCalendarController, 'updateCalendar'])
      .as('settings.google-calendar.update')
    router
      .post('/settings/integrations/google/disconnect', [GoogleCalendarController, 'disconnect'])
      .as('settings.google-calendar.disconnect')

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

    router.get('/portfolio', [PortfoliosController, 'index']).as('portfolio.index')
    router.get('/portfolio/new', [PortfoliosController, 'create']).as('portfolio.create')
    router.post('/portfolio', [PortfoliosController, 'store']).as('portfolio.store')
    router.get('/portfolio/:id/edit', [PortfoliosController, 'edit']).as('portfolio.edit')
    router.post('/portfolio/:id', [PortfoliosController, 'update']).as('portfolio.update')
    router
      .post('/portfolio/:id/toggle', [PortfoliosController, 'toggleActive'])
      .as('portfolio.toggle')
    router
      .post('/portfolio/:id/featured', [PortfoliosController, 'toggleFeatured'])
      .as('portfolio.featured')
    router.post('/portfolio/:id/delete', [PortfoliosController, 'destroy']).as('portfolio.destroy')
    router.post('/portfolio/reorder', [PortfoliosController, 'reorder']).as('portfolio.reorder')

    router.get('/packages', [PackagesController, 'index']).as('packages.index')
    router.get('/packages/new', [PackagesController, 'create']).as('packages.create')
    router.post('/packages', [PackagesController, 'store']).as('packages.store')
    router.get('/packages/:id/edit', [PackagesController, 'edit']).as('packages.edit')
    router.post('/packages/:id', [PackagesController, 'update']).as('packages.update')
    router.post('/packages/:id/toggle', [PackagesController, 'toggleActive']).as('packages.toggle')
    router.post('/packages/:id/delete', [PackagesController, 'destroy']).as('packages.destroy')
    router.post('/packages/reorder', [PackagesController, 'reorder']).as('packages.reorder')
  })
  .use([middleware.auth(), middleware.subscription()])

router
  .group(() => {
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
      .post('/subscriptions/:planId/create-payment-intent', [
        SubscriptionsController,
        'createPaymentIntent',
      ])
      .as('subscriptions.createPaymentIntent')
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
    router.get('/:slug/embed', [BookingController, 'embed']).as('book.embed')
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
      .post('/:slug/booking/:bookingId/create-payment-intent', [
        BookingController,
        'createPaymentIntent',
      ])
      .as('book.createPaymentIntent')
    router
      .get('/:slug/booking/:bookingId/verify', [BookingController, 'verifyPayment'])
      .as('book.verify')
    router
      .get('/:slug/booking/:bookingId/confirmation', [BookingController, 'confirmBooking'])
      .as('book.confirmation')
    router
      .get('/:slug/booking/:bookingId/receipt', [BookingController, 'downloadReceipt'])
      .as('book.receipt')
    router
      .get('/:slug/booking/:bookingId/payment-status', [BookingController, 'getPaymentStatus'])
      .as('book.payment-status')
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
router.post('/webhooks/polar', [WebhookController, 'polar']).as('webhooks.polar')
router
  .post('/webhooks/flutterwave', [WebhookController, 'flutterwave'])
  .as('webhooks.flutterwave')

// Customer portal routes
router
  .group(() => {
    router.get('/login', [CustomerAuthsController, 'showLogin']).as('customer.login')
    router.post('/login', [CustomerAuthsController, 'login']).as('customer.login.post')
    router.get('/register', [CustomerAuthsController, 'showRegister']).as('customer.register')
    router.post('/register', [CustomerAuthsController, 'register']).as('customer.register.post')
    router.post('/logout', [CustomerAuthsController, 'logout']).as('customer.logout')
    router.get('/dashboard', [CustomerAuthsController, 'dashboard']).as('customer.dashboard')
    router.get('/bookings', [CustomerAuthsController, 'bookings']).as('customer.bookings')
    router.get('/profile', [CustomerAuthsController, 'profile']).as('customer.profile')
    router
      .post('/profile', [CustomerAuthsController, 'updateProfile'])
      .as('customer.profile.update')
    router
      .get('/create-password/:token', [CustomerAuthsController, 'showCreatePassword'])
      .as('customer.create-password')
    router
      .post('/create-password/:token', [CustomerAuthsController, 'createPassword'])
      .as('customer.create-password.post')
  })
  .prefix('/my')
