import type { HttpContext } from '@adonisjs/core/http'
import Business from '#models/business'
import googleCalendarService from '#services/google-calendar-service'

export default class GoogleCalendarController {
  /**
   * Show Google Calendar integration settings
   */
  async show({ view, auth }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    const isConfigured = googleCalendarService.isConfigured()

    let calendars: Array<{ id: string; summary: string; primary: boolean }> = []
    if (business.googleCalendarEnabled && business.googleAccessToken) {
      try {
        calendars = await googleCalendarService.listCalendars(business)
      } catch (error) {
        console.error('[Google Calendar] Failed to list calendars:', error)
      }
    }

    return view.render('pages/settings/google-calendar', {
      business,
      isConfigured,
      calendars,
    })
  }

  /**
   * Start Google OAuth flow
   */
  async connect({ response, auth, session }: HttpContext) {
    const user = auth.user!

    if (!googleCalendarService.isConfigured()) {
      session.flash('error', 'Google Calendar is not configured. Please contact support.')
      return response.redirect().back()
    }

    // Generate a state token to prevent CSRF
    const state = `${user.businessId}-${Date.now()}`
    session.put('google_oauth_state', state)

    const authUrl = googleCalendarService.getAuthorizationUrl(state)
    return response.redirect(authUrl)
  }

  /**
   * Handle OAuth callback from Google
   */
  async callback({ request, response, auth, session }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    const code = request.qs().code
    const state = request.qs().state
    const error = request.qs().error

    if (error) {
      session.flash('error', 'Google Calendar authorization was denied.')
      return response.redirect().toRoute('settings.google-calendar')
    }

    // Verify state to prevent CSRF
    const savedState = session.get('google_oauth_state')
    if (!state || state !== savedState) {
      session.flash('error', 'Invalid authorization state. Please try again.')
      return response.redirect().toRoute('settings.google-calendar')
    }

    session.forget('google_oauth_state')

    if (!code) {
      session.flash('error', 'No authorization code received from Google.')
      return response.redirect().toRoute('settings.google-calendar')
    }

    try {
      const tokens = await googleCalendarService.getTokensFromCode(code)

      business.googleAccessToken = tokens.accessToken
      business.googleRefreshToken = tokens.refreshToken
      business.googleTokenExpiresAt = tokens.expiresAt
      business.googleCalendarEnabled = true

      // Set default calendar to primary
      const calendars = await googleCalendarService.listCalendars(business)
      const primaryCalendar = calendars.find((cal) => cal.primary)
      if (primaryCalendar) {
        business.googleCalendarId = primaryCalendar.id
      }

      await business.save()

      session.flash('success', 'Google Calendar connected successfully!')
    } catch (error) {
      console.error('[Google Calendar] OAuth callback error:', error)
      session.flash('error', 'Failed to connect Google Calendar. Please try again.')
    }

    return response.redirect().toRoute('settings.google-calendar')
  }

  /**
   * Update calendar selection
   */
  async updateCalendar({ request, response, auth, session }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    const calendarId = request.input('calendarId')

    if (!business.googleCalendarEnabled) {
      session.flash('error', 'Google Calendar is not connected.')
      return response.redirect().back()
    }

    business.googleCalendarId = calendarId || null
    await business.save()

    session.flash('success', 'Calendar updated successfully.')
    return response.redirect().back()
  }

  /**
   * Disconnect Google Calendar
   */
  async disconnect({ response, auth, session }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    await googleCalendarService.disconnect(business)

    session.flash('success', 'Google Calendar disconnected.')
    return response.redirect().toRoute('settings.google-calendar')
  }
}
