import webpush from 'web-push'
import PushSubscription from '../models/push_subscription.js'
import env from '#start/env'

export interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  data?: Record<string, any>
  actions?: Array<{
    action: string
    title: string
    icon?: string
  }>
  tag?: string
  requireInteraction?: boolean
}

class PushNotificationService {
  constructor() {
    // Initialize web-push with VAPID keys
    const vapidPublicKey = env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = env.get('VAPID_PRIVATE_KEY')
    const vapidSubject = env.get('VAPID_SUBJECT', 'mailto:support@fastappoint.com')

    if (vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
    }
  }

  /**
   * Generate VAPID keys (run this once to generate keys for your app)
   */
  generateVapidKeys() {
    return webpush.generateVAPIDKeys()
  }

  /**
   * Get the public VAPID key for client-side subscription
   */
  getPublicVapidKey(): string {
    return env.get('VAPID_PUBLIC_KEY', '')
  }

  /**
   * Send push notification to a single subscription
   */
  async sendNotification(
    subscription: PushSubscription,
    payload: PushNotificationPayload
  ): Promise<boolean> {
    try {
      const subscriptionData = {
        endpoint: subscription.endpoint,
        keys: subscription.getKeys(),
      }

      await webpush.sendNotification(subscriptionData, JSON.stringify(payload))
      return true
    } catch (error) {
      console.error('Failed to send push notification:', error)

      // If subscription is no longer valid (410 Gone), deactivate it
      if (error.statusCode === 410) {
        subscription.isActive = false
        await subscription.save()
      }

      return false
    }
  }

  /**
   * Send push notification to a user (all their active subscriptions)
   */
  async sendToUser(userId: number, payload: PushNotificationPayload): Promise<number> {
    const subscriptions = await PushSubscription.query()
      .where('userId', userId)
      .where('isActive', true)

    let successCount = 0

    for (const subscription of subscriptions) {
      const success = await this.sendNotification(subscription, payload)
      if (success) {
        successCount++
      }
    }

    return successCount
  }

  /**
   * Send push notification to multiple users
   */
  async sendToMultipleUsers(userIds: number[], payload: PushNotificationPayload): Promise<number> {
    const subscriptions = await PushSubscription.query()
      .whereIn('userId', userIds)
      .where('isActive', true)

    let successCount = 0

    for (const subscription of subscriptions) {
      const success = await this.sendNotification(subscription, payload)
      if (success) {
        successCount++
      }
    }

    return successCount
  }

  /**
   * Send booking reminder notification
   */
  async sendBookingReminder(userId: number, bookingDetails: any) {
    const payload: PushNotificationPayload = {
      title: 'Upcoming Appointment',
      body: `You have an appointment with ${bookingDetails.businessName} at ${bookingDetails.time}`,
      icon: '/logo/svg/icon.svg',
      badge: '/logo/svg/badge.svg',
      tag: `booking-${bookingDetails.id}`,
      data: {
        type: 'booking_reminder',
        bookingId: bookingDetails.id,
        url: `/bookings/${bookingDetails.id}`,
      },
      actions: [
        {
          action: 'view',
          title: 'View Booking',
        },
      ],
      requireInteraction: true,
    }

    return await this.sendToUser(userId, payload)
  }

  /**
   * Send new booking notification to business owner
   */
  async sendNewBookingNotification(userId: number, bookingDetails: any) {
    const payload: PushNotificationPayload = {
      title: 'New Booking Received',
      body: `${bookingDetails.customerName} booked ${bookingDetails.serviceName} for ${bookingDetails.time}`,
      icon: '/logo/svg/icon.svg',
      badge: '/logo/svg/badge.svg',
      tag: `new-booking-${bookingDetails.id}`,
      data: {
        type: 'new_booking',
        bookingId: bookingDetails.id,
        url: `/dashboard/bookings/${bookingDetails.id}`,
      },
      actions: [
        {
          action: 'view',
          title: 'View Booking',
        },
        {
          action: 'manage',
          title: 'Manage',
        },
      ],
      requireInteraction: true,
    }

    return await this.sendToUser(userId, payload)
  }

  /**
   * Send payment confirmation notification
   */
  async sendPaymentConfirmation(userId: number, paymentDetails: any) {
    const payload: PushNotificationPayload = {
      title: 'Payment Received',
      body: `Payment of ${paymentDetails.amount} received for your booking`,
      icon: '/logo/svg/icon.svg',
      badge: '/logo/svg/badge.svg',
      tag: `payment-${paymentDetails.id}`,
      data: {
        type: 'payment_confirmation',
        paymentId: paymentDetails.id,
        url: `/bookings/${paymentDetails.bookingId}`,
      },
    }

    return await this.sendToUser(userId, payload)
  }

  /**
   * Send booking reschedule notification
   */
  async sendBookingRescheduled(userId: number, details: any) {
    const payload: PushNotificationPayload = {
      title: 'Booking Rescheduled',
      body: `${details.customerName} rescheduled ${details.serviceName} to ${details.newTime}`,
      icon: '/logo/svg/icon.svg',
      badge: '/logo/svg/badge.svg',
      tag: `reschedule-${details.bookingId}`,
      data: {
        type: 'booking_rescheduled',
        bookingId: details.bookingId,
        url: `/dashboard/bookings/${details.bookingId}`,
      },
      actions: [
        {
          action: 'view',
          title: 'View Booking',
        },
      ],
    }

    return await this.sendToUser(userId, payload)
  }

  /**
   * Send booking cancellation notification
   */
  async sendBookingCancelled(userId: number, details: any) {
    const payload: PushNotificationPayload = {
      title: 'Booking Cancelled',
      body: `${details.customerName} cancelled their ${details.serviceName} booking for ${details.time}`,
      icon: '/logo/svg/icon.svg',
      badge: '/logo/svg/badge.svg',
      tag: `cancel-${details.bookingId}`,
      data: {
        type: 'booking_cancelled',
        bookingId: details.bookingId,
        url: `/dashboard/bookings/${details.bookingId}`,
      },
    }

    return await this.sendToUser(userId, payload)
  }

  /**
   * Send booking completed notification
   */
  async sendBookingCompleted(userId: number, details: any) {
    const payload: PushNotificationPayload = {
      title: 'Service Completed',
      body: `Your ${details.serviceName} appointment with ${details.businessName} is complete. Thank you!`,
      icon: '/logo/svg/icon.svg',
      badge: '/logo/svg/badge.svg',
      tag: `complete-${details.bookingId}`,
      data: {
        type: 'booking_completed',
        bookingId: details.bookingId,
      },
    }

    return await this.sendToUser(userId, payload)
  }

  /**
   * Send refund processed notification
   */
  async sendRefundProcessed(userId: number, details: any) {
    const payload: PushNotificationPayload = {
      title: 'Refund Processed',
      body: `A refund of ${details.amount} has been processed for your booking`,
      icon: '/logo/svg/icon.svg',
      badge: '/logo/svg/badge.svg',
      tag: `refund-${details.bookingId}`,
      data: {
        type: 'refund_processed',
        bookingId: details.bookingId,
      },
    }

    return await this.sendToUser(userId, payload)
  }
}

export default new PushNotificationService()
