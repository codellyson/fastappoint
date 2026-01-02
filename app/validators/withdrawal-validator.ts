import vine from '@vinejs/vine'

export const addBankAccountValidator = vine.compile(
  vine.object({
    accountNumber: vine.string().trim().minLength(10).maxLength(10),
    bankCode: vine.string().trim().minLength(3).maxLength(10),
    bankName: vine.string().trim().minLength(2).maxLength(255),
    accountName: vine.string().trim().minLength(2).maxLength(255),
    isPrimary: vine.boolean().optional(),
  })
)

export const updateBankAccountValidator = vine.compile(
  vine.object({
    isPrimary: vine.boolean().optional(),
  })
)

export const withdrawalRequestValidator = vine.compile(
  vine.object({
    amount: vine.number().min(1000).max(10000000),
    bankAccountId: vine.number().positive(),
  })
)

