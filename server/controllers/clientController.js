// server/controllers/clientController.js
// FIX: Added sanitiseBudgetBreakdown() helper — normalises AI-generated
//      complexity values before Job.create() so Mongoose validation never fails.
//      AI can return: 'low' | 'light' | 'medium' | 'normal' | 'heavy'
//      Stored as:     'light' | 'normal' | 'heavy'
//
//      Mapping: low → light, light → light, medium → normal,
//               normal → normal, heavy → heavy, anything else → normal
//
// All other functionality is unchanged.

const Job       = require('../models/jobModel');
const User      = require('../models/userModel');
const Rating    = require('../models/ratingModel');
const AIHistory = require('../models/aiHistoryModel');
const Location  = require('../models/locationModel');
const { createNotification }           = require('../utils/notificationHelper');
const { checkWorkerScheduleConflict, validateWorkTime, canStartJob } = require('../utils/scheduleHelper');
const { logAuditEvent } = require('../utils/auditLogger');
const { sendCustomSms } = require('../utils/smsHelper');
const faceClient = require('../utils/faceServiceClient');

const parseJSON   = (v, fb) => { if (!v) return fb; try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return fb; } };
const validateNeg = (v, l)  => { const n = Number(v); if (!isNaN(n) && n < 0) return `${l} cannot be negative.`; return null; };
const ALERT_RADIUS_KM = 5;
const MAX_URGENT_ALERT_RECIPIENTS = 75;

// ── FIX: normalise AI complexity values ──────────────────────────────────────
const COMPLEXITY_MAP = {
    low:    'light',
    light:  'light',
    medium: 'normal',
    normal: 'normal',
    heavy:  'heavy',
};

/**
 * Sanitise budgetBreakdown before saving to MongoDB.
 * Normalises complexity strings the AI may return ('low', 'medium', etc.)
 * into the canonical set ('light', 'normal', 'heavy').
 * Safe to call with null / undefined — returns input unchanged.
 */
function sanitiseBudgetBreakdown(bd) {
    if (!bd) return bd;
    try {
        const parsed = typeof bd === 'string' ? JSON.parse(bd) : bd;
        if (Array.isArray(parsed?.breakdown)) {
            parsed.breakdown = parsed.breakdown.map(block => ({
                ...block,
                complexity: COMPLEXITY_MAP[block.complexity] ?? 'normal',
            }));
        }
        return parsed;
    } catch {
        return bd;
    }
}
// ─────────────────────────────────────────────────────────────────────────────

const normSkillName = (s) => String(s || '').toLowerCase().trim();
const normCityName = (s) => String(s || '').toLowerCase().trim();
const toFiniteNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
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

const getLatestWorkerLocationMap = async (workerIds = []) => {
    if (!workerIds.length) return new Map();
    const objectIds = workerIds.map((id) => id);
    const latest = await Location.aggregate([
        { $match: { workerId: { $in: objectIds }, 'workerLocation.lat': { $ne: null }, 'workerLocation.lng': { $ne: null } } },
        { $sort: { 'workerLocation.updatedAt': -1, updatedAt: -1 } },
        {
            $group: {
                _id: '$workerId',
                lat: { $first: '$workerLocation.lat' },
                lng: { $first: '$workerLocation.lng' },
                updatedAt: { $first: '$workerLocation.updatedAt' },
            },
        },
    ]);

    const map = new Map();
    latest.forEach((row) => {
        map.set(String(row._id), { lat: row.lat, lng: row.lng, updatedAt: row.updatedAt });
    });
    return map;
};

const getJobSkillSet = (job) => {
    const fromSkills = (job.skills || []).map(normSkillName).filter(Boolean);
    const fromSlots = (job.workerSlots || []).map((s) => normSkillName(s.skill)).filter(Boolean);
    return [...new Set([...fromSkills, ...fromSlots])];
};

const buildSmartWorkerSuggestions = async (job, { limit = 3, withinRadiusOnly = false } = {}) => {
    const skillSet = getJobSkillSet(job);
    const jobLat = toFiniteNumber(job.location?.lat);
    const jobLng = toFiniteNumber(job.location?.lng);
    const hasJobCoords = jobLat !== null && jobLng !== null;
    const jobCityNorm = normCityName(job.location?.city);

    const query = {
        role: 'worker',
        verificationStatus: 'approved',
        availability: true,
    };
    if (skillSet.length) query.skills = { $elemMatch: { name: { $in: skillSet } } };

    const candidates = await User.find(query)
        .select('name photo karigarId mobile points overallExperience skills address availability')
        .limit(200)
        .lean();

    if (!candidates.length) return [];

    const candidateIds = candidates.map((c) => c._id);
    const [ratings, locMap] = await Promise.all([
        Rating.aggregate([
            { $match: { worker: { $in: candidateIds } } },
            { $group: { _id: '$worker', avgStars: { $avg: '$stars' }, ratingCount: { $sum: 1 } } },
        ]),
        getLatestWorkerLocationMap(candidateIds),
    ]);

    const ratingMap = new Map(ratings.map((r) => [String(r._id), { avgStars: Number(r.avgStars || 0), ratingCount: Number(r.ratingCount || 0) }]));

    const scored = candidates.map((w) => {
        const wId = String(w._id);
        const r = ratingMap.get(wId) || { avgStars: 0, ratingCount: 0 };
        const loc = locMap.get(wId);
        const wLat = toFiniteNumber(loc?.lat);
        const wLng = toFiniteNumber(loc?.lng);
        const hasWorkerCoords = wLat !== null && wLng !== null;
        const distanceKm = hasJobCoords && hasWorkerCoords ? haversineKm(jobLat, jobLng, wLat, wLng) : null;
        const cityMatch = jobCityNorm && normCityName(w.address?.city) === jobCityNorm;
        const withinRadius = hasJobCoords && distanceKm !== null ? distanceKm <= ALERT_RADIUS_KM : !!cityMatch;

        const workerSkillSet = (w.skills || []).map((s) => normSkillName(s?.name || s)).filter(Boolean);
        const matchedSkills = skillSet.length ? skillSet.filter((s) => workerSkillSet.includes(s)) : workerSkillSet;

        const score = (withinRadius ? 100 : 0) + (r.avgStars * 20) + (Math.min(1000, Number(w.points || 0)) / 20) + matchedSkills.length * 4;

        return {
            ...w,
            avgStars: r.avgStars,
            ratingCount: r.ratingCount,
            matchedSkills,
            distanceKm: distanceKm !== null ? Number(distanceKm.toFixed(2)) : null,
            withinRadius,
            score,
        };
    });

    const filtered = withinRadiusOnly ? scored.filter((w) => w.withinRadius) : scored;
    return filtered
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((w) => ({
            _id: w._id,
            name: w.name,
            photo: w.photo,
            karigarId: w.karigarId,
            mobile: w.mobile,
            points: w.points || 0,
            overallExperience: w.overallExperience || '',
            avgStars: Number((w.avgStars || 0).toFixed(2)),
            ratingCount: w.ratingCount || 0,
            matchedSkills: w.matchedSkills,
            distanceKm: w.distanceKm,
            withinRadius: w.withinRadius,
        }));
};

const notifyUrgentNearbyWorkers = async (job) => {
    const nearby = await buildSmartWorkerSuggestions(job, {
        limit: MAX_URGENT_ALERT_RECIPIENTS,
        withinRadiusOnly: true,
    });

    for (const worker of nearby) {
        await createNotification({
            userId: worker._id,
            type: 'urgent_job',
            title: 'Urgent Job Near You',
            message: `A nearby urgent job is open: "${job.title}" in ${job.location?.city || 'your area'}.`,
            jobId: job._id,
            data: {
                urgent: true,
                distanceKm: worker.distanceKm,
                matchedSkills: worker.matchedSkills,
            },
        });
    }

    return nearby;
};

const buildWorkerSlots = (bd, skills = [], wr = 1) => {
    const slots = [];
    if (bd?.breakdown?.length) {
        for (const b of bd.breakdown) {
            const count = Math.max(1, Number(b.count) || 1);
            const perH  = Math.max(1, Math.round(Math.max(1, Number(b.hours) || 8) / count));
            for (let i = 0; i < count; i++) slots.push({ skill: (b.skill || 'general').toLowerCase().trim(), hoursEstimated: perH, assignedWorker: null, status: 'open' });
        }
    } else if (skills.length) {
        skills.forEach(s => slots.push({ skill: s.toLowerCase().trim(), hoursEstimated: 8, assignedWorker: null, status: 'open' }));
    } else {
        for (let i = 0; i < Math.max(1, wr); i++) slots.push({ skill: 'general', hoursEstimated: 8, assignedWorker: null, status: 'open' });
    }
    return slots;
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-MAINTENANCE
// ─────────────────────────────────────────────────────────────────────────────
const runAutoMaintenance = async (jobs) => {
    const now = Date.now();
    for (const job of jobs) {
        let changed = false;

        // 1. Auto-start when scheduled time reached
        if (job.status === 'scheduled' && job.scheduledDate && job.scheduledTime) {
            const [h, m] = job.scheduledTime.split(':').map(Number);
            const sched  = new Date(job.scheduledDate); sched.setHours(h, m, 0, 0);
            if (now >= sched.getTime() && job.assignedTo.length > 0) {
                job.status = 'running'; job.actualStartTime = sched; job.applicationsOpen = false;
                job.workerSlots.forEach(s => { if (s.status === 'filled') s.actualStartTime = sched; });
                for (const wId of job.assignedTo) {
                    await createNotification({ userId: wId, type: 'job_update', title: 'Job Started ⏰', message: `"${job.title}" has automatically started at the scheduled time.` });
                }
                changed = true;
            }
        }

        // 2. Pre-start (30 min before): warn client about unfilled slots — send ONCE
        if (job.status === 'scheduled' && !job.preStartNotificationSent && job.scheduledDate && job.scheduledTime) {
            const [h, m]   = job.scheduledTime.split(':').map(Number);
            const sched    = new Date(job.scheduledDate); sched.setHours(h, m, 0, 0);
            const minsLeft = (sched.getTime() - now) / 60000;
            if (minsLeft > 0 && minsLeft <= 30) {
                const unfilled = job.unfilledSkills();
                if (unfilled.length > 0) {
                    await createNotification({
                        userId:  job.postedBy,
                        type:    'reminder',
                        title:   '⚠️ Missing Workers — Job starts soon',
                        message: `"${job.title}" starts in ${Math.floor(minsLeft)} min. Unfilled skills: ${unfilled.join(', ')}. Open the dashboard to repost or remove these requirements.`,
                    });
                    job.preStartNotificationSent = true;
                    changed = true;
                }
            }
        }

        // 3. Auto-mark slots done after (estimated hours + 1hr grace)
        if (job.status === 'running' && job.actualStartTime) {
            for (const slot of job.workerSlots) {
                if (slot.status === 'filled' && slot.assignedWorker && !slot.autoCompleted) {
                    const startMs = new Date(slot.actualStartTime || job.actualStartTime).getTime();
                    const autoAt  = startMs + (slot.hoursEstimated * 3600 * 1000) + 3600 * 1000;
                    if (now >= autoAt) {
                        slot.status = 'task_completed'; slot.completedAt = new Date(autoAt);
                        slot.actualEndTime = new Date(autoAt); slot.autoCompleted = true; changed = true;
                        await createNotification({ userId: job.postedBy, type: 'job_update', title: 'Worker Auto-Completed', message: `${slot.skill} task for "${job.title}" auto-completed (1hr after estimated end).` });
                        if (slot.assignedWorker) await createNotification({ userId: slot.assignedWorker, type: 'job_update', title: 'Your Task Is Complete', message: `Your ${slot.skill} task for "${job.title}" was automatically completed. You are free for new jobs.` });
                    }
                }
            }
        }

        // 4. Remind client to complete job (30 min after estimated end)
        if (job.status === 'running' && !job.clientNotifiedCompletion && job.actualStartTime) {
            const endMs = job.estimatedJobEndMs ? job.estimatedJobEndMs() : null;
            if (endMs && now >= endMs + 30 * 60 * 1000) {
                await createNotification({ userId: job.postedBy, type: 'reminder', title: 'Please Complete the Job ⏰', message: `Estimated work time for "${job.title}" has passed. Upload photos, rate workers, and mark complete.` });
                job.clientNotifiedCompletion = true; changed = true;
            }
        }

        if (changed) { try { await job.save(); } catch (e) { console.error('Auto-maintenance:', e.message); } }
    }
};

const mapSubTaskForClient = (subTask) => {
    const primarySlot = subTask.workerSlots?.[0] || {};
    let status = 'open';
    if (['cancelled', 'cancelled_by_client'].includes(subTask.status) || primarySlot.status === 'cancelled') {
        status = 'cancelled';
    } else if (subTask.status === 'completed' || primarySlot.status === 'task_completed') {
        status = 'task_completed';
    } else if (subTask.status === 'running') {
        status = 'running';
    } else if (subTask.status === 'scheduled' || primarySlot.status === 'filled') {
        status = 'scheduled';
    }

    return {
        _id:             subTask._id,
        title:           subTask.title,
        skill:           subTask.subTaskSkill || primarySlot.skill || subTask.skills?.[0] || 'general',
        hoursEstimated:  primarySlot.hoursEstimated || 8,
        assignedWorker:  primarySlot.assignedWorker || null,
        status,
        ratingSubmitted: !!primarySlot.ratingSubmitted,
        scheduledDate:   subTask.scheduledDate,
        scheduledTime:   subTask.scheduledTime,
        applicants:      subTask.applicants || [],
        payment:         subTask.payment || 0,
    };
};

const attachSubTasksToParents = async (parentJobs, clientId) => {
    const parentIds = parentJobs.map(j => j._id);
    if (!parentIds.length) return parentJobs.map(j => ({ ...j.toObject(), subTasks: [] }));

    const subTasks = await Job.find({ postedBy: clientId, parentJobId: { $in: parentIds } })
        .populate('applicants.workerId',        'name photo karigarId points overallExperience skills verificationStatus mobile')
        .populate('workerSlots.assignedWorker', 'name photo karigarId points mobile')
        .sort({ createdAt: -1 });

    const grouped = {};
    subTasks.forEach(st => {
        const pId = st.parentJobId?.toString();
        if (!pId) return;
        if (!grouped[pId]) grouped[pId] = [];
        grouped[pId].push(mapSubTaskForClient(st));
    });

    return parentJobs.map(j => ({
        ...j.toObject(),
        subTasks: grouped[j._id.toString()] || [],
    }));
};

const loadParentJobWithSubTasks = async (parentId, clientId) => {
    const parents = await Job.find({ _id: parentId, postedBy: clientId, parentJobId: null })
        .populate('assignedTo',                'name photo karigarId points overallExperience mobile')
        .populate('applicants.workerId',        'name photo karigarId points overallExperience')
        .populate('workerSlots.assignedWorker', 'name photo karigarId points mobile')
        .populate('parentJobId',                'title');
    if (!parents.length) return null;
    const [enriched] = await attachSubTasksToParents(parents, clientId);
    return enriched;
};

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT FACE VERIFICATION FOR ASSIGNED WORKER
// ─────────────────────────────────────────────────────────────────────────────
exports.verifyAssignedWorkerFace = async (req, res) => {
    try {
        const livePhoto = req.file;
        if (!livePhoto?.buffer) {
            return res.status(400).json({ message: 'Live face photo is required.' });
        }

        const serviceAvailable = await faceClient.isAvailable();
        if (!serviceAvailable) {
            return res.status(503).json({ message: 'Face verification service is unavailable. Please try again shortly.' });
        }

        const liveResult = await faceClient.extractEmbedding(
            livePhoto.buffer,
            livePhoto.originalname || 'live_face.jpg'
        );

        if (!liveResult?.face_detected || !Array.isArray(liveResult?.embedding)) {
            return res.status(400).json({ message: 'Face not detected. Please keep face clear and centered.' });
        }

        const activeJobs = await Job.find({
            postedBy: req.user.id,
            status: { $in: ['scheduled', 'running'] },
        }).select('title status scheduledDate scheduledTime workerSlots');

        const workerTaskMap = new Map();
        for (const job of activeJobs) {
            for (const slot of (job.workerSlots || [])) {
                const wid = slot?.assignedWorker?.toString?.();
                if (!wid) continue;
                if (!workerTaskMap.has(wid)) workerTaskMap.set(wid, []);
                workerTaskMap.get(wid).push({
                    jobId: job._id,
                    jobTitle: job.title,
                    jobStatus: job.status,
                    skill: slot.skill || 'general',
                    slotStatus: slot.status,
                    scheduledDate: job.scheduledDate || null,
                    scheduledTime: job.scheduledTime || '',
                });
            }
        }

        const workerIds = [...workerTaskMap.keys()];
        if (!workerIds.length) {
            return res.status(404).json({ message: 'No assigned workers found in your active jobs.' });
        }

        const workers = await User.find({
            _id: { $in: workerIds },
            role: 'worker',
        }).select('name karigarId mobile photo skills points overallExperience +faceEmbedding');

        const candidates = workers.filter(w => Array.isArray(w.faceEmbedding) && w.faceEmbedding.length > 0);
        if (!candidates.length) {
            return res.status(404).json({ message: 'No assigned workers have face data available for matching.' });
        }

        const ratingRows = await Rating.aggregate([
            { $match: { worker: { $in: candidates.map(w => w._id) } } },
            { $group: { _id: '$worker', avgStars: { $avg: '$stars' }, totalRatings: { $sum: 1 } } },
        ]);
        const ratingMap = new Map(ratingRows.map(r => [r._id.toString(), r]));

        let bestMatch = null;
        for (const worker of candidates) {
            const cmp = await faceClient.compareEmbeddings(liveResult.embedding, worker.faceEmbedding);
            const similarity = Number(cmp?.similarity || 0);
            if (!bestMatch || similarity > bestMatch.similarity) {
                bestMatch = { worker, similarity };
            }
        }

        const threshold = Number(faceClient.WORKER_THRESHOLD || 0.5);
        if (!bestMatch || bestMatch.similarity < threshold) {
            return res.json({
                verified: false,
                threshold,
                bestSimilarity: bestMatch ? Number(bestMatch.similarity.toFixed(4)) : 0,
                message: 'No matching assigned worker found.',
            });
        }

        const matchedWorker = bestMatch.worker;
        const matchedTasks = (workerTaskMap.get(matchedWorker._id.toString()) || [])
            .sort((a, b) => {
                const rank = v => (v === 'running' ? 0 : v === 'scheduled' ? 1 : 2);
                return rank(a.jobStatus) - rank(b.jobStatus);
            });

        const ratingInfo = ratingMap.get(matchedWorker._id.toString());

        return res.json({
            verified: true,
            threshold,
            similarity: Number(bestMatch.similarity.toFixed(4)),
            worker: {
                id: matchedWorker._id,
                name: matchedWorker.name,
                karigarId: matchedWorker.karigarId,
                mobile: matchedWorker.mobile,
                photo: matchedWorker.photo,
                points: matchedWorker.points || 0,
                overallExperience: matchedWorker.overallExperience || '',
                avgStars: ratingInfo ? Number((ratingInfo.avgStars || 0).toFixed(2)) : 0,
                totalRatings: ratingInfo?.totalRatings || 0,
            },
            currentAssignedTasks: matchedTasks,
        });
    } catch (err) {
        console.error('verifyAssignedWorkerFace:', err);
        return res.status(500).json({ message: 'Failed to verify worker face.' });
    }
};

const syncParentFromSubTaskAssignment = (parentJob, subTask, workerId) => {
    const subTaskId = subTask._id?.toString();
    const skill = (subTask.subTaskSkill || subTask.workerSlots?.[0]?.skill || '').toLowerCase();

    const targetSlot = parentJob.workerSlots.find(s => s.subTaskJobId?.toString() === subTaskId)
        || parentJob.workerSlots.find(s => s.status === 'reposted' && s.skill === skill);

    if (targetSlot) {
        targetSlot.assignedWorker = workerId;
        targetSlot.status = 'filled';
    }

    if (!parentJob.assignedTo.map(id => id.toString()).includes(workerId)) {
        parentJob.assignedTo.push(workerId);
    }

    if (subTask.scheduledDate) parentJob.scheduledDate = subTask.scheduledDate;
    if (subTask.scheduledTime) parentJob.scheduledTime = subTask.scheduledTime;

    if (parentJob.status === 'open') parentJob.status = 'scheduled';
    parentJob.applicationsOpen = parentJob.workerSlots.some(s => s.status === 'open');
};

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────────────────────
exports.getClientProfile = async (req, res) => {
    try {
        const c = await User.findOne({ _id: req.user.id, role: 'client' }).select('-password -resetPasswordToken -resetPasswordExpire');
        if (!c) return res.status(404).json({ message: 'Client not found.' });
        return res.json(c);
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.updateClientProfile = async (req, res) => {
    try {
        const c = await User.findById(req.user.id);
        if (!c || c.role !== 'client') return res.status(404).json({ message: 'Not found.' });
        if (req.body.email          !== undefined) c.email          = req.body.email;
        if (req.body.workplaceInfo  !== undefined) c.workplaceInfo  = req.body.workplaceInfo;

        c.address = c.address || {};
        if (req.body.city          !== undefined) c.address.city          = req.body.city;
        if (req.body.pincode       !== undefined) c.address.pincode       = req.body.pincode;
        if (req.body.homeLocation  !== undefined) c.address.homeLocation  = req.body.homeLocation;
        if (req.body.houseNumber   !== undefined) c.address.houseNumber   = req.body.houseNumber;

        if (req.file) c.photo = req.file.path;
        await c.save();
        await logAuditEvent({ userId: c._id, role: 'client', action: 'profile_update', req, metadata: { fields: Object.keys(req.body || {}) } });
        return res.json(await User.findById(c._id).select('-password -resetPasswordToken -resetPasswordExpire'));
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET CLIENT JOBS
// ─────────────────────────────────────────────────────────────────────────────
exports.getClientJobs = async (req, res) => {
    try {
        const jobs = await Job.find({ postedBy: req.user.id, parentJobId: null })
            .populate('assignedTo',                'name photo karigarId points overallExperience mobile')
            .populate('applicants.workerId',        'name photo karigarId points overallExperience')
            .populate('workerSlots.assignedWorker', 'name photo karigarId points mobile')
            .populate('parentJobId',                'title')
            .sort({ createdAt: -1 });
        try { await runAutoMaintenance(jobs); } catch (e) { console.error('Auto-maintenance error:', e.message); }
        const jobsWithSubTasks = await attachSubTasksToParents(jobs, req.user.id);
        return res.json(jobsWithSubTasks);
    } catch { return res.status(500).json({ message: 'Failed to fetch jobs.' }); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST JOB
// FIX: sanitiseBudgetBreakdown(pBD) normalises complexity before Job.create()
// ─────────────────────────────────────────────────────────────────────────────
exports.postJob = async (req, res) => {
    try {
        const {
            title, description, shortDescription, detailedDescription,
            skills, payment, duration, workersRequired, location,
            scheduledDate, scheduledTime, budgetBreakdown, totalEstimatedCost,
            negotiable, minBudget, shift, qaAnswers, urgent,
        } = req.body;

        const errors = [
            validateNeg(payment,          'Budget'),
            validateNeg(workersRequired,  'Workers required'),
            validateNeg(minBudget,        'Minimum budget'),
        ].filter(Boolean);
        if (errors.length)        return res.status(400).json({ message: errors[0] });
        if (!title?.trim())       return res.status(400).json({ message: 'Job title is required.' });
        if (!description?.trim()) return res.status(400).json({ message: 'Job description is required.' });

        if (scheduledTime) {
            const tc = validateWorkTime(scheduledTime);
            if (!tc.valid) return res.status(400).json({ message: tc.message });
        }
        if (scheduledDate && scheduledTime) {
            const [h, m] = scheduledTime.split(':').map(Number);
            const sched  = new Date(scheduledDate); sched.setHours(h, m, 0, 0);
            if ((sched.getTime() - Date.now()) / 60000 < 50)
                return res.status(400).json({ message: `Scheduled time must be at least 50 minutes from now. Current: ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.` });
        }

        const photos  = req.files ? req.files.map(f => f.path) : [];
        const pSkills = parseJSON(skills, []);
        const pWR     = Math.max(1, Number(workersRequired) || 1);

        // FIX: sanitise complexity before passing to Job.create()
        const pBD = sanitiseBudgetBreakdown(parseJSON(budgetBreakdown, undefined));

        const job = await Job.create({
            postedBy:            req.user.id,
            title:               title.trim(),
            description:         description.trim(),
            shortDescription:    shortDescription || description.trim().slice(0, 150),
            detailedDescription: detailedDescription || description.trim(),
            skills:              pSkills,
            payment:             Math.max(0, Number(payment) || 0),
            duration:            duration || '',
            workersRequired:     pWR,
            location:            parseJSON(location, {}),
            photos,
            scheduledDate,
            scheduledTime,
            shift:               shift || '',
            negotiable:          negotiable === 'true' || negotiable === true,
            minBudget:           Math.max(0, Number(minBudget) || 0),
            urgent:              urgent === 'true' || urgent === true,
            qaAnswers:           parseJSON(qaAnswers, []),
            budgetBreakdown:     pBD,
            totalEstimatedCost:  Math.max(0, Number(totalEstimatedCost) || 0),
            workerSlots:         buildWorkerSlots(pBD, pSkills, pWR),
        });

        const smartSuggestions = await buildSmartWorkerSuggestions(job, { limit: 3 });
        let urgentAlertRecipients = [];
        if (job.urgent) {
            urgentAlertRecipients = await notifyUrgentNearbyWorkers(job);
        }

        await logAuditEvent({
            userId:   req.user.id,
            role:     'client',
            action:   'job_posted',
            req,
            metadata: {
                jobId: job._id,
                workersRequired: pWR,
                urgent: !!job.urgent,
                smartSuggestions: smartSuggestions.length,
                urgentAlertRecipients: urgentAlertRecipients.length,
            },
        });
        return res.status(201).json({
            ...job.toObject(),
            smartSuggestions,
            urgentAlertRecipients: urgentAlertRecipients.length,
        });
    } catch (err) {
        console.error('postJob:', err);
        return res.status(500).json({ message: 'Failed to post job.' });
    }
};

exports.deleteJob = async (req, res) => {
    try {
        const job = await Job.findOne({ _id: req.params.id, postedBy: req.user.id });
        if (!job) return res.status(404).json({ message: 'Not found.' });
        if (job.status !== 'open') return res.status(403).json({ message: 'Only open jobs can be deleted.' });
        await job.deleteOne();
        return res.json({ message: 'Deleted.' });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.cancelJob = async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason?.trim()) return res.status(400).json({ message: 'Reason is required.' });
        const job = await Job.findOne({ _id: req.params.id, postedBy: req.user.id });
        if (!job) return res.status(404).json({ message: 'Not found.' });
        if (job.status === 'running') return res.status(403).json({ message: 'Cannot cancel a running job.' });
        if (['completed','cancelled_by_client','cancelled'].includes(job.status)) return res.status(403).json({ message: 'Cannot cancel.' });
        job.status = 'cancelled_by_client'; job.cancelledBy = 'client';
        job.cancellationReason = reason.trim(); job.cancelledAt = new Date();
        job.applicationsOpen = false;
        job.workerSlots.forEach(s => { if (['open','filled'].includes(s.status)) s.status = 'cancelled'; });
        for (const wId of job.assignedTo) {
            await createNotification({ userId: wId, type: 'cancelled', title: 'Job Cancelled', message: `"${job.title}" was cancelled. Reason: ${reason}` });
            const workerUser = await User.findById(wId).select('mobile name');
            if (workerUser?.mobile) {
                await sendCustomSms(
                    workerUser.mobile,
                    `KarigarConnect: Job "${job.title}" was cancelled by client. Reason: ${reason.trim()}.`
                );
            }
        }
        await job.save();
        await logAuditEvent({ userId: req.user.id, role: 'client', action: 'job_cancelled', req, metadata: { jobId: job._id, reason: reason.trim() } });
        return res.json({ message: 'Cancelled.', job });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

// ─────────────────────────────────────────────────────────────────────────────
// REPOST MISSING SKILL
// ─────────────────────────────────────────────────────────────────────────────
exports.repostMissingSkill = async (req, res) => {
    try {
        const { slotId, newScheduledDate, newScheduledTime } = req.body;
        if (!slotId)           return res.status(400).json({ message: 'slotId is required.' });
        if (!newScheduledDate) return res.status(400).json({ message: 'New scheduled date is required.' });
        if (!newScheduledTime) return res.status(400).json({ message: 'New scheduled time is required.' });

        const tc = validateWorkTime(newScheduledTime);
        if (!tc.valid) return res.status(400).json({ message: tc.message });

        const parentJob = await Job.findOne({ _id: req.params.id, postedBy: req.user.id });
        if (!parentJob) return res.status(404).json({ message: 'Job not found.' });
        if (!['open','scheduled','running'].includes(parentJob.status)) return res.status(400).json({ message: 'Can only repost skills for active jobs.' });

        const slot = parentJob.workerSlots.id(slotId);
        if (!slot) return res.status(404).json({ message: 'Slot not found.' });
        if (slot.status !== 'open') return res.status(400).json({ message: 'Only unfilled (open) slots can be reposted.' });

        let slotPayment = 0;
        if (parentJob.budgetBreakdown?.breakdown?.length) {
            const block = parentJob.budgetBreakdown.breakdown.find(b => b.skill === slot.skill);
            if (block) slotPayment = Math.round((block.subtotal || 0) / Math.max(1, block.count || 1));
        }
        if (!slotPayment && parentJob.payment && parentJob.workersRequired) {
            slotPayment = Math.round(parentJob.payment / parentJob.workersRequired);
        }

        const childBD = parentJob.budgetBreakdown ? {
            city:           parentJob.budgetBreakdown.city,
            breakdown:      (parentJob.budgetBreakdown.breakdown || []).filter(b => b.skill === slot.skill),
            subtotal:       slotPayment,
            urgent:         parentJob.urgent,
            urgencyMult:    parentJob.budgetBreakdown.urgencyMult || 1,
            totalEstimated: slotPayment,
            totalWorkers:   1,
        } : undefined;

        const skillLabel = slot.skill.charAt(0).toUpperCase() + slot.skill.slice(1);

        const childJob = await Job.create({
            postedBy:            parentJob.postedBy,
            title:               `${parentJob.title} — ${skillLabel} task`,
            description:         parentJob.description,
            shortDescription:    `${skillLabel} work for: ${parentJob.shortDescription || parentJob.title}`,
            detailedDescription: parentJob.detailedDescription || parentJob.description,
            skills:              [slot.skill],
            payment:             slotPayment,
            duration:            slot.hoursEstimated ? `${slot.hoursEstimated} hours` : (parentJob.duration || ''),
            workersRequired:     1,
            location:            parentJob.location,
            scheduledDate:       newScheduledDate,
            scheduledTime:       newScheduledTime,
            urgent:              parentJob.urgent,
            qaAnswers:           parentJob.qaAnswers || [],
            budgetBreakdown:     childBD,
            totalEstimatedCost:  slotPayment,
            applicationsOpen:    true,
            parentJobId:         parentJob._id,
            isSubTask:           true,
            subTaskSkill:        slot.skill,
            workerSlots:         [{ skill: slot.skill, hoursEstimated: slot.hoursEstimated || 8, assignedWorker: null, status: 'open' }],
        });

        slot.status       = 'reposted';
        slot.subTaskJobId = childJob._id;
        await parentJob.save();

        await parentJob.populate('workerSlots.assignedWorker', 'name photo karigarId mobile');
        await parentJob.populate('applicants.workerId',        'name photo karigarId');

        const updatedParent = await loadParentJobWithSubTasks(parentJob._id, req.user.id);

        return res.status(201).json({
            message:  `${skillLabel} task reposted as a sub-task. Workers can now apply.`,
            childJob,
            parentJob,
            job: updatedParent || parentJob,
        });
    } catch (err) {
        console.error('repostMissingSkill:', err);
        return res.status(500).json({ message: 'Failed to repost skill.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// CANCEL SLOT REQUIREMENT
// ─────────────────────────────────────────────────────────────────────────────
exports.cancelSlotRequirement = async (req, res) => {
    try {
        const { slotId } = req.body;
        if (!slotId) return res.status(400).json({ message: 'slotId is required.' });

        const job = await Job.findOne({ _id: req.params.id, postedBy: req.user.id });
        if (!job) return res.status(404).json({ message: 'Not found.' });

        const slot = job.workerSlots.id(slotId);
        if (!slot) return res.status(404).json({ message: 'Slot not found.' });
        if (slot.status !== 'open') return res.status(400).json({ message: 'Only open slots can be cancelled.' });

        slot.status = 'cancelled';
        await job.save();
        await job.populate('workerSlots.assignedWorker', 'name photo karigarId mobile');

        const skillLabel = slot.skill.charAt(0).toUpperCase() + slot.skill.slice(1);
        return res.json({ message: `${skillLabel} requirement removed. Job proceeds without it.`, job });
    } catch (err) {
        console.error('cancelSlotRequirement:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// RESPOND TO APPLICANT
// ─────────────────────────────────────────────────────────────────────────────
exports.respondToApplicant = async (req, res) => {
    try {
        const { workerId, status, feedback, skill: reqSkill } = req.body;
        if (!workerId || !status) return res.status(400).json({ message: 'workerId and status are required.' });
        const job = await Job.findOne({ _id: req.params.jobId, postedBy: req.user.id });
        if (!job) return res.status(404).json({ message: 'Not found.' });

        let applicant = reqSkill
            ? job.applicants.find(a => a.workerId?.toString() === workerId && a.skill === reqSkill && a.status === 'pending')
            : null;
        if (!applicant) applicant = job.applicants.find(a => a.workerId?.toString() === workerId && a.status === 'pending');
        if (!applicant) return res.status(404).json({ message: 'Applicant not found.' });

        if (status === 'accepted') {
            const conflict = await checkWorkerScheduleConflict(Job, workerId, job._id.toString());
            if (conflict.conflict) return res.status(409).json({ message: conflict.message });

            const skill    = applicant.skill || reqSkill || job.skills?.[0] || 'general';
            const openSlot = job.workerSlots.find(s => s.status === 'open' && s.skill === skill)
                          || job.workerSlots.find(s => s.status === 'open');
            if (!openSlot) return res.status(400).json({ message: `All ${skill} slots are filled.` });

            openSlot.assignedWorker = workerId; openSlot.status = 'filled';
            applicant.status = 'accepted'; applicant.feedback = feedback || '';
            if (!job.assignedTo.map(id => id.toString()).includes(workerId)) job.assignedTo.push(workerId);
            if (job.status === 'open') job.status = 'scheduled';

            const remaining = job.workerSlots.filter(s => s.status === 'open' && s.skill === skill).length;
            if (remaining === 0) {
                for (const app of job.applicants) {
                    if (app.workerId?.toString() !== workerId && app.status === 'pending' && (app.skill === skill || app.skill === '')) {
                        app.status = 'rejected'; app.feedback = `All ${skill} positions filled.`;
                        await createNotification({ userId: app.workerId, type: 'job_update', title: 'Application Not Selected', message: `All ${skill} positions for "${job.title}" are now filled.` });
                    }
                }
            }
            await createNotification({ userId: workerId, type: 'hired', title: 'Application Approved ✅', message: `Your application for "${job.title}" as ${skill} has been approved.` });

            const workerUser = await User.findById(workerId).select('mobile name');
            if (workerUser?.mobile) {
                await sendCustomSms(
                    workerUser.mobile,
                    `KarigarConnect: Congratulations ${workerUser.name || 'Worker'}! You are accepted for job "${job.title}" (${skill}).`
                );
            }
        } else {
            applicant.status = 'rejected'; applicant.feedback = feedback || '';
            await createNotification({ userId: workerId, type: 'job_update', title: 'Application Not Selected', message: `Your application for "${job.title}" was not selected.${feedback ? ` Feedback: ${feedback}` : ''}` });

            const workerUser = await User.findById(workerId).select('mobile name');
            if (workerUser?.mobile) {
                await sendCustomSms(
                    workerUser.mobile,
                    `KarigarConnect: Your application for job "${job.title}" was rejected.${feedback ? ` Reason: ${feedback}` : ''}`
                );
            }
        }

        await job.save();
        await job.populate('assignedTo',                'name photo karigarId mobile');
        await job.populate('applicants.workerId',        'name photo karigarId');
        await job.populate('workerSlots.assignedWorker', 'name photo karigarId mobile');
        return res.json({ message: `Applicant ${status}.`, job });
    } catch (err) {
        console.error('respondToApplicant:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};

exports.hireWorker = async (req, res) => { req.body.status = 'accepted'; return exports.respondToApplicant(req, res); };

exports.respondToSubTaskApplicant = async (req, res) => {
    try {
        const { subTaskId, workerId, status, feedback } = req.body;
        if (!subTaskId || !workerId || !status) {
            return res.status(400).json({ message: 'subTaskId, workerId and status are required.' });
        }

        const subTask = await Job.findOne({ _id: subTaskId, parentJobId: req.params.id, postedBy: req.user.id });
        if (!subTask) return res.status(404).json({ message: 'Sub-task not found.' });

        let applicant = subTask.applicants.find(a => a.workerId?.toString() === workerId && a.status === 'pending');
        if (!applicant) return res.status(404).json({ message: 'Applicant not found.' });

        const parentJob = await Job.findOne({ _id: req.params.id, postedBy: req.user.id, parentJobId: null });
        if (!parentJob) return res.status(404).json({ message: 'Parent job not found.' });

        if (status === 'accepted') {
            const conflict = await checkWorkerScheduleConflict(Job, workerId, subTask._id.toString());
            if (conflict.conflict) return res.status(409).json({ message: conflict.message });

            const openSlot = subTask.workerSlots.find(s => s.status === 'open') || subTask.workerSlots[0];
            if (!openSlot) return res.status(400).json({ message: 'No available slot in sub-task.' });

            openSlot.assignedWorker = workerId;
            openSlot.status = 'filled';
            applicant.status = 'accepted';
            applicant.feedback = feedback || '';

            if (!subTask.assignedTo.map(id => id.toString()).includes(workerId)) subTask.assignedTo.push(workerId);
            if (subTask.status === 'open') subTask.status = 'scheduled';
            subTask.applicationsOpen = false;

            syncParentFromSubTaskAssignment(parentJob, subTask, workerId);

            for (const app of subTask.applicants) {
                if (app.workerId?.toString() !== workerId && app.status === 'pending') {
                    app.status = 'rejected'; app.feedback = 'Position already filled.';
                    await createNotification({ userId: app.workerId, type: 'job_update', title: 'Application Not Selected', message: `Sub-task position for "${subTask.title}" has been filled.` });
                }
            }
            await createNotification({ userId: workerId, type: 'hired', title: 'Sub-task Approved ✅', message: `Your application for "${subTask.title}" was approved.` });

            const workerUser = await User.findById(workerId).select('mobile name');
            if (workerUser?.mobile) {
                await sendCustomSms(
                    workerUser.mobile,
                    `KarigarConnect: You are accepted for sub-task "${subTask.title}" (Parent job: "${parentJob.title}").`
                );
            }
        } else {
            applicant.status = 'rejected'; applicant.feedback = feedback || '';
            await createNotification({ userId: workerId, type: 'job_update', title: 'Application Not Selected', message: `Your application for "${subTask.title}" was not selected.${feedback ? ` Feedback: ${feedback}` : ''}` });

            const workerUser = await User.findById(workerId).select('mobile name');
            if (workerUser?.mobile) {
                await sendCustomSms(
                    workerUser.mobile,
                    `KarigarConnect: Your application for sub-task "${subTask.title}" was rejected.${feedback ? ` Reason: ${feedback}` : ''}`
                );
            }
        }

        await subTask.save();
        await parentJob.save();
        const parent = await loadParentJobWithSubTasks(req.params.id, req.user.id);
        if (!parent) return res.status(404).json({ message: 'Parent job not found.' });
        return res.json({ message: `Sub-task applicant ${status}.`, job: parent });
    } catch (err) {
        console.error('respondToSubTaskApplicant:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};

exports.completeWorkerTask = async (req, res) => {
    try {
        const { workerId, slotId } = req.body;
        if (!workerId) return res.status(400).json({ message: 'workerId is required.' });
        const job = await Job.findOne({ _id: req.params.id, postedBy: req.user.id });
        if (!job) return res.status(404).json({ message: 'Not found.' });
        if (job.status !== 'running') return res.status(400).json({ message: 'Only for running jobs.' });
        const slot = slotId
            ? job.workerSlots.id(slotId)
            : job.workerSlots.find(s => s.assignedWorker?.toString() === workerId && s.status === 'filled');
        if (!slot || slot.status !== 'filled') return res.status(404).json({ message: 'No active slot found.' });
        slot.status = 'task_completed'; slot.completedAt = new Date(); slot.actualEndTime = new Date();
        await createNotification({ userId: workerId, type: 'job_update', title: 'Task Marked Complete ✅', message: `Your ${slot.skill} task for "${job.title}" has been marked complete. You are now free for new jobs.` });
        if (job.allSlotsCompleted() && job.completionPhotos?.length) { job.status = 'completed'; job.actualEndTime = new Date(); }
        await job.save();
        await job.populate('workerSlots.assignedWorker', 'name photo karigarId mobile');
        return res.json({ message: `${slot.skill} task complete.`, job, allDone: job.allSlotsCompleted() });
    } catch (err) {
        console.error('completeWorkerTask:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};

exports.completeSubTask = async (req, res) => {
    try {
        const { subTaskId } = req.body;
        if (!subTaskId) return res.status(400).json({ message: 'subTaskId is required.' });

        const subTask = await Job.findOne({ _id: subTaskId, parentJobId: req.params.id, postedBy: req.user.id });
        if (!subTask) return res.status(404).json({ message: 'Sub-task not found.' });

        if (['cancelled','cancelled_by_client'].includes(subTask.status)) {
            return res.status(400).json({ message: 'Cancelled sub-task cannot be completed.' });
        }

        subTask.status = 'completed'; subTask.actualEndTime = new Date(); subTask.applicationsOpen = false;
        subTask.workerSlots.forEach(s => {
            if (['filled','scheduled','running','task_completed'].includes(s.status)) {
                s.status = 'task_completed';
                s.completedAt  = s.completedAt  || new Date();
                s.actualEndTime = s.actualEndTime || new Date();
            }
        });
        await subTask.save();

        const parentJob = await Job.findOne({ _id: req.params.id, postedBy: req.user.id, parentJobId: null });
        if (parentJob) {
            const mappedParentSlot =
                parentJob.workerSlots.find(s => s.subTaskJobId?.toString() === subTask._id.toString()) ||
                parentJob.workerSlots.find(s => s.status === 'filled' && s.skill === (subTask.subTaskSkill || '').toLowerCase());
            if (mappedParentSlot && ['filled','scheduled','running'].includes(mappedParentSlot.status)) {
                mappedParentSlot.status = 'task_completed';
                mappedParentSlot.completedAt   = mappedParentSlot.completedAt   || new Date();
                mappedParentSlot.actualEndTime  = mappedParentSlot.actualEndTime || new Date();
            }
            await parentJob.save();
        }

        const doneSlot = subTask.workerSlots.find(s => s.assignedWorker);
        const wid = doneSlot?.assignedWorker?._id?.toString() || doneSlot?.assignedWorker?.toString();
        if (wid) {
            await createNotification({ userId: wid, type: 'job_update', title: 'Sub-task Completed ✅', message: `"${subTask.title}" has been marked completed by the client.` });
        }

        const parent = await loadParentJobWithSubTasks(req.params.id, req.user.id);
        if (!parent) return res.status(404).json({ message: 'Parent job not found.' });
        return res.json({ message: 'Sub-task completed.', job: parent });
    } catch (err) {
        console.error('completeSubTask:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};

exports.submitRating = async (req, res) => {
    try {
        const { workerId, slotId, skill: ratingSkill, stars, points, message } = req.body;
        if (!workerId) return res.status(400).json({ message: 'workerId is required.' });
        const starsNum  = Math.min(5,   Math.max(1,  Number(stars)  || 5));
        const pointsNum = Math.min(100, Math.max(20, Number(points) || 50));
        const job = await Job.findOne({ _id: req.params.jobId, postedBy: req.user.id });
        if (!job) return res.status(404).json({ message: 'Not found.' });
        if (!['running','completed'].includes(job.status)) return res.status(400).json({ message: 'Ratings only for running/completed jobs.' });
        if (job.status === 'running' && !job.completionPhotos?.length) return res.status(400).json({ message: 'Upload completion photos before rating.' });
        let slot = slotId ? job.workerSlots.id(slotId) : null;
        if (!slot) slot = job.workerSlots.find(s => (s.assignedWorker?._id?.toString() || s.assignedWorker?.toString()) === workerId && (!ratingSkill || s.skill === ratingSkill) && !s.ratingSubmitted);
        if (!slot) return res.status(404).json({ message: 'No unrated slot found.' });
        const skillForRating = slot.skill || ratingSkill || 'general';
        const existing = await Rating.findOne({ jobId: job._id, client: req.user.id, worker: workerId, skill: skillForRating });
        if (existing) return res.status(409).json({ message: `Already rated this worker for ${skillForRating}.` });
        const rating = await Rating.create({ jobId: job._id, client: req.user.id, worker: workerId, skill: skillForRating, slotId: slot._id, stars: starsNum, points: pointsNum, message: message?.trim() || '', workPhotos: job.completionPhotos || [] });
        await User.findByIdAndUpdate(workerId, { $inc: { points: pointsNum } });
        slot.ratingSubmitted = true;
        if (!job.ratingsSubmitted.map(id => id?.toString()).includes(slot._id.toString())) job.ratingsSubmitted.push(slot._id);
        await job.save();
        await createNotification({ userId: workerId, type: 'rating', title: `New Rating for ${skillForRating} ⭐`, message: `You received ${starsNum} star${starsNum !== 1 ? 's' : ''} and ${pointsNum} points for your ${skillForRating} work on "${job.title}".${message?.trim() ? ` Feedback: "${message.trim()}"` : ''}` });

        const workerUser = await User.findById(workerId).select('mobile name');
        if (workerUser?.mobile) {
            await sendCustomSms(
                workerUser.mobile,
                `KarigarConnect: You received ${starsNum} star${starsNum !== 1 ? 's' : ''} and ${pointsNum} points for "${job.title}" (${skillForRating}).${message?.trim() ? ` Feedback: ${message.trim()}` : ''}`
            );
        }

        return res.status(201).json({ message: 'Rating submitted.', rating, slotRated: skillForRating });
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ message: 'Already rated this worker for this skill.' });
        console.error('submitRating:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};

exports.updateJobStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const job = await Job.findOne({ _id: req.params.id, postedBy: req.user.id });
        if (!job) return res.status(404).json({ message: 'Not found.' });
        if (status === 'completed') {
            if (job.status !== 'running') return res.status(400).json({ message: 'Only running jobs can be marked complete.' });
            if (!job.completionPhotos?.length) return res.status(400).json({ message: 'Upload completion photos first.' });
            const unrated = job.workerSlots.filter(s => s.assignedWorker && !['cancelled','open','reposted'].includes(s.status) && !s.ratingSubmitted);
            if (unrated.length > 0) return res.status(400).json({ message: `Rate all workers first. Unrated: ${[...new Set(unrated.map(s => s.skill))].join(', ')}.` });
            job.actualEndTime = new Date();
        }
        job.status = status;
        await job.save();
        return res.json({ message: 'Status updated.', job });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.uploadCompletionPhotos = async (req, res) => {
    try {
        const job = await Job.findOne({ _id: req.params.id, postedBy: req.user.id });
        if (!job) return res.status(404).json({ message: 'Not found.' });
        if (job.status !== 'running') return res.status(400).json({ message: 'Only for running jobs.' });
        const photos = req.files?.map(f => f.path) || [];
        if (!photos.length) return res.status(400).json({ message: 'No photos.' });
        job.completionPhotos = [...(job.completionPhotos || []), ...photos];
        await job.save();
        return res.json({ message: 'Photos uploaded.', completionPhotos: job.completionPhotos });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.startJob = async (req, res) => {
    try {
        const job = await Job.findOne({ _id: req.params.id, postedBy: req.user.id });
        if (!job) return res.status(404).json({ message: 'Not found.' });
        if (job.status !== 'scheduled') return res.status(400).json({ message: 'Only scheduled jobs can be started.' });
        if (job.assignedTo.length === 0) return res.status(400).json({ message: 'Assign at least one worker first.' });
        if (job.scheduledDate && job.scheduledTime) {
            const { canStart, minutesUntilStart, scheduledAt } = canStartJob(job);
            if (!canStart) return res.status(403).json({ message: `Cannot start yet. Scheduled: ${scheduledAt?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}. Starts in ${minutesUntilStart} min.`, minutesUntilStart });
        }
        job.status = 'running'; job.actualStartTime = new Date(); job.applicationsOpen = false;
        job.workerSlots.forEach(s => { if (s.status === 'filled') s.actualStartTime = new Date(); });
        for (const wId of job.assignedTo) {
            await createNotification({ userId: wId, type: 'job_update', title: 'Job Started 🚀', message: `"${job.title}" has been started. Please proceed to the work site.` });
        }
        await job.save();
        return res.json({ message: 'Job started.', job });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.toggleJobApplications = async (req, res) => {
    try {
        const job = await Job.findOne({ _id: req.params.id, postedBy: req.user.id });
        if (!job) return res.status(404).json({ message: 'Not found.' });
        if (!['open','scheduled'].includes(job.status)) return res.status(403).json({ message: 'Cannot toggle at this stage.' });
        job.applicationsOpen = !job.applicationsOpen;
        await job.save();
        await logAuditEvent({ userId: req.user.id, role: 'client', action: 'toggle_applications', req, metadata: { jobId: job._id, applicationsOpen: job.applicationsOpen } });
        return res.json({ applicationsOpen: job.applicationsOpen });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.removeAssignedWorker = async (req, res) => {
    try {
        const { workerId, reason, slotId } = req.body;
        if (!workerId) return res.status(400).json({ message: 'workerId required.' });
        const job = await Job.findOne({ _id: req.params.id, postedBy: req.user.id });
        if (!job) return res.status(404).json({ message: 'Not found.' });
        if (['running','completed'].includes(job.status)) return res.status(403).json({ message: `Cannot remove from ${job.status} job.` });
        const slot = slotId
            ? job.workerSlots.id(slotId)
            : job.workerSlots.find(s => s.assignedWorker?.toString() === workerId && s.status === 'filled');
        if (slot) { slot.assignedWorker = null; slot.status = 'open'; }
        const stillAssigned = job.workerSlots.some(s => s.assignedWorker?.toString() === workerId && s.status === 'filled');
        if (!stillAssigned) job.assignedTo = job.assignedTo.filter(id => id?.toString() !== workerId);
        const app = job.applicants.find(a => a.workerId?.toString() === workerId);
        if (app) { app.status = 'rejected'; app.feedback = reason || 'Removed by client.'; }
        if (job.assignedTo.length === 0 && job.status === 'scheduled') { job.status = 'open'; job.applicationsOpen = true; }
        await job.save();
        await createNotification({ userId: workerId, type: 'cancelled', title: 'Assignment Removed', message: `Your ${slot?.skill || ''} assignment for "${job.title}" was removed.${reason ? ` Reason: ${reason}` : ''} Position is now open.` });
        await logAuditEvent({ userId: req.user.id, role: 'client', action: 'worker_removed_after_accept', req, metadata: { jobId: job._id, workerId, slotId: slot?._id || slotId || null } });
        return res.json({ message: 'Worker removed.', job });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.getJobApplicants = async (req, res) => {
    try {
        const job = await Job.findOne({ _id: req.params.jobId, postedBy: req.user.id })
            .populate('applicants.workerId', 'name photo karigarId points overallExperience skills verificationStatus mobile');
        if (!job) return res.status(404).json({ message: 'Not found.' });
        return res.json(job.applicants || []);
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.getSmartWorkerSuggestions = async (req, res) => {
    try {
        const job = await Job.findOne({ _id: req.params.jobId, postedBy: req.user.id });
        if (!job) return res.status(404).json({ message: 'Not found.' });

        const suggestions = await buildSmartWorkerSuggestions(job, { limit: 3 });
        return res.json({
            jobId: job._id,
            suggestions,
            radiusKm: ALERT_RADIUS_KM,
        });
    } catch (err) {
        console.error('getSmartWorkerSuggestions:', err);
        return res.status(500).json({ message: 'Failed to load suggestions.' });
    }
};

exports.inviteWorkersToJob = async (req, res) => {
    try {
        const { workerIds } = req.body;
        if (!Array.isArray(workerIds) || workerIds.length === 0) {
            return res.status(400).json({ message: 'workerIds array is required.' });
        }

        const job = await Job.findOne({ _id: req.params.jobId, postedBy: req.user.id });
        if (!job) return res.status(404).json({ message: 'Not found.' });
        if (!['open', 'scheduled'].includes(job.status) || !job.applicationsOpen) {
            return res.status(400).json({ message: 'Job is not accepting outreach right now.' });
        }

        const dedupedIds = [...new Set(workerIds.map((id) => String(id)).filter(Boolean))].slice(0, 10);
        const workers = await User.find({
            _id: { $in: dedupedIds },
            role: 'worker',
            verificationStatus: 'approved',
            availability: true,
        }).select('_id name mobile');

        if (!workers.length) return res.status(404).json({ message: 'No eligible workers found.' });

        const invitedSet = new Set((job.invitedWorkers || []).map((iw) => String(iw.workerId)));
        const invitedNow = [];
        for (const worker of workers) {
            const workerId = String(worker._id);
            if (!invitedSet.has(workerId)) {
                job.invitedWorkers.push({ workerId: worker._id, invitedAt: new Date() });
                invitedSet.add(workerId);
            }
            invitedNow.push(worker);

            await createNotification({
                userId: worker._id,
                type: job.urgent ? 'urgent_job' : 'job_update',
                title: job.urgent ? 'Urgent Invite from Client' : 'Direct Job Invite',
                message: `You are invited to apply for "${job.title}" in ${job.location?.city || 'your area'}.`,
                jobId: job._id,
                data: {
                    invited: true,
                    urgent: !!job.urgent,
                },
            });

            if (worker.mobile) {
                await sendCustomSms(
                    worker.mobile,
                    `KarigarConnect: You have a direct ${job.urgent ? 'URGENT ' : ''}invite for job "${job.title}". Open Job Requests to apply.`
                );
            }
        }

        await job.save();
        await logAuditEvent({
            userId: req.user.id,
            role: 'client',
            action: 'job_invite_workers',
            req,
            metadata: { jobId: job._id, invitedWorkers: invitedNow.map((w) => w._id) },
        });

        return res.json({
            message: 'Workers invited successfully.',
            invitedCount: invitedNow.length,
            invitedWorkers: invitedNow.map((w) => ({ _id: w._id, name: w.name, mobile: w.mobile || '' })),
        });
    } catch (err) {
        console.error('inviteWorkersToJob:', err);
        return res.status(500).json({ message: 'Failed to invite workers.' });
    }
};

exports.getWorkerPublicProfile = async (req, res) => {
    try {
        const w = await User.findById(req.params.workerId).select('name photo karigarId skills overallExperience points verificationStatus location address mobile');
        if (!w) return res.status(404).json({ message: 'Not found.' });
        const completedJobs = await Job.countDocuments({ assignedTo: w._id, status: 'completed' });
        const ratings       = await Rating.find({ worker: w._id }).populate('client','name photo').sort({ createdAt: -1 }).limit(10);
        const avgStars      = ratings.length ? ratings.reduce((s, r) => s + (r.stars || 0), 0) / ratings.length : 0;
        return res.json({ ...w.toObject(), completedJobs, avgStars: Math.round(avgStars * 10) / 10, ratings });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.toggleStarWorker = async (req, res) => {
    try {
        const { workerId } = req.body;
        if (!workerId) return res.status(400).json({ message: 'workerId required.' });
        const c = await User.findById(req.user.id);
        if (!c.starredWorkers) c.starredWorkers = [];
        const idx = c.starredWorkers.findIndex(id => id?.toString() === workerId);
        idx > -1 ? c.starredWorkers.splice(idx, 1) : c.starredWorkers.push(workerId);
        await c.save();
        return res.json({ starred: idx === -1, starredWorkers: c.starredWorkers });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

// ─────────────────────────────────────────────────────────────────────────────
// AI HISTORY
// ─────────────────────────────────────────────────────────────────────────────
exports.getClientAIHistory = async (req, res) => {
    try { return res.json(await AIHistory.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(30)); }
    catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.getAIHistoryItem = async (req, res) => {
    try {
        const item = await AIHistory.findOne({ _id: req.params.id, userId: req.user.id });
        if (!item) return res.status(404).json({ message: 'Not found.' });
        return res.json(item);
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.saveAIAnalysis = async (req, res) => {
    try {
        const {
            title, notes, workDescription, city, urgent, clientBudget,
            answers, opinions, report, durationDays, budgetBreakdown,
            recommendation, query, analysis,
        } = req.body;

        const normalizedReport = report || analysis || null;
        const item = await AIHistory.create({
            userId:          req.user.id,
            title:           title || normalizedReport?.jobTitle || '',
            notes:           notes || '',
            workDescription: workDescription || query || '',
            city:            city || '',
            urgent:          urgent || false,
            clientBudget:    clientBudget ?? null,
            answers:         answers || {},
            opinions:        opinions || {},
            report:          normalizedReport,
            durationDays:    durationDays || normalizedReport?.durationDays || null,
            budgetBreakdown: budgetBreakdown || normalizedReport?.budgetBreakdown || normalizedReport || null,
            recommendation:  recommendation || normalizedReport?.recommendation || '',
        });
        return res.status(201).json(item);
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.updateAIHistoryItem = async (req, res) => {
    try {
        const allowed = ['title','notes','workDescription','city','urgent','clientBudget','answers','opinions','report','durationDays','budgetBreakdown','recommendation'];
        const updates = {};
        allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
        const item = await AIHistory.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { $set: updates },
            { new: true, runValidators: true }
        );
        if (!item) return res.status(404).json({ message: 'Not found.' });
        return res.json(item);
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.deleteAIHistoryItem = async (req, res) => {
    try {
        await AIHistory.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        return res.json({ message: 'Deleted.' });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.clearClientAIHistory = async (req, res) => {
    try {
        await AIHistory.deleteMany({ userId: req.user.id });
        return res.json({ message: 'Cleared.' });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.deleteClientAccount = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.user.id);
        return res.json({ message: 'Account deleted successfully.' });
    } catch { return res.status(500).json({ message: 'Failed to delete account.' }); }
};

// ── Aliases ───────────────────────────────────────────────────────────────────
exports.getProfile         = exports.getClientProfile;
exports.updateProfile      = exports.updateClientProfile;
exports.getAIHistory       = exports.getClientAIHistory;
exports.clearAIHistory     = exports.clearClientAIHistory;
exports.checkAndStartJob   = exports.startJob;
exports.toggleApplications = exports.toggleJobApplications;