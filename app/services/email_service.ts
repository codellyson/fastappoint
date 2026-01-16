import env from '#start/env'
import currencyService from './currency_service.js'

interface BookingConfirmationData {
  customerName: string
  customerEmail: string
  businessName: string
  serviceName: string
  date: string
  time: string
  duration: string
  amount: number
  currency?: string
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

interface BookingReminderData {
  customerName: string
  customerEmail: string
  businessName: string
  serviceName: string
  date: string
  time: string
  staffName?: string
  reminderType: '24h' | '1h'
  manageUrl: string
}

interface PasswordResetData {
  email: string
  name: string
  resetUrl: string
}

interface WelcomeEmailData {
  email: string
  name: string
  businessName: string
  dashboardUrl: string
}

interface BookingRescheduleData {
  customerName: string
  customerEmail: string
  businessName: string
  businessEmail: string
  serviceName: string
  oldDate: string
  oldTime: string
  newDate: string
  newTime: string
  manageUrl?: string
}

interface PaymentFailureData {
  customerName: string
  customerEmail: string
  businessName: string
  serviceName: string
  amount: number
  errorMessage: string
  bookingUrl: string
  paymentUrl: string
}

interface GenericEmailData {
  to: string
  subject: string
  templateData: {
    title: string
    preheader?: string
    content: string
  }
}

interface SubscriptionPaymentData {
  businessEmail: string
  businessName: string
  planName: string
  amount: number
  currency: string
  reference: string
}

class EmailService {
  private apiKey: string | null = null
  private fromEmail: string
  private fromName: string
  private apiUrl = 'https://api.brevo.com/v3/smtp/email'

  constructor() {
    this.apiKey = env.get('BREVO_API_KEY') || null
    this.fromEmail = env.get('FROM_EMAIL', 'noreply@fastappoint.com')
    this.fromName = env.get('FROM_NAME', 'FastAppoint')

    if (this.apiKey) {
      console.log('[EmailService] Initialized with Brevo API key')
    } else {
      console.log('[EmailService] No BREVO_API_KEY found - emails will be mocked')
    }
    console.log('[EmailService] From email:', this.fromEmail)
    console.log('[EmailService] From name:', this.fromName)
  }

  private async sendViaBrevoApi(data: {
    to: Array<{ email: string; name?: string }>
    subject: string
    htmlContent: string
  }) {
    if (!this.apiKey) {
      return { success: false, error: 'API key not configured' }
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': this.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: this.fromName,
            email: this.fromEmail,
          },
          to: data.to,
          subject: data.subject,
          htmlContent: data.htmlContent,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('[EmailService] Brevo API error:', result)
        return { success: false, error: result }
      }

      return { success: true, data: result }
    } catch (error) {
      console.error('[EmailService] Brevo API request error:', error)
      return { success: false, error }
    }
  }

  async sendBookingConfirmation(data: BookingConfirmationData) {
    const result = await this.sendViaBrevoApi({
      to: [{ email: data.customerEmail }],
      subject: `Booking Confirmed - ${data.businessName}`,
      htmlContent: this.getBookingConfirmationHtml(data),
    })

    if (result.success) {
      console.log('[EmailService] Booking confirmation sent to:', data.customerEmail)
    }

    return result
  }

  async sendBusinessNotification(data: BusinessNotificationData) {
    const result = await this.sendViaBrevoApi({
      to: [{ email: data.businessEmail }],
      subject: `New Booking - ${data.customerName}`,
      htmlContent: this.getBusinessNotificationHtml(data),
    })

    if (result.success) {
      console.log('[EmailService] Business notification sent to:', data.businessEmail)
    }

    return result
  }

  async sendBookingReminder(data: BookingReminderData) {
    const subject =
      data.reminderType === '24h'
        ? `Reminder: Your appointment tomorrow at ${data.businessName}`
        : `Reminder: Your appointment in 1 hour at ${data.businessName}`

    const result = await this.sendViaBrevoApi({
      to: [{ email: data.customerEmail }],
      subject,
      htmlContent: this.getBookingReminderHtml(data),
    })

    if (result.success) {
      console.log('[EmailService] Booking reminder sent to:', data.customerEmail)
    }

    return result
  }

  async send(data: { to: string; subject: string; html: string }) {
    const result = await this.sendViaBrevoApi({
      to: [{ email: data.to }],
      subject: data.subject,
      htmlContent: data.html,
    })

    if (result.success) {
      console.log('[EmailService] Email sent to:', data.to)
    }

    return result
  }

  async sendGenericEmail(data: GenericEmailData) {
    const result = await this.sendViaBrevoApi({
      to: [{ email: data.to }],
      subject: data.subject,
      htmlContent: this.getGenericEmailHtml(data.templateData),
    })

    if (result.success) {
      console.log('[EmailService] Generic email sent to:', data.to)
    }

    return result
  }

  async sendPaymentFailureNotification(data: PaymentFailureData) {
    const result = await this.sendViaBrevoApi({
      to: [{ email: data.customerEmail }],
      subject: `Payment Failed - ${data.businessName}`,
      htmlContent: this.getPaymentFailureHtml(data),
    })

    if (result.success) {
      console.log('[EmailService] Payment failure notification sent to:', data.customerEmail)
    }

    return result
  }

  async sendPasswordReset(data: PasswordResetData) {
    const result = await this.sendViaBrevoApi({
      to: [{ email: data.email }],
      subject: 'Reset Your Password - FastAppoint',
      htmlContent: this.getPasswordResetHtml(data),
    })

    if (result.success) {
      console.log('[EmailService] Password reset email sent to:', data.email)
    }

    return result
  }

  async sendWelcomeEmail(data: WelcomeEmailData) {
    const result = await this.sendViaBrevoApi({
      to: [{ email: data.email }],
      subject: 'Welcome to FastAppoint! 🎉',
      htmlContent: this.getWelcomeEmailHtml(data),
    })

    if (result.success) {
      console.log('[EmailService] Welcome email sent to:', data.email)
      if (result.data) {
        const data2 = result.data as { messageId?: string }
        if (data2.messageId) {
          console.log('[EmailService] Message ID:', data2.messageId)
        }
      }
    }

    return result
  }

  async sendBookingRescheduleNotification(data: BookingRescheduleData) {
    // Send to customer
    const customerResult = await this.sendViaBrevoApi({
      to: [{ email: data.customerEmail }],
      subject: `Booking Rescheduled - ${data.businessName}`,
      htmlContent: this.getBookingRescheduleCustomerHtml(data),
    })

    // Send to business
    const businessResult = await this.sendViaBrevoApi({
      to: [{ email: data.businessEmail }],
      subject: `Booking Rescheduled - ${data.customerName}`,
      htmlContent: this.getBookingRescheduleBusinessHtml(data),
    })

    const success = customerResult.success && businessResult.success
    if (success) {
      console.log(
        '[EmailService] Booking reschedule notifications sent to:',
        data.customerEmail,
        'and',
        data.businessEmail
      )
    }

    return { success }
  }

  async sendSubscriptionPaymentConfirmation(data: SubscriptionPaymentData) {
    const result = await this.sendViaBrevoApi({
      to: [{ email: data.businessEmail }],
      subject: `Subscription Payment Received - ${data.planName}`,
      htmlContent: this.getSubscriptionPaymentHtml(data),
    })

    if (result.success) {
      console.log('[EmailService] Subscription payment confirmation sent to:', data.businessEmail)
    }

    return result
  }

  private getPasswordResetHtml(data: PasswordResetData): string {
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
        <h1 style="color: white; margin: 0; font-size: 24px;">Reset Your Password</h1>
      </div>
      <div style="padding: 30px;">
        <p style="color: #21201c; font-size: 16px; margin-bottom: 20px;">
          Hi ${data.name},
        </p>
        <p style="color: #63635e; font-size: 15px; line-height: 1.6;">
          We received a request to reset your password. Click the button below to create a new password.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${data.resetUrl}" style="display: inline-block; background: #5A45FF; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Reset Password
          </a>
        </div>
        <p style="color: #63635e; font-size: 14px; line-height: 1.6;">
          This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
        <p style="color: #82827c; font-size: 13px; margin-top: 24px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${data.resetUrl}" style="color: #5A45FF; word-break: break-all;">${data.resetUrl}</a>
        </p>
      </div>
      <div style="background: #f9f9f8; padding: 20px; text-align: center; border-top: 1px solid #e9e8e6;">
        <p style="margin: 0; color: #82827c; font-size: 13px;">
          Powered by <a href="${env.get('APP_URL', 'https://fastappoint.com')}" style="color: #5A45FF; text-decoration: none;">FastAppoint</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`
  }

  private formatAmountForEmail(amount: number, currency: string): string {
    const symbol = currencyService.getCurrencySymbol(currency)
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
              <td style="padding: 12px 0 8px; color: #5A45FF; font-size: 15px; text-align: right; font-weight: 600;">${this.formatAmountForEmail(data.amount, data.currency || 'NGN')}</td>
            </tr>
          </table>
        </div>

        <div style="background: #f0f0ff; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0; color: #21201c; font-size: 14px;">
            <strong>Reference:</strong> ${data.reference}
          </p>
        </div>

        <p style="color: #63635e; font-size: 14px; line-height: 1.6;">
          Please arrive 5 minutes before your scheduled time. Need to make changes?
        </p>

        ${
          data.bookingUrl
            ? `
        <div style="text-align: center; margin: 24px 0;">
          <a href="${data.bookingUrl}" style="display: inline-block; background: #5A45FF; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Manage Booking
          </a>
        </div>
        <p style="color: #82827c; font-size: 13px; text-align: center;">
          Reschedule or cancel your appointment online
        </p>
        `
            : ''
        }
      </div>
      <div style="background: #f9f9f8; padding: 20px; text-align: center; border-top: 1px solid #e9e8e6;">
        <p style="margin: 0; color: #82827c; font-size: 13px;">
          Powered by <a href="${env.get('APP_URL', 'https://fastappoint.com')}" style="color: #5A45FF; text-decoration: none;">FastAppoint</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`
  }

  private getBookingReminderHtml(data: BookingReminderData): string {
    const headerText =
      data.reminderType === '24h'
        ? 'Your appointment is tomorrow!'
        : 'Your appointment is in 1 hour!'

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
      <div style="background: #f59e0b; padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">⏰ ${headerText}</h1>
      </div>
      <div style="padding: 30px;">
        <p style="color: #21201c; font-size: 16px; margin-bottom: 20px;">
          Hi ${data.customerName},
        </p>
        <p style="color: #63635e; font-size: 15px; line-height: 1.6;">
          This is a friendly reminder about your upcoming appointment at <strong>${data.businessName}</strong>.
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
            ${
              data.staffName
                ? `
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">With</td>
              <td style="padding: 8px 0; color: #21201c; font-size: 14px; text-align: right; font-weight: 500;">${data.staffName}</td>
            </tr>
            `
                : ''
            }
          </table>
        </div>

        <p style="color: #63635e; font-size: 14px; line-height: 1.6;">
          Please arrive 5 minutes before your scheduled time. If you need to cancel or reschedule, please do so as soon as possible.
        </p>
      </div>
      <div style="background: #f9f9f8; padding: 20px; text-align: center; border-top: 1px solid #e9e8e6;">
        <p style="margin: 0; color: #82827c; font-size: 13px;">
          Powered by <a href="${env.get('APP_URL', 'https://fastappoint.com')}" style="color: #5A45FF; text-decoration: none;">FastAppoint</a>
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
          Powered by <a href="${env.get('APP_URL', 'https://fastappoint.com')}" style="color: #5A45FF; text-decoration: none;">FastAppoint</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`
  }

  private getWelcomeEmailHtml(data: WelcomeEmailData): string {
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
        <div style="margin-bottom: 12px;">
          <span style="color: white; font-size: 28px; font-weight: 700; letter-spacing: -1px;">FastAppoint</span>
        </div>
        <h1 style="color: white; margin: 0; font-size: 24px;">Welcome! 🎉</h1>
      </div>
      <div style="padding: 30px;">
        <p style="color: #21201c; font-size: 16px; margin-bottom: 20px;">
          Hi ${data.name},
        </p>
        <p style="color: #63635e; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
          Welcome to FastAppoint! We're excited to have you and <strong>${data.businessName}</strong> on board.
        </p>
        <p style="color: #63635e; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
          You now have a <strong>5-day free trial</strong> to explore all our features. Get started by setting up your booking page and adding your services.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${data.dashboardUrl}" style="display: inline-block; background: #5A45FF; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Go to Dashboard
          </a>
        </div>
        <div style="background: #f0f0ff; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <h3 style="margin: 0 0 12px; color: #21201c; font-size: 15px;">What's next?</h3>
          <ul style="margin: 0; padding-left: 20px; color: #63635e; font-size: 14px; line-height: 1.8;">
            <li>Complete your business profile</li>
            <li>Add your services and pricing</li>
            <li>Set up your availability</li>
            <li>Customize your booking page</li>
            <li>Start accepting bookings!</li>
          </ul>
        </div>
        <p style="color: #63635e; font-size: 14px; line-height: 1.6;">
          If you have any questions, feel free to reach out. We're here to help you succeed!
        </p>
      </div>
      <div style="background: #f9f9f8; padding: 20px; text-align: center; border-top: 1px solid #e9e8e6;">
        <p style="margin: 0; color: #82827c; font-size: 13px;">
          Powered by <a href="${env.get('APP_URL', 'https://fastappoint.com')}" style="color: #5A45FF; text-decoration: none;">FastAppoint</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`
  }

  private getBookingRescheduleCustomerHtml(data: BookingRescheduleData): string {
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
      <div style="background: #f59e0b; padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Booking Rescheduled ✓</h1>
      </div>
      <div style="padding: 30px;">
        <p style="color: #21201c; font-size: 16px; margin-bottom: 20px;">
          Hi ${data.customerName},
        </p>
        <p style="color: #63635e; font-size: 15px; line-height: 1.6;">
          Your booking with <strong>${data.businessName}</strong> has been rescheduled.
        </p>

        <div style="background: #f9f9f8; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <h3 style="margin: 0 0 16px; color: #21201c; font-size: 15px;">Previous Appointment</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">Date</td>
              <td style="padding: 8px 0; color: #21201c; font-size: 14px; text-align: right; font-weight: 500;">${data.oldDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">Time</td>
              <td style="padding: 8px 0; color: #21201c; font-size: 14px; text-align: right; font-weight: 500;">${data.oldTime}</td>
            </tr>
          </table>
        </div>

        <div style="background: #f0f0ff; border-radius: 12px; padding: 20px; margin: 24px 0; border: 2px solid #5A45FF;">
          <h3 style="margin: 0 0 16px; color: #21201c; font-size: 15px;">New Appointment</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">Service</td>
              <td style="padding: 8px 0; color: #21201c; font-size: 14px; text-align: right; font-weight: 500;">${data.serviceName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">Date</td>
              <td style="padding: 8px 0; color: #5A45FF; font-size: 14px; text-align: right; font-weight: 600;">${data.newDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">Time</td>
              <td style="padding: 8px 0; color: #5A45FF; font-size: 14px; text-align: right; font-weight: 600;">${data.newTime}</td>
            </tr>
          </table>
        </div>

        <p style="color: #63635e; font-size: 14px; line-height: 1.6;">
          Please arrive 5 minutes before your scheduled time. If you need to make further changes, please contact the business directly.
        </p>

        ${
          data.manageUrl
            ? `
        <div style="text-align: center; margin: 24px 0;">
          <a href="${data.manageUrl}" style="display: inline-block; background: #5A45FF; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Manage Booking
          </a>
        </div>
        `
            : ''
        }
      </div>
      <div style="background: #f9f9f8; padding: 20px; text-align: center; border-top: 1px solid #e9e8e6;">
        <p style="margin: 0; color: #82827c; font-size: 13px;">
          Powered by <a href="${env.get('APP_URL', 'https://fastappoint.com')}" style="color: #5A45FF; text-decoration: none;">FastAppoint</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`
  }

  private getBookingRescheduleBusinessHtml(data: BookingRescheduleData): string {
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
      <div style="background: #f59e0b; padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Booking Rescheduled 📅</h1>
      </div>
      <div style="padding: 30px;">
        <p style="color: #21201c; font-size: 16px; margin-bottom: 20px;">
          Hi ${data.businessName},
        </p>
        <p style="color: #63635e; font-size: 15px; line-height: 1.6;">
          A booking from <strong>${data.customerName}</strong> has been rescheduled.
        </p>

        <div style="background: #f9f9f8; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <h3 style="margin: 0 0 16px; color: #21201c; font-size: 15px;">Previous Appointment</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">Date</td>
              <td style="padding: 8px 0; color: #21201c; font-size: 14px; text-align: right; font-weight: 500;">${data.oldDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">Time</td>
              <td style="padding: 8px 0; color: #21201c; font-size: 14px; text-align: right; font-weight: 500;">${data.oldTime}</td>
            </tr>
          </table>
        </div>

        <div style="background: #f0f0ff; border-radius: 12px; padding: 20px; margin: 24px 0; border: 2px solid #5A45FF;">
          <h3 style="margin: 0 0 16px; color: #21201c; font-size: 15px;">New Appointment</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">Service</td>
              <td style="padding: 8px 0; color: #21201c; font-size: 14px; text-align: right; font-weight: 500;">${data.serviceName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">Date</td>
              <td style="padding: 8px 0; color: #5A45FF; font-size: 14px; text-align: right; font-weight: 600;">${data.newDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">Time</td>
              <td style="padding: 8px 0; color: #5A45FF; font-size: 14px; text-align: right; font-weight: 600;">${data.newTime}</td>
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
          </table>
        </div>
      </div>
      <div style="background: #f9f9f8; padding: 20px; text-align: center; border-top: 1px solid #e9e8e6;">
        <p style="margin: 0; color: #82827c; font-size: 13px;">
          Powered by <a href="${env.get('APP_URL', 'https://fastappoint.com')}" style="color: #5A45FF; text-decoration: none;">FastAppoint</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`
  }

  private getPaymentFailureHtml(data: PaymentFailureData): string {
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
      <div style="background: #ef4444; padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Payment Failed</h1>
      </div>
      <div style="padding: 30px;">
        <p style="color: #21201c; font-size: 16px; margin-bottom: 20px;">
          Hi ${data.customerName},
        </p>
        <p style="color: #63635e; font-size: 15px; line-height: 1.6;">
          We encountered an issue processing your payment for your booking with <strong>${data.businessName}</strong>.
        </p>

        <div style="background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="margin: 0; color: #991b1b; font-size: 14px;">
            <strong>Error:</strong> ${data.errorMessage}
          </p>
        </div>

        <div style="background: #f9f9f8; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">Service</td>
              <td style="padding: 8px 0; color: #21201c; font-size: 14px; text-align: right; font-weight: 500;">${data.serviceName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">Amount</td>
              <td style="padding: 8px 0; color: #21201c; font-size: 14px; text-align: right; font-weight: 500;">₦${data.amount.toLocaleString()}</td>
            </tr>
          </table>
        </div>

        <p style="color: #63635e; font-size: 14px; line-height: 1.6;">
          <strong>What to do next:</strong>
        </p>
        <ul style="color: #63635e; font-size: 14px; line-height: 1.8; padding-left: 20px;">
          <li>Check that your payment method has sufficient funds</li>
          <li>Verify your card details are correct</li>
          <li>Try using a different payment method</li>
          <li>Contact your bank if the issue persists</li>
        </ul>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${data.paymentUrl}" style="display: inline-block; background: #5A45FF; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Try Payment Again
          </a>
        </div>

        <p style="color: #82827c; font-size: 13px; line-height: 1.6;">
          If you continue to experience issues, please contact <strong>${data.businessName}</strong> directly or reach out to our support team.
        </p>
      </div>
      <div style="background: #f9f9f8; padding: 20px; text-align: center; border-top: 1px solid #e9e8e6;">
        <p style="margin: 0; color: #82827c; font-size: 13px;">
          Powered by <a href="${env.get('APP_URL', 'https://fastappoint.com')}" style="color: #5A45FF; text-decoration: none;">FastAppoint</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`
  }

  private getGenericEmailHtml(data: {
    title: string
    preheader?: string
    content: string
  }): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${data.preheader ? `<meta name="description" content="${data.preheader}">` : ''}
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9f9f8;">
  ${data.preheader ? `<div style="display: none; max-height: 0; overflow: hidden;">${data.preheader}</div>` : ''}
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="background: #5A45FF; padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">${data.title}</h1>
      </div>
      <div style="padding: 30px; color: #21201c; font-size: 15px; line-height: 1.6;">
        ${data.content}
      </div>
      <div style="background: #f9f9f8; padding: 20px; text-align: center; border-top: 1px solid #e9e8e6;">
        <p style="margin: 0; color: #82827c; font-size: 13px;">
          Powered by <a href="${env.get('APP_URL', 'https://fastappoint.com')}" style="color: #5A45FF; text-decoration: none;">FastAppoint</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`
  }

  private getSubscriptionPaymentHtml(data: SubscriptionPaymentData): string {
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
        <h1 style="color: white; margin: 0; font-size: 24px;">Payment Received! 💰</h1>
      </div>
      <div style="padding: 30px;">
        <p style="color: #21201c; font-size: 16px; margin-bottom: 20px;">
          Hi ${data.businessName},
        </p>
        <p style="color: #63635e; font-size: 15px; line-height: 1.6;">
          Great news! Your subscription payment has been successfully processed.
        </p>

        <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin: 24px 0; border: 2px solid #10b981;">
          <h3 style="margin: 0 0 16px; color: #21201c; font-size: 15px;">Payment Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">Plan</td>
              <td style="padding: 8px 0; color: #21201c; font-size: 14px; text-align: right; font-weight: 500;">${data.planName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">Amount</td>
              <td style="padding: 8px 0; color: #10b981; font-size: 14px; text-align: right; font-weight: 600;">${this.formatAmountForEmail(data.amount, data.currency)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #63635e; font-size: 14px;">Reference</td>
              <td style="padding: 8px 0; color: #21201c; font-size: 12px; text-align: right; font-family: monospace;">${data.reference}</td>
            </tr>
          </table>
        </div>

        <div style="background: #f0f0ff; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="margin: 0; color: #21201c; font-size: 14px; line-height: 1.6;">
            <strong>What's Next?</strong><br>
            Your subscription is now active and you can continue accepting bookings without interruption. You can view your subscription details and payment history in your dashboard.
          </p>
        </div>

        <p style="color: #63635e; font-size: 14px; line-height: 1.6;">
          Thank you for your continued trust in FastAppoint. We're here to help your business grow!
        </p>
      </div>
      <div style="background: #f9f9f8; padding: 20px; text-align: center; border-top: 1px solid #e9e8e6;">
        <p style="margin: 0; color: #82827c; font-size: 13px;">
          Powered by <a href="${env.get('APP_URL', 'https://fastappoint.com')}" style="color: #5A45FF; text-decoration: none;">FastAppoint</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`
  }
}

export default new EmailService()
