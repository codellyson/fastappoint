import type { HttpContext } from '@adonisjs/core/http'
import Business from '#models/business'
import Service from '#models/service'
import Availability from '#models/availability'
import {
  businessDetailsValidator,
  serviceValidator,
  availabilityValidator,
} from '#validators/business-validator'
import { errors } from '@vinejs/vine'

export default class OnboardingController {
  async show({ view, auth, response, request }: HttpContext) {
    const user = auth.user!
    if (!user.businessId) {
      return response.redirect().toRoute('dashboard')
    }

    const business = await Business.query()
      .where('id', user.businessId)
      .preload('services')
      .preload('availabilities')
      .firstOrFail()

    if (business.isOnboarded) {
      return response.redirect().toRoute('dashboard')
    }

    const queryStep = request.qs().step
    let step = queryStep ? Number.parseInt(queryStep) : 1

    if (step < 1 || step > 4) step = 1

    return view.render('pages/onboarding/index', { business, step })
  }

  async updateDetails({ request, response, auth, session }: HttpContext) {
    const user = auth.user!

    try {
      const data = await request.validateUsing(businessDetailsValidator)

      const business = await Business.findOrFail(user.businessId)
      business.merge({
        name: data.name,
        description: data.description || null,
        phone: data.phone || null,
        cancellationHours: data.cancellationHours,
      })
      await business.save()

      session.flash('success', 'Business details saved!')
      return response.redirect().toRoute('onboarding.show', {}, { qs: { step: 2 } })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        session.flash('error', 'Please fill in all required fields')
        return response.redirect().back()
      }
      throw error
    }
  }

  async addService({ request, response, auth, session }: HttpContext) {
    const user = auth.user!

    try {
      const data = await request.validateUsing(serviceValidator)

      await Service.create({
        businessId: user.businessId!,
        name: data.name,
        description: data.description || null,
        durationMinutes: data.durationMinutes,
        price: data.price,
        isActive: true,
        sortOrder: 0,
      })

      session.flash('success', 'Service added!')
      return response.redirect().toRoute('onboarding.show', {}, { qs: { step: 2 } })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        session.flash('error', 'Please fill in all service details')
        return response.redirect().back()
      }
      throw error
    }
  }

  async deleteService({ params, response, auth, session }: HttpContext) {
    const user = auth.user!
    const service = await Service.query()
      .where('id', params.id)
      .where('businessId', user.businessId!)
      .firstOrFail()

    await service.delete()

    session.flash('success', 'Service removed')
    return response.redirect().toRoute('onboarding.show', {}, { qs: { step: 2 } })
  }

  async saveAvailability({ request, response, auth, session }: HttpContext) {
    const user = auth.user!

    try {
      const data = await request.validateUsing(availabilityValidator)

      await Availability.query().where('businessId', user.businessId!).delete()

      for (const avail of data.availabilities) {
        if (avail.isActive) {
          await Availability.create({
            businessId: user.businessId!,
            userId: null,
            dayOfWeek: avail.dayOfWeek,
            startTime: avail.startTime,
            endTime: avail.endTime,
            isActive: true,
          })
        }
      }

      session.flash('success', 'Availability saved!')
      return response.redirect().toRoute('onboarding.show', {}, { qs: { step: 4 } })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        session.flash('error', 'Please check your availability settings')
        return response.redirect().back()
      }
      throw error
    }
  }

  async complete({ response, auth, session }: HttpContext) {
    const user = auth.user!
    const business = await Business.query()
      .where('id', user.businessId!)
      .preload('services')
      .preload('availabilities')
      .firstOrFail()

    if (business.services.length === 0) {
      session.flash('error', 'Please add at least one service')
      return response.redirect().toRoute('onboarding.show', {}, { qs: { step: 2 } })
    }

    if (business.availabilities.length === 0) {
      session.flash('error', 'Please set your availability')
      return response.redirect().toRoute('onboarding.show', {}, { qs: { step: 3 } })
    }

    business.isOnboarded = true
    await business.save()

    session.flash('success', `Your booking page is live at ${business.slug}.bookme.ng!`)
    return response.redirect().toRoute('dashboard')
  }
}
