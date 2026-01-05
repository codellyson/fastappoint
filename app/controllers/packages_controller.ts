import type { HttpContext } from '@adonisjs/core/http'
import ServicePackage from '#models/service_package'
import Service from '#models/service'
import { packageValidator } from '#validators/business-validator'
import { errors } from '@vinejs/vine'
import { cuid } from '@adonisjs/core/helpers'
import sharp from 'sharp'
import storageService from '#services/storage_service'

export default class PackagesController {
  async index({ view, auth }: HttpContext) {
    const user = auth.user!
    const packages = await ServicePackage.query()
      .where('businessId', user.businessId!)
      .orderBy('sortOrder')
      .orderBy('createdAt', 'desc')

    const services = await Service.query()
      .where('businessId', user.businessId!)
      .where('isActive', true)
      .orderBy('name')

    // Map service IDs to names for display
    const serviceMap = new Map(services.map((s) => [s.id, s]))

    return view.render('pages/packages/index', { packages, services, serviceMap })
  }

  async create({ view, auth }: HttpContext) {
    const user = auth.user!
    const services = await Service.query()
      .where('businessId', user.businessId!)
      .where('isActive', true)
      .orderBy('name')

    return view.render('pages/packages/create', { services })
  }

  async store({ request, response, auth, session }: HttpContext) {
    const user = auth.user!

    try {
      const data = await request.validateUsing(packageValidator)

      // Fetch services to calculate totals
      const services = await Service.query()
        .where('businessId', user.businessId!)
        .whereIn('id', data.serviceIds)

      if (services.length !== data.serviceIds.length) {
        session.flash('error', 'Some selected services are invalid')
        return response.redirect().back()
      }

      // Calculate totals
      const originalPrice = services.reduce((sum, s) => sum + Number(s.price), 0)
      const durationMinutes = services.reduce((sum, s) => sum + (s.durationMinutes || 30), 0)
      const discountAmount = originalPrice - data.packagePrice

      if (data.packagePrice > originalPrice) {
        session.flash('error', 'Package price cannot be higher than the sum of individual services')
        return response.redirect().back()
      }

      // Handle image upload (optional)
      let imagePath: string | null = null
      const image = request.file('image', {
        size: '5mb',
        extnames: ['jpg', 'jpeg', 'png', 'webp'],
      })

      if (image) {
        if (!image.isValid) {
          session.flash('error', image.errors[0]?.message || 'Invalid image file')
          return response.redirect().back()
        }

        const fileName = `${cuid()}.webp`
        const storagePath = `packages/${fileName}`

        const processedImage = await sharp(image.tmpPath)
          .resize(800, 600, { fit: 'cover' })
          .webp({ quality: 85 })
          .toBuffer()

        imagePath = await storageService.save(storagePath, processedImage, {
          contentType: 'image/webp',
        })
      }

      // Get the next sort order
      const maxSortOrder = await ServicePackage.query()
        .where('businessId', user.businessId!)
        .max('sort_order as maxOrder')
        .first()

      const sortOrder = (maxSortOrder?.$extras.maxOrder || 0) + 1

      await ServicePackage.create({
        businessId: user.businessId!,
        name: data.name,
        description: data.description || null,
        image: imagePath,
        serviceIds: data.serviceIds,
        packagePrice: data.packagePrice,
        originalPrice,
        discountAmount,
        durationMinutes,
        isActive: true,
        sortOrder,
      })

      session.flash('success', 'Package created successfully')
      return response.redirect().toRoute('packages.index')
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        session.flash('error', 'Please fill in all required fields correctly')
        return response.redirect().back()
      }
      throw error
    }
  }

  async edit({ params, view, auth, response }: HttpContext) {
    const user = auth.user!
    const pkg = await ServicePackage.query()
      .where('id', params.id)
      .where('businessId', user.businessId!)
      .first()

    if (!pkg) {
      return response.notFound('Package not found')
    }

    const services = await Service.query()
      .where('businessId', user.businessId!)
      .where('isActive', true)
      .orderBy('name')

    return view.render('pages/packages/edit', { pkg, services })
  }

  async update({ params, request, response, auth, session }: HttpContext) {
    const user = auth.user!
    const pkg = await ServicePackage.query()
      .where('id', params.id)
      .where('businessId', user.businessId!)
      .first()

    if (!pkg) {
      return response.notFound('Package not found')
    }

    try {
      const data = await request.validateUsing(packageValidator)

      // Fetch services to calculate totals
      const services = await Service.query()
        .where('businessId', user.businessId!)
        .whereIn('id', data.serviceIds)

      if (services.length !== data.serviceIds.length) {
        session.flash('error', 'Some selected services are invalid')
        return response.redirect().back()
      }

      // Calculate totals
      const originalPrice = services.reduce((sum, s) => sum + Number(s.price), 0)
      const durationMinutes = services.reduce((sum, s) => sum + (s.durationMinutes || 30), 0)
      const discountAmount = originalPrice - data.packagePrice

      if (data.packagePrice > originalPrice) {
        session.flash('error', 'Package price cannot be higher than the sum of individual services')
        return response.redirect().back()
      }

      // Handle image upload
      const image = request.file('image', {
        size: '5mb',
        extnames: ['jpg', 'jpeg', 'png', 'webp'],
      })

      let imagePath = pkg.image

      if (image) {
        if (!image.isValid) {
          session.flash('error', image.errors[0]?.message || 'Invalid image file')
          return response.redirect().back()
        }

        const fileName = `${cuid()}.webp`
        const storagePath = `packages/${fileName}`

        const processedImage = await sharp(image.tmpPath)
          .resize(800, 600, { fit: 'cover' })
          .webp({ quality: 85 })
          .toBuffer()

        if (pkg.image) {
          try {
            await storageService.delete(pkg.image)
          } catch {
            // Ignore if file doesn't exist
          }
        }

        imagePath = await storageService.save(storagePath, processedImage, {
          contentType: 'image/webp',
        })
      }

      pkg.merge({
        name: data.name,
        description: data.description || null,
        image: imagePath,
        serviceIds: data.serviceIds,
        packagePrice: data.packagePrice,
        originalPrice,
        discountAmount,
        durationMinutes,
      })
      await pkg.save()

      session.flash('success', 'Package updated successfully')
      return response.redirect().toRoute('packages.index')
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        session.flash('error', 'Please fill in all required fields correctly')
        return response.redirect().back()
      }
      throw error
    }
  }

  async toggleActive({ params, response, auth, session }: HttpContext) {
    const user = auth.user!
    const pkg = await ServicePackage.query()
      .where('id', params.id)
      .where('businessId', user.businessId!)
      .first()

    if (!pkg) {
      return response.notFound('Package not found')
    }

    pkg.isActive = !pkg.isActive
    await pkg.save()

    session.flash('success', pkg.isActive ? 'Package enabled' : 'Package disabled')
    return response.redirect().back()
  }

  async destroy({ params, response, auth, session }: HttpContext) {
    const user = auth.user!
    const pkg = await ServicePackage.query()
      .where('id', params.id)
      .where('businessId', user.businessId!)
      .first()

    if (!pkg) {
      return response.notFound('Package not found')
    }

    if (pkg.image) {
      try {
        await storageService.delete(pkg.image)
      } catch {
        // Ignore if file doesn't exist
      }
    }

    await pkg.delete()
    session.flash('success', 'Package deleted')
    return response.redirect().toRoute('packages.index')
  }

  async reorder({ request, response, auth }: HttpContext) {
    const user = auth.user!
    const { items } = request.only(['items'])

    if (!Array.isArray(items)) {
      return response.badRequest('Invalid request')
    }

    // Update sort order for each item
    for (let i = 0; i < items.length; i++) {
      await ServicePackage.query()
        .where('id', items[i])
        .where('businessId', user.businessId!)
        .update({ sortOrder: i })
    }

    return response.json({ success: true })
  }
}
