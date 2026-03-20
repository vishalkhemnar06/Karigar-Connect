// controllers/jobController.js
// FIXES:
//  1. hireGroupJob used status:'proposal' and set groupId — both were missing from
//     jobModel.js. Now that jobModel.js is fixed, these work correctly.
//  2. hireGroupJob searched Group.findById(groupId) where groupId is the custom
//     string ID (e.g. "G123456"), not a MongoDB ObjectId. Changed to findOne({groupId}).
//  3. respondToGroupJob read job.responses which was undefined — fixed in jobModel.js.
//  4. user?.phone → user?.mobile (the field is called 'mobile' in userModel, not 'phone').
//  5. SMS helper calls now awaited (async functions).
//  6. jobRoutes.js was completely wrong (imported groupController, referenced
//     non-existent inviteToGroup) — jobRoutes.js is now rewritten separately.

const Job   = require('../models/jobModel');
const Group = require('../models/Group');
const User  = require('../models/userModel');
const {
    sendNewJobSmsToGroup,
    sendJobResponseSmsToClient,
} = require('../utils/smsHelper');

// ── GROUP JOB: Client hires a group ──────────────────────────────────────────
const hireGroupJob = async (req, res) => {
    try {
        const { groupId, title, description, payment, location } = req.body;
        if (!groupId || !title || !description) {
            return res.status(400).json({ message: 'groupId, title, and description are required.' });
        }

        // FIX: findById won't work for the custom string groupId — use findOne
        const group = await Group.findOne({ groupId }).populate('members');
        if (!group) return res.status(404).json({ message: 'Group not found.' });

        const job = await Job.create({
            postedBy:    req.user.id,
            title,
            description,
            payment:     Number(payment) || 0,
            location,
            groupId:     group._id,   // Store the MongoDB ObjectId reference
            status:      'proposal',  // Now valid — added to jobModel enum
        });

        // Notify all group members via SMS
        for (const member of group.members) {
            const user = await User.findById(member._id).select('mobile');
            if (user?.mobile) {
                await sendNewJobSmsToGroup(user.mobile); // FIX: .phone → .mobile
            }
        }

        return res.status(201).json(job);
    } catch (err) {
        console.error('hireGroupJob error:', err);
        return res.status(500).json({ message: 'Failed to create group job.' });
    }
};

// ── GROUP JOB: Karigar accepts/rejects proposal ───────────────────────────────
const respondToGroupJob = async (req, res) => {
    try {
        const { jobId, status, reason } = req.body;
        if (!jobId || !status) {
            return res.status(400).json({ message: 'jobId and status are required.' });
        }
        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Status must be accepted or rejected.' });
        }

        const job = await Job.findById(jobId);
        if (!job) return res.status(404).json({ message: 'Job not found.' });

        // Prevent duplicate responses from the same karigar
        const alreadyResponded = job.responses.some(
            r => r.karigar.toString() === req.user.id
        );
        if (alreadyResponded) {
            return res.status(400).json({ message: 'You have already responded to this job.' });
        }

        // FIX: job.responses was undefined in original — now fixed in jobModel.js
        job.responses.push({
            karigar: req.user.id,
            status,
            reason: reason || '',
        });

        if (status === 'accepted') {
            job.status = 'running';
            if (!job.assignedTo.map(id => id.toString()).includes(req.user.id)) {
                job.assignedTo.push(req.user.id);
            }
        }

        await job.save();

        // Notify client
        const client = await User.findById(job.postedBy).select('mobile');
        if (client?.mobile) {
            await sendJobResponseSmsToClient(client.mobile, status); // FIX: .phone → .mobile
        }

        // If ALL group members have rejected, mark job as cancelled
        const group = await Group.findById(job.groupId);
        if (group) {
            const rejectedCount = job.responses.filter(r => r.status === 'rejected').length;
            if (rejectedCount >= group.members.length) {
                job.status = 'cancelled';
                await job.save();
            }
        }

        return res.json({ message: 'Response recorded successfully.' });
    } catch (err) {
        console.error('respondToGroupJob error:', err);
        return res.status(500).json({ message: 'Error responding to group job.' });
    }
};

module.exports = { hireGroupJob, respondToGroupJob };