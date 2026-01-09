# Remaining Pages Update Plan - Colorful Minimalism Design System

## Overview
This document outlines the plan to update all remaining pages with the new Colorful Minimalism design system.

**Total Pages to Update:** 23 pages across 5 categories

---

## ✅ Phase 1: Forms (High Priority)
**Estimated Time:** 1-2 hours
**Pages:** 3 forms

### 1.1 Packages Edit Form
- **File:** `resources/views/pages/packages/edit.edge`
- **URL:** `/packages/:id/edit`
- **Changes Needed:**
  - Update flash messages with icon and border-l-4 styling
  - Enhanced back link with arrow icon
  - Replace all sand-* colors with neutral-*
  - Apply `.input-field` class to all inputs
  - Update buttons to btn-primary and btn-ghost
  - Restructure with card component and header

### 1.2 Portfolio Create Form
- **File:** `resources/views/pages/portfolio/create.edge`
- **URL:** `/portfolio/new`
- **Changes Needed:**
  - Update flash messages with new style
  - Enhanced back link
  - Replace sand-* with neutral-*
  - Apply `.input-field` class
  - Update buttons
  - Card structure with header

### 1.3 Portfolio Edit Form
- **File:** `resources/views/pages/portfolio/edit.edge`
- **URL:** `/portfolio/:id/edit`
- **Changes Needed:**
  - Same as portfolio create
  - Ensure image preview section uses neutral colors

---

## ✅ Phase 2: Settings Pages (High Priority)
**Estimated Time:** 3-4 hours
**Pages:** 16 settings pages

### 2.1 Main Settings Pages (6 pages)
1. **Settings Index**
   - **File:** `resources/views/pages/settings/index.edge`
   - **URL:** `/settings`
   - Navigation cards with icons and accent colors
   - Update to card-hover with appropriate accent borders

2. **Profile Settings**
   - **File:** `resources/views/pages/settings/profile.edge`
   - **URL:** `/settings/profile`
   - Form inputs with `.input-field`
   - Avatar upload section
   - Update buttons

3. **Booking Page Settings**
   - **File:** `resources/views/pages/settings/booking-page.edge`
   - **URL:** `/settings/booking-page`
   - Form sections with toggle switches
   - Preview card

4. **Cancellation Settings**
   - **File:** `resources/views/pages/settings/cancellation.edge`
   - **URL:** `/settings/cancellation`
   - Policy form with textarea
   - Toggle options

5. **Notifications Settings**
   - **File:** `resources/views/pages/settings/notifications.edge`
   - **URL:** `/settings/notifications`
   - Email/SMS toggle options
   - Checkbox groups

6. **Google Calendar Settings**
   - **File:** `resources/views/pages/settings/google-calendar.edge`
   - **URL:** `/settings/google-calendar`
   - Integration status card
   - Connect/disconnect buttons

### 2.2 Payment Settings (1 page)
7. **Payments Settings**
   - **File:** `resources/views/pages/settings/payments.edge`
   - **URL:** `/settings/payments`
   - Stripe integration card
   - Currency selector
   - Payment method toggles

### 2.3 Theme Settings (5 pages)
8. **Theme Index**
   - **File:** `resources/views/pages/settings/theme/index.edge`
   - **URL:** `/settings/theme`
   - Theme option cards with previews

9. **Theme Customize**
   - **File:** `resources/views/pages/settings/theme/customize.edge`
   - **URL:** `/settings/theme/customize`
   - Color picker inputs
   - Font selector
   - Preview panel

10. **Theme Content**
    - **File:** `resources/views/pages/settings/theme/content.edge`
    - **URL:** `/settings/theme/content`
    - Text editor fields
    - Image upload sections

11. **Theme Templates**
    - **File:** `resources/views/pages/settings/theme/templates.edge`
    - **URL:** `/settings/theme/templates`
    - Template selection cards
    - Preview images

12. **Theme Social**
    - **File:** `resources/views/pages/settings/theme/social.edge`
    - **URL:** `/settings/theme/social`
    - Social media link inputs
    - Icon toggles

### 2.4 Withdrawals Settings (4 pages)
13. **Withdrawals Index**
    - **File:** `resources/views/pages/settings/withdrawals/index.edge`
    - **URL:** `/settings/withdrawals`
    - Balance card with gradient
    - Withdraw button
    - Quick stats

14. **Withdrawal History**
    - **File:** `resources/views/pages/settings/withdrawals/history.edge`
    - **URL:** `/settings/withdrawals/history`
    - Transaction table/cards
    - Status badges (success, warning, error)
    - Filter section

15. **Bank Accounts**
    - **File:** `resources/views/pages/settings/withdrawals/bank-accounts.edge`
    - **URL:** `/settings/withdrawals/bank-accounts`
    - Bank account cards
    - Add account button
    - Default account indicator

16. **Add Bank Account**
    - **File:** `resources/views/pages/settings/withdrawals/add-bank-account.edge`
    - **URL:** `/settings/withdrawals/add-bank-account`
    - Form with bank details
    - Input validation
    - Security note card

---

## ✅ Phase 3: Subscription Pages (Medium Priority)
**Estimated Time:** 2-3 hours
**Pages:** 4 pages

### 3.1 Subscription Select
- **File:** `resources/views/pages/subscriptions/select.edge`
- **URL:** `/subscriptions/select`
- **Changes Needed:**
  - Pricing cards with card-accent-primary
  - Feature lists with checkmarks
  - Popular badge with amber color
  - CTA buttons with btn-primary
  - Comparison table styling

### 3.2 Subscription Manage
- **File:** `resources/views/pages/subscriptions/manage.edge`
- **URL:** `/subscriptions/manage`
- **Changes Needed:**
  - Current plan card with gradient
  - Billing history table
  - Payment method card
  - Action buttons (upgrade, cancel)
  - Status badges

### 3.3 Subscription Payment
- **File:** `resources/views/pages/subscriptions/payment.edge`
- **URL:** `/subscriptions/payment`
- **Changes Needed:**
  - Payment form with `.input-field`
  - Order summary card
  - Secure payment badge
  - Submit button

### 3.4 Subscription Index
- **File:** `resources/views/pages/subscriptions/index.edge`
- **URL:** `/subscriptions`
- **Changes Needed:**
  - Overview cards
  - Plan comparison
  - Navigation to select/manage

---

## ✅ Phase 4: Featured Listing Pages (Medium Priority)
**Estimated Time:** 1-2 hours
**Pages:** 3 pages

### 4.1 Featured Index
- **File:** `resources/views/pages/featured/index.edge`
- **URL:** `/featured`
- **Changes Needed:**
  - Benefits cards with icons
  - Pricing cards for weekly/monthly
  - CTA buttons
  - Current status card

### 4.2 Featured Purchase
- **File:** `resources/views/pages/featured/purchase.edge`
- **URL:** `/featured/purchase/:duration`
- **Changes Needed:**
  - Package selection cards
  - Summary card
  - Payment form
  - Confirmation button

### 4.3 Featured Payment
- **File:** `resources/views/pages/featured/payment.edge`
- **URL:** `/featured/:id/payment`
- **Changes Needed:**
  - Payment method cards
  - Order summary
  - Payment form with `.input-field`
  - Security badges

---

## Implementation Checklist

### Standard Changes for ALL Pages:
- [ ] Replace `sand-*` colors with `neutral-*`
- [ ] Update flash messages: `bg-{color}-bg border-l-4 border-l-{color}` with icon
- [ ] Apply `.input-field` to all form inputs
- [ ] Update buttons to `btn-primary` and `btn-ghost`
- [ ] Use `card` class for containers
- [ ] Add `card-hover` where appropriate
- [ ] Add accent borders: `card-accent-{color}` for visual distinction
- [ ] Update labels: `text-neutral-900 mb-2`
- [ ] Update helper text: `text-neutral-500`
- [ ] Enhance headers: larger text (text-2xl or text-3xl)
- [ ] Add descriptive subheaders

### Color Assignment Strategy:
- **Primary Blue** - Main actions, primary buttons, active states
- **Success Green** - Confirmations, completed states, positive actions
- **Warning Orange** - Pending states, important notices
- **Error Red** - Errors, cancellations, destructive actions
- **Info Cyan** - Informational sections, help text
- **Purple** - Packages, bundles, premium features
- **Pink** - Portfolio, creative content
- **Teal** - Staff, team-related content
- **Amber** - Highlights, featured items, special offers

---

## Execution Order (Recommended)

### Week 1: Forms & Critical Settings
1. Packages Edit Form
2. Portfolio Create Form
3. Portfolio Edit Form
4. Settings Profile
5. Settings Payments

### Week 2: Settings Pages
6. Settings Index
7. Settings Booking Page
8. Settings Cancellation
9. Settings Notifications
10. Settings Google Calendar
11. Withdrawals Index
12. Withdrawals History
13. Bank Accounts
14. Add Bank Account

### Week 3: Theme & Subscription Pages
15. Theme Index
16. Theme Customize
17. Theme Content
18. Theme Templates
19. Theme Social
20. Subscription Select
21. Subscription Manage
22. Subscription Payment
23. Subscription Index

### Week 4: Featured Pages
24. Featured Index
25. Featured Purchase
26. Featured Payment

---

## Testing Checklist
After updating each page, verify:
- [ ] All buttons have proper styling and hover effects
- [ ] Form inputs have consistent styling
- [ ] Flash messages display correctly with icons
- [ ] Cards have proper shadows and borders
- [ ] Responsive design works on mobile
- [ ] Color contrast meets accessibility standards
- [ ] No console errors
- [ ] All links work correctly

---

## Notes
- All pages use Tailwind CDN, so custom classes must be in layout file or inline
- Button styles are now in `resources/views/layouts/app.edge`
- Input field styles use `.input-field` class
- Maintain consistent spacing: `space-y-6` for forms, `gap-6` for grids
- Use `shadow-lg` for elevated cards
- Keep empty states with gradient icon backgrounds

---

## Progress Tracking
- **Total Pages:** 23
- **Completed:** 19 (Phase 1 complete + Phase 2 complete)
- **In Progress:** 0
- **Remaining:** 4

**Last Updated:** 2026-01-09

### Completed Pages:

#### Phase 1: Forms (Complete ✅)
- ✅ Packages Edit Form (resources/views/pages/packages/edit.edge)
- ✅ Portfolio Create Form (resources/views/pages/portfolio/create.edge)
- ✅ Portfolio Edit Form (resources/views/pages/portfolio/edit.edge)

#### Phase 2: Settings Pages (Complete ✅ - 16/16)
- ✅ Settings Index (resources/views/pages/settings/index.edge)
- ✅ Profile Settings (resources/views/pages/settings/profile.edge)
- ✅ Booking Page Settings (resources/views/pages/settings/booking-page.edge)
- ✅ Cancellation Settings (resources/views/pages/settings/cancellation.edge)
- ✅ Notifications Settings (resources/views/pages/settings/notifications.edge)
- ✅ Google Calendar Settings (resources/views/pages/settings/google-calendar.edge)
- ✅ Payments Settings (resources/views/pages/settings/payments.edge)
- ✅ Theme Index (resources/views/pages/settings/theme/index.edge)
- ✅ Theme Customize (resources/views/pages/settings/theme/customize.edge)
- ✅ Theme Content (resources/views/pages/settings/theme/content.edge)
- ✅ Theme Templates (resources/views/pages/settings/theme/templates.edge)
- ✅ Theme Social (resources/views/pages/settings/theme/social.edge)
- ✅ Withdrawals Index (resources/views/pages/settings/withdrawals/index.edge)
- ✅ Withdrawals History (resources/views/pages/settings/withdrawals/history.edge)
- ✅ Withdrawals Bank Accounts (resources/views/pages/settings/withdrawals/bank-accounts.edge)
- ✅ Withdrawals Add Bank Account (resources/views/pages/settings/withdrawals/add-bank-account.edge)
