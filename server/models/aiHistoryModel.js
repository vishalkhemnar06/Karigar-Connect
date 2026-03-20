// server/models/aiHistoryModel.js
// UPDATED: stores full advisor report + title, notes, clientBudget, opinions
const mongoose = require('mongoose');

const aiHistorySchema = new mongoose.Schema({
    userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Editable by client
    title:           { type: String, default: '' },   // editable display name
    notes:           { type: String, default: '' },   // client's own notes

    // Input
    workDescription: { type: String, default: '' },
    city:            { type: String, default: '' },
    urgent:          { type: Boolean, default: false },
    clientBudget:    { type: Number, default: null },  // client's stated budget
    answers:         { type: mongoose.Schema.Types.Mixed, default: {} }, // Q&A map
    opinions:        { type: mongoose.Schema.Types.Mixed, default: {} }, // color/style prefs

    // Full report (entire API response stored as-is)
    report:          { type: mongoose.Schema.Types.Mixed, default: null },

    // Legacy fields (kept for backward compat)
    durationDays:    { type: Number, default: null },
    budgetBreakdown: { type: mongoose.Schema.Types.Mixed, default: null },
    recommendation:  { type: String, default: '' },
}, { timestamps: true });

aiHistorySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('AIHistory', aiHistorySchema);
