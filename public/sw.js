// Service Worker for Push Notifications
const CACHE_NAME = 'fastappoint-v1'

// Install event
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...')
  self.skipWaiting()
})

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...')
  event.waitUntil(self.clients.claim())
})

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event)

  let data = {
    title: 'FastAppoint',
    body: 'You have a new notification',
    icon: '/logo/svg/icon.svg',
    badge: '/logo/svg/badge.svg',
    data: {},
  }

  // Parse the push notification data
  if (event.data) {
    try {
      data = event.data.json()
    } catch (e) {
      console.error('Error parsing push data:', e)
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/logo/svg/icon.svg',
    badge: data.badge || '/logo/svg/badge.svg',
    tag: data.tag || 'default',
    data: data.data || {},
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
    vibrate: [200, 100, 200],
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event)

  event.notification.close()

  const urlToOpen = event.notification.data?.url || '/dashboard'

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url === new URL(urlToOpen, self.location.origin).href && 'focus' in client) {
            return client.focus()
          }
        }

        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen)
        }
      })
  )
})

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('[Service Worker] Notification closed:', event)
})

// Fetch event - basic caching strategy (optional)
self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') {
    return
  }

  // Skip caching for API requests
  if (event.request.url.includes('/api/')) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request)
    })
  )
})
