// server/models/shopModel.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const shopSchema = new mongoose.Schema({
    // Owner Info
    ownerName:   { type: String, required: true, trim: true },
    ownerPhoto:  { type: String },
    mobile:      { type: String, required: true, unique: true },
    email:       { type: String, required: true, unique: true, trim: true, lowercase: true },
    password:    { type: String, required: true, select: false },

    // Shop Info
    shopName:    { type: String, required: true, trim: true },
    shopLogo:    { type: String },
    shopPhoto:   { type: String },                    // Live shop photo during registration
    gstNumber:   { type: String, trim: true, default: null },
    gstnCertificate: { type: String },                // GSTN certificate document
    category:    { type: String, required: true },   // from dropdown or manual

    // Live Location (captured during shop registration)
    shopLocation: {
        latitude:  { type: Number },
        longitude: { type: Number },
        address:   { type: String },                // reverse geocoded address (optional)
    },

    // Address
    address:     { type: String, required: true },
    city:        { type: String, required: true },
    pincode:     { type: String },
    locality:    { type: String },

    // Verification docs
    idProof: {
        idType:   { type: String },
        filePath: { type: String },
    },

    // Status
    verificationStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'blocked'],
        default: 'pending',
    },
    rejectionReason: { type: String, default: null },
    approvedAt:      { type: Date },
    rejectedAt:      { type: Date },

    // Email / Mobile OTP verification flags
    mobileVerified: { type: Boolean, default: false },
    emailVerified:  { type: Boolean, default: false },

    // Temp OTP fields
    mobileOtp:       { type: String, select: false },
    mobileOtpExpiry: { type: Date,   select: false },
    emailOtp:        { type: String, select: false },
    emailOtpExpiry:  { type: Date,   select: false },
    loginOtp:        { type: String, select: false },
    loginOtpExpiry:  { type: Date,   select: false },

    // Analytics helpers (updated on coupon use)
    totalSales:       { type: Number, default: 0 },
    totalDiscounts:   { type: Number, default: 0 },
    totalWorkers:     { type: Number, default: 0 },

}, { timestamps: true });

shopSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

shopSchema.methods.matchPassword = async function (entered) {
    const shop = await mongoose.model('Shop').findById(this._id).select('+password');
    return bcrypt.compare(entered, shop.password);
};

module.exports = mongoose.model('Shop', shopSchema);