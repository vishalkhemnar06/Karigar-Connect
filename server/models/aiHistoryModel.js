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
    locality:        { type: String, default: '' },
    urgent:          { type: Boolean, default: false },
    includeTravelCost: { type: Boolean, default: false },
    clientBudget:    { type: Number, default: null },  // client's stated budget
    answers:         { type: mongoose.Schema.Types.Mixed, default: {} }, // Q&A map
    opinions:        { type: mongoose.Schema.Types.Mixed, default: {} }, // color/style prefs
    answersById:     { type: mongoose.Schema.Types.Mixed, default: {} },
    preferencesById: { type: mongoose.Schema.Types.Mixed, default: {} },
    questionSet:     { type: [mongoose.Schema.Types.Mixed], default: [] },
    preferenceQuestionSet: { type: [mongoose.Schema.Types.Mixed], default: [] },

    // Date & Time (for demand-based pricing)
    jobDate:         { type: Date, default: null },
    jobStartTime:    { type: String, default: '' },  // HH:MM format, 6 AM to 9 PM
    jobEndTime:      { type: String, default: '' },  // calculated
    dayType:         { type: String, enum: ['weekday', 'weekend', 'holiday', 'festival'], default: 'weekday' },
    timePeriod:      { type: String, enum: ['morning', 'afternoon', 'evening', 'night'], default: 'morning' },
    festival:        { type: String, default: '' },  // festival name if applicable
    seasonInfo:      { type: String, default: '' },  // monsoon, summer, winter, etc.

    // Demand multipliers applied
    demandMultipliers: { type: mongoose.Schema.Types.Mixed, default: {
        weekendMultiplier: 1.0,
        timeMultiplier: 1.0,
        holidayAndFestivalMultiplier: 1.0,
        urgencyMultiplier: 1.0,
        finalMultiplier: 1.0,
    }},

    // Full report (entire API response stored as-is)
    report:          { type: mongoose.Schema.Types.Mixed, default: null },

    // Legacy fields (kept for backward compat)
    durationDays:    { type: Number, default: null },
    budgetBreakdown: { type: mongoose.Schema.Types.Mixed, default: null },
    recommendation:  { type: String, default: '' },
}, { timestamps: true });

aiHistorySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('AIHistory', aiHistorySchema);
