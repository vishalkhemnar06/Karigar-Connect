// server/controllers/adminComplaintController.js
// Email removed — SMS only
// Fix: actionTakenBy skipped when adminId is not a valid ObjectId (synthetic admin)

const ClientComplaint   = require('../models/clientComplaintModel');
const User              = require('../models/userModel');
const { sendCustomSms } = require('../utils/smsHelper');
const mongoose          = require('mongoose');

// Helper — only set actionTakenBy if it's a real ObjectId
const safeAdminId = (id) => {
    try {
        return mongoose.Types.ObjectId.isValid(id) ? id : undefined;
    } catch {
        return undefined;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/complaints
// ─────────────────────────────────────────────────────────────────────────────
exports.getAllComplaints = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (status && status !== 'all') filter.status = status;

        const total = await ClientComplaint.countDocuments(filter);
        const complaints = await ClientComplaint.find(filter)
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .populate('filedBy',       'name mobile karigarId photo role')
            .populate('againstWorker', 'name mobile karigarId photo skills overallExperience experience verificationStatus address gender points')
            .populate('relatedJob',    'title scheduledDate status');

        return res.status(200).json({
            complaints,
            total,
            page:       Number(page),
            totalPages: Math.ceil(total / Number(limit)),
        });
    } catch (err) {
        console.error('getAllComplaints error:', err);
        return res.status(500).json({ message: 'Failed to fetch complaints.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/complaints/stats
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
            submitted, inReview, actionTaken, resolved, dismissed, blocked,
            total,
            pending: submitted + inReview,
        });
    } catch (err) {
        console.error('getComplaintStats error:', err);
        return res.status(500).json({ message: 'Failed to fetch stats.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/complaints/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.getComplaintById = async (req, res) => {
    try {
        const complaint = await ClientComplaint.findById(req.params.id)
            .populate('filedBy',       'name mobile karigarId photo address email')
            .populate('againstWorker', 'name mobile karigarId photo skills overallExperience experience verificationStatus address gender aadharNumber eShramNumber references emergencyContact education portfolioPhotos skillCertificates points idProof liveFacePhoto faceVerificationStatus faceVerificationScore')
            .populate('relatedJob',    'title scheduledDate status');

        if (!complaint) return res.status(404).json({ message: 'Complaint not found.' });
        return res.status(200).json({ complaint });
    } catch (err) {
        console.error('getComplaintById error:', err);
        return res.status(500).json({ message: 'Failed to fetch complaint.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/complaints/:id/action
// ─────────────────────────────────────────────────────────────────────────────
exports.takeAction = async (req, res) => {
    try {
        const { action, customMessage, adminNotes } = req.body;
        const adminId = safeAdminId(req.user.id); // undefined if synthetic admin

        const validActions = ['warn', 'block', 'clear', 'dismiss'];
        if (!validActions.includes(action)) {
            return res.status(400).json({ message: 'Invalid action. Must be: warn, block, clear, or dismiss.' });
        }

        const complaint = await ClientComplaint.findById(req.params.id)
            .populate('againstWorker', 'name mobile verificationStatus karigarId _id');

        if (!complaint) {
            return res.status(404).json({ message: 'Complaint not found.' });
        }

        const worker = complaint.againstWorker;
        if (!worker) {
            return res.status(404).json({ message: 'Worker associated with this complaint no longer exists.' });
        }

        const workerName   = worker.name      || 'Worker';
        const workerMobile = worker.mobile    || '';
        const karigarId    = worker.karigarId || '';

        if (action === 'warn') {
            const msg = customMessage?.trim() ||
                `Dear ${workerName}, a complaint has been filed against you on KarigarConnect. Please maintain professional conduct. Further violations may result in account suspension.`;

            if (workerMobile) await sendCustomSms(workerMobile, msg);

            complaint.adminAction   = 'warned';
            complaint.status        = 'action-taken';
            complaint.adminNotes    = adminNotes?.trim() || 'Warning sent to worker via SMS.';
            complaint.actionTakenAt = new Date();
            if (adminId) complaint.actionTakenBy = adminId;

        } else if (action === 'block') {
            await User.findByIdAndUpdate(worker._id, { verificationStatus: 'blocked' });

            const msg = customMessage?.trim() ||
                `Your KarigarConnect account (${karigarId}) has been blocked due to a complaint. Please contact support for more details.`;

            if (workerMobile) await sendCustomSms(workerMobile, msg);

            complaint.adminAction   = 'blocked';
            complaint.status        = 'blocked';
            complaint.adminNotes    = adminNotes?.trim() || 'Worker account blocked due to complaint.';
            complaint.actionTakenAt = new Date();
            if (adminId) complaint.actionTakenBy = adminId;

        } else if (action === 'clear') {
            const msg = customMessage?.trim() ||
                `Dear ${workerName}, a complaint filed against you on KarigarConnect has been reviewed. You are cleared to continue working. Please maintain high service standards.`;

            if (workerMobile) await sendCustomSms(workerMobile, msg);

            complaint.adminAction   = 'cleared';
            complaint.status        = 'resolved';
            complaint.adminNotes    = adminNotes?.trim() || 'Worker cleared. Complaint resolved.';
            complaint.actionTakenAt = new Date();
            if (adminId) complaint.actionTakenBy = adminId;

        } else if (action === 'dismiss') {
            complaint.adminAction   = 'dismissed';
            complaint.status        = 'dismissed';
            complaint.adminNotes    = adminNotes?.trim() || 'Complaint dismissed by admin.';
            complaint.actionTakenAt = new Date();
            if (adminId) complaint.actionTakenBy = adminId;
        }

        await complaint.save();

        return res.status(200).json({
            success: true,
            message: `Action "${action}" executed successfully.`,
            complaint,
        });

    } catch (err) {
        console.error('takeAction error:', err);
        return res.status(500).json({ message: err.message || 'Failed to execute action.' });
    }
};