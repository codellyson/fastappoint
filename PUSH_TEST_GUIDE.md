# 🧪 Push Notification Testing Guide

## Quick Start

1. **Start your server** (if not already running):
   ```bash
   npm run dev
   ```

2. **Login to your FastAppoint account**

3. **Visit the test page**:
   ```
   http://localhost:3333/push-test
   ```

## Test Page Features

The test page ([/push-test](http://localhost:3333/push-test)) provides 5 interactive sections:

### 1. Browser Support Check
- ✅ Automatically detects if your browser supports push notifications
- Shows green checkmark if supported, red X if not

### 2. Service Worker Registration
- Click "Register Service Worker" button
- Should show success message with the service worker scope
- This registers the `/sw.js` file that handles push notifications

### 3. Push Subscription
- Shows current subscription status (Subscribed/Not Subscribed)
- **Subscribe button**: Requests notification permission and subscribes
- **Unsubscribe button**: Removes the subscription
- You'll see a browser permission prompt when subscribing

### 4. Send Test Notification
- Click "🔔 Send Test Notification"
- You should receive a push notification on your device
- The notification will say "Test Notification - This is a test push notification from FastAppoint!"

### 5. Debug Information
- Shows current notification permission status
- Shows service worker status
- Shows number of active subscriptions
- Click "🔄 Refresh" to update the information

## Step-by-Step Testing

### First Time Setup:

1. ✅ **Check browser support** - Should show green checkmark
2. ✅ **Register Service Worker** - Click button, wait for success message
3. ✅ **Subscribe to Push** - Click subscribe button
   - Browser will prompt "Allow notifications?"
   - Click "Allow"
   - Wait for success message
4. ✅ **Send Test** - Click "Send Test Notification" button
5. ✅ **Check your device** - You should see a notification appear!

### Expected Notification Behavior:

When you send a test notification, you should see:
- **Title**: "Test Notification"
- **Body**: "This is a test push notification from FastAppoint!"
- **Icon**: FastAppoint logo
- **Click behavior**: Opens `/dashboard` when clicked

## Troubleshooting

### No notification appearing?

1. **Check browser permissions**:
   - Look at debug info section - permission should be "granted"
   - If "denied", you need to reset permissions in browser settings

2. **Check service worker**:
   - Debug info should show "Service Worker Status: Active"
   - If not, try registering again

3. **Check subscription**:
   - Debug info should show "Active Subscriptions: 1" (or more)
   - If 0, try subscribing again

4. **Check browser console**:
   - Press F12 to open DevTools
   - Look for any errors in Console tab
   - Check Application → Service Workers tab

### Permission denied?

If you accidentally denied permission:
1. Click the lock icon in address bar
2. Reset notification permission
3. Refresh the page and try again

### Still not working?

1. **Make sure you're logged in** - Push notifications require authentication
2. **Check VAPID keys** - Make sure they're in your `.env` file
3. **Restart server** - After adding VAPID keys
4. **Try different browser** - Chrome/Firefox work best
5. **Check HTTPS** - Some browsers require HTTPS for push notifications (localhost is okay)

## Testing in Different Scenarios

### Test on Desktop:
- Chrome: Full support ✅
- Firefox: Full support ✅
- Edge: Full support ✅
- Safari: Supported (macOS 13+) ✅

### Test on Mobile:
- Chrome Android: Full support ✅
- Firefox Android: Full support ✅
- Safari iOS: Supported (iOS 16.4+) ✅

### Test Multiple Devices:
1. Login on device 1, subscribe
2. Login on device 2, subscribe
3. Send test notification
4. **Both devices should receive it!**

## Verifying Database

Check if subscriptions are being saved:

```bash
# Connect to your database and run:
SELECT * FROM push_subscriptions;
```

You should see records with:
- `user_id`
- `endpoint` (long URL)
- `keys` (JSON string)
- `device_name`
- `is_active = true`

## Next Steps After Testing

Once you've confirmed push notifications work:

1. **Add to your settings page**:
   ```edge
   @include('partials/push-notification-settings')
   ```

2. **Integrate with your app**:
   - Send notifications when bookings are created
   - Send payment confirmations
   - Send appointment reminders

3. **Schedule reminder notifications**:
   - Use a job queue to send notifications at specific times
   - Example: Send reminder 1 hour before appointment

## Support

If you're stuck:
1. Check the [PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md) documentation
2. Review browser console for errors
3. Check server logs for backend errors
4. Verify VAPID keys in `.env` file

---

**Happy Testing!** 🎉

The test page makes it super easy to verify your push notification setup is working correctly.
