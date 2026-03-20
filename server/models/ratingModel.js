// server/models/ratingModel.js
// KEY CHANGE: Unique index is now (jobId + client + worker + skill)
// This allows a single worker assigned to PAINTER + ELECTRICIAN slots
// to receive TWO separate ratings — one per skill — without conflict.

const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
    jobId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Job',  required: true },
    client:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    worker:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    skill:      { type: String, default: 'general' }, // which skill/slot this rating is for
    slotId:     { type: mongoose.Schema.Types.ObjectId, default: null }, // reference to workerSlot._id
    stars:      { type: Number, min: 1, max: 5, default: 5 },
    points:     { type: Number, min: 20, max: 100, default: 50 },
    message:    { type: String, default: '' },
    workPhotos: [{ type: String }],
}, { timestamps: true });

// Unique per job + client + worker + skill combination
// Allows same worker to be rated separately for different skills in the same job
ratingSchema.index({ jobId: 1, client: 1, worker: 1, skill: 1 }, { unique: true });

module.exports = mongoose.model('Rating', ratingSchema);
