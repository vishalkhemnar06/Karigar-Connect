const mongoose = require('mongoose');

const siteVisitorSchema = new mongoose.Schema({
    visitorId: { type: String, required: true, unique: true, index: true },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    landingPath: { type: String, default: '/home' },
    referrer: { type: String, default: null },
    userAgent: { type: String, default: null },
}, { timestamps: true });

siteVisitorSchema.index({ lastSeenAt: -1 });

module.exports = mongoose.model('SiteVisitor', siteVisitorSchema, 'sitevisitors');
