import type { HttpContext } from '@adonisjs/core/http'
import PushSubscription from '#models/push_subscription'
import pushNotificationService from '#services/push_notification_service'

export default class PushSubscriptionController {
  /**
   * Get the public VAPID key for client-side subscription
   */
  async getPublicKey({ response }: HttpContext) {
    const publicKey = pushNotificationService.getPublicVapidKey()

    if (!publicKey) {
      return response.status(500).json({
        error: 'Push notifications are not configured',
      })
    }

    return response.json({
      publicKey,
    })
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe({ request, auth, response }: HttpContext) {
    const user = auth.user!
    const { endpoint, keys, deviceName } = request.only(['endpoint', 'keys', 'deviceName'])

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return response.status(400).json({
        error: 'Invalid subscription data',
      })
    }

    try {
      // Check if subscription already exists
      let subscription = await PushSubscription.query()
        .where('endpoint', endpoint)
        .first()

      if (subscription) {
        // Update existing subscription
        subscription.userId = user.id
        subscription.setKeys(keys)
        subscription.deviceName = deviceName || null
        subscription.userAgent = request.header('user-agent') || null
        subscription.isActive = true
        await subscription.save()
      } else {
        // Create new subscription
        subscription = new PushSubscription()
        subscription.userId = user.id
        subscription.endpoint = endpoint
        subscription.setKeys(keys)
        subscription.deviceName = deviceName || null
        subscription.userAgent = request.header('user-agent') || null
        subscription.isActive = true
        await subscription.save()
      }

      return response.json({
        success: true,
        message: 'Successfully subscribed to push notifications',
      })
    } catch (error) {
      console.error('Error subscribing to push notifications:', error)
      return response.status(500).json({
        error: 'Failed to subscribe to push notifications',
      })
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe({ request, auth, response }: HttpContext) {
    const user = auth.user!
    const { endpoint } = request.only(['endpoint'])

    if (!endpoint) {
      return response.status(400).json({
        error: 'Endpoint is required',
      })
    }

    try {
      const subscription = await PushSubscription.query()
        .where('userId', user.id)
        .where('endpoint', endpoint)
        .first()

      if (subscription) {
        subscription.isActive = false
        await subscription.save()
      }

      return response.json({
        success: true,
        message: 'Successfully unsubscribed from push notifications',
      })
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error)
      return response.status(500).json({
        error: 'Failed to unsubscribe from push notifications',
      })
    }
  }

  /**
   * Get user's push subscriptions
   */
  async index({ auth, response }: HttpContext) {
    const user = auth.user!

    const subscriptions = await PushSubscription.query()
      .where('userId', user.id)
      .where('isActive', true)
      .orderBy('createdAt', 'desc')

    return response.json({
      subscriptions: subscriptions.map((sub) => ({
        id: sub.id,
        deviceName: sub.deviceName,
        createdAt: sub.createdAt,
      })),
    })
  }

  /**
   * Delete a specific subscription
   */
  async destroy({ params, auth, response }: HttpContext) {
    const user = auth.user!
    const subscriptionId = params.id

    try {
      const subscription = await PushSubscription.query()
        .where('id', subscriptionId)
        .where('userId', user.id)
        .first()

      if (!subscription) {
        return response.status(404).json({
          error: 'Subscription not found',
        })
      }

      await subscription.delete()

      return response.json({
        success: true,
        message: 'Subscription deleted successfully',
      })
    } catch (error) {
      console.error('Error deleting subscription:', error)
      return response.status(500).json({
        error: 'Failed to delete subscription',
      })
    }
  }

  /**
   * Send a test notification
   */
  async sendTest({ auth, response }: HttpContext) {
    const user = auth.user!

    try {
      const count = await pushNotificationService.sendToUser(user.id, {
        title: 'Test Notification',
        body: 'This is a test push notification from FastAppoint!',
        icon: '/logo/svg/icon.svg',
        badge: '/logo/svg/badge.svg',
        data: {
          type: 'test',
          url: '/dashboard',
        },
      })

      if (count === 0) {
        return response.status(404).json({
          error: 'No active subscriptions found',
        })
      }

      return response.json({
        success: true,
        message: `Test notification sent to ${count} device(s)`,
      })
    } catch (error) {
      console.error('Error sending test notification:', error)
      return response.status(500).json({
        error: 'Failed to send test notification',
      })
    }
  }
}
