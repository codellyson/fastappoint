import type { HttpContext } from '@adonisjs/core/http'
import Service from '#models/service'
import Business from '#models/business'
import { serviceValidator } from '#validators/business-validator'
import { errors } from '@vinejs/vine'

export default class ServicesController {
  async index({ view, auth }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)
    const services = await Service.query()
      .where('businessId', business.id)
      .orderBy('sortOrder')

    return view.render('pages/services/index', { services, business })
  }

  async create({ view }: HttpContext) {
    return view.render('pages/services/create')
  }

  async store({ request, response, auth, session }: HttpContext) {
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

      session.flash('success', 'Service created successfully')
      return response.redirect().toRoute('services.index')
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        session.flash('error', 'Please fill in all required fields')
        return response.redirect().back()
      }
      throw error
    }
  }

  async edit({ params, view, auth, response }: HttpContext) {
    const user = auth.user!
    const service = await Service.query()
      .where('id', params.id)
      .where('businessId', user.businessId!)
      .first()

    if (!service) {
      return response.notFound('Service not found')
    }

    return view.render('pages/services/edit', { service })
  }

  async update({ params, request, response, auth, session }: HttpContext) {
    const user = auth.user!
    const service = await Service.query()
      .where('id', params.id)
      .where('businessId', user.businessId!)
      .first()

    if (!service) {
      return response.notFound('Service not found')
    }

    try {
      const data = await request.validateUsing(serviceValidator)

      service.merge({
        name: data.name,
        description: data.description || null,
        durationMinutes: data.durationMinutes,
        price: data.price,
      })
      await service.save()

      session.flash('success', 'Service updated successfully')
      return response.redirect().toRoute('services.index')
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        session.flash('error', 'Please fill in all required fields')
        return response.redirect().back()
      }
      throw error
    }
  }

  async toggleActive({ params, response, auth, session }: HttpContext) {
    const user = auth.user!
    const service = await Service.query()
      .where('id', params.id)
      .where('businessId', user.businessId!)
      .first()

    if (!service) {
      return response.notFound('Service not found')
    }

    service.isActive = !service.isActive
    await service.save()

    session.flash('success', service.isActive ? 'Service enabled' : 'Service disabled')
    return response.redirect().back()
  }

  async destroy({ params, response, auth, session }: HttpContext) {
    const user = auth.user!
    const service = await Service.query()
      .where('id', params.id)
      .where('businessId', user.businessId!)
      .first()

    if (!service) {
      return response.notFound('Service not found')
    }

    await service.delete()
    session.flash('success', 'Service deleted')
    return response.redirect().toRoute('services.index')
  }
}
