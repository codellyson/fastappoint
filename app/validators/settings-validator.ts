import vine from '@vinejs/vine'

export const businessProfileValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(100),
    description: vine.string().trim().maxLength(500).optional(),
    phone: vine.string().trim().optional(),
    category: vine.enum(['beauty', 'media', 'health', 'fitness', 'education', 'other']),
    timezone: vine.string().trim(),
    currency: vine.enum(['NGN', 'USD', 'GBP', 'EUR']),
  })
)

export const cancellationPolicyValidator = vine.compile(
  vine.object({
    cancellationPolicy: vine.string().trim().maxLength(1000).optional(),
    cancellationHours: vine.number().min(0).max(168),
  })
)

export const paystackSettingsValidator = vine.compile(
  vine.object({
    allowInstallments: vine.boolean(),
  })
)

export const notificationSettingsValidator = vine.compile(
  vine.object({
    reminder24hEnabled: vine.boolean(),
    reminder1hEnabled: vine.boolean(),
  })
)

