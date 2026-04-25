const Job = require('../models/jobModel');
const User = require('../models/userModel');
const Rating = require('../models/ratingModel');
const Complaint = require('../models/complaintModel');
const BaseRate = require('../models/baseRateModel');
const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');
const { createNotification } = require('../utils/notificationHelper');
const { canWorkerCancelJob } = require('../utils/scheduleHelper');
const { logAuditEvent } = require('../utils/auditLogger');
const { sendPasswordChangeOtpSms, sendCustomSms } = require('../utils/smsHelper');
const { getOtpCooldownState, markOtpCooldown, formatOtpCooldownMessage } = require('../utils/otpCooldown');
const { validateStrongPassword, PASSWORD_POLICY_TEXT } = require('../utils/passwordPolicy');
const { upsertWorkerById, removeWorkerById, submitFeedback } = require('../services/semanticMatchingService');
const { MAX_WORKER_SKILLS, normalizeWorkerSkillSelections } = require('../constants/workerSkills');
const { findActiveWorkerTask, getActiveTaskBlockMessage } = require('../utils/workerTaskGate');
const { cancelPendingApplicationByWorker } = require('../services/jobApplicationService');
const { cloudinary, deleteFromCloudinary } = require('../utils/cloudinary');
const {
    getWorkerDailyProfileSnapshot,
    isWorkerDailyProfileComplete,
    upsertWorkerDailyProfile,
} = require('../services/workerDailyProfileService');
const {
    computeWorkerJobCommute,
    getApplyRestrictionResult,
} = require('../utils/commuteHelper');

const CANCEL_PENALTY = 30;

const normalizeSkillKey = (value) => String(value || '').trim().toLowerCase();
const normalizeText = (value) => String(value || '').trim().toLowerCase();

const averageIfPositive = (minValue, maxValue) => {
    const min = Number(minValue);
    const max = Number(maxValue);
    if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max > 0) {
        return Math.round((min + max) / 2);
    }
    if (Number.isFinite(max) && max > 0) return Math.round(max);
    if (Number.isFinite(min) && min > 0) return Math.round(min);
    return 0;
};

const buildWorkerCitySkillRate = (rateDoc, fallbackSkillName = '') => {
    const rates = rateDoc?.rates || {};
    const hourRate = averageIfPositive(rates.hourly, rates.hour, rateDoc?.localHourlyMin, rateDoc?.localHourlyMax)
        || averageIfPositive(rateDoc?.platformHourlyMin, rateDoc?.platformHourlyMax);
    const dayRate = averageIfPositive(rates.daily, rates.day, rateDoc?.localDayMin, rateDoc?.localDayMax)
        || averageIfPositive(rateDoc?.platformDayMin, rateDoc?.platformDayMax);

    const platformCostMin = Number(rates.visit ?? rateDoc?.platformCostMin);
    const platformCostMax = Number(rateDoc?.platformCostMax);
    const visitRate = averageIfPositive(platformCostMin, platformCostMax);

    return {
        city: rateDoc?.city || '',
        cityKey: normalizeText(rateDoc?.cityKey || rateDoc?.city),
        skill: rateDoc?.skill || fallbackSkillName,
        skillKey: normalizeText(rateDoc?.skillKey || rateDoc?.skill || fallbackSkillName),
        hourRate,
        dayRate,
        visitRate,
        currency: rateDoc?.currency || 'INR',
        source: rateDoc?.source || '',
        updatedAt: rateDoc?.updatedAt || null,
    };
};

const parseQuotedApplications = (input) => {
    if (!input) return [];

    const rows = Array.isArray(input)
        ? input
        : (typeof input === 'object'
            ? Object.entries(input).map(([skill, payload]) => ({ skill, ...(payload && typeof payload === 'object' ? payload : { amount: payload }) }))
            : []);

    return rows
        .map((row) => {
            const skill = normalizeSkillKey(row?.skill);
            const amount = Number(row?.amount ?? row?.quotedPrice ?? row?.quote ?? row?.rate);
            const quoteRate = Number(row?.quoteRate ?? row?.rate ?? 0);
            const quoteQuantity = Number(row?.quoteQuantity ?? row?.quantity ?? 0);
            const quoteBasis = String(row?.quoteBasis || row?.basis || '').trim();
            return {
                skill,
                amount: Number.isFinite(amount) && amount > 0 ? amount : null,
                quoteRate: Number.isFinite(quoteRate) && quoteRate > 0 ? quoteRate : null,
                quoteQuantity: Number.isFinite(quoteQuantity) && quoteQuantity > 0 ? quoteQuantity : null,
                quoteBasis,
            };
        })
        .filter((row) => row.skill);
};

const serializeCommute = (commute) => {
    if (!commute) return null;
    return {
        ...commute,
        arrivalAt: commute.arrivalAt ? new Date(commute.arrivalAt).toISOString() : null,
        jobStartAt: commute.jobStartAt ? new Date(commute.jobStartAt).toISOString() : null,
        workerLocationUpdatedAt: commute.workerLocationUpdatedAt ? new Date(commute.workerLocationUpdatedAt).toISOString() : null,
    };
};

const isLegacyDocumentPath = (value) => {
    if (typeof value !== 'string') return false;
    const normalized = value.replace(/\\/g, '/').toLowerCase();
    return (
        normalized.includes('/uploads/documents/') ||
        normalized.startsWith('uploads/documents/') ||
        normalized.includes('/uploads/document/') ||
        normalized.startsWith('uploads/document/') ||
        normalized.includes('/uploads/certificates/') ||
        normalized.startsWith('uploads/certificates/') ||
        normalized.includes('/uploads/certificate/') ||
        normalized.startsWith('uploads/certificate/')
    );
};

const resolveLegacyDocumentToCloudinary = async (value) => {
    if (!isLegacyDocumentPath(value)) return value;
    try {
        const cleanValue = String(value || '').replace(/\\/g, '/').split(/[?#]/)[0];
        let decodedValue = cleanValue;
        try {
            decodedValue = decodeURIComponent(cleanValue);
        } catch {
            decodedValue = cleanValue;
        }
        const fileName = path.basename(decodedValue);
        if (!fileName) return value;

        const extension = path.extname(fileName).toLowerCase();
        const publicIdBase = fileName.replace(/\.[^/.]+$/, '');
        const publicIdCandidates = [
            `karigarconnect/worker-docs/${publicIdBase}`,
            `karigarconnect/documents/${publicIdBase}`,
            `karigarconnect/misc/${publicIdBase}`,
        ];
        const resourceTypes = extension === '.pdf' ? ['raw', 'image'] : ['image', 'raw'];

        for (const publicId of publicIdCandidates) {
            for (const resourceType of resourceTypes) {
                try {
                    const asset = await cloudinary.api.resource(publicId, { resource_type: resourceType, type: 'upload' });
                    if (asset?.secure_url) return asset.secure_url;
                } catch {
                    // Try next candidate.
                }
            }
        }

        const escapedBase = publicIdBase.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const folders = ['karigarconnect/misc', 'karigarconnect/documents', 'karigarconnect/worker-docs'];

        for (const folder of folders) {
            const escapedFolder = folder.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            try {
                const result = await cloudinary.search
                    .expression(`folder="${escapedFolder}" AND filename="${escapedBase}"`)
                    .sort_by('created_at', 'desc')
                    .max_results(1)
                    .execute();
                const secureUrl = result?.resources?.[0]?.secure_url;
                if (secureUrl) return secureUrl;
            } catch {
                // Try next lookup strategy.
            }
        }

        try {
            const result = await cloudinary.search
                .expression(`filename="${escapedBase}"`)
                .sort_by('created_at', 'desc')
                .max_results(1)
                .execute();
            const secureUrl = result?.resources?.[0]?.secure_url;
            if (secureUrl) return secureUrl;
        } catch {
            // Return original value if no search match.
        }

        return value;
    } catch {
        return value;
    }
};

const normalizeWorkerDocumentUrls = async (workerDoc) => {
    const worker = workerDoc?.toObject ? workerDoc.toObject() : { ...(workerDoc || {}) };
    if (!worker || typeof worker !== 'object') return worker;

    if (worker.idProof?.filePath) {
        worker.idProof.filePath = await resolveLegacyDocumentToCloudinary(worker.idProof.filePath);
    }

    if (worker.eShramCardPath) {
        worker.eShramCardPath = await resolveLegacyDocumentToCloudinary(worker.eShramCardPath);
    }

    if (Array.isArray(worker.skillCertificates) && worker.skillCertificates.length) {
        worker.skillCertificates = await Promise.all(
            worker.skillCertificates.map((entry) => resolveLegacyDocumentToCloudinary(entry))
        );
    }

    if (Array.isArray(worker.otherCertificates) && worker.otherCertificates.length) {
        worker.otherCertificates = await Promise.all(
            worker.otherCertificates.map((entry) => resolveLegacyDocumentToCloudinary(entry))
        );
    }

    return worker;
};

const findWorkerByIdOrKarigarId = async (identifier, options = {}) => {
    const { select = '', populate = null } = options;
    const value = String(identifier || '').trim();
    if (!value) return null;

    const queries = [];
    if (mongoose.Types.ObjectId.isValid(value)) {
        queries.push({ _id: value });
    }
    queries.push({ userId: value });
    queries.push({ karigarId: value });

    for (const query of queries) {
        let finder = User.findOne({ role: 'worker', ...query });
        if (select) finder = finder.select(select);
        if (populate) finder = finder.populate(populate);

        const worker = await finder;
        if (worker) return worker;
    }

    return null;
};

const sanitizeWorkerSensitiveFields = (workerDoc) => {
    const worker = workerDoc?.toObject ? workerDoc.toObject() : { ...(workerDoc || {}) };
    if (!worker || typeof worker !== 'object') return worker;

    const idType = String(worker?.idProof?.idType || '').trim();
    const last4 = String(worker?.idProof?.numberLast4 || '').trim();
    const label = idType === 'PAN Card' ? 'PAN' : 'Aadhaar';

    if (worker.idProof) {
        if (Object.prototype.hasOwnProperty.call(worker.idProof, 'numberHash')) {
            delete worker.idProof.numberHash;
        }
        worker.idProof.maskedNumber = last4 ? `${label} ending with ${last4}` : '';
    }

    if (Object.prototype.hasOwnProperty.call(worker, 'aadharNumber')) {
        delete worker.aadharNumber;
    }

    return worker;
};

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

        const cooldownKey = `worker:password-change-otp:${req.user.id}`;
        const cooldown = getOtpCooldownState(cooldownKey);
        if (!cooldown.allowed) {
            return res.status(429).json({
                message: formatOtpCooldownMessage(cooldown.remainingMs),
                retryAfterSeconds: Math.ceil(cooldown.remainingMs / 1000),
            });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        worker.passwordChangeOtp = crypto.createHash('sha256').update(otp).digest('hex');
        worker.passwordChangeOtpExpiry = expiry;
        worker.passwordChangeVerifiedToken = undefined;
        worker.passwordChangeVerifiedTokenExpiry = undefined;
        
        // Use validateBeforeSave: false because we only want to update these specific fields
        await worker.save({ validateBeforeSave: false });

        const smsResult = await sendPasswordChangeOtpSms(worker.mobile, otp, worker.name);
        if (smsResult?.success === false) {
            throw new Error(smsResult.reason || 'sms_send_failed');
        }

        markOtpCooldown(cooldownKey);

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
        if (!validateStrongPassword(newPassword || '').isValid)
            return res.status(400).json({ message: PASSWORD_POLICY_TEXT });

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
        try {
            await removeWorkerById(req.user.id);
        } catch (err) {
            console.error('semantic removeWorkerById(deleteAccountPermanently):', err.message);
        }
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
        const worker = await User.findById(req.user.id).select('skills travelMethod address');
        const dailyProfile = await getWorkerDailyProfileSnapshot(worker);
        const wSkills = (worker?.skills || [])
            .map(s => (typeof s === 'string' ? s : s?.name || '').toLowerCase().trim())
            .filter(Boolean);

        const jobs = await Job.find({
            status: { $in: ['open', 'scheduled'] },
            applicationsOpen: true,
            visibility: true,
        })
            .populate('postedBy', 'name photo verificationStatus location mobile')
            .populate('parentJobId', 'title scheduledDate scheduledTime location status visibility')
            .sort({ urgent: -1, createdAt: -1 });

        const wid = req.user.id.toString();

        const nowMs = Date.now();
        const eligibleJobs = [];
        for (const job of jobs) {
            if (job.isSubTask && shouldAutoDeleteSubTask(job, nowMs)) {
                await markSubTaskAutoDeleted(job);
                continue;
            }

            if (job.isSubTask) {
                const parent = job.parentJobId;
                if (!parent || ['cancelled', 'cancelled_by_client'].includes(parent.status) || parent.visibility === false) {
                    continue;
                }
            }

            eligibleJobs.push(job);
        }

        const formatted = await Promise.all(eligibleJobs.map(async (job) => {
            const allOpenSlots = job.workerSlots.filter(s => s.status === 'open');
            const openSlotSummary = {};
            allOpenSlots.forEach(s => { openSlotSummary[s.skill] = (openSlotSummary[s.skill] || 0) + 1; });

            const relOpen = wSkills.length > 0
                ? allOpenSlots.filter(s => wSkills.includes(s.skill))
                : allOpenSlots;

            const myApps = job.applicants.filter(a => a.workerId?.toString() === wid && a.status === 'pending');
            const myHistory = job.applicants.filter(a => a.workerId?.toString() === wid);
            const blockedByCancellation = myHistory.some(a => a.workerCancelled);
            const myApplicationStatuses = [...new Set(myHistory.map((a) => String(a.status || '').toLowerCase()).filter(Boolean))];
            const relBudget = job.budgetBreakdown?.breakdown || [];
            const invitedRecord = (job.invitedWorkers || []).find(iw => iw.workerId?.toString() === wid);
            const commute = await computeWorkerJobCommute({
                worker,
                dailyProfile,
                job,
            });

            return {
                ...job.toObject(),
                hasApplied: myApps.length > 0 || blockedByCancellation,
                hasApplicationHistory: myHistory.length > 0,
                myApplicationStatuses,
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
                commute: serializeCommute(commute),
            };
        }));

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

        let detailJob = job;
        let parentFull = null;
        if (job.isSubTask && job.parentJobId?._id) {
            parentFull = await Job.findById(job.parentJobId._id)
                .populate('postedBy', 'name photo verificationStatus location address mobile')
                .populate('workerSlots.assignedWorker', 'name photo karigarId');

            if (parentFull) {
                const merged = {
                    ...parentFull.toObject(),
                    _id: job._id,
                    isSubTask: true,
                    subTaskSkill: job.subTaskSkill,
                    parentJobId: parentFull._id,
                    scheduledDate: job.scheduledDate || parentFull.scheduledDate,
                    scheduledTime: job.scheduledTime || parentFull.scheduledTime,
                    shift: job.shift || parentFull.shift,
                    duration: job.duration || parentFull.duration,
                    status: job.status,
                    applicationsOpen: job.applicationsOpen,
                    workerSlots: job.workerSlots,
                    applicants: job.applicants,
                    assignedTo: job.assignedTo,
                };
                detailJob = merged;
            }
        }

        const [tp, cp] = await Promise.all([
            Job.countDocuments({ postedBy: detailJob.postedBy._id }),
            Job.countDocuments({ postedBy: detailJob.postedBy._id, status: 'completed' }),
        ]);

        const wid = req.user.id.toString();
        const w = await User.findById(wid).select('skills travelMethod address');
        const dailyProfile = await getWorkerDailyProfileSnapshot(w);
        const wSkills = (w?.skills || [])
            .map(s => (typeof s === 'string' ? s : s?.name || '').toLowerCase().trim())
            .filter(Boolean);

        const allOpenSlots = (detailJob.workerSlots || []).filter(s => s.status === 'open');
        const openSlotSummary = {};
        allOpenSlots.forEach(s => { openSlotSummary[s.skill] = (openSlotSummary[s.skill] || 0) + 1; });

        const relOpen = wSkills.length > 0
            ? allOpenSlots.filter(s => wSkills.includes(s.skill))
            : allOpenSlots;

        const myApps = (detailJob.applicants || []).filter(a => a.workerId?.toString() === wid && a.status === 'pending');
        const myHistory = (detailJob.applicants || []).filter(a => a.workerId?.toString() === wid);
        const blockedByCancellation = myHistory.some(a => a.workerCancelled);
        const mySlots = (detailJob.workerSlots || []).filter(s =>
            (s.assignedWorker?._id || s.assignedWorker)?.toString() === wid
        );
        const commute = await computeWorkerJobCommute({
            worker: w,
            dailyProfile,
            job: detailJob,
        });

        const serializedDetailJob = typeof detailJob?.toObject === 'function' ? detailJob.toObject() : detailJob;

        return res.json({
            ...serializedDetailJob,
            clientStats: { totalJobsPosted: tp, completedJobs: cp },
            hasApplied: (detailJob.applicants || []).some(a => a.workerId?.toString() === wid),
            blockedByCancellation,
            myAppliedSkills: myApps.map(a => a.skill),
            isAssigned: (detailJob.assignedTo || []).some(id => id?.toString() === wid),
            applicantCount: (detailJob.applicants || []).length,
            mySlots,
            openSlotSummary,
            relevantSkills: [...new Set(relOpen.map(s => s.skill))],
            relevantBudgetBlocks: detailJob.budgetBreakdown?.breakdown || [],
            parentJobTitle: parentFull?.title || job.parentJobId?.title || null,
            parentJobDetails: parentFull?.toObject?.() || job.parentJobId || null,
            commute: serializeCommute(commute),
        });
    } catch (err) {
        console.error('getJobDetails:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};

exports.applyForJob = async (req, res) => {
    try {
        const { selectedSkills, quotedApplications } = req.body;
        const job = await Job.findById(req.params.jobId);
        if (!job) return res.status(404).json({ message: 'Not found.' });
        if (!job.applicationsOpen) return res.status(403).json({ message: 'Applications are closed.' });
        if (!['open', 'scheduled'].includes(job.status))
            return res.status(403).json({ message: 'Not accepting applications.' });

        const wid = req.user.id.toString();
        const worker = await User.findById(wid).select('skills name karigarId travelMethod address');
        const dailyProfile = await getWorkerDailyProfileSnapshot(worker);
        if (!isWorkerDailyProfileComplete(dailyProfile)) {
            return res.status(403).json({ message: 'Please fill your Daily Details on the dashboard before applying to jobs.' });
        }

        const commute = await computeWorkerJobCommute({
            worker,
            dailyProfile,
            job,
        });
        const commuteRule = getApplyRestrictionResult(commute, { maxDistanceKm: 20, job });
        if (!commuteRule.allowed) {
            return res.status(403).json({ message: commuteRule.message, commute: serializeCommute(commute) });
        }

        const activeTask = await findActiveWorkerTask(wid);
        if (activeTask)
            return res.status(403).json({ message: getActiveTaskBlockMessage(activeTask) });

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

        const quoteRows = parseQuotedApplications(quotedApplications);
        const quoteMap = new Map(quoteRows.map((row) => [row.skill, row]));

        newSkills.forEach((sk) => {
            const quoteRow = quoteMap.get(normalizeSkillKey(sk));
            const quotedPrice = quoteRow?.amount || null;
            job.applicants.push({
                workerId: wid,
                skill: sk,
                status: 'pending',
                quotedPrice: quotedPrice || 0,
                quoteRate: quoteRow?.quoteRate || quotedPrice || 0,
                quoteBasis: quoteRow?.quoteBasis || '',
                quoteQuantity: quoteRow?.quoteQuantity || 0,
                quotedAt: quotedPrice ? new Date() : null,
            });
        });
        await job.save();

        submitFeedback({
            workerId: wid,
            jobId: job._id,
            event: 'applied',
            source: 'worker_apply',
        }).catch((err) => {
            console.error('semantic submitFeedback(applyForJob):', err.message);
        });

        const jobLabel = job.isSubTask ? `"${job.title}" (${job.subTaskSkill} sub-task)` : `"${job.title}"`;
        const quotedSkills = newSkills.filter((sk) => quoteMap.get(normalizeSkillKey(sk))?.amount);
        await createNotification({
            userId: job.postedBy, type: 'application', title: 'New Application 📋',
            message: `${worker?.name || 'A worker'} applied for ${jobLabel} as: ${newSkills.join(', ')}.${quotedSkills.length ? ` Quoted price set for ${quotedSkills.join(', ')}.` : ''}`,
        });

        const clientUser = await User.findById(job.postedBy).select('mobile name');
        if (clientUser?.mobile) {
            await sendCustomSms(
                clientUser.mobile,
                `KarigarConnect: ${worker?.name || 'A worker'} applied for your job "${job.title}" as ${newSkills.join(', ')}.${quotedSkills.length ? ' Quoted price added.' : ''}`
            );
        }

        return res.json({
            message: 'Applied successfully.',
            appliedSkills: newSkills,
            commute: serializeCommute(commute),
            notice: commuteRule.warning || commute.etaVarianceNote || '',
        });
    } catch (err) {
        console.error('applyForJob:', err);
        return res.status(500).json({ message: 'Failed to apply.' });
    }
};

exports.applyForSubTask = async (req, res) => {
    try {
        const { jobId, subTaskId } = req.params;
        const wid = req.user.id.toString();
        const subTask = await Job.findById(subTaskId).populate('parentJobId', 'status visibility');
        if (!subTask) return res.status(404).json({ message: 'Sub-task not found.' });
        if (!subTask.isSubTask) return res.status(400).json({ message: 'Not a sub-task.' });
        if (subTask.parentJobId?.toString() !== jobId) return res.status(400).json({ message: 'Sub-task mismatch.' });

        const parent = subTask.parentJobId;
        if (!parent || ['cancelled', 'cancelled_by_client'].includes(parent.status) || parent.visibility === false) {
            return res.status(410).json({ message: 'Parent job is no longer active. Sub-task closed.' });
        }

        if (shouldAutoDeleteSubTask(subTask)) {
            await markSubTaskAutoDeleted(subTask);
            return res.status(410).json({ message: 'Sub-task expired and was auto-deleted due to no applications.' });
        }

        if (!subTask.applicationsOpen) return res.status(403).json({ message: 'Applications closed.' });
        if (!['open', 'scheduled'].includes(subTask.status)) return res.status(403).json({ message: 'Not accepting applications.' });
        const worker = await User.findById(wid).select('karigarId name skills travelMethod address');
        const dailyProfile = await getWorkerDailyProfileSnapshot(worker);
        if (!isWorkerDailyProfileComplete(dailyProfile)) {
            return res.status(403).json({ message: 'Please fill your Daily Details on the dashboard before applying to jobs.' });
        }
        const commute = await computeWorkerJobCommute({
            worker,
            dailyProfile,
            job: subTask,
        });
        const commuteRule = getApplyRestrictionResult(commute, { maxDistanceKm: 20, job: subTask });
        if (!commuteRule.allowed) {
            return res.status(403).json({ message: commuteRule.message, commute: serializeCommute(commute) });
        }
        const activeTask = await findActiveWorkerTask(wid);
        if (activeTask) return res.status(403).json({ message: getActiveTaskBlockMessage(activeTask) });
        if (subTask.applicants.find(a => a.workerId?.toString() === wid && a.workerCancelled))
            return res.status(403).json({ message: 'You cancelled this earlier. Cannot re-apply.' });
        if (subTask.applicants.some(a => a.workerId?.toString() === wid))
            return res.status(400).json({ message: 'Already applied.' });

        const skill = (subTask.subTaskSkill || 'general').toLowerCase();
        subTask.applicants.push({ workerId: wid, skill, status: 'pending' });
        await subTask.save();
        submitFeedback({
            workerId: wid,
            jobId: subTask._id,
            event: 'applied',
            source: 'worker_apply_subtask',
        }).catch((err) => {
            console.error('semantic submitFeedback(applyForSubTask):', err.message);
        });
        await createNotification({
            userId: subTask.postedBy, type: 'application', title: 'Sub-task Application 📋',
            message: `${worker?.name || 'A worker'} applied for the "${skill}" sub-task of "${subTask.title}".`,
        });

        const clientUser = await User.findById(subTask.postedBy).select('mobile');
        if (clientUser?.mobile) {
            await sendCustomSms(
                clientUser.mobile,
                `KarigarConnect: ${worker?.name || 'A worker'} applied for your sub-task "${subTask.title}" (${skill}).`
            );
        }

        return res.json({
            message: 'Applied to sub-task successfully.',
            skill,
            commute: serializeCommute(commute),
            notice: commuteRule.warning || commute.etaVarianceNote || '',
        });
    } catch (err) {
        console.error('applyForSubTask:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};

exports.getWorkerBookings = async (req, res) => {
    try {
        const wid = req.user.id;
        const worker = await User.findById(wid).select('travelMethod address');
        const dailyProfile = await getWorkerDailyProfileSnapshot(worker);
        const jobs = await Job.find({
            $or: [{ 'applicants.workerId': wid }, { assignedTo: wid }, { cancelledWorkerId: wid }],
        })
            .populate('postedBy', 'name photo verificationStatus location mobile')
            .populate('workerSlots.assignedWorker', 'name photo karigarId')
            .populate('parentJobId', 'title scheduledDate scheduledTime')
            .sort({ createdAt: -1 });

        const annotated = await Promise.all(jobs.map(async (job) => {
            const mySlots = job.workerSlots.filter(s =>
                (s.assignedWorker?._id || s.assignedWorker)?.toString() === wid.toString()
            );
            const cancelCheck = canWorkerCancelJob(job);
            const commute = await computeWorkerJobCommute({
                worker,
                dailyProfile,
                job,
            });
            return { ...job.toObject(), mySlots, cancelCheck, commute: serializeCommute(commute) };
        }));
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
        const workerObjectId = new mongoose.Types.ObjectId(wid);
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setHours(0, 0, 0, 0);
        weekStart.setDate(weekStart.getDate() - 6);

        const [c, r, p, ca, worker, weeklyCompletionsRaw] = await Promise.all([
            Job.countDocuments({ assignedTo: wid, status: 'completed' }),
            Job.countDocuments({ assignedTo: wid, status: 'running' }),
            Job.countDocuments({ applicants: { $elemMatch: { workerId: wid, status: 'pending' } } }),
            Job.countDocuments({ cancelledWorkerId: wid }),
            User.findById(wid).select('skills address.city city').lean(),
            Job.aggregate([
                {
                    $match: {
                        assignedTo: workerObjectId,
                        status: 'completed',
                        updatedAt: { $gte: weekStart },
                    },
                },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$updatedAt',
                                timezone: 'Asia/Kolkata',
                            },
                        },
                        value: { $sum: 1 },
                    },
                },
            ]),
        ]);

        const weeklyMap = new Map((weeklyCompletionsRaw || []).map((row) => [String(row?._id || ''), Number(row?.value || 0)]));
        const weeklyCompleted = [];
        for (let i = 0; i < 7; i += 1) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            const isoDate = date.toISOString().slice(0, 10);
            weeklyCompleted.push({
                date: isoDate,
                label: date.toLocaleDateString('en-US', { weekday: 'short' }),
                value: weeklyMap.get(isoDate) || 0,
            });
        }

        const workerCity = String(worker?.address?.city || worker?.city || '').trim();
        const workerCityKey = normalizeText(workerCity);
        const uniqueSkillEntries = new Map();
        (Array.isArray(worker?.skills) ? worker.skills : []).forEach((skill) => {
            const skillName = String(skill?.name || skill?.skill || skill || '').trim();
            if (!skillName) return;
            const key = normalizeText(skillName);
            if (!key || uniqueSkillEntries.has(key)) return;
            uniqueSkillEntries.set(key, skillName);
        });

        let citySkillRates = [];
        if (workerCityKey && uniqueSkillEntries.size > 0) {
            const skillKeys = [...uniqueSkillEntries.keys()];
            const rateRows = await BaseRate.find({
                isActive: true,
                cityKey: workerCityKey,
                skillKey: { $in: skillKeys },
            })
                .sort({ skillKey: 1, effectiveFrom: -1, updatedAt: -1 })
                .lean();

            const latestBySkill = new Map();
            for (const row of rateRows) {
                const skillKey = normalizeText(row?.skillKey || row?.skill);
                if (!skillKey || latestBySkill.has(skillKey)) continue;
                latestBySkill.set(skillKey, row);
            }

            citySkillRates = skillKeys.map((skillKey) => {
                const rateRow = latestBySkill.get(skillKey);
                if (!rateRow) {
                    return {
                        city: workerCity,
                        cityKey: workerCityKey,
                        skill: uniqueSkillEntries.get(skillKey) || '',
                        skillKey,
                        hourRate: 0,
                        dayRate: 0,
                        visitRate: 0,
                        currency: 'INR',
                        source: '',
                        updatedAt: null,
                    };
                }
                return buildWorkerCitySkillRate(rateRow, uniqueSkillEntries.get(skillKey));
            });
        }

        const [ratingStats] = await Rating.aggregate([
            { $match: { worker: workerObjectId } },
            {
                $group: {
                    _id: null,
                    avgStars: { $avg: '$stars' },
                    totalRatings: { $sum: 1 },
                },
            },
        ]);
        const avg = ratingStats?.avgStars || 0;
        const totalRatings = ratingStats?.totalRatings || 0;
        return res.json({
            completed: c, running: r, pending: p, cancelled: ca,
            avgStars: Math.round(avg * 10) / 10, totalRatings,
            weeklyCompleted,
            workerCity,
            citySkillRates,
        });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.getWorkerProfile = async (req, res) => {
    try {
        const w = await User.findById(req.user.id).select('-password -resetPasswordToken -resetPasswordExpire -passwordChangeOtp -passwordChangeOtpExpiry -passwordChangeVerifiedToken -passwordChangeVerifiedTokenExpiry');
        if (!w) return res.status(404).json({ message: 'Not found.' });
        const normalized = await normalizeWorkerDocumentUrls(w);
        const sanitized = sanitizeWorkerSensitiveFields(normalized);
        const dailyProfile = await getWorkerDailyProfileSnapshot(sanitized);
        const workerObjectId = new mongoose.Types.ObjectId(req.user.id);
        const [ratingStats] = await Rating.aggregate([
            { $match: { worker: workerObjectId } },
            {
                $group: {
                    _id: null,
                    avgStars: { $avg: '$stars' },
                    totalRatings: { $sum: 1 },
                },
            },
        ]);
        const avgStars = Math.round(((ratingStats?.avgStars || 0) * 10)) / 10;
        const totalRatings = ratingStats?.totalRatings || 0;
        
        return res.json({
            ...sanitized,
            averageRating: avgStars,
            totalRatings,
            dailyProfile,
            dailyProfileComplete: isWorkerDailyProfileComplete(dailyProfile),
        });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.getWorkerDailyProfile = async (req, res) => {
    try {
        const worker = await User.findById(req.user.id).select('karigarId name skills');
        if (!worker) return res.status(404).json({ message: 'Not found.' });

        const profile = await getWorkerDailyProfileSnapshot(worker);
        return res.json({
            data: profile,
            dailyProfileComplete: isWorkerDailyProfileComplete(profile),
        });
    } catch (err) {
        console.error('getWorkerDailyProfile:', err);
        return res.status(500).json({ message: 'Failed to load daily profile.' });
    }
};

exports.updateWorkerDailyProfile = async (req, res) => {
    try {
        const worker = await User.findById(req.user.id).select('_id karigarId name skills');
        if (!worker) return res.status(404).json({ message: 'Not found.' });

        const updated = await upsertWorkerDailyProfile({ worker, payload: req.body || {} });
        const data = await getWorkerDailyProfileSnapshot(worker);
        return res.json({
            data,
            dailyProfileComplete: isWorkerDailyProfileComplete(updated),
        });
    } catch (err) {
        console.error('updateWorkerDailyProfile:', err);
        return res.status(500).json({ message: 'Failed to save daily profile.' });
    }
};

exports.updateWorkerProfile = async (req, res) => {
    try {
        const w = await User.findById(req.user.id);
        if (!w) return res.status(404).json({ message: 'Not found.' });

        if (req.files?.idProof?.[0] || req.body.idDocumentType !== undefined || req.body.idNumber !== undefined || req.body.aadharNumber !== undefined || req.body.panNumber !== undefined) {
            return res.status(403).json({ message: 'ID proof type and ID number are locked after registration and cannot be updated.' });
        }

        ['email', 'phoneType', 'education', 'gender', 'eShramNumber', 'travelMethod'].forEach(f => {
            if (req.body[f] !== undefined) w[f] = req.body[f];
        });
        if (req.body.dob !== undefined) {
            const dob = req.body.dob ? new Date(req.body.dob) : null;
            if (dob && !Number.isNaN(dob.getTime())) w.dob = dob;
        }
        if (req.body.experience !== undefined) {
            const exp = Number(req.body.experience);
            if (Number.isFinite(exp) && exp >= 0) w.experience = exp;
        }
        w.address = w.address || {};
        ['city', 'pincode', 'locality', 'fullAddress', 'village'].forEach(f => {
            if (req.body[f] !== undefined) w.address[f] = req.body[f];
        });
        if (req.body.latitude !== undefined) {
            const lat = Number(req.body.latitude);
            w.address.latitude = Number.isFinite(lat) ? lat : undefined;
        }
        if (req.body.longitude !== undefined) {
            const lon = Number(req.body.longitude);
            w.address.longitude = Number.isFinite(lon) ? lon : undefined;
        }
        if (req.body.skills) {
            try {
                const parsedSkills = JSON.parse(req.body.skills);
                const normalizedSkills = normalizeWorkerSkillSelections(parsedSkills, req.body.primarySkill);
                if (normalizedSkills.length === 0) {
                    return res.status(400).json({ message: 'At least one valid skill is required.' });
                }
                if (normalizedSkills.length > MAX_WORKER_SKILLS) {
                    return res.status(400).json({ message: `Maximum ${MAX_WORKER_SKILLS} skills are allowed.` });
                }
                w.skills = normalizedSkills;
            } catch {
                return res.status(400).json({ message: 'Invalid skills payload.' });
            }
        }
        if (req.body.references) {
            try {
                const refs = JSON.parse(req.body.references);
                if (Array.isArray(refs)) {
                    w.references = refs
                        .map(r => ({ name: String(r?.name || '').trim(), contact: String(r?.contact || '').trim() }))
                        .filter(r => r.name && r.contact);
                }
            } catch {}
        }
        if (req.body.emergencyContactName !== undefined || req.body.emergencyContactMobile !== undefined) {
            w.emergencyContact = w.emergencyContact || {};
            if (req.body.emergencyContactName !== undefined) w.emergencyContact.name = req.body.emergencyContactName;
            if (req.body.emergencyContactMobile !== undefined) w.emergencyContact.mobile = req.body.emergencyContactMobile;
        }
        if (req.body.preferredJobCategories) {
            try {
                const categories = JSON.parse(req.body.preferredJobCategories);
                if (Array.isArray(categories)) w.preferredJobCategories = categories.filter(Boolean);
            } catch {}
        }
        if (req.body.expectedMinPay !== undefined) {
            const minPay = Number(req.body.expectedMinPay);
            w.expectedMinPay = Number.isFinite(minPay) && minPay >= 0 ? minPay : 0;
        }
        if (req.body.expectedMaxPay !== undefined) {
            const maxPay = Number(req.body.expectedMaxPay);
            w.expectedMaxPay = Number.isFinite(maxPay) && maxPay >= 0 ? maxPay : 0;
        }
        if (req.files?.photo?.[0]?.path) w.photo = req.files.photo[0].path;
        if (req.files?.eShramCard?.[0]?.path) {
            w.eShramCardPath = req.files.eShramCard[0].path;
        }
        // Individual deletion support from Update/View profile actions.
        if (req.body.deletedSkillCertificates !== undefined) {
            let deleteTargets = [];
            try {
                const parsed = typeof req.body.deletedSkillCertificates === 'string'
                    ? JSON.parse(req.body.deletedSkillCertificates)
                    : req.body.deletedSkillCertificates;
                if (Array.isArray(parsed)) deleteTargets = parsed.map((v) => String(v || '').trim()).filter(Boolean);
            } catch {
                deleteTargets = [];
            }

            if (deleteTargets.length > 0) {
                w.skillCertificates = (w.skillCertificates || []).filter((url) => !deleteTargets.includes(url));
                await Promise.all(deleteTargets.map((url) => deleteFromCloudinary(url)));
            }
        }

        if (Array.isArray(req.files?.skillCertificates) && req.files.skillCertificates.length > 0) {
            const uploaded = req.files.skillCertificates.map((f) => f.path).filter(Boolean);
            const current = Array.isArray(w.skillCertificates) ? w.skillCertificates : [];
            const next = [...current, ...uploaded];
            if (next.length > 3) {
                return res.status(400).json({ message: 'Maximum 3 skill certificates are allowed.' });
            }
            w.skillCertificates = next;
        }

        if (req.body.deletedPortfolioPhotos !== undefined) {
            let deleteTargets = [];
            try {
                const parsed = typeof req.body.deletedPortfolioPhotos === 'string'
                    ? JSON.parse(req.body.deletedPortfolioPhotos)
                    : req.body.deletedPortfolioPhotos;
                if (Array.isArray(parsed)) deleteTargets = parsed.map((v) => String(v || '').trim()).filter(Boolean);
            } catch {
                deleteTargets = [];
            }

            if (deleteTargets.length > 0) {
                w.portfolioPhotos = (w.portfolioPhotos || []).filter((url) => !deleteTargets.includes(url));
                await Promise.all(deleteTargets.map((url) => deleteFromCloudinary(url)));
            }
        }

        if (Array.isArray(req.files?.portfolioPhotos) && req.files.portfolioPhotos.length > 0) {
            const uploaded = req.files.portfolioPhotos.map((f) => f.path).filter(Boolean);
            const current = Array.isArray(w.portfolioPhotos) ? w.portfolioPhotos : [];
            const next = [...current, ...uploaded];
            if (next.length > 4) {
                return res.status(400).json({ message: 'Maximum 4 portfolio photos are allowed.' });
            }
            w.portfolioPhotos = next;
        }
        await w.save();
        try {
            await upsertWorkerById(w._id);
        } catch (err) {
            console.error('semantic upsertWorkerById(updateWorkerProfile):', err.message);
        }
        await logAuditEvent({ userId: w._id, role: 'worker', action: 'profile_update', req, metadata: { fields: Object.keys(req.body || {}) } });
        const updated = await User.findById(w._id).select('-password -resetPasswordToken -resetPasswordExpire');
        const normalized = await normalizeWorkerDocumentUrls(updated);
        const sanitized = sanitizeWorkerSensitiveFields(normalized);
        return res.json(sanitized);
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.toggleAvailability = async (req, res) => {
    try {
        const w = await User.findById(req.user.id);
        if (!w) return res.status(404).json({ message: 'Not found.' });
        w.availability = typeof req.body.available === 'boolean' ? req.body.available : !w.availability;
        await w.save();
        try {
            await upsertWorkerById(w._id);
        } catch (err) {
            console.error('semantic upsertWorkerById(toggleAvailability):', err.message);
        }
        await logAuditEvent({ userId: w._id, role: 'worker', action: 'availability_toggle', req, metadata: { available: w.availability } });
        return res.json({ availability: w.availability });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.deleteAccount = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.user.id);
        try {
            await removeWorkerById(req.user.id);
        } catch (err) {
            console.error('semantic removeWorkerById(deleteAccount):', err.message);
        }
        return res.json({ message: 'Deleted.' });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.getPublicWorkerProfile = async (req, res) => {
    try {
        const w = await findWorkerByIdOrKarigarId(req.params.id, {
            select: '-password -resetPasswordToken -resetPasswordExpire -faceEmbedding -idFaceEmbedding -securityAnswer -passwordChangeOtp -passwordChangeOtpExpiry -passwordChangeVerifiedToken -passwordChangeVerifiedTokenExpiry -mobile -email',
            populate: { path: 'reviewLock.lockedBy', select: 'name karigarId' },
        });
        if (!w) return res.status(404).json({ message: 'Not found.' });
        const dailyProfile = await getWorkerDailyProfileSnapshot(w);

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
        const worker = w.toObject();
        const publicAddress = worker.address ? {
            city: worker.address.city || '',
            locality: worker.address.locality || '',
            state: worker.address.state || '',
        } : null;
        return res.json({
            ...worker,
            address: publicAddress,
            mobile: undefined,
            email: undefined,
            completedJobs,
            ratings,
            rank: rankCount + 1,
            avgStars,
            workPhotos,
            dailyProfile,
        });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.getAllKarigars = async (req, res) => {
    try {
        const workers = await User.find({ role: 'worker', verificationStatus: 'approved' })
            .select('name karigarId photo mobile phoneType points availability verificationStatus skills experience overallExperience address')
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
        const normalizeText = (value) => String(value || '').trim().toLowerCase();
        const toFiniteNumber = (value) => {
            const num = Number(value);
            return Number.isFinite(num) ? num : null;
        };
        const haversineKm = (lat1, lng1, lat2, lng2) => {
            const toRad = (deg) => (deg * Math.PI) / 180;
            const dLat = toRad(lat2 - lat1);
            const dLng = toRad(lng2 - lng1);
            const a =
                Math.sin(dLat / 2) ** 2 +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
            return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        const worker = await User.findById(req.user.id).select('address');
        const city = String(worker?.address?.city || '').trim();
        const locality = String(worker?.address?.locality || '').trim();
        const workerLat = toFiniteNumber(worker?.address?.latitude);
        const workerLng = toFiniteNumber(worker?.address?.longitude);
        if (!city) return res.json([]);

        const cityRegex = new RegExp(city, 'i');
        const localityRegex = locality ? new RegExp(locality, 'i') : null;

        const clients = await User.find({
            role: 'client',
            'address.city': { $regex: cityRegex },
            ...(localityRegex ? { 'address.locality': { $regex: localityRegex } } : {}),
        })
            .select('name photo verificationStatus address mobile karigarId userId')
            .limit(100)
            .lean();

        const withinRadius = clients
            .map((client) => {
                const cLat = toFiniteNumber(client?.address?.latitude);
                const cLng = toFiniteNumber(client?.address?.longitude);
                if (!Number.isFinite(workerLat) || !Number.isFinite(workerLng) || !Number.isFinite(cLat) || !Number.isFinite(cLng)) {
                    return { ...client, distanceKm: null };
                }
                const distanceKm = haversineKm(workerLat, workerLng, cLat, cLng);
                return { ...client, distanceKm };
            })
            .filter((client) => {
                if (Number.isFinite(client.distanceKm)) return client.distanceKm <= 5;
                const cityMatch = normalizeText(client?.address?.city) === normalizeText(city);
                const localityMatch = locality ? normalizeText(client?.address?.locality) === normalizeText(locality) : true;
                return cityMatch && localityMatch;
            })
            .sort((a, b) => {
                const aDistance = Number.isFinite(a.distanceKm) ? a.distanceKm : Number.MAX_SAFE_INTEGER;
                const bDistance = Number.isFinite(b.distanceKm) ? b.distanceKm : Number.MAX_SAFE_INTEGER;
                return aDistance - bDistance;
            })
            .slice(0, 20);

        const clientIds = withinRadius.map(c => c._id);
        const jobs = await Job.find({ postedBy: { $in: clientIds } })
            .select('postedBy title status createdAt').sort({ createdAt: -1 }).lean();
        const jobsByClient = {};
        jobs.forEach(j => {
            const cId = j.postedBy?.toString();
            if (!cId) return;
            if (!jobsByClient[cId]) jobsByClient[cId] = [];
            jobsByClient[cId].push(j);
        });
        return res.json(withinRadius.map(c => {
            const list = jobsByClient[c._id.toString()] || [];
            return {
                ...c,
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

// ── Direct Invites — Jobs where worker has been invited ────────────────────────
exports.getDirectInvites = async (req, res) => {
    try {
        const workerId = req.user.id;
        const workerIdStr = String(workerId);
        const worker = await User.findById(workerId).select('travelMethod address');
        const dailyProfile = await getWorkerDailyProfileSnapshot(worker);
        // Find all jobs where this worker is in invitedWorkers array but hasn't applied yet
        const jobs = await Job.find({
            'invitedWorkers.workerId': workerId,
            status: { $in: ['open', 'scheduled'] },
        })
            .populate('postedBy', 'name photo mobile address karigarId')
            .sort({ createdAt: -1 })
            .lean();

        const normalizeSkill = (value) => String(value || '').trim().toLowerCase();

        const invites = await Promise.all(jobs.map(async (job) => {
            const invite = job.invitedWorkers.find(iw => iw.workerId?.toString() === workerIdStr);
            const hasApplied = job.applicants?.some(a => a.workerId?.toString() === workerIdStr);

            const invitedSkill = String(invite?.inviteSkill || '').trim();
            const invitedSlot = (job.workerSlots || []).find((slot) => {
                if (!invite?.inviteSlotId) return false;
                return slot?._id?.toString?.() === invite.inviteSlotId?.toString?.();
            }) || (job.workerSlots || []).find((slot) => normalizeSkill(slot?.skill) === normalizeSkill(invitedSkill));

            const openSlots = Array.isArray(job.workerSlots)
                ? job.workerSlots.filter((slot) => slot?.status === 'open')
                : [];
            const inferredSkillFromSlot = String(invitedSlot?.skill || '').trim();
            const inferredSkillFromOpenSlot = openSlots.length === 1 ? String(openSlots[0]?.skill || '').trim() : '';
            const inferredSkillFromJobSkills = Array.isArray(job.skills) && job.skills.length === 1
                ? String(job.skills[0] || '').trim()
                : '';
            const effectiveInvitedSkill = invitedSkill || inferredSkillFromSlot || inferredSkillFromOpenSlot || inferredSkillFromJobSkills;

            const budgetBlock = (job?.budgetBreakdown?.breakdown || []).find(
                (entry) => normalizeSkill(entry?.skill) === normalizeSkill(effectiveInvitedSkill)
            )
                || (job?.budgetBreakdown?.breakdown || []).find(
                    (entry) => normalizeSkill(entry?.skill) === normalizeSkill(invitedSlot?.skill)
                )
                || ((job?.budgetBreakdown?.breakdown || []).length === 1 ? (job?.budgetBreakdown?.breakdown || [])[0] : null)
                || null;

            const blockCount = Math.max(1, Number(budgetBlock?.count) || 1);
            const blockSubtotal = Number(budgetBlock?.subtotal || 0);
            const fallbackBlockEstimate = Math.round(
                Number(budgetBlock?.baseRate || 0)
                * Math.max(1, Number(budgetBlock?.hours || invitedSlot?.hoursEstimated || 0) || 1)
                * Math.max(1, Number(budgetBlock?.complexityMult || 1) || 1)
                * Math.max(1, Number(budgetBlock?.durationFactor || 1) || 1)
            );
            const invitedSkillCost = blockSubtotal > 0
                ? Math.round(blockSubtotal / blockCount)
                : (fallbackBlockEstimate > 0 ? Math.round(fallbackBlockEstimate / blockCount) : null);
            const invitedNegotiationAmount = budgetBlock?.negotiationAmount != null
                ? Number(budgetBlock.negotiationAmount)
                : (budgetBlock?.negotiationMin != null ? Number(budgetBlock.negotiationMin) : null);

            const invitedHours = Number(invitedSlot?.hoursEstimated || budgetBlock?.hours || 0);
            const commute = await computeWorkerJobCommute({
                worker,
                dailyProfile,
                job,
            });
            return {
                jobId: job._id,
                hireMode: job.hireMode || 'posted',
                title: job.title,
                shortDescription: job.shortDescription || '',
                detailedDescription: job.detailedDescription || '',
                description: job.shortDescription || job.description,
                category: job.category,
                skills: job.skills,
                location: job.location,
                urgent: job.urgent,
                workersRequired: job.workersRequired,
                postedBy: job.postedBy,
                invitedAt: invite?.invitedAt || null,
                hasApplied,
                status: job.status,
                scheduledDate: job.scheduledDate || null,
                scheduledTime: job.scheduledTime || '',
                shift: job.shift || '',
                photos: Array.isArray(job.photos) ? job.photos : [],
                qaAnswers: Array.isArray(job.qaAnswers) ? job.qaAnswers : [],
                invitedSkill: effectiveInvitedSkill || '',
                invitedSlotId: invitedSlot?._id || invite?.inviteSlotId || null,
                invitedSkillCost,
                invitedNegotiationAmount,
                invitedHours,
                invitedDuration: invitedHours > 0 ? `${invitedHours} hour${invitedHours === 1 ? '' : 's'}` : '',
                directHire: job.hireMode === 'direct' ? {
                    requestStatus: job?.directHire?.requestStatus || 'requested',
                    expectedAmount: Number(job?.directHire?.expectedAmount || 0),
                    durationValue: Number(job?.directHire?.durationValue || invitedHours || 1),
                    durationUnit: String(job?.directHire?.durationUnit || ''),
                    oneLineJD: String(job?.directHire?.oneLineJD || ''),
                    expectedStartAt: job?.directHire?.expectedStartAt || null,
                    expectedEndAt: job?.directHire?.expectedEndAt || null,
                } : null,
                commute: serializeCommute(commute),
            };
        }));

        return res.json({ invites, total: invites.length });
    } catch (err) {
        console.error('getDirectInvites:', err);
        return res.status(500).json({ message: 'Failed to fetch direct invites.' });
    }
};

// ── Accept Direct Invite — Worker accepts job invitation and becomes applicant ─
exports.acceptDirectInvite = async (req, res) => {
    try {
        const { jobId } = req.params;
        const workerId = req.user.id;

        const job = await Job.findById(jobId);
        if (!job) return res.status(404).json({ message: 'Job not found.' });
        const activeTask = await findActiveWorkerTask(workerId);
        if (activeTask) return res.status(403).json({ message: getActiveTaskBlockMessage(activeTask) });

        const worker = await User.findById(workerId).select('travelMethod address');
        const dailyProfile = await getWorkerDailyProfileSnapshot(worker);
        if (!isWorkerDailyProfileComplete(dailyProfile)) {
            return res.status(403).json({ message: 'Please fill your Daily Details on the dashboard before applying to jobs.' });
        }

        const commute = await computeWorkerJobCommute({
            worker,
            dailyProfile,
            job,
        });
        const commuteRule = getApplyRestrictionResult(commute, { maxDistanceKm: 20, job });
        if (!commuteRule.allowed) {
            return res.status(403).json({ message: commuteRule.message, commute: serializeCommute(commute) });
        }

        // Check if worker was invited
        const inviteIndex = job.invitedWorkers.findIndex(iw => iw.workerId?.toString() === workerId);
        if (inviteIndex === -1) return res.status(403).json({ message: 'You were not invited to this job.' });

        // Check if already applied
        if (job.applicants?.some(a => a.workerId?.toString() === workerId)) {
            return res.status(400).json({ message: 'You have already applied for this job.' });
        }

        // Add to applicants
        const invite = job.invitedWorkers[inviteIndex] || null;
        const invitedSkill = String(invite?.inviteSkill || '').trim();
        job.applicants.push({ workerId, skill: invitedSkill || 'general', status: 'pending' });
        job.invitedWorkers.splice(inviteIndex, 1); // Remove from invites after accepting
        await job.save();

        await createNotification({
            userId: job.postedBy,
            type: 'application',
            title: 'Invite Accepted ✅',
            message: `A worker you invited has accepted the invite for "${job.title}".`,
        });

        await submitFeedback({
            workerId,
            jobId: job._id,
            event: 'applied',
            source: 'worker_accept_invite',
        }).catch(() => null);

        return res.json({
            message: 'Invite accepted. Your application has been submitted.',
            job: { _id: job._id, title: job.title },
            commute: serializeCommute(commute),
            notice: commuteRule.warning || commute.etaVarianceNote || '',
        });
    } catch (err) {
        console.error('acceptDirectInvite:', err);
        return res.status(500).json({ message: 'Failed to accept invite.' });
    }
};

// ── Reject Direct Invite — Worker declines job invitation ──────────────────────
exports.rejectDirectInvite = async (req, res) => {
    try {
        const { jobId } = req.params;
        const workerId = req.user.id;

        const job = await Job.findById(jobId);
        if (!job) return res.status(404).json({ message: 'Job not found.' });

        const inviteIndex = job.invitedWorkers.findIndex(iw => iw.workerId?.toString() === workerId);
        if (inviteIndex === -1) return res.status(403).json({ message: 'No invite found for this job.' });

        job.invitedWorkers.splice(inviteIndex, 1);
        await job.save();

        return res.json({ message: 'Invite rejected.' });
    } catch (err) {
        console.error('rejectDirectInvite:', err);
        return res.status(500).json({ message: 'Failed to reject invite.' });
    }
};

exports.cancelPendingJobApplication = async (req, res) => {
    try {
        const wid = req.user.id.toString();
        const result = await cancelPendingApplicationByWorker({
            jobId: req.params.jobId,
            workerId: wid,
            cutoffMinutes: null,
        });

        if (!result.ok) {
            return res.status(result.status || 400).json({ message: result.message || 'Failed to cancel application.' });
        }

        const job = result.job;
        const worker = await User.findById(wid).select('name');
        await createNotification({
            userId: job.postedBy,
            type: 'job_update',
            title: 'Application Withdrawn',
            message: `${worker?.name || 'A worker'} has withdrawn application for "${job.title}".${result.removedSkills?.length ? ` Skills: ${result.removedSkills.join(', ')}.` : ''}`,
            jobId: job._id,
        });

        return res.json({
            message: result.message,
            removedSkills: result.removedSkills || [],
            jobId: job._id,
        });
    } catch (err) {
        console.error('cancelPendingJobApplication:', err);
        return res.status(500).json({ message: 'Failed to cancel application.' });
    }
};

const getScheduledStartMs = (scheduledDate, scheduledTime) => {
    if (!scheduledDate || !scheduledTime) return null;
    const [h, m] = String(scheduledTime).split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    const startAt = new Date(scheduledDate);
    if (Number.isNaN(startAt.getTime())) return null;
    startAt.setHours(h, m, 0, 0);
    return startAt.getTime();
};

const hasAnyWorkerCommitment = (job) => {
    const hasAnyApplicant = Array.isArray(job?.applicants) && job.applicants.length > 0;
    const hasAcceptedApplicant = (job?.applicants || []).some((a) => a?.status === 'accepted');
    const hasAssignedWorker = Array.isArray(job?.assignedTo) && job.assignedTo.length > 0;
    const hasFilledSlots = (job?.workerSlots || []).some((s) => s?.status === 'filled' && s?.assignedWorker);
    return hasAnyApplicant || hasAcceptedApplicant || hasAssignedWorker || hasFilledSlots;
};

const shouldAutoDeleteSubTask = (subTask, nowMs = Date.now()) => {
    if (!subTask?.isSubTask) return false;
    if (!['open', 'scheduled'].includes(subTask?.status)) return false;
    const startMs = getScheduledStartMs(subTask?.scheduledDate, subTask?.scheduledTime);
    if (!startMs) return false;
    if (hasAnyWorkerCommitment(subTask)) return false;
    return nowMs >= startMs;
};

const markSubTaskAutoDeleted = async (subTask) => {
    subTask.status = 'cancelled';
    subTask.cancelledBy = null;
    subTask.cancellationReason = 'Auto-cancelled: sub-task expired without any applications.';
    subTask.cancelledAt = new Date();
    subTask.applicationsOpen = false;
    subTask.visibility = false;
    subTask.archivedByClient = true;
    subTask.archivedAt = new Date();
    await subTask.save();

    await createNotification({
        userId: subTask.postedBy,
        type: 'job_update',
        title: 'Sub-task Auto-Deleted',
        message: `Sub-task "${subTask.title}" was auto-deleted because no worker applied before start time.`,
        jobId: subTask._id,
    });
};