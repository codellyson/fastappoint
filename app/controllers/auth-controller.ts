import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Business from '#models/business'
import { signupValidator, loginValidator } from '#validators/auth-validator'
import string from '@adonisjs/core/helpers/string'
import { errors } from '@vinejs/vine'

export default class AuthController {
  async showSignup({ view }: HttpContext) {
    return view.render('pages/auth/signup')
  }

  async signup({ request, response, auth, session }: HttpContext) {
    try {
      const data = await request.validateUsing(signupValidator)

      const existingUser = await User.findBy('email', data.email)
      if (existingUser) {
        session.flash('error', 'An account with this email already exists')
        return response.redirect().back()
      }

      let slug = string.slug(data.businessName, { lower: true })
      const existingBusiness = await Business.findBy('slug', slug)
      if (existingBusiness) {
        slug = `${slug}-${Date.now().toString(36)}`
      }

      const business = await Business.create({
        name: data.businessName,
        slug,
        email: data.email,
        phone: data.phone || null,
        category: data.category,
        isOnboarded: false,
      })

      const user = await User.create({
        businessId: business.id,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone || null,
        password: data.password,
        role: 'owner',
        isActive: true,
      })

      await auth.use('web').login(user)

      session.flash('success', "Welcome! Let's set up your booking page.")
      return response.redirect().toRoute('onboarding.show')
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        const messages = error.messages.map((e: { message: string }) => e.message).join(', ')
        session.flash('error', `Validation failed: ${messages}`)
        session.flashAll()
        return response.redirect().back()
      }
      console.error('[AUTH] Signup error:', error)
      session.flash('error', 'An unexpected error occurred. Please try again.')
      return response.redirect().back()
    }
  }

  async showLogin({ view }: HttpContext) {
    return view.render('pages/auth/login')
  }

  async login({ request, response, auth, session }: HttpContext) {
    try {
      const { email, password } = await request.validateUsing(loginValidator)

      const user = await User.verifyCredentials(email, password)
      await auth.use('web').login(user)

      if (user.businessId) {
        const business = await Business.find(user.businessId)
        if (business && !business.isOnboarded) {
          return response.redirect().toRoute('onboarding.show')
        }
      }

      return response.redirect().toRoute('dashboard')
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        session.flash('error', 'Please enter a valid email and password')
        return response.redirect().back()
      }
      session.flash('error', 'Invalid email or password')
      return response.redirect().back()
    }
  }

  async logout({ response, auth, session }: HttpContext) {
    await auth.use('web').logout()
    session.flash('success', 'You have been logged out')
    return response.redirect().toRoute('auth.login.show')
  }

  async showForgotPassword({ view }: HttpContext) {
    return view.render('pages/auth/forgot-password')
  }

  async forgotPassword({ request, response, session }: HttpContext) {
    const email = request.input('email')
    const user = await User.findBy('email', email)

    if (user) {
      console.log(`[AUTH] Password reset requested for: ${email}`)
    }

    session.flash(
      'success',
      'If an account exists with this email, you will receive a password reset link shortly.'
    )
    return response.redirect().back()
  }
}
