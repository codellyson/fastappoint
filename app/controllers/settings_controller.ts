import type { HttpContext } from '@adonisjs/core/http'
import Business from '#models/business'
import {
  businessProfileValidator,
  cancellationPolicyValidator,
  paystackSettingsValidator,
} from '#validators/settings-validator'
import { errors } from '@vinejs/vine'

export default class SettingsController {
  async index({ view, auth }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)
    return view.render('pages/settings/index', { business })
  }

  async profile({ view, auth }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)
    return view.render('pages/settings/profile', { business })
  }

  async updateProfile({ request, response, auth, session }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    try {
      const data = await request.validateUsing(businessProfileValidator)

      business.merge({
        name: data.name,
        description: data.description || null,
        phone: data.phone || null,
        category: data.category,
        timezone: data.timezone,
        currency: data.currency,
      })
      await business.save()

      session.flash('success', 'Profile updated successfully')
      return response.redirect().toRoute('settings.profile')
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        session.flash('error', 'Please check your input')
        return response.redirect().back()
      }
      throw error
    }
  }

  async cancellation({ view, auth }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)
    return view.render('pages/settings/cancellation', { business })
  }

  async updateCancellation({ request, response, auth, session }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    try {
      const data = await request.validateUsing(cancellationPolicyValidator)

      business.merge({
        cancellationPolicy: data.cancellationPolicy || null,
        cancellationHours: data.cancellationHours,
      })
      await business.save()

      session.flash('success', 'Cancellation policy updated successfully')
      return response.redirect().toRoute('settings.cancellation')
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        session.flash('error', 'Please check your input')
        return response.redirect().back()
      }
      throw error
    }
  }

  async payments({ view, auth }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)
    return view.render('pages/settings/payments', { business })
  }

  async updatePayments({ request, response, auth, session }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    try {
      const data = await request.validateUsing(paystackSettingsValidator)

      business.merge({
        paystackSubaccountCode: data.paystackSubaccountCode || null,
        allowInstallments: data.allowInstallments,
      })
      await business.save()

      session.flash('success', 'Payment settings updated successfully')
      return response.redirect().toRoute('settings.payments')
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        session.flash('error', 'Please check your input')
        return response.redirect().back()
      }
      throw error
    }
  }

  async bookingPage({ view, auth }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)
    return view.render('pages/settings/booking-page', { business })
  }
}
