const mongoose = require('mongoose');
const WorkerDailyProfile = require('../models/workerDailyProfileModel');
const MIN_SKILL_RATE = 100;

const toPositiveNumber = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0;
};

const toMinSkillRate = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? Math.max(MIN_SKILL_RATE, numberValue) : MIN_SKILL_RATE;
};

const getWorkerRegisteredSkills = (worker = null) => {
    const sourceSkills = Array.isArray(worker?.skills) ? worker.skills : [];
    const seen = new Set();
    const skillNames = [];

    sourceSkills.forEach((skill) => {
        const raw = typeof skill === 'string' ? skill : (skill?.name || skill?.skill || '');
        const name = String(raw || '').trim();
        if (!name) return;
        const key = name.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        skillNames.push(name);
    });

    return skillNames;
};

const normalizeTravelMethod = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'cycle') return 'cycle';
    if (['motorcycle', 'bike', 'two-wheeler', 'scooter'].includes(normalized)) return 'motorcycle';
    if (normalized === 'bus') return 'bus';
    if (['lift', 'shared lift', 'carpool'].includes(normalized)) return 'lift';
    return 'other';
};

const normalizePaymentMethod = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'cash') return 'cash';
    if (normalized === 'online' || normalized === 'upi' || normalized === 'upi_qr' || normalized === 'bank_transfer') return 'online';
    return 'flexible';
};

const normalizePhoneType = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'smartphone') return 'Smartphone';
    if (['traditional old button phone', 'feature phone', 'button phone', 'old button phone'].includes(normalized)) {
        return 'Traditional old button phone';
    }
    if (['no phone', 'none'].includes(normalized)) return 'No phone';
    return 'Smartphone';
};

const normalizeSkillRateRow = (row = {}) => {
    const skillName = String(row.skillName || row.name || row.skill || '').trim();
    if (!skillName) return null;

    const preferenceRank = Math.max(1, Math.min(3, Number(row.preferenceRank || row.preference || row.priority || 1) || 1));
    const hourlyPrice = toMinSkillRate(row.hourlyPrice ?? row.hourPrice ?? row.perHour ?? row.hourly ?? row.pricePerHour);
    const dailyPrice = toMinSkillRate(row.dailyPrice ?? row.dayPrice ?? row.perDay ?? row.daily ?? row.pricePerDay);
    const visitPrice = toMinSkillRate(row.visitPrice ?? row.perVisit ?? row.visit ?? row.pricePerVisit);

    return {
        skillName,
        preferenceRank,
        hourlyPrice,
        dailyPrice,
        visitPrice,
    };
};

const normalizeLiveLocation = (value = {}) => {
    const source = value && typeof value === 'object' ? value : {};
    const latitudeRaw = source.latitude ?? source.lat;
    const longitudeRaw = source.longitude ?? source.lng;
    const latitude = latitudeRaw === '' || latitudeRaw === null || latitudeRaw === undefined ? null : Number(latitudeRaw);
    const longitude = longitudeRaw === '' || longitudeRaw === null || longitudeRaw === undefined ? null : Number(longitudeRaw);

    return {
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
        updatedAt: source.updatedAt ? new Date(source.updatedAt) : (source.latitude != null || source.longitude != null ? new Date() : null),
        source: String(source.source || 'manual').trim() || 'manual',
    };
};

const normalizeWorkerDailyProfilePayload = (payload = {}, worker = null) => {
    const skillInput = Array.isArray(payload.skillRates)
        ? payload.skillRates
        : Array.isArray(payload.skills)
            ? payload.skills
            : [];

    const registeredSkillSet = new Set(getWorkerRegisteredSkills(worker).map((name) => name.toLowerCase()));

    const skillRates = skillInput
        .map((row) => normalizeSkillRateRow(row))
        .filter(Boolean)
        .filter((row) => {
            if (!registeredSkillSet.size) return false;
            return registeredSkillSet.has(String(row.skillName || '').trim().toLowerCase());
        });

    return {
        skillRates,
        liveLocation: normalizeLiveLocation(payload.liveLocation || payload.location || {}),
        travelMethod: normalizeTravelMethod(payload.travelMethod),
        paymentMethod: normalizePaymentMethod(payload.paymentMethod),
        phoneType: normalizePhoneType(payload.phoneType),
        workerId: worker?._id || payload.workerId || null,
        karigarId: String(worker?.karigarId || payload.karigarId || '').trim(),
        lastUpdatedAt: new Date(),
    };
};

const buildMissingDailyProfileFields = (doc = null) => {
    const missing = [];
    const skillRates = Array.isArray(doc?.skillRates) ? doc.skillRates : [];

    if (!skillRates.length) {
        missing.push('skills');
    } else {
        const invalidSkill = skillRates.some((row) => {
            const name = String(row?.skillName || '').trim();
            return !name || !Number.isFinite(Number(row?.preferenceRank)) || Number(row?.preferenceRank) < 1 || Number(row?.preferenceRank) > 3 || Number(row?.hourlyPrice) < MIN_SKILL_RATE || Number(row?.dailyPrice) < MIN_SKILL_RATE || Number(row?.visitPrice) < MIN_SKILL_RATE;
        });

        if (invalidSkill) missing.push('skill rates');
    }

    const liveLocation = doc?.liveLocation || {};
    const latitude = Number(liveLocation.latitude);
    const longitude = Number(liveLocation.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (latitude === 0 && longitude === 0)) {
        missing.push('live location');
    }

    if (!String(doc?.travelMethod || '').trim()) missing.push('travel method');
    if (!String(doc?.paymentMethod || '').trim()) missing.push('payment method');
    if (!String(doc?.phoneType || '').trim()) missing.push('phone type');

    return missing;
};

const isWorkerDailyProfileComplete = (doc = null) => buildMissingDailyProfileFields(doc).length === 0;

const buildWorkerDailyProfileResponse = (doc = null, worker = null) => {
    if (!doc && !worker) return null;

    const normalizedDoc = doc?.toObject ? doc.toObject() : doc;
    const missingFields = buildMissingDailyProfileFields(normalizedDoc);
    const liveLocation = normalizeLiveLocation(normalizedDoc?.liveLocation || {});

    return {
        id: normalizedDoc?._id || null,
        workerId: normalizedDoc?.workerId || worker?._id || null,
        karigarId: normalizedDoc?.karigarId || worker?.karigarId || '',
        skillRates: Array.isArray(normalizedDoc?.skillRates) ? normalizedDoc.skillRates : [],
        liveLocation,
        travelMethod: normalizedDoc?.travelMethod || 'other',
        paymentMethod: normalizedDoc?.paymentMethod || 'flexible',
        phoneType: normalizedDoc?.phoneType || 'Smartphone',
        isComplete: missingFields.length === 0,
        missingFields,
        lastUpdatedAt: normalizedDoc?.lastUpdatedAt || normalizedDoc?.updatedAt || null,
        createdAt: normalizedDoc?.createdAt || null,
        updatedAt: normalizedDoc?.updatedAt || null,
    };
};

const getWorkerDailyProfileRecord = async (identifier) => {
    const value = String(identifier || '').trim();
    if (!value) return null;

    const queries = [];
    if (mongoose.Types.ObjectId.isValid(value)) {
        queries.push({ workerId: value });
    }
    queries.push({ karigarId: value });

    for (const query of queries) {
        const profile = await WorkerDailyProfile.findOne(query);
        if (profile) return profile;
    }

    return null;
};

const upsertWorkerDailyProfile = async ({ worker, payload = {} }) => {
    if (!worker?._id) return null;

    const normalized = normalizeWorkerDailyProfilePayload(payload, worker);
    const update = {
        ...normalized,
        workerId: worker._id,
        karigarId: String(worker.karigarId || normalized.karigarId || '').trim(),
        isComplete: isWorkerDailyProfileComplete(normalized),
        lastUpdatedAt: new Date(),
    };

    const result = await WorkerDailyProfile.findOneAndUpdate(
        { workerId: worker._id },
        { $set: update },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return result;
};

const getWorkerDailyProfileSnapshot = async (worker) => {
    if (!worker?._id) return null;

    const profile = await WorkerDailyProfile.findOne({ workerId: worker._id });
    return buildWorkerDailyProfileResponse(profile, worker);
};

module.exports = {
    buildMissingDailyProfileFields,
    buildWorkerDailyProfileResponse,
    getWorkerDailyProfileRecord,
    getWorkerDailyProfileSnapshot,
    isWorkerDailyProfileComplete,
    normalizeWorkerDailyProfilePayload,
    upsertWorkerDailyProfile,
};