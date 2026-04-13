const mongoose = require('mongoose');

const marketRateSchema = new mongoose.Schema({
    skillKey:           { type: String, required: true, lowercase: true },
    cityKey:            { type: String, required: true, lowercase: true },
    
    // Percentile prices from completed jobs (actual paid prices)
    p50:                { type: Number, default: 0 },  // Median
    p75:                { type: Number, default: 0 },  // 75th percentile
    p90:                { type: Number, default: 0 },  // 90th percentile
    
    // Average hours for this skill in city
    avgHours:           { type: Number, default: 0 },
    
    // Number of completed jobs used to calculate these stats
    dataPoints:         { type: Number, default: 0 },
    
    // Confidence score based on data richness
    confidence:         { type: Number, min: 0, max: 1, default: 0 },
    
    // Timestamps
    lastUpdated:        { type: Date, default: Date.now },
    calculatedAt:       { type: Date, default: Date.now },
    
    // Metadata
    isActive:           { type: Boolean, default: true },
}, { timestamps: true });

// Index for market rate lookups
marketRateSchema.index({ skillKey: 1, cityKey: 1, isActive: 1 });
marketRateSchema.index({ lastUpdated: -1 });

module.exports = mongoose.model('MarketRate', marketRateSchema);
