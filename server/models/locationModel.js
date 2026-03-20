// server/models/locationModel.js
// Stores real-time worker location + static client location per booking/job
// ADD this file to your server/models/ directory

const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
        required: true,
        index: true,
    },
    workerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },

    // Worker live location — updated continuously from worker's device GPS
    workerLocation: {
        lat:       { type: Number, default: null },
        lng:       { type: Number, default: null },
        accuracy:  { type: Number, default: null },   // meters
        heading:   { type: Number, default: null },   // degrees 0-360
        speed:     { type: Number, default: null },   // m/s
        updatedAt: { type: Date,   default: null },
    },

    // Client static location — captured ONCE at confirmation, never moves after
    clientLocation: {
        lat:        { type: Number, default: null },
        lng:        { type: Number, default: null },
        address:    { type: String, default: '' },
        capturedAt: { type: Date,   default: null },
    },

    // Tracking session state
    workerSharingActive: { type: Boolean, default: false },
    trackingEnabled:     { type: Boolean, default: true },
    jobStatus:           { type: String,  default: 'scheduled' },

}, { timestamps: true });

// Unique per job+worker pair
locationSchema.index({ jobId: 1, workerId: 1 }, { unique: true });

module.exports = mongoose.model('Location', locationSchema);