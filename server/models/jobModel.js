// server/models/jobModel.js
// FIX: budgetBreakdown.breakdown complexity enum expanded to include
//      'low' and 'medium' — the AI sometimes returns these values.
//      Accepted values: 'low','light','medium','normal','heavy'
//      UI still shows light/normal/heavy (mapped in clientController sanitiser).

const mongoose = require('mongoose');

const applicantSchema = new mongoose.Schema({
    workerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    skill:     { type: String, default: '' },
    status:    { type: String, enum: ['pending','accepted','rejected'], default: 'pending' },
    workerCancelled: { type: Boolean, default: false },
    feedback:  { type: String, default: '' },
    appliedAt: { type: Date, default: Date.now },
});

const workerSlotSchema = new mongoose.Schema({
    skill:           { type: String, required: true },
    hoursEstimated:  { type: Number, default: 8, min: 0 },
    assignedWorker:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status:          { type: String, enum: ['open','filled','task_completed','cancelled','reposted'], default: 'open' },
    completedAt:     { type: Date, default: null },
    actualStartTime: { type: Date, default: null },
    actualEndTime:   { type: Date, default: null },
    ratingSubmitted: { type: Boolean, default: false },
    autoCompleted:   { type: Boolean, default: false },
    subTaskJobId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },
}, { _id: true });

const budgetBlockSchema = new mongoose.Schema({
    skill:          String,
    count:          { type: Number, default: 1,   min: 0 },
    hours:          { type: Number, default: 8,   min: 0 },
    baseRate:       { type: Number, default: 0,   min: 0 },
    // FIX: Added 'low' and 'medium' so AI responses don't fail validation.
    // clientController.sanitiseBudgetBreakdown() normalises these to
    // 'light' / 'normal' before saving, so the DB stays clean.
    complexity:     { type: String, enum: ['low','light','medium','normal','heavy'], default: 'normal' },
    complexityMult: { type: Number, default: 1.2, min: 0 },
    durationFactor: { type: Number, default: 1.0, min: 0 },
    subtotal:       { type: Number, default: 0,   min: 0 },
    description:    String,
}, { _id: false });

const budgetBreakdownSchema = new mongoose.Schema({
    city:           String,
    breakdown:      [budgetBlockSchema],
    subtotal:       { type: Number, default: 0,   min: 0 },
    urgent:         { type: Boolean, default: false },
    urgencyMult:    { type: Number, default: 1.0, min: 0 },
    totalEstimated: { type: Number, default: 0,   min: 0 },
    totalWorkers:   { type: Number, default: 1,   min: 0 },
}, { _id: false });

const qaSchema = new mongoose.Schema({ question: String, answer: String }, { _id: false });

const jobSchema = new mongoose.Schema({
    postedBy:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title:               { type: String, required: true },
    description:         { type: String, required: true },
    shortDescription:    String,
    detailedDescription: String,
    skills:              [{ type: String }],
    payment:             { type: Number, default: 0, min: 0 },
    negotiable:          { type: Boolean, default: false },
    minBudget:           { type: Number, default: 0, min: 0 },
    duration:            String,
    workersRequired:     { type: Number, default: 1, min: 1 },
    urgent:              { type: Boolean, default: false },
    location:            { city: String, pincode: String, locality: String, lat: Number, lng: Number, fullAddress: String },
    photos:              [String],
    completionPhotos:    [String],
    budgetBreakdown:     { type: budgetBreakdownSchema },
    totalEstimatedCost:  { type: Number, default: 0, min: 0 },
    qaAnswers:           { type: [qaSchema], default: [] },
    scheduledDate:       Date,
    scheduledTime:       String,
    shift:               String,
    actualStartTime:     Date,
    actualEndTime:       Date,
    visibility:          { type: Boolean, default: true },
    applicationsOpen:    { type: Boolean, default: true },
    workerSlots:         { type: [workerSlotSchema], default: [] },

    // ── Sub-task linking ──────────────────────────────────────────────────────
    parentJobId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },
    isSubTask:    { type: Boolean, default: false },
    subTaskSkill: { type: String, default: '' },

    // ── Notification flags ────────────────────────────────────────────────────
    preStartNotificationSent: { type: Boolean, default: false },
    clientNotifiedCompletion: { type: Boolean, default: false },

    status: {
        type: String,
        enum: ['open','proposal','scheduled','running','completed','cancelled_by_client','cancelled'],
        default: 'open',
    },
    cancelledBy:        { type: String, enum: ['client', null], default: null },
    cancellationReason: String,
    cancelledAt:        Date,
    cancelledWorkerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    applicants:         [applicantSchema],
    assignedTo:         [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    ratingsSubmitted:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    groupId:            { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
    responses:          [{
        karigar: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        status:  { type: String, enum: ['accepted','rejected'] },
        reason:  String,
    }],
}, { timestamps: true });

// Active slots = not open/cancelled/reposted
jobSchema.methods.allSlotsCompleted = function () {
    const active = this.workerSlots.filter(s => !['open','cancelled','reposted'].includes(s.status));
    if (!active.length) return false;
    return active.every(s => s.status === 'task_completed');
};
jobSchema.methods.allAssignedSlotsRated = function () {
    const assigned = this.workerSlots.filter(s =>
        s.assignedWorker && !['cancelled','open','reposted'].includes(s.status)
    );
    if (!assigned.length) return false;
    return assigned.every(s => s.ratingSubmitted);
};
jobSchema.methods.estimatedJobEndMs = function () {
    if (!this.actualStartTime) return null;
    const maxH = this.workerSlots.reduce((m, s) => Math.max(m, s.hoursEstimated || 0), 0) || 8;
    return new Date(this.actualStartTime).getTime() + maxH * 3600 * 1000;
};
// Skills still open (unfilled, not reposted, not cancelled)
jobSchema.methods.unfilledSkills = function () {
    return [...new Set(this.workerSlots.filter(s => s.status === 'open').map(s => s.skill))];
};

module.exports = mongoose.model('Job', jobSchema);