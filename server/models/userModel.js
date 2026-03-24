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
    proficiency: {
        type: String,
        enum: ['Beginner', 'Intermediate', 'Expert', 'Good', 'Medium', 'High'],
        required: true,
    },
});

const userSchema = new mongoose.Schema({
    karigarId: { type: String, required: true, unique: true },
    role: { type: String, required: true, enum: ['worker', 'client', 'admin'] },
    name: { type: String, required: true },
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
    },
    idProof: {
        idType: String,
        filePath: String,
    },

    // Worker fields
    aadharNumber: { type: String },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    skills: [skillSchema],
    overallExperience: { type: String, enum: ['Beginner', 'Intermediate', 'Expert'] },
    skillCertificates: [String],
    portfolioPhotos: [String],
    experience: { type: Number },
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
    rejectedAt: { type: Date, default: undefined },
    rejectionReason: { type: String, default: null, trim: true, maxlength: 500 },

    // Client fields
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