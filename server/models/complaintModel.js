// server/models/complaintModel.js
// ENHANCED:
//   - type: 'complaint' (against a client) | 'support' (platform help request)
//   - againstUser: optional ref to the client being complained about
//   - messages[]: threaded conversation between worker and admin
//   - priority: low | medium | high (auto-set based on type, admin can override)
//   - resolvedAt: timestamp when resolved
//
// Backwards compatible — all old fields preserved.

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender:     { type: String, enum: ['worker', 'admin'], required: true },
    senderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    senderName: { type: String, default: '' },
    text:       { type: String, required: true, trim: true },
    sentAt:     { type: Date, default: Date.now },
    read:       { type: Boolean, default: false },
}, { _id: true });

const complaintSchema = new mongoose.Schema({
    // Who filed it
    filedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Type of ticket
    type: {
        type:    String,
        enum:    ['complaint', 'support'],
        default: 'complaint',
    },

    // Category (original field — kept as-is)
    category: {
        type:     String,
        required: true,
        enum:     ['Platform', 'Client', 'Payment', 'Safety', 'Technical', 'Other'],
    },

    // Optional: the client being complained about
    againstUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'User',
        default: null,
    },
    againstUserName: { type: String, default: '' }, // snapshot at filing time

    // Main description (original field — kept)
    description: { type: String, required: true, trim: true },

    // Status (original field — kept)
    status: {
        type:    String,
        enum:    ['submitted', 'in-review', 'resolved', 'closed'],
        default: 'submitted',
    },

    // Priority
    priority: {
        type:    String,
        enum:    ['low', 'medium', 'high'],
        default: 'medium',
    },

    // Admin's top-level response (original field — kept for compatibility)
    adminResponse: { type: String, default: '' },

    // Message thread — worker ↔ admin conversation
    messages: { type: [messageSchema], default: [] },

    // Admin who handled it
    handledBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },

    // Worker unread count (how many admin messages the worker hasn't seen)
    workerUnread: { type: Number, default: 0 },
    // Admin unread count
    adminUnread:  { type: Number, default: 0 },

}, { timestamps: true });

// Indexes for fast queries
complaintSchema.index({ filedBy: 1, createdAt: -1 });
complaintSchema.index({ status: 1, type: 1, createdAt: -1 });
complaintSchema.index({ againstUser: 1 });

module.exports = mongoose.model('Complaint', complaintSchema);