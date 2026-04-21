const mongoose = require('mongoose');

const baseRateSchema = new mongoose.Schema({
    city:               { type: String, required: true },
    cityKey:            { type: String, required: true, lowercase: true },
    state:              String,
    tier:               String,
    
    skill:              { type: String, required: true },
    skillKey:           { type: String, required: true, lowercase: true },
    
    rateType:           String,  // e.g., 'mixed', 'hourly', 'per_visit'
    rateMode:           { type: String, enum: ['mixed', 'hourly', 'daily', 'per_visit'], default: 'daily' },
    unit:               { type: String, enum: ['hour', 'day', 'visit'], default: 'day' },
    
    // Local market rates (roadside/word-of-mouth)
    localHourlyMin:     { type: Number, default: 0 },
    localHourlyMax:     { type: Number, default: 0 },
    localDayMin:        { type: Number, default: 0 },
    localDayMax:        { type: Number, default: 0 },

    // Optional platform quoted rates retained from CSV bootstrap
    platformHourlyMin:  { type: Number, default: 0 },
    platformHourlyMax:  { type: Number, default: 0 },
    platformDayMin:     { type: Number, default: 0 },
    platformDayMax:     { type: Number, default: 0 },
    
    // Platform target rates (KarigarConnect)
    platformCostMin:    { type: Number, default: 0 },
    platformCostMax:    { type: Number, default: 0 },
    platformCostBasis:  String,  // e.g., 'per_day_equiv', 'per_visit'
    
    currency:           { type: String, default: 'INR' },
    
    // Audit and versioning
    source:             { type: String, enum: ['csv_bootstrap', 'survey', 'admin_override'], default: 'csv_bootstrap' },
    confidence:         { type: Number, min: 0, max: 1, default: 0.75 },
    effectiveFrom:      { type: Date, default: () => new Date('2025-01-01') },
    effectiveTo:        { type: Date, default: null },
    isActive:           { type: Boolean, default: true },
    
    createdAt:          { type: Date, default: Date.now },
    updatedAt:          { type: Date, default: Date.now },
}, { timestamps: true });

// Compound index for quick lookups
baseRateSchema.index({ skillKey: 1, cityKey: 1, isActive: 1, effectiveFrom: 1 });
baseRateSchema.index({ cityKey: 1, rateMode: 1, isActive: 1 });

module.exports = mongoose.model('BaseRate', baseRateSchema);
