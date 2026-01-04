# MVP Roadmap: Booking Platform for Creative Professionals

## Target Market

| Segment | Examples | Key Needs |
|---------|----------|-----------|
| **Media Professionals** | Photographers, videographers, content creators, podcasters | Session booking, location/studio scheduling, client management |
| **Beauty & Fashion** | Salons, makeup artists, stylists, fashion consultants, models | Service menus, multiple staff, no-show protection, portfolio showcase |
| **SMEs with appointments** | Consultants, agencies, coaches | Simple booking, professional image, payments |

---

## Current State (Already Built)

| Feature | Status |
|---------|--------|
| Business profiles with custom subdomains | Done |
| Service management (pricing, duration) | Done |
| Full booking flow with payments (Paystack) | Done |
| Staff management & availability | Done |
| 5 booking page themes with customization | Done |
| Subscription tiers with 7-day trial | Done |
| Email notifications (confirmation, cancellation) | Done |
| Receipt PDF generation | Done |
| Time-off management | Done |
| Cancellation policy settings | Done |
| Social media links on booking page | Done |

---

## Phase 1: Launch-Ready

**Goal:** Make the platform competitive for creative professionals
**Estimated effort:** 2-3 weeks

### P1.1 - Booking Reminders (HIGH PRIORITY)

**Why:** Reduces no-shows by 30-50%. Critical for service businesses.

**Current state:** Database columns exist (`reminder_24h_sent_at`, `reminder_1h_sent_at`) but no implementation.

**Requirements:**
- [ ] Create scheduled task (cron job) that runs every 15 minutes
- [ ] Query bookings where:
  - Status is `confirmed`
  - Booking date is within 24 hours AND `reminder_24h_sent_at` is null
  - Booking date is within 1 hour AND `reminder_1h_sent_at` is null
- [ ] Send reminder email to customer with:
  - Service name and duration
  - Date and time
  - Business name and location
  - Reschedule/cancel link
- [ ] Update `reminder_*_sent_at` timestamp after sending
- [ ] Add reminder settings to business (enable/disable 24h, 1h reminders)

**Effort:** Low (2-3 days)

---

### P1.2 - Service Images (HIGH PRIORITY)

**Why:** Creatives sell visually. Customers want to see the haircut style, makeup look, or photography style before booking.

**Current state:** Placeholder support exists but no actual image upload.

**Requirements:**
- [ ] Add `image_url` field to services table (migration)
- [ ] Implement image upload on service create/edit form
- [ ] Store images in `/public/uploads/services/` or cloud storage
- [ ] Resize/optimize images on upload (use Sharp - already installed)
- [ ] Display service images on:
  - Business dashboard service list
  - Public booking page service selection
- [ ] Support multiple images per service (future consideration)

**Effort:** Medium (3-4 days)

---

### P1.3 - Deposit Payments (HIGH PRIORITY)

**Why:** Photographers, stylists, and makeup artists commonly require deposits (25-50%) to secure bookings. Protects against no-shows.

**Current state:** Full payment only.

**Requirements:**
- [ ] Add to services table:
  - `deposit_type` (enum: none, percentage, fixed)
  - `deposit_amount` (decimal)
- [ ] Modify booking flow:
  - Calculate deposit amount at checkout
  - Show "Deposit: NGN X,XXX" and "Balance due: NGN X,XXX"
  - Process deposit payment only
- [ ] Add to bookings table:
  - `deposit_amount` (decimal)
  - `balance_due` (decimal)
  - `balance_paid_at` (timestamp)
- [ ] Create "Collect Balance" feature for business dashboard
- [ ] Send balance reminder email before appointment
- [ ] Update receipt to show deposit vs total

**Effort:** Medium-High (4-5 days)

---

### P1.4 - Portfolio/Gallery Management (HIGH PRIORITY)

**Why:** Creatives need to showcase their work. The booking page should double as a mini-portfolio.

**Current state:** Gallery section exists in booking page theme but no content management.

**Requirements:**
- [ ] Create `portfolio_items` table:
  - `id`, `business_id`, `image_url`, `caption`, `category`, `sort_order`, `created_at`
- [ ] Create portfolio management UI in settings:
  - Upload images (max 12-20 for MVP)
  - Add captions
  - Categorize (optional)
  - Drag to reorder
  - Delete
- [ ] Display portfolio on public booking page gallery section
- [ ] Lazy-load images for performance
- [ ] Lightbox view for full-size images

**Effort:** Medium (3-4 days)

---

### P1.5 - SMS Notifications (MEDIUM PRIORITY)

**Why:** Beauty and fashion clients expect text reminders. Email open rates are ~20%, SMS is ~98%.

**Current state:** Email only.

**Requirements:**
- [ ] Choose SMS provider:
  - Nigeria: Termii, Africa's Talking
  - International: Twilio
- [ ] Create SMS service class
- [ ] Add to business settings:
  - Enable/disable SMS
  - SMS sender name
- [ ] Add `phone` validation for customers (required if SMS enabled)
- [ ] Send SMS for:
  - Booking confirmation
  - 24h reminder
  - 1h reminder
  - Cancellation notice
- [ ] Track SMS credits/costs per business
- [ ] Consider: Include SMS in higher subscription tiers only

**Effort:** Medium (4-5 days)

---

### P1.6 - Mobile Responsiveness Audit (MEDIUM PRIORITY)

**Why:** 60-70% of bookings happen on mobile devices.

**Current state:** Responsive classes used but not fully tested.

**Requirements:**
- [ ] Test all 5 booking page templates on mobile viewports
- [ ] Fix any layout issues (overflow, touch targets, font sizes)
- [ ] Ensure booking flow works smoothly on mobile:
  - Service selection
  - Date/time picker
  - Customer form
  - Payment
- [ ] Test dashboard on tablet (business owners use tablets)
- [ ] Optimize images for mobile (srcset)

**Effort:** Low (2-3 days)

---

## Phase 2: Competitive Advantage

**Goal:** Features that differentiate from competitors
**Estimated effort:** 3-4 weeks

### P2.1 - Service Packages/Bundles (HIGH PRIORITY) ✅ COMPLETE

**Why:** Creatives often sell packages: "2hr photoshoot + 10 edited photos" or "Bridal makeup + trial session"

**Requirements:**
- [x] Create `service_packages` table:
  - `id`, `business_id`, `name`, `description`, `services` (JSON array of service IDs)
  - `package_price`, `discount_amount`, `duration_minutes`, `is_active`
- [x] Package builder UI:
  - Select multiple services
  - Set package price (auto-calculate savings)
  - Set package name and description
- [x] Display packages on booking page as an option alongside individual services
- [x] Booking flow handles package selection
- [ ] Analytics: Track package vs individual bookings

**Effort:** Medium (4-5 days)

---

### P2.2 - Location Types per Service (MEDIUM PRIORITY) ✅ COMPLETE

**Why:** Photographers shoot on-location or in studio. Makeup artists travel to clients. Each has different pricing.

**Requirements:**
- [x] Add to services:
  - `location_type` (enum: business, client, virtual, flexible)
  - `travel_fee` (decimal, for client location)
  - `travel_radius_km` (integer)
  - `virtual_meeting_url` (string)
- [x] Booking flow:
  - If `client` location: collect address, add travel fee
  - If `virtual`: show meeting link after confirmation
  - If `flexible`: let customer choose
- [x] Display location info on booking confirmation

**Effort:** Medium (3-4 days)

---

### P2.3 - Google Calendar Sync (HIGH PRIORITY) ✅ COMPLETE

**Why:** Avoid double-bookings. Professionals manage multiple calendars.

**Requirements:**
- [x] Google OAuth integration
- [x] Connect Google Calendar in settings
- [x] Two-way sync:
  - Push: Create calendar event when booking confirmed
  - Pull: Block time slots that have Google Calendar events (getBusyTimes implemented)
- [x] Handle multiple calendars (personal + work) - calendar selection UI
- [x] Auto-update calendar events on reschedule
- [x] Auto-delete calendar events on cancellation
- [ ] Sync buffer time before/after appointments
- [ ] Consider: iCal feed export for other calendars

**Effort:** High (5-7 days)

---

### P2.4 - Customer Accounts (MEDIUM PRIORITY) ✅ COMPLETE

**Why:** Returning clients want to see booking history, rebook favorites, save payment methods.

**Current state:** Customers identified by email only, no accounts.

**Requirements:**
- [x] Create `customers` table:
  - `id`, `email`, `name`, `phone`, `password_hash`, `created_at`
- [x] Optional account creation after booking
- [x] Customer login portal:
  - View upcoming bookings
  - View past bookings
  - Rebook previous service
  - Manage profile
- [x] "Book again" quick action
- [x] Customer notes visible to business (preferences, allergies, etc.)

**Effort:** Medium-High (5-6 days)

---

### P2.5 - Discount Codes (MEDIUM PRIORITY)

**Why:** Promotions, influencer collaborations, first-time customer discounts.

**Requirements:**
- [ ] Create `discount_codes` table:
  - `id`, `business_id`, `code`, `type` (percentage/fixed)
  - `amount`, `min_order`, `max_uses`, `used_count`
  - `valid_from`, `valid_until`, `is_active`
- [ ] Discount code input on checkout
- [ ] Validate code (active, not expired, usage limit)
- [ ] Apply discount to booking total
- [ ] Track redemptions
- [ ] Business UI to create/manage codes

**Effort:** Medium (3-4 days)

---

### P2.6 - Reviews & Testimonials (MEDIUM PRIORITY)

**Why:** Social proof drives bookings. Creatives rely on word-of-mouth.

**Current state:** Testimonial section in theme but no management.

**Requirements:**
- [ ] Create `reviews` table:
  - `id`, `booking_id`, `customer_name`, `rating` (1-5), `comment`
  - `is_approved`, `created_at`
- [ ] Send review request email 24h after completed booking
- [ ] Simple review submission page (no login required, token-based)
- [ ] Business dashboard:
  - View all reviews
  - Approve/reject reviews
  - Respond to reviews (optional)
- [ ] Display approved reviews on booking page
- [ ] Calculate and show average rating

**Effort:** Medium (4-5 days)

---

## Phase 3: Scale & Growth

**Goal:** Features for growing businesses and platform expansion
**Timeline:** Post-launch, based on user feedback

### P3.1 - Waitlist for Full Slots

- Allow customers to join waitlist when no slots available
- Notify waitlist when cancellation opens a slot
- Auto-offer slot to first in queue

### P3.2 - Recurring Appointments

- "Book weekly" or "Book monthly" option
- Auto-create future bookings
- Manage recurring series

### P3.3 - Client Notes & Preferences

- Business can add notes to customers
- "Prefers natural lighting", "Allergic to latex"
- Notes visible when viewing booking

### P3.4 - Booking Approval Workflow

- Optional: require business approval before confirming
- Useful for high-end services, vetting clients

### P3.5 - WhatsApp Integration

- Send notifications via WhatsApp Business API
- Two-way messaging for booking inquiries

### P3.6 - Analytics Dashboard

- Popular services report
- Peak booking times
- Revenue trends
- Customer retention metrics
- No-show rate

### P3.7 - Multi-language Support

- Booking page in multiple languages
- Customer selects language
- Priority: English, French, Yoruba, Hausa

### P3.8 - API for Integrations

- REST API for third-party integrations
- Zapier integration
- Embed booking in other platforms

---

## Database Migrations Needed

### Phase 1

```sql
-- Service images
ALTER TABLE services ADD COLUMN image_url VARCHAR(500);

-- Deposit payments
ALTER TABLE services ADD COLUMN deposit_type VARCHAR(20) DEFAULT 'none';
ALTER TABLE services ADD COLUMN deposit_amount DECIMAL(10,2) DEFAULT 0;

ALTER TABLE bookings ADD COLUMN deposit_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN balance_due DECIMAL(10,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN balance_paid_at TIMESTAMP;

-- Portfolio items
CREATE TABLE portfolio_items (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  image_url VARCHAR(500) NOT NULL,
  caption VARCHAR(255),
  category VARCHAR(100),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Business reminder settings
ALTER TABLE businesses ADD COLUMN reminder_24h_enabled BOOLEAN DEFAULT true;
ALTER TABLE businesses ADD COLUMN reminder_1h_enabled BOOLEAN DEFAULT true;
ALTER TABLE businesses ADD COLUMN sms_enabled BOOLEAN DEFAULT false;
```

### Phase 2

```sql
-- Service packages
CREATE TABLE service_packages (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  service_ids JSONB NOT NULL,
  package_price DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  duration_minutes INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Location types
ALTER TABLE services ADD COLUMN location_type VARCHAR(20) DEFAULT 'business';
ALTER TABLE services ADD COLUMN travel_fee DECIMAL(10,2) DEFAULT 0;
ALTER TABLE services ADD COLUMN travel_radius_km INTEGER;
ALTER TABLE services ADD COLUMN virtual_meeting_url VARCHAR(500);

-- Customers
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  phone VARCHAR(50),
  password_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Discount codes
CREATE TABLE discount_codes (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  type VARCHAR(20) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  min_order DECIMAL(10,2) DEFAULT 0,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Reviews
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  customer_name VARCHAR(255) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_approved BOOLEAN DEFAULT false,
  review_token VARCHAR(100) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Google Calendar integration
ALTER TABLE users ADD COLUMN google_refresh_token TEXT;
ALTER TABLE users ADD COLUMN google_calendar_id VARCHAR(255);
```

---

## Priority Summary

| Priority | Feature | Phase | Effort | Impact |
|----------|---------|-------|--------|--------|
| 1 | Booking Reminders | 1 | Low | High |
| 2 | Service Images | 1 | Medium | High |
| 3 | Deposit Payments | 1 | Medium-High | High |
| 4 | Portfolio Management | 1 | Medium | High |
| 5 | SMS Notifications | 1 | Medium | Medium |
| 6 | Mobile Audit | 1 | Low | Medium |
| 7 | Service Packages | 2 | Medium | High |
| 8 | Google Calendar Sync | 2 | High | High |
| 9 | Location Types | 2 | Medium | Medium |
| 10 | Customer Accounts | 2 | Medium-High | Medium |
| 11 | Discount Codes | 2 | Medium | Medium |
| 12 | Reviews System | 2 | Medium | Medium |

---

## Success Metrics

### Launch Metrics (Phase 1 Complete)
- [ ] 100 businesses signed up
- [ ] 500 bookings processed
- [ ] <5% no-show rate (with reminders)
- [ ] 4+ star average app store rating (if applicable)

### Growth Metrics (Phase 2 Complete)
- [ ] 500 businesses signed up
- [ ] 5,000 bookings/month
- [ ] 30% of bookings use packages
- [ ] 20% repeat customer rate

---

## Notes

- All estimates assume single developer
- Prioritize mobile experience throughout
- Test with real users (photographers, stylists) after Phase 1
- Consider beta program with 10-20 creative professionals before public launch
