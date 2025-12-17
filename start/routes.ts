import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'

const AuthController = () => import('#controllers/auth-controller')
const OnboardingController = () => import('#controllers/onboarding-controller')
const DashboardController = () => import('#controllers/dashboard-controller')
const BookingController = () => import('#controllers/booking-controller')
const BookingsController = () => import('#controllers/bookings-controller')
const ServicesController = () => import('#controllers/services-controller')

router.get('/', async ({ view }) => view.render('pages/landing')).as('home')

router
  .group(() => {
    router.get('/signup', [AuthController, 'showSignup']).as('auth.signup.show')
    router.post('/signup', [AuthController, 'signup']).as('auth.signup')
    router.get('/login', [AuthController, 'showLogin']).as('auth.login.show')
    router.post('/login', [AuthController, 'login']).as('auth.login')
    router.get('/forgot-password', [AuthController, 'showForgotPassword']).as('auth.forgot.show')
    router.post('/forgot-password', [AuthController, 'forgotPassword']).as('auth.forgot')
  })
  .use(middleware.guest())

router.post('/logout', [AuthController, 'logout']).as('auth.logout').use(middleware.auth())

router
  .group(() => {
    router.get('/onboarding', [OnboardingController, 'show']).as('onboarding.show')
    router.post('/onboarding/details', [OnboardingController, 'updateDetails']).as('onboarding.details')
    router.post('/onboarding/service', [OnboardingController, 'addService']).as('onboarding.service.add')
    router.post('/onboarding/service/:id/delete', [OnboardingController, 'deleteService']).as('onboarding.service.delete')
    router.post('/onboarding/availability', [OnboardingController, 'saveAvailability']).as('onboarding.availability')
    router.post('/onboarding/complete', [OnboardingController, 'complete']).as('onboarding.complete')

    router.get('/dashboard', [DashboardController, 'index']).as('dashboard')

    router.get('/bookings', [BookingsController, 'index']).as('bookings.index')
    router.get('/bookings/:id', [BookingsController, 'show']).as('bookings.show')
    router.post('/bookings/:id/complete', [BookingsController, 'markComplete']).as('bookings.complete')
    router.post('/bookings/:id/cancel', [BookingsController, 'cancel']).as('bookings.cancel')

    router.get('/services', [ServicesController, 'index']).as('services.index')
    router.get('/services/new', [ServicesController, 'create']).as('services.create')
    router.post('/services', [ServicesController, 'store']).as('services.store')
    router.get('/services/:id/edit', [ServicesController, 'edit']).as('services.edit')
    router.post('/services/:id', [ServicesController, 'update']).as('services.update')
    router.post('/services/:id/toggle', [ServicesController, 'toggleActive']).as('services.toggle')
    router.post('/services/:id/delete', [ServicesController, 'destroy']).as('services.destroy')
  })
  .use(middleware.auth())

router
  .group(() => {
    router.get('/:slug', [BookingController, 'show']).as('book.show')
    router.get('/:slug/service/:serviceId/slots', [BookingController, 'getTimeSlots']).as('book.slots')
    router.post('/:slug/service/:serviceId', [BookingController, 'createBooking']).as('book.create')
    router.get('/:slug/booking/:bookingId/payment', [BookingController, 'showPayment']).as('book.payment')
    router.get('/:slug/booking/:bookingId/verify', [BookingController, 'verifyPayment']).as('book.verify')
    router.get('/:slug/booking/:bookingId/confirmation', [BookingController, 'confirmBooking']).as('book.confirmation')
  })
  .prefix('/book')
