import { google, Auth, calendar_v3 } from 'googleapis'
import { DateTime } from 'luxon'
import env from '#start/env'
import Business from '#models/business'
import Booking from '#models/booking'

class GoogleCalendarService {
  /**
   * Get client ID (lazy loaded)
   */
  private get clientId(): string {
    return env.get('GOOGLE_CLIENT_ID', '')
  }

  /**
   * Get client secret (lazy loaded)
   */
  private get clientSecret(): string {
    return env.get('GOOGLE_CLIENT_SECRET', '')
  }

  /**
   * Get redirect URI (lazy loaded)
   */
  private get redirectUri(): string {
    const appUrl = env.get('APP_URL', 'http://localhost:3333')
    return `${appUrl}/settings/integrations/google/callback`
  }

  /**
   * Check if Google Calendar is configured
   */
  isConfigured(): boolean {
    return !!this.clientId && !!this.clientSecret
  }

  /**
   * Create OAuth2 client
   */
  private createOAuth2Client(): Auth.OAuth2Client {
    return new google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri)
  }

  /**
   * Get authorization URL for Google OAuth
   */
  getAuthorizationUrl(state: string): string {
    const oauth2Client = this.createOAuth2Client()

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      state,
    })
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(
    code: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresAt: DateTime }> {
    const oauth2Client = this.createOAuth2Client()

    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Failed to get tokens from Google')
    }

    const expiresAt = tokens.expiry_date
      ? DateTime.fromMillis(tokens.expiry_date)
      : DateTime.now().plus({ hours: 1 })

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(
    refreshToken: string
  ): Promise<{ accessToken: string; expiresAt: DateTime }> {
    const oauth2Client = this.createOAuth2Client()
    oauth2Client.setCredentials({ refresh_token: refreshToken })

    const { credentials } = await oauth2Client.refreshAccessToken()

    if (!credentials.access_token) {
      throw new Error('Failed to refresh access token')
    }

    const expiresAt = credentials.expiry_date
      ? DateTime.fromMillis(credentials.expiry_date)
      : DateTime.now().plus({ hours: 1 })

    return {
      accessToken: credentials.access_token,
      expiresAt,
    }
  }

  /**
   * Get authenticated OAuth2 client for a business
   */
  private async getAuthenticatedClient(business: Business): Promise<Auth.OAuth2Client> {
    if (!business.googleAccessToken || !business.googleRefreshToken) {
      throw new Error('Business is not connected to Google Calendar')
    }

    const oauth2Client = this.createOAuth2Client()
    oauth2Client.setCredentials({
      access_token: business.googleAccessToken,
      refresh_token: business.googleRefreshToken,
    })

    // Check if token is expired or about to expire (within 5 minutes)
    const tokenExpired =
      !business.googleTokenExpiresAt ||
      business.googleTokenExpiresAt < DateTime.now().plus({ minutes: 5 })

    if (tokenExpired) {
      try {
        const { accessToken, expiresAt } = await this.refreshAccessToken(
          business.googleRefreshToken
        )
        business.googleAccessToken = accessToken
        business.googleTokenExpiresAt = expiresAt
        await business.save()

        oauth2Client.setCredentials({
          access_token: accessToken,
          refresh_token: business.googleRefreshToken,
        })
      } catch (error) {
        console.error('[Google Calendar] Failed to refresh token:', error)
        // Disable Google Calendar if token refresh fails
        business.googleCalendarEnabled = false
        await business.save()
        throw new Error('Google Calendar authentication expired. Please reconnect.')
      }
    }

    return oauth2Client
  }

  /**
   * Get Calendar API instance
   */
  private async getCalendarApi(business: Business): Promise<calendar_v3.Calendar> {
    const auth = await this.getAuthenticatedClient(business)
    return google.calendar({ version: 'v3', auth })
  }

  /**
   * List available calendars for the business
   */
  async listCalendars(
    business: Business
  ): Promise<Array<{ id: string; summary: string; primary: boolean }>> {
    const calendar = await this.getCalendarApi(business)

    const response = await calendar.calendarList.list()

    return (
      response.data.items?.map((cal: any) => ({
        id: cal.id || '',
        summary: cal.summary || 'Unnamed Calendar',
        primary: cal.primary || false,
      })) || []
    )
  }

  /**
   * Create a calendar event for a booking
   */
  async createBookingEvent(
    business: Business,
    booking: Booking
  ): Promise<{ eventId: string; eventLink: string } | null> {
    if (!business.googleCalendarEnabled || !business.googleCalendarId) {
      return null
    }

    try {
      const calendar = await this.getCalendarApi(business)

      // Load service and staff if not loaded
      await booking.load('service')
      await booking.load('staff')

      const startDateTime = booking.date.set({
        hour: Number.parseInt(booking.startTime.split(':')[0]),
        minute: Number.parseInt(booking.startTime.split(':')[1]),
      })

      const endDateTime = booking.date.set({
        hour: Number.parseInt(booking.endTime.split(':')[0]),
        minute: Number.parseInt(booking.endTime.split(':')[1]),
      })

      const event: calendar_v3.Schema$Event = {
        summary: `${booking.service.name} - ${booking.customerName}`,
        description: `
Booking Details:
- Customer: ${booking.customerName}
- Email: ${booking.customerEmail}
- Phone: ${booking.customerPhone || 'N/A'}
- Service: ${booking.service.name}
- Amount: ₦${booking.amount.toLocaleString()}
${booking.staff ? `- Staff: ${booking.staff.fullName}` : ''}
${booking.notes ? `- Notes: ${booking.notes}` : ''}

Booking Reference: ${booking.paymentReference?.substring(0, 8).toUpperCase() || 'N/A'}
        `.trim(),
        start: {
          dateTime: startDateTime.toISO(),
          timeZone: business.timezone || 'Africa/Lagos',
        },
        end: {
          dateTime: endDateTime.toISO(),
          timeZone: business.timezone || 'Africa/Lagos',
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 60 },
            { method: 'popup', minutes: 15 },
          ],
        },
      }

      const response = await calendar.events.insert({
        calendarId: business.googleCalendarId,
        requestBody: event,
      })

      return {
        eventId: response.data.id || '',
        eventLink: response.data.htmlLink || '',
      }
    } catch (error) {
      console.error('[Google Calendar] Failed to create event:', error)
      return null
    }
  }

  /**
   * Update a calendar event
   */
  async updateBookingEvent(
    business: Business,
    booking: Booking,
    eventId: string
  ): Promise<boolean> {
    if (!business.googleCalendarEnabled || !business.googleCalendarId) {
      return false
    }

    try {
      const calendar = await this.getCalendarApi(business)

      await booking.load('service')
      await booking.load('staff')

      const startDateTime = booking.date.set({
        hour: Number.parseInt(booking.startTime.split(':')[0]),
        minute: Number.parseInt(booking.startTime.split(':')[1]),
      })

      const endDateTime = booking.date.set({
        hour: Number.parseInt(booking.endTime.split(':')[0]),
        minute: Number.parseInt(booking.endTime.split(':')[1]),
      })

      const event: calendar_v3.Schema$Event = {
        summary: `${booking.service.name} - ${booking.customerName}`,
        description: `
Booking Details:
- Customer: ${booking.customerName}
- Email: ${booking.customerEmail}
- Phone: ${booking.customerPhone || 'N/A'}
- Service: ${booking.service.name}
- Amount: ₦${booking.amount.toLocaleString()}
${booking.staff ? `- Staff: ${booking.staff.fullName}` : ''}
${booking.notes ? `- Notes: ${booking.notes}` : ''}

Booking Reference: ${booking.paymentReference?.substring(0, 8).toUpperCase() || 'N/A'}
        `.trim(),
        start: {
          dateTime: startDateTime.toISO(),
          timeZone: business.timezone || 'Africa/Lagos',
        },
        end: {
          dateTime: endDateTime.toISO(),
          timeZone: business.timezone || 'Africa/Lagos',
        },
      }

      await calendar.events.update({
        calendarId: business.googleCalendarId,
        eventId,
        requestBody: event,
      })

      return true
    } catch (error) {
      console.error('[Google Calendar] Failed to update event:', error)
      return false
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteBookingEvent(business: Business, eventId: string): Promise<boolean> {
    if (!business.googleCalendarEnabled || !business.googleCalendarId) {
      return false
    }

    try {
      const calendar = await this.getCalendarApi(business)

      await calendar.events.delete({
        calendarId: business.googleCalendarId,
        eventId,
      })

      return true
    } catch (error) {
      console.error('[Google Calendar] Failed to delete event:', error)
      return false
    }
  }

  /**
   * Get busy times from Google Calendar for a date range
   * Used to block slots that are already busy on the calendar
   */
  async getBusyTimes(
    business: Business,
    startDate: DateTime,
    endDate: DateTime
  ): Promise<Array<{ start: DateTime; end: DateTime }>> {
    if (!business.googleCalendarEnabled || !business.googleCalendarId) {
      return []
    }

    try {
      const calendar = await this.getCalendarApi(business)

      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin: startDate.toISO(),
          timeMax: endDate.toISO(),
          items: [{ id: business.googleCalendarId }],
        },
      })

      const busyTimes = response.data.calendars?.[business.googleCalendarId]?.busy || []

      return busyTimes
        .filter((busy: any) => busy.start && busy.end)
        .map((busy: any) => ({
          start: DateTime.fromISO(busy.start!),
          end: DateTime.fromISO(busy.end!),
        }))
    } catch (error) {
      console.error('[Google Calendar] Failed to get busy times:', error)
      return []
    }
  }

  /**
   * Disconnect Google Calendar
   */
  async disconnect(business: Business): Promise<void> {
    business.googleCalendarEnabled = false
    business.googleAccessToken = null
    business.googleRefreshToken = null
    business.googleTokenExpiresAt = null
    business.googleCalendarId = null
    await business.save()
  }
}

export default new GoogleCalendarService()
