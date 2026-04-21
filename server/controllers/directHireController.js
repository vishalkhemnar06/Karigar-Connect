const crypto = require('crypto');
const mongoose = require('mongoose');
const Job = require('../models/jobModel');
const User = require('../models/userModel');
const { createNotification } = require('../utils/notificationHelper');
const { sendCustomSms, sendOtpSms } = require('../utils/smsHelper');
const {
    estimatePrice,
    normalizeSkillKey,
    normalizeCityKey,
} = require('../services/pricingEngineService');
const { calculateDemandMultipliers } = require('../utils/demandAndFestivalService');

const DIRECT_HIRE_SECTIONS = ['dashboard', 'favorites', 'ai', 'job_post', 'history', 'groups'];
const OTP_TTL_MS = 10 * 60 * 1000;
const LOCK_GRACE_MINUTES = 30;
const CLIENT_NOTICE_MINUTES = 60;

const normalizeUnit = (unit = '') => {
    const value = String(unit || '').trim().toLowerCase();
    if (value === '/day' || value === 'day') return '/day';
    if (value === '/visit' || value === 'visit') return '/visit';
    return '/hour';
};

const unitHours = (unit = '') => {
    const normalized = normalizeUnit(unit);
    if (normalized === '/day') return 8;
    if (normalized === '/visit') return 1;
    return 1;
};

const normalizePhone = (value = '') => String(value || '').replace(/\D/g, '');

const makeOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp || '').trim()).digest('hex');

const formatClientPhone = (mobile = '') => {
    const clean = normalizePhone(mobile);
    if (!clean) return '';
    return clean.length <= 4 ? clean : `xxxxxx${clean.slice(-4)}`;
};

const WORK_START_HOUR = 6;
const WORK_END_HOUR = 21;

const asPositiveNumber = (value, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : fallback;
};

const parseDateTime = (scheduledDate, scheduledTime) => {
    if (!scheduledDate || !scheduledTime) return null;
    const start = new Date(scheduledDate);
    const [hours, minutes] = String(scheduledTime || '').split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    start.setHours(hours, minutes, 0, 0);
    if (Number.isNaN(start.getTime())) return null;
    return start;
};

const computeExpectedEndAt = (scheduledDate, scheduledTime, durationValue, durationUnit) => {
    const start = parseDateTime(scheduledDate, scheduledTime);
    if (!start) return null;
    const totalHours = Math.max(1, Number(durationValue) || 1) * unitHours(durationUnit);
    const end = new Date(start.getTime() + totalHours * 60 * 60 * 1000);
    return { start, end, totalHours };
};

const isWithinWorkingWindow = (start, end) => {
    const startMinutes = (start.getHours() * 60) + start.getMinutes();
    const endMinutes = (end.getHours() * 60) + end.getMinutes();
    return startMinutes >= WORK_START_HOUR * 60 && endMinutes <= WORK_END_HOUR * 60 && end > start;
};

const windowsOverlap = (aStart, aEnd, bStart, bEnd) => {
    if (!aStart || !aEnd || !bStart || !bEnd) return false;
    return aStart < bEnd && bStart < aEnd;
};

const deriveJobWindow = (job) => {
    if (!job) return null;

    const directStart = job.directHire?.expectedStartAt ? new Date(job.directHire.expectedStartAt) : null;
    const directEnd = job.directHire?.expectedEndAt ? new Date(job.directHire.expectedEndAt) : null;
    if (directStart && directEnd && !Number.isNaN(directStart.getTime()) && !Number.isNaN(directEnd.getTime())) {
        return { start: directStart, end: directEnd };
    }

    const scheduled = parseDateTime(job.scheduledDate, job.scheduledTime || '09:00');
    if (scheduled) {
        const slotHours = Math.max(
            1,
            ...(Array.isArray(job.workerSlots)
                ? job.workerSlots.map((slot) => Math.max(1, Number(slot?.hoursEstimated) || 1))
                : [1])
        );
        return { start: scheduled, end: new Date(scheduled.getTime() + slotHours * 60 * 60 * 1000) };
    }

    if (job.status === 'running' && job.actualStartTime) {
        const runningStart = new Date(job.actualStartTime);
        if (!Number.isNaN(runningStart.getTime())) {
            return { start: runningStart, end: new Date(runningStart.getTime() + 2 * 60 * 60 * 1000) };
        }
    }

    return null;
};

const workerLooksSmartphone = (worker) => /smart|android|iphone|ios/.test(String(worker?.phoneType || '').toLowerCase());

const normalizeMoney = (value) => Math.round(Math.max(0, Number(value) || 0));

const validateLocationPayload = (location = {}) => {
    const city = String(location.city || '').trim();
    const state = String(location.state || '').trim();
    const pincode = String(location.pincode || '').trim();
    const fullAddress = String(location.fullAddress || '').trim();

    if (!city) return 'City is required.';
    if (!state) return 'State is required.';
    if (!pincode || !/^\d{6}$/.test(pincode)) return 'Valid 6-digit pincode is required.';
    if (!fullAddress) return 'Full address is required.';
    return '';
};

const getDirectHireSuggestedPricing = async ({ skill, location, scheduledDate, scheduledTime, durationValue, durationUnit }) => {
    const normalizedUnit = normalizeUnit(durationUnit);
    const durationNum = Math.max(1, Number(durationValue) || 1);
    const skillKey = normalizeSkillKey(skill);
    const cityKey = normalizeCityKey(location?.city || '');

    const estimate = await estimatePrice({
        skillKey,
        cityKey,
        locality: location?.locality || '',
        quantity: durationNum,
        unit: normalizedUnit.replace('/', ''),
        urgent: false,
        complexity: 'normal',
        preferBaseRate: false,
    });

    if (!estimate?.success || !estimate?.priceRange?.expected) {
        throw new Error('Could not fetch pricing for this city and skill.');
    }

    const multipliers = await calculateDemandMultipliers(
        new Date(scheduledDate),
        scheduledTime,
        false,
        normalizedUnit === '/day' && durationNum > 1
    );

    const baseAmount = normalizeMoney(estimate.priceRange.expected);
    const demandMultiplier = Number(multipliers?.finalMultiplier) > 0 ? Number(multipliers.finalMultiplier) : 1;
    const suggestedAmount = normalizeMoney(baseAmount * demandMultiplier);

    return {
        source: estimate.source || 'fallback',
        confidence: Number(estimate.confidence || 0),
        skillKey,
        cityKey,
        baseAmount,
        suggestedAmount: Math.max(1, suggestedAmount),
        demandMultiplier,
        multipliers,
    };
};

const hasWorkerScheduleConflict = async ({ workerId, inviteStart, inviteEnd, excludeJobId = null }) => {
    const candidateJobs = await Job.find({
        _id: excludeJobId ? { $ne: excludeJobId } : { $exists: true },
        status: { $in: ['open', 'scheduled', 'running', 'proposal'] },
        $or: [
            { assignedTo: workerId },
            { 'directHire.workerId': workerId },
            { 'invitedWorkers.workerId': workerId },
        ],
    }).select('_id status hireMode scheduledDate scheduledTime actualStartTime directHire workerSlots assignedTo invitedWorkers');

    const busyProbeEnd = new Date(inviteStart.getTime() + 60 * 60 * 1000);

    for (const existing of candidateJobs) {
        if (String(existing._id) === String(excludeJobId || '')) continue;
        if (existing.hireMode === 'direct' && ['rejected', 'cancelled'].includes(String(existing.directHire?.requestStatus || ''))) {
            continue;
        }
        const window = deriveJobWindow(existing);
        if (!window) continue;
        if (windowsOverlap(inviteStart, inviteEnd, window.start, window.end)) {
            return { conflict: true, reason: 'Worker already has an overlapping job window.' };
        }
        if (windowsOverlap(inviteStart, busyProbeEnd, window.start, window.end)) {
            return { conflict: true, reason: 'Worker is busy or scheduled near the requested start time.' };
        }
    }

    return { conflict: false, reason: '' };
};

const safeObjectId = (value) => {
    const text = String(value || '').trim();
    return text && mongoose.Types.ObjectId.isValid(text) ? text : null;
};

const getDirectHireJobQuery = (clientId, extra = {}) => ({
    hireMode: 'direct',
    postedBy: clientId,
    ...extra,
});

const findDirectHireJob = async (jobId, clientId = null, workerId = null) => {
    const query = { _id: jobId, hireMode: 'direct' };
    if (clientId) query.postedBy = clientId;
    if (workerId) query['directHire.workerId'] = workerId;
    return Job.findOne(query)
        .populate('postedBy', 'name mobile photo address karigarId')
        .populate('directHire.workerId', 'name mobile photo phoneType karigarId address skills points avgStars totalRatings')
        .populate('workerSlots.assignedWorker', 'name mobile photo phoneType karigarId');
};

const touchClientLock = async (clientId, jobId, reason, sections = DIRECT_HIRE_SECTIONS) => {
    await User.findByIdAndUpdate(clientId, {
        $set: {
            'paymentLock.active': true,
            'paymentLock.sections': sections,
            'paymentLock.reason': reason,
            'paymentLock.updatedAt': new Date(),
        },
        $addToSet: { 'paymentLock.jobIds': jobId },
    });
};

const clearClientLockIfPossible = async (clientId) => {
    const pending = await Job.find({
        postedBy: clientId,
        hireMode: 'direct',
        'directHire.paymentStatus': { $ne: 'paid' },
        'directHire.requestStatus': { $in: ['accepted', 'requested', 'pending'] },
    }).select('_id').lean();

    if (pending.length) return;

    await User.findByIdAndUpdate(clientId, {
        $set: {
            'paymentLock.active': false,
            'paymentLock.sections': [],
            'paymentLock.reason': '',
            'paymentLock.updatedAt': new Date(),
        },
        $setOnInsert: { 'paymentLock.jobIds': [] },
    });
};

const notifyClientAndWorkerOnRequest = async (job, workerDoc, clientDoc) => {
    const jobLabel = `${job.title}`;
    const amountLabel = Number(job.directHire?.expectedAmount || 0).toLocaleString('en-IN');
    const durationLabel = `${Math.max(1, Number(job.directHire?.durationValue) || 1)} ${normalizeUnit(job.directHire?.durationUnit)}`;
    const dateLabel = job.scheduledDate ? new Date(job.scheduledDate).toLocaleDateString('en-IN') : 'today';
    const timeLabel = job.scheduledTime || '09:00';
    const workerName = workerDoc?.name || 'Worker';
    const clientName = clientDoc?.name || 'Client';

    await createNotification({
        userId: workerDoc?._id || workerDoc?.id,
        type: 'job_update',
        title: 'Direct Hire Request',
        message: `${clientName} invited you for "${jobLabel}" at ${dateLabel} ${timeLabel}. Amount: ₹${amountLabel}. Duration: ${durationLabel}.`,
        jobId: job._id,
        data: { hireMode: 'direct', directHire: true },
    });

    await createNotification({
        userId: clientDoc?._id || clientDoc?.id,
        type: 'job_update',
        title: 'Direct Hire Sent',
        message: `Direct hire request sent to ${workerName} for "${jobLabel}". Waiting for response.`,
        jobId: job._id,
        data: { hireMode: 'direct', directHire: true },
    });

    if (workerDoc?.mobile) {
        await sendCustomSms(
            workerDoc.mobile,
            `KarigarConnect: You have a direct hire request from ${clientName} (${formatClientPhone(clientDoc?.mobile || '')}) on ${dateLabel} at ${timeLabel} for "${jobLabel}". Amount: ₹${amountLabel}. Duration: ${durationLabel}. Open the app or reply through IVR/SMS to respond.`
        );
    }
};

exports.getDirectHireSuggestedAmount = async (req, res) => {
    try {
        const { skill, location, scheduledDate, scheduledTime, durationValue, durationUnit } = req.body;

        if (!String(skill || '').trim()) return res.status(400).json({ message: 'Skill is required.' });
        const locationError = validateLocationPayload(location || {});
        if (locationError) return res.status(400).json({ message: locationError });
        if (!scheduledDate) return res.status(400).json({ message: 'Scheduled date is required.' });
        if (!scheduledTime) return res.status(400).json({ message: 'Scheduled time is required.' });

        const durationNum = asPositiveNumber(durationValue, 1);
        const normalizedUnit = normalizeUnit(durationUnit);
        const timeWindow = computeExpectedEndAt(scheduledDate, scheduledTime, durationNum, normalizedUnit);
        if (!timeWindow) return res.status(400).json({ message: 'Invalid date or time.' });
        if (!isWithinWorkingWindow(timeWindow.start, timeWindow.end)) {
            return res.status(400).json({ message: 'Direct hire working hours must be between 6:00 AM and 9:00 PM.' });
        }

        const pricing = await getDirectHireSuggestedPricing({
            skill,
            location,
            scheduledDate,
            scheduledTime,
            durationValue: durationNum,
            durationUnit: normalizedUnit,
        });

        return res.json({
            message: 'Suggested amount fetched successfully.',
            pricing,
        });
    } catch (err) {
        console.error('getDirectHireSuggestedAmount:', err);
        return res.status(500).json({ message: err.message || 'Failed to fetch suggested amount.' });
    }
};

exports.createDirectHireTicket = async (req, res) => {
    try {
        const {
            workerId,
            skill,
            location,
            scheduledDate,
            scheduledTime,
            durationValue,
            durationUnit,
            fetchedAmount,
            expectedAmount,
            paymentMode,
            oneLineJD,
        } = req.body;

        const safeWorkerId = safeObjectId(workerId);
        if (!safeWorkerId) return res.status(400).json({ message: 'Valid workerId is required.' });
        if (!String(skill || '').trim()) return res.status(400).json({ message: 'Skill is required.' });
        const locationError = validateLocationPayload(location || {});
        if (locationError) return res.status(400).json({ message: locationError });
        if (!scheduledDate) return res.status(400).json({ message: 'Scheduled date is required.' });
        if (!scheduledTime) return res.status(400).json({ message: 'Scheduled time is required.' });
        if (!String(oneLineJD || '').trim()) return res.status(400).json({ message: 'One line job description is required.' });

        const durationNum = asPositiveNumber(durationValue, 1);
        const normalizedUnit = normalizeUnit(durationUnit);
        const timeWindow = computeExpectedEndAt(scheduledDate, scheduledTime, durationNum, normalizedUnit);
        if (!timeWindow) return res.status(400).json({ message: 'Invalid date or time.' });
        if (!isWithinWorkingWindow(timeWindow.start, timeWindow.end)) {
            return res.status(400).json({ message: 'Direct hire working hours must be between 6:00 AM and 9:00 PM.' });
        }

        const worker = await User.findOne({ _id: safeWorkerId, role: 'worker' }).select('name mobile photo phoneType karigarId skills address');
        if (!worker) return res.status(404).json({ message: 'Worker not found.' });
        if (!workerLooksSmartphone(worker)) {
            return res.status(400).json({ message: 'Direct hire is enabled only for workers with a smartphone.' });
        }

        const conflictCheck = await hasWorkerScheduleConflict({
            workerId: safeWorkerId,
            inviteStart: timeWindow.start,
            inviteEnd: timeWindow.end,
        });
        if (conflictCheck.conflict) {
            return res.status(409).json({ message: conflictCheck.reason || 'Worker is already busy for the selected time.' });
        }

        const pricing = await getDirectHireSuggestedPricing({
            skill,
            location,
            scheduledDate,
            scheduledTime,
            durationValue: durationNum,
            durationUnit: normalizedUnit,
        });

        const fetchedAmountNum = normalizeMoney(fetchedAmount);
        const expectedAmountNum = normalizeMoney(expectedAmount);
        if (fetchedAmountNum <= 0) {
            return res.status(400).json({ message: 'Please fetch amount first before sending direct hire.' });
        }
        if (expectedAmountNum <= 0) {
            return res.status(400).json({ message: 'Amount must be greater than 0.' });
        }

        const suggestedAmount = normalizeMoney(pricing.suggestedAmount);
        const fetchDeltaPercent = Math.abs((fetchedAmountNum - suggestedAmount) / Math.max(1, suggestedAmount)) * 100;
        if (fetchDeltaPercent > 5) {
            return res.status(400).json({ message: 'Fetched amount is stale. Please click Get Amount again.' });
        }

        const minAllowed = Math.max(1, Math.round(fetchedAmountNum * 0.8));
        const maxAllowed = Math.max(minAllowed, Math.round(fetchedAmountNum * 1.3));
        if (expectedAmountNum < minAllowed || expectedAmountNum > maxAllowed) {
            return res.status(400).json({
                message: `Amount must stay between −20% and +30% of fetched amount (₹${minAllowed} - ₹${maxAllowed}).`,
            });
        }

        const normalizedPaymentMode = ['cash', 'upi', 'bank_transfer', 'online'].includes(String(paymentMode || '').toLowerCase())
            ? String(paymentMode).toLowerCase()
            : 'cash';

        const client = await User.findById(req.user.id).select('name mobile photo address karigarId');
        const amountNum = expectedAmountNum;
        const jobTitle = `${String(skill).trim()} - Direct Hire`;

        const job = await Job.create({
            postedBy: req.user.id,
            title: jobTitle,
            category: 'direct_hire',
            description: String(oneLineJD).trim(),
            shortDescription: String(oneLineJD).trim(),
            detailedDescription: String(oneLineJD).trim(),
            skills: [String(skill).trim()],
            payment: amountNum,
            paymentMethod: normalizedPaymentMode,
            negotiable: true,
            minBudget: amountNum,
            duration: `${durationNum} ${normalizedUnit.replace('/', '')}`,
            workersRequired: 1,
            urgent: false,
            location,
            scheduledDate: new Date(scheduledDate),
            scheduledTime,
            status: 'open',
            applicationsOpen: false,
            visibility: true,
            hireMode: 'direct',
            invitedWorkers: [{ workerId: worker._id, inviteSkill: String(skill).trim(), invitedAt: new Date() }],
            workerSlots: [{ skill: String(skill).trim(), hoursEstimated: durationNum * unitHours(normalizedUnit), status: 'open' }],
            directHire: {
                workerId: worker._id,
                workerPhoneType: worker.phoneType || 'Smartphone',
                durationValue: durationNum,
                durationUnit: normalizedUnit,
                expectedStartAt: timeWindow.start,
                expectedEndAt: timeWindow.end,
                fetchedAmount: fetchedAmountNum,
                amountEditLimitPercent: 30,
                minEditableAmount: minAllowed,
                maxEditableAmount: maxAllowed,
                fetchedRateSource: pricing.source || 'fallback',
                fetchedAt: new Date(),
                fetchedBaseAmount: pricing.baseAmount || fetchedAmountNum,
                appliedDemandMultiplier: Number(pricing.demandMultiplier || 1),
                expectedAmount: amountNum,
                paymentMode: normalizedPaymentMode,
                oneLineJD: String(oneLineJD).trim(),
                requestSentAt: new Date(),
                requestStatus: 'requested',
                paymentStatus: 'pending',
                blockedSections: DIRECT_HIRE_SECTIONS,
                clientLockAppliedAt: new Date(),
            },
        });

        await touchClientLock(req.user.id, job._id, `Direct hire pending payment for ${job.title}`);
        await notifyClientAndWorkerOnRequest(job, worker, client);

        return res.status(201).json({
            message: 'Direct hire ticket created.',
            job,
        });
    } catch (err) {
        console.error('createDirectHireTicket:', err);
        return res.status(500).json({ message: 'Failed to create direct hire ticket.' });
    }
};

exports.getClientDirectHireTickets = async (req, res) => {
    try {
        const jobs = await Job.find({ postedBy: req.user.id, hireMode: 'direct' })
            .populate('directHire.workerId', 'name mobile photo phoneType karigarId avgStars totalRatings points')
            .populate('workerSlots.assignedWorker', 'name mobile photo karigarId')
            .sort({ createdAt: -1 });
        return res.json({ jobs });
    } catch (err) {
        console.error('getClientDirectHireTickets:', err);
        return res.status(500).json({ message: 'Failed to load direct hire tickets.' });
    }
};

exports.getWorkerDirectHireTickets = async (req, res) => {
    try {
        const jobs = await Job.find({ 'directHire.workerId': req.user.id, hireMode: 'direct' })
            .populate('postedBy', 'name mobile photo address karigarId')
            .populate('directHire.workerId', 'name mobile photo phoneType karigarId')
            .populate('workerSlots.assignedWorker', 'name mobile photo karigarId')
            .sort({ createdAt: -1 });
        return res.json({ jobs });
    } catch (err) {
        console.error('getWorkerDirectHireTickets:', err);
        return res.status(500).json({ message: 'Failed to load direct hire tickets.' });
    }
};

exports.acceptDirectHireTicket = async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await findDirectHireJob(jobId, null, req.user.id);
        if (!job) return res.status(404).json({ message: 'Direct hire ticket not found.' });
        if (!workerLooksSmartphone({ phoneType: job.directHire?.workerPhoneType })) {
            return res.status(400).json({ message: 'Direct hire is allowed only for smartphone workers.' });
        }
        if (String(job.directHire?.requestStatus || '') !== 'requested') {
            return res.status(400).json({ message: 'This direct hire ticket is no longer pending.' });
        }

        const inviteStart = job.directHire?.expectedStartAt ? new Date(job.directHire.expectedStartAt) : null;
        const inviteEnd = job.directHire?.expectedEndAt ? new Date(job.directHire.expectedEndAt) : null;
        if (!inviteStart || !inviteEnd) {
            return res.status(400).json({ message: 'This invite has invalid schedule window.' });
        }
        const conflictCheck = await hasWorkerScheduleConflict({
            workerId: req.user.id,
            inviteStart,
            inviteEnd,
            excludeJobId: job._id,
        });
        if (conflictCheck.conflict) {
            return res.status(409).json({ message: conflictCheck.reason || 'Cannot accept due to overlapping schedule.' });
        }

        const slot = job.workerSlots?.[0] || null;
        if (slot) {
            slot.assignedWorker = req.user.id;
            slot.status = 'filled';
            slot.completedAt = null;
            slot.actualStartTime = null;
            slot.actualEndTime = null;
        }

        job.assignedTo = [req.user.id];
        job.status = 'scheduled';
        job.applicationsOpen = false;
        job.directHire.requestStatus = 'accepted';
        job.directHire.requestRejectedReason = '';
        job.directHire.requestRejectedAt = null;
        job.directHire.requestSentAt = job.directHire.requestSentAt || new Date();
        await job.save();

        await createNotification({
            userId: job.postedBy._id || job.postedBy,
            type: 'hired',
            title: 'Direct Hire Accepted',
            message: `${job.directHire.workerId?.name || 'Worker'} accepted your direct hire for "${job.title}".`,
            jobId: job._id,
            data: { hireMode: 'direct' },
        });

        return res.json({ message: 'Direct hire accepted.', job });
    } catch (err) {
        console.error('acceptDirectHireTicket:', err);
        return res.status(500).json({ message: 'Failed to accept direct hire.' });
    }
};

exports.rejectDirectHireTicket = async (req, res) => {
    try {
        const { jobId } = req.params;
        const { reason = '' } = req.body;
        const job = await findDirectHireJob(jobId, null, req.user.id);
        if (!job) return res.status(404).json({ message: 'Direct hire ticket not found.' });

        job.directHire.requestStatus = 'rejected';
        job.directHire.requestRejectedReason = String(reason || '').trim();
        job.directHire.requestRejectedAt = new Date();
        job.status = 'open';
        job.assignedTo = [];
        if (job.workerSlots?.[0]) {
            job.workerSlots[0].assignedWorker = null;
            job.workerSlots[0].status = 'open';
        }
        await job.save();

        await createNotification({
            userId: job.postedBy._id || job.postedBy,
            type: 'job_rejected',
            title: 'Direct Hire Rejected',
            message: `${job.directHire.workerId?.name || 'Worker'} rejected your direct hire for "${job.title}".${reason ? ` Reason: ${reason}.` : ''}`,
            jobId: job._id,
            data: { hireMode: 'direct', rejectedReason: reason || '' },
        });

        return res.json({ message: 'Direct hire rejected.', job });
    } catch (err) {
        console.error('rejectDirectHireTicket:', err);
        return res.status(500).json({ message: 'Failed to reject direct hire.' });
    }
};

exports.logDirectHireCallIntent = async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await findDirectHireJob(jobId, req.user.id, null);
        if (!job) return res.status(404).json({ message: 'Direct hire ticket not found.' });
        job.directHire.callIntentAt = new Date();
        job.directHire.callIntentCount = (Number(job.directHire.callIntentCount) || 0) + 1;
        await job.save();
        return res.json({ message: 'Call intent recorded.', jobId: job._id });
    } catch (err) {
        console.error('logDirectHireCallIntent:', err);
        return res.status(500).json({ message: 'Failed to log call intent.' });
    }
};

exports.sendDirectHireStartOtp = async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await findDirectHireJob(jobId, req.user.id, null);
        if (!job) return res.status(404).json({ message: 'Direct hire ticket not found.' });
        if (String(job.directHire?.requestStatus || '') !== 'accepted') {
            return res.status(400).json({ message: 'Start OTP is allowed only after worker accepts the direct hire.' });
        }
        const worker = job.directHire.workerId;
        if (!worker?.mobile) return res.status(400).json({ message: 'Worker phone number is not available.' });

        const otp = makeOtp();
        job.directHire.startOtpHash = hashOtp(otp);
        job.directHire.startOtpExpiry = new Date(Date.now() + OTP_TTL_MS);
        job.directHire.startOtpAttempts = 0;
        await job.save();

        await sendOtpSms(worker.mobile, otp);
        await createNotification({
            userId: job.postedBy,
            type: 'job_update',
            title: 'Start OTP Sent',
            message: `Start OTP sent to ${worker.name || 'worker'} for "${job.title}". Ask the worker to share it with you and enter it to start the job.`,
            jobId: job._id,
        });

        return res.json({ message: 'Start OTP sent to worker phone.' });
    } catch (err) {
        console.error('sendDirectHireStartOtp:', err);
        return res.status(500).json({ message: 'Failed to send start OTP.' });
    }
};

exports.verifyDirectHireStartOtp = async (req, res) => {
    try {
        const { jobId } = req.params;
        const { otp } = req.body;
        const job = await findDirectHireJob(jobId, req.user.id, null);
        if (!job) return res.status(404).json({ message: 'Direct hire ticket not found.' });
        if (String(job.directHire?.requestStatus || '') !== 'accepted') {
            return res.status(400).json({ message: 'Worker must accept the direct hire before starting the job.' });
        }
        if (!otp?.trim()) return res.status(400).json({ message: 'OTP is required.' });

        if (!job.directHire.startOtpHash || !job.directHire.startOtpExpiry) {
            return res.status(400).json({ message: 'Start OTP not requested yet.' });
        }
        if (Date.now() > new Date(job.directHire.startOtpExpiry).getTime()) {
            return res.status(400).json({ message: 'Start OTP expired. Please resend it.' });
        }
        if (job.directHire.startOtpAttempts >= 3) {
            return res.status(429).json({ message: 'Too many invalid attempts. Please resend the OTP.' });
        }

        job.directHire.startOtpAttempts = (Number(job.directHire.startOtpAttempts) || 0) + 1;
        if (hashOtp(otp) !== String(job.directHire.startOtpHash || '')) {
            await job.save();
            return res.status(400).json({ message: 'Invalid OTP.' });
        }

        job.directHire.startOtpVerifiedAt = new Date();
        job.directHire.startOtpHash = '';
        job.directHire.startOtpExpiry = null;
        job.status = 'running';
        job.actualStartTime = job.actualStartTime || new Date();
        if (job.workerSlots?.[0] && !job.workerSlots[0].actualStartTime) {
            job.workerSlots[0].actualStartTime = new Date();
            job.workerSlots[0].status = 'filled';
        }
        await job.save();

        await createNotification({
            userId: job.postedBy,
            type: 'job_update',
            title: 'Job Started',
            message: `Direct hire job "${job.title}" has started.`,
            jobId: job._id,
        });

        return res.json({ message: 'Job started successfully.', job });
    } catch (err) {
        console.error('verifyDirectHireStartOtp:', err);
        return res.status(500).json({ message: 'Failed to verify start OTP.' });
    }
};

exports.sendDirectHireCompletionOtp = async (req, res) => {
    try {
        const { jobId } = req.params;
        const { finalPaidPrice, paymentMode, paymentEditReason = '' } = req.body;
        const job = await findDirectHireJob(jobId, req.user.id, null);
        if (!job) return res.status(404).json({ message: 'Direct hire ticket not found.' });
        if (String(job.directHire?.requestStatus || '') !== 'accepted') {
            return res.status(400).json({ message: 'Completion OTP is allowed only for accepted direct hires.' });
        }
        if (String(job.status || '') !== 'running') {
            return res.status(400).json({ message: 'Job must be started before sending completion OTP.' });
        }
        const worker = job.directHire.workerId;
        if (!worker?.mobile) return res.status(400).json({ message: 'Worker phone number is not available.' });

        const fallbackAmount = Number(job.directHire.paymentAmount || job.directHire.expectedAmount) || 0;
        const paidAmount = Math.round(Number(finalPaidPrice));
        const safePaidAmount = Number.isFinite(paidAmount) && paidAmount > 0 ? paidAmount : Math.round(fallbackAmount);
        if (!safePaidAmount || safePaidAmount <= 0) {
            return res.status(400).json({ message: 'Final paid amount must be greater than 0.' });
        }

        const normalizedPaymentMode = ['cash', 'upi', 'bank_transfer', 'online'].includes(String(paymentMode || '').toLowerCase())
            ? String(paymentMode).toLowerCase()
            : (job.directHire.paymentMode || 'cash');

        job.directHire.paymentAmount = safePaidAmount;
        job.directHire.paymentMode = normalizedPaymentMode;
        job.directHire.paymentEditReason = String(paymentEditReason || '').trim();
        job.directHire.paymentStatus = 'pending';
        job.directHire.workerPaymentApprovalStatus = 'pending';
        const otp = makeOtp();
        job.directHire.completionOtpHash = hashOtp(otp);
        job.directHire.completionOtpExpiry = new Date(Date.now() + OTP_TTL_MS);
        job.directHire.completionOtpAttempts = 0;
        await job.save();

        await sendOtpSms(worker.mobile, otp);
        await createNotification({
            userId: job.postedBy,
            type: 'job_update',
            title: 'Completion OTP Sent',
            message: `Completion OTP sent to ${worker.name || 'worker'} for "${job.title}". Enter it after payment to finish the job.`,
            jobId: job._id,
        });

        return res.json({ message: 'Completion OTP sent to worker phone.', paymentAmount: safePaidAmount });
    } catch (err) {
        console.error('sendDirectHireCompletionOtp:', err);
        return res.status(500).json({ message: 'Failed to send completion OTP.' });
    }
};

exports.verifyDirectHireCompletionOtp = async (req, res) => {
    try {
        const { jobId } = req.params;
        const { otp } = req.body;
        const job = await findDirectHireJob(jobId, req.user.id, null);
        if (!job) return res.status(404).json({ message: 'Direct hire ticket not found.' });
        if (String(job.directHire?.requestStatus || '') !== 'accepted') {
            return res.status(400).json({ message: 'Completion is allowed only for accepted direct hires.' });
        }
        if (!otp?.trim()) return res.status(400).json({ message: 'OTP is required.' });

        if (!job.directHire.completionOtpHash || !job.directHire.completionOtpExpiry) {
            return res.status(400).json({ message: 'Completion OTP not requested yet.' });
        }
        if (Date.now() > new Date(job.directHire.completionOtpExpiry).getTime()) {
            return res.status(400).json({ message: 'Completion OTP expired. Please resend it.' });
        }
        if (job.directHire.completionOtpAttempts >= 3) {
            return res.status(429).json({ message: 'Too many invalid attempts. Please resend the OTP.' });
        }

        job.directHire.completionOtpAttempts = (Number(job.directHire.completionOtpAttempts) || 0) + 1;
        if (hashOtp(otp) !== String(job.directHire.completionOtpHash || '')) {
            await job.save();
            return res.status(400).json({ message: 'Invalid OTP.' });
        }

        job.directHire.completionOtpVerifiedAt = new Date();
        job.directHire.completionOtpHash = '';
        job.directHire.completionOtpExpiry = null;
        job.directHire.paymentStatus = 'paid';
        job.directHire.workerPaymentApprovalStatus = 'approved';
        job.directHire.paymentConfirmedAt = new Date();
        job.directHire.clientUnlockedAt = new Date();
        job.directHire.adminEscalatedAt = job.directHire.adminEscalatedAt || null;
        job.status = 'completed';
        job.actualEndTime = job.actualEndTime || new Date();
        if (job.workerSlots?.[0]) {
            job.workerSlots[0].status = 'task_completed';
            job.workerSlots[0].completedAt = job.workerSlots[0].completedAt || new Date();
            job.workerSlots[0].actualEndTime = job.workerSlots[0].actualEndTime || new Date();
            job.workerSlots[0].finalPaidPrice = job.directHire.paymentAmount || 0;
        }
        await job.save();

        await createNotification({
            userId: job.postedBy,
            type: 'job_completed',
            title: 'Payment Completed',
            message: `Direct hire job "${job.title}" has been marked complete and payment is confirmed.`,
            jobId: job._id,
        });
        await createNotification({
            userId: job.directHire.workerId?._id || job.directHire.workerId,
            type: 'job_completed',
            title: 'Job Completed',
            message: `Your direct hire job "${job.title}" has been completed and payment is confirmed.`,
            jobId: job._id,
        });

        await clearClientLockIfPossible(job.postedBy._id || job.postedBy);
        return res.json({ message: 'Job completed and payment confirmed.', job });
    } catch (err) {
        console.error('verifyDirectHireCompletionOtp:', err);
        return res.status(500).json({ message: 'Failed to verify completion OTP.' });
    }
};

exports.listAdminPendingDirectHirePayments = async (req, res) => {
    try {
        const jobs = await Job.find({
            hireMode: 'direct',
            'directHire.paymentStatus': { $ne: 'paid' },
            'directHire.requestStatus': { $in: ['accepted', 'requested'] },
        })
            .populate('postedBy', 'name mobile photo address karigarId')
            .populate('directHire.workerId', 'name mobile photo phoneType karigarId')
            .sort({ updatedAt: -1 });

        const now = Date.now();
        const rows = jobs
            .map((job) => {
                const expectedEndAt = job.directHire?.expectedEndAt ? new Date(job.directHire.expectedEndAt) : null;
                const overdueMinutes = expectedEndAt ? Math.floor((now - expectedEndAt.getTime()) / 60000) : null;
                return {
                    job,
                    expectedEndAt,
                    overdueMinutes,
                    pendingAdminNotice: overdueMinutes !== null && overdueMinutes >= LOCK_GRACE_MINUTES,
                    pendingClientNotice: overdueMinutes !== null && overdueMinutes >= CLIENT_NOTICE_MINUTES,
                };
            })
            .filter((row) => row.pendingAdminNotice);

        return res.json({ jobs: rows });
    } catch (err) {
        console.error('listAdminPendingDirectHirePayments:', err);
        return res.status(500).json({ message: 'Failed to load pending direct hire payments.' });
    }
};

exports.unblockClientFromDirectHire = async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await Job.findOne({ _id: jobId, hireMode: 'direct' });
        if (!job) return res.status(404).json({ message: 'Direct hire ticket not found.' });
        await User.findByIdAndUpdate(job.postedBy, {
            $set: {
                'paymentLock.active': false,
                'paymentLock.sections': [],
                'paymentLock.reason': '',
                'paymentLock.updatedAt': new Date(),
            },
        });
        job.directHire.clientUnlockedAt = new Date();
        await job.save();
        await createNotification({
            userId: job.postedBy,
            type: 'job_update',
            title: 'Access Restored',
            message: `Your access has been restored for direct hire job "${job.title}".`,
            jobId: job._id,
        });
        return res.json({ message: 'Client access restored.' });
    } catch (err) {
        console.error('unblockClientFromDirectHire:', err);
        return res.status(500).json({ message: 'Failed to unblock client.' });
    }
};

exports.sweepDirectHirePayments = async () => {
    const jobs = await Job.find({
        hireMode: 'direct',
        'directHire.paymentStatus': { $ne: 'paid' },
        'directHire.requestStatus': { $in: ['accepted', 'requested'] },
    })
        .populate('postedBy', 'name mobile photo address karigarId')
        .populate('directHire.workerId', 'name mobile photo phoneType karigarId')
        .sort({ updatedAt: -1 });

    const now = Date.now();
    let touched = 0;

    for (const job of jobs) {
        const expectedEndAt = job.directHire?.expectedEndAt ? new Date(job.directHire.expectedEndAt) : null;
        if (!expectedEndAt) continue;
        const overdueMinutes = Math.floor((now - expectedEndAt.getTime()) / 60000);
        if (overdueMinutes < LOCK_GRACE_MINUTES) continue;

        const clientId = job.postedBy?._id || job.postedBy;
        const worker = job.directHire.workerId;
        const paymentLabel = `₹${Number(job.directHire?.paymentAmount || job.directHire?.expectedAmount || 0).toLocaleString('en-IN')}`;
        const workerName = worker?.name || 'worker';

        if (!job.directHire.adminEscalatedAt) {
            await touchClientLock(clientId, job._id, `Payment pending for direct hire job "${job.title}"`);
            await createNotification({
                userId: clientId,
                type: 'job_update',
                title: 'Payment Pending',
                message: `Please complete payment for ${workerName} on "${job.title}" (${paymentLabel}).`,
                jobId: job._id,
            });
            if (worker?.mobile) {
                await sendCustomSms(worker.mobile, `KarigarConnect: Payment is pending for "${job.title}". We have notified the client and admin.`);
            }
            job.directHire.adminEscalatedAt = new Date();
            job.directHire.paymentReminder30SentAt = job.directHire.paymentReminder30SentAt || new Date();
        }

        if (overdueMinutes >= CLIENT_NOTICE_MINUTES && !job.directHire.paymentReminder60SentAt) {
            const client = job.postedBy;
            if (client?.mobile) {
                await sendCustomSms(client.mobile, `KarigarConnect: Please complete payment for ${workerName} on "${job.title}" (${paymentLabel}).`);
            }
            await createNotification({
                userId: clientId,
                type: 'job_update',
                title: 'Please Complete Payment',
                message: `Please complete payment for ${workerName} on "${job.title}" (${paymentLabel}).`,
                jobId: job._id,
            });
            job.directHire.paymentReminder60SentAt = new Date();
        }

        await job.save();
        touched += 1;
    }

    return { touched };
};
