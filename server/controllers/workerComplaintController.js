// server/controllers/workerComplaintController.js
// CHANGES:
//   - Added deleteComplaint: worker can delete within 24 hours, only if admin hasn't replied
//   - Plain language error messages (no "ticket" word)
//   - All other endpoints unchanged

const Complaint = require('../models/complaintModel');
const User      = require('../models/userModel');
const { createNotification } = require('../utils/notificationHelper');

const VALID_CATEGORIES    = ['Platform', 'Client', 'Payment', 'Safety', 'Technical', 'Other'];
const TWENTY_FOUR_HOURS   = 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// FILE A COMPLAINT OR SUPPORT REQUEST
// POST /api/worker/complaints/file
// ─────────────────────────────────────────────────────────────────────────────
exports.fileComplaint = async (req, res) => {
    try {
        const { type = 'complaint', category, description, againstUserId } = req.body;

        if (!description?.trim()) return res.status(400).json({ message: 'Please describe your issue.' });
        if (!VALID_CATEGORIES.includes(category)) return res.status(400).json({ message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}.` });
        if (!['complaint', 'support'].includes(type)) return res.status(400).json({ message: 'Type must be "complaint" or "support".' });

        let againstUser = null, againstUserName = '';
        if (againstUserId) {
            const client = await User.findOne({ _id: againstUserId, role: 'client' }).select('name');
            if (!client) return res.status(404).json({ message: 'Client not found.' });
            againstUser     = client._id;
            againstUserName = client.name;
        }

        let priority = 'medium';
        if (category === 'Safety')    priority = 'high';
        else if (type === 'support')  priority = 'low';
        else if (category === 'Payment') priority = 'high';

        const worker = await User.findById(req.user.id).select('name karigarId');

        const complaint = await Complaint.create({
            filedBy:         req.user.id,
            type,
            category,
            description:     description.trim(),
            againstUser,
            againstUserName,
            priority,
            messages: [{
                sender:     'worker',
                senderId:   req.user.id,
                senderName: worker?.name || 'Worker',
                text:       description.trim(),
                read:       false,
            }],
            adminUnread:  1,
            workerUnread: 0,
        });

        const populated = await Complaint.findById(complaint._id)
            .populate('filedBy',     'name karigarId photo')
            .populate('againstUser', 'name karigarId');

        const label = type === 'support' ? 'Help request' : 'Complaint';
        return res.status(201).json({
            message:   `${label} sent. Our team will get back to you shortly.`,
            complaint: populated,
        });
    } catch (err) {
        console.error('fileComplaint:', err);
        return res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET MY COMPLAINTS & SUPPORT REQUESTS
// GET /api/worker/complaints
// ─────────────────────────────────────────────────────────────────────────────
exports.getMyComplaints = async (req, res) => {
    try {
        const list = await Complaint.find({ filedBy: req.user.id })
            .populate('filedBy',     'name karigarId photo')
            .populate('againstUser', 'name karigarId photo')
            .sort({ createdAt: -1 });
        return res.json(list);
    } catch (err) {
        console.error('getMyComplaints:', err);
        return res.status(500).json({ message: 'Failed to load.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET SINGLE COMPLAINT (with full thread)
// GET /api/worker/complaints/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.getComplaintById = async (req, res) => {
    try {
        const complaint = await Complaint.findOne({ _id: req.params.id, filedBy: req.user.id })
            .populate('filedBy',     'name karigarId photo')
            .populate('againstUser', 'name karigarId photo');

        if (!complaint) return res.status(404).json({ message: 'Not found.' });

        let changed = false;
        complaint.messages.forEach(m => {
            if (m.sender === 'admin' && !m.read) { m.read = true; changed = true; }
        });
        if (changed) { complaint.workerUnread = 0; await complaint.save(); }

        return res.json(complaint);
    } catch (err) {
        console.error('getComplaintById:', err);
        return res.status(500).json({ message: 'Failed to load.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE COMPLAINT — allowed within 24 hours if admin hasn't replied yet
// DELETE /api/worker/complaints/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteComplaint = async (req, res) => {
    try {
        const complaint = await Complaint.findOne({ _id: req.params.id, filedBy: req.user.id });
        if (!complaint) return res.status(404).json({ message: 'Not found.' });

        const ageMs = Date.now() - new Date(complaint.createdAt).getTime();
        if (ageMs > TWENTY_FOUR_HOURS) {
            return res.status(403).json({ message: 'You can only delete within 24 hours of sending.' });
        }

        const adminReplied = complaint.messages.some(m => m.sender === 'admin');
        if (adminReplied) {
            return res.status(403).json({ message: 'Cannot delete after admin has responded. Please send a message if you need changes.' });
        }

        await complaint.deleteOne();
        return res.json({ message: 'Deleted.' });
    } catch (err) {
        console.error('deleteComplaint:', err);
        return res.status(500).json({ message: 'Failed to delete.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// WORKER SENDS A MESSAGE IN A THREAD
// POST /api/worker/complaints/:id/message
// ─────────────────────────────────────────────────────────────────────────────
exports.sendMessage = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text?.trim()) return res.status(400).json({ message: 'Please type a message.' });

        const complaint = await Complaint.findOne({ _id: req.params.id, filedBy: req.user.id });
        if (!complaint) return res.status(404).json({ message: 'Not found.' });

        if (['resolved', 'closed'].includes(complaint.status)) {
            return res.status(403).json({ message: 'This issue is already closed. Please file a new one if you need further help.' });
        }

        const worker = await User.findById(req.user.id).select('name');
        complaint.messages.push({
            sender:     'worker',
            senderId:   req.user.id,
            senderName: worker?.name || 'Worker',
            text:       text.trim(),
            read:       false,
        });

        complaint.adminUnread = (complaint.adminUnread || 0) + 1;
        if (complaint.status === 'resolved') complaint.status = 'in-review';

        await complaint.save();

        const populated = await Complaint.findById(complaint._id)
            .populate('filedBy',     'name karigarId photo')
            .populate('againstUser', 'name karigarId photo');

        return res.json({ message: 'Message sent.', complaint: populated });
    } catch (err) {
        console.error('workerSendMessage:', err);
        return res.status(500).json({ message: 'Failed to send.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// MARK THREAD AS READ
// PATCH /api/worker/complaints/:id/read
// ─────────────────────────────────────────────────────────────────────────────
exports.markThreadRead = async (req, res) => {
    try {
        const complaint = await Complaint.findOne({ _id: req.params.id, filedBy: req.user.id });
        if (!complaint) return res.status(404).json({ message: 'Not found.' });

        complaint.messages.forEach(m => { if (m.sender === 'admin') m.read = true; });
        complaint.workerUnread = 0;
        await complaint.save();

        return res.json({ message: 'Marked as read.' });
    } catch (err) {
        return res.status(500).json({ message: 'Failed.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH CLIENTS (autocomplete when filing complaint against a client)
// GET /api/worker/complaints/search-client?query=...
// ─────────────────────────────────────────────────────────────────────────────
exports.searchClient = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query || query.trim().length < 2) return res.json([]);
        const clients = await User.find({
            role: 'client',
            $or: [
                { name:   { $regex: query.trim(), $options: 'i' } },
                { mobile: { $regex: query.trim(), $options: 'i' } },
            ],
        }).select('name karigarId photo mobile').limit(10);
        return res.json(clients);
    } catch (err) {
        return res.status(500).json({ message: 'Search failed.' });
    }
};