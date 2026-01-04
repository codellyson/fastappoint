import type { HttpContext } from '@adonisjs/core/http'
import Customer from '#models/customer'
import Booking from '#models/booking'
import hash from '@adonisjs/core/services/hash'
import { randomUUID } from 'node:crypto'
import vine from '@vinejs/vine'

const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email().trim().toLowerCase(),
    password: vine.string().minLength(6),
  })
)

const registerValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(255),
    email: vine.string().email().trim().toLowerCase(),
    password: vine.string().minLength(6).maxLength(100),
    phone: vine.string().trim().maxLength(50).optional(),
  })
)

const createPasswordValidator = vine.compile(
  vine.object({
    password: vine.string().minLength(6).maxLength(100),
    passwordConfirmation: vine.string().minLength(6).maxLength(100),
  })
)

export default class CustomerAuthsController {
  /**
   * Show login page
   */
  async showLogin({ view, request }: HttpContext) {
    const redirect = request.qs().redirect || null
    return view.render('pages/customer/login', { redirect })
  }

  /**
   * Handle login
   */
  async login({ request, response, session }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)
    const redirect = request.input('redirect')

    const customer = await Customer.findBy('email', email)

    if (!customer || !customer.password) {
      session.flash('error', 'Invalid email or password')
      return response.redirect().back()
    }

    const isValid = await hash.verify(customer.password, password)
    if (!isValid) {
      session.flash('error', 'Invalid email or password')
      return response.redirect().back()
    }

    // Store customer in session
    session.put('customer_id', customer.id)

    session.flash('success', `Welcome back, ${customer.firstName}!`)

    if (redirect) {
      return response.redirect(redirect)
    }

    return response.redirect().toRoute('customer.dashboard')
  }

  /**
   * Show register page
   */
  async showRegister({ view, request }: HttpContext) {
    const redirect = request.qs().redirect || null
    const email = request.qs().email || ''
    const name = request.qs().name || ''
    return view.render('pages/customer/register', { redirect, email, name })
  }

  /**
   * Handle registration
   */
  async register({ request, response, session }: HttpContext) {
    const data = await request.validateUsing(registerValidator)
    const redirect = request.input('redirect')

    // Check if customer already exists
    const existing = await Customer.findBy('email', data.email)
    if (existing) {
      if (existing.password) {
        session.flash('error', 'An account with this email already exists. Please login.')
        return response.redirect().toRoute('customer.login')
      } else {
        // Guest customer - let them set a password
        existing.name = data.name
        existing.password = data.password
        existing.phone = data.phone || null
        existing.isVerified = true
        await existing.save()

        session.put('customer_id', existing.id)
        session.flash('success', `Account created! Welcome, ${existing.firstName}!`)

        if (redirect) {
          return response.redirect(redirect)
        }
        return response.redirect().toRoute('customer.dashboard')
      }
    }

    // Create new customer
    const customer = await Customer.create({
      name: data.name,
      email: data.email,
      password: data.password,
      phone: data.phone || null,
      isVerified: true,
      verificationToken: randomUUID(),
    })

    session.put('customer_id', customer.id)
    session.flash('success', `Welcome, ${customer.firstName}! Your account has been created.`)

    if (redirect) {
      return response.redirect(redirect)
    }

    return response.redirect().toRoute('customer.dashboard')
  }

  /**
   * Logout
   */
  async logout({ response, session }: HttpContext) {
    session.forget('customer_id')
    session.flash('success', 'You have been logged out.')
    return response.redirect().toRoute('customer.login')
  }

  /**
   * Show dashboard
   */
  async dashboard({ view, session, response }: HttpContext) {
    const customerId = session.get('customer_id')
    if (!customerId) {
      return response.redirect().toRoute('customer.login')
    }

    const customer = await Customer.find(customerId)
    if (!customer) {
      session.forget('customer_id')
      return response.redirect().toRoute('customer.login')
    }

    // Get upcoming bookings
    const upcomingBookings = await Booking.query()
      .where('customerId', customer.id)
      .where('status', 'confirmed')
      .where('date', '>=', new Date().toISOString().split('T')[0])
      .preload('business')
      .preload('service')
      .orderBy('date', 'asc')
      .orderBy('startTime', 'asc')
      .limit(5)

    // Get past bookings
    const pastBookings = await Booking.query()
      .where('customerId', customer.id)
      .where((q) => {
        q.where('status', 'completed')
          .orWhere('status', 'cancelled')
          .orWhere('date', '<', new Date().toISOString().split('T')[0])
      })
      .preload('business')
      .preload('service')
      .orderBy('date', 'desc')
      .limit(10)

    return view.render('pages/customer/dashboard', {
      customer,
      upcomingBookings,
      pastBookings,
    })
  }

  /**
   * Show all bookings
   */
  async bookings({ view, session, response, request }: HttpContext) {
    const customerId = session.get('customer_id')
    if (!customerId) {
      return response.redirect().toRoute('customer.login')
    }

    const customer = await Customer.find(customerId)
    if (!customer) {
      session.forget('customer_id')
      return response.redirect().toRoute('customer.login')
    }

    const filter = request.qs().filter || 'all'

    const query = Booking.query()
      .where('customerId', customer.id)
      .preload('business')
      .preload('service')
      .orderBy('date', 'desc')
      .orderBy('startTime', 'desc')

    if (filter === 'upcoming') {
      query.where('status', 'confirmed').where('date', '>=', new Date().toISOString().split('T')[0])
    } else if (filter === 'past') {
      query.where((q) => {
        q.where('status', 'completed')
          .orWhere('status', 'cancelled')
          .orWhere('date', '<', new Date().toISOString().split('T')[0])
      })
    }

    const bookings = await query

    return view.render('pages/customer/bookings', {
      customer,
      bookings,
      filter,
    })
  }

  /**
   * Show profile settings
   */
  async profile({ view, session, response }: HttpContext) {
    const customerId = session.get('customer_id')
    if (!customerId) {
      return response.redirect().toRoute('customer.login')
    }

    const customer = await Customer.find(customerId)
    if (!customer) {
      session.forget('customer_id')
      return response.redirect().toRoute('customer.login')
    }

    return view.render('pages/customer/profile', { customer })
  }

  /**
   * Update profile
   */
  async updateProfile({ request, response, session }: HttpContext) {
    const customerId = session.get('customer_id')
    if (!customerId) {
      return response.redirect().toRoute('customer.login')
    }

    const customer = await Customer.find(customerId)
    if (!customer) {
      session.forget('customer_id')
      return response.redirect().toRoute('customer.login')
    }

    const name = request.input('name')
    const phone = request.input('phone')

    if (name) {
      customer.name = name.trim()
    }
    customer.phone = phone?.trim() || null

    await customer.save()

    session.flash('success', 'Profile updated successfully.')
    return response.redirect().back()
  }

  /**
   * Show create password page (for guest customers)
   */
  async showCreatePassword({ view, request, response, session }: HttpContext) {
    const token = request.param('token')
    const email = request.qs().email

    if (!token || !email) {
      session.flash('error', 'Invalid link.')
      return response.redirect().toRoute('customer.login')
    }

    return view.render('pages/customer/create-password', { token, email })
  }

  /**
   * Create password for guest customer
   */
  async createPassword({ request, response, session }: HttpContext) {
    const token = request.param('token')
    const email = request.input('email')

    const { password, passwordConfirmation } = await request.validateUsing(createPasswordValidator)

    if (password !== passwordConfirmation) {
      session.flash('error', 'Passwords do not match.')
      return response.redirect().back()
    }

    const customer = await Customer.query()
      .where('email', email)
      .where('verificationToken', token)
      .first()

    if (!customer) {
      session.flash('error', 'Invalid or expired link.')
      return response.redirect().toRoute('customer.login')
    }

    customer.password = password
    customer.isVerified = true
    customer.verificationToken = null
    await customer.save()

    session.put('customer_id', customer.id)
    session.flash('success', 'Password created! You are now logged in.')
    return response.redirect().toRoute('customer.dashboard')
  }
}
