// server/controllers/razorpayController.js
// Razorpay payment gateway integration

const Razorpay = require('razorpay');
const crypto = require('crypto');
const Job = require('../models/jobModel');
const User = require('../models/userModel');
const PaymentTransaction = require('../models/paymentTransactionModel');
const { sendOtpSms, sendCustomSms, buildWorkerPaymentSms, formatDateTime } = require('../utils/smsHelper');
const { getOtpCooldownState, markOtpCooldown, formatOtpCooldownMessage } = require('../utils/otpCooldown');

// Lazy initialization of Razorpay to allow environment variables to load
let razorpay = null;

const initializeRazorpay = () => {
    if (!razorpay) {
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            throw new Error(
                'Razorpay configuration missing. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env'
            );
        }
        razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
    }
    return razorpay;
};

const buildRazorpayReceipt = ({ jobId, workerId }) => {
    const j = String(jobId || '').slice(-6);
    const w = String(workerId || '').slice(-6);
    const t = Date.now().toString(36);
    // Must be <= 40 chars per Razorpay requirement.
    return `kc_${j}_${w}_${t}`;
};

const normalizePriceSource = (value) => {
    const allowed = new Set(['skillCost', 'negotiableCost', 'workerQuotedPrice', 'manual', 'direct_hire_expected_amount']);
    const normalized = String(value || '').trim();
    return allowed.has(normalized) ? normalized : 'manual';
};

const clearClientPaymentLockIfPossible = async (clientId) => {
    const pending = await Job.find({
        postedBy: clientId,
        hireMode: 'direct',
        'directHire.paymentStatus': { $ne: 'paid' },
        'directHire.requestStatus': { $in: ['accepted', 'requested', 'pending'] },
    }).select('_id').lean();

    if (pending.length) return;

    await User.findByIdAndUpdate(clientId, {
        $set: {
            'paymentLock.active': false,
            'paymentLock.sections': [],
            'paymentLock.reason': '',
            'paymentLock.updatedAt': new Date(),
        },
    });
};

const CASH_OTP_TTL_MS = 5 * 60 * 1000;
const CASH_OTP_MAX_ATTEMPTS = 5;

const makeOtp = () => crypto.randomInt(0, 1000000).toString().padStart(6, '0');
const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp || '').trim()).digest('hex');

const maskMobile = (mobile = '') => {
    const digits = String(mobile || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length <= 4) return digits;
    return `xxxxxx${digits.slice(-4)}`;
};

const buildCashTransactionRef = ({ jobId, workerId }) => {
    const j = String(jobId || '').slice(-6);
    const w = String(workerId || '').slice(-6);
    const t = Date.now().toString(36);
    return `cash_${j}_${w}_${t}`;
};

const applyCashPaymentToJob = async ({ transaction, paymentAmount }) => {
    const job = await Job.findById(transaction.jobId);
    if (!job) return null;

    job.directHire = job.directHire || {};
    job.directHire.paymentStatus = 'paid';
    job.directHire.paymentMode = 'cash';
    job.directHire.paymentAmount = paymentAmount;
    job.directHire.paymentConfirmedAt = new Date();
    job.directHire.workerPaymentApprovalStatus = 'approved';

    job.pricingMeta = job.pricingMeta || {};
    job.pricingMeta.finalPaidPrice = paymentAmount;
    job.pricingMeta.priceSource = 'manual';

    if (transaction.slotId) {
        const slot = job.workerSlots.id(transaction.slotId);
        if (slot) {
            slot.finalPaidPrice = paymentAmount;
        }
    }

    if (Array.isArray(job.workerSlots) && job.workerSlots.length > 0) {
        const firstSlot = job.workerSlots[0];
        if (firstSlot && Number(firstSlot.finalPaidPrice || 0) <= 0) {
            firstSlot.finalPaidPrice = paymentAmount;
        }
    }

    await job.save();
    return job;
};

/**
 * Cash Payment OTP Handlers
 * POST /api/client/payment/cash/send-otp
 * POST /api/client/payment/cash/resend-otp
 * POST /api/client/payment/cash/verify-otp
 */
exports.sendCashPaymentOtp = async (req, res) => {
    try {
        const { jobId, workerId, slotId, amount, skill, priceSource } = req.body || {};
        const clientId = req.user.id;

        if (!jobId || !workerId || !amount || !skill) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: jobId, workerId, amount, skill',
            });
        }

        const numericAmount = Number(amount);
        if (!Number.isFinite(numericAmount) || numericAmount < 1) {
            return res.status(400).json({
                success: false,
                message: 'Invalid amount. Must be at least ₹1',
            });
        }

        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }

        const ownerId = job?.postedBy || job?.clientId;
        if (!ownerId || String(ownerId) !== String(clientId)) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized: You do not own this job',
            });
        }

        let targetWorker = await User.findById(workerId).select('name mobile photo');
        if (!targetWorker) {
            return res.status(404).json({ success: false, message: 'Worker not found' });
        }

        if (!String(targetWorker.mobile || '').trim()) {
            return res.status(400).json({ success: false, message: 'Worker mobile number is missing for cash OTP.' });
        }

        if (slotId) {
            const slot = job.workerSlots.id(slotId);
            if (!slot) {
                return res.status(404).json({ success: false, message: 'Worker slot not found' });
            }
            if (String(slot.assignedWorker || '') !== String(workerId)) {
                return res.status(400).json({ success: false, message: 'Slot worker does not match the selected worker.' });
            }
        } else if (String(job.hireMode || '') === 'direct') {
            const directWorkerId = String(job.directHire?.workerId || '');
            if (directWorkerId && directWorkerId !== String(workerId)) {
                return res.status(400).json({ success: false, message: 'Direct hire worker does not match the selected worker.' });
            }
        }

        const otp = makeOtp();
        const now = new Date();
        const transaction = new PaymentTransaction({
            clientId,
            workerId,
            jobId,
            slotId: slotId || null,
            razorpayOrderId: buildCashTransactionRef({ jobId, workerId }),
            amount: numericAmount,
            currency: 'INR',
            skill,
            priceSource: normalizePriceSource(priceSource),
            paymentMethod: 'cash',
            status: 'created',
            cashOtpHash: hashOtp(otp),
            cashOtpExpiry: new Date(now.getTime() + CASH_OTP_TTL_MS),
            cashOtpAttempts: 0,
            cashOtpSentAt: now,
            cashOtpResendCount: 0,
            clientIpAddress: req.ip,
            clientUserAgent: req.get('user-agent'),
            notes: {
                jobTitle: job.title,
                clientName: job.clientName || 'Unknown',
                workerName: targetWorker.name || 'Unknown',
            },
        });

        await transaction.save();

        const cooldownKey = `cash-payment-otp:${transaction._id}`;
        const cooldown = getOtpCooldownState(cooldownKey);
        if (!cooldown.allowed) {
            return res.status(429).json({
                success: false,
                message: formatOtpCooldownMessage(cooldown.remainingMs),
                retryAfterSeconds: Math.ceil(cooldown.remainingMs / 1000),
            });
        }

        const smsResult = await sendOtpSms(targetWorker.mobile, otp);
        if (smsResult?.success === false) {
            throw new Error(smsResult.reason || 'sms_send_failed');
        }

        markOtpCooldown(cooldownKey);

        return res.status(200).json({
            success: true,
            transactionId: transaction._id,
            maskedMobile: maskMobile(targetWorker.mobile),
            otpExpiresAt: transaction.cashOtpExpiry,
            resendCount: transaction.cashOtpResendCount,
        });
    } catch (error) {
        console.error('sendCashPaymentOtp:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to send cash OTP',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};

exports.resendCashPaymentOtp = async (req, res) => {
    try {
        const { transactionId } = req.body || {};
        const clientId = req.user.id;

        if (!transactionId) {
            return res.status(400).json({ success: false, message: 'transactionId is required' });
        }

        const transaction = await PaymentTransaction.findById(transactionId);
        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }

        if (String(transaction.clientId) !== String(clientId)) {
            return res.status(403).json({ success: false, message: 'Unauthorized: This transaction does not belong to you' });
        }

        if (String(transaction.paymentMethod || '') !== 'cash') {
            return res.status(400).json({ success: false, message: 'This transaction is not a cash OTP transaction.' });
        }

        if (String(transaction.status || '') === 'captured') {
            return res.status(400).json({ success: false, message: 'Cash payment has already been verified.' });
        }

        const worker = await User.findById(transaction.workerId).select('name mobile');
        if (!worker || !String(worker.mobile || '').trim()) {
            return res.status(400).json({ success: false, message: 'Worker mobile number is missing for cash OTP.' });
        }

        const otp = makeOtp();
        transaction.cashOtpHash = hashOtp(otp);
        transaction.cashOtpExpiry = new Date(Date.now() + CASH_OTP_TTL_MS);
        transaction.cashOtpAttempts = 0;
        transaction.cashOtpSentAt = new Date();
        transaction.cashOtpResendCount = Number(transaction.cashOtpResendCount || 0) + 1;
        await transaction.save();

        const cooldownKey = `cash-payment-otp:${transaction._id}`;
        const cooldown = getOtpCooldownState(cooldownKey);
        if (!cooldown.allowed) {
            return res.status(429).json({
                success: false,
                message: formatOtpCooldownMessage(cooldown.remainingMs),
                retryAfterSeconds: Math.ceil(cooldown.remainingMs / 1000),
            });
        }

        const smsResult = await sendOtpSms(worker.mobile, otp);
        if (smsResult?.success === false) {
            throw new Error(smsResult.reason || 'sms_send_failed');
        }

        markOtpCooldown(cooldownKey);

        return res.status(200).json({
            success: true,
            transactionId: transaction._id,
            maskedMobile: maskMobile(worker.mobile),
            otpExpiresAt: transaction.cashOtpExpiry,
            resendCount: transaction.cashOtpResendCount,
        });
    } catch (error) {
        console.error('resendCashPaymentOtp:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to resend cash OTP',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};

exports.verifyCashPaymentOtp = async (req, res) => {
    try {
        const { transactionId, otp } = req.body || {};
        const clientId = req.user.id;

        if (!transactionId || !otp) {
            return res.status(400).json({ success: false, message: 'transactionId and otp are required' });
        }

        const transaction = await PaymentTransaction.findById(transactionId);
        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }

        if (String(transaction.clientId) !== String(clientId)) {
            return res.status(403).json({ success: false, message: 'Unauthorized: This transaction does not belong to you' });
        }

        if (String(transaction.paymentMethod || '') !== 'cash') {
            return res.status(400).json({ success: false, message: 'This transaction is not a cash OTP transaction.' });
        }

        if (String(transaction.status || '') === 'captured') {
            return res.status(200).json({
                success: true,
                message: 'Cash payment already verified',
                transactionId: transaction._id,
                amount: transaction.amount,
                workerId: transaction.workerId,
                jobId: transaction.jobId,
            });
        }

        if (!transaction.cashOtpHash || !transaction.cashOtpExpiry) {
            return res.status(400).json({ success: false, message: 'Cash OTP has not been generated for this transaction.' });
        }

        if (Date.now() > new Date(transaction.cashOtpExpiry).getTime()) {
            return res.status(400).json({ success: false, message: 'Cash OTP has expired. Please resend OTP.' });
        }

        const attempts = Number(transaction.cashOtpAttempts || 0);
        if (attempts >= CASH_OTP_MAX_ATTEMPTS) {
            return res.status(429).json({ success: false, message: 'Too many invalid attempts. Please resend OTP.' });
        }

        if (hashOtp(otp) !== String(transaction.cashOtpHash || '')) {
            transaction.cashOtpAttempts = attempts + 1;
            await transaction.save();
            const remaining = Math.max(0, CASH_OTP_MAX_ATTEMPTS - transaction.cashOtpAttempts);
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP',
                attemptsLeft: remaining,
            });
        }

        transaction.status = 'captured';
        transaction.cashOtpHash = undefined;
        transaction.cashOtpExpiry = null;
        transaction.cashOtpVerifiedAt = new Date();
        transaction.cashOtpAttempts = 0;

        const worker = await User.findById(transaction.workerId).select(
            '+payoutPreference +payoutUpiId +payoutBankAccountNumber +payoutBankIfsc +payoutAccountHolderName'
        );
        if (worker) {
            transaction.workerPayoutDetails = {
                payoutPreference: worker.payoutPreference,
                payoutUpiId: worker.payoutUpiId,
                payoutBankAccountNumber: worker.payoutBankAccountNumber,
                payoutBankIfsc: worker.payoutBankIfsc,
                payoutAccountHolderName: worker.payoutAccountHolderName,
            };
        }

        await transaction.save();
        await applyCashPaymentToJob({ transaction, paymentAmount: transaction.amount });
        await clearClientPaymentLockIfPossible(transaction.clientId);

        try {
            const [worker, client, job] = await Promise.all([
                User.findById(transaction.workerId).select('name mobile'),
                User.findById(transaction.clientId).select('name mobile'),
                Job.findById(transaction.jobId).select('title scheduledDate scheduledTime location'),
            ]);

            if (worker?.mobile) {
                const smsResult = await sendCustomSms(
                    worker.mobile,
                    buildWorkerPaymentSms({
                        jobTitle: job?.title || 'N/A',
                        amountPaid: transaction.amount,
                        clientName: client?.name || 'N/A',
                        clientMobile: client?.mobile || 'N/A',
                        dateTime: formatDateTime(job?.scheduledDate || transaction.createdAt, job?.scheduledTime || ''),
                    })
                );
                if (smsResult?.success === false) {
                    console.warn('Cash payment SMS was not delivered:', smsResult.reason);
                }
            }
        } catch (smsErr) {
            console.error('Cash payment SMS failed (non-fatal):', smsErr.message);
        }

        return res.status(200).json({
            success: true,
            message: 'Cash payment verified successfully',
            transactionId: transaction._id,
            amount: transaction.amount,
            workerId: transaction.workerId,
            jobId: transaction.jobId,
        });
    } catch (error) {
        console.error('verifyCashPaymentOtp:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to verify cash OTP',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};

/**
 * Helper: Get worker's payout details securely
 * Only callable after payment verification
 */
const getWorkerPayoutDetails = async (workerId) => {
    try {
        const worker = User.findById(workerId).select(
            '+payoutPreference +payoutUpiId +payoutBankAccountNumber +payoutBankIfsc +payoutAccountHolderName'
        );
        return worker || null;
    } catch (error) {
        console.error('Error fetching worker payout details:', error);
        return null;
    }
};

/**
 * Create Razorpay Order
 * POST /api/payment/razorpay/create-order
 * 
 * Body: {
 *   jobId, workerId, slotId, amount, skill, priceSource
 * }
 */
exports.createRazorpayOrder = async (req, res) => {
    try {
        const { jobId, workerId, slotId, amount, skill, priceSource } = req.body;
        const safePriceSource = normalizePriceSource(priceSource);
        const clientId = req.user.id;

        // Validation
        if (!jobId || !workerId || !amount || !skill) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: jobId, workerId, amount, skill',
            });
        }

        if (amount < 1 || amount > 1000000) {
            return res.status(400).json({
                success: false,
                message: 'Invalid amount. Must be between ₹1 and ₹1000000',
            });
        }

        // Verify job exists and client owns it
        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }

        const ownerId = job?.postedBy || job?.clientId;
        if (!ownerId || String(ownerId) !== String(clientId)) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized: You do not own this job',
            });
        }

        // Verify worker exists
        const worker = await User.findById(workerId);
        if (!worker) {
            return res.status(404).json({ success: false, message: 'Worker not found' });
        }

        // Create Razorpay order
        const razorpayOrder = await initializeRazorpay().orders.create({
            amount: Math.round(amount * 100), // Razorpay expects amount in paise
            currency: 'INR',
            receipt: buildRazorpayReceipt({ jobId, workerId }),
            notes: {
                jobId,
                clientId,
                workerId,
                skill,
                priceSource: safePriceSource,
            },
        });

        // Save transaction record
        const transaction = new PaymentTransaction({
            clientId,
            workerId,
            jobId,
            slotId,
            amount,
            currency: 'INR',
            skill,
            priceSource: safePriceSource,
            razorpayOrderId: razorpayOrder.id,
            status: 'created',
            clientIpAddress: req.ip,
            clientUserAgent: req.get('user-agent'),
            notes: {
                jobTitle: job.title,
                clientName: job.clientName || 'Unknown',
                workerName: worker.name || 'Unknown',
            },
        });

        await transaction.save();

        return res.status(200).json({
            success: true,
            razorpayOrderId: razorpayOrder.id,
            amount,
            currency: 'INR',
            keyId: process.env.RAZORPAY_KEY_ID,
            clientId,
            workerId,
            jobId,
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        const gatewayDescription = error?.error?.description;
        const statusCode = error?.statusCode || 500;
        return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
            success: false,
            message: gatewayDescription || 'Failed to create payment order',
            error: process.env.NODE_ENV === 'development' ? (error?.message || error) : undefined,
        });
    }
};

/**
 * Verify Razorpay Payment Signature
 * POST /api/payment/razorpay/verify
 * 
 * Body: {
 *   razorpayPaymentId, razorpayOrderId, razorpaySignature
 * }
 */
exports.verifyRazorpayPayment = async (req, res) => {
    try {
        const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;
        const clientId = req.user.id;

        // Validation
        if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
            return res.status(400).json({
                success: false,
                message: 'Missing payment verification details',
            });
        }

        // Fetch transaction from database
        const transaction = await PaymentTransaction.findOne({ razorpayOrderId });
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found',
            });
        }

        // Verify client owns this transaction
        if (transaction.clientId.toString() !== clientId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized: This payment does not belong to you',
            });
        }

        // Verify Razorpay signature
        const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        shasum.update(`${razorpayOrderId}|${razorpayPaymentId}`);
        const digest = shasum.digest('hex');

        if (digest !== razorpaySignature) {
            // Signature mismatch - potential fraud
            transaction.status = 'failed';
            transaction.failureReason = 'Signature verification failed';
            transaction.failureCode = 'SIGNATURE_MISMATCH';
            await transaction.save();

            return res.status(403).json({
                success: false,
                message: 'Payment verification failed. Invalid signature.',
                isSignatureMismatch: true,
            });
        }

        // Fetch payment details from Razorpay to confirm it was captured
        const payment = await initializeRazorpay().payments.fetch(razorpayPaymentId);

        if (payment.status !== 'captured') {
            transaction.status = 'failed';
            transaction.failureReason = `Payment status is ${payment.status}`;
            await transaction.save();

            return res.status(400).json({
                success: false,
                message: `Payment not captured. Status: ${payment.status}`,
            });
        }

        // Payment verified! Update transaction
        transaction.razorpayPaymentId = razorpayPaymentId;
        transaction.razorpaySignature = razorpaySignature;
        transaction.status = 'captured';
        const normalizedMethod = String(payment.method || 'other').toLowerCase();
        const allowedMethods = new Set([
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
        ]);
        transaction.paymentMethod = allowedMethods.has(normalizedMethod) ? normalizedMethod : 'other';

        // Fetch worker payout details
        const worker = await User.findById(transaction.workerId).select(
            '+payoutPreference +payoutUpiId +payoutBankAccountNumber +payoutBankIfsc +payoutAccountHolderName'
        );

        if (worker) {
            transaction.workerPayoutDetails = {
                payoutPreference: worker.payoutPreference,
                payoutUpiId: worker.payoutUpiId,
                payoutBankAccountNumber: worker.payoutBankAccountNumber,
                payoutBankIfsc: worker.payoutBankIfsc,
                payoutAccountHolderName: worker.payoutAccountHolderName,
            };
        }

        await transaction.save();

        // Update Job model - mark payment as complete
        const job = await Job.findById(transaction.jobId);
        if (job) {
            const modeFromGateway = transaction.paymentMethod;
            const mappedDirectHireMode = modeFromGateway === 'upi'
                ? 'upi'
                : modeFromGateway === 'bank_transfer'
                    ? 'bank_transfer'
                    : 'online';

            const mappedPricingSource = ['skillCost', 'negotiableCost', 'workerQuotedPrice', 'manual']
                .includes(String(transaction.priceSource || ''))
                ? 'manual'
                : 'manual';

            // Update directHire payment status if applicable
            job.directHire = job.directHire || {};
            job.directHire.paymentStatus = 'paid';
            job.directHire.paymentMode = mappedDirectHireMode;
            job.directHire.paymentAmount = transaction.amount;

            // Update pricingMeta
            job.pricingMeta = job.pricingMeta || {};
            job.pricingMeta.finalPaidPrice = transaction.amount;
            job.pricingMeta.priceSource = mappedPricingSource;

            // Update workerSlots if slotId exists
            if (transaction.slotId) {
                const slot = job.workerSlots.id(transaction.slotId);
                if (slot) {
                    slot.finalPaidPrice = transaction.amount;
                }
            }

            await job.save();
            await clearClientPaymentLockIfPossible(transaction.clientId);
        }

        return res.status(200).json({
            success: true,
            message: 'Payment verified successfully',
            transactionId: transaction._id,
            paymentId: razorpayPaymentId,
            amount: transaction.amount,
            workerId: transaction.workerId,
            jobId: transaction.jobId,
        });
    } catch (error) {
        console.error('Error verifying Razorpay payment:', error);
        return res.status(500).json({
            success: false,
            message: 'Payment verification failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};

/**
 * Get payment transaction history
 * GET /api/payment/razorpay/transactions
 */
exports.getPaymentHistory = async (req, res) => {
    try {
        const clientId = req.user.id;
        const { limit = 10, skip = 0 } = req.query;

        const transactions = await PaymentTransaction.find({ clientId })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip))
            .select('-razorpaySignature -workerPayoutDetails -cashOtpHash'); // Don't expose sensitive data

        const total = await PaymentTransaction.countDocuments({ clientId });

        return res.status(200).json({
            success: true,
            transactions,
            pagination: {
                total,
                limit: parseInt(limit),
                skip: parseInt(skip),
            },
        });
    } catch (error) {
        console.error('Error fetching payment history:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch payment history',
        });
    }
};

/**
 * Get single transaction details
 * GET /api/payment/razorpay/transactions/:transactionId
 */
exports.getTransactionDetails = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const clientId = req.user.id;

        const transaction = await PaymentTransaction.findById(transactionId);

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found',
            });
        }

        if (transaction.clientId.toString() !== clientId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized: This transaction does not belong to you',
            });
        }

        // Don't expose signature or full payout details unless specifically needed
        transaction.razorpaySignature = undefined;
        transaction.cashOtpHash = undefined;

        return res.status(200).json({
            success: true,
            transaction,
        });
    } catch (error) {
        console.error('Error fetching transaction details:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch transaction details',
        });
    }
};

/**
 * Refund payment
 * POST /api/payment/razorpay/refund/:transactionId
 */
exports.refundPayment = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const clientId = req.user.id;

        const transaction = await PaymentTransaction.findById(transactionId);

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found',
            });
        }

        if (transaction.clientId.toString() !== clientId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        if (transaction.status !== 'captured') {
            return res.status(400).json({
                success: false,
                message: `Cannot refund payment with status: ${transaction.status}`,
            });
        }

        if (String(transaction.paymentMethod || '') === 'cash') {
            return res.status(400).json({
                success: false,
                message: 'Cash payments cannot be refunded through Razorpay.',
            });
        }

        // Process refund via Razorpay
        const refund = await initializeRazorpay().payments.refund(transaction.razorpayPaymentId, {
            amount: Math.round(transaction.amount * 100), // Refund full amount
            notes: {
                reason: 'Client requested refund',
                jobId: transaction.jobId,
            },
        });

        transaction.status = 'refunded';
        transaction.refundedAt = new Date();
        transaction.refundAmount = transaction.amount;
        await transaction.save();

        return res.status(200).json({
            success: true,
            message: 'Refund processed successfully',
            refundId: refund.id,
            amount: transaction.amount,
        });
    } catch (error) {
        console.error('Error processing refund:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to process refund',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};
