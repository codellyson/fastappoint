import vine from '@vinejs/vine'

export const businessDetailsValidator = vine.compile(
  vine.object({
    name: vine.string().minLength(2).maxLength(100),
    description: vine
      .string()
      .trim()
      .maxLength(500)
      .optional()
      .transform((value) => {
        if (!value || value === '' || value === 'null' || value === null) {
          return undefined
        }
        return value
      }),
    phone: vine
      .string()
      .trim()
      .optional()
      .transform((value) => {
        if (!value || value === '' || value === 'null' || value === null) {
          return undefined
        }
        return value
      }),
    cancellationHours: vine.number().min(0).max(168),
  })
)

export const serviceValidator = vine.compile(
  vine.object({
    name: vine.string().minLength(2).maxLength(100),
    description: vine.string().maxLength(500).optional(),
    durationMinutes: vine.number().min(15).max(480),
    price: vine.number().min(0),
    depositType: vine.enum(['none', 'percentage', 'fixed']).optional(),
    depositAmount: vine.number().min(0).max(100).optional(),
    locationType: vine.enum(['business', 'client', 'virtual', 'flexible']).optional(),
    travelFee: vine.number().min(0).optional(),
    travelRadiusKm: vine.number().min(1).max(500).optional(),
    virtualMeetingUrl: vine.string().maxLength(500).optional(),
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

export const portfolioValidator = vine.compile(
  vine.object({
    title: vine.string().minLength(2).maxLength(100),
    description: vine.string().maxLength(500).optional(),
    serviceId: vine.number().optional(),
    isFeatured: vine.boolean().optional(),
  })
)

export const packageValidator = vine.compile(
  vine.object({
    name: vine.string().minLength(2).maxLength(255),
    description: vine.string().maxLength(1000).optional(),
    serviceIds: vine.array(vine.number()).minLength(2).maxLength(10),
    packagePrice: vine.number().min(0),
  })
)
