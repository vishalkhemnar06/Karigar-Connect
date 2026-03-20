// models/complaintModel.js — no changes needed, clean original
const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
    filedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: {
        type: String,
        required: true,
        enum: ['Platform', 'Client', 'Data', 'Other'],
    },
    description:   { type: String, required: true },
    status: {
        type: String,
        enum: ['submitted', 'in-review', 'resolved'],
        default: 'submitted',
    },
    adminResponse: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Complaint', complaintSchema);