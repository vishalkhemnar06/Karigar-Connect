// server/models/userModel.js — UPDATED
// Changes from previous version:
//   - Added leaderboardDiscount virtual (computed from points for frontend display)
//   - All original fields and hooks preserved exactly

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const referenceSchema = new mongoose.Schema({
    name: { type: String },
    contact: { type: String },
});

const skillSchema = new mongoose.Schema({
    name: { type: String, required: true },
    isPrimary: { type: Boolean, default: false },
    proficiency: {
        type: String,
        enum: ['Beginner', 'Intermediate', 'Expert', 'Good', 'Medium', 'High'],
        default: undefined,
    },
});

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    // Legacy field kept for backward compatibility during migration.
    karigarId: { type: String, unique: true, sparse: true },
    role: { type: String, required: true, enum: ['worker', 'client', 'admin'] },
    name: { type: String, required: true },
    age: { type: Number, min: 0 },
    dob: { type: Date },
    phoneType: { type: String, enum: ['Smartphone', 'Feature Phone'], default: 'Smartphone' },
    mobile: { type: String, required: true, unique: true },
    email: { type: String, unique: true, sparse: true, trim: true, default: null },
    password: { type: String, required: true, select: false },

    // Common
    photo: { type: String },
    address: {
        city: String, pincode: String, locality: String,
        homeLocation: String, houseNumber: String,
        fullAddress: String, village: String,
        latitude: Number, longitude: Number,
    },
    idProof: {
        idType: String,
        filePath: String,
        numberHash: { type: String, select: false },
        numberLast4: String,
    },

    // Worker fields
    aadharNumber: { type: String },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    skills: [skillSchema],
    overallExperience: { type: String, enum: ['Beginner', 'Intermediate', 'Expert'] },
    skillCertificates: [String],
    portfolioPhotos: [String],
    experience: { type: Number },
    expectedMinPay: { type: Number, default: 0, min: 0 },
    expectedMaxPay: { type: Number, default: 0, min: 0 },
    payoutPreference: {
        type: String,
        enum: ['upi', 'bank', ''],
        default: '',
    },
    payoutUpiId: { type: String, trim: true, default: '', select: false },
    payoutBankAccountNumber: { type: String, trim: true, default: '', select: false },
    payoutBankIfsc: { type: String, trim: true, default: '', uppercase: true, select: false },
    payoutAccountHolderName: { type: String, trim: true, default: '', select: false },
    travelMethod: {
        type: String,
        enum: ['cycle', 'bike', 'bus', 'other'],
        default: 'other',
    },
    preferredJobCategories: [{ type: String }],
    references: [referenceSchema],
    emergencyContact: { name: String, mobile: String },
    eShramNumber: { type: String },
    eShramCardPath: { type: String },
    education: { type: String },
    otherCertificates: [String],
    points: { type: Number, default: 0 },
    availability: { type: Boolean, default: true },
    verificationStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'blocked'],
        default: 'pending',
    },
    blockedAt: { type: Date, default: null },
    blockReason: { type: String, default: null, trim: true },
    reviewLock: {
        lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        lockedAt: { type: Date, default: null },
    },
    rejectedAt: { type: Date, default: undefined },
    rejectionReason: { type: String, default: null, trim: true, maxlength: 500 },

    // Client fields — Basic Security & Verification
    ageVerified: { type: Boolean, default: false },
    // Uses common `emergencyContact` field declared above
    proofOfResidence: { type: String }, // File path to uploaded utility bill/lease/bank statement
    secondaryIdType: { type: String }, // e.g., "PAN", "Voter", "Driving License"
    secondaryIdProof: { type: String }, // File path
    addressVerificationOtp: { type: String, select: false }, // OTP for address verification
    addressVerificationOtpExpiry: { type: Date, select: false },
    addressVerified: { type: Boolean, default: false },
    
    // Client fields — Profession & Intent
    profession: { type: String }, // e.g., "Homeowner", "Contractor", "Business Owner"
    signupReason: { 
        type: String, 
        enum: ['Home Service', 'Event', 'Business Project', 'Other', ''], 
        default: '' 
    },
    previousHiringExperience: { type: Boolean, default: null }, // true/false/null
    hriredThroughOtherPlatforms: { type: Boolean, default: null },
    
    // Client fields — Payment & Preferences
    preferredPaymentMethod: { 
        type: String, 
        enum: ['UPI', 'Card', 'Bank', 'Wallet', ''], 
        default: '' 
    },
    
    // Client fields — Device & Security
    deviceFingerprint: { type: String }, // IP + user-agent hash for fraud detection
    securityQuestion: { type: String }, // Custom security Q&A
    securityAnswer: { type: String, select: false },
    signupIpAddress: { type: String },
    signupUserAgent: { type: String },
    
    // Client fields — Optional Professional
    businessRegistrationNumber: { type: String },
    gstTaxId: { type: String },
    professionalCertification: { type: String },
    insuranceDetails: { type: String },
    referralClientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Existing client referral
    
    // Client fields — T&C Acceptance (separate checkboxes)
    termsPaymentAccepted: { type: Boolean, default: false },
    termsDisputePolicyAccepted: { type: Boolean, default: false },
    termsDataPrivacyAccepted: { type: Boolean, default: false },
    termsWorkerProtectionAccepted: { type: Boolean, default: false },

    // Payment lock for direct hire work: used to block selected client sections
    paymentLock: {
        active: { type: Boolean, default: false },
        sections: { type: [String], default: [] },
        jobIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Job' }],
        reason: { type: String, default: '' },
        updatedAt: { type: Date, default: null },
    },
    
    // Legacy fields
    workplaceInfo: { type: String },
    socialProfile: { type: String },
    starredWorkers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Face Verification
    faceEmbedding: { type: [Number], default: undefined, select: false },
    idFaceEmbedding: { type: [Number], default: undefined, select: false },
    faceVerified: { type: Boolean, default: false },
    faceVerificationScore: { type: Number, default: null },
    liveFacePhoto: { type: String, default: null },
    faceVerifiedAt: { type: Date, default: null },
    faceVerificationStatus: {
        type: String,
        enum: ['passed', 'failed', 'skipped', 'pending_review', 'duplicate_rejected'],
        default: null,
    },

    // Password Reset
    resetPasswordToken: String,
    resetPasswordExpire: Date,

    // Password-Change OTP Fields
    passwordChangeOtp: { type: String, select: false },
    passwordChangeOtpExpiry: { type: Date, select: false },
    passwordChangeVerifiedToken: { type: String, select: false },
    passwordChangeVerifiedTokenExpiry: { type: Date, select: false },

}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// ── VIRTUAL: leaderboard discount percentage (read-only, for frontend display) ─
// Mirrors couponController calcDiscount logic so workers can see their tier
// in the leaderboard / dashboard without hitting the coupon endpoint.
userSchema.virtual('leaderboardDiscount').get(function () {
    if (this.role !== 'worker') return 0;
    const pts = this.points || 0;
    // Note: completed jobs not available here (no join), so we use points only.
    // The actual coupon discount uses points + completedJobs*5 — this is just display.
    if (pts >= 200) return 20;
    if (pts >= 100) return 15;
    if (pts >= 50)  return 10;
    if (pts >= 25)  return 5;
    return 0;
});

// Keep userId and legacy karigarId in sync while migration is in progress.
userSchema.pre('validate', function (next) {
    if (!this.userId && this.karigarId) this.userId = this.karigarId;
    if (!this.karigarId && this.userId) this.karigarId = this.userId;
    next();
});

// CRITICAL: Hash password before saving to DB
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

userSchema.index({ rejectedAt: 1 }, { expireAfterSeconds: 1_296_000 });
userSchema.index({ faceVerificationStatus: 1, role: 1 });

module.exports = mongoose.model('User', userSchema);