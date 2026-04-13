const mongoose = require('mongoose');

const taskTemplateSchema = new mongoose.Schema({
    skillKey:           { type: String, required: true, lowercase: true },
    taskType:           { type: String, required: true },  // e.g., 'wall_paint', 'pipe_installation'
    
    // Standard unit for this task
    unit:               { type: String, required: true },  // 'sqft', 'points', 'units', 'visit'
    
    // Productivity: how much work per hour (e.g., 100 sqft/hour for painting)
    productivity:       { type: Number, required: true },
    productivityUnit:   String,  // 'sqft', 'meters', 'count', 'item'
    
    // Complexity rules as flexible JSON
    // Example: { "coats": { "2": 1.0, "3": 1.3 }, "condition": { "good": 1.0, "bad": 1.4 } }
    complexityRules:    { type: mongoose.Schema.Types.Mixed, default: {} },
    
    // Estimated hours for "normal" complexity at average speed
    baseHours:          { type: Number, default: 8 },
    
    // Description
    description:        String,
    
    // Status
    isActive:           { type: Boolean, default: true },
    createdAt:          { type: Date, default: Date.now },
    updatedAt:          { type: Date, default: Date.now },
}, { timestamps: true });

// Index for lookups
taskTemplateSchema.index({ skillKey: 1, taskType: 1, isActive: 1 });
taskTemplateSchema.index({ skillKey: 1 });

module.exports = mongoose.model('TaskTemplate', taskTemplateSchema);
