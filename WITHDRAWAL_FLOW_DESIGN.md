# Business Withdrawal Flow Design

## Overview
Businesses need to withdraw their earnings (`businessAmount` from transactions) to their bank accounts. This document outlines a straightforward withdrawal request flow.

---

## Core Concept

### Current State:
- Transactions track `businessAmount` (amount - platform fee)
- No withdrawal system exists
- Businesses can't access their earnings

### Solution:
1. **Track Available Balance** - Calculate available balance from successful transactions
2. **Withdrawal Requests** - Businesses request withdrawals
3. **Bank Account Management** - Store business bank account details
4. **Processing** - Admin/automated processing via Paystack Transfers API
5. **Tracking** - Record all withdrawal requests and their status

---

## Database Schema

### 1. Business Bank Accounts Table
```sql
CREATE TABLE business_bank_accounts (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  account_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(20) NOT NULL,
  bank_code VARCHAR(10) NOT NULL, -- Paystack bank code
  bank_name VARCHAR(255) NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP
);
```

### 2. Withdrawal Requests Table
```sql
CREATE TABLE withdrawal_requests (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  bank_account_id INTEGER REFERENCES business_bank_accounts(id),
  amount DECIMAL(12, 2) NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
  paystack_transfer_code VARCHAR(255) NULL, -- Paystack transfer reference
  failure_reason TEXT NULL,
  processed_at TIMESTAMP NULL,
  processed_by INTEGER NULL, -- Admin user ID
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP
);
```

### 3. Add to Business Model (optional - for caching)
```sql
ALTER TABLE businesses ADD COLUMN available_balance DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE businesses ADD COLUMN pending_withdrawal DECIMAL(12, 2) DEFAULT 0;
```

---

## Business Flow

### Step 1: Add Bank Account
**Route:** `GET/POST /settings/payments/bank-account`

**Flow:**
1. Business owner navigates to Settings → Payments
2. Enters bank account details:
   - Account Name
   - Account Number
   - Bank Name (dropdown with Paystack supported banks)
3. System validates account with Paystack (optional verification)
4. Save bank account (can have multiple, one primary)

### Step 2: View Balance & Request Withdrawal
**Route:** `GET /settings/payments/withdrawals`
**Route:** `POST /settings/payments/withdrawals/request`

**Flow:**
1. Business views:
   - **Available Balance** = Sum of `businessAmount` from successful transactions
   - **Pending Withdrawals** = Sum of pending withdrawal requests
   - **Withdrawal History** = List of past withdrawals
2. Business enters withdrawal amount
3. System validates:
   - Amount > minimum withdrawal (e.g., ₦1,000)
   - Amount <= available balance
   - Has verified bank account
4. Create withdrawal request with status `pending`
5. Show confirmation message

### Step 3: Processing (Admin/Automated)
**Route:** `POST /admin/withdrawals/:id/process` (Admin only)

**Flow:**
1. Admin reviews pending withdrawal requests
2. Admin approves → Status changes to `processing`
3. System initiates Paystack Transfer:
   ```typescript
   POST https://api.paystack.co/transfer
   {
     source: "balance", // or "nuban" for subaccount
     amount: amount * 100, // in kobo
     recipient: bank_account_code, // Paystack recipient code
     reason: "Business earnings withdrawal"
   }
   ```
4. On success:
   - Update status to `completed`
   - Store `paystack_transfer_code`
   - Update business balance
5. On failure:
   - Update status to `failed`
   - Store `failure_reason`
   - Notify business

### Step 4: Webhook Handling
**Route:** `POST /webhooks/paystack` (existing webhook)

**Events to handle:**
- `transfer.success` - Mark withdrawal as completed
- `transfer.failed` - Mark withdrawal as failed, refund balance

---

## User Interface Flow

### Business Dashboard → Settings → Payments

```
┌─────────────────────────────────────┐
│  Payments & Withdrawals            │
├─────────────────────────────────────┤
│                                     │
│  Available Balance                  │
│  ₦45,000.00                         │
│                                     │
│  Pending Withdrawals                │
│  ₦10,000.00                         │
│                                     │
│  ───────────────────────────────   │
│                                     │
│  Request Withdrawal                 │
│  ┌─────────────────────────────┐   │
│  │ Amount: [₦______]            │   │
│  │ Bank: [Select Account ▼]     │   │
│  │                              │   │
│  │ [Request Withdrawal]          │   │
│  └─────────────────────────────┘   │
│                                     │
│  Bank Accounts                      │
│  ┌─────────────────────────────┐   │
│  │ ✓ GTBank - 0123456789       │   │
│  │   John Doe (Primary)        │   │
│  │   [Edit] [Delete]           │   │
│  └─────────────────────────────┘   │
│  [+ Add Bank Account]               │
│                                     │
│  Withdrawal History                  │
│  ┌─────────────────────────────┐   │
│  │ Date       Amount    Status  │   │
│  │ 2024-01-15 ₦20,000  ✓ Done  │   │
│  │ 2024-01-10 ₦15,000  ✓ Done  │   │
│  │ 2024-01-05 ₦10,000  ⏳ Pending│ │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## Implementation Details

### 1. Calculate Available Balance
```typescript
async getAvailableBalance(businessId: number): Promise<number> {
  // Sum of businessAmount from successful transactions
  const totalEarnings = await Transaction.query()
    .where('businessId', businessId)
    .where('status', 'success')
    .sum('businessAmount as total')
  
  // Sum of completed withdrawals
  const totalWithdrawn = await WithdrawalRequest.query()
    .where('businessId', businessId)
    .whereIn('status', ['completed', 'processing'])
    .sum('amount as total')
  
  return (totalEarnings[0].$extras.total || 0) - (totalWithdrawn[0].$extras.total || 0)
}
```

### 2. Create Withdrawal Request
```typescript
async requestWithdrawal(businessId: number, amount: number, bankAccountId: number) {
  // Validate
  const availableBalance = await this.getAvailableBalance(businessId)
  if (amount > availableBalance) {
    throw new Error('Insufficient balance')
  }
  
  if (amount < 1000) { // Minimum ₦1,000
    throw new Error('Minimum withdrawal is ₦1,000')
  }
  
  // Create request
  const withdrawal = await WithdrawalRequest.create({
    businessId,
    bankAccountId,
    amount,
    status: 'pending'
  })
  
  // Send notification to admin (optional)
  await this.notifyAdmin(withdrawal)
  
  return withdrawal
}
```

### 3. Process Withdrawal (Admin)
```typescript
async processWithdrawal(withdrawalId: number, adminUserId: number) {
  const withdrawal = await WithdrawalRequest.findOrFail(withdrawalId)
  const bankAccount = await BusinessBankAccount.findOrFail(withdrawal.bankAccountId)
  
  // Update status
  withdrawal.status = 'processing'
  withdrawal.processedBy = adminUserId
  await withdrawal.save()
  
  try {
    // Create Paystack recipient if not exists
    let recipientCode = bankAccount.paystackRecipientCode
    if (!recipientCode) {
      recipientCode = await this.createPaystackRecipient(bankAccount)
      bankAccount.paystackRecipientCode = recipientCode
      await bankAccount.save()
    }
    
    // Initiate transfer
    const response = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: 'balance',
        amount: withdrawal.amount * 100, // Convert to kobo
        recipient: recipientCode,
        reason: `Withdrawal for business #${withdrawal.businessId}`
      })
    })
    
    const data = await response.json()
    
    if (data.status) {
      withdrawal.status = 'completed'
      withdrawal.paystackTransferCode = data.data.transfer_code
      withdrawal.processedAt = DateTime.now()
      await withdrawal.save()
      
      // Notify business
      await this.notifyBusinessWithdrawalSuccess(withdrawal)
    } else {
      throw new Error(data.message)
    }
  } catch (error) {
    withdrawal.status = 'failed'
    withdrawal.failureReason = error.message
    await withdrawal.save()
    
    // Notify business
    await this.notifyBusinessWithdrawalFailed(withdrawal)
    
    throw error
  }
}
```

### 4. Paystack Recipient Creation
```typescript
async createPaystackRecipient(bankAccount: BusinessBankAccount): Promise<string> {
  const response = await fetch('https://api.paystack.co/transferrecipient', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'nuban',
      name: bankAccount.accountName,
      account_number: bankAccount.accountNumber,
      bank_code: bankAccount.bankCode,
      currency: 'NGN'
    })
  })
  
  const data = await response.json()
  return data.data.recipient_code
}
```

---

## Alternative: Automated Processing

Instead of admin approval, you can automate:

1. **Auto-approve small amounts** (< ₦50,000)
2. **Require admin approval** for large amounts (≥ ₦50,000)
3. **Scheduled processing** - Process all pending withdrawals daily at 2 PM
4. **Minimum balance check** - Ensure platform has enough balance before processing

---

## Security Considerations

1. **Bank Account Verification**
   - Verify account name matches business name
   - Use Paystack account verification API
   - Require verification before allowing withdrawals

2. **Withdrawal Limits**
   - Minimum withdrawal: ₦1,000
   - Maximum per request: ₦10,000,000 (or configurable)
   - Daily limit: ₦50,000,000 (or configurable)

3. **Rate Limiting**
   - Max 3 withdrawal requests per day
   - Prevent duplicate requests

4. **Audit Trail**
   - Log all withdrawal actions
   - Track who processed each withdrawal
   - Store IP addresses

---

## Routes Structure

```typescript
// Business routes (authenticated)
router.get('/settings/payments', [PaymentsController, 'index'])
router.get('/settings/payments/bank-account', [PaymentsController, 'bankAccount'])
router.post('/settings/payments/bank-account', [PaymentsController, 'storeBankAccount'])
router.get('/settings/payments/withdrawals', [PaymentsController, 'withdrawals'])
router.post('/settings/payments/withdrawals/request', [PaymentsController, 'requestWithdrawal'])

// Admin routes (admin only)
router.get('/admin/withdrawals', [AdminWithdrawalsController, 'index'])
router.post('/admin/withdrawals/:id/approve', [AdminWithdrawalsController, 'approve'])
router.post('/admin/withdrawals/:id/process', [AdminWithdrawalsController, 'process'])
router.post('/admin/withdrawals/:id/reject', [AdminWithdrawalsController, 'reject'])
```

---

## Benefits of This Approach

✅ **Simple & Straightforward** - Clear flow, easy to understand
✅ **Flexible** - Can be manual (admin) or automated
✅ **Secure** - Bank account verification, limits, audit trail
✅ **Scalable** - Works for small and large businesses
✅ **Transparent** - Businesses see all their transactions and withdrawals

---

## Next Steps

1. Create database migrations for new tables
2. Create models (BusinessBankAccount, WithdrawalRequest)
3. Build UI for bank account management
4. Build UI for withdrawal requests
5. Implement withdrawal processing logic
6. Add admin dashboard for managing withdrawals
7. Integrate Paystack Transfers API
8. Add webhook handlers for transfer events
9. Add email notifications
10. Test end-to-end flow

---

## Questions to Consider

1. **Processing Time**: How long should withdrawals take? (Same day? Next day?)
2. **Fees**: Will you charge a withdrawal fee? (Paystack charges ₦10 per transfer)
3. **Minimum Balance**: Should platform maintain a minimum balance before processing?
4. **Automation**: Fully automated or require admin approval?
5. **Multiple Accounts**: Allow businesses to have multiple bank accounts?

