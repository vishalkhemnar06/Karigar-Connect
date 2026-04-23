// server/routes/paymentRoutes.js
// Razorpay payment gateway routes

const express = require('express');
const router = express.Router();
const { protect, client } = require('../middleware/authMiddleware');
const {
    createRazorpayOrder,
    verifyRazorpayPayment,
    sendCashPaymentOtp,
    resendCashPaymentOtp,
    verifyCashPaymentOtp,
    getPaymentHistory,
    getTransactionDetails,
    refundPayment,
} = require('../controllers/razorpayController');

// All payment routes require client authentication
router.use(protect, client);

// Create Razorpay order
router.post('/razorpay/create-order', createRazorpayOrder);

// Verify payment signature
router.post('/razorpay/verify', verifyRazorpayPayment);

// Cash payment OTP flow
router.post('/cash/send-otp', sendCashPaymentOtp);
router.post('/cash/resend-otp', resendCashPaymentOtp);
router.post('/cash/verify-otp', verifyCashPaymentOtp);

// Get payment history
router.get('/razorpay/transactions', getPaymentHistory);

// Get specific transaction
router.get('/razorpay/transactions/:transactionId', getTransactionDetails);

// Refund payment
router.post('/razorpay/refund/:transactionId', refundPayment);

module.exports = router;
