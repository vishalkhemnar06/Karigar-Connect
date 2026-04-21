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
    applicationSource: { type: String, enum: ['web', 'ivr'], default: 'web' },
    workerCancelled: { type: Boolean, default: false },
    feedback:  { type: String, default: '' },
    quotedPrice: { type: Number, default: 0, min: 0 },
    quoteRate: { type: Number, default: 0, min: 0 },
    quoteBasis: { type: String, default: '' },
    quoteQuantity: { type: Number, default: 0, min: 0 },
    quotedAt: { type: Date, default: null },
    appliedAt: { type: Date, default: Date.now },
});

const invitedWorkerSchema = new mongoose.Schema({
    workerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    inviteSkill: { type: String, default: '' },
    inviteSlotId: { type: mongoose.Schema.Types.ObjectId, default: null },
    invitedAt: { type: Date, default: Date.now },
}, { _id: false });

const workerSlotSchema = new mongoose.Schema({
    skill:           { type: String, required: true },
    hoursEstimated:  { type: Number, default: 8, min: 0 },
    assignedWorker:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status:          { type: String, enum: ['open','filled','task_completed','cancelled','reposted'], default: 'open' },
    completedAt:     { type: Date, default: null },
    actualStartTime: { type: Date, default: null },
    actualEndTime:   { type: Date, default: null },
    finalPaidPrice:  { type: Number, default: 0, min: 0 },
    ratingSubmitted: { type: Boolean, default: false },
    autoCompleted:   { type: Boolean, default: false },
    subTaskJobId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },
}, { _id: true });

const budgetBlockSchema = new mongoose.Schema({
    skill:          String,
    count:          { type: Number, default: 1,   min: 0 },
    hours:          { type: Number, default: 8,   min: 0 },
    baseRate:       { type: Number, default: 0,   min: 0 },
    rateInputMode:  { type: String, default: '' },
    sourceRatePerHourBase: { type: Number, default: 0, min: 0 },
    sourceRatePerDayBase:  { type: Number, default: 0, min: 0 },
    sourceRatePerVisitBase:{ type: Number, default: 0, min: 0 },
    ratePerHourBase:       { type: Number, default: 0, min: 0 },
    ratePerDayBase:        { type: Number, default: 0, min: 0 },
    ratePerVisitBase:      { type: Number, default: 0, min: 0 },
    ratePerHour:           { type: Number, default: 0, min: 0 },
    ratePerDay:            { type: Number, default: 0, min: 0 },
    ratePerVisit:          { type: Number, default: 0, min: 0 },
    perWorkerCostBase:     { type: Number, default: 0, min: 0 },
    perWorkerCost:         { type: Number, default: 0, min: 0 },
    appliedDemandMultiplier: { type: Number, default: 1, min: 0 },
    priceSource:           { type: String, default: '' },
    // FIX: Added 'low' and 'medium' so AI responses don't fail validation.
    // clientController.sanitiseBudgetBreakdown() normalises these to
    // 'light' / 'normal' before saving, so the DB stays clean.
    complexity:     { type: String, enum: ['low','light','medium','normal','heavy'], default: 'normal' },
    complexityMult: { type: Number, default: 1.2, min: 0 },
    durationFactor: { type: Number, default: 1.0, min: 0 },
    subtotal:       { type: Number, default: 0,   min: 0 },
    negotiationAmount: { type: Number, default: 0, min: 0 },
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

const directHireSchema = new mongoose.Schema({
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    workerPhoneType: { type: String, enum: ['Smartphone', 'Feature Phone', ''], default: '' },
    serviceLabel: { type: String, default: '' },
    durationValue: { type: Number, default: 1, min: 1 },
    durationUnit: { type: String, enum: ['/hour', '/day', '/visit', 'hour', 'day', 'visit', ''], default: '' },
    expectedStartAt: { type: Date, default: null },
    expectedEndAt: { type: Date, default: null },
    fetchedAmount: { type: Number, default: 0, min: 0 },
    amountEditLimitPercent: { type: Number, default: 20, min: 0, max: 100 },
    minEditableAmount: { type: Number, default: 0, min: 0 },
    maxEditableAmount: { type: Number, default: 0, min: 0 },
    fetchedRateSource: { type: String, default: '' },
    fetchedAt: { type: Date, default: null },
    fetchedBaseAmount: { type: Number, default: 0, min: 0 },
    appliedDemandMultiplier: { type: Number, default: 1, min: 0 },
    expectedAmount: { type: Number, default: 0, min: 0 },
    paymentMode: { type: String, enum: ['cash', 'online', 'upi', 'bank_transfer', ''], default: '' },
    oneLineJD: { type: String, default: '' },
    callIntentAt: { type: Date, default: null },
    callIntentCount: { type: Number, default: 0, min: 0 },
    requestSentAt: { type: Date, default: null },
    requestSmsSentAt: { type: Date, default: null },
    requestStatus: { type: String, enum: ['draft', 'requested', 'accepted', 'rejected', 'cancelled'], default: 'draft' },
    requestReason: { type: String, default: '' },
    requestRejectedReason: { type: String, default: '' },
    requestRejectedAt: { type: Date, default: null },
    startOtpHash: { type: String, default: '' },
    startOtpExpiry: { type: Date, default: null },
    startOtpAttempts: { type: Number, default: 0, min: 0 },
    startOtpVerifiedAt: { type: Date, default: null },
    completionOtpHash: { type: String, default: '' },
    completionOtpExpiry: { type: Date, default: null },
    completionOtpAttempts: { type: Number, default: 0, min: 0 },
    completionOtpVerifiedAt: { type: Date, default: null },
    workerPaymentApprovalStatus: { type: String, enum: ['pending', 'approved', 'disputed'], default: 'pending' },
    paymentStatus: { type: String, enum: ['pending', 'partial', 'paid', 'disputed'], default: 'pending' },
    paymentAmount: { type: Number, default: 0, min: 0 },
    paymentEditAllowed: { type: Boolean, default: true },
    paymentEditReason: { type: String, default: '' },
    paymentConfirmedAt: { type: Date, default: null },
    paymentReminder30SentAt: { type: Date, default: null },
    paymentReminder60SentAt: { type: Date, default: null },
    adminEscalatedAt: { type: Date, default: null },
    blockedSections: { type: [String], default: [] },
    clientLockAppliedAt: { type: Date, default: null },
    clientUnlockedAt: { type: Date, default: null },
}, { _id: false });

const qaSchema = new mongoose.Schema({ question: String, answer: String }, { _id: false });

const jobSchema = new mongoose.Schema({
    postedBy:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title:               { type: String, required: true },
    category:            { type: String, default: '' },
    description:         { type: String, required: true },
    shortDescription:    String,
    detailedDescription: String,
    skills:              [{ type: String }],
    payment:             { type: Number, default: 0, min: 0 },
    paymentMethod:       {
        type: String,
        enum: ['cash', 'upi_qr', 'bank_transfer', 'flexible'],
        default: 'flexible',
    },
    negotiable:          { type: Boolean, default: false },
    minBudget:           { type: Number, default: 0, min: 0 },
    duration:            String,
    experienceRequired:  { type: String, default: '' },
    workersRequired:     { type: Number, default: 1, min: 1 },
    urgent:              { type: Boolean, default: false },
    location:            {
        city: String,
        pincode: String,
        locality: String,
        state: String,
        lat: Number,
        lng: Number,
        fullAddress: String,
        buildingName: String,
        unitNumber: String,
        floorNumber: String,
    },
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

    // ── PRICING INTELLIGENCE (Ground Truth for Learning) ─────────────────────────
    pricingMeta: {
        // Task characterization
        taskType:           { type: String, default: '' },        // e.g., 'wall_paint', 'pipe_installation'
        quantity:           { type: Number, default: 1 },         // dimension of work
        unit:               { type: String, default: '' },        // 'sqft', 'meters', 'points', 'visit'
        
        // Time tracking
        estimatedHours:     { type: Number, default: 0 },         // from estimate
        actualHours:        { type: Number, default: 0 },         // computed from actualStartTime/actualEndTime
        
        // Pricing ground truth (CRITICAL for learning)
        workerQuotedPrice:  { type: Number, default: 0 },         // what workers asked for
        finalPaidPrice:     { type: Number, default: 0 },         // what was actually paid (MOST IMPORTANT)
        skillFinalPaid:     {
            type: [{
                slotId:   { type: mongoose.Schema.Types.ObjectId, default: null },
                skill:    { type: String, default: '' },
                workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
                amount:   { type: Number, default: 0 },
            }],
            default: [],
        },
        
        // Market factors
        demandSupplyRatio:  { type: Number, default: 1.0 },       // (activeJobs / activeWorkers) at time of job
        
        // Source and confidence
        priceSource:        { type: String, enum: ['ai', 'manual', 'historical', ''], default: '' },
        confidenceScore:    { type: Number, min: 0, max: 1, default: 0 },
        
        // Tracking
        capturedAt:         { type: Date, default: null },        // when this data was finalized
    },
    
    
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
    noApplicantWarningSent:   { type: Boolean, default: false },
    archivedByClient:         { type: Boolean, default: false },
    archivedAt:               { type: Date, default: null },

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
    invitedWorkers:     { type: [invitedWorkerSchema], default: [] },
    hireMode:           { type: String, enum: ['posted', 'direct'], default: 'posted' },
    directHire:         { type: directHireSchema, default: () => ({}) },
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