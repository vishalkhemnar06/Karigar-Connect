// server/controllers/workerController.js
// ─────────────────────────────────────────────────────────────────────────────
// KEY FIX: getAvailableJobs — ALL open/scheduled jobs are returned to ALL workers.
//
// ROOT CAUSE of "0 jobs shown":
//   Old code: if (wSkills.length > 0 && relOpen.length === 0) return null;
//   This line silently discarded every job where the worker's skills didn't
//   match any open slot. Workers with ANY skills set saw 0 jobs.
//
// FIX: Removed that filter entirely. openSlotSummary now covers ALL open slots.
//   relevantSkills is still computed but used only for UI highlighting — it
//   never gates which jobs appear.
//
// applyForJob FIX: Removed skill restriction check so any worker can apply
//   for any open slot, regardless of their profile skills.
// ─────────────────────────────────────────────────────────────────────────────

const Job       = require('../models/jobModel');
const User      = require('../models/userModel');
const Rating    = require('../models/ratingModel');
const Complaint = require('../models/complaintModel');
const { createNotification } = require('../utils/notificationHelper');
const { canWorkerCancelJob } = require('../utils/scheduleHelper');
const { logAuditEvent } = require('../utils/auditLogger');

const CANCEL_PENALTY = 30;

// ─────────────────────────────────────────────────────────────────────────────
// AVAILABLE JOBS — ALL jobs shown to ALL workers (no skill filtering)
// ─────────────────────────────────────────────────────────────────────────────
exports.getAvailableJobs = async (req, res) => {
    try {
        const worker  = await User.findById(req.user.id).select('skills');
        // wSkills used ONLY for UI relevantSkills highlights — never for filtering
        const wSkills = (worker?.skills || [])
            .map(s => (typeof s === 'string' ? s : s?.name || '').toLowerCase().trim())
            .filter(Boolean);

        // ── Fetch ALL open/scheduled jobs with no skill restriction ──────────
        const jobs = await Job.find({
            status:           { $in: ['open', 'scheduled'] },
            applicationsOpen: true,
            visibility:       true,
        })
            .populate('postedBy', 'name photo verificationStatus location mobile')
            .populate('parentJobId', 'title scheduledDate scheduledTime location')
            .sort({ createdAt: -1 });

        const wid = req.user.id.toString();

        const formatted = jobs.map(job => {
            // ALL open slots (used for the summary shown to worker)
            const allOpenSlots = job.workerSlots.filter(s => s.status === 'open');

            // openSlotSummary covers EVERY open slot — no skill restriction
            const openSlotSummary = {};
            allOpenSlots.forEach(s => {
                openSlotSummary[s.skill] = (openSlotSummary[s.skill] || 0) + 1;
            });

            // Skill-matched slots — only for green "your skill" UI badges
            const relOpen = wSkills.length > 0
                ? allOpenSlots.filter(s => wSkills.includes(s.skill))
                : allOpenSlots;

            const myApps    = job.applicants.filter(a => a.workerId?.toString() === wid && a.status === 'pending');
            const myHistory = job.applicants.filter(a => a.workerId?.toString() === wid);
            const blockedByCancellation = myHistory.some(a => a.workerCancelled);

            // Budget breakdown for ALL slots (not filtered by skill)
            const relBudget = job.budgetBreakdown?.breakdown || [];

            return {
                ...job.toObject(),
                hasApplied:           myApps.length > 0 || blockedByCancellation,
                myAppliedSkills:      myApps.map(a => a.skill),
                blockedByCancellation,
                applicantCount:       job.applicants.length,
                openSlotSummary,
                // relevantSkills = only for UI highlighting, never used to filter
                relevantSkills:       [...new Set(relOpen.map(s => s.skill))],
                relevantBudgetBlocks: relBudget,
                _type:                job.isSubTask ? 'subtask' : 'job',
                isSubTask:            job.isSubTask,
                subTaskSkill:         job.subTaskSkill,
                parentJobTitle:       job.parentJobId?.title    || null,
                parentJobLocation:    job.parentJobId?.location || null,
            };
            // ── NO .filter(Boolean) — every job is returned ──────────────────
        });

        return res.json(formatted);
    } catch (err) {
        console.error('getAvailableJobs:', err);
        return res.status(500).json({ message: 'Failed to load jobs.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
exports.getJobDetails = async (req, res) => {
    try {
        const job = await Job.findById(req.params.jobId)
            .populate('postedBy', 'name photo verificationStatus location address mobile')
            .populate('workerSlots.assignedWorker', 'name photo karigarId')
            .populate('parentJobId', 'title scheduledDate scheduledTime location description');
        if (!job) return res.status(404).json({ message: 'Not found.' });

        const [tp, cp] = await Promise.all([
            Job.countDocuments({ postedBy: job.postedBy._id }),
            Job.countDocuments({ postedBy: job.postedBy._id, status: 'completed' }),
        ]);

        const wid     = req.user.id.toString();
        const w       = await User.findById(wid).select('skills');
        const wSkills = (w?.skills || [])
            .map(s => (typeof s === 'string' ? s : s?.name || '').toLowerCase().trim())
            .filter(Boolean);

        // All open slots for this job
        const allOpenSlots = job.workerSlots.filter(s => s.status === 'open');
        const openSlotSummary = {};
        allOpenSlots.forEach(s => {
            openSlotSummary[s.skill] = (openSlotSummary[s.skill] || 0) + 1;
        });

        // Skill-matched slots for UI highlights only
        const relOpen = wSkills.length > 0
            ? allOpenSlots.filter(s => wSkills.includes(s.skill))
            : allOpenSlots;

        const myApps    = job.applicants.filter(a => a.workerId?.toString() === wid && a.status === 'pending');
        const myHistory = job.applicants.filter(a => a.workerId?.toString() === wid);
        const blockedByCancellation = myHistory.some(a => a.workerCancelled);
        const mySlots   = job.workerSlots.filter(s =>
            (s.assignedWorker?._id || s.assignedWorker)?.toString() === wid
        );

        return res.json({
            ...job.toObject(),
            clientStats:          { totalJobsPosted: tp, completedJobs: cp },
            hasApplied:           job.applicants.some(a => a.workerId?.toString() === wid),
            blockedByCancellation,
            myAppliedSkills:      myApps.map(a => a.skill),
            isAssigned:           job.assignedTo.some(id => id?.toString() === wid),
            applicantCount:       job.applicants.length,
            mySlots,
            openSlotSummary,
            relevantSkills:       [...new Set(relOpen.map(s => s.skill))],
            relevantBudgetBlocks: job.budgetBreakdown?.breakdown || [],
            parentJobTitle:       job.parentJobId?.title  || null,
            parentJobDetails:     job.parentJobId         || null,
        });
    } catch (err) {
        console.error('getJobDetails:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// applyForJob — any worker can apply for any open slot (no skill restriction)
// ─────────────────────────────────────────────────────────────────────────────
exports.applyForJob = async (req, res) => {
    try {
        const { selectedSkills } = req.body;
        const job = await Job.findById(req.params.jobId);
        if (!job)                  return res.status(404).json({ message: 'Not found.' });
        if (!job.applicationsOpen) return res.status(403).json({ message: 'Applications are closed.' });
        if (!['open', 'scheduled'].includes(job.status))
            return res.status(403).json({ message: 'Not accepting applications.' });

        const wid     = req.user.id.toString();
        const running = await Job.findOne({ assignedTo: wid, status: 'running' });
        if (running)
            return res.status(403).json({ message: `You have a running job: "${running.title}". Complete it first.` });

        const worker = await User.findById(wid).select('skills name karigarId');

        const blockedApplication = job.applicants.find(
            a => a.workerId?.toString() === wid && a.workerCancelled
        );
        if (blockedApplication) {
            return res.status(403).json({
                message: 'You cancelled this assignment earlier. You cannot apply again for this job.',
            });
        }

        const allOpenSlots = job.workerSlots.filter(s => s.status === 'open');

        let skills2apply = [];
        if (selectedSkills?.length) {
            if (selectedSkills.length > 2)
                return res.status(400).json({ message: 'Maximum 2 positions per job.' });
            for (const sk of selectedSkills) {
                const skLow = sk.toLowerCase();
                // Any worker can apply for any open slot — NO skill restriction check
                if (!allOpenSlots.find(s => s.skill === skLow))
                    return res.status(400).json({ message: `No open slot for "${sk}".` });
            }
            skills2apply = [...new Set(selectedSkills.map(s => s.toLowerCase()))];
        } else {
            // Auto-select: take up to 2 open slots from the job
            skills2apply = [...new Set(allOpenSlots.map(s => s.skill))].slice(0, 2);
            if (!skills2apply.length) skills2apply = [job.skills?.[0] || 'general'];
        }

        const existing  = job.applicants
            .filter(a => a.workerId?.toString() === wid && a.status === 'pending')
            .map(a => a.skill);
        const newSkills = skills2apply.filter(sk => !existing.includes(sk));
        if (!newSkills.length)
            return res.status(400).json({ message: 'Already applied for these positions.' });

        newSkills.forEach(sk => job.applicants.push({ workerId: wid, skill: sk, status: 'pending' }));
        await job.save();

        const jobLabel = job.isSubTask
            ? `"${job.title}" (${job.subTaskSkill} sub-task)`
            : `"${job.title}"`;
        await createNotification({
            userId:  job.postedBy,
            type:    'application',
            title:   'New Application 📋',
            message: `${worker?.name || 'A worker'} applied for ${jobLabel} as: ${newSkills.join(', ')}.`,
        });
        return res.json({ message: 'Applied successfully.', appliedSkills: newSkills });
    } catch (err) {
        console.error('applyForJob:', err);
        return res.status(500).json({ message: 'Failed to apply.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
exports.applyForSubTask = async (req, res) => {
    try {
        const { jobId, subTaskId } = req.params;
        const wid     = req.user.id.toString();
        const subTask = await Job.findById(subTaskId);
        if (!subTask)                                         return res.status(404).json({ message: 'Sub-task not found.' });
        if (!subTask.isSubTask)                               return res.status(400).json({ message: 'This is not a sub-task.' });
        if (subTask.parentJobId?.toString() !== jobId)        return res.status(400).json({ message: 'Sub-task does not belong to this job.' });
        if (!subTask.applicationsOpen)                        return res.status(403).json({ message: 'Applications are closed.' });
        if (!['open', 'scheduled'].includes(subTask.status))  return res.status(403).json({ message: 'Not accepting applications.' });
        const blocked = subTask.applicants.find(a => a.workerId?.toString() === wid && a.workerCancelled);
        if (blocked)
            return res.status(403).json({ message: 'You cancelled this assignment earlier. You cannot apply again for this sub-task.' });
        if (subTask.applicants.some(a => a.workerId?.toString() === wid))
            return res.status(400).json({ message: 'Already applied for this sub-task.' });

        const workerDoc = await User.findById(wid).select('skills name');
        const skill     = (subTask.subTaskSkill || 'general').toLowerCase();
        subTask.applicants.push({ workerId: wid, skill, status: 'pending' });
        await subTask.save();
        await createNotification({
            userId:  subTask.postedBy,
            type:    'application',
            title:   'Sub-task Application 📋',
            message: `${workerDoc?.name || 'A worker'} applied for the "${skill}" sub-task of "${subTask.title}".`,
        });
        return res.json({ message: 'Applied to sub-task successfully.', skill });
    } catch (err) {
        console.error('applyForSubTask:', err);
        return res.status(500).json({ message: 'Failed to apply.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
exports.getWorkerBookings = async (req, res) => {
    try {
        const wid  = req.user.id;
        const jobs = await Job.find({
            $or: [
                { 'applicants.workerId': wid },
                { assignedTo: wid },
                { cancelledWorkerId: wid },
            ],
        })
            .populate('postedBy', 'name photo verificationStatus location mobile')
            .populate('workerSlots.assignedWorker', 'name photo karigarId')
            .populate('parentJobId', 'title scheduledDate scheduledTime')
            .sort({ createdAt: -1 });

        const annotated = jobs.map(job => {
            const mySlots     = job.workerSlots.filter(s =>
                (s.assignedWorker?._id || s.assignedWorker)?.toString() === wid.toString()
            );
            const cancelCheck = canWorkerCancelJob(job);
            return { ...job.toObject(), mySlots, cancelCheck };
        });
        return res.json(annotated);
    } catch (err) {
        console.error('getWorkerBookings:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
exports.cancelAcceptedJob = async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason?.trim()) return res.status(400).json({ message: 'Reason is required.' });
        const job = await Job.findById(req.params.jobId);
        if (!job) return res.status(404).json({ message: 'Not found.' });
        const wid = req.user.id.toString();
        if (!job.assignedTo.some(id => id?.toString() === wid))
            return res.status(403).json({ message: 'You are not assigned to this job.' });
        if (job.status === 'running')
            return res.status(403).json({ message: 'Cannot cancel a job that is already running.' });
        const check = canWorkerCancelJob(job);
        if (!check.allowed) return res.status(403).json({ message: check.reason });

        await User.findByIdAndUpdate(wid, { $inc: { points: -CANCEL_PENALTY } });
        const slot = job.workerSlots.find(s =>
            (s.assignedWorker?._id?.toString() || s.assignedWorker?.toString()) === wid &&
            s.status === 'filled'
        );
        if (slot) { slot.assignedWorker = null; slot.status = 'open'; }
        job.assignedTo = job.assignedTo.filter(id => id?.toString() !== wid);
        job.applicants.filter(a => a.workerId?.toString() === wid).forEach(app => {
            app.status = 'rejected';
            app.workerCancelled = true;
            app.feedback = `Cancelled by worker: ${reason.trim()}`;
        });
        job.cancelledWorkerId  = wid;
        job.cancellationReason = reason.trim();
        job.cancelledAt        = new Date();
        if (job.assignedTo.length === 0) { job.status = 'open'; job.applicationsOpen = true; }

        if (job.isSubTask && job.parentJobId) {
            const parentJob = await Job.findById(job.parentJobId);
            if (parentJob) {
                const parentSlot =
                    parentJob.workerSlots.find(s => s.subTaskJobId?.toString() === job._id.toString()) ||
                    parentJob.workerSlots.find(s =>
                        s.assignedWorker?.toString() === wid &&
                        s.skill === (job.subTaskSkill || '').toLowerCase()
                    );
                if (parentSlot) { parentSlot.assignedWorker = null; parentSlot.status = 'open'; }
                parentJob.assignedTo = parentJob.assignedTo.filter(id => id?.toString() !== wid);
                if (parentJob.assignedTo.length === 0 && parentJob.status === 'scheduled')
                    parentJob.status = 'open';
                parentJob.applicationsOpen = parentJob.workerSlots.some(s => s.status === 'open');
                await parentJob.save();
            }
        }

        await job.save();
        const w = await User.findById(wid).select('name');
        await createNotification({
            userId:  job.postedBy,
            type:    'cancelled',
            title:   'Worker Cancelled ⚠️',
            message: `${w?.name || 'Worker'} cancelled "${job.title}". Reason: ${reason}. ${
                job.assignedTo.length > 0 ? `${job.assignedTo.length} still assigned.` : 'Position now open.'
            } (${CANCEL_PENALTY} pts penalty)`,
        });
        return res.json({ message: `Cancelled. ${CANCEL_PENALTY} penalty points deducted.`, penaltyPoints: CANCEL_PENALTY });
    } catch (err) {
        console.error('cancelAcceptedJob:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
exports.getWorkerAnalytics = async (req, res) => {
    try {
        const wid = req.user.id;
        const [c, r, p, ca] = await Promise.all([
            Job.countDocuments({ assignedTo: wid, status: 'completed' }),
            Job.countDocuments({ assignedTo: wid, status: 'running' }),
            Job.countDocuments({ applicants: { $elemMatch: { workerId: wid, status: 'pending' } } }),
            Job.countDocuments({ cancelledWorkerId: wid }),
        ]);
        const ratings = await Rating.find({ worker: wid });
        const avg     = ratings.length ? ratings.reduce((s, r2) => s + (r2.stars || 0), 0) / ratings.length : 0;
        return res.json({
            completed: c, running: r, pending: p, cancelled: ca,
            avgStars: Math.round(avg * 10) / 10, totalRatings: ratings.length,
        });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.getWorkerProfile = async (req, res) => {
    try {
        const w = await User.findById(req.user.id).select('-password -resetPasswordToken -resetPasswordExpire');
        if (!w) return res.status(404).json({ message: 'Not found.' });
        return res.json(w);
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.updateWorkerProfile = async (req, res) => {
    try {
        const w = await User.findById(req.user.id);
        if (!w) return res.status(404).json({ message: 'Not found.' });
        ['email', 'phoneType', 'overallExperience', 'education'].forEach(f => {
            if (req.body[f] !== undefined) w[f] = req.body[f];
        });
        w.address = w.address || {};
        ['city', 'pincode', 'locality'].forEach(f => {
            if (req.body[f] !== undefined) w.address[f] = req.body[f];
        });
        if (req.body.skills) {
            try { w.skills = JSON.parse(req.body.skills).filter(s => s?.name?.trim()); } catch {}
        }
        if (req.file) w.photo = req.file.path;
        await w.save();
        await logAuditEvent({
            userId: w._id, role: 'worker', action: 'profile_update', req,
            metadata: { fields: Object.keys(req.body || {}) },
        });
        return res.json(await User.findById(w._id).select('-password -resetPasswordToken -resetPasswordExpire'));
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.toggleAvailability = async (req, res) => {
    try {
        const w = await User.findById(req.user.id);
        if (!w) return res.status(404).json({ message: 'Not found.' });
        w.availability = typeof req.body.available === 'boolean' ? req.body.available : !w.availability;
        await w.save();
        await logAuditEvent({
            userId: w._id, role: 'worker', action: 'availability_toggle', req,
            metadata: { available: w.availability },
        });
        return res.json({ availability: w.availability });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.deleteAccount = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.user.id);
        return res.json({ message: 'Deleted.' });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC WORKER PROFILE — queried by karigarId (e.g. "K736300"), NOT _id
// ─────────────────────────────────────────────────────────────────────────────
exports.getPublicWorkerProfile = async (req, res) => {
    try {
        const w = await User.findOne({ karigarId: req.params.id, role: 'worker' })
            .select('name photo karigarId skills overallExperience experience points verificationStatus address dob mobile gender portfolioPhotos');
        if (!w) return res.status(404).json({ message: 'Not found.' });

        const [completedJobs, ratings, rankCount, completedJobDocs] = await Promise.all([
            Job.countDocuments({ assignedTo: w._id, status: 'completed' }),
            Rating.find({ worker: w._id }).populate('client', 'name photo').sort({ createdAt: -1 }).limit(10),
            User.countDocuments({ role: 'worker', points: { $gt: w.points } }),
            Job.find({ assignedTo: w._id, status: 'completed', completionPhotos: { $exists: true, $ne: [] } })
                .select('completionPhotos title').limit(12),
        ]);
        const avgStars   = ratings.length
            ? Math.round(ratings.reduce((s, r) => s + (r.stars || 0), 0) / ratings.length * 10) / 10 : 0;
        const workPhotos = completedJobDocs.flatMap(j => j.completionPhotos || []).slice(0, 12);

        return res.json({ ...w.toObject(), completedJobs, ratings, rank: rankCount + 1, avgStars, workPhotos });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.getAllKarigars = async (req, res) => {
    try {
        const workers = await User.find({ role: 'worker', verificationStatus: 'approved' })
            .select('name karigarId photo points availability verificationStatus skills experience overallExperience address')
            .sort({ points: -1 })
            .lean();
        const ids       = workers.map(w => w._id);
        const ratingAgg = await Rating.aggregate([
            { $match: { worker: { $in: ids } } },
            { $group: { _id: '$worker', avg: { $avg: '$stars' }, count: { $sum: 1 } } },
        ]);
        const ratingMap = {};
        ratingAgg.forEach(r => { ratingMap[r._id.toString()] = r; });
        return res.json(workers.map((w, i) => ({
            ...w, rank: i + 1,
            avgStars: ratingMap[w._id.toString()]?.avg
                ? Math.round(ratingMap[w._id.toString()].avg * 10) / 10 : 0,
        })));
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.getLeaderboard = async (req, res) => {
    try {
        return res.json(
            await User.find({ role: 'worker' })
                .select('name karigarId photo points').sort({ points: -1 }).limit(50)
        );
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.getMyFeedback = async (req, res) => {
    try {
        return res.json(
            await Rating.find({ worker: req.user.id })
                .populate('client', 'name photo').populate('jobId', 'title').sort({ createdAt: -1 })
        );
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.fileComplaint = async (req, res) => {
    try {
        const { category, description } = req.body;
        if (!description?.trim()) return res.status(400).json({ message: 'Description required.' });
        return res.status(201).json(await Complaint.create({ filedBy: req.user.id, category, description }));
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.getMyComplaints = async (req, res) => {
    try {
        return res.json(await Complaint.find({ filedBy: req.user.id }).sort({ createdAt: -1 }));
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.getNearClients = async (req, res) => {
    try {
        const worker = await User.findById(req.user.id).select('address');
        const city   = worker?.address?.city;
        if (!city) return res.json([]);
        const clients = await User.find({ role: 'client', 'address.city': { $regex: new RegExp(city, 'i') } })
            .select('name photo verificationStatus address mobile').limit(20);
        const clientIds = clients.map(c => c._id);
        const jobs      = await Job.find({ postedBy: { $in: clientIds } })
            .select('postedBy title status createdAt').sort({ createdAt: -1 }).lean();
        const jobsByClient = {};
        jobs.forEach(j => {
            const cId = j.postedBy?.toString();
            if (!cId) return;
            if (!jobsByClient[cId]) jobsByClient[cId] = [];
            jobsByClient[cId].push(j);
        });
        return res.json(clients.map(c => {
            const list = jobsByClient[c._id.toString()] || [];
            return {
                ...c.toObject(),
                totalPosted:    list.length,
                totalCompleted: list.filter(j => j.status === 'completed').length,
                recentJobs:     list.slice(0, 3).map(j => ({ title: j.title, status: j.status })),
            };
        }));
    } catch (err) {
        console.error('getNearClients:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};