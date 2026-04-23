const mongoose = require('mongoose');

const rateUpdateLogSchema = new mongoose.Schema({
    // Type of update: 'market_rate' or 'base_rate_csv'
    updateType: {
        type: String,
        enum: ['market_rate', 'base_rate_csv'],
        required: true,
    },

    // Admin who triggered this update
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },

    // Status of the update
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'success', 'failed'],
        default: 'pending',
    },

    // Number of rows updated
    rowsProcessed: {
        type: Number,
        default: 0,
    },

    // Details/error message
    details: String,
    error: String,

    // CSV file details (for base_rate_csv only)
    csvFileName: String,
    csvFilePath: String,
    csvRowCount: Number,

    // Timestamp
    triggeredAt: {
        type: Date,
        default: Date.now,
    },
    completedAt: Date,
    durationMs: Number,

    // IP and user agent for audit
    adminIpAddress: String,
    adminUserAgent: String,
}, { timestamps: true });

// Index for quick lookups
rateUpdateLogSchema.index({ updateType: 1, adminId: 1, triggeredAt: -1 });
rateUpdateLogSchema.index({ updateType: 1, status: 1, triggeredAt: -1 });
rateUpdateLogSchema.index({ triggeredAt: -1 });

module.exports = mongoose.model('RateUpdateLog', rateUpdateLogSchema);
