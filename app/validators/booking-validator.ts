import vine from '@vinejs/vine'

export const bookingValidator = vine.compile(
  vine.object({
    date: vine.string().trim(),
    time: vine.string().trim(),
    staffId: vine.number().optional(),
    packageId: vine.number().optional(),
    customerName: vine.string().trim().minLength(2).maxLength(100),
    customerEmail: vine.string().trim().email(),
    customerPhone: vine.string().trim().optional(),
    notes: vine.string().trim().maxLength(500).optional(),
    locationType: vine.enum(['business', 'client', 'virtual']).optional(),
    clientAddress: vine.string().trim().maxLength(500).optional(),
  })
)

export const rescheduleValidator = vine.compile(
  vine.object({
    date: vine.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: vine.string().trim().regex(/^\d{2}:\d{2}$/),
  })
)
