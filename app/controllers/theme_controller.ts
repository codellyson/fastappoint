import type { HttpContext } from '@adonisjs/core/http'
import Business from '#models/business'
import BusinessTheme from '#models/business-theme'
import vine from '@vinejs/vine'

const themeValidator = vine.compile(
  vine.object({
    template: vine.enum(['elegant', 'modern', 'minimal', 'vibrant', 'professional']),
    primaryColor: vine.string().trim(),
    secondaryColor: vine.string().trim(),
    accentColor: vine.string().trim(),
    textColor: vine.string().trim(),
    backgroundColor: vine.string().trim(),
    fontHeading: vine.string().trim(),
    fontBody: vine.string().trim(),
    heroStyle: vine.enum(['image', 'gradient', 'solid']),
    heroImage: vine.string().trim().optional(),
    heroGradient: vine.string().trim().optional(),
    buttonStyle: vine.enum(['rounded', 'pill', 'square']),
    cardStyle: vine.enum(['elevated', 'bordered', 'flat']),
    tagline: vine.string().trim().maxLength(150).optional(),
    aboutText: vine.string().trim().maxLength(1000).optional(),
    showGallery: vine.boolean(),
    showAbout: vine.boolean(),
    showTestimonials: vine.boolean(),
  })
)

const socialLinksValidator = vine.compile(
  vine.object({
    instagram: vine.string().trim().optional(),
    twitter: vine.string().trim().optional(),
    facebook: vine.string().trim().optional(),
    whatsapp: vine.string().trim().optional(),
    tiktok: vine.string().trim().optional(),
    website: vine.string().trim().optional(),
  })
)

export default class ThemeController {
  async index({ view, auth }: HttpContext) {
    const user = auth.user!
    if (!user.businessId) {
      throw new Error('User has no business associated')
    }
    const business = await Business.query()
      .where('id', user.businessId)
      .preload('theme')
      .firstOrFail()

    return view.render('pages/settings/theme/index', {
      business,
      theme: business.theme,
      templates: BusinessTheme.TEMPLATES,
      fonts: BusinessTheme.FONTS,
    })
  }

  async selectTemplate({ view, auth }: HttpContext) {
    const user = auth.user!
    if (!user.businessId) {
      throw new Error('User has no business associated')
    }
    const business = await Business.query()
      .where('id', user.businessId)
      .preload('theme')
      .firstOrFail()

    return view.render('pages/settings/theme/templates', {
      business,
      theme: business.theme,
      templates: BusinessTheme.TEMPLATES,
    })
  }

  async applyTemplate({ request, response, auth, session }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)
    const templateKey = request.input('template') as keyof typeof BusinessTheme.TEMPLATES

    const templateConfig = BusinessTheme.TEMPLATES[templateKey]
    if (!templateConfig) {
      session.flash('error', 'Invalid template selected')
      return response.redirect().back()
    }

    let theme = await BusinessTheme.findBy('businessId', business.id)

    if (theme) {
      theme.merge({
        template: templateKey,
        ...templateConfig.defaults,
      })
      await theme.save()
    } else {
      theme = await BusinessTheme.create({
        businessId: business.id,
        template: templateKey,
        ...templateConfig.defaults,
        textColor: '#1c1917',
        backgroundColor: '#ffffff',
        heroStyle: 'gradient',
        heroGradient: 'from-primary/10 to-primary/5',
        buttonStyle: 'rounded',
        cardStyle: 'elevated',
        showGallery: true,
        showAbout: true,
        showTestimonials: false,
      })
    }

    session.flash('success', `${templateConfig.name} template applied!`)
    return response.redirect().toRoute('settings.theme')
  }

  async customize({ view, auth }: HttpContext) {
    const user = auth.user!
    if (!user.businessId) {
      throw new Error('User has no business associated')
    }
    const business = await Business.query()
      .where('id', user.businessId)
      .preload('theme')
      .firstOrFail()

    if (!business.theme) {
      await BusinessTheme.create({
        businessId: business.id,
        template: 'modern',
        primaryColor: '#2563eb',
        secondaryColor: '#f8fafc',
        accentColor: '#f59e0b',
        textColor: '#1c1917',
        backgroundColor: '#ffffff',
        fontHeading: 'Inter',
        fontBody: 'Inter',
        heroStyle: 'gradient',
        heroGradient: 'from-primary/10 to-primary/5',
        buttonStyle: 'rounded',
        cardStyle: 'elevated',
        showGallery: true,
        showAbout: true,
        showTestimonials: false,
      })
      await business.load('theme')
    }

    return view.render('pages/settings/theme/customize', {
      business,
      theme: business.theme,
      templates: BusinessTheme.TEMPLATES,
      fonts: BusinessTheme.FONTS,
    })
  }

  async updateCustomization({ request, response, auth, session }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    const data = await request.validateUsing(themeValidator)

    let theme = await BusinessTheme.findBy('businessId', business.id)

    if (theme) {
      theme.merge(data)
      await theme.save()
    } else {
      theme = await BusinessTheme.create({
        businessId: business.id,
        ...data,
      })
    }

    session.flash('success', 'Theme customization saved!')
    return response.redirect().toRoute('settings.theme.customize')
  }

  async content({ view, auth }: HttpContext) {
    const user = auth.user!
    if (!user.businessId) {
      throw new Error('User has no business associated')
    }
    const business = await Business.query()
      .where('id', user.businessId)
      .preload('theme')
      .firstOrFail()

    return view.render('pages/settings/theme/content', {
      business,
      theme: business.theme,
    })
  }

  async updateContent({ request, response, auth, session }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    const { tagline, aboutText, galleryImages } = request.only([
      'tagline',
      'aboutText',
      'galleryImages',
    ])

    let theme = await BusinessTheme.findBy('businessId', business.id)

    if (theme) {
      theme.merge({
        tagline: tagline || null,
        aboutText: aboutText || null,
        galleryImages: galleryImages ? galleryImages.split(',').filter(Boolean) : null,
      })
      await theme.save()
    }

    session.flash('success', 'Content updated!')
    return response.redirect().toRoute('settings.theme.content')
  }

  async socialLinks({ view, auth }: HttpContext) {
    const user = auth.user!
    if (!user.businessId) {
      throw new Error('User has no business associated')
    }
    const business = await Business.query()
      .where('id', user.businessId)
      .preload('theme')
      .firstOrFail()

    return view.render('pages/settings/theme/social', {
      business,
      theme: business.theme,
    })
  }

  async updateSocialLinks({ request, response, auth, session }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    const data = await request.validateUsing(socialLinksValidator)

    let theme = await BusinessTheme.findBy('businessId', business.id)

    if (theme) {
      theme.socialLinks = data
      await theme.save()
    }

    session.flash('success', 'Social links updated!')
    return response.redirect().toRoute('settings.theme.social')
  }

  async preview({ auth, response }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    return response.redirect(`/book/${business.slug}?preview=true`)
  }
}
