import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Business from '#models/business'
import Service from '#models/service'
import Availability from '#models/availability'
import {
  staffValidator,
  staffUpdateValidator,
  staffAvailabilityValidator,
} from '#validators/staff-validator'
import { errors } from '@vinejs/vine'
import subscriptionService from '../services/subscription_service.js'

export default class StaffController {
  async index({ view, auth }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    const staff = await User.query()
      .where('businessId', business.id)
      .preload('services')
      .orderBy('createdAt', 'asc')

    return view.render('pages/staff/index', { staff, business })
  }

  async create({ view, auth }: HttpContext) {
    const user = auth.user!
    const services = await Service.query()
      .where('businessId', user.businessId!)
      .where('isActive', true)
      .orderBy('sortOrder')

    return view.render('pages/staff/create', { services })
  }

  async store({ request, response, auth, session }: HttpContext) {
    const currentUser = auth.user!

    try {
      // Check subscription limits
      const canAdd = await subscriptionService.canAddStaff(currentUser.businessId!)
      if (!canAdd.allowed) {
        session.flash('error', canAdd.reason || 'Cannot add more staff members')
        return response.redirect().toRoute('subscriptions.select')
      }

      const data = await request.validateUsing(staffValidator)

      const existingUser = await User.findBy('email', data.email)
      if (existingUser) {
        session.flash('error', 'A user with this email already exists')
        session.flashAll()
        return response.redirect().back()
      }

      const staffMember = await User.create({
        businessId: currentUser.businessId!,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone || null,
        password: data.password,
        role: data.role,
        isActive: true,
      })

      if (data.serviceIds && data.serviceIds.length > 0) {
        await staffMember.related('services').attach(data.serviceIds)
      }

      session.flash('success', 'Staff member added successfully')
      return response.redirect().toRoute('staff.index')
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        const messages = error.messages.map((e: { message: string }) => e.message).join(', ')
        session.flash('error', `Validation failed: ${messages}`)
        session.flashAll()
        return response.redirect().back()
      }
      throw error
    }
  }

  async edit({ params, view, auth, response }: HttpContext) {
    const currentUser = auth.user!

    const staffMember = await User.query()
      .where('id', params.id)
      .where('businessId', currentUser.businessId!)
      .preload('services')
      .preload('availabilities')
      .first()

    if (!staffMember) {
      return response.notFound('Staff member not found')
    }

    const services = await Service.query()
      .where('businessId', currentUser.businessId!)
      .where('isActive', true)
      .orderBy('sortOrder')

    const selectedServiceIds = staffMember.services.map((s) => s.id)

    return view.render('pages/staff/edit', { staffMember, services, selectedServiceIds })
  }

  async update({ params, request, response, auth, session }: HttpContext) {
    const currentUser = auth.user!

    const staffMember = await User.query()
      .where('id', params.id)
      .where('businessId', currentUser.businessId!)
      .first()

    if (!staffMember) {
      return response.notFound('Staff member not found')
    }

    try {
      const data = await request.validateUsing(staffUpdateValidator)

      if (data.email !== staffMember.email) {
        const existingUser = await User.query()
          .where('email', data.email)
          .whereNot('id', staffMember.id)
          .first()
        if (existingUser) {
          session.flash('error', 'A user with this email already exists')
          return response.redirect().back()
        }
      }

      staffMember.merge({
        fullName: data.fullName,
        email: data.email,
        phone: data.phone || null,
        role: staffMember.role === 'owner' ? 'owner' : data.role,
      })

      if (data.password) {
        staffMember.password = data.password
      }

      await staffMember.save()

      await staffMember.related('services').sync(data.serviceIds || [])

      session.flash('success', 'Staff member updated successfully')
      return response.redirect().toRoute('staff.index')
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        session.flash('error', 'Please fill in all required fields')
        return response.redirect().back()
      }
      throw error
    }
  }

  async toggleActive({ params, response, auth, session }: HttpContext) {
    const currentUser = auth.user!

    const staffMember = await User.query()
      .where('id', params.id)
      .where('businessId', currentUser.businessId!)
      .first()

    if (!staffMember) {
      return response.notFound('Staff member not found')
    }

    if (staffMember.role === 'owner') {
      session.flash('error', 'Cannot deactivate the business owner')
      return response.redirect().back()
    }

    staffMember.isActive = !staffMember.isActive
    await staffMember.save()

    session.flash(
      'success',
      staffMember.isActive ? 'Staff member activated' : 'Staff member deactivated'
    )
    return response.redirect().back()
  }

  async destroy({ params, response, auth, session }: HttpContext) {
    const currentUser = auth.user!

    const staffMember = await User.query()
      .where('id', params.id)
      .where('businessId', currentUser.businessId!)
      .first()

    if (!staffMember) {
      return response.notFound('Staff member not found')
    }

    if (staffMember.role === 'owner') {
      session.flash('error', 'Cannot delete the business owner')
      return response.redirect().back()
    }

    await staffMember.related('services').detach()
    await Availability.query().where('userId', staffMember.id).delete()
    await staffMember.delete()

    session.flash('success', 'Staff member removed')
    return response.redirect().toRoute('staff.index')
  }

  async showAvailability({ params, view, auth, response }: HttpContext) {
    const currentUser = auth.user!

    const staffMember = await User.query()
      .where('id', params.id)
      .where('businessId', currentUser.businessId!)
      .preload('availabilities')
      .first()

    if (!staffMember) {
      return response.notFound('Staff member not found')
    }

    const daysOfWeek = [
      { value: 0, label: 'Sunday' },
      { value: 1, label: 'Monday' },
      { value: 2, label: 'Tuesday' },
      { value: 3, label: 'Wednesday' },
      { value: 4, label: 'Thursday' },
      { value: 5, label: 'Friday' },
      { value: 6, label: 'Saturday' },
    ]

    const availabilityMap = new Map(staffMember.availabilities.map((a) => [a.dayOfWeek, a]))

    return view.render('pages/staff/availability', { staffMember, daysOfWeek, availabilityMap })
  }

  async saveAvailability({ params, request, response, auth, session }: HttpContext) {
    const currentUser = auth.user!

    const staffMember = await User.query()
      .where('id', params.id)
      .where('businessId', currentUser.businessId!)
      .first()

    if (!staffMember) {
      return response.notFound('Staff member not found')
    }

    try {
      const data = await request.validateUsing(staffAvailabilityValidator)

      await Availability.query().where('userId', staffMember.id).delete()

      for (const avail of data.availabilities) {
        if (avail.isActive) {
          await Availability.create({
            businessId: currentUser.businessId!,
            userId: staffMember.id,
            dayOfWeek: avail.dayOfWeek,
            startTime: avail.startTime,
            endTime: avail.endTime,
            isActive: true,
          })
        }
      }

      session.flash('success', 'Availability saved successfully')
      return response.redirect().toRoute('staff.edit', { id: staffMember.id })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        session.flash('error', 'Please check your availability settings')
        return response.redirect().back()
      }
      throw error
    }
  }
}
