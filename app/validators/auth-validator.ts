import vine from '@vinejs/vine'

export const signupValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(2).maxLength(100),
    email: vine.string().trim().email(),
    phone: vine.string().trim().optional(),
    password: vine.string().minLength(8),
    businessName: vine.string().trim().minLength(2).maxLength(100),
    category: vine.enum(['beauty', 'media', 'health', 'fitness', 'education', 'other']),
  })
)

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email(),
    password: vine.string(),
  })
)
