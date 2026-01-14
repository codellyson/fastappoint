import { DateTime } from 'luxon'
import env from '#start/env'
import Transaction from '#models/transaction'
import WithdrawalRequest from '#models/withdrawal-request'
import BusinessBankAccount from '#models/business-bank-account'
import Business from '#models/business'
import emailService from '#services/email_service'
import currencyService from './currency_service.js'

interface PaystackBank {
  name: string
  slug: string
  code: string
  country: string
  currency: string
  type: string
}

interface BalanceInfo {
  totalEarnings: number
  totalWithdrawn: number
  pendingWithdrawals: number
  availableBalance: number
}

class WithdrawalService {
  private readonly MIN_WITHDRAWAL = 1000 // ₦1,000 minimum
  private readonly MAX_WITHDRAWAL_PER_REQUEST = 10000000 // ₦10,000,000 max per request
  private readonly MAX_REQUESTS_PER_DAY = 3

  /**
   * Get the available balance for a business
   * Calculates from transactions instead of wallet
   */
  async getBalanceInfo(businessId: number): Promise<BalanceInfo> {
    const business = await Business.findOrFail(businessId)
    const businessCurrency = business.currency || 'NGN'

    // Get all currencies this business has transactions in
    const balancesByCurrency = await Transaction.getBusinessBalances(businessId)

    // Convert all balances to business base currency
    let totalEarnings = 0

    for (const { currency, balance } of balancesByCurrency) {
      if (currency === businessCurrency) {
        totalEarnings += balance
      } else {
        // Convert to business currency
        const converted = await currencyService.convertAmount(
          Math.round(balance * 100),
          currency,
          businessCurrency
        )
        totalEarnings += converted / 100
      }
    }

    // Sum of completed withdrawals (in business currency)
    const withdrawnResult = await WithdrawalRequest.query()
      .where('businessId', businessId)
      .where('status', 'completed')
      .sum('amount as total')
      .first()

    const totalWithdrawn = Number(withdrawnResult?.$extras.total || 0)

    // Pending withdrawals (in business currency)
    const pendingResult = await WithdrawalRequest.query()
      .where('businessId', businessId)
      .whereIn('status', ['pending', 'processing'])
      .sum('amount as total')
      .first()

    const pendingWithdrawals = Number(pendingResult?.$extras.total || 0)

    return {
      totalEarnings,
      totalWithdrawn,
      pendingWithdrawals,
      availableBalance: Math.max(0, totalEarnings - totalWithdrawn - pendingWithdrawals),
    }
  }

  /**
   * Get list of Nigerian banks from Paystack
   */
  async getNigerianBanks(): Promise<PaystackBank[]> {
    const secretKey = env.get('PAYSTACK_SECRET_KEY')
    if (!secretKey) {
      console.error('[WITHDRAWAL] PAYSTACK_SECRET_KEY not configured')
      return []
    }

    try {
      const response = await fetch('https://api.paystack.co/bank?country=nigeria', {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      })

      const data = (await response.json()) as { status: boolean; data: PaystackBank[] }

      if (data.status) {
        return data.data
      }
      return []
    } catch (error) {
      console.error('[WITHDRAWAL] Error fetching banks:', error)
      return []
    }
  }

  /**
   * Verify bank account with Paystack
   */
  async verifyBankAccount(
    accountNumber: string,
    bankCode: string
  ): Promise<{ valid: boolean; accountName?: string; error?: string }> {
    const secretKey = env.get('PAYSTACK_SECRET_KEY')
    if (!secretKey) {
      return { valid: false, error: 'Payment system not configured' }
    }

    try {
      const response = await fetch(
        `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        {
          headers: {
            Authorization: `Bearer ${secretKey}`,
          },
        }
      )

      const data = (await response.json()) as {
        status: boolean
        data?: { account_name: string }
        message?: string
      }

      if (data.status && data.data) {
        return { valid: true, accountName: data.data.account_name }
      }

      return { valid: false, error: data.message || 'Could not verify account' }
    } catch (error) {
      console.error('[WITHDRAWAL] Error verifying account:', error)
      return { valid: false, error: 'Failed to verify account' }
    }
  }

  /**
   * Create a Paystack transfer recipient
   */
  async createPaystackRecipient(bankAccount: BusinessBankAccount): Promise<string | null> {
    const secretKey = env.get('PAYSTACK_SECRET_KEY')
    if (!secretKey) {
      console.error('[WITHDRAWAL] PAYSTACK_SECRET_KEY not configured')
      return null
    }

    try {
      const response = await fetch('https://api.paystack.co/transferrecipient', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'nuban',
          name: bankAccount.accountName,
          account_number: bankAccount.accountNumber,
          bank_code: bankAccount.bankCode,
          currency: 'NGN',
        }),
      })

      const data = (await response.json()) as {
        status: boolean
        data?: { recipient_code: string }
        message?: string
      }

      if (data.status && data.data) {
        return data.data.recipient_code
      }

      console.error('[WITHDRAWAL] Failed to create recipient:', data.message)
      return null
    } catch (error) {
      console.error('[WITHDRAWAL] Error creating recipient:', error)
      return null
    }
  }

  /**
   * Request a withdrawal
   */
  async requestWithdrawal(
    businessId: number,
    amount: number,
    bankAccountId: number
  ): Promise<{ success: boolean; withdrawal?: WithdrawalRequest; error?: string }> {
    // Validate bank account belongs to business
    const bankAccount = await BusinessBankAccount.query()
      .where('id', bankAccountId)
      .where('businessId', businessId)
      .first()

    if (!bankAccount) {
      return { success: false, error: 'Invalid bank account' }
    }

    if (!bankAccount.isVerified) {
      return { success: false, error: 'Bank account not verified' }
    }

    // Validate amount
    if (amount < this.MIN_WITHDRAWAL) {
      return {
        success: false,
        error: `Minimum withdrawal amount is ₦${this.MIN_WITHDRAWAL.toLocaleString()}`,
      }
    }

    if (amount > this.MAX_WITHDRAWAL_PER_REQUEST) {
      return {
        success: false,
        error: `Maximum withdrawal per request is ₦${this.MAX_WITHDRAWAL_PER_REQUEST.toLocaleString()}`,
      }
    }

    // Get business currency
    const business = await Business.findOrFail(businessId)
    const businessCurrency = business.currency || 'NGN'

    // Check balance from transactions
    const balance = await Transaction.getBusinessBalance(businessId, businessCurrency)

    // Get pending withdrawals
    const pendingResult = await WithdrawalRequest.query()
      .where('businessId', businessId)
      .whereIn('status', ['pending', 'processing'])
      .sum('amount as total')
      .first()

    const pendingWithdrawals = Number(pendingResult?.$extras.total || 0)
    const availableBalance = balance - pendingWithdrawals

    if (availableBalance < amount) {
      return {
        success: false,
        error: `Insufficient balance. Available: ₦${availableBalance.toLocaleString()}`,
      }
    }

    // Check rate limit (max requests per day)
    const today = DateTime.now().startOf('day')
    const requestsToday = await WithdrawalRequest.query()
      .where('businessId', businessId)
      .where('createdAt', '>=', today.toSQL()!)
      .count('id as total')
      .first()

    if (Number(requestsToday?.$extras.total || 0) >= this.MAX_REQUESTS_PER_DAY) {
      return {
        success: false,
        error: `Maximum ${this.MAX_REQUESTS_PER_DAY} withdrawal requests per day`,
      }
    }

    // Create withdrawal request (no need to hold in wallet anymore)
    const withdrawal = await WithdrawalRequest.create({
      businessId,
      bankAccountId,
      amount,
      status: 'pending',
    })

    return { success: true, withdrawal }
  }

  /**
   * Cancel a pending withdrawal
   */
  async cancelWithdrawal(
    withdrawalId: number,
    businessId: number
  ): Promise<{ success: boolean; error?: string }> {
    const withdrawal = await WithdrawalRequest.query()
      .where('id', withdrawalId)
      .where('businessId', businessId)
      .first()

    if (!withdrawal) {
      return { success: false, error: 'Withdrawal not found' }
    }

    if (withdrawal.status !== 'pending') {
      return { success: false, error: 'Only pending withdrawals can be cancelled' }
    }

    withdrawal.status = 'cancelled'
    await withdrawal.save()

    return { success: true }
  }

  /**
   * Process a withdrawal (initiate Paystack transfer)
   * This is typically called by admin or automated process
   */
  async processWithdrawal(
    withdrawalId: number,
    processedBy?: number
  ): Promise<{ success: boolean; error?: string }> {
    const secretKey = env.get('PAYSTACK_SECRET_KEY')
    if (!secretKey) {
      return { success: false, error: 'Payment system not configured' }
    }

    const withdrawal = await WithdrawalRequest.query()
      .where('id', withdrawalId)
      .preload('bankAccount')
      .preload('business')
      .first()

    if (!withdrawal) {
      return { success: false, error: 'Withdrawal not found' }
    }

    if (withdrawal.status !== 'pending') {
      return { success: false, error: 'Withdrawal is not pending' }
    }

    if (!withdrawal.bankAccount) {
      return { success: false, error: 'No bank account associated with withdrawal' }
    }

    // Update status to processing
    withdrawal.status = 'processing'
    if (processedBy) {
      withdrawal.processedBy = processedBy
    }
    await withdrawal.save()

    try {
      // Ensure we have a recipient code
      let recipientCode = withdrawal.bankAccount.paystackRecipientCode
      if (!recipientCode) {
        recipientCode = await this.createPaystackRecipient(withdrawal.bankAccount)
        if (!recipientCode) {
          withdrawal.status = 'failed'
          withdrawal.failureReason = 'Failed to create payment recipient'
          await withdrawal.save()
          return { success: false, error: 'Failed to create payment recipient' }
        }
        withdrawal.bankAccount.paystackRecipientCode = recipientCode
        await withdrawal.bankAccount.save()
      }

      // Generate unique reference
      const reference = `WD-${withdrawal.id}-${Date.now()}`

      // Initiate transfer
      const response = await fetch('https://api.paystack.co/transfer', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'balance',
          amount: Math.round(withdrawal.amount * 100), // Convert to kobo
          recipient: recipientCode,
          reason: `Withdrawal for business #${withdrawal.businessId}`,
          reference,
        }),
      })

      const data = (await response.json()) as {
        status: boolean
        data?: { transfer_code: string; reference: string }
        message?: string
      }

      if (data.status && data.data) {
        withdrawal.paystackTransferCode = data.data.transfer_code
        withdrawal.paystackReference = data.data.reference
        // Note: We don't mark as completed yet - webhook will do that
        await withdrawal.save()

        return { success: true }
      } else {
        withdrawal.status = 'failed'
        withdrawal.failureReason = data.message || 'Transfer failed'
        await withdrawal.save()

        return { success: false, error: data.message || 'Transfer failed' }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'

      withdrawal.status = 'failed'
      withdrawal.failureReason = message
      await withdrawal.save()

      console.error('[WITHDRAWAL] Error processing withdrawal:', error)
      return { success: false, error: message }
    }
  }

  /**
   * Handle transfer success webhook
   */
  async handleTransferSuccess(reference: string): Promise<void> {
    const withdrawal = await WithdrawalRequest.query()
      .where('paystackReference', reference)
      .preload('business')
      .preload('bankAccount')
      .first()

    if (!withdrawal) {
      console.log(`[WITHDRAWAL] No withdrawal found for reference: ${reference}`)
      return
    }

    if (withdrawal.status === 'completed') {
      console.log(`[WITHDRAWAL] Withdrawal #${withdrawal.id} already completed`)
      return
    }

    withdrawal.status = 'completed'
    withdrawal.processedAt = DateTime.now()
    await withdrawal.save()

    // Create transaction record for the withdrawal
    await Transaction.create({
      businessId: withdrawal.businessId,
      withdrawalRequestId: withdrawal.id,
      amount: withdrawal.amount,
      platformFee: 0,
      businessAmount: withdrawal.amount,
      status: 'success',
      provider: 'paystack',
      type: 'withdrawal',
      direction: 'debit',
      currency: withdrawal.business.currency || 'NGN',
      reference: withdrawal.paystackReference || reference,
      providerReference: reference,
    })

    // Send success notification email
    await this.sendWithdrawalSuccessEmail(withdrawal)

    console.log(`[WITHDRAWAL] Withdrawal #${withdrawal.id} completed successfully`)
  }

  /**
   * Handle transfer failure webhook
   */
  async handleTransferFailed(reference: string, reason?: string): Promise<void> {
    const withdrawal = await WithdrawalRequest.query()
      .where('paystackReference', reference)
      .preload('business')
      .preload('bankAccount')
      .first()

    if (!withdrawal) {
      console.log(`[WITHDRAWAL] No withdrawal found for reference: ${reference}`)
      return
    }

    if (withdrawal.status === 'failed') {
      console.log(`[WITHDRAWAL] Withdrawal #${withdrawal.id} already marked as failed`)
      return
    }

    withdrawal.status = 'failed'
    withdrawal.failureReason = reason || 'Transfer failed'
    await withdrawal.save()

    // Send failure notification email
    await this.sendWithdrawalFailedEmail(withdrawal)

    console.log(`[WITHDRAWAL] Withdrawal #${withdrawal.id} failed: ${reason}`)
  }

  /**
   * Handle transfer reversal webhook
   */
  async handleTransferReversed(reference: string, reason?: string): Promise<void> {
    const withdrawal = await WithdrawalRequest.query()
      .where('paystackReference', reference)
      .preload('business')
      .first()

    if (!withdrawal) {
      console.log(`[WITHDRAWAL] No withdrawal found for reversal reference: ${reference}`)
      return
    }

    withdrawal.status = 'failed'
    withdrawal.failureReason = reason || 'Transfer was reversed'
    await withdrawal.save()

    console.log(`[WITHDRAWAL] Withdrawal #${withdrawal.id} reversed: ${reason}`)
  }

  /**
   * Send withdrawal success email
   */
  private async sendWithdrawalSuccessEmail(withdrawal: WithdrawalRequest): Promise<void> {
    try {
      await emailService.sendGenericEmail({
        to: withdrawal.business.email,
        subject: 'Withdrawal Successful',
        templateData: {
          title: 'Withdrawal Successful',
          preheader: `Your withdrawal of ₦${withdrawal.amount.toLocaleString()} has been processed`,
          content: `
            <p>Hi ${withdrawal.business.name},</p>
            <p>Great news! Your withdrawal request has been processed successfully.</p>
            <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 0;"><strong>Amount:</strong> ₦${withdrawal.amount.toLocaleString()}</p>
              <p style="margin: 8px 0 0 0;"><strong>Bank:</strong> ${withdrawal.bankAccount?.bankName || 'N/A'}</p>
              <p style="margin: 8px 0 0 0;"><strong>Account:</strong> ${withdrawal.bankAccount?.maskedAccountNumber || 'N/A'}</p>
              <p style="margin: 8px 0 0 0;"><strong>Reference:</strong> ${withdrawal.paystackReference || 'N/A'}</p>
            </div>
            <p>The funds should reflect in your bank account within 24 hours.</p>
            <p>Thank you for using FastAppoint!</p>
          `,
        },
      })
    } catch (error) {
      console.error('[WITHDRAWAL] Failed to send success email:', error)
    }
  }

  /**
   * Send withdrawal failed email
   */
  private async sendWithdrawalFailedEmail(withdrawal: WithdrawalRequest): Promise<void> {
    try {
      await emailService.sendGenericEmail({
        to: withdrawal.business.email,
        subject: 'Withdrawal Failed',
        templateData: {
          title: 'Withdrawal Failed',
          preheader: `Your withdrawal of ₦${withdrawal.amount.toLocaleString()} could not be processed`,
          content: `
            <p>Hi ${withdrawal.business.name},</p>
            <p>Unfortunately, your withdrawal request could not be processed.</p>
            <div style="background-color: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 0;"><strong>Amount:</strong> ₦${withdrawal.amount.toLocaleString()}</p>
              <p style="margin: 8px 0 0 0;"><strong>Reason:</strong> ${withdrawal.failureReason || 'Unknown error'}</p>
            </div>
            <p>Your balance has been restored. Please check your bank account details and try again.</p>
            <p>If you continue to experience issues, please contact our support team.</p>
          `,
        },
      })
    } catch (error) {
      console.error('[WITHDRAWAL] Failed to send failure email:', error)
    }
  }

  /**
   * Get withdrawal history for a business
   */
  async getWithdrawalHistory(
    businessId: number,
    limit = 20,
    offset = 0
  ): Promise<WithdrawalRequest[]> {
    return await WithdrawalRequest.query()
      .where('businessId', businessId)
      .preload('bankAccount')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .offset(offset)
  }
}

export default new WithdrawalService()

