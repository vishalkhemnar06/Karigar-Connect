const mongoose = require('mongoose');

const ivrUnregisteredLeadSchema = new mongoose.Schema({
    phone: { type: String, required: true, unique: true, index: true },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    callsCount: { type: Number, default: 1 },
    registrationSmsSentCount: { type: Number, default: 0 },
    lastRegistrationSmsAt: { type: Date, default: null },
    campaignEligible: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('IvrUnregisteredLead', ivrUnregisteredLeadSchema);
