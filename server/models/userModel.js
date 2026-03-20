// server/models/userModel.js
const mongoose = require('mongoose');

const referenceSchema = new mongoose.Schema({
    name:    { type: String },
    contact: { type: String },
});

const skillSchema = new mongoose.Schema({
    name:        { type: String, required: true },
    proficiency: {
        type: String,
        enum: ['Beginner', 'Intermediate', 'Expert', 'Good', 'Medium', 'High'],
        required: true,
    },
});

const userSchema = new mongoose.Schema({
    karigarId: { type: String, required: true, unique: true },
    role:      { type: String, required: true, enum: ['worker', 'client', 'admin'] },
    name:      { type: String, required: true },
    dob:       { type: Date },
    phoneType: { type: String, enum: ['Smartphone', 'Feature Phone'], default: 'Smartphone' },
    mobile:    { type: String, required: true, unique: true },
    email:     { type: String, unique: true, sparse: true, trim: true, default: null },
    password:  { type: String, required: true },

    // Common
    photo: { type: String },
    address: {
        city: String, pincode: String, locality: String,
        homeLocation: String, houseNumber: String,
    },
    idProof: {
        idType:   String,
        filePath: String,
    },

    // Worker fields
    aadharNumber:      { type: String },
    gender:            { type: String, enum: ['Male', 'Female', 'Other'] },
    skills:            [skillSchema],
    overallExperience: { type: String, enum: ['Beginner', 'Intermediate', 'Expert'] },
    skillCertificates: [String],
    portfolioPhotos:   [String],
    experience:        { type: Number },
    references:        [referenceSchema],
    emergencyContact:  { name: String, mobile: String },
    eShramNumber:      { type: String },
    eShramCardPath:    { type: String },
    education:         { type: String },
    otherCertificates: [String],
    points:            { type: Number, default: 0 },
    availability:      { type: Boolean, default: true },
    verificationStatus:{
        type: String,
        enum: ['pending', 'approved', 'rejected', 'blocked'],
        default: 'pending',
    },
    rejectedAt: { type: Date, default: undefined },

    // Client fields
    workplaceInfo:  { type: String },
    socialProfile:  { type: String },
    starredWorkers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // ── Face Verification Fields ──────────────────────────────────────────────
    // ArcFace 512-dim embedding of the live face captured during registration.
    // Used for: workers → similarity with ID card, clients → duplicate detection.
    faceEmbedding:      { type: [Number], default: undefined, select: false },

    // ArcFace embedding extracted from the uploaded ID card (workers only)
    idFaceEmbedding:    { type: [Number], default: undefined, select: false },

    // Whether the live-face ↔ ID-card similarity check passed (workers)
    // For clients: whether liveness passed with no duplicate found
    faceVerified:           { type: Boolean, default: false },

    // Cosine similarity score between ID face and live face (workers only; 0–1)
    faceVerificationScore:  { type: Number, default: null },

    // Cloudinary URL of the live face photo captured during registration
    liveFacePhoto:          { type: String, default: null },

    // ISO timestamp of when face verification was performed
    faceVerifiedAt:         { type: Date, default: null },

    // Human-readable result: 'passed' | 'failed' | 'skipped' | 'pending_review'
    faceVerificationStatus: {
        type: String,
        enum: ['passed', 'failed', 'skipped', 'pending_review', 'duplicate_rejected'],
        default: null,
    },

    // Password Reset
    resetPasswordToken:  String,
    resetPasswordExpire: Date,

}, { timestamps: true });

// TTL: auto-delete rejected workers 15 days after rejectedAt
userSchema.index({ rejectedAt: 1 }, { expireAfterSeconds: 1_296_000 });

// Index on faceVerificationStatus so admin can quickly find workers needing review
userSchema.index({ faceVerificationStatus: 1, role: 1 });

module.exports = mongoose.model('User', userSchema);
