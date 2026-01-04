import type { HttpContext } from '@adonisjs/core/http'
import PortfolioItem from '#models/portfolio_item'
import Service from '#models/service'
import { portfolioValidator } from '#validators/business-validator'
import { errors } from '@vinejs/vine'
import app from '@adonisjs/core/services/app'
import { cuid } from '@adonisjs/core/helpers'
import sharp from 'sharp'
import { unlink } from 'node:fs/promises'

export default class PortfoliosController {
  async index({ view, auth }: HttpContext) {
    const user = auth.user!
    const portfolioItems = await PortfolioItem.query()
      .where('businessId', user.businessId!)
      .preload('service')
      .orderBy('sortOrder')
      .orderBy('createdAt', 'desc')

    const services = await Service.query()
      .where('businessId', user.businessId!)
      .where('isActive', true)
      .orderBy('name')

    return view.render('pages/portfolio/index', { portfolioItems, services })
  }

  async create({ view, auth }: HttpContext) {
    const user = auth.user!
    const services = await Service.query()
      .where('businessId', user.businessId!)
      .where('isActive', true)
      .orderBy('name')

    return view.render('pages/portfolio/create', { services })
  }

  async store({ request, response, auth, session }: HttpContext) {
    const user = auth.user!

    try {
      const data = await request.validateUsing(portfolioValidator)

      // Handle image upload (required)
      const image = request.file('image', {
        size: '5mb',
        extnames: ['jpg', 'jpeg', 'png', 'webp'],
      })

      if (!image) {
        session.flash('error', 'Please upload an image')
        return response.redirect().back()
      }

      if (!image.isValid) {
        session.flash('error', image.errors[0]?.message || 'Invalid image file')
        return response.redirect().back()
      }

      const fileName = `${cuid()}.webp`
      const uploadPath = app.publicPath('uploads/portfolio')

      // Process and optimize image with sharp
      await sharp(image.tmpPath)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(`${uploadPath}/${fileName}`)

      const imagePath = `/uploads/portfolio/${fileName}`

      // Get the next sort order
      const maxSortOrder = await PortfolioItem.query()
        .where('businessId', user.businessId!)
        .max('sort_order as maxOrder')
        .first()

      const sortOrder = (maxSortOrder?.$extras.maxOrder || 0) + 1

      await PortfolioItem.create({
        businessId: user.businessId!,
        title: data.title,
        description: data.description || null,
        image: imagePath,
        serviceId: data.serviceId || null,
        isFeatured: data.isFeatured || false,
        isActive: true,
        sortOrder,
      })

      session.flash('success', 'Portfolio item added successfully')
      return response.redirect().toRoute('portfolio.index')
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
    const portfolioItem = await PortfolioItem.query()
      .where('id', params.id)
      .where('businessId', user.businessId!)
      .first()

    if (!portfolioItem) {
      return response.notFound('Portfolio item not found')
    }

    const services = await Service.query()
      .where('businessId', user.businessId!)
      .where('isActive', true)
      .orderBy('name')

    return view.render('pages/portfolio/edit', { portfolioItem, services })
  }

  async update({ params, request, response, auth, session }: HttpContext) {
    const user = auth.user!
    const portfolioItem = await PortfolioItem.query()
      .where('id', params.id)
      .where('businessId', user.businessId!)
      .first()

    if (!portfolioItem) {
      return response.notFound('Portfolio item not found')
    }

    try {
      const data = await request.validateUsing(portfolioValidator)

      // Handle image upload
      const image = request.file('image', {
        size: '5mb',
        extnames: ['jpg', 'jpeg', 'png', 'webp'],
      })

      let imagePath = portfolioItem.image

      if (image) {
        if (!image.isValid) {
          session.flash('error', image.errors[0]?.message || 'Invalid image file')
          return response.redirect().back()
        }

        const fileName = `${cuid()}.webp`
        const uploadPath = app.publicPath('uploads/portfolio')

        // Process and optimize image with sharp
        await sharp(image.tmpPath)
          .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 })
          .toFile(`${uploadPath}/${fileName}`)

        // Delete old image
        if (portfolioItem.image) {
          try {
            await unlink(app.publicPath(portfolioItem.image))
          } catch {
            // Ignore if file doesn't exist
          }
        }

        imagePath = `/uploads/portfolio/${fileName}`
      }

      portfolioItem.merge({
        title: data.title,
        description: data.description || null,
        image: imagePath,
        serviceId: data.serviceId || null,
        isFeatured: data.isFeatured || false,
      })
      await portfolioItem.save()

      session.flash('success', 'Portfolio item updated successfully')
      return response.redirect().toRoute('portfolio.index')
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
    const portfolioItem = await PortfolioItem.query()
      .where('id', params.id)
      .where('businessId', user.businessId!)
      .first()

    if (!portfolioItem) {
      return response.notFound('Portfolio item not found')
    }

    portfolioItem.isActive = !portfolioItem.isActive
    await portfolioItem.save()

    session.flash('success', portfolioItem.isActive ? 'Portfolio item enabled' : 'Portfolio item hidden')
    return response.redirect().back()
  }

  async toggleFeatured({ params, response, auth, session }: HttpContext) {
    const user = auth.user!
    const portfolioItem = await PortfolioItem.query()
      .where('id', params.id)
      .where('businessId', user.businessId!)
      .first()

    if (!portfolioItem) {
      return response.notFound('Portfolio item not found')
    }

    portfolioItem.isFeatured = !portfolioItem.isFeatured
    await portfolioItem.save()

    session.flash('success', portfolioItem.isFeatured ? 'Marked as featured' : 'Removed from featured')
    return response.redirect().back()
  }

  async destroy({ params, response, auth, session }: HttpContext) {
    const user = auth.user!
    const portfolioItem = await PortfolioItem.query()
      .where('id', params.id)
      .where('businessId', user.businessId!)
      .first()

    if (!portfolioItem) {
      return response.notFound('Portfolio item not found')
    }

    // Delete image
    if (portfolioItem.image) {
      try {
        await unlink(app.publicPath(portfolioItem.image))
      } catch {
        // Ignore if file doesn't exist
      }
    }

    await portfolioItem.delete()
    session.flash('success', 'Portfolio item deleted')
    return response.redirect().toRoute('portfolio.index')
  }

  async reorder({ request, response, auth }: HttpContext) {
    const user = auth.user!
    const { items } = request.only(['items'])

    if (!Array.isArray(items)) {
      return response.badRequest('Invalid request')
    }

    // Update sort order for each item
    for (let i = 0; i < items.length; i++) {
      await PortfolioItem.query()
        .where('id', items[i])
        .where('businessId', user.businessId!)
        .update({ sortOrder: i })
    }

    return response.json({ success: true })
  }
}
