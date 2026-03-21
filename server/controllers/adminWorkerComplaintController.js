// server/controllers/adminWorkerComplaintController.js
// ENHANCED (all original endpoints preserved + new ones added):
//   - getComplaints: now returns ALL complaints (worker complaints + support tickets)
//   - getComplaintStats: breakdown by type/status/priority
//   - getComplaintById: single complaint with full thread
//   - takeAction: update status + optional admin response message
//   - replyToComplaint: admin sends a message in a thread (NEW)
//   - markComplaintRead: mark worker messages as read (NEW)

const Complaint = require('../models/complaintModel');
const User      = require('../models/userModel');
const { createNotification } = require('../utils/notificationHelper');

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL COMPLAINTS (with filters)
// GET /api/admin/complaints?type=complaint&status=submitted&priority=high&page=1
// ─────────────────────────────────────────────────────────────────────────────
exports.getComplaints = async (req, res) => {
    try {
        const {
            type,
            status,
            priority,
            category,
            search,
            page  = 1,
            limit = 30,
        } = req.query;

        const filter = {};
        if (type)     filter.type     = type;
        if (status)   filter.status   = status;
        if (priority) filter.priority = priority;
        if (category) filter.category = category;

        // Text search on description or worker name (via populate post-filter below)
        const skip = (Number(page) - 1) * Number(limit);

        let query = Complaint.find(filter)
            .populate('filedBy',     'name karigarId photo mobile role')
            .populate('againstUser', 'name karigarId photo mobile')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        let complaints = await query;

        // Apply search filter after populate (on worker name / description)
        if (search) {
            const q = search.toLowerCase();
            complaints = complaints.filter(c =>
                c.filedBy?.name?.toLowerCase().includes(q) ||
                c.description?.toLowerCase().includes(q) ||
                c.againstUserName?.toLowerCase().includes(q) ||
                c.category?.toLowerCase().includes(q)
            );
        }

        const total = await Complaint.countDocuments(filter);

        return res.json({ complaints, total, page: Number(page), limit: Number(limit) });
    } catch (err) {
        console.error('getComplaints:', err);
        return res.status(500).json({ message: 'Failed to fetch complaints.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET COMPLAINT STATS
// GET /api/admin/complaints/stats
// ─────────────────────────────────────────────────────────────────────────────
exports.getComplaintStats = async (req, res) => {
    try {
        const [
            total,
            submitted,
            inReview,
            resolved,
            closed,
            complaints,
            support,
            highPriority,
            adminUnread,
        ] = await Promise.all([
            Complaint.countDocuments({}),
            Complaint.countDocuments({ status: 'submitted' }),
            Complaint.countDocuments({ status: 'in-review' }),
            Complaint.countDocuments({ status: 'resolved' }),
            Complaint.countDocuments({ status: 'closed' }),
            Complaint.countDocuments({ type: 'complaint' }),
            Complaint.countDocuments({ type: 'support' }),
            Complaint.countDocuments({ priority: 'high', status: { $in: ['submitted', 'in-review'] } }),
            Complaint.countDocuments({ adminUnread: { $gt: 0 } }),
        ]);

        return res.json({
            total,
            byStatus: { submitted, inReview, resolved, closed },
            byType:   { complaints, support },
            highPriority,
            adminUnread,
        });
    } catch (err) {
        console.error('getComplaintStats:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET SINGLE COMPLAINT (full thread)
// GET /api/admin/complaints/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.getComplaintById = async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.id)
            .populate('filedBy',     'name karigarId photo mobile role')
            .populate('againstUser', 'name karigarId photo mobile');

        if (!complaint) return res.status(404).json({ message: 'Complaint not found.' });

        // Mark worker messages as read (admin is reading them)
        let changed = false;
        complaint.messages.forEach(m => {
            if (m.sender === 'worker' && !m.read) { m.read = true; changed = true; }
        });
        if (changed) {
            complaint.adminUnread = 0;
            await complaint.save();
        }

        return res.json(complaint);
    } catch (err) {
        console.error('getComplaintById:', err);
        return res.status(500).json({ message: 'Failed to fetch complaint.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// TAKE ACTION (update status + optional message)
// POST /api/admin/complaints/:id/action
// Body: { action, message?, priority? }
//   action: 'in-review' | 'resolved' | 'closed'
// ─────────────────────────────────────────────────────────────────────────────
exports.takeAction = async (req, res) => {
    try {
        const { action, message, priority } = req.body;
        const VALID_ACTIONS = ['in-review', 'resolved', 'closed', 'submitted'];
        if (!VALID_ACTIONS.includes(action)) {
            return res.status(400).json({ message: `Action must be one of: ${VALID_ACTIONS.join(', ')}.` });
        }

        const complaint = await Complaint.findById(req.params.id)
            .populate('filedBy', 'name karigarId');
        if (!complaint) return res.status(404).json({ message: 'Not found.' });

        const prevStatus = complaint.status;
        complaint.status = action;
        if (priority) complaint.priority = priority;

        // If an admin message is included, append it to the thread
        if (message?.trim()) {
            complaint.messages.push({
                sender:     'admin',
                senderId:   null, // admin has no DB id
                senderName: 'Support Team',
                text:       message.trim(),
                read:       false,
            });
            complaint.workerUnread  = (complaint.workerUnread || 0) + 1;
            complaint.adminResponse = message.trim(); // keep legacy field in sync
        }

        if (action === 'resolved' || action === 'closed') {
            complaint.resolvedAt = new Date();
        }

        await complaint.save();

        // Notify the worker
        if (complaint.filedBy) {
            const statusLabel = {
                'in-review': 'In Review',
                'resolved':  'Resolved',
                'closed':    'Closed',
                'submitted': 'Re-opened',
            }[action] || action;

            const typeLabel = complaint.type === 'support' ? 'support ticket' : 'complaint';
            const notifMsg  = message?.trim()
                ? `Your ${typeLabel} is now "${statusLabel}". Admin replied: "${message.trim().slice(0, 80)}${message.length > 80 ? '…' : ''}"`
                : `Your ${typeLabel} status has been updated to "${statusLabel}".`;

            await createNotification({
                userId:  complaint.filedBy._id,
                type:    'job_update',
                title:   `${statusLabel === 'Resolved' ? '✅' : 'ℹ️'} ${complaint.type === 'support' ? 'Support' : 'Complaint'} Update`,
                message: notifMsg,
            });
        }

        const populated = await Complaint.findById(complaint._id)
            .populate('filedBy',     'name karigarId photo mobile')
            .populate('againstUser', 'name karigarId photo');

        return res.json({
            message: `Complaint ${action}.`,
            complaint: populated,
        });
    } catch (err) {
        console.error('takeAction:', err);
        return res.status(500).json({ message: 'Failed to take action.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN REPLIES TO A COMPLAINT (adds message to thread, keeps status)
// POST /api/admin/complaints/:id/reply
// Body: { text }
// ─────────────────────────────────────────────────────────────────────────────
exports.replyToComplaint = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text?.trim()) return res.status(400).json({ message: 'Reply text is required.' });

        const complaint = await Complaint.findById(req.params.id)
            .populate('filedBy', 'name karigarId');
        if (!complaint) return res.status(404).json({ message: 'Not found.' });

        complaint.messages.push({
            sender:     'admin',
            senderId:   null,
            senderName: 'Support Team',
            text:       text.trim(),
            read:       false,
        });
        complaint.workerUnread  = (complaint.workerUnread || 0) + 1;
        complaint.adminResponse = text.trim(); // keep legacy field in sync

        // Auto-set status to in-review when admin first replies
        if (complaint.status === 'submitted') complaint.status = 'in-review';

        await complaint.save();

        // Notify worker
        if (complaint.filedBy) {
            await createNotification({
                userId:  complaint.filedBy._id,
                type:    'job_update',
                title:   '💬 Admin Replied to Your Ticket',
                message: `Admin replied to your ${complaint.type === 'support' ? 'support request' : 'complaint'}: "${text.trim().slice(0, 80)}${text.length > 80 ? '…' : ''}"`,
            });
        }

        const populated = await Complaint.findById(complaint._id)
            .populate('filedBy',     'name karigarId photo mobile')
            .populate('againstUser', 'name karigarId photo');

        return res.json({ message: 'Reply sent.', complaint: populated });
    } catch (err) {
        console.error('replyToComplaint:', err);
        return res.status(500).json({ message: 'Failed to send reply.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// MARK COMPLAINT AS READ BY ADMIN (clears adminUnread)
// PATCH /api/admin/complaints/:id/read
// ─────────────────────────────────────────────────────────────────────────────
exports.markComplaintRead = async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) return res.status(404).json({ message: 'Not found.' });

        complaint.messages.forEach(m => { if (m.sender === 'worker') m.read = true; });
        complaint.adminUnread = 0;
        await complaint.save();

        return res.json({ message: 'Marked as read.' });
    } catch (err) {
        console.error('markComplaintRead:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE PRIORITY
// PATCH /api/admin/complaints/:id/priority
// Body: { priority }
// ─────────────────────────────────────────────────────────────────────────────
exports.updatePriority = async (req, res) => {
    try {
        const { priority } = req.body;
        if (!['low', 'medium', 'high'].includes(priority)) {
            return res.status(400).json({ message: 'Priority must be low, medium, or high.' });
        }
        const complaint = await Complaint.findByIdAndUpdate(
            req.params.id,
            { priority },
            { new: true }
        ).populate('filedBy', 'name karigarId photo');

        if (!complaint) return res.status(404).json({ message: 'Not found.' });
        return res.json({ message: 'Priority updated.', complaint });
    } catch (err) {
        console.error('updatePriority:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};