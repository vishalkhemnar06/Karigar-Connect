// server/models/paymentTransactionModel.js
// Secure payment transaction record with Razorpay integration

const mongoose = require('mongoose');

const PaymentTransactionSchema = new mongoose.Schema(
    {
        // Payment identifiers
        clientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        workerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        jobId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Job',
            required: true,
            index: true,
        },
        slotId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },

        // Razorpay order & payment details
        razorpayOrderId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        razorpayPaymentId: String, // populated after successful payment
        razorpaySignature: String, // populated after successful payment verification

        // Payment amount
        amount: {
            type: Number,
            required: true,
            min: 1,
        },
        currency: {
            type: String,
            default: 'INR',
        },

        // Skill & source
        skill: {
            type: String,
            required: true,
            index: true,
        },
        priceSource: {
            type: String,
            enum: ['skillCost', 'negotiableCost', 'workerQuotedPrice', 'manual', 'direct_hire_expected_amount'],
            default: 'manual',
        },

        // Payment status
        status: {
            type: String,
            enum: ['created', 'authorized', 'captured', 'failed', 'refunded'],
            default: 'created',
            index: true,
        },
        paymentMethod: {
            type: String,
            enum: [
                'cash',
                'card',
                'upi',
                'netbanking',
                'wallet',
                'emi',
                'paylater',
                'cardless_emi',
                'bank_transfer',
                'emandate',
                'nach',
                'app',
                'razorpay_qr',
                'other',
            ],
            default: null,
        },

        // Error handling
        failureReason: String,
        failureCode: String,

        // Cash payment OTP state
        cashOtpHash: String,
        cashOtpExpiry: Date,
        cashOtpAttempts: {
            type: Number,
            default: 0,
            min: 0,
        },
        cashOtpSentAt: Date,
        cashOtpVerifiedAt: Date,
        cashOtpResendCount: {
            type: Number,
            default: 0,
            min: 0,
        },

        // Worker payout details (encrypted, only visible after payment)
        workerPayoutDetails: {
            payoutPreference: String, // 'upi' or 'bank'
            payoutUpiId: String,
            payoutBankAccountNumber: String,
            payoutBankIfsc: String,
            payoutAccountHolderName: String,
        },

        // Settlement tracking
        settled: {
            type: Boolean,
            default: false,
        },
        settledAt: Date,
        refundedAt: Date,
        refundAmount: Number,

        // Metadata
        clientIpAddress: String,
        clientUserAgent: String,
        notes: {
            jobTitle: String,
            clientName: String,
            workerName: String,
        },

        createdAt: {
            type: Date,
            default: Date.now,
            index: true,
        },
        updatedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

// Index for retrieving payment history
PaymentTransactionSchema.index({ clientId: 1, createdAt: -1 });
PaymentTransactionSchema.index({ workerId: 1, createdAt: -1 });
PaymentTransactionSchema.index({ jobId: 1, status: 1 });

module.exports = mongoose.model('PaymentTransaction', PaymentTransactionSchema);
