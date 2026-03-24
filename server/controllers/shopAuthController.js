// server/controllers/shopAuthController.js
// FIXED:
//   - normPath() converts absolute disk paths → relative forward-slash paths
//     e.g. "C:\project\server\uploads\file.jpg"  →  "uploads/file.jpg"
//          "/home/user/server/uploads/file.jpg"   →  "uploads/file.jpg"
//   - All file fields (ownerPhoto, idProof, shopLogo) stored as "uploads/filename"
//   - These paths are then served by Express at GET /uploads/filename  ✅

const Shop       = require('../models/shopModel');
const jwt        = require('jsonwebtoken');
const crypto     = require('crypto');
const nodemailer = require('nodemailer');
const twilio     = require('twilio');
const path       = require('path');

// ── JWT helper ────────────────────────────────────────────────────────────────
const signToken = (id) =>
    jwt.sign({ id, role: 'shop' }, process.env.JWT_SECRET, { expiresIn: '7d' });

// ── Email transporter ─────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

const sendEmail = async (to, subject, text) => {
    try {
        await transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, text });
    } catch (err) {
        console.error('Email error:', err.message);
    }
};

// ── Twilio SMS ────────────────────────────────────────────────────────────────
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const sendSms = async (to, body) => {
    if (!to || !body) return;
    try {
        await twilioClient.messages.create({
            body,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: to.startsWith('+') ? to : `+91${to}`,
        });
    } catch (err) {
        console.error('SMS error:', err.message);
    }
};

// ── PATH NORMALISATION ────────────────────────────────────────────────────────
// Converts an absolute multer disk path to a relative "uploads/filename" path.
// This is what gets stored in MongoDB and later resolved by the frontend's
// getImageUrl() as:  http://localhost:5000/uploads/filename
//
// Input examples:
//   "C:\\project\\server\\uploads\\1234-photo.jpg"
//   "/home/user/server/uploads/1234-photo.jpg"
//   "uploads/1234-photo.jpg"   (already relative — returned as-is)
//
const normPath = (filePath) => {
    if (!filePath) return null;
    // Normalise separators
    const normalised = filePath.replace(/\\/g, '/');
    // Find the uploads/ segment and return everything from there
    const idx = normalised.indexOf('uploads/');
    if (idx !== -1) return normalised.slice(idx);   // e.g. "uploads/1234-photo.jpg"
    // If for some reason uploads/ isn't in the path, return the basename only
    return `uploads/${path.basename(normalised)}`;
};

// ── STEP 1: Send Mobile OTP ───────────────────────────────────────────────────
exports.sendMobileOtp = async (req, res) => {
    try {
        const { mobile } = req.body;
        if (!mobile || mobile.length !== 10)
            return res.status(400).json({ message: 'Enter a valid 10-digit mobile number.' });

        const otp    = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000);
        const hashed = crypto.createHash('sha256').update(otp).digest('hex');

        await Shop.findOneAndUpdate(
            { mobile },
            { mobileOtp: hashed, mobileOtpExpiry: expiry, mobileVerified: false },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).catch(() => {});   // ignore validation on incomplete doc

        await sendSms(mobile, `KarigarConnect Shop: Your OTP is ${otp}. Valid for 10 minutes. Do not share.`);
        return res.json({ message: 'OTP sent to mobile.' });
    } catch (err) {
        console.error('sendMobileOtp:', err);
        return res.status(500).json({ message: 'Failed to send OTP.' });
    }
};

// ── STEP 2: Send Email OTP ────────────────────────────────────────────────────
exports.sendEmailOtp = async (req, res) => {
    try {
        const { email, mobile } = req.body;
        if (!email) return res.status(400).json({ message: 'Email required.' });

        const otp    = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000);
        const hashed = crypto.createHash('sha256').update(otp).digest('hex');

        if (mobile) {
            await Shop.findOneAndUpdate(
                { mobile },
                { emailOtp: hashed, emailOtpExpiry: expiry, emailVerified: false },
                { upsert: false }
            );
        }

        await sendEmail(
            email,
            'KarigarConnect Shop — Email Verification OTP',
            `Your OTP for email verification is: ${otp}\nValid for 10 minutes. Do not share.`
        );
        return res.json({ message: 'OTP sent to email.' });
    } catch (err) {
        console.error('sendEmailOtp:', err);
        return res.status(500).json({ message: 'Failed to send email OTP.' });
    }
};

// ── STEP 3: Verify Mobile OTP ─────────────────────────────────────────────────
exports.verifyMobileOtp = async (req, res) => {
    try {
        const { mobile, otp } = req.body;
        const shop = await Shop.findOne({ mobile }).select('+mobileOtp +mobileOtpExpiry');
        if (!shop || !shop.mobileOtp)
            return res.status(400).json({ message: 'No OTP request found.' });
        if (Date.now() > new Date(shop.mobileOtpExpiry).getTime())
            return res.status(400).json({ message: 'OTP expired. Request a new one.' });

        const hashed = crypto.createHash('sha256').update(otp.trim()).digest('hex');
        if (hashed !== shop.mobileOtp)
            return res.status(400).json({ message: 'Incorrect OTP.' });

        shop.mobileVerified  = true;
        shop.mobileOtp       = undefined;
        shop.mobileOtpExpiry = undefined;
        await shop.save({ validateBeforeSave: false });
        return res.json({ message: 'Mobile verified.' });
    } catch (err) {
        console.error('verifyMobileOtp:', err);
        return res.status(500).json({ message: 'Verification failed.' });
    }
};

// ── STEP 4: Verify Email OTP ──────────────────────────────────────────────────
exports.verifyEmailOtp = async (req, res) => {
    try {
        const { mobile, otp } = req.body;
        const shop = await Shop.findOne({ mobile }).select('+emailOtp +emailOtpExpiry');
        if (!shop || !shop.emailOtp)
            return res.status(400).json({ message: 'No email OTP found.' });
        if (Date.now() > new Date(shop.emailOtpExpiry).getTime())
            return res.status(400).json({ message: 'OTP expired.' });

        const hashed = crypto.createHash('sha256').update(otp.trim()).digest('hex');
        if (hashed !== shop.emailOtp)
            return res.status(400).json({ message: 'Incorrect OTP.' });

        shop.emailVerified  = true;
        shop.emailOtp       = undefined;
        shop.emailOtpExpiry = undefined;
        await shop.save({ validateBeforeSave: false });
        return res.json({ message: 'Email verified.' });
    } catch (err) {
        console.error('verifyEmailOtp:', err);
        return res.status(500).json({ message: 'Verification failed.' });
    }
};

// ── STEP 5: Complete Registration ─────────────────────────────────────────────
exports.registerShop = async (req, res) => {
    try {
        const {
            ownerName, mobile, email, password,
            shopName, gstNumber, category,
            address, city, pincode, locality, idType,
        } = req.body;

        const shop = await Shop.findOne({ mobile });
        if (!shop)             return res.status(400).json({ message: 'Please verify mobile first.' });
        if (!shop.mobileVerified) return res.status(400).json({ message: 'Mobile not verified.' });
        if (!shop.emailVerified)  return res.status(400).json({ message: 'Email not verified.' });

        const files = req.files || {};

        // ── KEY FIX: normalise ALL file paths before saving ──────────────────
        // multer.path on Windows:  "C:\...\uploads\1234-photo.jpg"
        // normPath converts to:    "uploads/1234-photo.jpg"
        // Express serves at:       GET /uploads/1234-photo.jpg  ✅
        const ownerPhotoPath = normPath(files.ownerPhoto?.[0]?.path);
        const idProofPath    = normPath(files.idProof?.[0]?.path);
        const shopLogoPath   = normPath(files.shopLogo?.[0]?.path);

        shop.ownerName  = ownerName;
        shop.email      = email;
        shop.password   = password;
        shop.shopName   = shopName;
        shop.shopLogo   = shopLogoPath;
        shop.gstNumber  = gstNumber || null;
        shop.category   = category;
        shop.address    = address;
        shop.city       = city;
        shop.pincode    = pincode || '';
        shop.locality   = locality || '';
        shop.ownerPhoto = ownerPhotoPath;
        shop.idProof    = { idType: idType || 'Aadhar Card', filePath: idProofPath };
        shop.verificationStatus = 'pending';

        await shop.save();
        return res.status(201).json({
            message: 'Registration submitted. We will contact you within 24 hours.',
        });
    } catch (err) {
        console.error('registerShop:', err);
        return res.status(500).json({ message: err.message || 'Registration failed.' });
    }
};

// ── LOGIN ─────────────────────────────────────────────────────────────────────
exports.loginShop = async (req, res) => {
    try {
        const { mobile, password } = req.body;
        if (!mobile || !password)
            return res.status(400).json({ message: 'Mobile and password required.' });

        const shop = await Shop.findOne({ mobile }).select('+password');
        if (!shop)
            return res.status(401).json({ message: 'Invalid credentials.' });

        if (shop.verificationStatus !== 'approved')
            return res.status(403).json({
                message: shop.verificationStatus === 'pending'
                    ? 'Your shop is under review. Admin will contact you within 24 hours.'
                    : shop.verificationStatus === 'blocked'
                    ? 'Your shop account has been blocked. Contact support.'
                    : 'Shop not approved.',
            });

        const bcrypt  = require('bcryptjs');
        const isMatch = await bcrypt.compare(password, shop.password);
        if (!isMatch)
            return res.status(401).json({ message: 'Invalid credentials.' });

        const token    = signToken(shop._id);
        const shopData = shop.toObject();
        delete shopData.password;

        return res.json({ token, shop: shopData });
    } catch (err) {
        console.error('loginShop:', err);
        return res.status(500).json({ message: 'Login failed.' });
    }
};