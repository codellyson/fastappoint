/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'

router.get('/', async ({ view }) => view.render('pages/landing'))
router.on('/signup').render('pages/auth/signup')
router.on('/login').render('pages/auth/login')
router.on('/forgot-password').render('pages/auth/forgot-password')
router.on('/verify-otp').render('pages/auth/otp-verification')
router.on('/kyc/verify').render('pages/kyc-verification')
router.on('/dashboard').render('pages/dashboard')
router.on('/fund-wallet').render('pages/fund-wallet')
router.on('/cards/:id').render('pages/card-detail')
router.on('/transactions').render('pages/transactions')
