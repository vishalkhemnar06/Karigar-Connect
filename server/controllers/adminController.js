// server/controllers/adminController.js

const path = require('path');
const { parse } = require('csv-parse/sync');
const User = require('../models/userModel');
const Job  = require('../models/jobModel');
const Rating = require('../models/ratingModel');
const BaseRate = require('../models/baseRateModel');
const MarketRate = require('../models/marketRateModel');
const RateUpdateLog = require('../models/rateUpdateLogModel');
const IvrSession = require('../models/ivrSessionModel');
const Shop = require('../models/shopModel');
const Coupon = require('../models/couponModel');
const { sendStatusUpdateSms } = require('../utils/smsHelper');
const { upsertWorkerById, removeWorkerById } = require('../services/semanticMatchingService');
const { cloudinary, deleteCloudinaryFolder } = require('../utils/cloudinary');
const { runWeeklyUpdate } = require('../cron/updateRates');

const SENSITIVE_FIELDS = '-password -resetPasswordToken -resetPasswordExpire';

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

const isCloudinaryPublicId = (value) => {
    if (!value || typeof value !== 'string') return false;
    const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized) return false;
    return normalized.startsWith('karigarconnect/') || normalized.includes('/karigarconnect/');
};

const resolveCloudinaryPublicId = async (value) => {
    if (!value || typeof value !== 'string') return value;
    const normalized = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').split(/[?#]/)[0];
    if (!normalized) return value;

    const resourceTypes = ['raw', 'image'];
    for (const resourceType of resourceTypes) {
        try {
            const asset = await cloudinary.api.resource(normalized, {
                resource_type: resourceType,
                type: 'upload',
            });
            if (asset?.secure_url) return asset.secure_url;
        } catch {
            // continue
        }
    }

    // Fallback: generate signed URL from public id directly (if asset doesn't exist or no API access)
    try {
        return cloudinary.url(normalized, {
            resource_type: 'raw',
            sign_url: true,
            secure: true,
        });
    } catch {
        return value;
    }
};

const resolveLegacyDocumentToCloudinary = async (value) => {
    if (!value || typeof value !== 'string') return value;

    // Already a Cloudinary URL: keep as-is
    if (/https?:\/\//.test(value) && value.includes('res.cloudinary.com')) {
        return value;
    }

    // Accept direct Cloudinary public IDs (path format)
    if (isCloudinaryPublicId(value)) {
        return await resolveCloudinaryPublicId(value);
    }

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

const toSafeNumber = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
};

const averagePositive = (...values) => {
    const numbers = values.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0);
    if (!numbers.length) return 0;
    return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
};

const formatAgeDays = (createdAt) => {
    if (!createdAt) return 0;
    const created = new Date(createdAt);
    if (Number.isNaN(created.getTime())) return 0;
    const diffMs = Date.now() - created.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const toTitleCase = (value) => String(value || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parsePositiveInt = (value, fallback, max = Number.MAX_SAFE_INTEGER) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.min(parsed, max);
};

const calcLeaderboardDiscount = (points, completedJobs) => {
    const score = toSafeNumber(points) + (toSafeNumber(completedJobs) * 5);
    if (score >= 200) return 20;
    if (score >= 100) return 15;
    if (score >= 50) return 10;
    if (score >= 25) return 5;
    return 0;
};

const buildQuoteRateSnapshot = (quote = {}) => {
    const amount = toSafeNumber(quote.quoteRate || quote.quotedPrice || quote.rate || quote.amount);
    const basis = normalizeText(quote.quoteBasis || quote.basis || '');

    if (!amount) {
        return { hour: 0, day: 0, visit: 0 };
    }

    if (basis.includes('hour')) {
        return {
            hour: amount,
            day: amount * 8,
            visit: amount * 8,
        };
    }

    if (basis.includes('visit')) {
        return {
            hour: amount / 8,
            day: amount,
            visit: amount,
        };
    }

    return {
        hour: amount / 8,
        day: amount,
        visit: amount,
    };
};

const buildRateDisplay = (rate = {}) => {
    const hourly = averagePositive(
        rate.platformHourlyMin,
        rate.platformHourlyMax,
        rate.localHourlyMin,
        rate.localHourlyMax,
        rate.platformCostMin ? rate.platformCostMin / 8 : 0,
        rate.platformCostMax ? rate.platformCostMax / 8 : 0,
        rate.localDayMin ? rate.localDayMin / 8 : 0,
        rate.localDayMax ? rate.localDayMax / 8 : 0,
    );

    const daily = averagePositive(
        rate.platformDayMin,
        rate.platformDayMax,
        rate.localDayMin,
        rate.localDayMax,
        hourly ? hourly * 8 : 0,
    );

    const visit = averagePositive(
        rate.platformCostMin,
        rate.platformCostMax,
        daily,
    );

    return {
        hour: Math.round(hourly || 0),
        day: Math.round(daily || hourly * 8 || 0),
        visit: Math.round(visit || daily || hourly * 8 || 0),
    };
};

const buildWorkerDirectorySummary = async (workers) => {
    const workerIds = workers.map((worker) => worker._id);
    const workerIdSet = new Set(workerIds.map((workerId) => String(workerId)));

    const [ratingRows, jobRows, applicationRows, couponRows, quoteRows] = await Promise.all([
        Rating.aggregate([
            { $match: { worker: { $in: workerIds } } },
            {
                $group: {
                    _id: '$worker',
                    avgStars: { $avg: '$stars' },
                    ratingCount: { $sum: 1 },
                    totalPoints: { $sum: '$points' },
                },
            },
        ]),
        Job.aggregate([
            { $unwind: '$workerSlots' },
            { $match: { 'workerSlots.assignedWorker': { $in: workerIds }, 'workerSlots.status': 'task_completed' } },
            {
                $group: {
                    _id: {
                        workerId: '$workerSlots.assignedWorker',
                        jobId: '$_id',
                    },
                    earning: { $sum: { $ifNull: ['$workerSlots.finalPaidPrice', 0] } },
                },
            },
            {
                $group: {
                    _id: '$_id.workerId',
                    jobsDone: { $sum: 1 },
                    totalEarnings: { $sum: '$earning' },
                },
            },
        ]),
        Job.aggregate([
            { $unwind: '$applicants' },
            { $match: { 'applicants.workerId': { $in: workerIds } } },
            {
                $group: {
                    _id: '$applicants.workerId',
                    jobsApplied: { $sum: 1 },
                    latestAppliedAt: { $max: '$applicants.appliedAt' },
                },
            },
        ]),
        Coupon.aggregate([
            { $match: { worker: { $in: workerIds } } },
            {
                $group: {
                    _id: '$worker',
                    couponsUsed: { $sum: { $cond: ['$isUsed', 1, 0] } },
                    couponsGenerated: { $sum: 1 },
                },
            },
        ]),
        Job.aggregate([
            { $unwind: '$applicants' },
            { $match: { 'applicants.workerId': { $in: workerIds }, 'applicants.quoteRate': { $gt: 0 } } },
            { $sort: { 'applicants.quotedAt': -1, updatedAt: -1, createdAt: -1 } },
            {
                $group: {
                    _id: {
                        workerId: '$applicants.workerId',
                        skillKey: { $toLower: { $ifNull: ['$applicants.skill', 'general'] } },
                    },
                    quoteRate: { $first: '$applicants.quoteRate' },
                    quoteBasis: { $first: '$applicants.quoteBasis' },
                    quotedPrice: { $first: '$applicants.quotedPrice' },
                    quotedAt: { $first: '$applicants.quotedAt' },
                },
            },
        ]),
    ]);

    const ratingMap = new Map(ratingRows.map((row) => [String(row._id), row]));
    const jobMap = new Map(jobRows.map((row) => [String(row._id), row]));
    const applicationMap = new Map(applicationRows.map((row) => [String(row._id), row]));
    const couponMap = new Map(couponRows.map((row) => [String(row._id), row]));

    const quoteMap = new Map();
    for (const row of quoteRows) {
        const workerId = String(row?._id?.workerId || '');
        const skillKey = String(row?._id?.skillKey || 'general');
        if (!workerIdSet.has(workerId)) continue;
        if (!quoteMap.has(workerId)) quoteMap.set(workerId, new Map());
        quoteMap.get(workerId).set(skillKey, row);
    }

    const rankedWorkers = [...workers].sort((left, right) => toSafeNumber(right.points) - toSafeNumber(left.points));
    const rankMap = new Map(rankedWorkers.map((worker, index) => [String(worker._id), index + 1]));

    return workers.map((worker) => {
        const workerId = String(worker._id);
        const rating = ratingMap.get(workerId) || {};
        const jobs = jobMap.get(workerId) || {};
        const applications = applicationMap.get(workerId) || {};
        const coupons = couponMap.get(workerId) || {};
        const workerQuotes = quoteMap.get(workerId) || new Map();

        const skills = Array.isArray(worker.skills)
            ? worker.skills.map((skill) => {
                const skillName = String(skill?.name || '').trim();
                const skillKey = normalizeText(skillName);
                const quote = workerQuotes.get(skillKey);
                const quoteRates = buildQuoteRateSnapshot(quote);

                return {
                    name: skillName,
                    proficiency: skill?.proficiency || 'N/A',
                    quoteRates,
                    quoteBasis: quote?.quoteBasis || '',
                    quotedAt: quote?.quotedAt || null,
                    quotedPrice: toSafeNumber(quote?.quotedPrice || quote?.quoteRate),
                };
            })
            : [];

        const address = worker.address || {};

        return {
            ...worker,
            address,
            jobsDone: toSafeNumber(jobs.jobsDone),
            totalEarnings: toSafeNumber(jobs.totalEarnings),
            jobsApplied: toSafeNumber(applications.jobsApplied),
            avgStars: rating.avgStars ? Number(rating.avgStars.toFixed(1)) : 0,
            ratingCount: toSafeNumber(rating.ratingCount),
            couponsUsed: toSafeNumber(coupons.couponsUsed),
            couponsGenerated: toSafeNumber(coupons.couponsGenerated),
            leaderboardRank: rankMap.get(workerId) || 0,
            skills,
        };
    });
};

const buildClientDirectorySummary = async (clients) => {
    const clientIds = clients.map((client) => client._id);

    const jobRows = await Job.aggregate([
        { $match: { postedBy: { $in: clientIds } } },
        {
            $group: {
                _id: '$postedBy',
                jobsPosted: { $sum: 1 },
                jobsCompleted: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                paymentPaid: { $sum: { $cond: [{ $eq: ['$directHire.paymentStatus', 'paid'] }, 1, 0] } },
            },
        },
    ]);

    const jobMap = new Map(jobRows.map((row) => [String(row._id), row]));

    return clients.map((client) => {
        const stats = jobMap.get(String(client._id)) || {};
        const address = client.address || {};

        return {
            ...client,
            address,
            jobsPosted: toSafeNumber(stats.jobsPosted),
            jobsCompleted: toSafeNumber(stats.jobsCompleted),
            paymentPaid: toSafeNumber(stats.paymentPaid),
            accountAgeDays: formatAgeDays(client.createdAt),
        };
    });
};

const buildMarketplaceRateSummary = (rate) => {
    const rateDisplay = buildRateDisplay(rate);
    return {
        _id: rate._id,
        city: rate.city,
        cityKey: rate.cityKey,
        skill: rate.skill,
        skillKey: rate.skillKey,
        hourRate: rateDisplay.hour,
        dayRate: rateDisplay.day,
        visitRate: rateDisplay.visit,
        rateMode: rate.rateMode,
        unit: rate.unit,
        source: rate.source,
        confidence: rate.confidence,
        effectiveFrom: rate.effectiveFrom,
        updatedAt: rate.updatedAt,
    };
};

const buildMarketRateSummary = (rate) => ({
    _id: rate._id,
    city: toTitleCase(rate.cityKey || rate.city),
    cityKey: rate.cityKey,
    skill: toTitleCase(rate.skillKey || rate.skill),
    skillKey: rate.skillKey,
    p50: toSafeNumber(rate.p50),
    p75: toSafeNumber(rate.p75),
    p90: toSafeNumber(rate.p90),
    avgHours: toSafeNumber(rate.avgHours),
    dataPoints: toSafeNumber(rate.dataPoints),
    confidence: Number.isFinite(Number(rate.confidence)) ? Number(rate.confidence) : 0,
    lastUpdated: rate.lastUpdated,
    calculatedAt: rate.calculatedAt,
    source: 'market_rate',
});

exports.getAllWorkers = async (req, res) => {
    try {
        const workers = await User.find({ role: 'worker' })
            .select(SENSITIVE_FIELDS)
            .populate('reviewLock.lockedBy', 'name mobile karigarId')
            .sort({ createdAt: -1 })
            .lean({ virtuals: true });
        const enriched = await buildWorkerDirectorySummary(workers);
        return res.json(enriched);
    } catch (err) {
        console.error('getAllWorkers error:', err);
        return res.status(500).json({ message: 'Server error fetching workers.' });
    }
};

exports.getAllClients = async (req, res) => {
    try {
        const clients = await User.find({ role: 'client' })
            .select(SENSITIVE_FIELDS)
            .sort({ createdAt: -1 })
            .lean({ virtuals: true });
        const enriched = await buildClientDirectorySummary(clients);
        return res.json(enriched);
    } catch (err) {
        console.error('getAllClients error:', err);
        return res.status(500).json({ message: 'Server error fetching clients.' });
    }
};

exports.getMarketplaceRates = async (req, res) => {
    try {
        const mode = normalizeText(req.query.mode || req.query.view || req.query.source || 'base');
        const isMarketMode = mode === 'market' || mode === 'live' || mode === 'market-rate';
        const page = parsePositiveInt(req.query.page, 1);
        const limit = parsePositiveInt(req.query.limit, 100, 200);
        const search = normalizeText(req.query.search || '');
        const sortFieldRaw = normalizeText(req.query.sortField || '');
        const sortDirection = normalizeText(req.query.sortDirection || 'desc') === 'asc' ? 1 : -1;

        const [rates, lastBaseRateUpdate, lastMarketRateUpdate] = await Promise.all([
            isMarketMode
                ? MarketRate.find({ isActive: true, dataPoints: { $gt: 0 } })
                    .sort({ cityKey: 1, skillKey: 1, lastUpdated: -1, updatedAt: -1 })
                    .lean()
                : BaseRate.find({ isActive: true })
                    .sort({ city: 1, skill: 1, effectiveFrom: -1, updatedAt: -1 })
                    .lean(),
            RateUpdateLog.findOne({ updateType: 'base_rate_csv', status: 'success' }).sort({ triggeredAt: -1 }).lean(),
            RateUpdateLog.findOne({ updateType: 'market_rate', status: 'success' }).sort({ triggeredAt: -1 }).lean(),
        ]);

        const buildCooldown = (lastUpdate, cooldownDays) => {
            if (!lastUpdate?.triggeredAt) {
                return {
                    lastUpdatedAt: null,
                    nextAllowedAt: null,
                    remainingMs: 0,
                    cooldownDays,
                };
            }

            const lastUpdatedAt = new Date(lastUpdate.triggeredAt);
            const nextAllowedAt = new Date(lastUpdatedAt.getTime() + cooldownDays * 24 * 60 * 60 * 1000);
            return {
                lastUpdatedAt: lastUpdatedAt.toISOString(),
                nextAllowedAt: nextAllowedAt.toISOString(),
                remainingMs: Math.max(0, nextAllowedAt.getTime() - Date.now()),
                cooldownDays,
            };
        };

        const latestMap = new Map();
        for (const rate of rates) {
            const key = `${normalizeText(rate.cityKey || rate.city)}::${normalizeText(rate.skillKey || rate.skill)}`;
            if (!latestMap.has(key)) {
                latestMap.set(key, isMarketMode ? buildMarketRateSummary(rate) : buildMarketplaceRateSummary(rate));
            }
        }

        const allowedMarketSorts = new Set(['city', 'skill', 'p50', 'p75', 'p90', 'datapoints', 'confidence', 'lastupdated']);
        const allowedBaseSorts = new Set(['city', 'skill', 'hourrate', 'dayrate', 'visitrate']);
        const defaultSortField = isMarketMode ? 'p50' : 'hourRate';
        const normalizedSortField = isMarketMode
            ? (allowedMarketSorts.has(sortFieldRaw) ? sortFieldRaw : normalizeText(defaultSortField))
            : (allowedBaseSorts.has(sortFieldRaw) ? sortFieldRaw : normalizeText(defaultSortField));

        let rows = [...latestMap.values()];

        if (search) {
            rows = rows.filter((row) => [
                row?.city,
                row?.cityKey,
                row?.skill,
                row?.skillKey,
                row?.source,
            ].some((value) => normalizeText(value).includes(search)));
        }

        rows.sort((left, right) => {
            if (normalizedSortField === 'lastupdated') {
                const leftValue = new Date(left?.lastUpdated || 0).getTime();
                const rightValue = new Date(right?.lastUpdated || 0).getTime();
                if (leftValue === rightValue) {
                    return (String(left?.city || '').localeCompare(String(right?.city || '')) * sortDirection)
                        || (String(left?.skill || '').localeCompare(String(right?.skill || '')) * sortDirection);
                }
                return (leftValue - rightValue) * sortDirection;
            }

            const sourceFieldMap = {
                datapoints: 'dataPoints',
                hourrate: 'hourRate',
                dayrate: 'dayRate',
                visitrate: 'visitRate',
            };
            const sortField = sourceFieldMap[normalizedSortField] || normalizedSortField;

            const leftValue = Number(left?.[sortField]);
            const rightValue = Number(right?.[sortField]);
            const bothNumeric = Number.isFinite(leftValue) && Number.isFinite(rightValue);

            if (bothNumeric) {
                if (leftValue === rightValue) {
                    return (String(left?.city || '').localeCompare(String(right?.city || '')) * sortDirection)
                        || (String(left?.skill || '').localeCompare(String(right?.skill || '')) * sortDirection);
                }
                return (leftValue - rightValue) * sortDirection;
            }

            return String(left?.[sortField] || '').localeCompare(String(right?.[sortField] || '')) * sortDirection;
        });

        const total = rows.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const safePage = Math.min(page, totalPages);
        const skip = (safePage - 1) * limit;
        const pagedRows = rows.slice(skip, skip + limit);

        return res.json({
            mode: isMarketMode ? 'market' : 'base',
            rates: pagedRows,
            total,
            page: safePage,
            limit,
            totalPages,
            cooldowns: {
                base: buildCooldown(lastBaseRateUpdate, 7),
                market: buildCooldown(lastMarketRateUpdate, 6),
            },
        });
    } catch (err) {
        console.error('getMarketplaceRates error:', err);
        return res.status(500).json({ message: 'Server error fetching marketplace rates.' });
    }
};

exports.getWorkerLeaderboard = async (req, res) => {
    try {
        const mode = normalizeText(req.query.mode || 'all');
        const city = normalizeText(req.query.city || '');
        const skill = normalizeText(req.query.skill || '');
        const search = normalizeText(req.query.search || '');
        const page = parsePositiveInt(req.query.page, 1);
        const limit = parsePositiveInt(req.query.limit, 100, 200);

        const filter = { role: 'worker' };
        if (mode === 'approved') {
            filter.verificationStatus = 'approved';
        }
        if (city) {
            filter['address.city'] = new RegExp(escapeRegExp(city), 'i');
        }
        if (skill) {
            filter['skills.name'] = new RegExp(escapeRegExp(skill), 'i');
        }
        if (search) {
            filter.$or = [
                { name: new RegExp(escapeRegExp(search), 'i') },
                { mobile: new RegExp(escapeRegExp(search), 'i') },
                { karigarId: new RegExp(escapeRegExp(search), 'i') },
                { userId: new RegExp(escapeRegExp(search), 'i') },
            ];
        }

        const workers = await User.find(filter)
            .select(SENSITIVE_FIELDS)
            .sort({ points: -1, createdAt: -1 })
            .lean({ virtuals: true });

        const enriched = await buildWorkerDirectorySummary(workers);
        const ranked = [...enriched].sort((left, right) => {
            const pointDiff = toSafeNumber(right.points) - toSafeNumber(left.points);
            if (pointDiff !== 0) return pointDiff;
            const ratingDiff = toSafeNumber(right.avgStars) - toSafeNumber(left.avgStars);
            if (ratingDiff !== 0) return ratingDiff;
            return String(left.name || '').localeCompare(String(right.name || ''));
        });

        const rows = ranked.map((worker, index) => ({
            ...worker,
            city: worker.address?.city || '',
            skillNames: Array.isArray(worker.skills) ? worker.skills.map((skillEntry) => skillEntry?.name).filter(Boolean) : [],
            completedJobs: toSafeNumber(worker.jobsDone),
            discountScore: toSafeNumber(worker.points) + (toSafeNumber(worker.jobsDone) * 5),
            discountPct: calcLeaderboardDiscount(worker.points, worker.jobsDone),
            rank: index + 1,
        }));

        const cities = [...new Set(rows.map((row) => String(row.city || '').trim()).filter(Boolean))]
            .sort((left, right) => left.localeCompare(right));
        const skills = [...new Set(rows.flatMap((row) => row.skillNames || []).map((skillName) => String(skillName || '').trim()).filter(Boolean))]
            .sort((left, right) => left.localeCompare(right));

        const total = rows.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const safePage = Math.min(page, totalPages);
        const skip = (safePage - 1) * limit;
        const pagedRows = rows.slice(skip, skip + limit);

        return res.json({
            total,
            workers: pagedRows,
            page: safePage,
            limit,
            totalPages,
            filters: {
                cities,
                skills,
                selectedCity: city || 'all',
                selectedSkill: skill || 'all',
                search,
            },
        });
    } catch (err) {
        console.error('getWorkerLeaderboard error:', err);
        return res.status(500).json({ message: 'Server error fetching worker leaderboard.' });
    }
};

exports.getUserByIdOrKarigarId = async (req, res) => {
    try {
        const idOrKarigarId = String(req.params.id || '').trim();
        let user = null;

        const isObjectId = idOrKarigarId.match(/^[0-9a-fA-F]{24}$/);

        if (isObjectId) {
            user = await User.findById(idOrKarigarId).select('-password -resetPasswordToken -resetPasswordExpire -faceEmbedding -idFaceEmbedding -securityAnswer -passwordChangeOtp -passwordChangeOtpExpiry -passwordChangeVerifiedToken -passwordChangeVerifiedTokenExpiry');
        }

        if (!user) {
            user = await User.findOne({
                $or: [
                    { userId: idOrKarigarId },
                    { karigarId: idOrKarigarId },
                ],
            }).select('-password -resetPasswordToken -resetPasswordExpire -faceEmbedding -idFaceEmbedding -securityAnswer -passwordChangeOtp -passwordChangeOtpExpiry -passwordChangeVerifiedToken -passwordChangeVerifiedTokenExpiry');
        }

        if (!user) return res.status(404).json({ message: 'User not found.' });

        const normalized = await normalizeWorkerDocumentUrls(user);
        const sanitized = sanitizeWorkerSensitiveFields(normalized);

        return res.json(sanitized);
    } catch (err) {
        console.error('getUserByIdOrKarigarId error:', err);
        return res.status(500).json({ message: 'Server error fetching user.' });
    }
};

exports.claimWorkerForReview = async (req, res) => {
    try {
        const { workerId } = req.params;
        const adminId = req.user?._id?.toString();
        if (!adminId) return res.status(401).json({ message: 'Admin session invalid.' });

        const alreadyClaimedByAdmin = await User.findOne({
            role: 'worker',
            verificationStatus: 'pending',
            'reviewLock.lockedBy': adminId,
            _id: { $ne: workerId },
        }).select('name karigarId');

        if (alreadyClaimedByAdmin) {
            return res.status(409).json({
                message: `You already claimed ${alreadyClaimedByAdmin.name} (${alreadyClaimedByAdmin.karigarId}). Verify this worker first before claiming another.`,
            });
        }

        const worker = await User.findById(workerId).select('name karigarId role verificationStatus reviewLock');
        if (!worker || worker.role !== 'worker') {
            return res.status(404).json({ message: 'Worker not found.' });
        }
        if (worker.verificationStatus !== 'pending') {
            return res.status(409).json({ message: 'Worker is already verified by another admin.' });
        }

        const lockOwner = worker.reviewLock?.lockedBy?.toString?.();
        if (lockOwner && lockOwner !== adminId) {
            const lockAdmin = await User.findById(lockOwner).select('name karigarId');
            return res.status(409).json({
                message: `This worker is already claimed by ${lockAdmin?.name || 'another admin'}.`,
            });
        }

        const updated = await User.findOneAndUpdate(
            {
                _id: workerId,
                role: 'worker',
                verificationStatus: 'pending',
                $or: [
                    { 'reviewLock.lockedBy': null },
                    { 'reviewLock.lockedBy': { $exists: false } },
                    { 'reviewLock.lockedBy': req.user._id },
                ],
            },
            {
                $set: {
                    'reviewLock.lockedBy': req.user._id,
                    'reviewLock.lockedAt': new Date(),
                },
            },
            { new: true, runValidators: false }
        ).populate('reviewLock.lockedBy', 'name mobile karigarId');

        if (!updated) {
            return res.status(409).json({ message: 'Unable to claim worker due to concurrent update.' });
        }

        return res.json({ message: 'Worker claimed successfully.', worker: updated });
    } catch (err) {
        console.error('claimWorkerForReview error:', err);
        return res.status(500).json({ message: 'Server error while claiming worker.' });
    }
};

exports.updateWorkerStatus = async (req, res) => {
    try {
        let { workerId, status, points, rejectionReason } = req.body;
        const adminId = req.user?._id;
        if (!adminId) return res.status(401).json({ message: 'Admin session invalid.' });

        console.log('[updateWorkerStatus] received:', { workerId, status, points, adminId: adminId.toString() });

        const worker = await User.findById(workerId).select('experience role verificationStatus reviewLock mobile name');
        if (!worker || worker.role !== 'worker') {
            return res.status(404).json({ message: 'Worker not found.' });
        }

        const isUnblock = (status === 'unblocked');
        const finalStatus = isUnblock ? 'approved' : status;

        const updateFields = { verificationStatus: finalStatus };

        if (finalStatus === 'approved' && !isUnblock) {
            const manualPoints = Number(points) || 0;
            if (manualPoints < 1 || manualPoints > 50) {
                return res.status(400).json({ message: 'Admin points must be between 1 and 50.' });
            }
            const experienceYears = Number(worker.experience) || 0;
            updateFields.points = manualPoints + (experienceYears * 10);
            updateFields.rejectedAt = undefined;
            updateFields.rejectionReason = null;
        }

        if (finalStatus === 'rejected') {
            updateFields.rejectedAt = new Date();
            updateFields.rejectionReason = (rejectionReason || '').trim() || 'No reason provided by admin.';
        }

        if (finalStatus === 'blocked') {
            updateFields.rejectionReason = null;
        }

        let query = { _id: workerId, role: 'worker' };

        if (['approved', 'rejected'].includes(finalStatus) && !isUnblock) {
            query = {
                ...query,
                verificationStatus: 'pending',
                'reviewLock.lockedBy': adminId,
            };
            updateFields['reviewLock.lockedBy'] = null;
            updateFields['reviewLock.lockedAt'] = null;
        } else if (finalStatus === 'blocked') {
            query = { ...query, verificationStatus: 'approved' };
        } else if (isUnblock) {
            query = { ...query, verificationStatus: 'blocked' };
            updateFields.rejectionReason = null;
        }

        const updatedWorker = await User.findOneAndUpdate(
            query,
            { $set: updateFields },
            { new: true, runValidators: false }
        )
            .select(SENSITIVE_FIELDS)
            .populate('reviewLock.lockedBy', 'name mobile karigarId');

        if (!updatedWorker) {
            return res.status(409).json({
                message: 'Worker status update conflict. Worker may already be processed or not claimed by you.',
            });
        }

        if (finalStatus === 'rejected') {
            const folderPath = `karigarconnect/worker-docs/${updatedWorker.mobile}`;
            await deleteCloudinaryFolder(folderPath);
        }

        if (!isUnblock && ['approved', 'rejected', 'blocked'].includes(finalStatus)) {
            try {
                await sendStatusUpdateSms(updatedWorker.mobile, updatedWorker.name, finalStatus);
            } catch (smsErr) {
                console.error('SMS failed (non-fatal):', smsErr.message);
            }
        }

        upsertWorkerById(updatedWorker._id).catch((err) => {
            console.error('semantic upsertWorkerById(updateWorkerStatus):', err.message);
        });

        return res.status(200).json({
            message: `Worker status updated to ${finalStatus}.`,
            worker: updatedWorker,
        });

    } catch (err) {
        console.error('[updateWorkerStatus] FULL ERROR:', err);
        return res.status(500).json({ message: err.message || 'Server error updating worker status.' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const deleted = await User.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'User not found.' });
        if (deleted.role === 'worker') {
            removeWorkerById(deleted._id).catch((err) => {
                console.error('semantic removeWorkerById(deleteUser):', err.message);
            });
        }
        return res.json({ message: 'User deleted successfully.' });
    } catch (err) {
        console.error('deleteUser error:', err);
        return res.status(500).json({ message: 'Server error deleting user.' });
    }
};

exports.getAdminStats = async (req, res) => {
    try {
        // Calculate date ranges
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Execute all queries in parallel
        const [
            workerCount,
            clientCount,
            totalJobs,
            openJobs,
            runningJobs,
            totalIvrCalls,
            dailyIvrCalls,
            weeklyIvrCalls,
            monthlyIvrCalls,
            totalShops,
            totalCoupons,
            ivrDurationStats,
            skillStats,
            workerStatusBreakdown,
            jobStatusBreakdown,
            clientCount_approval,
            dailyWorkerRegistrations,
            weeklyIVRTrend
        ] = await Promise.all([
            // Basic stats
            User.countDocuments({ role: 'worker' }),
            User.countDocuments({ role: 'client' }),
            Job.countDocuments({}),
            Job.countDocuments({ status: 'open' }),
            Job.countDocuments({ status: 'running' }),

            // IVR stats
            IvrSession.countDocuments({}),
            IvrSession.countDocuments({ createdAt: { $gte: todayStart } }),
            IvrSession.countDocuments({ createdAt: { $gte: weekStart } }),
            IvrSession.countDocuments({ createdAt: { $gte: monthStart } }),

            // Shop & Coupon stats
            Shop.countDocuments({}),
            Coupon.countDocuments({}),

            // IVR Average Duration - calculate from timestamps
            IvrSession.aggregate([
                {
                    $addFields: {
                        duration: {
                            $subtract: [
                                { $ifNull: ['$updatedAt', '$createdAt'] },
                                '$createdAt'
                            ]
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        avgDuration: { $avg: '$duration' },
                        totalDuration: { $sum: '$duration' }
                    }
                }
            ]),

            // Most popular skills
            Job.aggregate([
                { $unwind: '$skills' },
                { $group: { _id: '$skills', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]),

            // Worker status breakdown
            User.aggregate([
                {
                    $match: { role: 'worker' }
                },
                {
                    $group: {
                        _id: '$verificationStatus',
                        count: { $sum: 1 }
                    }
                }
            ]),

            // Job status breakdown
            Job.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]),

            // Approved clients
            User.countDocuments({ role: 'client', verificationStatus: 'approved' }),

            // Daily worker registrations (last 7 days)
            User.aggregate([
                {
                    $match: {
                        role: 'worker',
                        createdAt: { $gte: weekStart }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                        },
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ]),

            // Weekly IVR calls trend (last 4 weeks)
            IvrSession.aggregate([
                {
                    $match: {
                        createdAt: { $gte: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000) }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-W%V', date: '$createdAt' }
                        },
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ])
        ]);

        // Process average call duration (convert from ms to seconds)
        const avgCallDuration = ivrDurationStats[0]
            ? Math.round(ivrDurationStats[0].avgDuration / 1000)
            : 0;

        // Process top skills
        const topSkills = skillStats.map(s => ({
            skill: s._id,
            count: s.count
        }));

        // Process worker status breakdown
        const workerStatusMap = {};
        workerStatusBreakdown.forEach(item => {
            workerStatusMap[item._id || 'unknown'] = item.count;
        });

        // Process job status breakdown
        const jobStatusMap = {};
        jobStatusBreakdown.forEach(item => {
            jobStatusMap[item._id || 'unknown'] = item.count;
        });

        const response = {
            // Worker & Client stats
            workers: workerCount,
            clients: clientCount,

            // Job stats
            jobs: totalJobs,
            openJobs,
            runningJobs,

            // IVR stats
            ivrStats: {
                totalCalls: totalIvrCalls,
                dailyCalls: dailyIvrCalls,
                weeklyCalls: weeklyIvrCalls,
                monthlyCalls: monthlyIvrCalls,
                avgCallDurationSeconds: avgCallDuration
            },

            // Shop & Coupon stats
            shops: totalShops,
            couponsGenerated: totalCoupons,

            // Most popular skills
            topSkills: topSkills,

            // Worker status breakdown
            workerStatusBreakdown: {
                pending: workerStatusMap.pending || 0,
                approved: workerStatusMap.approved || 0,
                rejected: workerStatusMap.rejected || 0,
                blocked: workerStatusMap.blocked || 0
            },

            // Job status breakdown
            jobStatusBreakdown: {
                open: jobStatusMap.open || 0,
                running: jobStatusMap.running || 0,
                completed: jobStatusMap.completed || 0,
                cancelled: jobStatusMap.cancelled || 0
            },

            // Client approval stats
            clientsApproved: clientCount_approval,

            // Growth trends
            dailyWorkerRegistrations: dailyWorkerRegistrations,
            weeklyIVRTrend: weeklyIVRTrend
        };

        return res.json(response);
    } catch (err) {
        console.error('getAdminStats error:', err);
        return res.status(500).json({ message: 'Server error fetching stats.' });
    }
};

exports.getAllJobs = async (req, res) => {
    try {
        const jobs = await Job.find({})
            .populate('postedBy', 'name mobile')
            .sort({ createdAt: -1 })
            .limit(200);
        return res.json(jobs);
    } catch (err) {
        console.error('getAllJobs error:', err);
        return res.status(500).json({ message: 'Server error fetching jobs.' });
    }
};

exports.proxyDocument = async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) {
            return res.status(400).json({ message: 'URL parameter is required.' });
        }

        // Validate URL is from allowed domains (Cloudinary)
        const allowedDomains = ['res.cloudinary.com'];
        const urlObj = new URL(url);
        if (!allowedDomains.some(domain => urlObj.hostname.includes(domain))) {
            return res.status(403).json({ message: 'URL not allowed.' });
        }

        // Extract public_id from Cloudinary URL
        const pathParts = urlObj.pathname.split('/');
        const uploadIndex = pathParts.indexOf('upload');
        if (uploadIndex === -1) {
            return res.status(400).json({ message: 'Invalid Cloudinary URL format.' });
        }
        // resourceType is before /upload/, e.g. /raw/upload/ or /image/upload/
        const resourceType = pathParts[uploadIndex - 1] || 'raw';
        const publicId = pathParts.slice(uploadIndex + 1).join('/').replace(/\.[^/.]+$/, ''); // Remove extension if present

        // Generate signed URL using Cloudinary SDK
        const signedUrl = cloudinary.url(publicId, {
            resource_type: resourceType,
            sign_url: true,
            secure: true
        });

        const response = await fetch(signedUrl);
        if (!response.ok) {
            return res.status(response.status).json({ message: 'Failed to fetch document.' });
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const buffer = await response.arrayBuffer();

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour
        res.send(Buffer.from(buffer));
    } catch (err) {
        console.error('proxyDocument error:', err);
        return res.status(500).json({ message: 'Server error proxying document.' });
    }
};

exports.uploadBaseRatesCsv = async (req, res) => {
    try {
        const adminId = req.user?._id;
        if (!adminId) {
            return res.status(401).json({ message: 'Admin session invalid.' });
        }

        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({ message: 'No CSV file provided.' });
        }

        // Read and parse CSV
        const csvContent = req.file.buffer.toString('utf-8');
        let records = [];
        try {
            records = parse(csvContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
            });
        } catch (parseErr) {
            console.error('CSV parse error:', parseErr);
            return res.status(400).json({ message: `CSV parsing failed: ${parseErr.message}` });
        }

        if (!records || records.length === 0) {
            return res.status(400).json({ message: 'CSV file is empty.' });
        }

        // Check cooldown: max 1 import per week (7 days)
        const lastBaseRateUpdate = await RateUpdateLog.findOne({
            updateType: 'base_rate_csv',
            status: 'success',
        }).sort({ triggeredAt: -1 }).lean();

        if (lastBaseRateUpdate) {
            const lastUpdateTime = new Date(lastBaseRateUpdate.triggeredAt).getTime();
            const nowTime = Date.now();
            const daysSinceLastUpdate = (nowTime - lastUpdateTime) / (1000 * 60 * 60 * 24);

            if (daysSinceLastUpdate < 7) {
                const daysUntilNextAllowed = Math.ceil(7 - daysSinceLastUpdate);
                return res.status(429).json({
                    message: `Base rate CSV import is limited to once per week. Next import allowed in ${daysUntilNextAllowed} day(s).`,
                    nextAllowedAt: new Date(lastUpdateTime + 7 * 24 * 60 * 60 * 1000),
                    daysSinceLastUpdate: Math.floor(daysSinceLastUpdate),
                });
            }
        }

        // Validate and transform records
        const errors = [];
        const validRecords = [];

        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            const rowNum = i + 2; // CSV header is row 1, data starts at row 2

            // Validate required columns
            const city = String(record.city || '').trim();
            const skill = String(record.skill || '').trim();
            const hourRate = Number(record.hourRate);
            const dayRate = Number(record.dayRate);
            const visitRate = Number(record.visitRate);

            if (!city) {
                errors.push(`Row ${rowNum}: Missing or empty 'city' column.`);
                continue;
            }
            if (!skill) {
                errors.push(`Row ${rowNum}: Missing or empty 'skill' column.`);
                continue;
            }
            if (!Number.isFinite(hourRate) || hourRate <= 0) {
                errors.push(`Row ${rowNum}: 'hourRate' must be a positive number.`);
                continue;
            }
            if (!Number.isFinite(dayRate) || dayRate <= 0) {
                errors.push(`Row ${rowNum}: 'dayRate' must be a positive number.`);
                continue;
            }
            if (!Number.isFinite(visitRate) || visitRate <= 0) {
                errors.push(`Row ${rowNum}: 'visitRate' must be a positive number.`);
                continue;
            }

            validRecords.push({
                city,
                skill,
                rates: {
                    hourly: Math.round(hourRate),
                    daily: Math.round(dayRate),
                    visit: Math.round(visitRate),
                },
                source: 'csv_bootstrap',
                effectiveFrom: new Date(),
                isActive: true,
            });
        }

        if (errors.length > 0) {
            return res.status(400).json({
                message: 'CSV validation failed.',
                errors,
            });
        }

        // Create update log entry
        const updateLog = await RateUpdateLog.create({
            updateType: 'base_rate_csv',
            adminId,
            status: 'in_progress',
            triggeredAt: new Date(),
            csvFileName: req.file.originalname,
            csvRowCount: validRecords.length,
        });

        // Upsert base rates
        let upsertedCount = 0;
        const upsertErrors = [];
        for (const record of validRecords) {
            try {
                await BaseRate.findOneAndUpdate(
                    { city: record.city, skill: record.skill },
                    {
                        $set: record,
                    },
                    { upsert: true, runValidators: false }
                );
                upsertedCount++;
            } catch (upsertErr) {
                console.error(`Error upserting rate for ${record.city}/${record.skill}:`, upsertErr);
                upsertErrors.push(`Failed to upsert rate for ${record.city}/${record.skill}.`);
            }
        }

        // Update log with completion
        updateLog.status = 'success';
        updateLog.completedAt = new Date();
        updateLog.durationMs = updateLog.completedAt - updateLog.triggeredAt;
        updateLog.rowsProcessed = upsertedCount;
        updateLog.details = upsertErrors.length > 0 ? `Imported with ${upsertErrors.length} error(s)` : 'Successfully imported all records';
        await updateLog.save();

        return res.json({
            message: `Successfully imported ${upsertedCount} base rate records.`,
            recordsProcessed: validRecords.length,
            recordsUpserted: upsertedCount,
            errors: upsertErrors.length > 0 ? upsertErrors : undefined,
            nextAllowedAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
    } catch (err) {
        console.error('uploadBaseRatesCsv error:', err);
        return res.status(500).json({ message: `Server error during CSV import: ${err.message}` });
    }
};

exports.manuallyUpdateMarketRates = async (req, res) => {
    try {
        const adminId = req.user?._id;
        if (!adminId) {
            return res.status(401).json({ message: 'Admin session invalid.' });
        }

        // Check cooldown: market rate updates are limited to once per 6 days
        const lastMarketRateUpdate = await RateUpdateLog.findOne({
            updateType: 'market_rate',
            status: 'success',
        }).sort({ triggeredAt: -1 }).lean();

        if (lastMarketRateUpdate) {
            const lastUpdateTime = new Date(lastMarketRateUpdate.triggeredAt).getTime();
            const nowTime = Date.now();
            const daysSinceLastUpdate = (nowTime - lastUpdateTime) / (1000 * 60 * 60 * 24);

            if (daysSinceLastUpdate < 6) {
                const daysUntilNextAllowed = Math.ceil(6 - daysSinceLastUpdate);
                const nextAllowedAtDate = new Date(lastUpdateTime + 6 * 24 * 60 * 60 * 1000);
                return res.status(429).json({
                    message: `Market rate update is limited to once per 6 days. Next update allowed in ${daysUntilNextAllowed} day(s).`,
                    nextAllowedAt: nextAllowedAtDate,
                    daysSinceLastUpdate: Math.floor(daysSinceLastUpdate),
                    lastUpdatedAt: lastMarketRateUpdate.triggeredAt,
                });
            }
        }

        // Create update log entry (in_progress status)
        const updateLog = await RateUpdateLog.create({
            updateType: 'market_rate',
            adminId,
            triggeredAt: new Date(),
            status: 'in_progress',
            details: 'Manual market rate update triggered by admin',
        });

        // Execute the pricing update cron job
        let updateResult = null;
        try {
            updateResult = await runWeeklyUpdate({ closeConnection: false });
            console.log('[manuallyUpdateMarketRates] Update result:', updateResult);

            // Mark update log as completed
            updateLog.status = 'success';
            updateLog.completedAt = new Date();
            updateLog.durationMs = updateLog.completedAt - updateLog.triggeredAt;
            updateLog.details = `Market rates updated: ${JSON.stringify(updateResult)}`;
            await updateLog.save();

            return res.json({
                message: 'Market rates updated successfully.',
                updateId: updateLog._id,
                result: updateResult,
                nextAllowedAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
            });
        } catch (updateErr) {
            console.error('[manuallyUpdateMarketRates] Update error:', updateErr);

            // Mark update log as failed
            updateLog.status = 'failed';
            updateLog.completedAt = new Date();
            updateLog.durationMs = updateLog.completedAt - updateLog.triggeredAt;
            updateLog.error = updateErr.message;
            await updateLog.save();

            return res.status(500).json({
                message: `Market rate update failed: ${updateErr.message}`,
                updateId: updateLog._id,
                nextAllowedAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
            });
        }
    } catch (err) {
        console.error('manuallyUpdateMarketRates error:', err);
        return res.status(500).json({ message: `Server error triggering market rate update: ${err.message}` });
    }
};