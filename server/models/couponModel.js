// server/models/couponModel.js
const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    worker:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    code:        { type: String, required: true, unique: true, uppercase: true },
    discountPct: { type: Number, required: true },          // e.g. 10 = 10%
    expiresAt:   { type: Date, required: true },            // 7 days from creation
    isUsed:      { type: Boolean, default: false },
    usedAt:      { type: Date },
    usedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' }, // shop that redeemed
    // Month-year for "one per month" enforcement   e.g. "2025-06"
    monthKey:    { type: String, required: true },
}, { timestamps: true });

// Auto-expire index — MongoDB removes doc 7 days after expiresAt
couponSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Coupon', couponSchema);