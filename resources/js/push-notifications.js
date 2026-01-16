/**
 * Push Notifications Client
 * Handles push notification subscription and management
 */

class PushNotificationManager {
  constructor() {
    this.publicKey = null
    this.isSubscribed = false
    this.registration = null
  }

  /**
   * Check if push notifications are supported
   */
  isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window
  }

  /**
   * Convert VAPID key from base64 to Uint8Array
   */
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  /**
   * Register service worker
   */
  async registerServiceWorker() {
    try {
      this.registration = await navigator.serviceWorker.register('/sw.js')
      console.log('[Push] Service Worker registered:', this.registration)
      return this.registration
    } catch (error) {
      console.error('[Push] Service Worker registration failed:', error)
      throw error
    }
  }

  /**
   * Get public VAPID key from server
   */
  async getPublicKey() {
    try {
      const response = await fetch('/api/push/public-key')
      const data = await response.json()
      this.publicKey = data.publicKey
      return this.publicKey
    } catch (error) {
      console.error('[Push] Failed to get public key:', error)
      throw error
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(deviceName = null) {
    if (!this.isSupported()) {
      throw new Error('Push notifications are not supported in this browser')
    }

    try {
      // Register service worker if not already registered
      if (!this.registration) {
        await this.registerServiceWorker()
      }

      // Get public key if not already fetched
      if (!this.publicKey) {
        await this.getPublicKey()
      }

      // Request notification permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        throw new Error('Notification permission denied')
      }

      // Subscribe to push notifications
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.publicKey),
      })

      console.log('[Push] Subscription created:', subscription)

      // Send subscription to server
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
            auth: arrayBufferToBase64(subscription.getKey('auth')),
          },
          deviceName: deviceName || this.getDeviceName(),
        }),
      })

      const data = await response.json()

      if (data.success) {
        this.isSubscribed = true
        console.log('[Push] Successfully subscribed')
        return true
      } else {
        throw new Error(data.error || 'Failed to subscribe')
      }
    } catch (error) {
      console.error('[Push] Subscription failed:', error)
      throw error
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe() {
    try {
      if (!this.registration) {
        await this.registerServiceWorker()
      }

      const subscription = await this.registration.pushManager.getSubscription()

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe()

        // Notify server
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
          }),
        })

        this.isSubscribed = false
        console.log('[Push] Successfully unsubscribed')
        return true
      }

      return false
    } catch (error) {
      console.error('[Push] Unsubscribe failed:', error)
      throw error
    }
  }

  /**
   * Check if user is currently subscribed
   */
  async checkSubscription() {
    try {
      if (!this.isSupported()) {
        return false
      }

      if (!this.registration) {
        await this.registerServiceWorker()
      }

      const subscription = await this.registration.pushManager.getSubscription()
      this.isSubscribed = subscription !== null

      return this.isSubscribed
    } catch (error) {
      console.error('[Push] Check subscription failed:', error)
      return false
    }
  }

  /**
   * Get device name for identification
   */
  getDeviceName() {
    const userAgent = navigator.userAgent
    if (/Mobile/.test(userAgent)) {
      return 'Mobile Device'
    } else if (/Tablet/.test(userAgent)) {
      return 'Tablet'
    } else {
      return 'Desktop'
    }
  }

  /**
   * Send test notification
   */
  async sendTestNotification() {
    try {
      const response = await fetch('/api/push/test', {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        console.log('[Push] Test notification sent')
        return true
      } else {
        throw new Error(data.error || 'Failed to send test notification')
      }
    } catch (error) {
      console.error('[Push] Test notification failed:', error)
      throw error
    }
  }
}

/**
 * Helper function to convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

// Export for use in other scripts
window.PushNotificationManager = PushNotificationManager

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  window.pushManager = new PushNotificationManager()
})
