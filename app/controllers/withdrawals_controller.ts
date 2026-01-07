import type { HttpContext } from '@adonisjs/core/http'
import Business from '#models/business'
import BusinessBankAccount from '#models/business-bank-account'
import withdrawalService from '#services/withdrawal_service'
import walletService from '../services/wallet_service.js'
import {
  addBankAccountValidator,
  withdrawalRequestValidator,
} from '#validators/withdrawal-validator'
import { errors } from '@vinejs/vine'

export default class WithdrawalsController {
  /**
   * Show withdrawals dashboard with balance and history
   */
  async index({ view, auth }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    const balanceInfo = await withdrawalService.getBalanceInfo(business.id)
    const wallets = await walletService.getBusinessWallets(business.id)
    const withdrawals = await withdrawalService.getWithdrawalHistory(business.id, 10)
    const bankAccounts = await BusinessBankAccount.query()
      .where('businessId', business.id)
      .orderBy('isPrimary', 'desc')
      .orderBy('createdAt', 'desc')

    const primaryAccount = bankAccounts.find((acc) => acc.isPrimary) || bankAccounts[0] || null

    return view.render('pages/settings/withdrawals/index', {
      business,
      balanceInfo,
      wallets,
      withdrawals,
      bankAccounts,
      primaryAccount,
    })
  }

  /**
   * Show bank accounts management page
   */
  async bankAccounts({ view, auth }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    const bankAccounts = await BusinessBankAccount.query()
      .where('businessId', business.id)
      .orderBy('isPrimary', 'desc')
      .orderBy('createdAt', 'desc')

    return view.render('pages/settings/withdrawals/bank-accounts', {
      business,
      bankAccounts,
    })
  }

  /**
   * Show add bank account form
   */
  async addBankAccountForm({ view, auth }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    // Fetch Nigerian banks from Paystack
    const banks = await withdrawalService.getNigerianBanks()

    return view.render('pages/settings/withdrawals/add-bank-account', {
      business,
      banks,
    })
  }

  /**
   * Verify bank account via AJAX
   */
  async verifyBankAccount({ request, response }: HttpContext) {
    const { accountNumber, bankCode } = request.only(['accountNumber', 'bankCode'])

    if (!accountNumber || !bankCode) {
      return response.json({ valid: false, error: 'Account number and bank code are required' })
    }

    const result = await withdrawalService.verifyBankAccount(accountNumber, bankCode)
    return response.json(result)
  }

  /**
   * Store a new bank account
   */
  async storeBankAccount({ request, response, auth, session }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    try {
      const data = await request.validateUsing(addBankAccountValidator)

      // Check if this account already exists for the business
      const existing = await BusinessBankAccount.query()
        .where('businessId', business.id)
        .where('accountNumber', data.accountNumber)
        .where('bankCode', data.bankCode)
        .first()

      if (existing) {
        session.flash('error', 'This bank account is already added')
        return response.redirect().back()
      }

      // Verify the account with Paystack
      const verification = await withdrawalService.verifyBankAccount(
        data.accountNumber,
        data.bankCode
      )

      if (!verification.valid) {
        session.flash('error', verification.error || 'Could not verify bank account')
        return response.redirect().back()
      }

      // Check if this is the first bank account (make it primary)
      const existingAccounts = await BusinessBankAccount.query()
        .where('businessId', business.id)
        .count('id as total')
        .first()

      const isFirst = Number(existingAccounts?.$extras.total || 0) === 0

      // If setting as primary, unset other primary accounts
      if (data.isPrimary || isFirst) {
        await BusinessBankAccount.query()
          .where('businessId', business.id)
          .update({ isPrimary: false })
      }

      // Create the bank account
      await BusinessBankAccount.create({
        businessId: business.id,
        accountNumber: data.accountNumber,
        bankCode: data.bankCode,
        bankName: data.bankName,
        accountName: verification.accountName || data.accountName,
        isPrimary: data.isPrimary || isFirst,
        isVerified: true,
      })

      session.flash('success', 'Bank account added successfully')
      return response.redirect().toRoute('settings.withdrawals.bank-accounts')
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        session.flash('error', 'Please check your input')
        return response.redirect().back()
      }
      throw error
    }
  }

  /**
   * Set a bank account as primary
   */
  async setPrimaryBankAccount({ params, response, auth, session }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    const bankAccount = await BusinessBankAccount.query()
      .where('id', params.id)
      .where('businessId', business.id)
      .first()

    if (!bankAccount) {
      session.flash('error', 'Bank account not found')
      return response.redirect().back()
    }

    // Unset other primary accounts
    await BusinessBankAccount.query().where('businessId', business.id).update({ isPrimary: false })

    // Set this account as primary
    bankAccount.isPrimary = true
    await bankAccount.save()

    session.flash('success', 'Primary bank account updated')
    return response.redirect().toRoute('settings.withdrawals.bank-accounts')
  }

  /**
   * Delete a bank account
   */
  async deleteBankAccount({ params, response, auth, session }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    const bankAccount = await BusinessBankAccount.query()
      .where('id', params.id)
      .where('businessId', business.id)
      .first()

    if (!bankAccount) {
      session.flash('error', 'Bank account not found')
      return response.redirect().back()
    }

    await bankAccount.delete()

    // If the deleted account was primary, set another account as primary
    if (bankAccount.isPrimary) {
      const nextAccount = await BusinessBankAccount.query()
        .where('businessId', business.id)
        .orderBy('createdAt', 'asc')
        .first()

      if (nextAccount) {
        nextAccount.isPrimary = true
        await nextAccount.save()
      }
    }

    session.flash('success', 'Bank account removed')
    return response.redirect().toRoute('settings.withdrawals.bank-accounts')
  }

  /**
   * Request a withdrawal
   */
  async requestWithdrawal({ request, response, auth, session }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    try {
      const data = await request.validateUsing(withdrawalRequestValidator)

      const result = await withdrawalService.requestWithdrawal(
        business.id,
        data.amount,
        data.bankAccountId
      )

      if (!result.success) {
        session.flash('error', result.error || 'Failed to create withdrawal request')
        return response.redirect().back()
      }

      session.flash(
        'success',
        `Withdrawal request for ₦${data.amount.toLocaleString()} submitted successfully`
      )
      return response.redirect().toRoute('settings.withdrawals.index')
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        session.flash('error', 'Please check your input')
        return response.redirect().back()
      }
      throw error
    }
  }

  /**
   * Cancel a pending withdrawal
   */
  async cancelWithdrawal({ params, response, auth, session }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    const result = await withdrawalService.cancelWithdrawal(params.id, business.id)

    if (!result.success) {
      session.flash('error', result.error || 'Failed to cancel withdrawal')
      return response.redirect().back()
    }

    session.flash('success', 'Withdrawal request cancelled')
    return response.redirect().toRoute('settings.withdrawals.index')
  }

  /**
   * Show withdrawal history page
   */
  async history({ view, auth, request }: HttpContext) {
    const user = auth.user!
    const business = await Business.findOrFail(user.businessId)

    const page = Number(request.input('page', 1))
    const limit = 20
    const offset = (page - 1) * limit

    const withdrawals = await withdrawalService.getWithdrawalHistory(business.id, limit, offset)

    return view.render('pages/settings/withdrawals/history', {
      business,
      withdrawals,
      currentPage: page,
    })
  }

  /**
   * API endpoint to get banks (for AJAX)
   */
  async getBanks({ response }: HttpContext) {
    const banks = await withdrawalService.getNigerianBanks()
    return response.json({ success: true, banks })
  }
}
