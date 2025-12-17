# BookMe - Multi-tenant Booking Platform

## Vision
A booking platform where businesses create personalized booking experiences for their customers. The platform facilitates, the business controls.

## Target Market
- **Primary:** Nigerian & Global SMBs
- **Industries:** Beauty (salons, barbers, spas, makeup artists) & Media Professionals (photographers, videographers, content creators, DJs)
- **Model:** B2B (businesses subscribe to use the platform)

## Business Model

### Subscription Tiers
| Tier | Price | Features |
|------|-------|----------|
| Free | ₦0 | 1 staff, 20 bookings/month, basic booking page |
| Starter | ₦5,000/mo | 3 staff, unlimited bookings, email notifications |
| Pro | ₦15,000/mo | 10 staff, custom domain, SMS notifications, analytics |
| Business | ₦40,000/mo | Unlimited staff, priority support, API access |

### Transaction Fee
- 2-3% on all payments processed through the platform

## Core Principles

1. **Instant Booking** - Customers book instantly based on availability. No approval queue.
2. **Full Payment** - Customers pay what they see. Businesses can optionally enable installments.
3. **Business-Controlled Policies** - Each business sets their own cancellation/refund policy.
4. **Smart Availability** - Businesses craft their availability carefully. No system-enforced buffers.

## MVP Features

### For Businesses
- [ ] Signup & onboarding wizard
- [ ] Custom booking page (subdomain: `business.bookme.ng`)
- [ ] Service management (name, duration, price, description)
- [ ] Staff management (add staff, assign services)
- [ ] Availability calendar (weekly schedule per staff)
- [ ] Time-off management (holidays, breaks)
- [ ] Booking dashboard (view, manage all appointments)
- [ ] Payment settings (connect Paystack)
- [ ] Notification settings (email + SMS)
- [ ] Cancellation policy settings
- [ ] Business profile customization

### For Customers
- [ ] Browse business services
- [ ] Select service & staff (or "any available")
- [ ] Pick available date/time
- [ ] Enter contact details
- [ ] Pay securely via Paystack
- [ ] Receive confirmation (email + SMS)
- [ ] Reschedule/cancel (per business policy)

### Notifications
- **Email:** Booking confirmation, reminders (24h, 1h before), cancellation
- **SMS:** Booking confirmation, reminders, cancellation

## Database Schema

### businesses
Primary tenant table
- id, slug, name, email, phone, logo, description, category
- subscription_tier, subscription_status, subscription_ends_at
- cancellation_policy, currency, timezone
- paystack_subaccount_code (for split payments)
- created_at, updated_at

### users
Staff members (including owner)
- id, business_id, email, password, full_name, phone, avatar
- role (owner | admin | staff)
- is_active, created_at, updated_at

### services
What the business offers
- id, business_id, name, description, duration_minutes, price
- is_active, sort_order
- created_at, updated_at

### staff_services
Which staff can perform which services
- id, user_id, service_id

### availabilities
Regular working hours
- id, business_id, user_id (null = all staff)
- day_of_week (0-6), start_time, end_time
- is_active

### time_offs
Exceptions to availability
- id, user_id, title
- start_datetime, end_datetime
- is_all_day

### bookings
The appointments
- id, business_id, service_id, staff_id
- customer_name, customer_email, customer_phone
- date, start_time, end_time
- status (pending_payment | confirmed | completed | cancelled | no_show)
- amount, payment_status, payment_reference
- notes, cancelled_at, cancellation_reason
- created_at, updated_at

### transactions
Payment records
- id, business_id, booking_id
- amount, platform_fee, business_amount
- status, provider, reference, provider_reference
- created_at

## Technical Architecture

### Stack
- **Backend:** AdonisJS 6
- **Database:** PostgreSQL (single DB, tenant isolation via business_id)
- **Frontend:** Edge templates + Alpine.js + HTMX
- **Payments:** Paystack (with subaccounts for split payments)
- **Email:** Resend
- **SMS:** Termii

### Subdomain Routing
- Wildcard DNS: `*.bookme.ng` → app server
- Middleware extracts subdomain → loads business context
- `api.bookme.ng` - API endpoints
- `app.bookme.ng` - Business dashboard
- `{slug}.bookme.ng` - Public booking pages

### Multi-tenancy
- Single database with `business_id` foreign key on all tenant tables
- Middleware sets `currentBusiness` in request context
- All queries scoped to current business automatically

## User Flows

### Business Onboarding
1. Sign up (email, password, business name)
2. Choose category (Beauty / Media / Other)
3. Add first service
4. Set availability
5. Preview booking page
6. Go live!

### Customer Booking
1. Visit `salon.bookme.ng`
2. Browse services
3. Select service
4. Choose staff (or "first available")
5. Pick date from calendar
6. Select time slot
7. Enter details (name, email, phone)
8. Review & pay
9. Receive confirmation

## Future Features (Post-MVP)
- [ ] Mobile apps (iOS, Android)
- [ ] Calendar sync (Google, Apple, Outlook)
- [ ] Custom domains
- [ ] Recurring appointments
- [ ] Package deals / memberships
- [ ] Reviews & ratings
- [ ] Waitlist for full slots
- [ ] Multi-location support
- [ ] Team chat
- [ ] Advanced analytics
- [ ] API for integrations
