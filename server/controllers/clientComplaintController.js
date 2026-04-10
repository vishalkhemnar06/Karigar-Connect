// server/controllers/clientComplaintController.js
// Handles client-side complaint creation and retrieval

const ClientComplaint = require('../models/clientComplaintModel');
const User            = require('../models/userModel');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/client/complaints/file
// Client files a complaint against a worker
// ─────────────────────────────────────────────────────────────────────────────
exports.fileComplaint = async (req, res) => {
    try {
        const { workerId, category, description, relatedJobId } = req.body;
        const clientId = req.user.id;

        // Validate required fields
        if (!workerId || !category || !description) {
            return res.status(400).json({ message: 'Worker, category, and description are required.' });
        }
        if (description.trim().length < 20) {
            return res.status(400).json({ message: 'Description must be at least 20 characters.' });
        }

        // Verify the worker exists and is actually a worker
        const worker = await User.findOne({ _id: workerId, role: 'worker' });
        if (!worker) {
            return res.status(404).json({ message: 'Worker not found.' });
        }

        // Prevent duplicate open complaints against the same worker from same client
        const existing = await ClientComplaint.findOne({
            filedBy: clientId,
            againstWorker: workerId,
            status: { $in: ['submitted', 'in-review'] },
        });
        if (existing) {
            return res.status(409).json({
                message: 'You already have an open complaint against this worker. Please wait for it to be resolved before filing another.',
            });
        }

        const complaint = await ClientComplaint.create({
            filedBy:       clientId,
            againstWorker: workerId,
            category:      category.trim(),
            description:   description.trim(),
            relatedJob:    relatedJobId || null,
        });

        return res.status(201).json({
            success: true,
            message: 'Complaint submitted successfully. We will review and take action within 24 hours.',
            complaint,
        });
    } catch (err) {
        console.error('fileComplaint error:', err.message);
        return res.status(500).json({ message: 'Failed to submit complaint.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/client/complaints
// Fetch all complaints filed by this client
// ─────────────────────────────────────────────────────────────────────────────
exports.getMyComplaints = async (req, res) => {
    try {
        const complaints = await ClientComplaint.find({ filedBy: req.user.id })
            .sort({ createdAt: -1 })
            .populate('againstWorker', 'name mobile karigarId photo skills overallExperience verificationStatus')
            .populate('relatedJob',    'title scheduledDate');

        return res.status(200).json({ complaints });
    } catch (err) {
        console.error('getMyComplaints error:', err.message);
        return res.status(500).json({ message: 'Failed to fetch complaints.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/client/complaints/search-worker
// Search a worker by userId/karigarId OR mobile (for the complaint form)
// Query params: ?query=<userId or mobile>
// ─────────────────────────────────────────────────────────────────────────────
exports.searchWorker = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query || query.trim().length < 3) {
            return res.status(400).json({ message: 'Please enter at least 3 characters to search.' });
        }

        const q = query.trim();

        // Search by userId/karigarId (case-insensitive) OR mobile (exact)
        const worker = await User.findOne({
            role: 'worker',
            $or: [
                { userId: { $regex: new RegExp(`^${q}$`, 'i') } },
                { karigarId: { $regex: new RegExp(`^${q}$`, 'i') } },
                { mobile: q },
            ],
        }).select('_id name mobile userId karigarId photo skills overallExperience experience verificationStatus address');

        if (!worker) {
            return res.status(404).json({ message: 'No worker found with that ID or mobile number.' });
        }

        // Don't allow complaint against an already-blocked worker (no action needed)
        // but still show their profile — admin can still see
        return res.status(200).json({ worker });
    } catch (err) {
        console.error('searchWorker error:', err.message);
        return res.status(500).json({ message: 'Search failed. Please try again.' });
    }
};