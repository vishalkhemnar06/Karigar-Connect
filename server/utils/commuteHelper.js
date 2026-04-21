const axios = require('axios');

const EARTH_RADIUS_KM = 6371;
const LOCATION_STALE_MINUTES = Math.max(1, Number(process.env.LOCATION_STALE_MINUTES || 30));
const ETA_BUFFER_MINUTES = Math.max(0, Number(process.env.ETA_BUFFER_MINUTES || 12));
const COMMUTE_HARD_BLOCK = String(process.env.COMMUTE_HARD_BLOCK || '').toLowerCase() === 'true';
const COMMUTE_DISTANCE_FIRST_VISIT_ONLY = String(process.env.COMMUTE_DISTANCE_FIRST_VISIT_ONLY || 'true').toLowerCase() !== 'false';
const RURAL_FALLBACK_TRIGGER_KM = Math.max(5, Number(process.env.RURAL_FALLBACK_TRIGGER_KM || 12));
const RURAL_FALLBACK_MEDIUM_FACTOR = Math.max(1, Number(process.env.RURAL_FALLBACK_MEDIUM_FACTOR || 1.15));
const RURAL_FALLBACK_LONG_FACTOR = Math.max(1, Number(process.env.RURAL_FALLBACK_LONG_FACTOR || 1.3));

const SPEED_KMPH_BY_MODE = {
    walk: 4.5,
    bike: 28,
    car: 36,
    public_transport: 22,
};

const GOOGLE_MODE_BY_TRANSPORT = {
    walk: 'walking',
    bike: 'driving',
    car: 'driving',
    public_transport: 'transit',
};

const etaCache = new Map();

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

const parseFiniteNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const toRad = (deg) => (deg * Math.PI) / 180;

const haversineKm = (lat1, lng1, lat2, lng2) => {
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatEtaText = (minutes = 0) => {
    const value = Math.max(1, Math.round(Number(minutes) || 0));
    if (value < 60) return `${value} min`;
    const h = Math.floor(value / 60);
    const m = value % 60;
    return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
};

const getDistanceBadge = (distanceKm) => {
    const km = Number(distanceKm);
    if (!Number.isFinite(km)) return '';
    if (km < 5) return 'Nearby Worker';
    if (km <= 10) return 'Moderate Distance';
    return 'Far Worker';
};

const getDistanceColor = (distanceKm) => {
    const km = Number(distanceKm);
    if (!Number.isFinite(km)) return 'unknown';
    if (km < 5) return 'green';
    if (km <= 15) return 'yellow';
    return 'red';
};

const normalizeTransportMode = (value) => {
    const text = String(value || '').trim().toLowerCase();
    if (!text) return 'walk';

    if (['walk', 'walking', 'on foot', 'foot'].includes(text)) return 'walk';
    if (['car', 'cab', 'taxi', 'auto', 'four wheeler', '4 wheeler'].includes(text)) return 'car';
    if (['bike', 'motorbike', 'motorcycle', 'scooter', 'cycle', 'two wheeler', '2 wheeler', 'motorcycle'].includes(text)) return 'bike';
    if (['bus', 'metro', 'train', 'public', 'public_transport', 'public transport', 'lift', 'other'].includes(text)) return 'public_transport';

    return 'walk';
};

const parseJobStartDateTime = (job = {}) => {
    if (!job?.scheduledDate || !job?.scheduledTime) return null;
    const when = new Date(job.scheduledDate);
    if (Number.isNaN(when.getTime())) return null;

    const [h, m] = String(job.scheduledTime).split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;

    when.setHours(h, m, 0, 0);
    return Number.isNaN(when.getTime()) ? null : when;
};

const shouldEnforceCommuteForJob = (job = {}) => {
    if (!COMMUTE_DISTANCE_FIRST_VISIT_ONLY) return true;

    const visitNumber = Number(job?.visitNumber ?? job?.visitIndex ?? 1);
    if (Number.isFinite(visitNumber) && visitNumber > 1) return false;
    if (job?.isFollowUpVisit === true) return false;
    if (job?.firstVisitOnly === true) return true;
    return true;
};

const getWorkerCoordinates = (worker = null, dailyProfile = null) => {
    const live = dailyProfile?.liveLocation || {};
    const liveLat = parseFiniteNumber(live.latitude ?? live.lat);
    const liveLng = parseFiniteNumber(live.longitude ?? live.lng);

    if (liveLat !== null && liveLng !== null) {
        return {
            lat: liveLat,
            lng: liveLng,
            source: 'live',
            updatedAt: live.updatedAt ? new Date(live.updatedAt) : null,
        };
    }

    const addr = worker?.address || {};
    const profileLat = parseFiniteNumber(addr.latitude ?? addr.lat);
    const profileLng = parseFiniteNumber(addr.longitude ?? addr.lng);
    if (profileLat !== null && profileLng !== null) {
        return {
            lat: profileLat,
            lng: profileLng,
            source: 'profile',
            updatedAt: null,
        };
    }

    return { lat: null, lng: null, source: 'none', updatedAt: null };
};

const getJobCoordinates = (job = {}) => {
    const loc = job?.location || {};
    return {
        lat: parseFiniteNumber(loc.lat ?? loc.latitude),
        lng: parseFiniteNumber(loc.lng ?? loc.longitude),
    };
};

const isLocationStale = (updatedAt) => {
    if (!updatedAt) return false;
    const at = new Date(updatedAt);
    if (Number.isNaN(at.getTime())) return false;
    const ageMinutes = (Date.now() - at.getTime()) / 60000;
    return ageMinutes > LOCATION_STALE_MINUTES;
};

const getRuralFallbackFactor = (distanceKm) => {
    const km = Number(distanceKm || 0);
    if (!Number.isFinite(km) || km <= RURAL_FALLBACK_TRIGGER_KM) return 1;
    if (km >= 25) return RURAL_FALLBACK_LONG_FACTOR;
    return RURAL_FALLBACK_MEDIUM_FACTOR;
};

const getGoogleMapsApiKey = () =>
    String(process.env.GOOGLE_MAPS_API_KEY || process.env.GMAPS_API_KEY || '').trim();

const buildEtaCacheKey = ({ originLat, originLng, destLat, destLng, googleMode }) =>
    [
        round2(originLat),
        round2(originLng),
        round2(destLat),
        round2(destLng),
        googleMode,
    ].join('|');

const getGoogleRouteMetrics = async ({ originLat, originLng, destLat, destLng, transportMode }) => {
    const apiKey = getGoogleMapsApiKey();
    if (!apiKey) return null;

    const googleMode = GOOGLE_MODE_BY_TRANSPORT[transportMode] || 'walking';
    const cacheKey = buildEtaCacheKey({ originLat, originLng, destLat, destLng, googleMode });
    const cached = etaCache.get(cacheKey);

    if (cached && Date.now() - cached.at < 5 * 60 * 1000) {
        return cached;
    }

    try {
        const response = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
            params: {
                origins: `${originLat},${originLng}`,
                destinations: `${destLat},${destLng}`,
                mode: googleMode,
                departure_time: 'now',
                traffic_model: googleMode === 'driving' ? 'best_guess' : undefined,
                key: apiKey,
            },
            timeout: 6000,
        });

        const element = response?.data?.rows?.[0]?.elements?.[0];
        if (!element || element.status !== 'OK') return null;

        const durationSeconds = Number(
            element.duration_in_traffic?.value
            ?? element.duration?.value
            ?? 0,
        );
        const routeDistanceMeters = Number(element.distance?.value ?? 0);

        if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
        if (!Number.isFinite(routeDistanceMeters) || routeDistanceMeters < 0) return null;

        const metrics = {
            etaMinutes: Math.max(1, Math.round(durationSeconds / 60)),
            routeDistanceKm: Math.max(0, round2(routeDistanceMeters / 1000)),
            at: Date.now(),
        };
        etaCache.set(cacheKey, metrics);
        return metrics;
    } catch {
        return null;
    }
};

const estimateFallbackEtaMinutes = ({ distanceKm, transportMode }) => {
    const mode = transportMode || 'walk';
    const speed = SPEED_KMPH_BY_MODE[mode] || SPEED_KMPH_BY_MODE.walk;
    const baseMinutes = (Math.max(0, Number(distanceKm) || 0) / speed) * 60;
    const ruralFactor = getRuralFallbackFactor(distanceKm);
    return Math.max(1, Math.round(baseMinutes * ruralFactor));
};

const getCompletedJobsCountMap = async (JobModel, workerIds = []) => {
    if (!JobModel || !workerIds.length) return new Map();

    const counts = await JobModel.aggregate([
        { $match: { status: 'completed', assignedTo: { $in: workerIds } } },
        { $unwind: '$assignedTo' },
        { $match: { assignedTo: { $in: workerIds } } },
        { $group: { _id: '$assignedTo', completedJobs: { $sum: 1 } } },
    ]);

    return new Map(counts.map((row) => [String(row._id), Number(row.completedJobs || 0)]));
};

const computeWorkerJobCommute = async ({
    worker,
    dailyProfile,
    job,
    now = new Date(),
    etaBufferMinutes = ETA_BUFFER_MINUTES,
}) => {
    const workerCoords = getWorkerCoordinates(worker, dailyProfile);
    const jobCoords = getJobCoordinates(job);
    const transportMode = normalizeTransportMode(dailyProfile?.travelMethod || worker?.travelMethod);

    if (workerCoords.lat === null || workerCoords.lng === null || jobCoords.lat === null || jobCoords.lng === null) {
        return {
            available: false,
            reason: 'location_unavailable',
            transportMode,
            transportLabel: transportMode.replace('_', ' '),
            etaVarianceNote: 'ETA may vary with traffic and chosen transport mode.',
            etaRefreshRecommendedMinutes: 5,
            workerLocationSource: workerCoords.source,
            gpsStatus: workerCoords.source === 'none' ? 'unavailable' : 'profile_only',
            requiresLiveLocationRefresh: workerCoords.source !== 'live',
            isLocationStale: workerCoords.updatedAt ? isLocationStale(workerCoords.updatedAt) : false,
            workerLocationUpdatedAt: workerCoords.updatedAt || null,
        };
    }

    const haversineDistanceKm = round2(haversineKm(workerCoords.lat, workerCoords.lng, jobCoords.lat, jobCoords.lng));

    const googleRoute = await getGoogleRouteMetrics({
        originLat: workerCoords.lat,
        originLng: workerCoords.lng,
        destLat: jobCoords.lat,
        destLng: jobCoords.lng,
        transportMode,
    });

    const distanceKm = Number.isFinite(googleRoute?.routeDistanceKm)
        ? round2(googleRoute.routeDistanceKm)
        : haversineDistanceKm;

    const baseEtaMinutes = Number.isFinite(googleRoute?.etaMinutes)
        ? googleRoute.etaMinutes
        : estimateFallbackEtaMinutes({ distanceKm, transportMode });
    const isProfileOnlyLocation = workerCoords.source !== 'live';
    const bufferedEtaMinutes = Math.max(1, baseEtaMinutes + Math.max(0, Number(etaBufferMinutes) || 0));

    const nowDate = now instanceof Date ? now : new Date(now);
    const arrivalAt = new Date(nowDate.getTime() + bufferedEtaMinutes * 60 * 1000);
    const jobStartAt = parseJobStartDateTime(job);

    const minutesToStart = jobStartAt ? Math.round((jobStartAt.getTime() - nowDate.getTime()) / 60000) : null;
    const arrivalDeltaMinutes = jobStartAt ? Math.round((arrivalAt.getTime() - jobStartAt.getTime()) / 60000) : null;

    return {
        available: true,
        distanceKm,
        distanceText: `${distanceKm.toFixed(1)} km`,
        distanceColor: getDistanceColor(distanceKm),
        distanceBadge: getDistanceBadge(distanceKm),
        transportMode,
        transportLabel: transportMode.replace('_', ' '),
        etaMinutesBase: baseEtaMinutes,
        etaMinutesBuffered: bufferedEtaMinutes,
        etaText: formatEtaText(bufferedEtaMinutes),
        etaBufferMinutes: Math.max(0, Number(etaBufferMinutes) || 0),
        etaVarianceNote: 'ETA may vary with traffic and chosen transport mode.',
        etaRefreshRecommendedMinutes: 5,
        etaSource: googleRoute ? 'google_maps' : 'fallback',
        distanceSource: googleRoute ? 'google_maps_route' : 'haversine_fallback',
        fallbackProfile: googleRoute ? '' : (distanceKm > RURAL_FALLBACK_TRIGGER_KM ? 'rural_adjusted' : 'standard'),
        workerLocationSource: workerCoords.source,
        gpsStatus: isProfileOnlyLocation ? 'profile_only' : 'live',
        requiresLiveLocationRefresh: isProfileOnlyLocation,
        gpsOffNotice: isProfileOnlyLocation ? 'Live GPS is off. ETA is based on profile location and may shift after refresh.' : '',
        workerLocationUpdatedAt: workerCoords.updatedAt || null,
        isLocationStale: workerCoords.updatedAt ? isLocationStale(workerCoords.updatedAt) : false,
        travelIncentiveSuggested: distanceKm > 10,
        travelAllowanceSuggestion: distanceKm > 10 ? 'Consider adding a travel allowance for long-distance commute.' : '',
        arrivalAt,
        jobStartAt,
        minutesToStart,
        arrivalDeltaMinutes,
        canReachBeforeStart: jobStartAt ? arrivalAt.getTime() <= jobStartAt.getTime() : true,
    };
};

const maybeSoftAllow = ({ code, message, commute }) => {
    if (COMMUTE_HARD_BLOCK) {
        return { allowed: false, code, message, blocked: true };
    }
    return { allowed: true, code, message: '', warning: message, blocked: false, commute };
};

const getApplyRestrictionResult = (commute, { maxDistanceKm = 20, job = null } = {}) => {
    if (!shouldEnforceCommuteForJob(job)) {
        return {
            allowed: true,
            code: 'first_visit_only',
            message: '',
            warning: 'Commute distance rule is applied only for the first visit/start day.',
            blocked: false,
        };
    }

    if (!commute?.available) {
        return {
            allowed: false,
            code: 'location_unavailable',
            message: 'Unable to calculate travel distance. Please update your live location in Daily Dashboard and try again.',
            blocked: true,
        };
    }

    if (commute.isLocationStale) {
        return maybeSoftAllow({
            code: 'location_stale',
            message: 'Your live location seems outdated. Please refresh location for better ETA accuracy.',
            commute,
        });
    }

    if (Number(commute.distanceKm || 0) > Number(maxDistanceKm)) {
        return maybeSoftAllow({
            code: 'distance_limit',
            message: `You can apply only within ${maxDistanceKm} km. Current distance is ${commute.distanceText}.`,
            commute,
        });
    }

    if (commute.jobStartAt && commute.arrivalAt && commute.arrivalAt.getTime() > commute.jobStartAt.getTime()) {
        return maybeSoftAllow({
            code: 'late_arrival',
            message: `You may reach late. ETA is ${commute.etaText}, but job starts in ${formatEtaText(Math.max(1, Number(commute.minutesToStart || 0)))}.`,
            commute,
        });
    }

    return { allowed: true, code: 'ok', message: '', blocked: false };
};

const getClientAcceptanceRuleResult = (commute, { maxDistanceKm = 25, job = null } = {}) => {
    if (!shouldEnforceCommuteForJob(job)) {
        return {
            canAccept: true,
            warning: 'Commute distance rule is applied only for the first visit/start day.',
            showLateWarning: false,
            blocked: false,
        };
    }

    if (!commute?.available) {
        return {
            canAccept: false,
            warning: 'Distance/ETA unavailable because worker location is missing or outdated.',
            showLateWarning: false,
            blocked: true,
        };
    }

    if (commute.isLocationStale && !COMMUTE_HARD_BLOCK) {
        return {
            canAccept: true,
            warning: 'Worker live location is outdated. ETA may vary until location refresh.',
            showLateWarning: false,
            blocked: false,
        };
    }

    if (commute.isLocationStale && COMMUTE_HARD_BLOCK) {
        return {
            canAccept: false,
            warning: 'Worker live location is outdated. Please request location refresh before accepting.',
            showLateWarning: false,
            blocked: true,
        };
    }

    if (Number(commute.distanceKm || 0) > Number(maxDistanceKm)) {
        if (!COMMUTE_HARD_BLOCK) {
            return {
                canAccept: true,
                warning: `Worker is ${commute.distanceText} away. Suggested to add travel allowance for smoother acceptance.`,
                showLateWarning: false,
                blocked: false,
            };
        }
        return {
            canAccept: false,
            warning: `Worker is ${commute.distanceText} away. Client acceptance is allowed only up to ${maxDistanceKm} km.`,
            showLateWarning: false,
            blocked: true,
        };
    }

    const showLateWarning = !!(commute.jobStartAt && commute.arrivalAt && commute.arrivalAt.getTime() > commute.jobStartAt.getTime());
    const warning = showLateWarning
        ? `Worker may not reach on time. ETA: ${commute.etaText}. Job starts in ${formatEtaText(Math.max(1, Number(commute.minutesToStart || 0)))}.`
        : '';

    return {
        canAccept: true,
        warning,
        showLateWarning,
        blocked: false,
    };
};

module.exports = {
    ETA_BUFFER_MINUTES,
    LOCATION_STALE_MINUTES,
    normalizeTransportMode,
    formatEtaText,
    getDistanceColor,
    parseJobStartDateTime,
    getWorkerCoordinates,
    getJobCoordinates,
    computeWorkerJobCommute,
    getApplyRestrictionResult,
    getClientAcceptanceRuleResult,
    getCompletedJobsCountMap,
};
