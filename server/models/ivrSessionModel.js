const mongoose = require('mongoose');

const ivrEventSchema = new mongoose.Schema({
    at: { type: Date, default: Date.now },
    type: {
        type: String,
        enum: [
            'call_started',
            'language_selected',
            'menu_selected',
            'job_mode_selected',
            'job_presented',
            'job_applied',
            'application_cancelled',
            'sms_sent',
            'invalid_input',
            'stt_success',
            'stt_failed',
            'intent_success',
            'intent_failed',
            'call_ended',
            'system_error',
        ],
        required: true,
    },
    detail: { type: String, default: '' },
    data: { type: mongoose.Schema.Types.Mixed, default: undefined },
}, { _id: false });

const ivrSessionSchema = new mongoose.Schema({
    provider: { type: String, default: 'twilio' },
    callSid: { type: String, required: true, unique: true, index: true },
    phone: { type: String, required: true, index: true },
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    registered: { type: Boolean, default: false },
    workerApproved: { type: Boolean, default: false },
    language: { type: String, enum: ['hi', 'mr', 'en'], default: 'hi' },
    state: { type: String, default: 'entry' },
    retries: { type: Number, default: 0 },
    transcript: { type: String, default: '' },
    intent: {
        skill: { type: String, default: '' },
        location: { type: String, default: '' },
    },
    defaultLocation: {
        city: { type: String, default: '' },
        pincode: { type: String, default: '' },
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
    },
    presentedJobIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Job' }],
    cursor: { type: Number, default: 0 },
    selectedJobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },
    ended: { type: Boolean, default: false },
    endReason: { type: String, default: '' },
    events: { type: [ivrEventSchema], default: [] },
}, { timestamps: true });

ivrSessionSchema.index({ phone: 1, createdAt: -1 });

module.exports = mongoose.model('IvrSession', ivrSessionSchema);
