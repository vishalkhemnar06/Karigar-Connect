const axios = require('axios');
const Job = require('../models/jobModel');
const User = require('../models/userModel');
const Rating = require('../models/ratingModel');

const SEMANTIC_SERVICE_URL = process.env.SEMANTIC_SERVICE_URL || 'http://127.0.0.1:5100';

const normalizeSkill = (value = '') => String(value || '').toLowerCase().trim();

const pickWorkerSkills = (skills = []) =>
    skills
        .map((s) => (typeof s === 'string' ? s : s?.name || ''))
        .map(normalizeSkill)
        .filter(Boolean);

const pickJobSkills = (job = {}) => {
    const direct = (job.skills || []).map(normalizeSkill).filter(Boolean);
    const slots = (job.workerSlots || [])
        .map((slot) => normalizeSkill(slot.skill))
        .filter(Boolean);
    return [...new Set([...direct, ...slots])];
};

const getWorkerBio = (worker = {}) => {
    const refs = (worker.references || []).map((r) => r?.name).filter(Boolean).join(', ');
    return [
        worker.overallExperience,
        worker.education,
        worker.workplaceInfo,
        refs ? `References: ${refs}` : '',
    ].filter(Boolean).join('. ');
};

const buildRatingMap = async (workerIds = []) => {
    if (!workerIds.length) return new Map();
    const ratingRows = await Rating.aggregate([
        { $match: { worker: { $in: workerIds } } },
        { $group: { _id: '$worker', avgStars: { $avg: '$stars' }, ratingCount: { $sum: 1 } } },
    ]);

    const map = new Map();
    ratingRows.forEach((row) => {
        map.set(String(row._id), {
            avgStars: Number(row.avgStars || 0),
            ratingCount: Number(row.ratingCount || 0),
        });
    });
    return map;
};

const toWorkerPayload = (workerDoc, ratingInfo = {}) => {
    if (!workerDoc) return null;

    return {
        workerId: String(workerDoc._id),
        name: workerDoc.name || '',
        roleLabel: 'worker',
        skills: pickWorkerSkills(workerDoc.skills),
        experienceYears: Number(workerDoc.experience || 0),
        overallExperience: workerDoc.overallExperience || '',
        location: {
            city: workerDoc.address?.city || '',
            lat: workerDoc.address?.latitude ?? null,
            lng: workerDoc.address?.longitude ?? null,
        },
        availability: !!workerDoc.availability,
        verificationStatus: workerDoc.verificationStatus || 'pending',
        expectedMinPay: Number(workerDoc.expectedMinPay || 0),
        expectedMaxPay: Number(workerDoc.expectedMaxPay || 0),
        bio: getWorkerBio(workerDoc),
        avgStars: Number(ratingInfo.avgStars || 0),
        ratingCount: Number(ratingInfo.ratingCount || 0),
        points: Number(workerDoc.points || 0),
        karigarId: workerDoc.karigarId || '',
        photo: workerDoc.photo || '',
        mobile: workerDoc.mobile || '',
    };
};

const toJobPayload = (jobDoc) => {
    if (!jobDoc) return null;

    return {
        jobId: String(jobDoc._id),
        title: jobDoc.title || '',
        category: jobDoc.category || '',
        description: jobDoc.detailedDescription || jobDoc.description || '',
        skills: pickJobSkills(jobDoc),
        workersRequired: Number(jobDoc.workersRequired || 1),
        location: {
            city: jobDoc.location?.city || '',
            lat: jobDoc.location?.lat ?? null,
            lng: jobDoc.location?.lng ?? null,
        },
        payment: Number(jobDoc.payment || jobDoc.totalEstimatedCost || 0),
        duration: jobDoc.duration || '',
        urgent: !!jobDoc.urgent,
        experienceRequired: jobDoc.experienceRequired || '',
        status: jobDoc.status || 'open',
        applicationsOpen: jobDoc.applicationsOpen !== false,
    };
};

const callSemanticService = async (method, path, data = undefined) => {
    const response = await axios({
        method,
        url: `${SEMANTIC_SERVICE_URL}${path}`,
        data,
        timeout: 20000,
    });
    return response.data;
};

const checkHealth = async () => callSemanticService('GET', '/health');

const rebuildAllIndexes = async () => {
    const [workers, jobs] = await Promise.all([
        User.find({ role: 'worker' })
            .select('name karigarId mobile photo points skills experience overallExperience address availability verificationStatus expectedMinPay expectedMaxPay education workplaceInfo references')
            .lean(),
        Job.find({})
            .select('title category description detailedDescription skills workerSlots workersRequired location payment totalEstimatedCost duration urgent experienceRequired status applicationsOpen')
            .lean(),
    ]);

    const ratingMap = await buildRatingMap(workers.map((w) => w._id));

    const payload = {
        workers: workers.map((w) => toWorkerPayload(w, ratingMap.get(String(w._id)) || {})).filter(Boolean),
        jobs: jobs.map((j) => toJobPayload(j)).filter(Boolean),
    };

    return callSemanticService('POST', '/index/rebuild', payload);
};

const upsertWorkerById = async (workerId) => {
    const worker = await User.findOne({ _id: workerId, role: 'worker' })
        .select('name role karigarId mobile photo points skills experience overallExperience address availability verificationStatus expectedMinPay expectedMaxPay education workplaceInfo references')
        .lean();
    if (!worker) return null;
    const ratingMap = await buildRatingMap([worker._id]);
    return callSemanticService('POST', '/index/workers/upsert', toWorkerPayload(worker, ratingMap.get(String(worker._id)) || {}));
};

const upsertJobById = async (jobId) => {
    const job = await Job.findById(jobId)
        .select('title category description detailedDescription skills workerSlots workersRequired location payment totalEstimatedCost duration urgent experienceRequired status applicationsOpen')
        .lean();
    if (!job) return null;
    return callSemanticService('POST', '/index/jobs/upsert', toJobPayload(job));
};

const removeWorkerById = async (workerId) => callSemanticService('DELETE', `/index/workers/${workerId}`);
const removeJobById = async (jobId) => callSemanticService('DELETE', `/index/jobs/${jobId}`);

const getWorkersForJob = async (jobId, { topK = 30, minScore = 0.3, includeUnavailable = false } = {}) =>
    callSemanticService('POST', `/match/job/${jobId}`, { topK, minScore, includeUnavailable });

const getJobsForWorker = async (workerId, { topK = 30, minScore = 0.3 } = {}) =>
    callSemanticService('POST', `/match/worker/${workerId}`, { topK, minScore });

const submitFeedback = async ({ workerId, jobId, event, source = 'api' }) =>
    callSemanticService('POST', '/feedback', { workerId, jobId, event, source });

module.exports = {
    checkHealth,
    rebuildAllIndexes,
    upsertWorkerById,
    upsertJobById,
    removeWorkerById,
    removeJobById,
    getWorkersForJob,
    getJobsForWorker,
    submitFeedback,
};
