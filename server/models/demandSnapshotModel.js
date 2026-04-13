const mongoose = require('mongoose');

const demandSnapshotSchema = new mongoose.Schema({
    skillKey:           { type: String, required: true, lowercase: true },
    cityKey:            { type: String, required: true, lowercase: true },
    
    // Snapshot counters
    activeJobs:         { type: Number, default: 0 },      // open/scheduled/running jobs
    activeWorkers:      { type: Number, default: 0 },      // verified workers with this skill
    
    // Derived ratio
    ratio:              { type: Number, default: 1.0 },    // activeJobs / activeWorkers (clamped to reasonable range)
    
    // Timestamps
    capturedAt:         { type: Date, default: Date.now },
    lastCalculatedAt:   { type: Date, default: Date.now },
    
    // Metadata for analytics
    isStale:            { type: Boolean, default: false },
}, { timestamps: false });

// Index for quick lookups
demandSnapshotSchema.index({ skillKey: 1, cityKey: 1, capturedAt: -1 });
demandSnapshotSchema.index({ capturedAt: -1 });  // Latest snapshots

module.exports = mongoose.model('DemandSnapshot', demandSnapshotSchema);
