const Job = require('../models/jobModel');
const User = require('../models/userModel');
const Rating = require('../models/ratingModel');
const Complaint = require('../models/complaintModel');
const crypto = require('crypto');
const { createNotification } = require('../utils/notificationHelper');
const { canWorkerCancelJob } = require('../utils/scheduleHelper');
const { logAuditEvent } = require('../utils/auditLogger');
const { sendPasswordChangeOtpSms, sendCustomSms } = require('../utils/smsHelper');

const CANCEL_PENALTY = 30;

// ═════════════════════════════════════════════════════════════════════════════
// PASSWORD CHANGE — OTP FLOW (3 steps)
// ═════════════════════════════════════════════════════════════════════════════

// STEP 1 — Send OTP to registered mobile number
// POST /api/worker/settings/password/send-otp
exports.sendPasswordChangeOtp = async (req, res) => {
    try {
        const worker = await User.findById(req.user.id).select('mobile name');
        if (!worker) return res.status(404).json({ message: 'User not found.' });
        if (!worker.mobile) return res.status(400).json({ message: 'No mobile number linked to your account.' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        worker.passwordChangeOtp = crypto.createHash('sha256').update(otp).digest('hex');
        worker.passwordChangeOtpExpiry = expiry;
        worker.passwordChangeVerifiedToken = undefined;
        worker.passwordChangeVerifiedTokenExpiry = undefined;
        
        // Use validateBeforeSave: false because we only want to update these specific fields
        await worker.save({ validateBeforeSave: false });

        await sendPasswordChangeOtpSms(worker.mobile, otp, worker.name);

        const masked = `xxxxxx${worker.mobile.slice(-4)}`;
        return res.json({
            message: `OTP sent to your registered mobile number ending in ${worker.mobile.slice(-4)}.`,
            mobile: masked,
        });
    } catch (err) {
        console.error('sendPasswordChangeOtp:', err);
        return res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
    }
};

// STEP 2 — Verify OTP → returns a 15-minute verifiedToken
// POST /api/worker/settings/password/verify-otp
exports.verifyPasswordChangeOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        if (!otp?.trim()) return res.status(400).json({ message: 'OTP is required.' });

        const worker = await User.findById(req.user.id)
            .select('+passwordChangeOtp +passwordChangeOtpExpiry');
        
        if (!worker) return res.status(404).json({ message: 'User not found.' });

        if (!worker.passwordChangeOtp || !worker.passwordChangeOtpExpiry)
            return res.status(400).json({ message: 'No OTP request found. Please request a new OTP first.' });

        if (Date.now() > new Date(worker.passwordChangeOtpExpiry).getTime())
            return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });

        const hashedInput = crypto.createHash('sha256').update(otp.trim()).digest('hex');
        if (hashedInput !== worker.passwordChangeOtp)
            return res.status(400).json({ message: 'Incorrect OTP. Please check and try again.' });

        // Issue 15-minute verified session token
        const rawToken = crypto.randomBytes(32).toString('hex');
        worker.passwordChangeVerifiedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
        worker.passwordChangeVerifiedTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);
        worker.passwordChangeOtp = undefined;
        worker.passwordChangeOtpExpiry = undefined;
        
        await worker.save({ validateBeforeSave: false });

        return res.json({ message: 'OTP verified.', verifiedToken: rawToken });
    } catch (err) {
        console.error('verifyPasswordChangeOtp:', err);
        return res.status(500).json({ message: 'Verification failed. Please try again.' });
    }
};

// STEP 3 — Change password using verifiedToken
// POST /api/worker/settings/password/change
exports.changePasswordWithOtp = async (req, res) => {
    try {
        const { verifiedToken, newPassword } = req.body;
        if (!verifiedToken?.trim()) return res.status(400).json({ message: 'Verification session missing.' });
        if (!newPassword?.trim() || newPassword.length < 6) 
            return res.status(400).json({ message: 'Password must be at least 6 characters.' });

        const worker = await User.findById(req.user.id)
            .select('+password +passwordChangeVerifiedToken +passwordChangeVerifiedTokenExpiry');
        
        if (!worker) return res.status(404).json({ message: 'User not found.' });

        if (!worker.passwordChangeVerifiedToken || Date.now() > new Date(worker.passwordChangeVerifiedTokenExpiry).getTime())
            return res.status(400).json({ message: 'Session expired. Please verify OTP again.' });

        const hashedToken = crypto.createHash('sha256').update(verifiedToken.trim()).digest('hex');
        if (hashedToken !== worker.passwordChangeVerifiedToken)
            return res.status(400).json({ message: 'Invalid session. Please start over.' });

        // UPDATE PASSWORD: This triggers the pre('save') hook in userModel to hash the password
        worker.password = newPassword;
        
        // Clear all security tokens
        worker.passwordChangeOtp = undefined;
        worker.passwordChangeOtpExpiry = undefined;
        worker.passwordChangeVerifiedToken = undefined;
        worker.passwordChangeVerifiedTokenExpiry = undefined;
        
        await worker.save(); // Bcrypt hashing happens here automatically

        await logAuditEvent({
            userId: worker._id,
            role: 'worker',
            action: 'password_change_via_otp',
            req,
            metadata: { method: 'otp_verified' },
        });

        return res.json({ message: 'Password changed successfully. Please log in again.' });
    } catch (err) {
        console.error('changePasswordWithOtp:', err);
        return res.status(500).json({ message: 'Failed to change password.' });
    }
};

// PERMANENT ACCOUNT DELETION
exports.deleteAccountPermanently = async (req, res) => {
    try {
        const { verifiedToken, confirmText } = req.body;

        if (confirmText !== 'DELETE')
            return res.status(400).json({ message: 'Please type DELETE exactly to confirm.' });

        const worker = await User.findById(req.user.id)
            .select('+passwordChangeVerifiedToken +passwordChangeVerifiedTokenExpiry');
        
        if (!worker) return res.status(404).json({ message: 'User not found.' });

        if (!worker.passwordChangeVerifiedToken || Date.now() > new Date(worker.passwordChangeVerifiedTokenExpiry).getTime())
            return res.status(400).json({ message: 'Verification session expired.' });

        const hashedToken = crypto.createHash('sha256').update(verifiedToken.trim()).digest('hex');
        if (hashedToken !== worker.passwordChangeVerifiedToken)
            return res.status(400).json({ message: 'Invalid session.' });

        await logAuditEvent({
            userId: worker._id,
            role: 'worker',
            action: 'account_deleted_permanently',
            req
        });

        await User.findByIdAndDelete(req.user.id);
        return res.json({ message: 'Your account has been permanently deleted.' });
    } catch (err) {
        console.error('deleteAccountPermanently:', err);
        return res.status(500).json({ message: 'Failed to delete account.' });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// ORIGINAL CORE FUNCTIONS (UNREDUCED)
// ═════════════════════════════════════════════════════════════════════════════

exports.getAvailableJobs = async (req, res) => {
    try {
        const worker = await User.findById(req.user.id).select('skills');
        const wSkills = (worker?.skills || [])
            .map(s => (typeof s === 'string' ? s : s?.name || '').toLowerCase().trim())
            .filter(Boolean);

        const jobs = await Job.find({
            status: { $in: ['open', 'scheduled'] },
            applicationsOpen: true,
            visibility: true,
        })
            .populate('postedBy', 'name photo verificationStatus location mobile')
            .populate('parentJobId', 'title scheduledDate scheduledTime location')
            .sort({ urgent: -1, createdAt: -1 });

        const wid = req.user.id.toString();

        const formatted = jobs.map(job => {
            const allOpenSlots = job.workerSlots.filter(s => s.status === 'open');
            const openSlotSummary = {};
            allOpenSlots.forEach(s => { openSlotSummary[s.skill] = (openSlotSummary[s.skill] || 0) + 1; });

            const relOpen = wSkills.length > 0
                ? allOpenSlots.filter(s => wSkills.includes(s.skill))
                : allOpenSlots;

            const myApps = job.applicants.filter(a => a.workerId?.toString() === wid && a.status === 'pending');
            const myHistory = job.applicants.filter(a => a.workerId?.toString() === wid);
            const blockedByCancellation = myHistory.some(a => a.workerCancelled);
            const relBudget = job.budgetBreakdown?.breakdown || [];
            const invitedRecord = (job.invitedWorkers || []).find(iw => iw.workerId?.toString() === wid);

            return {
                ...job.toObject(),
                hasApplied: myApps.length > 0 || blockedByCancellation,
                myAppliedSkills: myApps.map(a => a.skill),
                blockedByCancellation,
                invitedForMe: !!invitedRecord,
                invitedAt: invitedRecord?.invitedAt || null,
                applicantCount: job.applicants.length,
                openSlotSummary,
                relevantSkills: [...new Set(relOpen.map(s => s.skill))],
                relevantBudgetBlocks: relBudget,
                _type: job.isSubTask ? 'subtask' : 'job',
                isSubTask: job.isSubTask,
                subTaskSkill: job.subTaskSkill,
                parentJobTitle: job.parentJobId?.title || null,
                parentJobLocation: job.parentJobId?.location || null,
            };
        });

        return res.json(formatted);
    } catch (err) {
        console.error('getAvailableJobs:', err);
        return res.status(500).json({ message: 'Failed to load jobs.' });
    }
};

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

        const wid = req.user.id.toString();
        const w = await User.findById(wid).select('skills');
        const wSkills = (w?.skills || [])
            .map(s => (typeof s === 'string' ? s : s?.name || '').toLowerCase().trim())
            .filter(Boolean);

        const allOpenSlots = job.workerSlots.filter(s => s.status === 'open');
        const openSlotSummary = {};
        allOpenSlots.forEach(s => { openSlotSummary[s.skill] = (openSlotSummary[s.skill] || 0) + 1; });

        const relOpen = wSkills.length > 0
            ? allOpenSlots.filter(s => wSkills.includes(s.skill))
            : allOpenSlots;

        const myApps = job.applicants.filter(a => a.workerId?.toString() === wid && a.status === 'pending');
        const myHistory = job.applicants.filter(a => a.workerId?.toString() === wid);
        const blockedByCancellation = myHistory.some(a => a.workerCancelled);
        const mySlots = job.workerSlots.filter(s =>
            (s.assignedWorker?._id || s.assignedWorker)?.toString() === wid
        );

        return res.json({
            ...job.toObject(),
            clientStats: { totalJobsPosted: tp, completedJobs: cp },
            hasApplied: job.applicants.some(a => a.workerId?.toString() === wid),
            blockedByCancellation,
            myAppliedSkills: myApps.map(a => a.skill),
            isAssigned: job.assignedTo.some(id => id?.toString() === wid),
            applicantCount: job.applicants.length,
            mySlots,
            openSlotSummary,
            relevantSkills: [...new Set(relOpen.map(s => s.skill))],
            relevantBudgetBlocks: job.budgetBreakdown?.breakdown || [],
            parentJobTitle: job.parentJobId?.title || null,
            parentJobDetails: job.parentJobId || null,
        });
    } catch (err) {
        console.error('getJobDetails:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};

exports.applyForJob = async (req, res) => {
    try {
        const { selectedSkills } = req.body;
        const job = await Job.findById(req.params.jobId);
        if (!job) return res.status(404).json({ message: 'Not found.' });
        if (!job.applicationsOpen) return res.status(403).json({ message: 'Applications are closed.' });
        if (!['open', 'scheduled'].includes(job.status))
            return res.status(403).json({ message: 'Not accepting applications.' });

        const wid = req.user.id.toString();
        const running = await Job.findOne({ assignedTo: wid, status: 'running' });
        if (running)
            return res.status(403).json({ message: `You have a running job: "${running.title}". Complete it first.` });

        const worker = await User.findById(wid).select('skills name karigarId');
        const blocked = job.applicants.find(a => a.workerId?.toString() === wid && a.workerCancelled);
        if (blocked)
            return res.status(403).json({ message: 'You cancelled this assignment earlier. You cannot apply again.' });

        const allOpenSlots = job.workerSlots.filter(s => s.status === 'open');
        let skills2apply = [];

        if (selectedSkills?.length) {
            if (selectedSkills.length > 2) return res.status(400).json({ message: 'Maximum 2 positions per job.' });
            for (const sk of selectedSkills) {
                if (!allOpenSlots.find(s => s.skill === sk.toLowerCase()))
                    return res.status(400).json({ message: `No open slot for "${sk}".` });
            }
            skills2apply = [...new Set(selectedSkills.map(s => s.toLowerCase()))];
        } else {
            skills2apply = [...new Set(allOpenSlots.map(s => s.skill))].slice(0, 2);
            if (!skills2apply.length) skills2apply = [job.skills?.[0] || 'general'];
        }

        const existing = job.applicants.filter(a => a.workerId?.toString() === wid && a.status === 'pending').map(a => a.skill);
        const newSkills = skills2apply.filter(sk => !existing.includes(sk));
        if (!newSkills.length) return res.status(400).json({ message: 'Already applied for these positions.' });

        newSkills.forEach(sk => job.applicants.push({ workerId: wid, skill: sk, status: 'pending' }));
        await job.save();

        const jobLabel = job.isSubTask ? `"${job.title}" (${job.subTaskSkill} sub-task)` : `"${job.title}"`;
        await createNotification({
            userId: job.postedBy, type: 'application', title: 'New Application 📋',
            message: `${worker?.name || 'A worker'} applied for ${jobLabel} as: ${newSkills.join(', ')}.`,
        });

        const clientUser = await User.findById(job.postedBy).select('mobile name');
        if (clientUser?.mobile) {
            await sendCustomSms(
                clientUser.mobile,
                `KarigarConnect: ${worker?.name || 'A worker'} applied for your job "${job.title}" as ${newSkills.join(', ')}.`
            );
        }

        return res.json({ message: 'Applied successfully.', appliedSkills: newSkills });
    } catch (err) {
        console.error('applyForJob:', err);
        return res.status(500).json({ message: 'Failed to apply.' });
    }
};

exports.applyForSubTask = async (req, res) => {
    try {
        const { jobId, subTaskId } = req.params;
        const wid = req.user.id.toString();
        const subTask = await Job.findById(subTaskId);
        if (!subTask) return res.status(404).json({ message: 'Sub-task not found.' });
        if (!subTask.isSubTask) return res.status(400).json({ message: 'Not a sub-task.' });
        if (subTask.parentJobId?.toString() !== jobId) return res.status(400).json({ message: 'Sub-task mismatch.' });
        if (!subTask.applicationsOpen) return res.status(403).json({ message: 'Applications closed.' });
        if (!['open', 'scheduled'].includes(subTask.status)) return res.status(403).json({ message: 'Not accepting applications.' });
        if (subTask.applicants.find(a => a.workerId?.toString() === wid && a.workerCancelled))
            return res.status(403).json({ message: 'You cancelled this earlier. Cannot re-apply.' });
        if (subTask.applicants.some(a => a.workerId?.toString() === wid))
            return res.status(400).json({ message: 'Already applied.' });

        const workerDoc = await User.findById(wid).select('skills name');
        const skill = (subTask.subTaskSkill || 'general').toLowerCase();
        subTask.applicants.push({ workerId: wid, skill, status: 'pending' });
        await subTask.save();
        await createNotification({
            userId: subTask.postedBy, type: 'application', title: 'Sub-task Application 📋',
            message: `${workerDoc?.name || 'A worker'} applied for the "${skill}" sub-task of "${subTask.title}".`,
        });

        const clientUser = await User.findById(subTask.postedBy).select('mobile');
        if (clientUser?.mobile) {
            await sendCustomSms(
                clientUser.mobile,
                `KarigarConnect: ${workerDoc?.name || 'A worker'} applied for your sub-task "${subTask.title}" (${skill}).`
            );
        }

        return res.json({ message: 'Applied to sub-task successfully.', skill });
    } catch (err) {
        console.error('applyForSubTask:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};

exports.getWorkerBookings = async (req, res) => {
    try {
        const wid = req.user.id;
        const jobs = await Job.find({
            $or: [{ 'applicants.workerId': wid }, { assignedTo: wid }, { cancelledWorkerId: wid }],
        })
            .populate('postedBy', 'name photo verificationStatus location mobile')
            .populate('workerSlots.assignedWorker', 'name photo karigarId')
            .populate('parentJobId', 'title scheduledDate scheduledTime')
            .sort({ createdAt: -1 });

        const annotated = jobs.map(job => {
            const mySlots = job.workerSlots.filter(s =>
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

exports.cancelAcceptedJob = async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason?.trim()) return res.status(400).json({ message: 'Reason is required.' });
        const job = await Job.findById(req.params.jobId);
        if (!job) return res.status(404).json({ message: 'Not found.' });
        const wid = req.user.id.toString();
        if (!job.assignedTo.some(id => id?.toString() === wid))
            return res.status(403).json({ message: 'Not assigned to this job.' });
        if (job.status === 'running')
            return res.status(403).json({ message: 'Cannot cancel a running job.' });
        const check = canWorkerCancelJob(job);
        if (!check.allowed) return res.status(403).json({ message: check.reason });

        await User.findByIdAndUpdate(wid, { $inc: { points: -CANCEL_PENALTY } });
        const slot = job.workerSlots.find(s =>
            (s.assignedWorker?._id?.toString() || s.assignedWorker?.toString()) === wid && s.status === 'filled'
        );
        if (slot) { slot.assignedWorker = null; slot.status = 'open'; }
        job.assignedTo = job.assignedTo.filter(id => id?.toString() !== wid);
        job.applicants.filter(a => a.workerId?.toString() === wid).forEach(app => {
            app.status = 'rejected'; app.workerCancelled = true;
            app.feedback = `Cancelled by worker: ${reason.trim()}`;
        });
        job.cancelledWorkerId = wid;
        job.cancellationReason = reason.trim();
        job.cancelledAt = new Date();
        if (job.assignedTo.length === 0) { job.status = 'open'; job.applicationsOpen = true; }

        if (job.isSubTask && job.parentJobId) {
            const parentJob = await Job.findById(job.parentJobId);
            if (parentJob) {
                const parentSlot =
                    parentJob.workerSlots.find(s => s.subTaskJobId?.toString() === job._id.toString()) ||
                    parentJob.workerSlots.find(s =>
                        s.assignedWorker?.toString() === wid && s.skill === (job.subTaskSkill || '').toLowerCase()
                    );
                if (parentSlot) { parentSlot.assignedWorker = null; parentSlot.status = 'open'; }
                parentJob.assignedTo = parentJob.assignedTo.filter(id => id?.toString() !== wid);
                if (parentJob.assignedTo.length === 0 && parentJob.status === 'scheduled') parentJob.status = 'open';
                parentJob.applicationsOpen = parentJob.workerSlots.some(s => s.status === 'open');
                await parentJob.save();
            }
        }
        await job.save();
        const w = await User.findById(wid).select('name');
        await createNotification({
            userId: job.postedBy, type: 'cancelled', title: 'Worker Cancelled ⚠️',
            message: `${w?.name || 'Worker'} cancelled "${job.title}". Reason: ${reason}. (${CANCEL_PENALTY} pts penalty)`,
        });

        const clientUser = await User.findById(job.postedBy).select('mobile name');
        if (clientUser?.mobile) {
            await sendCustomSms(
                clientUser.mobile,
                `KarigarConnect: ${w?.name || 'Worker'} cancelled job "${job.title}". Reason: ${reason.trim()}.`
            );
        }

        return res.json({ message: `Cancelled. ${CANCEL_PENALTY} penalty points deducted.`, penaltyPoints: CANCEL_PENALTY });
    } catch (err) {
        console.error('cancelAcceptedJob:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};

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
        const avg = ratings.length ? ratings.reduce((s, r2) => s + (r2.stars || 0), 0) / ratings.length : 0;
        return res.json({
            completed: c, running: r, pending: p, cancelled: ca,
            avgStars: Math.round(avg * 10) / 10, totalRatings: ratings.length,
        });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.getWorkerProfile = async (req, res) => {
    try {
        const w = await User.findById(req.user.id).select('-password -resetPasswordToken -resetPasswordExpire -passwordChangeOtp -passwordChangeOtpExpiry -passwordChangeVerifiedToken -passwordChangeVerifiedTokenExpiry');
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
        await logAuditEvent({ userId: w._id, role: 'worker', action: 'profile_update', req, metadata: { fields: Object.keys(req.body || {}) } });
        return res.json(await User.findById(w._id).select('-password -resetPasswordToken -resetPasswordExpire'));
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.toggleAvailability = async (req, res) => {
    try {
        const w = await User.findById(req.user.id);
        if (!w) return res.status(404).json({ message: 'Not found.' });
        w.availability = typeof req.body.available === 'boolean' ? req.body.available : !w.availability;
        await w.save();
        await logAuditEvent({ userId: w._id, role: 'worker', action: 'availability_toggle', req, metadata: { available: w.availability } });
        return res.json({ availability: w.availability });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.deleteAccount = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.user.id);
        return res.json({ message: 'Deleted.' });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

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
        const avgStars = ratings.length
            ? Math.round(ratings.reduce((s, r) => s + (r.stars || 0), 0) / ratings.length * 10) / 10 : 0;
        const workPhotos = completedJobDocs.flatMap(j => j.completionPhotos || []).slice(0, 12);
        return res.json({ ...w.toObject(), completedJobs, ratings, rank: rankCount + 1, avgStars, workPhotos });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.getAllKarigars = async (req, res) => {
    try {
        const workers = await User.find({ role: 'worker', verificationStatus: 'approved' })
            .select('name karigarId photo points availability verificationStatus skills experience overallExperience address')
            .sort({ points: -1 }).lean();
        const ids = workers.map(w => w._id);
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
        return res.json(await User.find({ role: 'worker' }).select('name karigarId photo points').sort({ points: -1 }).limit(50));
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
        const city = worker?.address?.city;
        if (!city) return res.json([]);
        const clients = await User.find({ role: 'client', 'address.city': { $regex: new RegExp(city, 'i') } })
            .select('name photo verificationStatus address mobile').limit(20);
        const clientIds = clients.map(c => c._id);
        const jobs = await Job.find({ postedBy: { $in: clientIds } })
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
                totalPosted: list.length,
                totalCompleted: list.filter(j => j.status === 'completed').length,
                recentJobs: list.slice(0, 3).map(j => ({ title: j.title, status: j.status })),
            };
        }));
    } catch (err) {
        console.error('getNearClients:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};