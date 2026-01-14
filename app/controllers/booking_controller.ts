import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import Business from '#models/business'
import Booking from '#models/booking'
import User from '#models/user'
import Availability from '#models/availability'
import TimeOff from '#models/time-off'
import Transaction from '#models/transaction'
import PortfolioItem from '#models/portfolio_item'
import ServicePackage from '#models/service_package'
import Customer from '#models/customer'
import { bookingValidator, rescheduleValidator } from '#validators/booking-validator'
import { errors } from '@vinejs/vine'
import { randomUUID } from 'node:crypto'
import emailService from '#services/email_service'
import subscriptionService from '../services/subscription_service.js'
import receiptService from '#services/receipt_service'
import storageService from '../services/storage_service.js'
import googleCalendarService from '../services/google_calendar_service.js'
import currencyService from '../services/currency_service.js'
import flutterwaveService from '../services/flutterwave_service.js'
import db from '@adonisjs/lucid/services/db'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'

export default class BookingController {
  async show({ params, view, response, request }: HttpContext) {
    const business = await Business.query()
      .where('slug', params.slug)
      .where('isActive', true)
      .where('isOnboarded', true)
      .preload('services', (query) => {
        query
          .where('isActive', true)
          .orderBy('sortOrder')
          .preload('staff', (staffQuery) => {
            staffQuery.where('isActive', true)
          })
      })
      .preload('availabilities', (query) => query.where('isActive', true))
      .preload('theme')
      .first()

    if (!business) {
      return response.status(404).send('Business not found')
    }

    const theme = business.theme
    const template = theme?.template || 'modern'

    const staff = await User.query()
      .where('businessId', business.id)
      .where('isActive', true)
      .where('role', 'staff')

    // Detect customer currency from location (for price conversion)
    // Allow override via query parameter for testing (e.g., ?currency=USD)
    const currencyOverride = request.qs().currency
    const customerCurrency =
      currencyOverride ||
      currencyService.detectCurrencyFromCountry(request.header('cf-ipcountry') || '') ||
      currencyService.detectCurrencyFromLocale(request.header('accept-language') || '') ||
      business.currency ||
      'NGN'

    let services = business.services

    // Convert service prices to customer's currency
    if (services.length > 0) {
      const convertedServices = await Promise.all(
        services.map(async (service) => {
          const convertedPrice = await service.getPriceForCurrency(customerCurrency)
          const formattedPrice = await service.getFormattedPrice(customerCurrency)
          return {
            ...service.toJSON(),
            convertedPrice: convertedPrice / 100, // Convert from smallest unit to decimal for display
            formattedPrice,
          }
        })
      )
      services = convertedServices as any
    }

    // Fetch portfolio items for the gallery
    const portfolioItems = await PortfolioItem.query()
      .where('businessId', business.id)
      .where('isActive', true)
      .preload('service')
      .orderBy('isFeatured', 'desc')
      .orderBy('sortOrder')
      .orderBy('createdAt', 'desc')

    // Fetch active service packages
    let packages = await ServicePackage.query()
      .where('businessId', business.id)
      .where('isActive', true)
      .orderBy('sortOrder')
      .orderBy('createdAt', 'desc')

    // Convert package prices to customer's currency
    if (packages.length > 0) {
      const convertedPackages = await Promise.all(
        packages.map(async (pkg) => {
          // Convert package price from business currency to customer currency
          const packagePriceInSmallestUnit = Math.round(pkg.packagePrice * 100)
          const originalPriceInSmallestUnit = Math.round(pkg.originalPrice * 100)

          const convertedPackagePrice = await currencyService.convertAmount(
            packagePriceInSmallestUnit,
            business.currency || 'NGN',
            customerCurrency
          )
          const convertedOriginalPrice = await currencyService.convertAmount(
            originalPriceInSmallestUnit,
            business.currency || 'NGN',
            customerCurrency
          )

          return {
            ...pkg.toJSON(),
            convertedPackagePrice: convertedPackagePrice / 100, // Convert from smallest unit to decimal
            convertedOriginalPrice: convertedOriginalPrice / 100,
            formattedPackagePrice: currencyService.formatPrice(
              convertedPackagePrice,
              customerCurrency,
              true
            ),
            formattedOriginalPrice: currencyService.formatPrice(
              convertedOriginalPrice,
              customerCurrency,
              true
            ),
          }
        })
      )
      packages = convertedPackages as any
    }

    return view.render(`pages/book/templates/${template}`, {
      business,
      theme,
      services,
      staff,
      portfolioItems,
      packages,
      csrfToken: request.csrfToken,
      customerCurrency, // Currency for displaying prices to customer
      businessCurrency: business.currency, // Business base currency
    })
  }

  async getTimeSlots({ params, request, response }: HttpContext) {
    const { slug, serviceId } = params
    const dateStr = request.qs().date
    const staffId = request.qs().staffId

    // Add CORS headers for embed widget
    const origin = request.header('origin')
    if (origin) {
      response.header('Access-Control-Allow-Origin', origin)
      response.header('Access-Control-Allow-Credentials', 'true')
    } else {
      response.header('Access-Control-Allow-Origin', '*')
    }

    if (!dateStr) {
      return response.badRequest({ error: 'Date is required' })
    }

    const business = await Business.query()
      .where('slug', slug)
      .where('isActive', true)
      .preload('services', (query) => query.where('id', serviceId))
      .preload('availabilities', (query) => query.where('isActive', true).whereNull('userId'))
      .first()

    if (!business || business.services.length === 0) {
      return response.notFound({ error: 'Business or service not found' })
    }

    const service = business.services[0]
    const selectedDate = DateTime.fromISO(dateStr)
    const dayOfWeek = selectedDate.weekday % 7

    let availability: Availability | undefined

    if (staffId) {
      const staffAvailability = await Availability.query()
        .where('businessId', business.id)
        .where('userId', staffId)
        .where('dayOfWeek', dayOfWeek)
        .where('isActive', true)
        .first()

      if (staffAvailability) {
        availability = staffAvailability
      } else {
        availability = business.availabilities.find((a) => a.dayOfWeek === dayOfWeek)
      }

      const existingBookings = await Booking.query()
        .where('businessId', business.id)
        .where('staffId', staffId)
        .where('date', selectedDate.toISODate()!)
        .whereNotIn('status', ['cancelled'])

      if (!availability) {
        return response.json({ slots: [], message: 'Staff not available on this day' })
      }

      const timeOffs = await this.getTimeOffsForDate(business.id, selectedDate, Number(staffId))

      const slots = this.generateTimeSlots(
        availability.startTime,
        availability.endTime,
        service.durationMinutes,
        existingBookings.map((b) => ({ start: b.startTime, end: b.endTime })),
        selectedDate,
        timeOffs
      )

      return response.json({ slots })
    }

    availability = business.availabilities.find((a) => a.dayOfWeek === dayOfWeek)
    if (!availability) {
      return response.json({ slots: [], message: 'Closed on this day' })
    }

    const existingBookings = await Booking.query()
      .where('businessId', business.id)
      .where('date', selectedDate.toISODate()!)
      .whereNotIn('status', ['cancelled'])

    const timeOffs = await this.getTimeOffsForDate(business.id, selectedDate, null)

    const slots = this.generateTimeSlots(
      availability.startTime,
      availability.endTime,
      service.durationMinutes,
      existingBookings.map((b) => ({ start: b.startTime, end: b.endTime })),
      selectedDate,
      timeOffs
    )

    return response.json({ slots })
  }

  private async getTimeOffsForDate(
    businessId: number,
    date: DateTime,
    staffId: number | null
  ): Promise<TimeOff[]> {
    const startOfDay = date.startOf('day')
    const endOfDay = date.endOf('day')

    const query = TimeOff.query()
      .where('businessId', businessId)
      .where('startDatetime', '<=', endOfDay.toISO()!)
      .where('endDatetime', '>=', startOfDay.toISO()!)

    if (staffId) {
      query.where((q) => {
        q.whereNull('userId').orWhere('userId', staffId)
      })
    } else {
      query.whereNull('userId')
    }

    return query
  }

  private isTimeBlockedByTimeOff(
    date: DateTime,
    timeStr: string,
    endTimeStr: string,
    timeOffs: TimeOff[]
  ): boolean {
    const [startH, startM] = timeStr.split(':').map(Number)
    const [endH, endM] = endTimeStr.split(':').map(Number)

    const slotStart = date.set({ hour: startH, minute: startM, second: 0 })
    const slotEnd = date.set({ hour: endH, minute: endM, second: 0 })

    return timeOffs.some((timeOff) => {
      return slotStart < timeOff.endDatetime && slotEnd > timeOff.startDatetime
    })
  }

  private generateTimeSlots(
    startTime: string,
    endTime: string,
    durationMinutes: number,
    bookedSlots: Array<{ start: string; end: string }>,
    date?: DateTime,
    timeOffs?: TimeOff[]
  ) {
    const slots: Array<{ time: string; available: boolean }> = []
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)

    let currentHour = startHour
    let currentMin = startMin

    const endInMinutes = endHour * 60 + endMin

    while (currentHour * 60 + currentMin + durationMinutes <= endInMinutes) {
      const timeStr = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`
      const slotEndMin = currentHour * 60 + currentMin + durationMinutes
      const slotEndHour = Math.floor(slotEndMin / 60)
      const slotEndMinute = slotEndMin % 60
      const slotEndStr = `${slotEndHour.toString().padStart(2, '0')}:${slotEndMinute.toString().padStart(2, '0')}`

      const isBooked = bookedSlots.some((booked) => {
        return this.timesOverlap(timeStr, slotEndStr, booked.start, booked.end)
      })

      const isBlockedByTimeOff =
        date && timeOffs && timeOffs.length > 0
          ? this.isTimeBlockedByTimeOff(date, timeStr, slotEndStr, timeOffs)
          : false

      slots.push({ time: timeStr, available: !isBooked && !isBlockedByTimeOff })

      currentMin += 30
      if (currentMin >= 60) {
        currentHour++
        currentMin -= 60
      }
    }

    return slots
  }

  private timesOverlap(start1: string, end1: string, start2: string, end2: string) {
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number)
      return h * 60 + m
    }
    const s1 = toMinutes(start1)
    const e1 = toMinutes(end1)
    const s2 = toMinutes(start2)
    const e2 = toMinutes(end2)
    return s1 < e2 && e1 > s2
  }

  async createBooking({ params, request, response, session }: HttpContext) {
    const isJsonRequest = request.header('Content-Type')?.includes('application/json')

    // Add CORS headers for embed widget
    const origin = request.header('origin')
    if (origin) {
      response.header('Access-Control-Allow-Origin', origin)
      response.header('Access-Control-Allow-Credentials', 'true')
    } else {
      response.header('Access-Control-Allow-Origin', '*')
    }

    const business = await Business.query()
      .where('slug', params.slug)
      .where('isActive', true)
      .preload('services', (query) => query.where('id', params.serviceId).preload('staff'))
      .first()

    if (!business || business.services.length === 0) {
      return response.notFound({ error: 'Business or service not found' })
    }

    try {
      // Check subscription booking limit (silently for customer-facing endpoint)
      const canCreate = await subscriptionService.canCreateBooking(business.id)
      if (!canCreate.allowed) {
        if (isJsonRequest) {
          return response.badRequest({
            error: 'Booking limit reached. Please contact the business directly.',
          })
        }
        session.flash(
          'error',
          'This business has reached their monthly booking limit. Please contact them directly.'
        )
        return response.redirect().back()
      }

      const data = await request.validateUsing(bookingValidator)
      const service = business.services[0]

      // Check if this is a package booking
      let packageInfo: ServicePackage | null = null
      if (data.packageId) {
        packageInfo = await ServicePackage.query()
          .where('id', data.packageId)
          .where('businessId', business.id)
          .where('isActive', true)
          .first()
      }

      // Use package duration and price if it's a package booking
      const durationMinutes = packageInfo ? packageInfo.durationMinutes : service.durationMinutes
      const basePrice = packageInfo ? Number(packageInfo.packagePrice) : service.price

      let assignedStaffId: number | null = data.staffId || null

      if (!assignedStaffId && service.staff.length > 0) {
        assignedStaffId = service.staff[0].id
      }

      const selectedDate = DateTime.fromISO(data.date)
      const [startHour, startMin] = data.time.split(':').map(Number)
      const endMinutes = startHour * 60 + startMin + durationMinutes
      const endTime = `${Math.floor(endMinutes / 60)
        .toString()
        .padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`

      const bookingQuery = Booking.query()
        .where('businessId', business.id)
        .where('date', selectedDate.toISODate()!)
        .whereNotIn('status', ['cancelled'])
        .where((query) => {
          query.where((q) => {
            q.where('startTime', '<', endTime).where('endTime', '>', data.time)
          })
        })

      if (assignedStaffId) {
        bookingQuery.where('staffId', assignedStaffId)
      }

      const existingBooking = await bookingQuery.first()

      if (existingBooking) {
        if (isJsonRequest) {
          return response.conflict({ error: 'This time slot is no longer available' })
        }
        session.flash('error', 'This time slot is no longer available')
        return response.redirect().back()
      }

      // Set payment expiration to 30 minutes from now
      const paymentExpiresAt = DateTime.now().plus({ minutes: 30 })

      // Calculate deposit and balance amounts
      // For packages, use package price; for services, use service price and deposit settings
      let depositAmount = 0
      let balanceDue = basePrice
      let paymentAmount = basePrice

      if (!packageInfo) {
        // Individual service - use deposit settings
        depositAmount = service.calculatedDepositAmount
        balanceDue = service.price - depositAmount
        paymentAmount = depositAmount > 0 ? depositAmount : service.price
      }

      // Determine location type and travel fee
      let locationType: 'business' | 'client' | 'virtual' | null = null
      let clientAddress: string | null = null
      let travelFee = 0

      if (service.locationType === 'flexible') {
        // Customer chooses location for flexible services
        locationType = data.locationType || 'business'
        if (locationType === 'client') {
          clientAddress = data.clientAddress || null
          travelFee = service.travelFee || 0
        }
      } else if (service.locationType === 'client') {
        // Client location service - always at client
        locationType = 'client'
        clientAddress = data.clientAddress || null
        travelFee = service.travelFee || 0
      } else if (service.locationType === 'virtual') {
        locationType = 'virtual'
      } else {
        locationType = 'business'
      }

      // Adjust payment amount to include travel fee
      paymentAmount = paymentAmount + travelFee

      // Find or create customer record
      let customerId: number | null = null
      let customer = await Customer.findBy('email', data.customerEmail.toLowerCase())
      if (!customer) {
        customer = await Customer.create({
          email: data.customerEmail.toLowerCase(),
          name: data.customerName,
          phone: data.customerPhone || null,
          isVerified: false,
          verificationToken: randomUUID(),
        })
      } else {
        // Update customer info if they provided new details
        if (data.customerPhone && !customer.phone) {
          customer.phone = data.customerPhone
          await customer.save()
        }
      }
      customerId = customer.id
      customer.lastBookingAt = DateTime.now()
      await customer.save()

      const booking = await Booking.create({
        businessId: business.id,
        serviceId: service.id,
        packageId: packageInfo?.id || null,
        staffId: assignedStaffId,
        customerId: customerId,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone || null,
        date: selectedDate,
        startTime: data.time,
        endTime: endTime,
        status: 'pending_payment',
        amount: paymentAmount,
        depositAmount: depositAmount,
        balanceDue: balanceDue,
        locationType: locationType,
        clientAddress: clientAddress,
        travelFee: travelFee,
        paymentStatus: 'pending',
        paymentReference: randomUUID(),
        paymentExpiresAt,
        paymentAttempts: 0,
        idempotencyKey: randomUUID(),
      })

      const paymentUrl = `/book/${params.slug}/booking/${booking.id}/payment`

      if (isJsonRequest) {
        return response.json({ success: true, redirect: paymentUrl })
      }

      return response.redirect().toRoute('book.payment', {
        slug: params.slug,
        bookingId: booking.id,
      })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        if (isJsonRequest) {
          return response.badRequest({ error: 'Please fill in all required fields' })
        }
        session.flash('error', 'Please fill in all required fields')
        return response.redirect().back()
      }
      throw error
    }
  }

  async showPayment({ params, view, response, session, request }: HttpContext) {
    const booking = await Booking.query()
      .where('id', params.bookingId)
      .preload('business')
      .preload('service')
      .first()

    if (!booking || booking.business.slug !== params.slug) {
      return response.notFound('Booking not found')
    }

    if (booking.paymentStatus === 'paid') {
      return response.redirect().toRoute('book.confirmation', {
        slug: params.slug,
        bookingId: booking.id,
      })
    }

    // Check if payment expired
    if (booking.isPaymentExpired) {
      session.flash('error', 'Payment time has expired. Please create a new booking.')
      return response.redirect().toRoute('book.show', {
        slug: params.slug,
      })
    }

    // Detect customer currency from location (for price conversion)
    // Allow override via query parameter for testing (e.g., ?currency=USD)
    const currencyOverride = request.qs().currency
    const customerCurrency =
      currencyOverride ||
      currencyService.detectCurrencyFromCountry(request.header('cf-ipcountry') || '') ||
      currencyService.detectCurrencyFromLocale(request.header('accept-language') || '') ||
      booking.business.currency ||
      'NGN'

    // Convert booking amounts from business currency to customer currency
    const businessCurrency = booking.business.currency || 'NGN'
    const amountInSmallestUnit = Math.round(booking.amount * 100)
    const depositAmountInSmallestUnit = Math.round(booking.depositAmount * 100)
    const balanceDueInSmallestUnit = Math.round(booking.balanceDue * 100)

    const convertedAmount = await currencyService.convertAmount(
      amountInSmallestUnit,
      businessCurrency,
      customerCurrency
    )
    const convertedDepositAmount = await currencyService.convertAmount(
      depositAmountInSmallestUnit,
      businessCurrency,
      customerCurrency
    )
    const convertedBalanceDue = await currencyService.convertAmount(
      balanceDueInSmallestUnit,
      businessCurrency,
      customerCurrency
    )

    // Convert to decimal for display
    const convertedAmountDecimal = convertedAmount / 100
    const convertedDepositAmountDecimal = convertedDepositAmount / 100
    const convertedBalanceDueDecimal = convertedBalanceDue / 100
    const totalAmountDecimal = convertedDepositAmountDecimal + convertedBalanceDueDecimal

    const paystackPublicKey = env.get('PAYSTACK_PUBLIC_KEY', 'pk_test_xxxxx')

    // Determine payment provider based on currency
    const paystackSupportedCurrencies = ['NGN', 'ZAR', 'KES', 'GHS', 'UGX']
    const isPaystackCurrency = paystackSupportedCurrencies.includes(customerCurrency.toUpperCase())

    // Determine payment provider: Paystack (for African currencies) or Flutterwave (for international)
    const paymentProvider = isPaystackCurrency ? 'paystack' : 'flutterwave'

    // Calculate time remaining
    let timeRemaining: number | null = null
    if (booking.paymentExpiresAt) {
      const diff = booking.paymentExpiresAt.diff(DateTime.now(), 'seconds')
      timeRemaining = Math.max(0, Math.floor(diff.seconds))
    }

    // Safely get error message from flash or booking
    const flashError = session.flashMessages.get('error')
    const errorMessage = flashError || booking.lastPaymentError || null

    return view.render('pages/book/payment', {
      booking,
      paystackPublicKey,
      timeRemaining,
      canRetry: booking.canRetryPayment,
      errorMessage,
      customerCurrency,
      businessCurrency,
      convertedAmount: convertedAmountDecimal,
      convertedDepositAmount: convertedDepositAmountDecimal,
      convertedBalanceDue: convertedBalanceDueDecimal,
      totalAmount: totalAmountDecimal,
      paymentProvider,
    })
  }

  async createPaymentIntent({ params, request, response }: HttpContext) {
    const booking = await Booking.query()
      .where('id', params.bookingId)
      .preload('business')
      .preload('service')
      .first()

    if (!booking || booking.business.slug !== params.slug) {
      return response.status(404).json({ error: 'Booking not found' })
    }

    if (booking.paymentStatus === 'paid') {
      return response.status(400).json({ error: 'Booking already paid' })
    }

    // Detect customer currency from location
    const currencyOverride = request.qs().currency
    const customerCurrency =
      currencyOverride ||
      currencyService.detectCurrencyFromCountry(request.header('cf-ipcountry') || '') ||
      currencyService.detectCurrencyFromLocale(request.header('accept-language') || '') ||
      booking.business.currency ||
      'NGN'

    // Use Flutterwave for international payments
    if (!flutterwaveService.isConfigured()) {
      return response.status(400).json({ error: 'Flutterwave is not configured' })
    }

    try {
      const businessCurrency = booking.business.currency || 'NGN'
      const amountInSmallestUnit = Math.round(booking.amount * 100)
      const convertedAmount = await currencyService.convertAmount(
        amountInSmallestUnit,
        businessCurrency,
        customerCurrency
      )

      const appUrl = env.get('APP_URL') || 'http://localhost:3333'
      const result = await flutterwaveService.initializePayment(
        convertedAmount / 100, // Flutterwave expects decimal amount
        customerCurrency,
        booking.customerEmail,
        booking.customerName,
        `${appUrl}/book/${booking.business.slug}/booking/${booking.id}/verify?provider=flutterwave`,
        {
          businessId: booking.businessId.toString(),
          bookingId: booking.id.toString(),
          serviceName: booking.service?.name || '',
        }
      )

      return response.json({
        paymentLink: result.paymentLink,
        reference: result.reference,
        provider: 'flutterwave',
      })
    } catch (error: any) {
      console.error('[BOOKING] Error creating Flutterwave payment:', error)
      return response
        .status(500)
        .json({ error: error.message || 'Failed to create Flutterwave payment' })
    }
  }

  async confirmBooking({ params, view, response }: HttpContext) {
    const booking = await Booking.query()
      .where('id', params.bookingId)
      .preload('business')
      .preload('service')
      .first()

    if (!booking || booking.business.slug !== params.slug) {
      return response.notFound('Booking not found')
    }

    // Get transaction for receipt
    const transaction = await Transaction.query()
      .where('bookingId', booking.id)
      .where('status', 'success')
      .orderBy('createdAt', 'desc')
      .first()

    // Check if receipt exists
    let receiptAvailable = false
    if (transaction) {
      const receiptNumber = `REC-${transaction.id}-${transaction.createdAt.toFormat('yyyyMMdd')}`
      receiptAvailable = await receiptService.receiptExists(receiptNumber)
    }

    return view.render('pages/book/confirmation', {
      booking,
      transaction,
      receiptAvailable,
    })
  }

  async downloadReceipt({ params, response }: HttpContext) {
    const booking = await Booking.query()
      .where('id', params.bookingId)
      .preload('business')
      .preload('service')
      .first()

    if (!booking || booking.business.slug !== params.slug) {
      return response.notFound('Booking not found')
    }

    if (booking.paymentStatus !== 'paid') {
      return response.badRequest('Receipt is only available for paid bookings')
    }

    const transaction = await Transaction.query()
      .where('bookingId', booking.id)
      .where('status', 'success')
      .orderBy('createdAt', 'desc')
      .first()

    if (!transaction) {
      return response.notFound('Transaction not found')
    }

    const receiptNumber = `REC-${transaction.id}-${transaction.createdAt.toFormat('yyyyMMdd')}`

    if (!(await receiptService.receiptExists(receiptNumber))) {
      try {
        await receiptService.generateReceipt(booking, transaction)
      } catch (error) {
        console.error('[Receipt] Failed to generate receipt:', error)
        return response
          .status(500)
          .send(
            'Failed to generate receipt. Please ensure pdfkit is installed: pnpm add pdfkit @types/pdfkit'
          )
      }
    }

    try {
      const receiptPath = await receiptService.getReceiptPath(receiptNumber)
      const fileContent = await storageService.read(receiptPath)

      return response
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${receiptNumber}.pdf"`)
        .send(fileContent)
    } catch (error) {
      console.error('[Receipt] Failed to read receipt file:', error)
      return response.status(500).send('Failed to read receipt file')
    }
  }

  async getPaymentStatus({ params, response }: HttpContext) {
    const booking = await Booking.query().where('id', params.bookingId).first()

    if (!booking || booking.business?.slug !== params.slug) {
      return response.notFound('Booking not found')
    }

    return response.json({
      paymentStatus: booking.paymentStatus,
      status: booking.status,
      paymentAttempts: booking.paymentAttempts || 0,
      lastPaymentError: booking.lastPaymentError,
      isPaymentExpired: booking.isPaymentExpired,
      canRetry: booking.canRetryPayment,
      paymentExpiresAt: booking.paymentExpiresAt?.toISO() || null,
    })
  }

  async verifyPayment({ params, request, response, session }: HttpContext) {
    const reference = request.qs().reference
    const transactionId = request.qs().transaction_id
    const provider = request.qs().provider

    // Handle Flutterwave payment verification
    if (provider === 'flutterwave' && transactionId && flutterwaveService.isConfigured()) {
      try {
        const verification = await flutterwaveService.verifyTransaction(transactionId)

        if (!verification.success || verification.status !== 'successful') {
          session.flash('error', 'Payment was not successful. Please try again.')
          return response.redirect().toRoute('book.payment', {
            slug: params.slug,
            bookingId: params.bookingId,
          })
        }

        const booking = await Booking.query()
          .where('id', params.bookingId)
          .preload('business')
          .preload('service')
          .first()

        if (!booking || booking.business.slug !== params.slug) {
          return response.notFound('Booking not found')
        }

        // Idempotency check
        if (booking.paymentStatus === 'paid' && booking.status === 'confirmed') {
          return response.redirect().toRoute('book.confirmation', {
            slug: params.slug,
            bookingId: booking.id,
          })
        }

        // Process Flutterwave payment
        const amount = verification.amount
        const currency = verification.currency
        const platformFee = Math.round(amount * 0.025)

        await db.transaction(async (trx) => {
          // Update booking
          booking.paymentStatus = 'paid'
          booking.status = 'confirmed'
          booking.paymentReference = verification.reference
          await booking.useTransaction(trx).save()

          // Create transaction record
          const transaction = new Transaction()
          transaction.businessId = booking.businessId
          transaction.bookingId = booking.id
          transaction.amount = amount
          transaction.platformFee = platformFee
          transaction.businessAmount = amount - platformFee
          transaction.status = 'success'
          transaction.provider = 'flutterwave'
          transaction.type = 'payment'
          transaction.direction = 'credit'
          transaction.reference = verification.reference
          transaction.providerReference = transactionId
          transaction.currency = currency
          await transaction.useTransaction(trx).save()
        })

        // Send confirmation email
        try {
          await emailService.sendBookingConfirmation({
            customerName: booking.customerName,
            customerEmail: booking.customerEmail,
            businessName: booking.business.name,
            serviceName: booking.service?.name || '',
            date: booking.date.toFormat('EEE, MMM d, yyyy'),
            time: booking.startTime,
            duration: `${booking.service?.durationMinutes || 30} minutes`,
            amount,
            currency,
            reference: verification.reference,
          })
        } catch (error) {
          console.error('[EMAIL] Failed to send booking confirmation:', error)
        }

        return response.redirect().toRoute('book.confirmation', {
          slug: params.slug,
          bookingId: booking.id,
        })
      } catch (error: any) {
        console.error('[BOOKING] Error verifying Flutterwave payment:', error)
        session.flash(
          'error',
          'Payment verification failed. Please contact support if payment was deducted.'
        )
        return response.redirect().toRoute('book.payment', {
          slug: params.slug,
          bookingId: params.bookingId,
        })
      }
    }

    // Handle Paystack payment (existing logic)
    if (!reference) {
      session.flash('error', 'Payment reference is required')
      return response.redirect().toRoute('book.payment', {
        slug: params.slug,
        bookingId: params.bookingId,
      })
    }

    const booking = await Booking.query()
      .where('id', params.bookingId)
      .preload('business')
      .preload('service')
      .first()

    if (!booking || booking.business.slug !== params.slug) {
      return response.notFound('Booking not found')
    }

    // Idempotency check: If already paid, redirect to confirmation
    if (booking.paymentStatus === 'paid' && booking.status === 'confirmed') {
      return response.redirect().toRoute('book.confirmation', {
        slug: params.slug,
        bookingId: booking.id,
      })
    }

    // Check if payment expired
    if (booking.isPaymentExpired) {
      session.flash('error', 'Payment time has expired. Please create a new booking.')
      return response.redirect().toRoute('book.show', {
        slug: params.slug,
      })
    }

    const secretKey = env.get('PAYSTACK_SECRET_KEY')
    let paymentSuccess = false
    let errorMessage: string | null = null

    if (secretKey) {
      // Retry logic: Try up to 3 times with exponential backoff
      let retries = 0
      const maxRetries = 3

      while (retries < maxRetries && !paymentSuccess) {
        try {
          const paystackResponse = await fetch(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
              headers: {
                Authorization: `Bearer ${secretKey}`,
              },
            }
          )

          if (!paystackResponse.ok) {
            throw new Error(`Paystack API returned status ${paystackResponse.status}`)
          }

          const data = (await paystackResponse.json()) as {
            status: boolean
            message?: string
            data?: {
              status: string
              reference: string
              amount: number
              currency: string
              paid_at: string
              gateway_response?: string
            }
          }

          // Handle different payment statuses
          if (data.status && data.data) {
            const paymentStatus = data.data.status

            if (paymentStatus === 'success') {
              // Check if transaction already exists (idempotency)
              const existingTransaction = await Transaction.query()
                .where('bookingId', booking.id)
                .where('status', 'success')
                .where('providerReference', data.data.reference)
                .first()

              if (existingTransaction) {
                // Already processed, update booking if needed
                if (booking.paymentStatus !== 'paid') {
                  booking.paymentStatus = 'paid'
                  booking.status = 'confirmed'
                  await booking.save()
                }
                paymentSuccess = true
                break
              }

              // Use database transaction for atomicity
              const trx = await Booking.transaction(async (trx2: TransactionClientContract) => {
                // Double-check booking status within transaction
                await booking.refresh()
                if (booking.paymentStatus === 'paid') {
                  return null // Already paid, skip
                }

                booking.paymentStatus = 'paid'
                booking.status = 'confirmed'
                await booking.useTransaction(trx2).save()

                if (!data.data) {
                  throw new Error('Payment data is missing')
                }

                const amount = data.data.amount / 100
                const platformFee = Math.round(amount * 0.025)
                const currency = data.data.currency?.toUpperCase() || booking.business.currency || 'NGN'

                const transaction = new Transaction()
                transaction.businessId = booking.businessId
                transaction.bookingId = booking.id
                transaction.amount = amount
                transaction.platformFee = platformFee
                transaction.businessAmount = amount - platformFee
                transaction.status = 'success'
                transaction.provider = 'paystack'
                transaction.type = 'payment'
                transaction.direction = 'credit'
                transaction.reference = booking.paymentReference || reference
                transaction.providerReference = data.data.reference
                transaction.currency = currency
                await transaction.useTransaction(trx2).save()

                return {
                  amount,
                  reference: booking.paymentReference || reference,
                  providerReference: data.data.reference,
                  paidAt: data.data.paid_at,
                }
              })

              if (trx) {
                paymentSuccess = true
              }
            } else if (paymentStatus === 'pending') {
              errorMessage = 'Payment is still being processed. Please wait a moment and try again.'
              booking.paymentAttempts = (booking.paymentAttempts || 0) + 1
              booking.lastPaymentError = 'Payment pending'
              await booking.save()
              break
            } else {
              errorMessage = `Payment verification failed: ${data.data?.gateway_response || 'Unknown error'}`
              booking.paymentAttempts = (booking.paymentAttempts || 0) + 1
              booking.lastPaymentError = errorMessage
              await booking.save()
            }
          } else {
            errorMessage = data.message || 'Payment verification failed'
            booking.paymentAttempts = (booking.paymentAttempts || 0) + 1
            booking.lastPaymentError = errorMessage
            await booking.save()
          }
        } catch (error: any) {
          retries++
          if (retries < maxRetries) {
            // Exponential backoff: wait 1s, 2s, 4s
            const delay = Math.pow(2, retries - 1) * 1000
            await new Promise((resolve) => setTimeout(resolve, delay))
            console.log(`[PAYMENT] Retry ${retries}/${maxRetries} for booking #${booking.id}`)
          } else {
            errorMessage = `Payment verification failed after ${maxRetries} attempts: ${error.message}`
            booking.paymentAttempts = (booking.paymentAttempts || 0) + 1
            booking.lastPaymentError = errorMessage
            await booking.save()
            console.error('[PAYMENT] Payment verification error:', error)
          }
        }
      }
    } else if (!app.inProduction) {
      // Dev mode - auto confirm
      booking.paymentStatus = 'paid'
      booking.status = 'confirmed'
      await booking.save()
      paymentSuccess = true
      console.warn('[DEV MODE] Payment auto-confirmed without verification')
    } else {
      console.error('[PRODUCTION] Payment verification failed: PAYSTACK_SECRET_KEY not configured')
      session.flash('error', 'Payment verification failed. Please contact support.')
      return response.redirect().toRoute('book.payment', {
        slug: params.slug,
        bookingId: booking.id,
      })
    }

    if (paymentSuccess) {
      const dateFormatted = booking.date.toFormat('EEEE, MMMM d, yyyy')
      const appUrl = env.get('APP_URL', `https://${env.get('APP_DOMAIN', 'fastappoint.com')}`)
      const manageUrl = `${appUrl}/book/${params.slug}/booking/${booking.id}/manage`

      // Get the transaction for receipt generation
      const transaction = await Transaction.query()
        .where('bookingId', booking.id)
        .where('status', 'success')
        .orderBy('createdAt', 'desc')
        .first()

      // Generate receipt asynchronously (don't block redirect)
      if (transaction) {
        receiptService.generateReceipt(booking, transaction).catch((error) => {
          console.error('[Receipt] Failed to generate receipt:', error)
        })
      }

      // Get currency from transaction metadata or detect from payment provider
      let paymentCurrency = booking.business.currency || 'NGN'

      await emailService.sendBookingConfirmation({
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        businessName: booking.business.name,
        serviceName: booking.service.name,
        date: dateFormatted,
        time: `${booking.startTime} - ${booking.endTime}`,
        duration: booking.service.formattedDuration,
        amount: transaction?.amount || booking.amount,
        currency: paymentCurrency,
        reference: booking.paymentReference?.substring(0, 8).toUpperCase() || '',
        bookingUrl: manageUrl,
      })

      await emailService.sendBusinessNotification({
        businessEmail: booking.business.email,
        businessName: booking.business.name,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        serviceName: booking.service.name,
        date: dateFormatted,
        time: `${booking.startTime} - ${booking.endTime}`,
        amount: booking.amount,
      })

      // Create Google Calendar event (async, non-blocking)
      if (booking.business.googleCalendarEnabled) {
        googleCalendarService
          .createBookingEvent(booking.business, booking)
          .then(async (result) => {
            if (result) {
              booking.googleEventId = result.eventId
              await booking.save()
              console.log(
                `[Google Calendar] Created event ${result.eventId} for booking #${booking.id}`
              )
            }
          })
          .catch((error) => {
            console.error('[Google Calendar] Failed to create event:', error)
          })
      }

      return response.redirect().toRoute('book.confirmation', {
        slug: params.slug,
        bookingId: booking.id,
      })
    } else {
      // Payment failed or pending - send notification email
      const appUrl = env.get('APP_URL', `https://${env.get('APP_DOMAIN', 'fastappoint.com')}`)
      const paymentUrl = `${appUrl}/book/${params.slug}/booking/${booking.id}/payment`
      const manageUrl = `${appUrl}/book/${params.slug}/booking/${booking.id}/manage`

      if (errorMessage) {
        // Send payment failure email
        await emailService
          .sendPaymentFailureNotification({
            customerName: booking.customerName,
            customerEmail: booking.customerEmail,
            businessName: booking.business.name,
            serviceName: booking.service.name,
            amount: booking.amount,
            errorMessage: errorMessage,
            bookingUrl: manageUrl,
            paymentUrl: paymentUrl,
          })
          .catch((error) => {
            console.error('[Payment] Failed to send payment failure email:', error)
          })

        session.flash('error', errorMessage)
      } else {
        session.flash(
          'error',
          'Payment verification failed. Please try again or contact support if the issue persists.'
        )
      }

      return response.redirect().toRoute('book.payment', {
        slug: params.slug,
        bookingId: booking.id,
      })
    }
  }

  async findBooking({ view }: HttpContext) {
    return view.render('pages/book/find')
  }

  async lookupBooking({ request, response, session }: HttpContext) {
    const { email, reference, businessSlug } = request.only(['email', 'reference', 'businessSlug'])

    if (!email || !reference) {
      session.flash('error', 'Please provide both email and booking reference')
      return response.redirect().back()
    }

    const query = Booking.query()
      .whereILike('customerEmail', email)
      .whereILike('paymentReference', `%${reference.toUpperCase()}%`)
      .preload('business')

    if (businessSlug) {
      const business = await Business.query().where('slug', businessSlug).first()
      if (business) {
        query.where('businessId', business.id)
      }
    }

    const booking = await query.first()

    if (!booking) {
      session.flash('error', 'Booking not found. Please check your email and reference number.')
      return response.redirect().back()
    }

    return response.redirect().toRoute('book.manage', {
      slug: booking.business.slug,
      bookingId: booking.id,
    })
  }

  async manageBooking({ params, view, response, request }: HttpContext) {
    const email = request.qs().email
    const ref = request.qs().ref

    const booking = await Booking.query()
      .where('id', params.bookingId)
      .preload('business')
      .preload('service')
      .preload('staff')
      .first()

    if (!booking || booking.business.slug !== params.slug) {
      return response.notFound('Booking not found')
    }

    if (email && booking.customerEmail.toLowerCase() !== email.toLowerCase()) {
      return response.notFound('Booking not found')
    }

    if (ref && booking.paymentReference?.substring(0, 8).toUpperCase() !== ref.toUpperCase()) {
      return response.notFound('Booking not found')
    }

    const canCancel = this.canCancelBooking(booking)
    const canReschedule = this.canRescheduleBooking(booking)

    return view.render('pages/book/manage', { booking, canCancel, canReschedule })
  }

  private canCancelBooking(booking: Booking): boolean {
    if (booking.status !== 'confirmed') return false
    if (booking.isPast) return false

    const business = booking.business
    if (!business.cancellationHours) return true

    const bookingDateTime = booking.date.set({
      hour: Number.parseInt(booking.startTime.split(':')[0]),
      minute: Number.parseInt(booking.startTime.split(':')[1]),
    })

    const hoursUntilBooking = bookingDateTime.diff(DateTime.now(), 'hours').hours
    return hoursUntilBooking >= business.cancellationHours
  }

  private canRescheduleBooking(booking: Booking): boolean {
    return this.canCancelBooking(booking)
  }

  async cancelBooking({ params, response, session }: HttpContext) {
    const booking = await Booking.query()
      .where('id', params.bookingId)
      .preload('business')
      .preload('service')
      .first()

    if (!booking || booking.business.slug !== params.slug) {
      return response.notFound('Booking not found')
    }

    if (!this.canCancelBooking(booking)) {
      session.flash('error', 'This booking cannot be cancelled')
      return response.redirect().back()
    }

    booking.status = 'cancelled'
    booking.cancelledAt = DateTime.now()
    booking.cancellationReason = 'Cancelled by customer'
    await booking.save()

    // Delete Google Calendar event (async, non-blocking)
    if (booking.business.googleCalendarEnabled && booking.googleEventId) {
      const eventId = booking.googleEventId
      const bookingId = booking.id
      googleCalendarService
        .deleteBookingEvent(booking.business, eventId)
        .then((success) => {
          if (success) {
            console.log(`[Google Calendar] Deleted event ${eventId} for booking #${bookingId}`)
          }
        })
        .catch((error) => {
          console.error('[Google Calendar] Failed to delete event:', error)
        })
    }

    session.flash('success', 'Booking cancelled successfully')
    return response.redirect().toRoute('book.manage', {
      slug: params.slug,
      bookingId: booking.id,
    })
  }

  async showReschedule({ params, view, response }: HttpContext) {
    const booking = await Booking.query()
      .where('id', params.bookingId)
      .preload('business', (query) => {
        query.preload('availabilities', (q) => q.where('isActive', true))
      })
      .preload('service')
      .first()

    if (!booking || booking.business.slug !== params.slug) {
      return response.notFound('Booking not found')
    }

    if (!this.canRescheduleBooking(booking)) {
      return response.redirect().toRoute('book.manage', {
        slug: params.slug,
        bookingId: booking.id,
      })
    }

    return view.render('pages/book/reschedule', { booking })
  }

  async rescheduleBooking({ params, request, response, session }: HttpContext) {
    const booking = await Booking.query()
      .where('id', params.bookingId)
      .preload('business')
      .preload('service')
      .first()

    if (!booking || booking.business.slug !== params.slug) {
      return response.notFound('Booking not found')
    }

    if (!this.canRescheduleBooking(booking)) {
      session.flash('error', 'This booking cannot be rescheduled')
      return response.redirect().back()
    }

    try {
      const data = await request.validateUsing(rescheduleValidator)
      const selectedDate = DateTime.fromISO(data.date)

      if (!selectedDate.isValid) {
        session.flash('error', 'Invalid date format')
        return response.redirect().back()
      }

      if (selectedDate < DateTime.now().startOf('day')) {
        session.flash('error', 'Cannot reschedule to a past date')
        return response.redirect().back()
      }

      const [startHour, startMin] = data.time.split(':').map(Number)
      const endMinutes = startHour * 60 + startMin + booking.service.durationMinutes
      const endTime = `${Math.floor(endMinutes / 60)
        .toString()
        .padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`

      const existingBooking = await Booking.query()
        .where('businessId', booking.businessId)
        .where('date', selectedDate.toISODate()!)
        .whereNot('id', booking.id)
        .whereNotIn('status', ['cancelled'])
        .where((query) => {
          query.where((q) => {
            q.where('startTime', '<', endTime).where('endTime', '>', data.time)
          })
        })
        .first()

      if (existingBooking) {
        session.flash('error', 'This time slot is no longer available')
        return response.redirect().back()
      }

      // Store old date and time for email notification
      const oldDate = booking.date.toFormat('EEEE, MMMM d, yyyy')
      const oldTime = `${booking.startTime} - ${booking.endTime}`

      booking.date = selectedDate
      booking.startTime = data.time
      booking.endTime = endTime
      await booking.save()

      // Reload booking with relations for email
      await booking.load('service')
      await booking.load('business')

      // Send email notifications
      const newDate = selectedDate.toFormat('EEEE, MMMM d, yyyy')
      const newTime = `${data.time} - ${endTime}`
      const appUrl = env.get('APP_URL', `https://${env.get('APP_DOMAIN', 'fastappoint.com')}`)
      const manageUrl = `${appUrl}/book/${params.slug}/booking/${booking.id}/manage`

      await emailService.sendBookingRescheduleNotification({
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        businessName: booking.business.name,
        businessEmail: booking.business.email,
        serviceName: booking.service.name,
        oldDate,
        oldTime,
        newDate,
        newTime,
        manageUrl,
      })

      // Update Google Calendar event (async, non-blocking)
      if (booking.business.googleCalendarEnabled && booking.googleEventId) {
        const eventId = booking.googleEventId
        const bookingId = booking.id
        googleCalendarService
          .updateBookingEvent(booking.business, booking, eventId)
          .then((success) => {
            if (success) {
              console.log(`[Google Calendar] Updated event ${eventId} for booking #${bookingId}`)
            }
          })
          .catch((error) => {
            console.error('[Google Calendar] Failed to update event:', error)
          })
      }

      session.flash('success', 'Booking rescheduled successfully')
      return response.redirect().toRoute('book.manage', {
        slug: params.slug,
        bookingId: booking.id,
      })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        session.flash('error', 'Please provide a valid date and time')
        return response.redirect().back()
      }
      throw error
    }
  }

  async embed({ params, view, response, request }: HttpContext) {
    const business = await Business.query()
      .where('slug', params.slug)
      .where('isActive', true)
      .where('isOnboarded', true)
      .preload('services', (query) => {
        query
          .where('isActive', true)
          .orderBy('sortOrder')
          .preload('staff', (staffQuery) => {
            staffQuery.where('isActive', true)
          })
      })
      .preload('availabilities', (query) => query.where('isActive', true))
      .preload('theme')
      .first()

    if (!business) {
      return response.status(404).send('Business not found')
    }

    const theme = business.theme
    const staff = await User.query()
      .where('businessId', business.id)
      .where('isActive', true)
      .where('role', 'staff')

    return view.render('pages/book/embed', {
      business,
      theme,
      services: business.services,
      staff,
      csrfToken: request.csrfToken,
    })
  }
}
