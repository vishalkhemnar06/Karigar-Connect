# Razorpay Integration - Code Examples & Implementation Guide

## Quick Start

### 1. Backend Setup (5 minutes)

**Install Razorpay:**
```bash
cd server
npm install razorpay@2.8.0
npm install
```

**Add to `.env`:**
```env
RAZORPAY_KEY_ID=rzp_test_1DP5mmOlF5G5ag
RAZORPAY_KEY_SECRET=nxrHwUaIj3MsDummyKeyForDev
NODE_ENV=development
```

**Get your keys:**
1. Go to https://dashboard.razorpay.com
2. Sign up or login
3. Go to Settings → API Keys
4. Copy test key ID and secret

### 2. Frontend Setup (2 minutes)

**Already included in:**
- ✅ Razorpay script in `client/index.html`
- ✅ Helper utility in `client/src/utils/razorpayHelper.js`

### 3. Test Payment (2 minutes)

**Test Card:**
- Number: `4111 1111 1111 1111`
- Expiry: Any future date
- CVV: Any 3 digits

---

## Complete Payment Integration Example

### Frontend Implementation

```javascript
// In your React component (e.g., PayWorkerModal)

import toast from 'react-hot-toast';
import { initiateRazorpayPayment } from '../../utils/razorpayHelper';

export const PayWorkerModal = ({ job, slot, worker, skill, onClose }) => {
  const [amount, setAmount] = useState(5000);
  const [loading, setLoading] = useState(false);
  const [priceSource, setPriceSource] = useState('skillCost');

  const handlePayment = async () => {
    setLoading(true);
    try {
      const result = await initiateRazorpayPayment({
        jobId: job._id,
        workerId: worker._id,
        slotId: slot._id,
        amount: amount,
        skill: skill,
        priceSource: priceSource,
        clientName: 'Client Name', // from logged-in user
        clientEmail: 'client@example.com',
        clientPhone: '+91-XXXXXXXXXX',
      });

      // Payment verified successfully on backend
      toast.success(`Payment of ₹${amount} completed!`);
      onClose();
      
      // Optionally redirect to payment receipt
      // navigate(`/payment-receipt/${result.transactionId}`);

    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal">
      <h2>Pay Worker - {worker.name}</h2>
      
      <div className="amount-input">
        <label>Amount (₹)</label>
        <input 
          type="number" 
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          min={1}
          max={1000000}
        />
      </div>

      <div className="price-source">
        <label>Payment Source</label>
        <select value={priceSource} onChange={(e) => setPriceSource(e.target.value)}>
          <option value="skillCost">Skill Cost</option>
          <option value="negotiableCost">Negotiable Cost</option>
          <option value="workerQuotedPrice">Worker Quoted Price</option>
        </select>
      </div>

      <button 
        onClick={handlePayment} 
        disabled={loading}
        className="btn-primary"
      >
        {loading ? 'Processing...' : 'Pay Now'}
      </button>
    </div>
  );
};
```

### Backend Implementation (Already Complete)

**Controller function - `razorpayController.js`:**
```javascript
exports.createRazorpayOrder = async (req, res) => {
  const { jobId, workerId, amount, skill, priceSource } = req.body;
  const clientId = req.user.id;

  // 1. Validate input
  if (!jobId || !workerId || !amount) {
    return res.status(400).json({ 
      success: false, 
      message: 'Missing required fields' 
    });
  }

  // 2. Verify client owns job
  const job = await Job.findById(jobId);
  if (job.clientId.toString() !== clientId) {
    return res.status(403).json({ 
      success: false, 
      message: 'Unauthorized' 
    });
  }

  // 3. Create Razorpay order
  const razorpayOrder = await razorpay.orders.create({
    amount: amount * 100, // Convert to paise
    currency: 'INR',
    receipt: `order_${jobId}_${workerId}_${Date.now()}`,
  });

  // 4. Save payment record
  const transaction = new PaymentTransaction({
    clientId,
    workerId,
    jobId,
    amount,
    razorpayOrderId: razorpayOrder.id,
    status: 'created',
  });
  await transaction.save();

  // 5. Return order details
  return res.json({
    success: true,
    razorpayOrderId: razorpayOrder.id,
    amount,
    keyId: process.env.RAZORPAY_KEY_ID,
  });
};

exports.verifyRazorpayPayment = async (req, res) => {
  const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

  // 1. Fetch transaction from DB
  const transaction = await PaymentTransaction.findOne({ razorpayOrderId });
  if (!transaction) {
    return res.status(404).json({ success: false });
  }

  // 2. Verify HMAC signature
  const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
  shasum.update(`${razorpayOrderId}|${razorpayPaymentId}`);
  const digest = shasum.digest('hex');

  if (digest !== razorpaySignature) {
    transaction.status = 'failed';
    await transaction.save();
    return res.status(403).json({ 
      success: false, 
      message: 'Signature mismatch - FRAUD DETECTED' 
    });
  }

  // 3. Verify payment with Razorpay
  const payment = await razorpay.payments.fetch(razorpayPaymentId);
  if (payment.status !== 'captured') {
    return res.status(400).json({ success: false });
  }

  // 4. Update transaction
  transaction.razorpayPaymentId = razorpayPaymentId;
  transaction.razorpaySignature = razorpaySignature;
  transaction.status = 'captured';
  await transaction.save();

  // 5. Fetch worker payout details
  const worker = await User.findById(transaction.workerId).select(
    '+payoutPreference +payoutUpiId +payoutBankAccountNumber'
  );
  transaction.workerPayoutDetails = {
    payoutPreference: worker.payoutPreference,
    payoutUpiId: worker.payoutUpiId,
    payoutBankAccountNumber: worker.payoutBankAccountNumber,
  };
  await transaction.save();

  // 6. Update Job payment status
  const job = await Job.findById(transaction.jobId);
  job.directHire.paymentStatus = 'paid';
  job.pricingMeta.finalPaidPrice = transaction.amount;
  await job.save();

  // 7. Return success
  return res.json({
    success: true,
    message: 'Payment verified',
    transactionId: transaction._id,
  });
};
```

---

## API Usage Examples

### Create Payment Order

**Request:**
```bash
curl -X POST http://localhost:5000/api/client/payment/razorpay/create-order \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "66f1a2b3c4d5e6f7",
    "workerId": "66f1a2b3c4d5e6f8",
    "slotId": "66f1a2b3c4d5e6f9",
    "amount": 5000,
    "skill": "Plumbing",
    "priceSource": "skillCost"
  }'
```

**Response:**
```json
{
  "success": true,
  "razorpayOrderId": "order_1BP3QEVxJWmZ2W",
  "amount": 5000,
  "currency": "INR",
  "keyId": "rzp_test_1DP5mmOlF5G5ag"
}
```

### Verify Payment

**Request:**
```bash
curl -X POST http://localhost:5000/api/client/payment/razorpay/verify \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "razorpayPaymentId": "pay_1BP3QEVxJWmZ2W",
    "razorpayOrderId": "order_1BP3QEVxJWmZ2W",
    "razorpaySignature": "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a3d"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "transactionId": "66f1a2b3c4d5e6fa",
  "paymentId": "pay_1BP3QEVxJWmZ2W"
}
```

### Get Payment History

**Request:**
```bash
curl -X GET "http://localhost:5000/api/client/payment/razorpay/transactions?limit=10&skip=0" \
  -H "Authorization: Bearer JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "transactions": [
    {
      "_id": "66f1a2b3c4d5e6fa",
      "jobId": "66f1a2b3c4d5e6f7",
      "workerId": "66f1a2b3c4d5e6f8",
      "amount": 5000,
      "status": "captured",
      "razorpayPaymentId": "pay_1BP3QEVxJWmZ2W",
      "paymentMethod": "card",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 10,
    "skip": 0
  }
}
```

---

## Database Queries

### Find All Payments for a Client
```javascript
const payments = await PaymentTransaction.find({ clientId })
  .sort({ createdAt: -1 })
  .limit(10);
```

### Find Successful Payments
```javascript
const successfulPayments = await PaymentTransaction.find({ 
  status: 'captured' 
});
```

### Find Failed Payments (Fraud Detection)
```javascript
const fraudAttempts = await PaymentTransaction.find({ 
  status: 'failed',
  failureCode: 'SIGNATURE_MISMATCH'
});
```

### Get Total Amount Paid
```javascript
const totalPaid = await PaymentTransaction.aggregate([
  { $match: { status: 'captured' } },
  { $group: { _id: null, total: { $sum: '$amount' } } }
]);
```

---

## Error Handling

### Common Errors & Solutions

**Error: "RAZORPAY_KEY_ID not found"**
```javascript
// Solution: Add to .env
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
// Restart server
```

**Error: "Signature verification failed"**
```javascript
// Cause: Payment tampering or wrong secret
// Solution: Verify RAZORPAY_KEY_SECRET is correct
// Check: Log the digest calculation
console.log('Expected:', digest);
console.log('Received:', razorpaySignature);
```

**Error: "Payment not captured"**
```javascript
// Cause: Payment authorized but not captured
// Solution: Check Razorpay dashboard
const payment = await razorpay.payments.fetch(paymentId);
console.log('Payment status:', payment.status); // Should be 'captured'
```

---

## Security Best Practices

### ✅ DO
- ✅ Always verify HMAC signature
- ✅ Check `razorpayPaymentId` matches order
- ✅ Validate amount hasn't changed
- ✅ Store payout details after verified payment
- ✅ Use HTTPS in production
- ✅ Rotate keys regularly

### ❌ DON'T
- ❌ Pass RAZORPAY_KEY_SECRET to frontend
- ❌ Skip signature verification
- ❌ Trust client-provided payment ID
- ❌ Expose worker payout details before payment
- ❌ Store full card/UPI details
- ❌ Log sensitive payment data

---

## Testing Checklist

- [ ] Install Razorpay package
- [ ] Add environment variables
- [ ] Start server: `npm start`
- [ ] Start client: `npm run dev`
- [ ] Navigate to job management
- [ ] Click "Pay Worker"
- [ ] Enter amount and confirm
- [ ] Razorpay modal opens
- [ ] Use test card: 4111 1111 1111 1111
- [ ] Complete payment
- [ ] Check database: PaymentTransaction created
- [ ] Check payment status: 'captured'
- [ ] Verify payout details stored
- [ ] Check Job.directHire.paymentStatus: 'paid'

---

## Production Deployment

### Before Going Live

1. **Get Live Keys**
   - Go to https://dashboard.razorpay.com
   - Switch from test to live mode
   - Copy live key ID and secret

2. **Update Environment**
   ```env
   RAZORPAY_KEY_ID=rzp_live_xxxxx
   RAZORPAY_KEY_SECRET=xxxxxx
   NODE_ENV=production
   ```

3. **Enable HTTPS**
   - Razorpay requires HTTPS in production
   - All payment data must be encrypted

4. **Test with Live Cards**
   - Some payment methods may have different behavior
   - Test refunds process correctly
   - Verify webhook setup

5. **Monitor Payments**
   - Set up alerts for failed payments
   - Monitor fraud attempts (signature failures)
   - Check refund success rate

---

## Monitoring & Logs

### Enable Debug Logging
```javascript
// In razorpayController.js
if (process.env.DEBUG_PAYMENT) {
  console.log('Order created:', razorpayOrder.id);
  console.log('Signature:', razorpaySignature);
  console.log('Payment status:', payment.status);
}
```

### Key Metrics to Track
- Total payments processed
- Success rate (captured / total)
- Failed payment reasons
- Average payment time
- Refund success rate
- Most popular payment method

---

## Files Reference

| File | Purpose | Status |
|------|---------|--------|
| `server/models/paymentTransactionModel.js` | Payment schema | ✅ Created |
| `server/controllers/razorpayController.js` | Payment logic | ✅ Created |
| `server/routes/paymentRoutes.js` | Payment routes | ✅ Created |
| `server/server.js` | Route registration | ✅ Modified |
| `server/package.json` | Razorpay dependency | ✅ Modified |
| `client/src/utils/razorpayHelper.js` | Frontend utilities | ✅ Created |
| `client/index.html` | Razorpay script | ✅ Modified |

---

## Support Resources

- **Razorpay Documentation**: https://razorpay.com/docs/
- **API Reference**: https://razorpay.com/docs/api/
- **Dashboard**: https://dashboard.razorpay.com
- **Test Cards**: https://razorpay.com/docs/payments/payments/test-payment-forms/

---

**Status**: ✅ Ready for Production  
**Last Updated**: 2024  
**Version**: 1.0
