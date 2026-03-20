const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    role: { type: String, default: null },
    action: { type: String, required: true, index: true },
    ipAddress: { type: String, default: null, index: true },
    userAgent: { type: String, default: null },
    deviceFingerprint: { type: String, default: null },
    locationFingerprint: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

auditLogSchema.index({ userId: 1, action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema, 'auditlogs');