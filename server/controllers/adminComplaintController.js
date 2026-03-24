// server/controllers/adminComplaintController.js
const ClientComplaint = require('../models/clientComplaintModel');
const User = require('../models/userModel');
const { sendCustomSms } = require('../utils/smsHelper');
const mongoose = require('mongoose');

/**
 * Helper to validate and return a safe Admin ID.
 * Prevents Mongoose "CastError" if req.user.id is a string or synthetic ID.
 */
const safeAdminId = (id) => {
    try {
        return mongoose.Types.ObjectId.isValid(id) ? id : null;
    } catch {
        return null;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/complaints
// Fetches all complaints with full population for the Admin Table/Cards
// ─────────────────────────────────────────────────────────────────────────────
exports.getAllComplaints = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const filter = {};
        
        if (status && status !== 'all') {
            filter.status = status;
        }

        const total = await ClientComplaint.countDocuments(filter);
        const complaints = await ClientComplaint.find(filter)
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .populate('filedBy', 'name mobile karigarId photo role')
            // CRITICAL: Populate all fields used in the Frontend WorkerProfileDrawer
            .populate('againstWorker', 'name mobile karigarId photo skills overallExperience experience verificationStatus address gender points')
            .populate('relatedJob', 'title scheduledDate status');

        return res.status(200).json({
            complaints,
            total,
            page: Number(page),
            totalPages: Math.ceil(total / Number(limit)),
        });
    } catch (err) {
        console.error('getAllComplaints error:', err);
        return res.status(500).json({ message: 'Failed to fetch complaints.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/complaints/stats
// Aggregates counts for the StatCards in Admin Dashboard
// ─────────────────────────────────────────────────────────────────────────────
exports.getComplaintStats = async (req, res) => {
    try {
        const [submitted, inReview, actionTaken, resolved, dismissed, blocked] = await Promise.all([
            ClientComplaint.countDocuments({ status: 'submitted' }),
            ClientComplaint.countDocuments({ status: 'in-review' }),
            ClientComplaint.countDocuments({ status: 'action-taken' }),
            ClientComplaint.countDocuments({ status: 'resolved' }),
            ClientComplaint.countDocuments({ status: 'dismissed' }),
            ClientComplaint.countDocuments({ status: 'blocked' }),
        ]);

        const total = submitted + inReview + actionTaken + resolved + dismissed + blocked;

        return res.status(200).json({
            submitted, 
            inReview, 
            actionTaken, 
            resolved, 
            dismissed, 
            blocked,
            total,
            pending: submitted + inReview,
        });
    } catch (err) {
        console.error('getComplaintStats error:', err);
        return res.status(500).json({ message: 'Failed to fetch statistics.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/complaints/:id
// Fetches granular details for a single complaint
// ─────────────────────────────────────────────────────────────────────────────
exports.getComplaintById = async (req, res) => {
    try {
        const complaint = await ClientComplaint.findById(req.params.id)
            .populate('filedBy', 'name mobile karigarId photo address email')
            .populate('againstWorker', 'name mobile karigarId photo skills overallExperience experience verificationStatus address gender aadharNumber eShramNumber points')
            .populate('relatedJob', 'title scheduledDate status');

        if (!complaint) {
            return res.status(404).json({ message: 'Complaint not found.' });
        }

        return res.status(200).json({ complaint });
    } catch (err) {
        console.error('getComplaintById error:', err);
        return res.status(500).json({ message: 'Failed to fetch complaint details.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/complaints/:id/action
// Main logic for Warn, Block, Clear, or Dismiss actions
// ─────────────────────────────────────────────────────────────────────────────
exports.takeAction = async (req, res) => {
    try {
        const { action, customMessage, adminNotes } = req.body;
        const adminId = safeAdminId(req.user?.id);

        const validActions = ['warn', 'block', 'clear', 'dismiss'];
        if (!validActions.includes(action)) {
            return res.status(400).json({ message: 'Invalid action type.' });
        }

        const complaint = await ClientComplaint.findById(req.params.id)
            .populate('againstWorker');

        if (!complaint) {
            return res.status(404).json({ message: 'Complaint not found.' });
        }

        const worker = complaint.againstWorker;
        if (!worker) {
            return res.status(404).json({ message: 'Worker profile no longer exists.' });
        }

        const workerName = worker.name || 'Worker';
        const workerMobile = worker.mobile || '';
        const karigarId = worker.karigarId || '';

        // 1. Logic for "WARN"
        if (action === 'warn') {
            const msg = customMessage?.trim() || 
                `Dear ${workerName}, a complaint has been filed against you on KarigarConnect. Please maintain professionalism.`;
            
            if (workerMobile) await sendCustomSms(workerMobile, msg);

            complaint.adminAction = 'warned';
            complaint.status = 'action-taken';
        } 
        
        // 2. Logic for "BLOCK"
        else if (action === 'block') {
            await User.findByIdAndUpdate(worker._id, { verificationStatus: 'blocked' });

            const msg = customMessage?.trim() || 
                `Your account (${karigarId}) has been blocked due to a client complaint. Contact support.`;
            
            if (workerMobile) await sendCustomSms(workerMobile, msg);

            complaint.adminAction = 'blocked';
            complaint.status = 'blocked';
        } 
        
        // 3. Logic for "CLEAR" (Worker is innocent)
        else if (action === 'clear') {
            const msg = customMessage?.trim() || 
                `Dear ${workerName}, the complaint against you has been reviewed and cleared.`;
            
            if (workerMobile) await sendCustomSms(workerMobile, msg);

            complaint.adminAction = 'cleared';
            complaint.status = 'resolved';
        } 
        
        // 4. Logic for "DISMISS" (Admin ignores complaint)
        else if (action === 'dismiss') {
            complaint.adminAction = 'dismissed';
            complaint.status = 'dismissed';
        }

        // Common updates for all actions
        complaint.adminNotes = adminNotes?.trim() || `Action ${action} executed by admin.`;
        complaint.actionTakenAt = new Date();
        if (adminId) {
            complaint.actionTakenBy = adminId;
        }

        await complaint.save();

        return res.status(200).json({
            success: true,
            message: `Action "${action}" executed successfully.`,
            complaint,
        });

    } catch (err) {
        console.error('takeAction error:', err);
        return res.status(500).json({ message: err.message || 'Server error during action execution.' });
    }
};