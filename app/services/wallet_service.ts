import Wallet from '#models/wallet'
import WalletTransaction from '#models/wallet_transaction'

interface CreditOptions {
  transactionId?: number
  reference?: string
  description?: string
  metadata?: Record<string, unknown>
}

interface DebitOptions {
  withdrawalRequestId?: number
  reference?: string
  description?: string
  metadata?: Record<string, unknown>
}

interface HoldOptions {
  withdrawalRequestId?: number
  reference?: string
  description?: string
  metadata?: Record<string, unknown>
}

class WalletService {
  /**
   * Credit wallet with amount (add to balance)
   */
  async credit(
    businessId: number,
    currency: string,
    amount: number,
    options: CreditOptions = {}
  ): Promise<{ success: boolean; wallet?: Wallet; error?: string }> {
    try {
      return await Wallet.transaction(async (trx) => {
        const wallet = await Wallet.getOrCreate(businessId, currency)
        await wallet.useTransaction(trx).refresh()

        const balanceBefore = wallet.balance
        const balanceAfter = balanceBefore + amount
        const availableBalanceAfter = wallet.availableBalance + amount

        wallet.balance = balanceAfter
        wallet.availableBalance = availableBalanceAfter
        await wallet.useTransaction(trx).save()

        const walletTransaction = new WalletTransaction()
        walletTransaction.useTransaction(trx)
        walletTransaction.walletId = wallet.id
        walletTransaction.businessId = businessId
        walletTransaction.transactionId = options.transactionId || null
        walletTransaction.type = 'credit'
        walletTransaction.amount = amount
        walletTransaction.balanceBefore = balanceBefore
        walletTransaction.balanceAfter = balanceAfter
        walletTransaction.currency = currency.toUpperCase()
        walletTransaction.reference = options.reference || null
        walletTransaction.description = options.description || null
        walletTransaction.metadata = options.metadata || null
        await walletTransaction.save()

        return { success: true, wallet }
      })
    } catch (error) {
      console.error('[WALLET] Error crediting wallet:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to credit wallet',
      }
    }
  }

  /**
   * Debit wallet (subtract from balance and available balance)
   */
  async debit(
    businessId: number,
    currency: string,
    amount: number,
    options: DebitOptions = {}
  ): Promise<{ success: boolean; wallet?: Wallet; error?: string }> {
    try {
      return await Wallet.transaction(async (trx) => {
        const wallet = await Wallet.query({ client: trx })
          .where('businessId', businessId)
          .where('currency', currency.toUpperCase())
          .first()

        if (!wallet) {
          return { success: false, error: 'Wallet not found' }
        }

        if (wallet.availableBalance < amount) {
          return {
            success: false,
            error: `Insufficient balance. Available: ${wallet.availableBalance}, Required: ${amount}`,
          }
        }

        const balanceBefore = wallet.balance
        const balanceAfter = balanceBefore - amount
        const availableBalanceAfter = wallet.availableBalance - amount

        wallet.balance = balanceAfter
        wallet.availableBalance = availableBalanceAfter
        await wallet.useTransaction(trx).save()

        const walletTransaction = new WalletTransaction()
        walletTransaction.useTransaction(trx)
        walletTransaction.walletId = wallet.id
        walletTransaction.businessId = businessId
        walletTransaction.withdrawalRequestId = options.withdrawalRequestId || null
        walletTransaction.type = 'debit'
        walletTransaction.amount = amount
        walletTransaction.balanceBefore = balanceBefore
        walletTransaction.balanceAfter = balanceAfter
        walletTransaction.currency = currency.toUpperCase()
        walletTransaction.reference = options.reference || null
        walletTransaction.description = options.description || null
        walletTransaction.metadata = options.metadata || null
        await walletTransaction.save()

        return { success: true, wallet }
      })
    } catch (error) {
      console.error('[WALLET] Error debiting wallet:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to debit wallet',
      }
    }
  }

  /**
   * Hold amount in wallet (move from available to held)
   */
  async hold(
    businessId: number,
    currency: string,
    amount: number,
    options: HoldOptions = {}
  ): Promise<{ success: boolean; wallet?: Wallet; error?: string }> {
    try {
      return await Wallet.transaction(async (trx) => {
        const wallet = await Wallet.query({ client: trx })
          .where('businessId', businessId)
          .where('currency', currency.toUpperCase())
          .first()

        if (!wallet) {
          return { success: false, error: 'Wallet not found' }
        }

        if (wallet.availableBalance < amount) {
          return {
            success: false,
            error: `Insufficient available balance. Available: ${wallet.availableBalance}, Required: ${amount}`,
          }
        }

        const balanceBefore = wallet.balance
        const availableBalanceAfter = wallet.availableBalance - amount
        const heldBalanceAfter = wallet.heldBalance + amount

        wallet.availableBalance = availableBalanceAfter
        wallet.heldBalance = heldBalanceAfter
        await wallet.useTransaction(trx).save()

        const walletTransaction = new WalletTransaction()
        walletTransaction.useTransaction(trx)
        walletTransaction.walletId = wallet.id
        walletTransaction.businessId = businessId
        walletTransaction.withdrawalRequestId = options.withdrawalRequestId || null
        walletTransaction.type = 'hold'
        walletTransaction.amount = amount
        walletTransaction.balanceBefore = balanceBefore
        walletTransaction.balanceAfter = balanceBefore
        walletTransaction.currency = currency.toUpperCase()
        walletTransaction.reference = options.reference || null
        walletTransaction.description = options.description || null
        walletTransaction.metadata = options.metadata || null
        await walletTransaction.save()

        return { success: true, wallet }
      })
    } catch (error) {
      console.error('[WALLET] Error holding wallet amount:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to hold wallet amount',
      }
    }
  }

  /**
   * Release held amount back to available balance
   */
  async release(
    businessId: number,
    currency: string,
    amount: number,
    options: { withdrawalRequestId?: number; reference?: string; description?: string } = {}
  ): Promise<{ success: boolean; wallet?: Wallet; error?: string }> {
    try {
      return await Wallet.transaction(async (trx) => {
        const wallet = await Wallet.query({ client: trx })
          .where('businessId', businessId)
          .where('currency', currency.toUpperCase())
          .first()

        if (!wallet) {
          return { success: false, error: 'Wallet not found' }
        }

        if (wallet.heldBalance < amount) {
          return {
            success: false,
            error: `Insufficient held balance. Held: ${wallet.heldBalance}, Required: ${amount}`,
          }
        }

        const balanceBefore = wallet.balance
        const availableBalanceAfter = wallet.availableBalance + amount
        const heldBalanceAfter = wallet.heldBalance - amount

        wallet.availableBalance = availableBalanceAfter
        wallet.heldBalance = heldBalanceAfter
        await wallet.useTransaction(trx).save()

        const walletTransaction = new WalletTransaction()
        walletTransaction.useTransaction(trx)
        walletTransaction.walletId = wallet.id
        walletTransaction.businessId = businessId
        walletTransaction.withdrawalRequestId = options.withdrawalRequestId || null
        walletTransaction.type = 'release'
        walletTransaction.amount = amount
        walletTransaction.balanceBefore = balanceBefore
        walletTransaction.balanceAfter = balanceBefore
        walletTransaction.currency = currency.toUpperCase()
        walletTransaction.reference = options.reference || null
        walletTransaction.description = options.description || null
        await walletTransaction.save()

        return { success: true, wallet }
      })
    } catch (error) {
      console.error('[WALLET] Error releasing wallet amount:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to release wallet amount',
      }
    }
  }

  /**
   * Get wallet balance for a business and currency
   */
  async getBalance(businessId: number, currency: string): Promise<Wallet | null> {
    return await Wallet.query()
      .where('businessId', businessId)
      .where('currency', currency.toUpperCase())
      .first()
  }

  /**
   * Get all wallets for a business
   */
  async getBusinessWallets(businessId: number): Promise<Wallet[]> {
    return await Wallet.query().where('businessId', businessId).exec()
  }
}

export default new WalletService()

