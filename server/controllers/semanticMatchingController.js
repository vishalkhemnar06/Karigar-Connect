const Job = require('../models/jobModel');
const User = require('../models/userModel');
const WorkerDailyProfile = require('../models/workerDailyProfileModel');
const JobMatchFeedback = require('../models/jobMatchFeedbackModel');
const {
    checkHealth,
    rebuildAllIndexes,
    upsertWorkerById,
    upsertJobById,
    removeWorkerById,
    removeJobById,
    getWorkersForJob,
    getJobsForWorker,
    submitFeedback,
} = require('../services/semanticMatchingService');
const {
    computeWorkerJobCommute,
    getCompletedJobsCountMap,
} = require('../utils/commuteHelper');

const parseTopK = (value, fallback = 30) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(1, Math.min(100, Math.round(n)));
};

const isSemanticServiceUnavailable = (err) => {
    const code = String(err?.code || '').toUpperCase();
    const status = Number(err?.response?.status || 0);
    const msg = String(err?.message || '').toLowerCase();

    if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ETIMEDOUT') return true;
    if (status >= 500 && status <= 599) return true;
    return msg.includes('timeout') || msg.includes('network') || msg.includes('connect');
};

exports.health = async (req, res) => {
    try {
        const data = await checkHealth();
        return res.json(data);
    } catch (err) {
        return res.status(503).json({
            status: 'down',
            message: 'Semantic matching service unavailable.',
            error: err.response?.data?.detail || err.message,
        });
    }
};

exports.rebuildIndex = async (req, res) => {
    try {
        const data = await rebuildAllIndexes();
        return res.json({ message: 'Semantic index rebuilt.', ...data });
    } catch (err) {
        return res.status(500).json({
            message: 'Failed to rebuild semantic index.',
            error: err.response?.data?.detail || err.message,
        });
    }
};

exports.syncWorker = async (req, res) => {
    try {
        const { workerId } = req.params;
        const data = await upsertWorkerById(workerId);
        if (!data) return res.status(404).json({ message: 'Worker not found.' });
        return res.json({ message: 'Worker indexed.', ...data });
    } catch (err) {
        return res.status(500).json({
            message: 'Failed to sync worker.',
            error: err.response?.data?.detail || err.message,
        });
    }
};

exports.syncJob = async (req, res) => {
    try {
        const { jobId } = req.params;
        const data = await upsertJobById(jobId);
        if (!data) return res.status(404).json({ message: 'Job not found.' });
        return res.json({ message: 'Job indexed.', ...data });
    } catch (err) {
        return res.status(500).json({
            message: 'Failed to sync job.',
            error: err.response?.data?.detail || err.message,
        });
    }
};

exports.deleteIndexedWorker = async (req, res) => {
    try {
        const data = await removeWorkerById(req.params.workerId);
        return res.json({ message: 'Worker removed from semantic index.', ...data });
    } catch (err) {
        return res.status(500).json({
            message: 'Failed to remove worker from semantic index.',
            error: err.response?.data?.detail || err.message,
        });
    }
};

exports.deleteIndexedJob = async (req, res) => {
    try {
        const data = await removeJobById(req.params.jobId);
        return res.json({ message: 'Job removed from semantic index.', ...data });
    } catch (err) {
        return res.status(500).json({
            message: 'Failed to remove job from semantic index.',
            error: err.response?.data?.detail || err.message,
        });
    }
};

exports.getWorkersForJob = async (req, res) => {
    try {
        const job = await Job.findOne({ _id: req.params.jobId, postedBy: req.user.id }).select('_id location scheduledDate scheduledTime');
        if (!job && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized for this job.' });
        }

        const topK = parseTopK(req.query.topK, 30);
        const minScore = Number(req.query.minScore ?? 0.3);
        const includeUnavailable = req.query.includeUnavailable === 'true';

        const result = await getWorkersForJob(req.params.jobId, { topK, minScore, includeUnavailable });

        const matches = Array.isArray(result?.matches) ? result.matches : [];
        const workerIds = [...new Set(matches.map((row) => String(row.workerId || '')).filter(Boolean))];

        const workers = await User.find({ _id: { $in: workerIds }, role: 'worker' })
            .select('_id name photo karigarId mobile points avgStars overallExperience address travelMethod')
            .lean();
        const workerMap = new Map(workers.map((w) => [String(w._id), w]));

        const dailyProfiles = await WorkerDailyProfile.find({ workerId: { $in: workers.map((w) => w._id) } })
            .select('workerId liveLocation travelMethod')
            .lean();
        const dailyProfileMap = new Map(dailyProfiles.map((row) => [String(row.workerId), row]));

        const completedJobsMap = await getCompletedJobsCountMap(Job, workers.map((w) => w._id));

        const enrichedMatches = await Promise.all(matches.map(async (match) => {
            const workerId = String(match.workerId || '');
            const worker = workerMap.get(workerId) || match.worker || {};
            const commute = await computeWorkerJobCommute({
                worker,
                dailyProfile: dailyProfileMap.get(workerId) || null,
                job,
            });

            const semanticScore = Number(match?.semanticScore ?? match?.score ?? 0);
            const distanceScore = commute?.available
                ? Math.max(0, Math.min(1, (25 - Number(commute.distanceKm || 25)) / 25))
                : 0.2;
            const ratingScore = Math.max(0, Math.min(1, Number(worker?.avgStars || match?.worker?.avgStars || 0) / 5));
            const completedJobs = Number(completedJobsMap.get(workerId) || 0);
            const completionScore = Math.max(0, Math.min(1, completedJobs / 40));
            const pointsScore = Math.max(0, Math.min(1, Number(worker?.points || match?.worker?.points || 0) / 1500));
            const skillScore = Math.max(0, Math.min(1, Number((match?.matchedSkills || []).length) / 5));

            const rankScore = Number((
                semanticScore * 0.5 +
                distanceScore * 0.22 +
                ratingScore * 0.12 +
                completionScore * 0.08 +
                pointsScore * 0.05 +
                skillScore * 0.03
            ).toFixed(4));

            return {
                ...match,
                workerId,
                worker: {
                    ...match.worker,
                    _id: workerId,
                    name: worker?.name || match?.worker?.name || '',
                    photo: worker?.photo || match?.worker?.photo || '',
                    karigarId: worker?.karigarId || match?.worker?.karigarId || '',
                    mobile: worker?.mobile || match?.worker?.mobile || '',
                    points: Number(worker?.points || match?.worker?.points || 0),
                    avgStars: Number(worker?.avgStars || match?.worker?.avgStars || 0),
                    overallExperience: worker?.overallExperience || match?.worker?.overallExperience || '',
                },
                completedJobs,
                commute,
                rankScore,
                rankScorePercent: Math.round(rankScore * 100),
            };
        }));

        enrichedMatches.sort((a, b) => Number(b.rankScore || 0) - Number(a.rankScore || 0));

        return res.json({
            jobId: req.params.jobId,
            topK,
            minScore,
            ...result,
            matches: enrichedMatches,
        });
    } catch (err) {
        return res.status(500).json({
            message: 'Failed to get semantic worker matches.',
            error: err.response?.data?.detail || err.message,
        });
    }
};

exports.getJobsForWorker = async (req, res) => {
    try {
        const workerId = req.params.workerId || req.user.id;
        if (req.user.role === 'worker' && String(workerId) !== String(req.user.id)) {
            return res.status(403).json({ message: 'Not authorized for another worker profile.' });
        }

        const topK = parseTopK(req.query.topK, 30);
        const minScore = Number(req.query.minScore ?? 0.3);

        const result = await getJobsForWorker(workerId, { topK, minScore });
        return res.json({
            workerId,
            topK,
            minScore,
            ...result,
        });
    } catch (err) {
        if (isSemanticServiceUnavailable(err)) {
            return res.status(200).json({
                workerId: req.params.workerId || req.user.id,
                topK: parseTopK(req.query.topK, 30),
                minScore: Number(req.query.minScore ?? 0.3),
                matches: [],
                fallback: true,
                message: 'Semantic service is temporarily unavailable. Returning empty matches.',
            });
        }

        return res.status(500).json({
            message: 'Failed to get semantic job matches.',
            error: err.response?.data?.detail || err.message,
        });
    }
};

exports.recordFeedback = async (req, res) => {
    try {
        const { jobId, workerId, event, source, metadata } = req.body;
        if (!jobId || !workerId || !event) {
            return res.status(400).json({ message: 'jobId, workerId and event are required.' });
        }

        const saved = await JobMatchFeedback.create({
            jobId,
            workerId,
            event,
            source: source || 'api',
            actorRole: req.user?.role || 'system',
            actorId: req.user?._id || null,
            metadata: metadata || {},
        });

        const remote = await submitFeedback({
            jobId: String(jobId),
            workerId: String(workerId),
            event,
            source: source || req.user?.role || 'api',
        });

        return res.status(201).json({
            message: 'Feedback recorded.',
            feedbackId: saved._id,
            semanticFeedback: remote,
        });
    } catch (err) {
        return res.status(500).json({
            message: 'Failed to record semantic feedback.',
            error: err.response?.data?.detail || err.message,
        });
    }
};
