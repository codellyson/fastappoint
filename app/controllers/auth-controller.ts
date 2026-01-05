import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Business from '#models/business'
import PasswordResetToken from '#models/password-reset-token'
import { signupValidator, loginValidator, resetPasswordValidator } from '#validators/auth-validator'
import string from '@adonisjs/core/helpers/string'
import { errors } from '@vinejs/vine'
import { DateTime } from 'luxon'
import { randomBytes } from 'node:crypto'
import emailService from '#services/email-service'
import subscriptionService from '../services/subscription_service.js'
import env from '#start/env'

export default class AuthController {
  async showSignup({ view }: HttpContext) {
    return view.render('pages/auth/signup')
  }

  async signup({ request, response, auth, session }: HttpContext) {
    try {
      const data = await request.validateUsing(signupValidator)

      // Note: We let the database handle duplicate checks via unique constraints
      // This avoids false positives from query matching issues

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

      // Create 5-day free trial
      await subscriptionService.createTrial(business)

      // Send welcome email (non-blocking - don't fail signup if email fails)
      try {
        const appUrl = env.get('APP_URL', 'http://localhost:3333')
        const dashboardUrl = `${appUrl}/dashboard`
        const emailResult = await emailService.sendWelcomeEmail({
          email: user.email,
          name: user.fullName,
          businessName: business.name,
          dashboardUrl,
        })

        if (!emailResult.success) {
          if ('error' in emailResult) {
            console.error('[AUTH] Welcome email failed:', emailResult.error)
            console.error('[AUTH] Full error details:', JSON.stringify(emailResult.error, null, 2))
          }
        } else if ('mock' in emailResult && emailResult.mock) {
          console.log('[AUTH] Welcome email mocked (BREVO_API_KEY not configured)')
        } else {
          console.log('[AUTH] Welcome email sent successfully to:', user.email)
          if (
            'data' in emailResult &&
            emailResult.data &&
            typeof emailResult.data === 'object' &&
            'messageId' in emailResult.data
          ) {
            console.log('[AUTH] Email message ID from Brevo:', emailResult.data.messageId)
          }
        }
      } catch (emailError) {
        console.error('[AUTH] Error sending welcome email:', emailError)
      }

      session.flash(
        'success',
        "Welcome! You have a 5-day free trial. Let's set up your booking page."
      )
      return response.redirect().toRoute('onboarding.show')
    } catch (error: any) {
      console.error('[AUTH] Signup error:', error)
      if (error instanceof errors.E_VALIDATION_ERROR) {
        const messages = error.messages.map((e: { message: string }) => e.message).join(', ')
        session.flash('error', `Validation failed: ${messages}`)
        session.flashAll()
        return response.redirect().back()
      }

      // Handle database constraint violations
      if (error.code === '23505') {
        // Unique constraint violation
        if (
          error.constraint === 'businesses_email_unique' ||
          error.constraint === 'users_email_unique' ||
          error.detail?.includes('email')
        ) {
          session.flash(
            'error',
            'An account with this email already exists. Please sign in instead.'
          )
        } else if (
          error.constraint === 'businesses_slug_unique' ||
          error.detail?.includes('slug')
        ) {
          // Retry with a different slug - this should be handled by the slug generation logic above
          // But if it still fails, show error
          session.flash(
            'error',
            'A business with this name already exists. Please choose a different business name.'
          )
        } else {
          session.flash(
            'error',
            'This information is already in use. Please use different details.'
          )
        }
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
    const email = request.input('email')?.toLowerCase().trim()

    if (!email) {
      session.flash('error', 'Please enter your email address')
      return response.redirect().back()
    }

    const user = await User.findBy('email', email)

    if (user) {
      await PasswordResetToken.query().where('email', email).delete()

      const token = randomBytes(32).toString('hex')
      const expiresAt = DateTime.now().plus({ hours: 1 })

      await PasswordResetToken.create({
        email,
        token,
        expiresAt,
      })

      const appUrl = env.get('APP_URL', 'http://localhost:3333')
      const resetUrl = `${appUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`

      console.log('[AUTH] Password reset link generated:', {
        email,
        tokenLength: token.length,
        resetUrl: resetUrl.substring(0, 100) + '...',
      })

      await emailService.sendPasswordReset({
        email,
        name: user.fullName,
        resetUrl,
      })
    }

    session.flash(
      'success',
      'If an account exists with this email, you will receive a password reset link shortly.'
    )
    return response.redirect().back()
  }

  async showResetPassword({ request, view, response, session }: HttpContext) {
    const queryParams = request.qs()
    let token = queryParams.token || request.input('token')
    let email = queryParams.email || request.input('email')

    if (!token || !email) {
      token = session.get('password_reset_token')
      email = session.get('password_reset_email')
    }

    console.log('[AUTH] Reset password request:', {
      url: request.url(),
      queryParams: Object.keys(queryParams),
      hasToken: !!token,
      hasEmail: !!email,
      tokenLength: token?.length,
      emailPreview: email ? email.substring(0, 10) + '...' : 'missing',
      fromSession: !queryParams.token && !queryParams.email,
    })

    if (!token || !email) {
      console.error('[AUTH] Missing reset parameters:', {
        token: !!token,
        email: !!email,
        url: request.url(),
      })
      session.flash('error', 'Invalid password reset link. Missing token or email.')
      return response.redirect().toRoute('auth.forgot.show')
    }

    let decodedEmail: string
    try {
      decodedEmail = decodeURIComponent(email).toLowerCase().trim()
    } catch (error) {
      decodedEmail = email.toLowerCase().trim()
    }

    const resetToken = await PasswordResetToken.query()
      .where('email', decodedEmail)
      .where('token', token)
      .first()

    if (!resetToken) {
      console.error('[AUTH] Reset token not found:', {
        email: decodedEmail,
        token: token.substring(0, 8) + '...',
      })
      session.forget('password_reset_token')
      session.forget('password_reset_email')
      session.flash('error', 'Invalid password reset link. Please request a new one.')
      return response.redirect().toRoute('auth.forgot.show')
    }

    if (resetToken.isExpired) {
      session.forget('password_reset_token')
      session.forget('password_reset_email')
      session.flash('error', 'This password reset link has expired. Please request a new one.')
      await resetToken.delete()
      return response.redirect().toRoute('auth.forgot.show')
    }

    session.put('password_reset_token', token)
    session.put('password_reset_email', decodedEmail)

    return view.render('pages/auth/reset-password', { token, email: decodedEmail })
  }

  async resetPassword({ request, response, session }: HttpContext) {
    try {
      console.log('[AUTH] Password reset form submitted')
      const data = await request.validateUsing(resetPasswordValidator)
      console.log('[AUTH] Password reset validation passed')

      const normalizedEmail = data.email.toLowerCase().trim()

      const resetToken = await PasswordResetToken.query()
        .where('email', normalizedEmail)
        .where('token', data.token)
        .first()

      if (!resetToken) {
        console.error('[AUTH] Reset token not found during password reset:', {
          email: normalizedEmail,
          token: data.token.substring(0, 8) + '...',
        })
        session.flash('error', 'Invalid password reset link. Please request a new one.')
        session.forget('password_reset_token')
        session.forget('password_reset_email')
        return response.redirect().toRoute('auth.forgot.show')
      }

      if (resetToken.isExpired) {
        session.flash('error', 'This password reset link has expired. Please request a new one.')
        await resetToken.delete()
        session.forget('password_reset_token')
        session.forget('password_reset_email')
        return response.redirect().toRoute('auth.forgot.show')
      }

      const user = await User.findBy('email', normalizedEmail)
      if (!user) {
        session.flash('error', 'User not found')
        return response.redirect().toRoute('auth.forgot.show')
      }

      user.password = data.password
      await user.save()

      await PasswordResetToken.query().where('email', normalizedEmail).delete()

      session.forget('password_reset_token')
      session.forget('password_reset_email')
      session.flash('success', 'Your password has been reset successfully. You can now login.')

      console.log('[AUTH] Password reset successful, redirecting to login')
      return response.redirect().toRoute('auth.login.show')
    } catch (error) {
      console.error('[AUTH] Password reset error:', error)
      if (error instanceof errors.E_VALIDATION_ERROR) {
        const messages = error.messages.map((e: { message: string }) => e.message).join(', ')
        session.flash('error', `Validation failed: ${messages}`)
        return response.redirect().back()
      }
      session.flash('error', 'An error occurred. Please try again.')
      return response.redirect().back()
    }
  }

  async showDeleteAccount({ view, auth }: HttpContext) {
    const user = auth.user!
    const business = user.businessId ? await Business.find(user.businessId) : null
    return view.render('pages/auth/delete-account', { business })
  }

  async deleteAccount({ response, auth, session }: HttpContext) {
    try {
      const user = auth.user!

      await PasswordResetToken.query().where('email', user.email).delete()

      if (user.role === 'owner' && user.businessId) {
        const business = await Business.find(user.businessId)
        if (business) {
          await business.delete()
        }
      } else {
        await user.related('services').detach()
        await user.delete()
      }

      await auth.use('web').logout()

      session.flash('success', 'Your account has been deleted successfully.')
      return response.redirect().toRoute('auth.login.show')
    } catch (error) {
      console.error('[AUTH] Delete account error:', error)
      session.flash('error', 'An error occurred while deleting your account. Please try again.')
      return response.redirect().back()
    }
  }
}
