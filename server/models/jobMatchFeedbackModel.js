const mongoose = require('mongoose');

const jobMatchFeedbackSchema = new mongoose.Schema({
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    event: {
        type: String,
        enum: ['viewed', 'invited', 'applied', 'hired', 'completed', 'rejected'],
        required: true,
    },
    source: { type: String, default: 'api' },
    actorRole: { type: String, enum: ['client', 'worker', 'admin', 'system'], default: 'system' },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

jobMatchFeedbackSchema.index({ jobId: 1, workerId: 1, event: 1, createdAt: -1 });

module.exports = mongoose.model('JobMatchFeedback', jobMatchFeedbackSchema);
