# FastAppoint - Features Testing Checklist

A comprehensive list of all features available for testing in the FastAppoint booking platform.

---

## 🏠 Public Pages

| Feature | Route | Status |
|---------|-------|--------|
| Home Page | `/` | ⬜ |

---

## 🔐 Authentication

| Feature | Route | Status |
|---------|-------|--------|
| Sign Up | `/signup` | ⬜ |
| Login | `/login` | ⬜ |
| Logout | `POST /logout` | ⬜ |
| Forgot Password | `/forgot-password` | ⬜ |
| Reset Password | `/reset-password` | ⬜ |
| Delete Account | `/account/delete` | ⬜ |

---

## 🚀 Onboarding

| Feature | Route | Status |
|---------|-------|--------|
| Onboarding Wizard | `/onboarding` | ⬜ |
| Update Business Details | `POST /onboarding/details` | ⬜ |
| Add Service | `POST /onboarding/service` | ⬜ |
| Delete Service | `POST /onboarding/service/:id/delete` | ⬜ |
| Set Availability | `POST /onboarding/availability` | ⬜ |
| Complete Onboarding | `POST /onboarding/complete` | ⬜ |

---

## 📊 Dashboard

| Feature | Route | Status |
|---------|-------|--------|
| Dashboard Overview | `/dashboard` | ⬜ |

---

## 📅 Bookings Management (Business)

| Feature | Route | Status |
|---------|-------|--------|
| View All Bookings | `/bookings` | ⬜ |
| View Booking Details | `/bookings/:id` | ⬜ |
| Mark as Complete | `POST /bookings/:id/complete` | ⬜ |
| Cancel Booking | `POST /bookings/:id/cancel` | ⬜ |
| Issue Refund | `POST /bookings/:id/refund` | ⬜ |

---

## 🛠️ Services Management

| Feature | Route | Status |
|---------|-------|--------|
| List Services | `/services` | ⬜ |
| Create Service | `/services/new` | ⬜ |
| Edit Service | `/services/:id/edit` | ⬜ |
| Toggle Active | `POST /services/:id/toggle` | ⬜ |
| Delete Service | `POST /services/:id/delete` | ⬜ |

---

## 👥 Staff Management

| Feature | Route | Status |
|---------|-------|--------|
| List Staff | `/staff` | ⬜ |
| Add Staff | `/staff/new` | ⬜ |
| Edit Staff | `/staff/:id/edit` | ⬜ |
| Toggle Active | `POST /staff/:id/toggle` | ⬜ |
| Delete Staff | `POST /staff/:id/delete` | ⬜ |
| Staff Availability | `/staff/:id/availability` | ⬜ |
| Save Availability | `POST /staff/:id/availability` | ⬜ |

---

## 🏖️ Time-Off Management

| Feature | Route | Status |
|---------|-------|--------|
| List Time-Off | `/time-off` | ⬜ |
| Create Time-Off | `/time-off/new` | ⬜ |
| Edit Time-Off | `/time-off/:id/edit` | ⬜ |
| Delete Time-Off | `POST /time-off/:id/delete` | ⬜ |

---

## ⚙️ Settings

| Feature | Route | Status |
|---------|-------|--------|
| Settings Index | `/settings` | ⬜ |
| Business Profile | `/settings/profile` | ⬜ |
| Cancellation Policy | `/settings/cancellation` | ⬜ |
| Payment Settings | `/settings/payments` | ⬜ |
| Booking Page Settings | `/settings/booking-page` | ⬜ |

---

## 💸 Withdrawals

| Feature | Route | Status |
|---------|-------|--------|
| Withdrawals Overview | `/settings/withdrawals` | ⬜ |
| Bank Accounts List | `/settings/withdrawals/bank-accounts` | ⬜ |
| Add Bank Account | `/settings/withdrawals/bank-accounts/add` | ⬜ |
| Verify Bank Account | `POST /settings/withdrawals/bank-accounts/verify` | ⬜ |
| Set Primary Account | `POST /settings/withdrawals/bank-accounts/:id/primary` | ⬜ |
| Delete Bank Account | `POST /settings/withdrawals/bank-accounts/:id/delete` | ⬜ |
| Request Withdrawal | `POST /settings/withdrawals/request` | ⬜ |
| Cancel Withdrawal | `POST /settings/withdrawals/:id/cancel` | ⬜ |
| Withdrawal History | `/settings/withdrawals/history` | ⬜ |
| Get Banks List (API) | `/api/banks` | ⬜ |

---

## 🎨 Theme Customization

| Feature | Route | Status |
|---------|-------|--------|
| Theme Overview | `/settings/theme` | ⬜ |
| Select Template | `/settings/theme/templates` | ⬜ |
| Apply Template | `POST /settings/theme/templates` | ⬜ |
| Customize Theme | `/settings/theme/customize` | ⬜ |
| Content Settings | `/settings/theme/content` | ⬜ |
| Social Links | `/settings/theme/social` | ⬜ |
| Theme Preview | `/settings/theme/preview` | ⬜ |

---

## 💳 Subscriptions

| Feature | Route | Status |
|---------|-------|--------|
| View Plans | `/subscriptions` | ⬜ |
| Select Plan | `/subscriptions/select` | ⬜ |
| Manage Subscription | `/subscriptions/manage` | ⬜ |
| Subscribe | `POST /subscriptions/subscribe` | ⬜ |
| Payment Page | `/subscriptions/:planId/payment` | ⬜ |
| Verify Payment | `/subscriptions/:planId/verify` | ⬜ |
| Cancel Subscription | `POST /subscriptions/cancel` | ⬜ |
| Resume Subscription | `POST /subscriptions/resume` | ⬜ |
| Change Plan | `POST /subscriptions/change` | ⬜ |

---

## ⭐ Featured Listings

| Feature | Route | Status |
|---------|-------|--------|
| Featured Index | `/featured` | ⬜ |
| Purchase Featured | `/featured/purchase/:plan` | ⬜ |
| Initiate Payment | `POST /featured/initiate` | ⬜ |
| Payment Page | `/featured/:id/payment` | ⬜ |
| Verify Payment | `/featured/:id/verify` | ⬜ |
| Cancel Featured | `/featured/:id/cancel` | ⬜ |
| Get Active Featured (API) | `/api/featured` | ⬜ |

---

## 📱 Customer Booking Flow (Public)

| Feature | Route | Status |
|---------|-------|--------|
| Business Booking Page | `/book/:slug` | ⬜ |
| Embed Widget | `/book/:slug/embed` | ⬜ |
| Get Time Slots | `/book/:slug/service/:serviceId/slots` | ⬜ |
| Create Booking | `POST /book/:slug/service/:serviceId` | ⬜ |
| Payment Page | `/book/:slug/booking/:bookingId/payment` | ⬜ |
| Verify Payment | `/book/:slug/booking/:bookingId/verify` | ⬜ |
| Booking Confirmation | `/book/:slug/booking/:bookingId/confirmation` | ⬜ |
| Download Receipt | `/book/:slug/booking/:bookingId/receipt` | ⬜ |
| Payment Status | `/book/:slug/booking/:bookingId/payment-status` | ⬜ |
| Manage Booking | `/book/:slug/booking/:bookingId/manage` | ⬜ |
| Cancel Booking | `POST /book/:slug/booking/:bookingId/cancel` | ⬜ |
| Reschedule Form | `/book/:slug/booking/:bookingId/reschedule` | ⬜ |
| Reschedule Booking | `POST /book/:slug/booking/:bookingId/reschedule` | ⬜ |
| Find Booking | `/book/find` | ⬜ |
| Lookup Booking | `POST /book/lookup` | ⬜ |

---

## 🔔 Webhooks

| Feature | Route | Status |
|---------|-------|--------|
| Paystack Webhook | `POST /webhooks/paystack` | ⬜ |

---

## Status Legend

- ⬜ Not tested
- 🟡 In progress
- ✅ Passed
- ❌ Failed
- ⏭️ Skipped

---

## Testing Notes

### Prerequisites
1. Start the dev server: `pnpm dev`
2. App runs on: `http://localhost:3333`
3. Ensure PostgreSQL is running
4. Check `.env` for required environment variables

### Suggested Testing Order
1. **Authentication** - Sign up, login, logout
2. **Onboarding** - Complete the business setup wizard
3. **Services** - Add/edit/delete services
4. **Staff** - Manage staff and availability
5. **Customer Booking** - Test the public booking flow
6. **Payments** - Test with Paystack test keys
7. **Settings** - Profile, cancellation, payments
8. **Subscriptions** - Plan selection and management
9. **Withdrawals** - Bank accounts and withdrawal requests
10. **Theme** - Customization options

---

## Issues Found

| Feature | Issue | Severity | Status |
|---------|-------|----------|--------|
| | | | |

---

*Last updated: January 2, 2026*

