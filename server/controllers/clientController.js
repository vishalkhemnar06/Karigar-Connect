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
const WorkerDailyProfile = require('../models/workerDailyProfileModel');
const mongoose = require('mongoose');
const crypto = require('crypto');
const Groq = require('groq-sdk');
const { createNotification }           = require('../utils/notificationHelper');
const { checkWorkerScheduleConflict, validateWorkTime, canStartJob } = require('../utils/scheduleHelper');
const { logAuditEvent } = require('../utils/auditLogger');
const { sendCustomSms, sendPasswordChangeOtpSms } = require('../utils/smsHelper');
const { validateStrongPassword, PASSWORD_POLICY_TEXT } = require('../utils/passwordPolicy');
const { upsertJobById, removeJobById, getWorkersForJob, submitFeedback } = require('../services/semanticMatchingService');
const faceClient = require('../utils/faceServiceClient');
const { cloudinary } = require('../utils/cloudinary');
const {
    buildWorkerDailyProfileResponse,
    getWorkerDailyProfileSnapshot,
} = require('../services/workerDailyProfileService');
const {
    computeWorkerJobCommute,
    getClientAcceptanceRuleResult,
    getCompletedJobsCountMap,
} = require('../utils/commuteHelper');

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

const parseJSON   = (v, fb) => { if (!v) return fb; try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return fb; } };
const validateNeg = (v, l)  => { const n = Number(v); if (!isNaN(n) && n < 0) return `${l} cannot be negative.`; return null; };
const normalizeQaAnswerValue = (answer) => {
    if (Array.isArray(answer)) {
        return answer
            .map((item) => String(item ?? '').trim())
            .filter(Boolean)
            .join(', ');
    }
    if (answer === null || answer === undefined) return '';
    if (typeof answer === 'object') {
        if (answer.value !== undefined) return String(answer.value).trim();
        if (answer.label !== undefined) return String(answer.label).trim();
        try {
            return JSON.stringify(answer);
        } catch {
            return '';
        }
    }
    return String(answer).trim();
};
const sanitiseQaAnswers = (qaInput) => {
    const parsed = parseJSON(qaInput, []);
    if (!Array.isArray(parsed)) return [];

    return parsed
        .map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            const question = String(entry.question ?? '').trim();
            const answer = normalizeQaAnswerValue(entry.answer);
            if (!question && !answer) return null;
            return { question, answer };
        })
        .filter(Boolean);
};
const normalizeJobLocation = (locationInput = {}) => {
    const src = locationInput && typeof locationInput === 'object' ? locationInput : {};
    const city = String(src.city || '').trim();
    const locality = String(src.locality || '').trim();
    const state = String(src.state || '').trim();
    const pincode = String(src.pincode || '').trim();
    const fullAddress = String(src.fullAddress || '').trim();
    const buildingName = String(src.buildingName || '').trim();
    const unitNumber = String(src.unitNumber || '').trim();
    const floorNumber = String(src.floorNumber || '').trim();
    const latNum = Number(src.lat);
    const lngNum = Number(src.lng);

    return {
        city,
        locality,
        state,
        pincode,
        fullAddress,
        buildingName,
        unitNumber,
        floorNumber,
        lat: Number.isFinite(latNum) ? latNum : null,
        lng: Number.isFinite(lngNum) ? lngNum : null,
    };
};
const ALERT_RADIUS_KM = 5;
const MAX_URGENT_ALERT_RECIPIENTS = 75;

const parseScheduledDateTimeForNotice = (scheduledDate, scheduledTime) => {
    if (!scheduledDate) return null;
    const dt = new Date(scheduledDate);
    if (Number.isNaN(dt.getTime())) return null;
    const [h, m] = String(scheduledTime || '').split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    dt.setHours(h, m, 0, 0);
    return dt;
};

const buildOtherAssignmentNotice = async ({ workerId, excludingJobId, currentClientId }) => {
    const otherAssignments = await Job.find({
        _id: { $ne: excludingJobId },
        assignedTo: workerId,
        status: { $in: ['scheduled', 'running'] },
        postedBy: { $ne: currentClientId },
    }).select('scheduledDate scheduledTime actualStartTime').lean();

    if (!otherAssignments.length) return null;

    const now = Date.now();
    const starts = otherAssignments
        .map((j) => (j.actualStartTime ? new Date(j.actualStartTime) : parseScheduledDateTimeForNotice(j.scheduledDate, j.scheduledTime)))
        .filter((d) => d && !Number.isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());

    if (!starts.length) {
        return 'Notice: This worker is already assigned to another job. You may continue, reject, or contact the worker.';
    }

    const next = starts.find((d) => d.getTime() >= now) || starts[0];
    const at = next.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `Notice: This worker is already scheduled for another job at ${at}. You may continue, reject, or contact the worker.`;
};

const toPositiveNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
};

const roundTo2 = (value) => Math.round(value * 100) / 100;

const serializeCommute = (commute) => {
    if (!commute) return null;
    return {
        ...commute,
        arrivalAt: commute.arrivalAt ? new Date(commute.arrivalAt).toISOString() : null,
        jobStartAt: commute.jobStartAt ? new Date(commute.jobStartAt).toISOString() : null,
        workerLocationUpdatedAt: commute.workerLocationUpdatedAt ? new Date(commute.workerLocationUpdatedAt).toISOString() : null,
    };
};

const buildDailyProfileMap = async (workerIds = []) => {
    const validIds = workerIds.filter((id) => mongoose.Types.ObjectId.isValid(String(id)));
    if (!validIds.length) return new Map();

    const docs = await WorkerDailyProfile.find({ workerId: { $in: validIds } })
        .select('workerId liveLocation travelMethod')
        .lean();
    return new Map(docs.map((doc) => [String(doc.workerId), doc]));
};

const computeJobActualHours = (job) => {
    if (job?.actualStartTime && job?.actualEndTime) {
        const ms = new Date(job.actualEndTime).getTime() - new Date(job.actualStartTime).getTime();
        if (ms > 0) return roundTo2(ms / (1000 * 60 * 60));
    }

    const slotHours = (job?.workerSlots || [])
        .map((slot) => {
            if (!slot?.actualStartTime || !slot?.actualEndTime) return 0;
            const ms = new Date(slot.actualEndTime).getTime() - new Date(slot.actualStartTime).getTime();
            return ms > 0 ? ms / (1000 * 60 * 60) : 0;
        })
        .filter((h) => h > 0);

    if (!slotHours.length) return 0;
    return roundTo2(Math.max(...slotHours));
};

const parseSlotFinalPaidInput = (input) => {
    if (!input) return [];

    if (Array.isArray(input)) {
        return input
            .map((row) => ({
                slotId: String(row?.slotId || '').trim(),
                amount: toPositiveNumber(row?.amount),
            }))
            .filter((row) => row.slotId && row.amount);
    }

    if (typeof input === 'object') {
        return Object.entries(input)
            .map(([slotId, amount]) => ({
                slotId: String(slotId || '').trim(),
                amount: toPositiveNumber(amount),
            }))
            .filter((row) => row.slotId && row.amount);
    }

    return [];
};

const applyPricingCompletionMeta = (job, options = {}) => {
    const {
        finalPaidPrice,
        slotFinalPaid,
        workerQuotedPrice,
        priceSource,
        captureTimestamp = true,
    } = options;

    job.pricingMeta = job.pricingMeta || {};

    const explicitSlotRows = Array.isArray(slotFinalPaid) ? slotFinalPaid : [];
    const normalizedSkillRows = explicitSlotRows
        .map((row) => ({
            slotId: row?.slotId ? row.slotId : null,
            skill: String(row?.skill || '').trim(),
            workerId: row?.workerId || null,
            amount: toPositiveNumber(row?.amount) || 0,
        }))
        .filter((row) => row.amount > 0);

    if (normalizedSkillRows.length) {
        const existingRows = Array.isArray(job.pricingMeta.skillFinalPaid) ? job.pricingMeta.skillFinalPaid : [];
        const mergedRows = new Map();
        [...existingRows, ...normalizedSkillRows].forEach((row) => {
            const key = row?.slotId ? `slot:${row.slotId}` : `skill:${row?.skill || ''}:${row?.workerId || ''}`;
            mergedRows.set(key, row);
        });
        job.pricingMeta.skillFinalPaid = [...mergedRows.values()];
    } else if (!Array.isArray(job.pricingMeta.skillFinalPaid)) {
        job.pricingMeta.skillFinalPaid = [];
    }

    const slotTotal = (Array.isArray(job.pricingMeta.skillFinalPaid) ? job.pricingMeta.skillFinalPaid : normalizedSkillRows)
        .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const finalPaid =
        toPositiveNumber(slotTotal) ||
        toPositiveNumber(finalPaidPrice) ||
        toPositiveNumber(job.pricingMeta.finalPaidPrice) ||
        toPositiveNumber(job.payment);
    if (finalPaid) job.pricingMeta.finalPaidPrice = finalPaid;

    const quoted =
        toPositiveNumber(workerQuotedPrice) ||
        toPositiveNumber(job.pricingMeta.workerQuotedPrice) ||
        toPositiveNumber(job.payment);
    if (quoted) job.pricingMeta.workerQuotedPrice = quoted;

    const actualHours = computeJobActualHours(job);
    if (actualHours > 0) job.pricingMeta.actualHours = actualHours;

    if (!toPositiveNumber(job.pricingMeta.estimatedHours)) {
        const estimatedHours = (job.workerSlots || []).reduce((m, s) => Math.max(m, Number(s?.hoursEstimated || 0)), 0);
        if (estimatedHours > 0) job.pricingMeta.estimatedHours = estimatedHours;
    }

    if (['ai', 'manual', 'historical'].includes(priceSource)) {
        job.pricingMeta.priceSource = priceSource;
    } else if (!job.pricingMeta.priceSource) {
        job.pricingMeta.priceSource = 'manual';
    }

    if (captureTimestamp) {
        job.pricingMeta.capturedAt = new Date();
    }
};

const mapSemanticWorkersToLegacyShape = (matches = []) =>
    matches.map((match) => ({
        _id: match.workerId,
        name: match.worker?.name || '',
        photo: match.worker?.photo || '',
        karigarId: match.worker?.karigarId || '',
        mobile: match.worker?.mobile || '',
        points: Number(match.worker?.points || 0),
        overallExperience: match.worker?.overallExperience || '',
        avgStars: Number(match.worker?.avgStars || 0),
        ratingCount: Number(match.worker?.ratingCount || 0),
        matchedSkills: match.matchedSkills || [],
        distanceKm: match.distanceKm,
        withinRadius: match.distanceKm === null ? false : match.distanceKm <= ALERT_RADIUS_KM,
        semanticScore: match.semanticScore,
        score: match.score,
        reasons: match.reasons || [],
    }));

const parseModelJson = (text = '') => {
    const cleaned = String(text)
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
    return JSON.parse(cleaned);
};

const getWorkerSkills = (skills = []) =>
    (Array.isArray(skills) ? skills : [])
        .map((s) => (typeof s === 'string' ? s : s?.name || ''))
        .map((s) => String(s).trim())
        .filter(Boolean);

const formatAddress = (address = {}) => {
    const chunks = [
        address?.house,
        address?.street,
        address?.locality,
        address?.city,
        address?.state,
        address?.pincode,
    ].map((v) => String(v || '').trim()).filter(Boolean);
    return chunks.join(', ') || 'Not provided';
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

const buildFallbackWorkerSummary = (worker = {}) => {
    const skills = getWorkerSkills(worker.skills);
    const summaryPoints = [
        { label: 'Name', value: worker.name || 'Not provided' },
        { label: 'Karigar ID', value: worker.karigarId || 'Not provided' },
        { label: 'Skills', value: skills.length ? skills.join(', ') : 'Not specified' },
        { label: 'Experience', value: worker.overallExperience || worker.experience || 'Not specified' },
        { label: 'Travel Method', value: worker.travelMethod || 'Not specified' },
        { label: 'Completed Jobs', value: String(worker.completedJobs || 0) },
        { label: 'Points', value: String(worker.points || 0) },
        { label: 'Average Rating', value: `${Number(worker.avgStars || 0).toFixed(1)} (${worker.ratingCount || 0} reviews)` },
        { label: 'Contact', value: worker.mobile || worker.email || 'Not provided' },
        { label: 'Address', value: formatAddress(worker.address) },
        { label: 'Verification', value: worker.verificationStatus || 'unknown' },
    ];

    const intro = [
        `${worker.name || 'This worker'} is a${worker.verificationStatus === 'approved' ? ' verified' : ''} professional on KarigarConnect`,
        `${skills.length ? `with key skills in ${skills.join(', ')}` : 'with a diverse work profile'}`,
        `${worker.overallExperience || worker.experience ? `and ${worker.overallExperience || worker.experience} of experience` : ''}.`,
        `They have completed ${worker.completedJobs || 0} jobs, hold ${worker.points || 0} points, and currently maintain an average rating of ${Number(worker.avgStars || 0).toFixed(1)}.`,
        `${worker.mobile ? `Clients can contact them at ${worker.mobile}` : 'Contact details are available in their profile'}`,
        `and they are based in ${worker.address?.city || 'their registered location'}.`
    ].join(' ').replace(/\s+/g, ' ').trim();

    return { intro, points: summaryPoints };
};

const generateSummaryWithGroq = async (worker = {}) => {
    if (!groq) return null;

    const payload = {
        name: worker.name || '',
        karigarId: worker.karigarId || '',
        skills: getWorkerSkills(worker.skills),
        experience: worker.overallExperience || worker.experience || '',
        travelMethod: worker.travelMethod || '',
        completedJobs: worker.completedJobs || 0,
        points: worker.points || 0,
        avgStars: Number(worker.avgStars || 0),
        ratingCount: Number(worker.ratingCount || 0),
        mobile: worker.mobile || '',
        email: worker.email || '',
        address: formatAddress(worker.address),
        verificationStatus: worker.verificationStatus || '',
    };

    const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 600,
        response_format: { type: 'json_object' },
        messages: [
            {
                role: 'system',
                content: 'You are writing a concise worker profile summary for a client app. Return valid JSON only with keys: intro (string) and points (array of {label, value}). Use clear English. Keep intro to 4-6 sentences.',
            },
            {
                role: 'user',
                content: `Create a complete summary using this worker data: ${JSON.stringify(payload)}`,
            },
        ],
    });

    const raw = completion?.choices?.[0]?.message?.content || '{}';
    const parsed = parseModelJson(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.intro !== 'string' || !Array.isArray(parsed.points)) return null;

    const points = parsed.points
        .filter((p) => p && typeof p === 'object')
        .map((p) => ({ label: String(p.label || '').trim(), value: String(p.value || '').trim() }))
        .filter((p) => p.label && p.value);

    if (!points.length) return null;
    return { intro: parsed.intro.trim(), points };
};

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
        if (!parsed || typeof parsed !== 'object') return undefined;
        if (Array.isArray(parsed?.breakdown)) {
            parsed.breakdown = parsed.breakdown.map(block => ({
                skill: String(block?.skill || '').trim(),
                count: Math.max(1, Number(block?.count) || 1),
                hours: Math.max(1, Number(block?.hours) || 8),
                baseRate: Math.max(0, Number(block?.baseRate) || 0),
                rateInputMode: ['hour', 'day', 'visit'].includes(String(block?.rateInputMode || '').toLowerCase())
                    ? String(block.rateInputMode).toLowerCase()
                    : '',
                sourceRatePerHourBase: Math.max(0, Number(block?.sourceRatePerHourBase) || 0),
                sourceRatePerDayBase: Math.max(0, Number(block?.sourceRatePerDayBase) || 0),
                sourceRatePerVisitBase: Math.max(0, Number(block?.sourceRatePerVisitBase) || 0),
                ratePerHourBase: Math.max(0, Number(block?.ratePerHourBase) || 0),
                ratePerDayBase: Math.max(0, Number(block?.ratePerDayBase) || 0),
                ratePerVisitBase: Math.max(0, Number(block?.ratePerVisitBase) || 0),
                ratePerHour: Math.max(0, Number(block?.ratePerHour) || 0),
                ratePerDay: Math.max(0, Number(block?.ratePerDay) || 0),
                ratePerVisit: Math.max(0, Number(block?.ratePerVisit) || 0),
                perWorkerCostBase: Math.max(0, Number(block?.perWorkerCostBase) || 0),
                perWorkerCost: Math.max(0, Number(block?.perWorkerCost) || 0),
                appliedDemandMultiplier: Math.max(0, Number(block?.appliedDemandMultiplier) || 1),
                priceSource: String(block?.priceSource || '').trim(),
                complexity: COMPLEXITY_MAP[block.complexity] ?? 'normal',
                complexityMult: Math.max(0, Number(block?.complexityMult) || 1.2),
                durationFactor: Math.max(0, Number(block?.durationFactor) || 1.0),
                subtotal: Math.max(0, Number(block?.subtotal) || 0),
                negotiationAmount: Math.max(0, Number(block?.negotiationAmount) || 0),
                description: String(block?.description || '').trim(),
            }));
        }
        return {
            city: String(parsed?.city || '').trim(),
            breakdown: Array.isArray(parsed?.breakdown) ? parsed.breakdown : [],
            subtotal: Math.max(0, Number(parsed?.subtotal) || 0),
            urgent: parsed?.urgent === true || parsed?.urgent === 'true',
            urgencyMult: Math.max(0, Number(parsed?.urgencyMult) || 1.0),
            totalEstimated: Math.max(0, Number(parsed?.totalEstimated) || 0),
            totalWorkers: Math.max(1, Number(parsed?.totalWorkers) || 1),
        };
    } catch {
        return undefined;
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

    // Fallback: if live tracking is unavailable, use coordinates saved in worker profile.
    const missingIds = objectIds
        .map((id) => String(id))
        .filter((id) => !map.has(id));

    if (missingIds.length) {
        const fallbackWorkers = await User.find({
            _id: { $in: missingIds },
            role: 'worker',
            'address.latitude': { $ne: null },
            'address.longitude': { $ne: null },
        }).select('address.latitude address.longitude').lean();

        fallbackWorkers.forEach((w) => {
            map.set(String(w._id), {
                lat: Number(w.address?.latitude),
                lng: Number(w.address?.longitude),
                updatedAt: null,
            });
        });
    }

    return map;
};

const getJobSkillSet = (job) => {
    const fromSkills = (job.skills || []).map(normSkillName).filter(Boolean);
    const fromSlots = (job.workerSlots || []).map((s) => normSkillName(s.skill)).filter(Boolean);
    return [...new Set([...fromSkills, ...fromSlots])];
};

const collectWorkerIdsFromJobs = (jobs = []) => {
    const ids = new Set();
    const addId = (value) => {
        const id = String(value?._id || value || '');
        if (id) ids.add(id);
    };

    jobs.forEach((job) => {
        (job.assignedTo || []).forEach(addId);
        (job.applicants || []).forEach((app) => addId(app?.workerId));
        (job.workerSlots || []).forEach((slot) => addId(slot?.assignedWorker));
        (job.subTasks || []).forEach((subTask) => {
            addId(subTask?.assignedWorker);
            (subTask?.applicants || []).forEach((app) => addId(app?.workerId));
        });
    });

    return [...ids];
};

const buildRatingStatsMap = async (workerIds = []) => {
    const objectIds = workerIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

    if (!objectIds.length) return new Map();

    const ratings = await Rating.aggregate([
        { $match: { worker: { $in: objectIds } } },
        { $group: { _id: '$worker', avgStars: { $avg: '$stars' }, ratingCount: { $sum: 1 } } },
    ]);

    return new Map(
        ratings.map((row) => [
            String(row._id),
            {
                avgStars: Number((row.avgStars || 0).toFixed(1)),
                ratingCount: Number(row.ratingCount || 0),
            },
        ])
    );
};

const attachRatingStatsToWorker = (worker, ratingMap) => {
    if (!worker || typeof worker !== 'object') return worker;
    const workerId = String(worker._id || '');
    if (!workerId) return worker;
    const stats = ratingMap.get(workerId) || { avgStars: 0, ratingCount: 0 };
    return {
        ...worker,
        avgStars: stats.avgStars,
        ratingCount: stats.ratingCount,
    };
};

const enrichClientJobsWithRatings = async (jobs = []) => {
    const workerIds = collectWorkerIdsFromJobs(jobs);
    const ratingMap = await buildRatingStatsMap(workerIds);

    return jobs.map((job) => ({
        ...job,
        assignedTo: (job.assignedTo || []).map((worker) => attachRatingStatsToWorker(worker, ratingMap)),
        applicants: (job.applicants || []).map((app) => ({
            ...app,
            workerId: attachRatingStatsToWorker(app.workerId, ratingMap),
        })),
        workerSlots: (job.workerSlots || []).map((slot) => ({
            ...slot,
            assignedWorker: attachRatingStatsToWorker(slot.assignedWorker, ratingMap),
        })),
        subTasks: (job.subTasks || []).map((subTask) => ({
            ...subTask,
            assignedWorker: attachRatingStatsToWorker(subTask.assignedWorker, ratingMap),
            applicants: (subTask.applicants || []).map((app) => ({
                ...app,
                workerId: attachRatingStatsToWorker(app.workerId, ratingMap),
            })),
        })),
    }));
};

const attachCommuteToClientJobs = async (jobs = []) => {
    const workerIds = new Set();
    jobs.forEach((job) => {
        (job.applicants || []).forEach((app) => {
            const id = String(app?.workerId?._id || app?.workerId || '');
            if (id) workerIds.add(id);
        });
        (job.subTasks || []).forEach((subTask) => {
            (subTask?.applicants || []).forEach((app) => {
                const id = String(app?.workerId?._id || app?.workerId || '');
                if (id) workerIds.add(id);
            });
        });
    });

    const dailyProfileMap = await buildDailyProfileMap([...workerIds]);

    const withCommute = await Promise.all(jobs.map(async (job) => {
        const applicants = await Promise.all((job.applicants || []).map(async (app) => {
            const worker = app?.workerId;
            const workerId = String(worker?._id || worker || '');
            const commute = await computeWorkerJobCommute({
                worker,
                dailyProfile: dailyProfileMap.get(workerId) || null,
                job,
            });
            return {
                ...app,
                commute: serializeCommute(commute),
            };
        }));

        const subTasks = await Promise.all((job.subTasks || []).map(async (subTask) => {
            const applicantsWithCommute = await Promise.all((subTask?.applicants || []).map(async (app) => {
                const worker = app?.workerId;
                const workerId = String(worker?._id || worker || '');
                const commute = await computeWorkerJobCommute({
                    worker,
                    dailyProfile: dailyProfileMap.get(workerId) || null,
                    job: subTask,
                });
                return {
                    ...app,
                    commute: serializeCommute(commute),
                };
            }));

            return {
                ...subTask,
                applicants: applicantsWithCommute,
            };
        }));

        return {
            ...job,
            applicants,
            subTasks,
        };
    }));

    return withCommute;
};

const attachClientSubmittedRatings = async (jobs = [], clientId) => {
    const jobIds = jobs
        .map((job) => job?._id)
        .filter(Boolean);

    if (!jobIds.length) {
        return jobs.map((job) => ({ ...job, submittedRatings: [] }));
    }

    const ratings = await Rating.find({
        client: clientId,
        jobId: { $in: jobIds },
    })
        .populate('worker', 'name photo karigarId mobile')
        .sort({ createdAt: -1 })
        .lean();

    const byJob = new Map();
    for (const rating of ratings) {
        const key = String(rating.jobId);
        if (!byJob.has(key)) byJob.set(key, []);
        byJob.get(key).push(rating);
    }

    return jobs.map((job) => ({
        ...job,
        submittedRatings: byJob.get(String(job._id)) || [],
    }));
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
            // Keep per-worker hours as provided by budget breakdown.
            const perH  = Math.max(1, Math.round(Number(b.hours) || 8));
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

        // 0. No-applicant guardrail for open/scheduled jobs:
        // warn once before start, then auto-cancel at/after 30 min threshold.
        if (
            ['open', 'scheduled'].includes(job.status) &&
            job.scheduledDate &&
            job.scheduledTime
        ) {
            const [h, m] = job.scheduledTime.split(':').map(Number);
            const sched = new Date(job.scheduledDate);
            sched.setHours(h, m, 0, 0);
            const minsLeft = (sched.getTime() - now) / 60000;

            const hasAnyApplicant = Array.isArray(job.applicants) && job.applicants.length > 0;
            const hasAcceptedApplicant = (job.applicants || []).some(a => a?.status === 'accepted');
            const hasAssignedWorker = Array.isArray(job.assignedTo) && job.assignedTo.length > 0;
            const hasFilledSlots = (job.workerSlots || []).some(s => s?.status === 'filled' && s?.assignedWorker);
            const hasAnyWorkerCommitment = hasAnyApplicant || hasAcceptedApplicant || hasAssignedWorker || hasFilledSlots;

            if (!hasAnyWorkerCommitment) {
                // Notify once in the 60->30 min window.
                if (minsLeft <= 60 && minsLeft > 30 && !job.noApplicantWarningSent) {
                    await createNotification({
                        userId: job.postedBy,
                        type: 'job_update',
                        title: 'No Applications Yet - Action Needed',
                        message: 'You have not received or accepted any application, so please delete the post or we are going to delete it. Repost again if you want.',
                        jobId: job._id,
                    });
                    job.noApplicantWarningSent = true;
                    changed = true;
                }

                // Auto-delete post from active flow at 30 min before start (or later if stale).
                if (minsLeft <= 30) {
                    job.status = 'cancelled';
                    job.cancelledBy = null;
                    job.cancellationReason = 'Auto-cancelled: no worker applications before scheduled start window.';
                    job.cancelledAt = new Date();
                    job.applicationsOpen = false;
                    job.visibility = false;

                    await createNotification({
                        userId: job.postedBy,
                        type: 'job_update',
                        title: 'Job Post Auto-Deleted',
                        message: `Your post "${job.title}" was auto-deleted because no worker applied or was accepted before the start window. Repost again if needed.`,
                        jobId: job._id,
                    });

                    changed = true;
                }
            }
        }

        // 1. Auto-start when scheduled time reached
        if (job.status === 'scheduled' && job.scheduledDate && job.scheduledTime) {
            const [h, m] = job.scheduledTime.split(':').map(Number);
            const sched  = new Date(job.scheduledDate); sched.setHours(h, m, 0, 0);

            if (now >= sched.getTime()) {
                const openSlots = (job.workerSlots || []).filter((slot) => slot.status === 'open');
                if (openSlots.length > 0) {
                    const openSkills = [...new Set(openSlots.map((slot) => String(slot.skill || '').trim()).filter(Boolean))];
                    openSlots.forEach((slot) => { slot.status = 'cancelled'; });
                    job.applicationsOpen = false;

                    await createNotification({
                        userId: job.postedBy,
                        type: 'job_update',
                        title: 'Unfilled Slots Auto-Cancelled',
                        message: `Start time reached for "${job.title}". Unfilled slots were auto-cancelled: ${openSkills.join(', ') || 'general'}.`,
                        jobId: job._id,
                    });
                    changed = true;
                }
            }

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
                const clientUser = await User.findById(job.postedBy).select('mobile name');
                if (clientUser?.mobile) {
                    await sendCustomSms(
                        clientUser.mobile,
                        `KarigarConnect: Reminder - Estimated work time for job "${job.title}" has passed. Please open app and mark worker tasks complete.`
                    );
                }
                job.clientNotifiedCompletion = true; changed = true;
            }
        }

        // 5. Do not auto-complete whole jobs from backend maintenance.
        // Client must explicitly complete the job via updateJobStatus.
        if (job.status === 'running') {
            const endMs = job.estimatedJobEndMs ? job.estimatedJobEndMs() : null;
            const allSlotsDone = job.allSlotsCompleted ? job.allSlotsCompleted() : false;
            const staleByTimeout = !!endMs && now >= endMs + 2 * 60 * 60 * 1000;
            const reminderDue = allSlotsDone || staleByTimeout;

            if (reminderDue && !job.clientNotifiedCompletion) {
                await createNotification({
                    userId: job.postedBy,
                    type: 'reminder',
                    title: 'Please Confirm Job Completion',
                    message: `All worker tasks for "${job.title}" are done. Please confirm full job completion from the app when you are satisfied.`,
                });

                job.clientNotifiedCompletion = true;
                changed = true;
            }
        }

        if (changed) {
            try {
                await job.save();
            } catch (e) {
                console.error('Auto-maintenance save failed:', e.message);
                throw e;
            }
        }
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
        .populate('applicants.workerId',        'name photo karigarId points overallExperience skills verificationStatus mobile address travelMethod')
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
        .populate('applicants.workerId',        'name photo karigarId points overallExperience address travelMethod')
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
        
        // Basic fields
        if (req.body.email          !== undefined) c.email          = req.body.email;
        if (req.body.workplaceInfo  !== undefined) c.workplaceInfo  = req.body.workplaceInfo;
        if (req.body.socialProfile  !== undefined) c.socialProfile  = req.body.socialProfile;
        if (req.body.gender !== undefined) {
            if (!['Male', 'Female', 'Other'].includes(req.body.gender)) {
                return res.status(400).json({ message: 'Invalid gender value.' });
            }
            c.gender = req.body.gender;
        }
        if (req.body.age !== undefined) {
            const ageNum = Number(req.body.age);
            if (!Number.isFinite(ageNum) || ageNum <= 0) {
                return res.status(400).json({ message: 'Age must be a positive number.' });
            }
            if (ageNum < 18) {
                return res.status(400).json({ message: 'Age must be 18 or above.' });
            }
            c.age = ageNum;
            c.ageVerified = ageNum >= 18;
        }
        if (req.body.dob !== undefined) {
            const dobDate = new Date(req.body.dob);
            if (Number.isNaN(dobDate.getTime())) {
                return res.status(400).json({ message: 'Birth date is invalid.' });
            }
            if (dobDate > new Date()) {
                return res.status(400).json({ message: 'Birth date cannot be in the future.' });
            }
            c.dob = dobDate;
        }

        // Address fields
        c.address = c.address || {};
        if (req.body.city          !== undefined) c.address.city          = req.body.city;
        if (req.body.pincode       !== undefined) c.address.pincode       = req.body.pincode;
        if (req.body.locality      !== undefined) c.address.locality      = req.body.locality;
        if (req.body.homeLocation  !== undefined) c.address.homeLocation  = req.body.homeLocation;
        if (req.body.houseNumber   !== undefined) c.address.houseNumber   = req.body.houseNumber;
        if (req.body.fullAddress   !== undefined) c.address.fullAddress   = req.body.fullAddress;
        if (req.body.village       !== undefined) c.address.village       = req.body.village;
        if (req.body.latitude !== undefined) {
            const lat = Number(req.body.latitude);
            c.address.latitude = Number.isFinite(lat) ? lat : undefined;
        }
        if (req.body.longitude !== undefined) {
            const lon = Number(req.body.longitude);
            c.address.longitude = Number.isFinite(lon) ? lon : undefined;
        }

        // NEW: Security & Verification Fields
        if (req.body.ageVerified !== undefined) c.ageVerified = req.body.ageVerified === 'true' || req.body.ageVerified === true;
        if (req.body.emergencyContactName !== undefined || req.body.emergencyContactMobile !== undefined) {
            c.emergencyContact = c.emergencyContact || {};
            if (req.body.emergencyContactName !== undefined) c.emergencyContact.name = req.body.emergencyContactName;
            if (req.body.emergencyContactMobile !== undefined) c.emergencyContact.mobile = req.body.emergencyContactMobile;
        }
        if (req.body.profession !== undefined) c.profession = req.body.profession;
        if (req.body.signupReason !== undefined) c.signupReason = req.body.signupReason;
        if (req.body.previousHiringExperience !== undefined) {
            c.previousHiringExperience = req.body.previousHiringExperience === 'true' ? true : req.body.previousHiringExperience === 'false' ? false : null;
        }
        if (req.body.preferredPaymentMethod !== undefined) c.preferredPaymentMethod = req.body.preferredPaymentMethod;
        if (req.body.businessRegistrationNumber !== undefined) c.businessRegistrationNumber = req.body.businessRegistrationNumber;
        if (req.body.gstTaxId !== undefined) c.gstTaxId = req.body.gstTaxId;
        if (req.body.insuranceDetails !== undefined) c.insuranceDetails = req.body.insuranceDetails;
        if (req.body.securityQuestion !== undefined) c.securityQuestion = req.body.securityQuestion;
        if (req.body.securityAnswer !== undefined) c.securityAnswer = req.body.securityAnswer;
        if (req.body.termsPaymentAccepted !== undefined) c.termsPaymentAccepted = req.body.termsPaymentAccepted === 'true' || req.body.termsPaymentAccepted === true;
        if (req.body.termsDisputePolicyAccepted !== undefined) c.termsDisputePolicyAccepted = req.body.termsDisputePolicyAccepted === 'true' || req.body.termsDisputePolicyAccepted === true;
        if (req.body.termsDataPrivacyAccepted !== undefined) c.termsDataPrivacyAccepted = req.body.termsDataPrivacyAccepted === 'true' || req.body.termsDataPrivacyAccepted === true;
        if (req.body.termsWorkerProtectionAccepted !== undefined) c.termsWorkerProtectionAccepted = req.body.termsWorkerProtectionAccepted === 'true' || req.body.termsWorkerProtectionAccepted === true;

        // File uploads
        if (req.file) c.photo = req.file.path; // backward compatibility
        if (req.files) {
            if (req.files.photo && req.files.photo[0]) {
                c.photo = req.files.photo[0].path;
            }
            if (req.files.proofOfResidence && req.files.proofOfResidence[0]) {
                c.proofOfResidence = req.files.proofOfResidence[0].path;
            }
            if (req.files.secondaryIdProof && req.files.secondaryIdProof[0]) {
                c.secondaryIdProof = req.files.secondaryIdProof[0].path;
            }
            if (req.files.professionalCertification && req.files.professionalCertification[0]) {
                c.professionalCertification = req.files.professionalCertification[0].path;
            }
        }

        await c.save();
        await logAuditEvent({ userId: c._id, role: 'client', action: 'profile_update', req, metadata: { fields: Object.keys(req.body || {}) } });
        return res.json(await User.findById(c._id).select('-password -resetPasswordToken -resetPasswordExpire -securityAnswer -addressVerificationOtp -passwordChangeOtp'));
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.getClientDocumentPreviewUrl = async (req, res) => {
    try {
        const src = String(req.query?.url || '').trim();
        if (!src) return res.status(400).json({ message: 'Document URL is required.' });

        const match = src.match(/^https?:\/\/res\.cloudinary\.com\/[^/]+\/(image|raw|video)\/upload\/(?:v\d+\/)?([^?#]+)$/i);
        if (!match) return res.status(400).json({ message: 'Unsupported document URL.' });

        const resourceType = String(match[1] || 'raw').toLowerCase();
        const fullPath = decodeURIComponent(match[2] || '');
        const extMatch = fullPath.match(/\.([a-z0-9]+)$/i);
        const format = extMatch ? extMatch[1].toLowerCase() : 'pdf';
        const publicId = fullPath.replace(/\.[a-z0-9]+$/i, '');
        if (!publicId) return res.status(400).json({ message: 'Invalid Cloudinary public id.' });

        const expiresAt = Math.floor(Date.now() / 1000) + 10 * 60;
        const signedUrl = cloudinary.url(publicId, {
            resource_type: resourceType,
            type: 'upload',
            secure: true,
            sign_url: true,
            expires_at: expiresAt,
            format,
        });

        return res.json({ url: signedUrl, expiresAt });
    } catch (err) {
        console.error('getClientDocumentPreviewUrl:', err.message);
        return res.status(500).json({ message: 'Failed to prepare document preview.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET CLIENT JOBS
// ─────────────────────────────────────────────────────────────────────────────
exports.getClientJobs = async (req, res) => {
    try {
        const jobs = await Job.find({ postedBy: req.user.id, parentJobId: null })
            .populate('assignedTo',                'name photo karigarId points overallExperience mobile')
            .populate('applicants.workerId',        'name photo karigarId points overallExperience address travelMethod')
            .populate('workerSlots.assignedWorker', 'name photo karigarId points mobile')
            .populate('parentJobId',                'title')
            .sort({ createdAt: -1 });
        try { await runAutoMaintenance(jobs); } catch (e) { console.error('Auto-maintenance error:', e.message); }
        const jobsWithSubTasks = await attachSubTasksToParents(jobs, req.user.id);
        const jobsWithRatings = await enrichClientJobsWithRatings(jobsWithSubTasks);
        const jobsWithCommute = await attachCommuteToClientJobs(jobsWithRatings);
        const jobsWithSubmittedRatings = await attachClientSubmittedRatings(jobsWithCommute, req.user.id);
        const jobsWithAutoFlags = (Array.isArray(jobsWithSubmittedRatings) ? jobsWithSubmittedRatings : []).map((job) => {
            const reason = String(job?.cancellationReason || '').trim().toLowerCase();
            const autoByReason =
                reason.includes('auto-cancel')
                || reason.includes('auto cancel')
                || reason.includes('auto-delete')
                || reason.includes('auto deleted')
                || reason.includes('auto-deleted');

            return {
                ...job,
                isAutoCancelledOrDeleted: !!autoByReason,
            };
        });

        return res.json(jobsWithAutoFlags);
    } catch { return res.status(500).json({ message: 'Failed to fetch jobs.' }); }
};

const isHistoryJobForPermanentDelete = (job) => (
    !!job && (['completed', 'cancelled', 'cancelled_by_client'].includes(job.status) || job.archivedByClient)
);

const hardDeleteHistoryJobsWithRelations = async (parentJobs = [], clientId) => {
    const parentIds = parentJobs.map((j) => j._id);
    if (!parentIds.length) {
        return { deletedParentJobIds: [], deletedParentCount: 0, deletedTotalCount: 0 };
    }

    const subTasks = await Job.find({
        postedBy: clientId,
        parentJobId: { $in: parentIds },
    }).select('_id').lean();

    const subTaskIds = subTasks.map((st) => st._id);
    const allJobIds = [...parentIds, ...subTaskIds];

    await Promise.all(
        allJobIds.map((jobId) => removeJobById(jobId).catch((err) => {
            console.error('semantic removeJobById(hardDeleteHistoryJobsWithRelations):', err.message);
        })),
    );

    await Promise.all([
        Rating.deleteMany({ jobId: { $in: allJobIds } }),
        Location.deleteMany({ jobId: { $in: allJobIds } }),
    ]);

    await Job.deleteMany({ postedBy: clientId, _id: { $in: allJobIds } });

    return {
        deletedParentJobIds: parentIds.map((id) => String(id)),
        deletedParentCount: parentIds.length,
        deletedTotalCount: allJobIds.length,
    };
};

exports.permanentlyDeleteHistoryJob = async (req, res) => {
    try {
        const parentJob = await Job.findOne({ _id: req.params.id, postedBy: req.user.id, parentJobId: null });
        if (!parentJob) return res.status(404).json({ message: 'Job not found.' });
        if (!isHistoryJobForPermanentDelete(parentJob)) {
            return res.status(403).json({ message: 'Only completed/cancelled/deleted history jobs can be permanently deleted.' });
        }

        const result = await hardDeleteHistoryJobsWithRelations([parentJob], req.user.id);
        return res.json({
            message: 'History job permanently deleted.',
            ...result,
        });
    } catch (err) {
        console.error('permanentlyDeleteHistoryJob:', err);
        return res.status(500).json({ message: 'Failed to permanently delete history job.' });
    }
};

exports.permanentlyDeleteSelectedHistoryJobs = async (req, res) => {
    try {
        const ids = Array.isArray(req.body?.jobIds) ? req.body.jobIds : [];
        const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
        if (!validIds.length) return res.status(400).json({ message: 'Select at least one valid history job.' });

        const parentJobs = await Job.find({
            _id: { $in: validIds },
            postedBy: req.user.id,
            parentJobId: null,
        });

        const historyParents = parentJobs.filter(isHistoryJobForPermanentDelete);
        if (!historyParents.length) {
            return res.status(400).json({ message: 'No eligible history jobs found for deletion.' });
        }

        const result = await hardDeleteHistoryJobsWithRelations(historyParents, req.user.id);
        return res.json({
            message: 'Selected history jobs permanently deleted.',
            ...result,
        });
    } catch (err) {
        console.error('permanentlyDeleteSelectedHistoryJobs:', err);
        return res.status(500).json({ message: 'Failed to delete selected history jobs.' });
    }
};

exports.permanentlyDeleteAllHistoryJobs = async (req, res) => {
    try {
        const parentJobs = await Job.find({
            postedBy: req.user.id,
            parentJobId: null,
            $or: [
                { status: { $in: ['completed', 'cancelled', 'cancelled_by_client'] } },
                { archivedByClient: true },
            ],
        });

        if (!parentJobs.length) {
            return res.status(400).json({ message: 'No history jobs available to delete.' });
        }

        const result = await hardDeleteHistoryJobsWithRelations(parentJobs, req.user.id);
        return res.json({
            message: 'All history jobs permanently deleted.',
            ...result,
        });
    } catch (err) {
        console.error('permanentlyDeleteAllHistoryJobs:', err);
        return res.status(500).json({ message: 'Failed to delete all history jobs.' });
    }
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
            negotiable, minBudget, paymentMethod, shift, qaAnswers, urgent, category, experienceRequired,
        } = req.body;

        const parsedSkills = parseJSON(skills, []);
        const pSkills = Array.from(new Set(
            (Array.isArray(parsedSkills) ? parsedSkills : [])
                .map((s) => String(s || '').trim().toLowerCase())
                .filter(Boolean),
        ));
        const pLoc = normalizeJobLocation(parseJSON(location, {}) || {});
        const pBD = sanitiseBudgetBreakdown(parseJSON(budgetBreakdown, undefined));
        const pWR = Math.max(1, Number(workersRequired) || 1);
        const paymentNum = Math.max(0, Number(payment) || 0);
        const estimatedTotalNum = Math.max(0, Number(totalEstimatedCost) || Number(pBD?.totalEstimated) || 0);
        const finalPaymentNum = Math.max(paymentNum, estimatedTotalNum);
        const maxBlockHours = Array.isArray(pBD?.breakdown)
            ? pBD.breakdown.reduce((m, b) => Math.max(m, Number(b?.hours) || 0), 0)
            : 0;
        const inferredDurationDays = Math.max(0, Number(pBD?.durationDays) || Math.ceil(maxBlockHours / 8));
        const normalizedDuration = String(duration || '').trim() ||
            (inferredDurationDays > 0 ? `${inferredDurationDays} day${inferredDurationDays > 1 ? 's' : ''}` : '');

        const allowedPaymentMethods = new Set(['cash', 'upi_qr', 'bank_transfer', 'flexible']);
        const normalizedPaymentMethod = allowedPaymentMethods.has(String(paymentMethod || '').trim())
            ? String(paymentMethod).trim()
            : 'flexible';

        const errors = [
            validateNeg(payment,          'Budget'),
            validateNeg(workersRequired,  'Workers required'),
            validateNeg(minBudget,        'Minimum budget'),
        ].filter(Boolean);
        if (errors.length)        return res.status(400).json({ message: errors[0] });
        if (!title?.trim())       return res.status(400).json({ message: 'Job title is required.' });
        if (!description?.trim()) return res.status(400).json({ message: 'Job description is required.' });
        if (!Array.isArray(pSkills) || !pSkills.length) return res.status(400).json({ message: 'At least one skill is required.' });
        if (!String(pLoc?.city || '').trim()) return res.status(400).json({ message: 'City is required for pricing and matching.' });
        if (!String(pLoc?.locality || '').trim()) return res.status(400).json({ message: 'Locality is required for locality factor pricing.' });
        if (!String(pLoc?.state || '').trim()) return res.status(400).json({ message: 'State is required for location validation.' });
        if (!String(pLoc?.buildingName || '').trim()) return res.status(400).json({ message: 'Building/Home name is required for precise location guidance.' });
        if (!String(pLoc?.unitNumber || '').trim()) return res.status(400).json({ message: 'Flat/Home number is required for precise location guidance.' });
        if (finalPaymentNum <= 0) return res.status(400).json({ message: 'Budget must be greater than 0.' });
        if (!normalizedDuration) return res.status(400).json({ message: 'Duration is required.' });
        if ((negotiable === 'true' || negotiable === true) && Number(minBudget) > 0 && Number(minBudget) >= finalPaymentNum) {
            return res.status(400).json({ message: 'Minimum budget must be less than offered budget.' });
        }

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
        if (photos.length > 3) {
            return res.status(400).json({ message: 'Maximum 3 photos are allowed.' });
        }

        const job = await Job.create({
            postedBy:            req.user.id,
            title:               title.trim(),
            category:            category || '',
            description:         description.trim(),
            shortDescription:    shortDescription || description.trim().slice(0, 150),
            detailedDescription: detailedDescription || description.trim(),
            skills:              pSkills,
            payment:             finalPaymentNum,
            paymentMethod:       normalizedPaymentMethod,
            duration:            normalizedDuration,
            experienceRequired:  experienceRequired || '',
            workersRequired:     pWR,
            location:            pLoc,
            photos,
            scheduledDate,
            scheduledTime,
            shift:               shift || '',
            negotiable:          negotiable === 'true' || negotiable === true,
            minBudget:           Math.max(0, Number(minBudget) || 0),
            urgent:              urgent === 'true' || urgent === true,
            qaAnswers:           sanitiseQaAnswers(qaAnswers),
            budgetBreakdown:     pBD,
            totalEstimatedCost:  estimatedTotalNum || finalPaymentNum,
            workerSlots:         buildWorkerSlots(pBD, pSkills, pWR),
        });

        upsertJobById(job._id).catch((err) => {
            console.error('semantic upsertJobById(postJob):', err.message);
        });

        let smartSuggestions = [];
        try {
            const semantic = await getWorkersForJob(job._id, { topK: 3, minScore: 0.25, includeUnavailable: false });
            smartSuggestions = mapSemanticWorkersToLegacyShape(semantic?.matches || []);
        } catch (err) {
            console.error('semantic getWorkersForJob(postJob):', err.message);
            smartSuggestions = await buildSmartWorkerSuggestions(job, { limit: 3 });
        }
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

        const activeSubTasks = await Job.find({
            postedBy: req.user.id,
            parentJobId: job._id,
            status: { $in: ['open', 'proposal', 'scheduled', 'running'] },
        }).select('_id');

        job.status = 'cancelled';
        job.cancelledBy = 'client';
        job.cancellationReason = 'Deleted by client before assignment.';
        job.cancelledAt = new Date();
        job.applicationsOpen = false;
        job.visibility = false;
        job.archivedByClient = true;
        job.archivedAt = new Date();
        await job.save();

        if (activeSubTasks.length) {
            const subTaskIds = activeSubTasks.map((st) => st._id);
            await Job.updateMany(
                { _id: { $in: subTaskIds } },
                {
                    $set: {
                        status: 'cancelled',
                        cancelledBy: 'client',
                        cancellationReason: 'Auto-cancelled: parent job deleted by client.',
                        cancelledAt: new Date(),
                        applicationsOpen: false,
                        visibility: false,
                        archivedByClient: true,
                        archivedAt: new Date(),
                    },
                },
            );

            await Promise.all(subTaskIds.map((subTaskId) => upsertJobById(subTaskId).catch((err) => {
                console.error('semantic upsertJobById(deleteJob subTask archive):', err.message);
            })));
        }

        upsertJobById(job._id).catch((err) => {
            console.error('semantic upsertJobById(deleteJob archive):', err.message);
        });
        return res.json({ message: 'Job moved to history.', job, autoCancelledSubTasks: activeSubTasks.length });
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
        upsertJobById(job._id).catch((err) => {
            console.error('semantic upsertJobById(cancelJob):', err.message);
        });
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

        if (!parentJob.scheduledDate || !parentJob.scheduledTime) {
            return res.status(400).json({ message: 'Repost is allowed only for jobs with scheduled date and time.' });
        }

        const [ph, pm] = String(parentJob.scheduledTime).split(':').map(Number);
        const parentStart = new Date(parentJob.scheduledDate);
        parentStart.setHours(ph, pm, 0, 0);
        const minsToStart = (parentStart.getTime() - Date.now()) / 60000;

        if (minsToStart > 30 || minsToStart <= 0) {
            return res.status(400).json({
                message: 'Repost can be done only in the last 30 minutes before job start time.',
            });
        }

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
            paymentMethod:       parentJob.paymentMethod || 'flexible',
            negotiable:          !!parentJob.negotiable,
            minBudget:           Math.max(0, Number(parentJob.minBudget) || 0),
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
        upsertJobById(parentJob._id).catch((err) => {
            console.error('semantic upsertJobById(repostMissingSkill parent):', err.message);
        });
        upsertJobById(childJob._id).catch((err) => {
            console.error('semantic upsertJobById(repostMissingSkill child):', err.message);
        });

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
        upsertJobById(job._id).catch((err) => {
            console.error('semantic upsertJobById(cancelSlotRequirement):', err.message);
        });
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
        let acceptanceNotice = null;
        if (!workerId || !status) return res.status(400).json({ message: 'workerId and status are required.' });
        const job = await Job.findOne({ _id: req.params.jobId, postedBy: req.user.id });
        if (!job) return res.status(404).json({ message: 'Not found.' });

        let applicant = reqSkill
            ? job.applicants.find(a => a.workerId?.toString() === workerId && a.skill === reqSkill && a.status === 'pending')
            : null;
        if (!applicant) applicant = job.applicants.find(a => a.workerId?.toString() === workerId && a.status === 'pending');
        if (!applicant) return res.status(404).json({ message: 'Applicant not found.' });

        if (status === 'accepted') {
            const skill    = applicant.skill || reqSkill || job.skills?.[0] || 'general';
            const openSlot = job.workerSlots.find(s => s.status === 'open' && s.skill === skill)
                          || job.workerSlots.find(s => s.status === 'open');
            if (!openSlot) return res.status(400).json({ message: `All ${skill} slots are filled.` });

            const workerDoc = await User.findById(workerId).select('travelMethod address');
            const dailyProfile = await getWorkerDailyProfileSnapshot(workerDoc);
            const commute = await computeWorkerJobCommute({
                worker: workerDoc,
                dailyProfile,
                job,
            });
            const acceptanceRule = getClientAcceptanceRuleResult(commute, { maxDistanceKm: 25, job });
            if (!acceptanceRule.canAccept) {
                return res.status(400).json({
                    message: acceptanceRule.warning || 'Unable to accept worker due to commute constraints.',
                    commute: serializeCommute(commute),
                });
            }

            const conflict = await checkWorkerScheduleConflict(Job, workerId, job._id.toString(), {
                targetSlotHours: openSlot.hoursEstimated,
                targetScheduledDate: job.scheduledDate,
                targetScheduledTime: job.scheduledTime,
                targetActualStartTime: job.actualStartTime,
            });
            if (conflict.conflict) return res.status(409).json({ message: conflict.message });

            acceptanceNotice = await buildOtherAssignmentNotice({
                workerId,
                excludingJobId: job._id,
                currentClientId: req.user.id,
            });
            if (acceptanceRule.warning) {
                acceptanceNotice = acceptanceNotice
                    ? `${acceptanceNotice} ${acceptanceRule.warning}`
                    : acceptanceRule.warning;
            }

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
            const rejectionReason = String(feedback || '').trim();
            if (!rejectionReason) {
                return res.status(400).json({ message: 'Please provide a rejection reason.' });
            }

            applicant.status = 'rejected'; applicant.feedback = rejectionReason;
            await createNotification({ userId: workerId, type: 'job_update', title: 'Application Not Selected', message: `Your application for "${job.title}" was not selected. Feedback: ${rejectionReason}` });

            const workerUser = await User.findById(workerId).select('mobile name');
            if (workerUser?.mobile) {
                await sendCustomSms(
                    workerUser.mobile,
                    `KarigarConnect: Your application for job "${job.title}" was rejected. Reason: ${rejectionReason}`
                );
            }
        }

        await job.save();
        upsertJobById(job._id).catch((err) => {
            console.error('semantic upsertJobById(respondToApplicant):', err.message);
        });
        submitFeedback({
            workerId,
            jobId: job._id,
            event: status === 'accepted' ? 'hired' : 'rejected',
            source: 'client_response',
        }).catch((err) => {
            console.error('semantic submitFeedback(respondToApplicant):', err.message);
        });
        await job.populate('assignedTo',                'name photo karigarId mobile');
        await job.populate('applicants.workerId',        'name photo karigarId');
        await job.populate('workerSlots.assignedWorker', 'name photo karigarId mobile');
        const refreshed = await loadParentJobWithSubTasks(job._id, req.user.id);
        const [rated] = await enrichClientJobsWithRatings([refreshed || job.toObject()]);
        const [enrichedJob] = await attachCommuteToClientJobs([rated]);
        return res.json({
            message: `Applicant ${status}.`,
            job: enrichedJob || job,
            ...(acceptanceNotice ? { notice: acceptanceNotice } : {}),
        });
    } catch (err) {
        console.error('respondToApplicant:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};

exports.hireWorker = async (req, res) => { req.body.status = 'accepted'; return exports.respondToApplicant(req, res); };

exports.respondToSubTaskApplicant = async (req, res) => {
    try {
        const { subTaskId, workerId, status, feedback } = req.body;
        let acceptanceNotice = null;
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
            const openSlot = subTask.workerSlots.find(s => s.status === 'open') || subTask.workerSlots[0];
            if (!openSlot) return res.status(400).json({ message: 'No available slot in sub-task.' });

            const workerDoc = await User.findById(workerId).select('travelMethod address');
            const dailyProfile = await getWorkerDailyProfileSnapshot(workerDoc);
            const commute = await computeWorkerJobCommute({
                worker: workerDoc,
                dailyProfile,
                job: subTask,
            });
            const acceptanceRule = getClientAcceptanceRuleResult(commute, { maxDistanceKm: 25, job: subTask });
            if (!acceptanceRule.canAccept) {
                return res.status(400).json({
                    message: acceptanceRule.warning || 'Unable to accept worker due to commute constraints.',
                    commute: serializeCommute(commute),
                });
            }

            const conflict = await checkWorkerScheduleConflict(Job, workerId, subTask._id.toString(), {
                targetSlotHours: openSlot.hoursEstimated,
                targetScheduledDate: subTask.scheduledDate,
                targetScheduledTime: subTask.scheduledTime,
                targetActualStartTime: subTask.actualStartTime,
            });
            if (conflict.conflict) return res.status(409).json({ message: conflict.message });

            acceptanceNotice = await buildOtherAssignmentNotice({
                workerId,
                excludingJobId: subTask._id,
                currentClientId: req.user.id,
            });
            if (acceptanceRule.warning) {
                acceptanceNotice = acceptanceNotice
                    ? `${acceptanceNotice} ${acceptanceRule.warning}`
                    : acceptanceRule.warning;
            }

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
            const rejectionReason = String(feedback || '').trim();
            if (!rejectionReason) {
                return res.status(400).json({ message: 'Please provide a rejection reason.' });
            }

            applicant.status = 'rejected'; applicant.feedback = rejectionReason;
            await createNotification({ userId: workerId, type: 'job_update', title: 'Application Not Selected', message: `Your application for "${subTask.title}" was not selected. Feedback: ${rejectionReason}` });

            const workerUser = await User.findById(workerId).select('mobile name');
            if (workerUser?.mobile) {
                await sendCustomSms(
                    workerUser.mobile,
                    `KarigarConnect: Your application for sub-task "${subTask.title}" was rejected. Reason: ${rejectionReason}`
                );
            }
        }

        await subTask.save();
        await parentJob.save();
        upsertJobById(subTask._id).catch((err) => {
            console.error('semantic upsertJobById(respondToSubTaskApplicant subTask):', err.message);
        });
        upsertJobById(parentJob._id).catch((err) => {
            console.error('semantic upsertJobById(respondToSubTaskApplicant parent):', err.message);
        });
        submitFeedback({
            workerId,
            jobId: subTask._id,
            event: status === 'accepted' ? 'hired' : 'rejected',
            source: 'client_subtask_response',
        }).catch((err) => {
            console.error('semantic submitFeedback(respondToSubTaskApplicant):', err.message);
        });
        const parent = await loadParentJobWithSubTasks(req.params.id, req.user.id);
        if (!parent) return res.status(404).json({ message: 'Parent job not found.' });
        const [ratedParent] = await enrichClientJobsWithRatings([parent]);
        const [enrichedParent] = await attachCommuteToClientJobs([ratedParent]);
        return res.json({
            message: `Sub-task applicant ${status}.`,
            job: enrichedParent || parent,
            ...(acceptanceNotice ? { notice: acceptanceNotice } : {}),
        });
    } catch (err) {
        console.error('respondToSubTaskApplicant:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};

exports.completeWorkerTask = async (req, res) => {
    try {
        const { workerId, slotId, finalPaidPrice, priceSource, workerQuotedPrice } = req.body;
        if (!workerId) return res.status(400).json({ message: 'workerId is required.' });
        const job = await Job.findOne({ _id: req.params.id, postedBy: req.user.id });
        if (!job) return res.status(404).json({ message: 'Not found.' });
        if (job.status !== 'running') return res.status(400).json({ message: 'Only for running jobs.' });
        const slot = slotId
            ? job.workerSlots.id(slotId)
            : job.workerSlots.find(s => s.assignedWorker?.toString() === workerId && s.status === 'filled');
        if (!slot || slot.status !== 'filled') return res.status(404).json({ message: 'No active slot found.' });

        const paidAmount = toPositiveNumber(finalPaidPrice) || toPositiveNumber(slot.finalPaidPrice);
        if (paidAmount) {
            slot.finalPaidPrice = paidAmount;
        }

        slot.status = 'task_completed'; slot.completedAt = new Date(); slot.actualEndTime = new Date();
        applyPricingCompletionMeta(job, {
            finalPaidPrice: paidAmount || 0,
            slotFinalPaid: [{ slotId: slot._id, skill: slot.skill, workerId: slot.assignedWorker || workerId, amount: paidAmount || 0 }],
            workerQuotedPrice,
            priceSource: priceSource || 'manual',
            captureTimestamp: true,
        });
        await createNotification({ userId: workerId, type: 'job_update', title: 'Payment Received ✅', message: `Your ${slot.skill} payment for "${job.title}" has been recorded and the task is marked complete.` });
        await job.save();
        upsertJobById(job._id).catch((err) => {
            console.error('semantic upsertJobById(completeWorkerTask):', err.message);
        });
        await job.populate('workerSlots.assignedWorker', 'name photo karigarId mobile');
        return res.json({ message: `${slot.skill} payment recorded.`, job, allDone: job.allSlotsCompleted(), slotPaid: paidAmount || null });
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
        const { status, manualComplete = false } = req.body;
        const job = await Job.findOne({ _id: req.params.id, postedBy: req.user.id });
        if (!job) return res.status(404).json({ message: 'Not found.' });
        if (status === 'completed') {
            if (job.status !== 'running') return res.status(400).json({ message: 'Only running jobs can be marked complete.' });
            const completionSlots = job.workerSlots.filter((slot) => (
                slot.assignedWorker && !['cancelled', 'open', 'reposted'].includes(slot.status)
            ));

            const incompleteSlots = completionSlots.filter((slot) => slot.status !== 'task_completed');
            if (incompleteSlots.length > 0) {
                return res.status(400).json({
                    message: `Please pay each assigned worker before final completion. Pending: ${[...new Set(incompleteSlots.map((slot) => slot.skill || 'skill'))].join(', ')}.`,
                });
            }

            const unpaidSlots = completionSlots.filter((slot) => !toPositiveNumber(slot.finalPaidPrice));
            if (unpaidSlots.length > 0) {
                return res.status(400).json({
                    message: `Please pay each assigned worker before completion. Pending: ${[...new Set(unpaidSlots.map((slot) => slot.skill || 'skill'))].join(', ')}.`,
                });
            }

            job.actualEndTime = new Date();
            job.applicationsOpen = false;
            applyPricingCompletionMeta(job, {
                slotFinalPaid: completionSlots.map((slot) => ({
                    slotId: slot._id,
                    skill: slot.skill || 'general',
                    workerId: slot.assignedWorker || null,
                    amount: toPositiveNumber(slot.finalPaidPrice),
                })),
                finalPaidPrice: completionSlots.reduce((sum, slot) => sum + Number(toPositiveNumber(slot.finalPaidPrice) || 0), 0),
                priceSource: 'manual',
                captureTimestamp: true,
            });
        }
        job.status = status;
        await job.save();
        upsertJobById(job._id).catch((err) => {
            console.error('semantic upsertJobById(updateJobStatus):', err.message);
        });
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

exports.removeCompletionPhoto = async (req, res) => {
    try {
        const job = await Job.findOne({ _id: req.params.id, postedBy: req.user.id });
        if (!job) return res.status(404).json({ message: 'Not found.' });
        if (job.status !== 'running') return res.status(400).json({ message: 'Only for running jobs.' });

        const idx = Number(req.params.photoIndex);
        if (!Number.isInteger(idx) || idx < 0) {
            return res.status(400).json({ message: 'Invalid photo index.' });
        }

        const currentPhotos = Array.isArray(job.completionPhotos) ? job.completionPhotos : [];
        if (idx >= currentPhotos.length) {
            return res.status(404).json({ message: 'Photo not found.' });
        }

        job.completionPhotos = currentPhotos.filter((_, i) => i !== idx);
        await job.save();
        return res.json({ message: 'Photo removed.', completionPhotos: job.completionPhotos });
    } catch {
        return res.status(500).json({ message: 'Failed.' });
    }
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
        upsertJobById(job._id).catch((err) => {
            console.error('semantic upsertJobById(startJob):', err.message);
        });
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
        upsertJobById(job._id).catch((err) => {
            console.error('semantic upsertJobById(toggleJobApplications):', err.message);
        });
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
            .populate('applicants.workerId', 'name photo karigarId points overallExperience skills verificationStatus mobile address travelMethod');
        if (!job) return res.status(404).json({ message: 'Not found.' });

        const workerIds = (job.applicants || []).map((app) => String(app?.workerId?._id || app?.workerId || '')).filter(Boolean);
        const dailyProfileMap = await buildDailyProfileMap(workerIds);
        const applicants = await Promise.all((job.applicants || []).map(async (app) => {
            const worker = app?.workerId;
            const workerId = String(worker?._id || worker || '');
            const commute = await computeWorkerJobCommute({
                worker,
                dailyProfile: dailyProfileMap.get(workerId) || null,
                job,
            });
            return {
                ...app.toObject(),
                commute: serializeCommute(commute),
            };
        }));

        return res.json(applicants);
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.getSmartWorkerSuggestions = async (req, res) => {
    try {
        const job = await Job.findOne({ _id: req.params.jobId, postedBy: req.user.id });
        if (!job) return res.status(404).json({ message: 'Not found.' });

        let suggestions = [];
        try {
            const semantic = await getWorkersForJob(job._id, {
                topK: Number(req.query.topK) || 3,
                minScore: Number(req.query.minScore) || 0.25,
                includeUnavailable: req.query.includeUnavailable === 'true',
            });
            suggestions = mapSemanticWorkersToLegacyShape(semantic?.matches || []);
        } catch (err) {
            console.error('semantic getWorkersForJob(getSmartWorkerSuggestions):', err.message);
            suggestions = await buildSmartWorkerSuggestions(job, { limit: 3 });
        }

        const suggestionIds = [...new Set((suggestions || []).map((s) => String(s?._id || '')).filter(Boolean))];
        const workers = await User.find({ _id: { $in: suggestionIds }, role: 'worker' })
            .select('name photo karigarId mobile points overallExperience address travelMethod')
            .lean();
        const workerMap = new Map(workers.map((w) => [String(w._id), w]));
        const dailyProfileMap = await buildDailyProfileMap(suggestionIds);
        const completedJobsMap = await getCompletedJobsCountMap(Job, workers.map((w) => w._id));

        const enrichedSuggestions = await Promise.all((suggestions || []).map(async (row) => {
            const workerId = String(row?._id || '');
            const worker = workerMap.get(workerId) || row;
            const commute = await computeWorkerJobCommute({
                worker,
                dailyProfile: dailyProfileMap.get(workerId) || null,
                job,
            });

            const semanticScore = Number(row?.score ?? row?.semanticScore ?? 0);
            const ratingScore = Math.max(0, Math.min(1, Number(row?.avgStars || 0) / 5));
            const pointsScore = Math.max(0, Math.min(1, Number(worker?.points || row?.points || 0) / 1500));
            const completedJobs = Number(completedJobsMap.get(workerId) || 0);
            const completionScore = Math.max(0, Math.min(1, completedJobs / 40));
            const distanceScore = commute?.available
                ? Math.max(0, Math.min(1, (25 - Number(commute.distanceKm || 25)) / 25))
                : 0.2;

            const rankingScore = Number((
                semanticScore * 0.55 +
                distanceScore * 0.2 +
                ratingScore * 0.15 +
                completionScore * 0.05 +
                pointsScore * 0.05
            ).toFixed(4));

            return {
                ...row,
                _id: workerId,
                name: worker?.name || row?.name || '',
                photo: worker?.photo || row?.photo || '',
                karigarId: worker?.karigarId || row?.karigarId || '',
                mobile: worker?.mobile || row?.mobile || '',
                points: Number(worker?.points || row?.points || 0),
                overallExperience: worker?.overallExperience || row?.overallExperience || '',
                completedJobs,
                commute: serializeCommute(commute),
                rankingScore,
                rankingScorePercent: Math.round(rankingScore * 100),
            };
        }));

        enrichedSuggestions.sort((a, b) => Number(b.rankingScore || 0) - Number(a.rankingScore || 0));

        return res.json({
            jobId: job._id,
            suggestions: enrichedSuggestions,
            radiusKm: ALERT_RADIUS_KM,
        });
    } catch (err) {
        console.error('getSmartWorkerSuggestions:', err);
        return res.status(500).json({ message: 'Failed to load suggestions.' });
    }
};

exports.inviteWorkersToJob = async (req, res) => {
    try {
        const { workerIds, inviteSkill } = req.body;
        if (!Array.isArray(workerIds) || workerIds.length === 0) {
            return res.status(400).json({ message: 'workerIds array is required.' });
        }
        const normalizedInviteSkill = String(inviteSkill || '').trim().toLowerCase();
        if (!normalizedInviteSkill) {
            return res.status(400).json({ message: 'inviteSkill is required.' });
        }

        const job = await Job.findOne({ _id: req.params.jobId, postedBy: req.user.id });
        if (!job) return res.status(404).json({ message: 'Not found.' });
        if (!['open', 'scheduled'].includes(job.status) || !job.applicationsOpen) {
            return res.status(400).json({ message: 'Job is not accepting outreach right now.' });
        }

        const normalizeSkill = (value) => String(value || '').trim().toLowerCase();
        const openSlots = Array.isArray(job.workerSlots)
            ? job.workerSlots.filter((slot) => slot.status === 'open')
            : [];

        const selectedOpenSlot = openSlots.find((slot) => normalizeSkill(slot.skill) === normalizedInviteSkill);
        const skillExistsOnJob = (job.skills || []).some((skill) => normalizeSkill(skill) === normalizedInviteSkill);
        if (!selectedOpenSlot && !skillExistsOnJob) {
            return res.status(400).json({ message: 'Selected invite skill is not available on this job.' });
        }

        const inviteSkillLabel = selectedOpenSlot?.skill || (job.skills || []).find((skill) => normalizeSkill(skill) === normalizedInviteSkill) || inviteSkill;

        const dedupedIds = [...new Set(workerIds.map((id) => String(id)).filter(Boolean))].slice(0, 10);
        const workers = await User.find({
            _id: { $in: dedupedIds },
            role: 'worker',
            verificationStatus: 'approved',
            availability: true,
        }).select('_id name mobile travelMethod address points overallExperience');

        if (!workers.length) return res.status(404).json({ message: 'No eligible workers found.' });

        const dailyProfileMap = await buildDailyProfileMap(workers.map((w) => String(w._id)));

        const invitedNow = [];
        for (const worker of workers) {
            const workerId = String(worker._id);
            const commute = await computeWorkerJobCommute({
                worker,
                dailyProfile: dailyProfileMap.get(workerId) || null,
                job,
            });
            const existingInviteIndex = (job.invitedWorkers || []).findIndex((iw) => String(iw.workerId) === workerId);
            if (existingInviteIndex === -1) {
                job.invitedWorkers.push({
                    workerId: worker._id,
                    inviteSkill: inviteSkillLabel,
                    inviteSlotId: selectedOpenSlot?._id || null,
                    invitedAt: new Date(),
                });
            } else {
                job.invitedWorkers[existingInviteIndex].inviteSkill = inviteSkillLabel;
                job.invitedWorkers[existingInviteIndex].inviteSlotId = selectedOpenSlot?._id || null;
                job.invitedWorkers[existingInviteIndex].invitedAt = new Date();
            }
            invitedNow.push({ ...worker.toObject(), commute: serializeCommute(commute) });

            await createNotification({
                userId: worker._id,
                type: job.urgent ? 'urgent_job' : 'job_update',
                title: job.urgent ? 'Urgent Invite from Client' : 'Direct Job Invite',
                message: `You are invited for ${inviteSkillLabel} in "${job.title}" (${job.location?.city || 'your area'}).`,
                jobId: job._id,
                data: {
                    invited: true,
                    urgent: !!job.urgent,
                    inviteSkill: inviteSkillLabel,
                },
            });

            if (worker.mobile) {
                await sendCustomSms(
                    worker.mobile,
                    `KarigarConnect: You have a direct ${job.urgent ? 'URGENT ' : ''}invite for ${inviteSkillLabel} in "${job.title}". Open Direct Invites to respond.`
                );
            }

            submitFeedback({
                workerId,
                jobId: job._id,
                event: 'invited',
                source: 'client_invite',
            }).catch((err) => {
                console.error('semantic submitFeedback(inviteWorkersToJob):', err.message);
            });
        }

        await job.save();
        upsertJobById(job._id).catch((err) => {
            console.error('semantic upsertJobById(inviteWorkersToJob):', err.message);
        });
        await logAuditEvent({
            userId: req.user.id,
            role: 'client',
            action: 'job_invite_workers',
            req,
            metadata: { jobId: job._id, inviteSkill: inviteSkillLabel, inviteSlotId: selectedOpenSlot?._id || null, invitedWorkers: invitedNow.map((w) => w._id) },
        });

        return res.json({
            message: 'Workers invited successfully.',
            invitedCount: invitedNow.length,
            inviteSkill: inviteSkillLabel,
            invitedWorkers: invitedNow.map((w) => ({
                _id: w._id,
                name: w.name,
                mobile: w.mobile || '',
                commute: w.commute || null,
            })),
        });
    } catch (err) {
        console.error('inviteWorkersToJob:', err);
        return res.status(500).json({ message: 'Failed to invite workers.' });
    }
};

exports.getWorkerPublicProfile = async (req, res) => {
    try {
        const w = await findWorkerByIdOrKarigarId(req.params.workerId, {
            select: 'name photo karigarId skills overallExperience points verificationStatus location address mobile phoneType travelMethod',
        });
        if (!w) return res.status(404).json({ message: 'Not found.' });
        const dailyProfile = await getWorkerDailyProfileSnapshot(w);
        const completedJobs = await Job.countDocuments({ assignedTo: w._id, status: 'completed' });
        const ratings       = await Rating.find({ worker: w._id }).populate('client','name photo').sort({ createdAt: -1 }).limit(10);
        const avgStars      = ratings.length ? ratings.reduce((s, r) => s + (r.stars || 0), 0) / ratings.length : 0;
        return res.json({
            ...w.toObject(),
            completedJobs,
            avgStars: Math.round(avgStars * 10) / 10,
            ratings,
            dailyProfile,
        });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.generateWorkerProfileSummary = async (req, res) => {
    try {
        const workerId = req.params.workerId;
        const worker = await User.findById(workerId)
            .select('role name photo karigarId skills overallExperience experience points verificationStatus location address mobile email travelMethod');

        if (!worker || worker.role === 'client') {
            return res.status(404).json({ message: 'Worker not found.' });
        }

        const [completedJobs, ratingStats] = await Promise.all([
            Job.countDocuments({ assignedTo: worker._id, status: 'completed' }),
            Rating.aggregate([
                { $match: { worker: worker._id } },
                { $group: { _id: '$worker', avgStars: { $avg: '$stars' }, ratingCount: { $sum: 1 } } },
            ]),
        ]);

        const stats = ratingStats?.[0] || { avgStars: 0, ratingCount: 0 };
        const workerData = {
            ...worker.toObject(),
            completedJobs,
            avgStars: Number(stats.avgStars || 0),
            ratingCount: Number(stats.ratingCount || 0),
            dailyProfile: buildWorkerDailyProfileResponse(await getWorkerDailyProfileSnapshot(worker), worker),
        };

        let summary = null;
        let generatedBy = 'fallback';

        try {
            summary = await generateSummaryWithGroq(workerData);
            if (summary) generatedBy = 'groq';
        } catch (err) {
            console.error('generateWorkerProfileSummary groq error:', err.message);
        }

        if (!summary) summary = buildFallbackWorkerSummary(workerData);

        return res.json({ summary, generatedBy });
    } catch (err) {
        console.error('generateWorkerProfileSummary error:', err);
        return res.status(500).json({ message: 'Failed to generate worker profile summary.' });
    }
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
            title, notes, workDescription, city, locality, urgent, clientBudget,
            answers, opinions, answersById, preferencesById,
            questionSet, preferenceQuestionSet,
            includeTravelCost,
            report, durationDays, budgetBreakdown,
            recommendation, query, analysis,
        } = req.body;

        const normalizedReport = report || analysis || null;
        const item = await AIHistory.create({
            userId:          req.user.id,
            title:           title || normalizedReport?.jobTitle || '',
            notes:           notes || '',
            workDescription: workDescription || query || '',
            city:            city || '',
            locality:        locality || '',
            urgent:          urgent || false,
            includeTravelCost: !!includeTravelCost,
            clientBudget:    clientBudget ?? null,
            answers:         answers || {},
            opinions:        opinions || {},
            answersById:     answersById || {},
            preferencesById: preferencesById || {},
            questionSet:     Array.isArray(questionSet) ? questionSet : [],
            preferenceQuestionSet: Array.isArray(preferenceQuestionSet) ? preferenceQuestionSet : [],
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
        const allowed = [
            'title','notes','workDescription','city','locality','urgent','includeTravelCost','clientBudget',
            'answers','opinions','answersById','preferencesById','questionSet','preferenceQuestionSet',
            'report','durationDays','budgetBreakdown','recommendation',
        ];
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

// ═════════════════════════════════════════════════════════════════════════════
// CLIENT SETTINGS — PASSWORD CHANGE (OTP FLOW)
// ═════════════════════════════════════════════════════════════════════════════

// STEP 1: Send OTP to registered mobile
exports.sendClientPasswordChangeOtp = async (req, res) => {
    try {
        const client = await User.findById(req.user.id).select('mobile name role');
        if (!client || client.role !== 'client') {
            return res.status(404).json({ message: 'Client not found.' });
        }
        if (!client.mobile) {
            return res.status(400).json({ message: 'No mobile number linked to your account.' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000);

        client.passwordChangeOtp = crypto.createHash('sha256').update(otp).digest('hex');
        client.passwordChangeOtpExpiry = expiry;
        client.passwordChangeVerifiedToken = undefined;
        client.passwordChangeVerifiedTokenExpiry = undefined;
        await client.save({ validateBeforeSave: false });

        await sendPasswordChangeOtpSms(client.mobile, otp, client.name);

        return res.json({
            message: `OTP sent to your registered mobile number ending in ${client.mobile.slice(-4)}.`,
            mobile: `xxxxxx${client.mobile.slice(-4)}`,
        });
    } catch (err) {
        console.error('sendClientPasswordChangeOtp:', err);
        return res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
    }
};

// STEP 2: Verify OTP and return a short-lived verified token
exports.verifyClientPasswordChangeOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        if (!otp?.trim()) return res.status(400).json({ message: 'OTP is required.' });

        const client = await User.findById(req.user.id)
            .select('+passwordChangeOtp +passwordChangeOtpExpiry role');

        if (!client || client.role !== 'client') {
            return res.status(404).json({ message: 'Client not found.' });
        }

        if (!client.passwordChangeOtp || !client.passwordChangeOtpExpiry) {
            return res.status(400).json({ message: 'No OTP request found. Please request a new OTP first.' });
        }

        if (Date.now() > new Date(client.passwordChangeOtpExpiry).getTime()) {
            return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
        }

        const hashedInput = crypto.createHash('sha256').update(otp.trim()).digest('hex');
        if (hashedInput !== client.passwordChangeOtp) {
            return res.status(400).json({ message: 'Incorrect OTP. Please check and try again.' });
        }

        const rawToken = crypto.randomBytes(32).toString('hex');
        client.passwordChangeVerifiedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
        client.passwordChangeVerifiedTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);
        client.passwordChangeOtp = undefined;
        client.passwordChangeOtpExpiry = undefined;
        await client.save({ validateBeforeSave: false });

        return res.json({ message: 'OTP verified.', verifiedToken: rawToken });
    } catch (err) {
        console.error('verifyClientPasswordChangeOtp:', err);
        return res.status(500).json({ message: 'Verification failed. Please try again.' });
    }
};

// STEP 3: Change password with verified token
exports.changeClientPasswordWithOtp = async (req, res) => {
    try {
        const { verifiedToken, newPassword } = req.body;
        if (!verifiedToken?.trim()) return res.status(400).json({ message: 'Verification session missing.' });
        if (!validateStrongPassword(newPassword || '').isValid) {
            return res.status(400).json({ message: PASSWORD_POLICY_TEXT });
        }

        const client = await User.findById(req.user.id)
            .select('+password +passwordChangeVerifiedToken +passwordChangeVerifiedTokenExpiry role');

        if (!client || client.role !== 'client') {
            return res.status(404).json({ message: 'Client not found.' });
        }

        if (!client.passwordChangeVerifiedToken || Date.now() > new Date(client.passwordChangeVerifiedTokenExpiry).getTime()) {
            return res.status(400).json({ message: 'Session expired. Please verify OTP again.' });
        }

        const hashedToken = crypto.createHash('sha256').update(verifiedToken.trim()).digest('hex');
        if (hashedToken !== client.passwordChangeVerifiedToken) {
            return res.status(400).json({ message: 'Invalid session. Please start over.' });
        }

        client.password = newPassword;
        client.passwordChangeOtp = undefined;
        client.passwordChangeOtpExpiry = undefined;
        client.passwordChangeVerifiedToken = undefined;
        client.passwordChangeVerifiedTokenExpiry = undefined;
        await client.save();

        await logAuditEvent({
            userId: client._id,
            role: 'client',
            action: 'password_change_via_otp',
            req,
            metadata: { method: 'otp_verified' },
        });

        return res.json({ message: 'Password changed successfully. Please log in again.' });
    } catch (err) {
        console.error('changeClientPasswordWithOtp:', err);
        return res.status(500).json({ message: 'Failed to change password.' });
    }
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