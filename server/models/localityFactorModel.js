const mongoose = require('mongoose');

const localityFactorSchema = new mongoose.Schema({
    cityKey:            { type: String, required: true, lowercase: true },
    locality:           { type: String, required: true },
    localityKey:        { type: String, lowercase: true },  // normalized locality identifier
    
    // Multiplier to apply to city base rates
    // e.g., 0.8 = 20% cheaper, 1.2 = 20% more expensive
    multiplier:         { type: Number, default: 1.0, min: 0.5, max: 2.0 },
    
    // How many jobs in this locality influenced this factor
    dataPoints:         { type: Number, default: 0 },
    
    // Confidence of this multiplier (0-1)
    confidence:         { type: Number, min: 0, max: 1, default: 0 },
    
    // Timestamps
    lastUpdated:        { type: Date, default: Date.now },
    
    // Status
    isActive:           { type: Boolean, default: true },
}, { timestamps: true });

// Index for quick lookups
localityFactorSchema.index({ cityKey: 1, localityKey: 1, isActive: 1 });
localityFactorSchema.index({ cityKey: 1 });

module.exports = mongoose.model('LocalityFactor', localityFactorSchema);
