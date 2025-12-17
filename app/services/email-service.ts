import { Resend } from 'resend'
import env from '#start/env'

interface BookingConfirmationData {
  customerName: string
  customerEmail: string
  businessName: string
  serviceName: string
  date: string
  time: string
  duration: string
  amount: number
  reference: string
  bookingUrl?: string
}

interface BusinessNotificationData {
  businessEmail: string
  businessName: string
  customerName: string
  customerEmail: string
  customerPhone?: string | null
  serviceName: string
  date: string
  time: string
  amount: number
}

class EmailService {
  private resend: Resend | null = null
  private fromEmail: string

  constructor() {
    const apiKey = env.get('RESEND_API_KEY')
    this.fromEmail = env.get('FROM_EMAIL', 'noreply@bookme.ng')

    if (apiKey) {
      this.resend = new Resend(apiKey)
    }
  }

  async sendBookingConfirmation(data: BookingConfirmationData) {
    if (!this.resend) {
      console.log('[Email Mock] Booking confirmation to:', data.customerEmail)
      console.log('[Email Mock] Data:', JSON.stringify(data, null, 2))
      return { success: true, mock: true }
    }

    try {
      const result = await this.resend.emails.send({
        from: `BookMe <${this.fromEmail}>`,
        to: data.customerEmail,
        subject: `Booking Confirmed - ${data.businessName}`,
        html: this.getBookingConfirmationHtml(data),
      })
      return { success: true, data: result }
    } catch (error) {
      console.error('Email send error:', error)
      return { success: false, error }
    }
  }

  async sendBusinessNotification(data: BusinessNotificationData) {
    if (!this.resend) {
      console.log('[Email Mock] Business notification to:', data.businessEmail)
      console.log('[Email Mock] Data:', JSON.stringify(data, null, 2))
      return { success: true, mock: true }
    }

    try {
      const result = await this.resend.emails.send({
        from: `BookMe <${this.fromEmail}>`,
        to: data.businessEmail,
        subject: `New Booking - ${data.customerName}`,
        html: this.getBusinessNotificationHtml(data),
      })
      return { success: true, data: result }
    } catch (error) {
      console.error('Email send error:', error)
      return { success: false, error }
    }
  }

  private getBookingConfirmationHtml(data: BookingConfirmationData): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9f9f8;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="background: #5A45FF; padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Booking Confirmed! ✓</h1>
      </div>
      <div style="padding: 30px;">
        <p style="color: #21201c; font-size: 16px; margin-bottom: 20px;">
          Hi ${data.customerName},
        </p>
        <p style="color: #63635e; font-size: 15px; line-height: 1.6;">
          Your booking with <strong>${data.businessName}</strong> has been confirmed.
        </p>

        <div style="background: #f9f9f8; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">Service</td>
              <td style="padding: 8px 0; color: #21201c; font-size: 14px; text-align: right; font-weight: 500;">${data.serviceName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">Date</td>
              <td style="padding: 8px 0; color: #21201c; font-size: 14px; text-align: right; font-weight: 500;">${data.date}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">Time</td>
              <td style="padding: 8px 0; color: #21201c; font-size: 14px; text-align: right; font-weight: 500;">${data.time}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">Duration</td>
              <td style="padding: 8px 0; color: #21201c; font-size: 14px; text-align: right; font-weight: 500;">${data.duration}</td>
            </tr>
            <tr style="border-top: 1px solid #e9e8e6;">
              <td style="padding: 12px 0 8px; color: #21201c; font-size: 15px; font-weight: 600;">Total Paid</td>
              <td style="padding: 12px 0 8px; color: #5A45FF; font-size: 15px; text-align: right; font-weight: 600;">₦${data.amount.toLocaleString()}</td>
            </tr>
          </table>
        </div>

        <div style="background: #f0f0ff; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0; color: #21201c; font-size: 14px;">
            <strong>Reference:</strong> ${data.reference}
          </p>
        </div>

        <p style="color: #63635e; font-size: 14px; line-height: 1.6;">
          Please arrive 5 minutes before your scheduled time. If you need to cancel or reschedule, please contact the business directly.
        </p>
      </div>
      <div style="background: #f9f9f8; padding: 20px; text-align: center; border-top: 1px solid #e9e8e6;">
        <p style="margin: 0; color: #82827c; font-size: 13px;">
          Powered by <a href="https://bookme.ng" style="color: #5A45FF; text-decoration: none;">BookMe</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`
  }

  private getBusinessNotificationHtml(data: BusinessNotificationData): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9f9f8;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="background: #10b981; padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">New Booking! 🎉</h1>
      </div>
      <div style="padding: 30px;">
        <p style="color: #21201c; font-size: 16px; margin-bottom: 20px;">
          Hi ${data.businessName},
        </p>
        <p style="color: #63635e; font-size: 15px; line-height: 1.6;">
          You have a new booking from <strong>${data.customerName}</strong>.
        </p>

        <div style="background: #f9f9f8; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <h3 style="margin: 0 0 16px; color: #21201c; font-size: 15px;">Booking Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">Service</td>
              <td style="padding: 8px 0; color: #21201c; font-size: 14px; text-align: right; font-weight: 500;">${data.serviceName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">Date</td>
              <td style="padding: 8px 0; color: #21201c; font-size: 14px; text-align: right; font-weight: 500;">${data.date}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">Time</td>
              <td style="padding: 8px 0; color: #21201c; font-size: 14px; text-align: right; font-weight: 500;">${data.time}</td>
            </tr>
            <tr style="border-top: 1px solid #e9e8e6;">
              <td style="padding: 12px 0 8px; color: #21201c; font-size: 15px; font-weight: 600;">Amount</td>
              <td style="padding: 12px 0 8px; color: #10b981; font-size: 15px; text-align: right; font-weight: 600;">₦${data.amount.toLocaleString()}</td>
            </tr>
          </table>
        </div>

        <div style="background: #f9f9f8; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <h3 style="margin: 0 0 16px; color: #21201c; font-size: 15px;">Customer Information</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">Name</td>
              <td style="padding: 8px 0; color: #21201c; font-size: 14px; text-align: right;">${data.customerName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">Email</td>
              <td style="padding: 8px 0; color: #21201c; font-size: 14px; text-align: right;">${data.customerEmail}</td>
            </tr>
            ${
              data.customerPhone
                ? `
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">Phone</td>
              <td style="padding: 8px 0; color: #21201c; font-size: 14px; text-align: right;">${data.customerPhone}</td>
            </tr>
            `
                : ''
            }
          </table>
        </div>
      </div>
      <div style="background: #f9f9f8; padding: 20px; text-align: center; border-top: 1px solid #e9e8e6;">
        <p style="margin: 0; color: #82827c; font-size: 13px;">
          Powered by <a href="https://bookme.ng" style="color: #5A45FF; text-decoration: none;">BookMe</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`
  }
}

export default new EmailService()
