import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import TimeOff from '#models/time-off'
import User from '#models/user'
import Business from '#models/business'
import { timeOffValidator } from '#validators/time-off-validator'
import { errors } from '@vinejs/vine'

export default class TimeOffController {
  async index({ view, auth }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    const timeOffs = await TimeOff.query()
      .where('businessId', business.id)
      .preload('user')
      .orderBy('startDatetime', 'desc')

    const staff = await User.query()
      .where('businessId', business.id)
      .where('isActive', true)
      .orderBy('fullName')

    const upcomingTimeOffs = timeOffs.filter((t) => t.endDatetime >= DateTime.now())
    const pastTimeOffs = timeOffs.filter((t) => t.endDatetime < DateTime.now())

    return view.render('pages/time-off/index', {
      upcomingTimeOffs,
      pastTimeOffs,
      staff,
      business,
    })
  }

  async create({ view, auth }: HttpContext) {
    const user = auth.user!

    const staff = await User.query()
      .where('businessId', user.businessId!)
      .where('isActive', true)
      .orderBy('fullName')

    return view.render('pages/time-off/create', { staff })
  }

  async store({ request, response, auth, session }: HttpContext) {
    const user = auth.user!

    try {
      const data = await request.validateUsing(timeOffValidator)

      let startDatetime: DateTime
      let endDatetime: DateTime

      if (data.isAllDay) {
        startDatetime = DateTime.fromISO(data.startDate).startOf('day')
        endDatetime = DateTime.fromISO(data.endDate).endOf('day')
      } else {
        startDatetime = DateTime.fromISO(`${data.startDate}T${data.startTime}`)
        endDatetime = DateTime.fromISO(`${data.endDate}T${data.endTime}`)
      }

      if (endDatetime <= startDatetime) {
        session.flash('error', 'End date/time must be after start date/time')
        session.flashAll()
        return response.redirect().back()
      }

      await TimeOff.create({
        businessId: user.businessId!,
        userId: data.userId || null,
        title: data.title || null,
        startDatetime,
        endDatetime,
        isAllDay: data.isAllDay,
      })

      session.flash('success', 'Time off added successfully')
      return response.redirect().toRoute('time-off.index')
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        session.flash('error', 'Please fill in all required fields')
        session.flashAll()
        return response.redirect().back()
      }
      throw error
    }
  }

  async edit({ params, view, auth, response }: HttpContext) {
    const user = auth.user!

    const timeOff = await TimeOff.query()
      .where('id', params.id)
      .where('businessId', user.businessId!)
      .first()

    if (!timeOff) {
      return response.notFound('Time off not found')
    }

    const staff = await User.query()
      .where('businessId', user.businessId!)
      .where('isActive', true)
      .orderBy('fullName')

    return view.render('pages/time-off/edit', { timeOff, staff })
  }

  async update({ params, request, response, auth, session }: HttpContext) {
    const user = auth.user!

    const timeOff = await TimeOff.query()
      .where('id', params.id)
      .where('businessId', user.businessId!)
      .first()

    if (!timeOff) {
      return response.notFound('Time off not found')
    }

    try {
      const data = await request.validateUsing(timeOffValidator)

      let startDatetime: DateTime
      let endDatetime: DateTime

      if (data.isAllDay) {
        startDatetime = DateTime.fromISO(data.startDate).startOf('day')
        endDatetime = DateTime.fromISO(data.endDate).endOf('day')
      } else {
        startDatetime = DateTime.fromISO(`${data.startDate}T${data.startTime}`)
        endDatetime = DateTime.fromISO(`${data.endDate}T${data.endTime}`)
      }

      if (endDatetime <= startDatetime) {
        session.flash('error', 'End date/time must be after start date/time')
        return response.redirect().back()
      }

      timeOff.merge({
        userId: data.userId || null,
        title: data.title || null,
        startDatetime,
        endDatetime,
        isAllDay: data.isAllDay,
      })
      await timeOff.save()

      session.flash('success', 'Time off updated successfully')
      return response.redirect().toRoute('time-off.index')
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        session.flash('error', 'Please fill in all required fields')
        return response.redirect().back()
      }
      throw error
    }
  }

  async destroy({ params, response, auth, session }: HttpContext) {
    const user = auth.user!

    const timeOff = await TimeOff.query()
      .where('id', params.id)
      .where('businessId', user.businessId!)
      .first()

    if (!timeOff) {
      return response.notFound('Time off not found')
    }

    await timeOff.delete()

    session.flash('success', 'Time off deleted')
    return response.redirect().toRoute('time-off.index')
  }
}
