// ─────────────────────────────────────────────────────────────────────────────
// AI HISTORY — paste these functions into your clientController.js
// Replaces the 4 existing AI history functions at the bottom of the file.
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: This is a PARTIAL file — only the history functions change.
// Everything else in clientController.js remains unchanged.
// ─────────────────────────────────────────────────────────────────────────────

const AIHistory = require('../models/aiHistoryModel');

// GET all history items (list view — no full report payload for performance)
exports.getClientAIHistory = async (req, res) => {
    try {
        const items = await AIHistory.find({ userId: req.user.id })
            .select('title notes workDescription city urgent clientBudget durationDays createdAt updatedAt')
            .sort({ createdAt: -1 })
            .limit(50);
        return res.json(items);
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

// GET single history item WITH full report (used when client opens a history entry)
exports.getAIHistoryItem = async (req, res) => {
    try {
        const item = await AIHistory.findOne({ _id: req.params.id, userId: req.user.id });
        if (!item) return res.status(404).json({ message: 'Not found.' });
        return res.json(item);
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

// POST save new analysis (called automatically after advisor report is generated)
exports.saveAIAnalysis = async (req, res) => {
    try {
        const {
            workDescription, city, urgent, clientBudget,
            answers, opinions, report,
            // legacy fields
            query, analysis, durationDays, budgetBreakdown, recommendation,
        } = req.body;

        const item = await AIHistory.create({
            userId:          req.user.id,
            title:           report?.jobTitle || workDescription?.slice(0,80) || query || 'Analysis',
            workDescription: workDescription || query || '',
            city:            city || '',
            urgent:          urgent || false,
            clientBudget:    clientBudget ? Number(clientBudget) : null,
            answers:         answers || {},
            opinions:        opinions || {},
            report:          report || null,
            // legacy
            durationDays:    durationDays || report?.durationDays || null,
            budgetBreakdown: budgetBreakdown || report?.budgetBreakdown || analysis || null,
            recommendation:  recommendation || report?.problemSummary || '',
        });
        return res.status(201).json(item);
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

// PATCH update title and/or notes
exports.updateAIHistoryItem = async (req, res) => {
    try {
        const { title, notes } = req.body;
        const item = await AIHistory.findOne({ _id: req.params.id, userId: req.user.id });
        if (!item) return res.status(404).json({ message: 'Not found.' });
        if (title !== undefined) item.title = String(title).slice(0, 120);
        if (notes !== undefined) item.notes = String(notes).slice(0, 2000);
        await item.save();
        return res.json({ message: 'Updated.', item });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

// DELETE single item
exports.deleteAIHistoryItem = async (req, res) => {
    try {
        const r = await AIHistory.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!r) return res.status(404).json({ message: 'Not found.' });
        return res.json({ message: 'Deleted.' });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

// DELETE all
exports.clearClientAIHistory = async (req, res) => {
    try {
        await AIHistory.deleteMany({ userId: req.user.id });
        return res.json({ message: 'Cleared.' });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

// Aliases
exports.getAIHistory   = exports.getClientAIHistory;
exports.clearAIHistory = exports.clearClientAIHistory;
