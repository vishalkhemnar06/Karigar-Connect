const Job = require('../models/jobModel');
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

const parseTopK = (value, fallback = 30) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(1, Math.min(100, Math.round(n)));
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
        const job = await Job.findOne({ _id: req.params.jobId, postedBy: req.user.id }).select('_id');
        if (!job && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized for this job.' });
        }

        const topK = parseTopK(req.query.topK, 30);
        const minScore = Number(req.query.minScore ?? 0.3);
        const includeUnavailable = req.query.includeUnavailable === 'true';

        const result = await getWorkersForJob(req.params.jobId, { topK, minScore, includeUnavailable });

        return res.json({
            jobId: req.params.jobId,
            topK,
            minScore,
            ...result,
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
