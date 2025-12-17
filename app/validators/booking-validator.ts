import vine from '@vinejs/vine'

export const bookingValidator = vine.compile(
  vine.object({
    date: vine.string().trim(),
    time: vine.string().trim(),
    customerName: vine.string().trim().minLength(2).maxLength(100),
    customerEmail: vine.string().trim().email(),
    customerPhone: vine.string().trim().optional(),
    notes: vine.string().trim().maxLength(500).optional(),
  })
)
