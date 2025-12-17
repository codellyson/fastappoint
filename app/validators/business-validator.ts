import vine from '@vinejs/vine'

export const businessDetailsValidator = vine.compile(
  vine.object({
    name: vine.string().minLength(2).maxLength(100),
    description: vine.string().maxLength(500).optional(),
    phone: vine.string().minLength(10).maxLength(15).optional(),
    cancellationHours: vine.number().min(0).max(168),
  })
)

export const serviceValidator = vine.compile(
  vine.object({
    name: vine.string().minLength(2).maxLength(100),
    description: vine.string().maxLength(500).optional(),
    durationMinutes: vine.number().min(15).max(480),
    price: vine.number().min(0),
  })
)

export const availabilityValidator = vine.compile(
  vine.object({
    availabilities: vine.array(
      vine.object({
        dayOfWeek: vine.number().min(0).max(6),
        startTime: vine.string().regex(/^\d{2}:\d{2}$/),
        endTime: vine.string().regex(/^\d{2}:\d{2}$/),
        isActive: vine.boolean(),
      })
    ),
  })
)
