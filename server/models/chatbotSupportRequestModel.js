const mongoose = require('mongoose');

const chatbotSupportMessageSchema = new mongoose.Schema({
    senderType: {
        type: String,
        enum: ['client', 'admin', 'system'],
        required: true,
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    senderName: {
        type: String,
        default: null,
    },
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, { _id: false });

const chatbotSupportRequestSchema = new mongoose.Schema({
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    clientName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
    },
    clientMobile: {
        type: String,
        required: true,
        trim: true,
        maxlength: 30,
    },
    currentRoute: {
        type: String,
        default: '/client/dashboard',
        trim: true,
        maxlength: 120,
    },
    initialMessage: {
        type: String,
        default: '',
        trim: true,
        maxlength: 1200,
    },
    conversationSnapshot: {
        type: [{
            role: { type: String, enum: ['user', 'bot', 'admin', 'system'], required: true },
            text: { type: String, required: true, trim: true, maxlength: 1200 },
        }],
        default: [],
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'closed', 'expired'],
        default: 'pending',
        index: true,
    },
    requestedAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
    expiresAt: {
        type: Date,
        required: true,
        index: true,
    },
    acceptedAt: {
        type: Date,
        default: null,
    },
    connectionStartedAt: {
        type: Date,
        default: null,
    },
    closedAt: {
        type: Date,
        default: null,
    },
    closedByAdminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    closedReason: {
        type: String,
        default: null,
        maxlength: 180,
    },
    connectionDurationSeconds: {
        type: Number,
        default: 0,
        min: 0,
    },
    acceptedByAdmin: {
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        adminName: { type: String, default: null, trim: true, maxlength: 120 },
        adminMobile: { type: String, default: null, trim: true, maxlength: 30 },
    },
    rejectedByAdmins: {
        type: [{
            adminId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                default: null,
            },
            adminName: { type: String, default: null, trim: true, maxlength: 120 },
            adminMobile: { type: String, default: null, trim: true, maxlength: 30 },
            rejectedAt: { type: Date, default: Date.now },
        }],
        default: [],
    },
    lastClientMessageAt: {
        type: Date,
        default: null,
    },
    lastAdminMessageAt: {
        type: Date,
        default: null,
    },
    lastActivityAt: {
        type: Date,
        default: null,
    },
    messages: {
        type: [chatbotSupportMessageSchema],
        default: [],
    },
}, { timestamps: true });

chatbotSupportRequestSchema.index({ clientId: 1, status: 1, requestedAt: -1 });
chatbotSupportRequestSchema.index({ status: 1, requestedAt: -1 });
chatbotSupportRequestSchema.index({ 'acceptedByAdmin.adminId': 1, status: 1 });

module.exports = mongoose.model('ChatbotSupportRequest', chatbotSupportRequestSchema);
