# Push Notifications - Implementation Guide

## ✅ What's Been Implemented

Push notifications have been successfully implemented in FastAppoint! Here's what's included:

### 1. **Backend Infrastructure**
- ✅ Database table for storing push subscriptions ([push_subscriptions](database/migrations/1768522671049_create_create_push_subscriptions_table.ts))
- ✅ PushSubscription model ([app/models/push_subscription.ts](app/models/push_subscription.ts))
- ✅ Push Notification Service ([app/services/push_notification_service.ts](app/services/push_notification_service.ts))
- ✅ API Controller with routes ([app/controllers/push_subscription_controller.ts](app/controllers/push_subscription_controller.ts))

### 2. **Frontend Components**
- ✅ Service Worker for receiving push notifications ([public/sw.js](public/sw.js))
- ✅ Client-side JavaScript library ([resources/js/push-notifications.js](resources/js/push-notifications.js))
- ✅ Settings UI component ([resources/views/partials/push-notification-settings.edge](resources/views/partials/push-notification-settings.edge))

### 3. **Security & Configuration**
- ✅ VAPID keys generated and added to .env
- ✅ Environment variables configured

## 🚀 How to Use

### For End Users (Adding to Settings Page)

Add the push notification settings component to any page by including the partial:

```edge
@include('partials/push-notification-settings')
```

**Example**: Add to your settings page:

```edge
{{-- In resources/views/pages/settings.edge or similar --}}
@layout('layouts/app')

@section('content')
  <div class="max-w-4xl mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold mb-6">Settings</h1>

    {{-- Other settings sections... --}}

    {{-- Push Notifications --}}
    @include('partials/push-notification-settings')
  </div>
@endsection
```

### For Developers (Sending Notifications)

#### Send a booking reminder:

```typescript
import pushNotificationService from '#services/push_notification_service'

// Send booking reminder
await pushNotificationService.sendBookingReminder(userId, {
  id: booking.id,
  businessName: 'Acme Salon',
  time: '2:00 PM',
})
```

#### Send new booking notification:

```typescript
await pushNotificationService.sendNewBookingNotification(userId, {
  id: booking.id,
  customerName: 'John Doe',
  serviceName: 'Haircut',
  time: '3:00 PM',
})
```

#### Send payment confirmation:

```typescript
await pushNotificationService.sendPaymentConfirmation(userId, {
  id: payment.id,
  amount: '₦5,000',
  bookingId: booking.id,
})
```

#### Send custom notification:

```typescript
await pushNotificationService.sendToUser(userId, {
  title: 'Custom Notification',
  body: 'This is a custom message',
  icon: '/logo/svg/icon.svg',
  badge: '/logo/svg/badge.svg',
  data: {
    type: 'custom',
    url: '/dashboard',
  },
  actions: [
    {
      action: 'view',
      title: 'View',
    },
  ],
})
```

## 📋 API Endpoints

All endpoints require authentication (`middleware.auth()`):

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/push/public-key` | Get public VAPID key |
| POST | `/api/push/subscribe` | Subscribe to push notifications |
| POST | `/api/push/unsubscribe` | Unsubscribe from push notifications |
| GET | `/api/push/subscriptions` | List user's subscriptions |
| DELETE | `/api/push/subscriptions/:id` | Delete a subscription |
| POST | `/api/push/test` | Send a test notification |

## 🔧 Configuration

VAPID keys are already configured in your `.env` file:

```env
VAPID_PUBLIC_KEY=BBJoZVWM2EURtmJqc6A8fT40BP2ujs5OKeX0nNXcZNw255iPjVo_cigxxL3vpBZ9h3fK2RMwCh41DLpeNUtIlfk
VAPID_PRIVATE_KEY=pYbIShPL46uR1YeJ6yCFLMaoFXogltlm2NLQ8bO93fI
VAPID_SUBJECT=mailto:support@fastappoint.com
```

⚠️ **Security Warning**: Keep your VAPID private key secret! Don't commit it to version control.

## 🎨 Customization

### Customize Notification Appearance

Edit [public/sw.js](public/sw.js:25-40) to customize default notification appearance:

```javascript
const options = {
  body: data.body,
  icon: '/your-custom-icon.png',  // Change icon
  badge: '/your-custom-badge.png', // Change badge
  // ... other options
}
```

### Customize Notification Types

Edit [app/services/push_notification_service.ts](app/services/push_notification_service.ts) to add custom notification types or modify existing ones.

### Customize UI Component

Edit [resources/views/partials/push-notification-settings.edge](resources/views/partials/push-notification-settings.edge) to modify the settings interface.

## 📱 Browser Support

Push notifications are supported in:
- ✅ Chrome (Desktop & Android)
- ✅ Firefox (Desktop & Android)
- ✅ Edge (Desktop)
- ✅ Safari (Desktop & iOS 16.4+)
- ✅ Opera (Desktop & Android)

## 🔍 Testing

1. **Test from UI**: Use the "Send Test Notification" button in the settings component
2. **Test from code**:
   ```typescript
   await pushNotificationService.sendToUser(userId, {
     title: 'Test',
     body: 'Testing push notifications',
   })
   ```

## 🚨 Troubleshooting

### Notifications not showing?
1. Check browser permissions (should be "granted")
2. Check service worker registration in DevTools → Application → Service Workers
3. Check console for errors
4. Verify VAPID keys are set in .env

### "Push notifications are not configured" error?
- Ensure VAPID keys are set in .env file
- Restart your server after adding keys

### Subscription failed?
- Check if HTTPS is enabled (required for push notifications)
- Verify service worker is registered properly
- Check browser console for detailed error messages

## 🎯 Integration Examples

### Send notification when booking is created:

In [app/controllers/booking_controller.ts](app/controllers/booking_controller.ts):

```typescript
import pushNotificationService from '#services/push_notification_service'

// After creating booking
await pushNotificationService.sendNewBookingNotification(business.userId, {
  id: booking.id,
  customerName: booking.customerName,
  serviceName: booking.service.name,
  time: booking.startTime,
})
```

### Send notification on payment received:

```typescript
// After successful payment
await pushNotificationService.sendPaymentConfirmation(user.id, {
  id: payment.id,
  amount: payment.formattedAmount,
  bookingId: payment.bookingId,
})
```

## 📊 Database Schema

The `push_subscriptions` table stores:
- `user_id` - Which user this subscription belongs to
- `endpoint` - Push notification endpoint URL
- `keys` - Encrypted keys for the subscription
- `device_name` - Device identifier (e.g., "Desktop", "Mobile")
- `user_agent` - Browser user agent
- `is_active` - Whether subscription is active

## 🔐 Security Best Practices

1. **Never expose private VAPID key** - Keep it in .env only
2. **Validate subscription data** - Controller validates all inputs
3. **Authenticate API calls** - All endpoints require authentication
4. **Clean up inactive subscriptions** - Service automatically deactivates invalid subscriptions (410 Gone)

## 📝 Next Steps

1. **Add notification preferences**: Let users choose which types of notifications they want
2. **Schedule reminders**: Use a queue/scheduler to send reminders at specific times
3. **Analytics**: Track notification delivery and click rates
4. **Rich notifications**: Add images and more interactive actions
5. **Mobile app**: When ready, the same backend can serve mobile push notifications

## 🆘 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review browser console for errors
3. Check server logs for backend errors
4. Verify VAPID keys are correctly set

---

**Congratulations!** 🎉 Push notifications are now fully implemented in FastAppoint!
