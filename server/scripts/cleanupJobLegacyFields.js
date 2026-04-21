/*
 * Cleanup legacy and unwanted fields from existing Job documents.
 *
 * Usage:
 *   node scripts/cleanupJobLegacyFields.js --dry-run
 *   node scripts/cleanupJobLegacyFields.js --apply
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Job = require('../models/jobModel');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/karigarconnect';
const isApplyMode = process.argv.includes('--apply');

const normalizeText = (value) => String(value || '').trim();

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

const normalizeQaAnswers = (qaAnswers) => {
    if (!Array.isArray(qaAnswers)) return [];
    return qaAnswers
        .map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            const question = normalizeText(entry.question);
            const answer = normalizeQaAnswerValue(entry.answer);
            if (!question && !answer) return null;
            return { question, answer };
        })
        .filter(Boolean);
};

const normalizeSkills = (skills) => {
    if (!Array.isArray(skills)) return [];
    return Array.from(new Set(
        skills
            .map((skill) => String(skill || '').trim().toLowerCase())
            .filter(Boolean),
    ));
};

const normalizeLocation = (location) => {
    const src = location && typeof location === 'object' ? location : {};
    const latNum = Number(src.lat);
    const lngNum = Number(src.lng);
    return {
        city: normalizeText(src.city),
        locality: normalizeText(src.locality),
        state: normalizeText(src.state),
        pincode: normalizeText(src.pincode),
        fullAddress: normalizeText(src.fullAddress),
        lat: Number.isFinite(latNum) ? latNum : null,
        lng: Number.isFinite(lngNum) ? lngNum : null,
    };
};

const COMPLEXITY_MAP = {
    low: 'light',
    light: 'light',
    medium: 'normal',
    normal: 'normal',
    heavy: 'heavy',
};

const normalizeBudgetBreakdown = (budgetBreakdown) => {
    if (!budgetBreakdown || typeof budgetBreakdown !== 'object') return undefined;
    const rows = Array.isArray(budgetBreakdown.breakdown) ? budgetBreakdown.breakdown : [];
    return {
        city: normalizeText(budgetBreakdown.city),
        breakdown: rows.map((row) => ({
            skill: normalizeText(row?.skill),
            count: Math.max(1, Number(row?.count) || 1),
            hours: Math.max(1, Number(row?.hours) || 8),
            baseRate: Math.max(0, Number(row?.baseRate) || 0),
            complexity: COMPLEXITY_MAP[String(row?.complexity || '').toLowerCase()] || 'normal',
            complexityMult: Math.max(0, Number(row?.complexityMult) || 1.2),
            durationFactor: Math.max(0, Number(row?.durationFactor) || 1.0),
            subtotal: Math.max(0, Number(row?.subtotal) || 0),
            description: normalizeText(row?.description),
        })),
        subtotal: Math.max(0, Number(budgetBreakdown.subtotal) || 0),
        urgent: budgetBreakdown.urgent === true || budgetBreakdown.urgent === 'true',
        urgencyMult: Math.max(0, Number(budgetBreakdown.urgencyMult) || 1.0),
        totalEstimated: Math.max(0, Number(budgetBreakdown.totalEstimated) || 0),
        totalWorkers: Math.max(1, Number(budgetBreakdown.totalWorkers) || 1),
    };
};

const buildUnsetMap = (hasBreakdownArray) => {
    const unsetMap = {
        durationDays: 1,
        durationHours: 1,
        skillWorkerCounts: 1,
        skillDurationHours: 1,
        skillDurationDays: 1,
        skillRateOverrides: 1,
        skillRateModes: 1,
        'location.house': 1,
        'location.street': 1,
        'location.country': 1,
    };

    if (hasBreakdownArray) {
        unsetMap['budgetBreakdown.durationDays'] = 1;
        unsetMap['budgetBreakdown.totalHours'] = 1;
        unsetMap['budgetBreakdown.multiplierImpactTotal'] = 1;
        unsetMap['budgetBreakdown.breakdown.$[].ratePerHour'] = 1;
        unsetMap['budgetBreakdown.breakdown.$[].ratePerDay'] = 1;
        unsetMap['budgetBreakdown.breakdown.$[].ratePerVisit'] = 1;
        unsetMap['budgetBreakdown.breakdown.$[].rateInputMode'] = 1;
        unsetMap['budgetBreakdown.breakdown.$[].priceSource'] = 1;
        unsetMap['budgetBreakdown.breakdown.$[].sourceRatePerHourBase'] = 1;
        unsetMap['budgetBreakdown.breakdown.$[].sourceRatePerDayBase'] = 1;
        unsetMap['budgetBreakdown.breakdown.$[].sourceRatePerVisitBase'] = 1;
        unsetMap['budgetBreakdown.breakdown.$[].ratePerHourBase'] = 1;
        unsetMap['budgetBreakdown.breakdown.$[].ratePerDayBase'] = 1;
        unsetMap['budgetBreakdown.breakdown.$[].perWorkerCost'] = 1;
        unsetMap['budgetBreakdown.breakdown.$[].perWorkerCostBase'] = 1;
        unsetMap['budgetBreakdown.breakdown.$[].appliedDemandMultiplier'] = 1;
        unsetMap['budgetBreakdown.breakdown.$[].multiplierImpact'] = 1;
        unsetMap['budgetBreakdown.breakdown.$[].negotiationRange'] = 1;
        unsetMap['budgetBreakdown.breakdown.$[].subtotalBase'] = 1;
    }

    return unsetMap;
};

async function run() {
    let reviewed = 0;
    let changed = 0;
    const bulkOps = [];

    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        const cursor = Job.find({}, {
            _id: 1,
            skills: 1,
            qaAnswers: 1,
            location: 1,
            budgetBreakdown: 1,
        }).lean().cursor();

        for await (const job of cursor) {
            reviewed += 1;

            const normalizedSkills = normalizeSkills(job.skills);
            const normalizedQaAnswers = normalizeQaAnswers(job.qaAnswers);
            const normalizedLocation = normalizeLocation(job.location);
            const normalizedBudget = normalizeBudgetBreakdown(job.budgetBreakdown);
            const hasBreakdownArray = Array.isArray(job?.budgetBreakdown?.breakdown);

            const updateDoc = {
                $set: {
                    skills: normalizedSkills,
                    qaAnswers: normalizedQaAnswers,
                    location: normalizedLocation,
                },
                $unset: buildUnsetMap(hasBreakdownArray),
            };

            if (normalizedBudget) {
                updateDoc.$set.budgetBreakdown = normalizedBudget;
            }

            changed += 1;
            if (isApplyMode) {
                bulkOps.push({ updateOne: { filter: { _id: job._id }, update: updateDoc } });
                if (bulkOps.length >= 200) {
                    await Job.bulkWrite(bulkOps, { ordered: false });
                    bulkOps.length = 0;
                }
            }
        }

        if (isApplyMode && bulkOps.length) {
            await Job.bulkWrite(bulkOps, { ordered: false });
        }

        console.log(`Reviewed jobs: ${reviewed}`);
        if (isApplyMode) {
            console.log(`Updated jobs: ${changed}`);
            console.log('Cleanup applied successfully.');
        } else {
            console.log(`Dry run complete. ${changed} jobs would be normalized.`);
            console.log('Run with --apply to persist changes.');
        }
    } catch (error) {
        console.error('Cleanup failed:', error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.connection.close();
    }
}

run();
