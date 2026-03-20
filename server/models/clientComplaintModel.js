// server/models/clientComplaintModel.js
const mongoose = require('mongoose');

const clientComplaintSchema = new mongoose.Schema({
    filedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    againstWorker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    relatedJob: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
        default: null,
    },
    category: {
        type: String,
        required: true,
        enum: [
            'Poor Quality Work',
            'Unprofessional Behavior',
            'Did Not Show Up',
            'Damaged Property',
            'Overcharged / Fraud',
            'Harassment',
            'Other',
        ],
    },
    description: {
        type: String,
        required: true,
        minlength: 20,
        maxlength: 2000,
    },
    status: {
        type: String,
        enum: ['submitted', 'in-review', 'action-taken', 'resolved', 'dismissed', 'blocked'],
        default: 'submitted',
    },
    adminNotes: {
        type: String,
        default: null,
    },
    adminAction: {
        type: String,
        enum: ['warned', 'blocked', 'cleared', 'dismissed', null],
        default: null,
    },
    actionTakenAt: {
        type: Date,
        default: null,
    },
    // Optional — not set when admin token has no real ObjectId
    actionTakenBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        required: false,
    },
}, { timestamps: true });

clientComplaintSchema.index({ againstWorker: 1, status: 1 });
clientComplaintSchema.index({ filedBy: 1, createdAt: -1 });

module.exports = mongoose.model('ClientComplaint', clientComplaintSchema);