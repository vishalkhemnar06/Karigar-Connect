const mongoose = require('mongoose');

const skillPreferenceSchema = new mongoose.Schema({
    skillName:      { type: String, required: true, trim: true },
    preferenceRank: { type: Number, required: true, min: 1, max: 3 },
    hourlyPrice:    { type: Number, default: 0, min: 0 },
    dailyPrice:     { type: Number, default: 0, min: 0 },
    visitPrice:     { type: Number, default: 0, min: 0 },
}, { _id: false });

const liveLocationSchema = new mongoose.Schema({
    latitude:   { type: Number, default: null },
    longitude:  { type: Number, default: null },
    updatedAt:  { type: Date, default: null },
    source:     { type: String, default: 'manual' },
}, { _id: false });

const workerDailyProfileSchema = new mongoose.Schema({
    workerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true,
    },
    karigarId: { type: String, default: '', index: true },
    skillRates: { type: [skillPreferenceSchema], default: [] },
    liveLocation: { type: liveLocationSchema, default: () => ({}) },
    travelMethod: {
        type: String,
        enum: ['cycle', 'motorcycle', 'bus', 'lift', 'other'],
        default: 'other',
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'online', 'flexible'],
        default: 'flexible',
    },
    phoneType: {
        type: String,
        enum: ['Smartphone', 'Traditional old button phone', 'No phone'],
        default: 'Smartphone',
    },
    isComplete: { type: Boolean, default: false },
    lastUpdatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

workerDailyProfileSchema.index({ workerId: 1 });
workerDailyProfileSchema.index({ karigarId: 1 });

module.exports = mongoose.model('WorkerDailyProfile', workerDailyProfileSchema);