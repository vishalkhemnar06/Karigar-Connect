# Razorpay Payment Gateway Integration Guide

## Overview
Complete end-to-end Razorpay payment integration for secure worker payments in KarigarConnect.

### Key Features
✅ **Secure Payment Processing** - PCI-DSS compliant via Razorpay  
✅ **Multiple Payment Methods** - Card, UPI, Net Banking, Wallet  
✅ **Signature Verification** - HMAC-SHA256 signature validation  
✅ **Payment History** - Complete transaction tracking  
✅ **Refund Support** - Easy refund processing  
✅ **Worker Payout Details** - Secure payout information storage  
✅ **Privacy Gated Access** - Payout details visible only after payment  

---

## Architecture

### Backend Components

#### 1. **PaymentTransaction Model** (`server/models/paymentTransactionModel.js`)
Stores all payment records with:
- Razorpay order/payment IDs
- Payment status tracking
- Worker payout details (encrypted)
- Payment history metadata

**Key Fields:**
```javascript
{
  razorpayOrderId: String,      // Unique order reference
  razorpayPaymentId: String,    // After successful payment
  razorpaySignature: String,    // Signature for verification
  amount: Number,               // Payment amount in INR
  status: ['created', 'authorized', 'captured', 'failed', 'refunded']
  workerPayoutDetails: Object   // Payout info after verified payment
}
```

#### 2. **Razorpay Controller** (`server/controllers/razorpayController.js`)
Core payment processing logic:

**Endpoints:**
- `POST /api/client/payment/razorpay/create-order` - Initialize payment
- `POST /api/client/payment/razorpay/verify` - Verify signature & complete payment
- `GET /api/client/payment/razorpay/transactions` - Payment history
- `GET /api/client/payment/razorpay/transactions/:transactionId` - Transaction details
- `POST /api/client/payment/razorpay/refund/:transactionId` - Process refund

#### 3. **Payment Routes** (`server/routes/paymentRoutes.js`)
Express routes with client authentication middleware.

### Frontend Components

#### 1. **Razorpay Helper** (`client/src/utils/razorpayHelper.js`)
Utility functions:
- `loadRazorpayScript()` - Dynamic script loading
- `initiateRazorpayPayment()` - Payment flow orchestration
- `fetchPaymentHistory()` - Retrieve payment history
- `getTransactionDetails()` - Get transaction info
- `requestRefund()` - Submit refund request

#### 2. **Razorpay Script** 
Loaded in `client/index.html`:
```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

---

## Setup Instructions

### 1. Install Dependencies

**Server:**
```bash
cd server
npm install razorpay@2.8.0
```

### 2. Configure Environment Variables

Add to `server/.env`:
```env
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=whsec_xxxxx (optional)
NODE_ENV=production
```

**Get keys from:** https://dashboard.razorpay.com/app/keys

### 3. Database Migration

The PaymentTransaction model is automatically created on app start via Mongoose.

To seed existing payment history:
```javascript
// Script to migrate legacy payments to PaymentTransaction
const Job = require('./models/jobModel');
const PaymentTransaction = require('./models/paymentTransactionModel');

const jobs = await Job.find({ 'directHire.paymentStatus': 'paid' });
for (const job of jobs) {
  await PaymentTransaction.create({
    jobId: job._id,
    clientId: job.clientId,
    workerId: job.workerId,
    amount: job.directHire.paymentAmount,
    status: 'captured',
    notes: { jobTitle: job.title }
  });
}
```

---

## Payment Flow

### User Journey
```
┌─────────────────────────────────────────────────────────┐
│ 1. Client clicks "Pay Worker"                           │
├─────────────────────────────────────────────────────────┤
│ 2. PayWorkerModal shows payment sources & amount        │
├─────────────────────────────────────────────────────────┤
│ 3. Client confirms payment (Confirm & Pay button)       │
├─────────────────────────────────────────────────────────┤
│ 4. Frontend calls createRazorpayOrder endpoint          │
├─────────────────────────────────────────────────────────┤
│ 5. Backend creates Razorpay order, saves PaymentTransaction │
├─────────────────────────────────────────────────────────┤
│ 6. Razorpay checkout modal opens                        │
├─────────────────────────────────────────────────────────┤
│ 7. Client completes payment (selects payment method)    │
├─────────────────────────────────────────────────────────┤
│ 8. Razorpay calls success handler with payment details  │
├─────────────────────────────────────────────────────────┤
│ 9. Frontend calls verifyRazorpayPayment endpoint        │
├─────────────────────────────────────────────────────────┤
│ 10. Backend verifies HMAC signature                      │
├─────────────────────────────────────────────────────────┤
│ 11. Backend fetches payment status from Razorpay        │
├─────────────────────────────────────────────────────────┤
│ 12. Backend updates Job.directHire.paymentStatus        │
├─────────────────────────────────────────────────────────┤
│ 13. Backend saves PaymentTransaction.status = 'captured' │
├─────────────────────────────────────────────────────────┤
│ 14. Backend fetches worker payout details               │
├─────────────────────────────────────────────────────────┤
│ 15. Backend stores payout in PaymentTransaction         │
├─────────────────────────────────────────────────────────┤
│ 16. Success response sent to client                     │
├─────────────────────────────────────────────────────────┤
│ 17. Payment receipt shown to client                     │
│ 18. Client profile shows updated payout details        │
└─────────────────────────────────────────────────────────┘
```

### Backend Payment Processing
```
createRazorpayOrder
  ├─ Validate job exists & client owns it
  ├─ Verify worker exists
  ├─ Create Razorpay order via API
  ├─ Save PaymentTransaction (status: 'created')
  └─ Return orderId + keyId to frontend

verifyRazorpayPayment
  ├─ Fetch PaymentTransaction from DB
  ├─ Verify HMAC signature using RAZORPAY_KEY_SECRET
  ├─ If signature mismatch: mark as 'failed' & reject
  ├─ Fetch payment from Razorpay API to confirm capture
  ├─ Update PaymentTransaction (status: 'captured')
  ├─ Fetch worker payout details
  ├─ Store payout in PaymentTransaction
  ├─ Update Job.directHire.paymentStatus = 'paid'
  ├─ Update Job.pricingMeta.finalPaidPrice
  ├─ Update Job.workerSlots.finalPaidPrice
  └─ Return transactionId to client
```

---

## Security Considerations

### 1. **Signature Verification**
All payments verified using HMAC-SHA256:
```javascript
const shasum = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET);
shasum.update(`${orderId}|${paymentId}`);
const digest = shasum.digest('hex');
if (digest !== signature) throw 'FRAUD: Signature mismatch';
```

### 2. **Private Fields**
Worker payout details marked as `select: false` in model:
```javascript
payoutUpiId: { type: String, select: false }
payoutBankAccountNumber: { type: String, select: false }
```

### 3. **Privacy Gating**
Payout details only visible after verified payment:
```javascript
// In verifyRazorpayPayment
const worker = await User.findById(workerId).select(
  '+payoutUpiId +payoutBankAccountNumber ...'
);
transaction.workerPayoutDetails = worker.payout*;
```

### 4. **Client Authorization**
All endpoints verify client owns the transaction:
```javascript
if (transaction.clientId.toString() !== clientId) {
  return res.status(403).json({ message: 'Unauthorized' });
}
```

### 5. **Amount Validation**
Validate amounts on both client & server:
```javascript
if (amount < 1 || amount > 1000000) {
  throw 'Invalid amount';
}
```

---

## API Reference

### Create Razorpay Order
```http
POST /api/client/payment/razorpay/create-order
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "jobId": "66f1a2b3c4d5e6f7g8h9i0j1",
  "workerId": "66f1a2b3c4d5e6f7g8h9i0j2",
  "slotId": "66f1a2b3c4d5e6f7g8h9i0j3",
  "amount": 5000,
  "skill": "Plumbing",
  "priceSource": "skillCost"
}

Response:
{
  "success": true,
  "razorpayOrderId": "order_xxxxx",
  "amount": 5000,
  "currency": "INR",
  "keyId": "rzp_live_xxxxx"
}
```

### Verify Razorpay Payment
```http
POST /api/client/payment/razorpay/verify
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "razorpayPaymentId": "pay_xxxxx",
  "razorpayOrderId": "order_xxxxx",
  "razorpaySignature": "hexstring"
}

Response:
{
  "success": true,
  "message": "Payment verified successfully",
  "transactionId": "66f1a2b3c4d5e6f7g8h9i0j4",
  "paymentId": "pay_xxxxx"
}
```

### Get Payment History
```http
GET /api/client/payment/razorpay/transactions?limit=10&skip=0
Authorization: Bearer <jwt_token>

Response:
{
  "success": true,
  "transactions": [
    {
      "_id": "66f1a2b3c4d5e6f7g8h9i0j4",
      "amount": 5000,
      "status": "captured",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": { "total": 42, "limit": 10, "skip": 0 }
}
```

### Get Transaction Details
```http
GET /api/client/payment/razorpay/transactions/:transactionId
Authorization: Bearer <jwt_token>

Response:
{
  "success": true,
  "transaction": {
    "_id": "66f1a2b3c4d5e6f7g8h9i0j4",
    "jobId": "66f1a2b3c4d5e6f7g8h9i0j1",
    "workerId": "66f1a2b3c4d5e6f7g8h9i0j2",
    "amount": 5000,
    "status": "captured",
    "razorpayPaymentId": "pay_xxxxx",
    "workerPayoutDetails": { ... }
  }
}
```

### Refund Payment
```http
POST /api/client/payment/razorpay/refund/:transactionId
Authorization: Bearer <jwt_token>

Response:
{
  "success": true,
  "message": "Refund processed successfully",
  "refundId": "refund_xxxxx",
  "amount": 5000
}
```

---

## Testing

### Razorpay Test Cards
Use these in test mode:

| Card Type | Number | Expiry | CVV |
|-----------|--------|--------|-----|
| Visa | 4111 1111 1111 1111 | Any Future | Any 3-digit |
| MasterCard | 5555 5555 5555 4444 | Any Future | Any 3-digit |
| American Express | 3782 822463 10005 | Any Future | Any 4-digit |

### Test UPI
- Any UPI ID ending with @okhdfcbank (will succeed)
- Any UPI ID ending with @okaxis (will fail)

### Testing Payment Flow
```javascript
// 1. Switch to test mode
process.env.RAZORPAY_KEY_ID = 'rzp_test_xxxxx';

// 2. Use test credentials
// 3. Trigger payment via UI
// 4. Verify PaymentTransaction created with status 'created'
// 5. Use test card to complete payment
// 6. Verify status updated to 'captured'
// 7. Verify payout details stored
```

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| SIGNATURE_MISMATCH | Payment tampered | Log fraud alert, mark transaction failed |
| PAYMENT_NOT_CAPTURED | Payment authorized but not captured | Check Razorpay dashboard, manual capture if needed |
| ORDER_NOT_FOUND | Invalid Razorpay order | Verify orderId matches database record |
| AMOUNT_MISMATCH | Amount changed mid-transaction | Reject, create new order |
| WORKER_NOT_FOUND | Worker deleted/not found | Show error, handle gracefully |

### Error Response Format
```javascript
{
  "success": false,
  "message": "User-friendly error message",
  "error": "Detailed error for debugging (dev mode only)",
  "code": "ERROR_CODE"
}
```

---

## Monitoring & Logging

### Log Payment Events
```javascript
// Log all payment transactions
logger.info('Payment created', { orderId, jobId, amount });
logger.info('Payment verified', { paymentId, transactionId });
logger.warn('Payment failed', { error, orderId });
```

### Alerts
- Monitor failed payment signature verifications (potential fraud)
- Alert on refunds > threshold
- Track payment method distribution

### Database Indexes
PaymentTransaction includes indexes for:
- `razorpayOrderId` (unique, for lookups)
- `razorpayPaymentId` (indexed, for searching)
- `clientId + createdAt` (for payment history)
- `jobId + status` (for job payment status)

---

## Troubleshooting

### Payment Modal Not Opening
- ✓ Check Razorpay script loaded: `window.Razorpay` should exist
- ✓ Verify RAZORPAY_KEY_ID in frontend response
- ✓ Check browser console for errors

### "Signature verification failed"
- ✓ Verify RAZORPAY_KEY_SECRET is correct
- ✓ Check webhook secret if using webhooks
- ✓ Ensure signature sent correctly from checkout

### Worker Payout Details Not Visible
- ✓ Verify payment status is 'captured'
- ✓ Check Job.directHire.paymentStatus = 'paid'
- ✓ Verify worker has payout details set in profile

### Transaction Not Saving
- ✓ Verify MongoDB connection active
- ✓ Check PaymentTransaction model imported correctly
- ✓ Check disk space for new records

---

## Future Enhancements

- [ ] Webhook support for payment notifications
- [ ] Scheduled payouts to workers
- [ ] Split payments (commission tracking)
- [ ] Subscription/recurring payments
- [ ] Invoice generation
- [ ] Payment analytics dashboard
- [ ] Dispute resolution system
- [ ] Multi-currency support

---

## Support

For Razorpay-specific issues:
- Dashboard: https://dashboard.razorpay.com
- Docs: https://razorpay.com/docs/
- Support: support@razorpay.com

For KarigarConnect issues:
- Check logs in `server/` directory
- Enable DEBUG mode in .env
- Contact development team
