const Groq = require('groq-sdk');
const Job = require('../models/jobModel');
const User = require('../models/userModel');
const Group = require('../models/Group');
const Notification = require('../models/notificationModel');
const ClientComplaint = require('../models/clientComplaintModel');
const BaseRate = require('../models/baseRateModel');
const AuditLog = require('../models/auditLogModel');
const {
    detectAndTranslateToEnglish,
    normalizeLanguage,
    translateBatch,
    translateText,
} = require('./translationService');
const {
    normalizeSkillKey,
    normalizeCityKey,
    estimatePrice,
} = require('./pricingEngineService');

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 30;
const userRequestBuckets = new Map();
let lastAuditCleanupAt = 0;

const parseBooleanEnv = (value, defaultValue) => {
    if (value === undefined || value === null || value === '') return defaultValue;
    return !['0', 'false', 'no', 'off'].includes(String(value).toLowerCase());
};

const parsePositiveIntEnv = (value, defaultValue) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return defaultValue;
    return Math.floor(n);
};

const CHATBOT_ENABLED = parseBooleanEnv(process.env.CHATBOT_ENABLED, true);
const CHATBOT_DISABLE_ON_SECURE_ROUTES = parseBooleanEnv(process.env.CHATBOT_DISABLE_ON_SECURE_ROUTES, true);
const CHATBOT_BLOCK_PRIVATE_DATA = parseBooleanEnv(process.env.CHATBOT_BLOCK_PRIVATE_DATA, true);
const CHATBOT_BLOCK_PROMPT_INJECTION = parseBooleanEnv(process.env.CHATBOT_BLOCK_PROMPT_INJECTION, true);
const CHATBOT_ALLOW_LLM_FOR_LIVE_DATA = parseBooleanEnv(process.env.CHATBOT_ALLOW_LLM_FOR_LIVE_DATA, false);
const CHATBOT_AUDIT_RETENTION_DAYS = parsePositiveIntEnv(process.env.CHATBOT_AUDIT_RETENTION_DAYS, 60);
const CHATBOT_AUDIT_CLEANUP_INTERVAL_MS = 12 * 60 * 60 * 1000;

const BLOCKED_PATTERNS = [
    /backend\s*logs?/i,
    /server\s*logs?/i,
    /stack\s*trace/i,
    /token/i,
    /jwt/i,
    /password/i,
    /secret/i,
    /api\s*key/i,
    /mongo(db)?\s*(query|dump|collection)?/i,
    /show\s+all\s+users/i,
    /other\s+client/i,
    /admin\s+panel\s+data/i,
    /internal\s+config/i,
    /\.env/i,
];

const SENSITIVE_ROUTE_PATTERNS = [
    /^\/client\/settings(?:\/|$)/i,
    /^\/client\/hired-workers(?:\/|$)/i,
    /^\/client\/worker-face-verify(?:\/|$)/i,
    /payment/i,
    /password/i,
    /otp/i,
    /security/i,
    /secure/i,
];

const PRIVATE_DATA_PATTERNS = [
    /\b(?:otp|one\s*time\s*password)\b/i,
    /\b(?:password|passcode|pin)\b/i,
    /\b(?:cvv|cvc)\b/i,
    /\b(?:upi|vpa|bank\s*account|account\s*number|ifsc|card\s*number|debit\s*card|credit\s*card|razorpay)\b/i,
    /\b(?:secret\s*question|security\s*answer)\b/i,
];

const PROMPT_INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?(previous|prior)\s+instructions?/i,
    /reveal\s+(the\s+)?system\s+prompt/i,
    /show\s+(me\s+)?(the\s+)?hidden\s+data/i,
    /show\s+(me\s+)?(your\s+)?internal\s+instructions?/i,
    /developer\s+message/i,
    /bypass\s+(your\s+)?(safety|policy|guardrails?)/i,
    /jailbreak/i,
];

const ROUTE_CATALOG = [
    { route: '/client/dashboard', label: 'Dashboard', purpose: 'Overview of workers, city rates, and quick insights.' },
    { route: '/client/job-post', label: 'Post Job', purpose: 'Create a new job with details, budget, and schedule.' },
    { route: '/client/job-manage', label: 'Manage Jobs', purpose: 'Track posted jobs, applicants, and status updates.' },
    { route: '/client/ai-assist', label: 'AI Tool', purpose: 'Detailed AI advisor for project planning and estimation.' },
    { route: '/client/hired-workers', label: 'Hired Workers', purpose: 'Track direct-hire tickets and progress.' },
    { route: '/client/favorites', label: 'Favorites', purpose: 'Quick access to starred workers.' },
    { route: '/client/history', label: 'History', purpose: 'Completed/cancelled jobs and past records.' },
    { route: '/client/profile', label: 'Profile', purpose: 'Personal account details and verification info.' },
    { route: '/client/settings', label: 'Settings', purpose: 'Security, password, and account controls.' },
    { route: '/client/groups', label: 'Groups', purpose: 'Find and connect with worker groups.' },
    { route: '/client/nearby-shops', label: 'Nearby Shops', purpose: 'Find nearby material shops.' },
    { route: '/client/complaints', label: 'Complaints', purpose: 'File and track support complaints.' },
];

const INTENT_LIST = [
    'greeting',
    'count_jobs_total',
    'count_jobs_active',
    'count_jobs_completed',
    'count_jobs_cancelled',
    'count_jobs_open',
    'count_jobs_running',
    'count_jobs_scheduled',
    'count_jobs_proposal',
    'count_direct_hires_total',
    'count_direct_hires_pending',
    'count_direct_hires_paid',
    'count_complaints_total',
    'count_favorites',
    'count_groups_total',
    'count_notifications_unread',
    'count_workers_city_total',
    'count_workers_city_available',
    'rate_skill_city_day',
    'rate_skill_city_hour',
    'job_estimate',
    'faq_post_job',
    'faq_manage_jobs',
    'faq_direct_hire',
    'faq_ai_tool',
    'faq_complaints',
    'faq_history',
    'faq_favorites',
    'faq_groups',
    'page_help',
    'list_sections',
    'unknown',
];

const FOLLOW_UP_INTENTS = new Set(['job_estimate', 'rate_skill_city_day', 'rate_skill_city_hour']);
const SENSITIVE_INTENTS = new Set([
    'count_jobs_total',
    'count_jobs_active',
    'count_jobs_completed',
    'count_jobs_cancelled',
    'count_jobs_open',
    'count_jobs_running',
    'count_jobs_scheduled',
    'count_jobs_proposal',
    'count_direct_hires_total',
    'count_direct_hires_pending',
    'count_direct_hires_paid',
    'count_complaints_total',
    'count_favorites',
    'count_groups_total',
    'count_notifications_unread',
    'count_workers_city_total',
    'count_workers_city_available',
    'rate_skill_city_day',
    'rate_skill_city_hour',
    'job_estimate',
]);
const SAFE_ESTIMATE_CONTEXT_KEYS = new Set([
    'skill',
    'city',
    'areaSqft',
    'bhk',
    'walls',
    'points',
    'bathrooms',
    'doors',
    'windows',
    'includeMaterial',
]);
const SAFE_FOLLOW_UP_FIELDS = new Set([
    'city',
    'skill',
    'areaOrBhk',
    'carpentryDetails',
    'plumbingDetails',
    'electricalPoints',
    'tilingArea',
    'areaOrScope',
]);

const SKILL_ALIASES = {
    painter: ['painter', 'painting', 'paint'],
    carpenter: ['carpenter', 'wood work', 'woodwork', 'carpentry'],
    plumber: ['plumber', 'plumbing'],
    electrician: ['electrician', 'electrical'],
    mason: ['mason', 'masonry', 'bricklayer'],
    tiler: ['tiler', 'tiles', 'tiling'],
    welder: ['welder', 'welding'],
    deep_cleaning: ['cleaning', 'deep cleaning', 'housekeeping'],
    handyman: ['handyman', 'helper', 'general helper'],
};

const SUGGESTIONS_EN = [
    'How many jobs have I posted in total?',
    'How many active jobs do I currently have?',
    'How many workers are available in my city?',
    'What is the per day rate of carpenter in Pune?',
    'I have painting work in 200 sqft 1BHK, estimate workers and cost.',
    'What can I do from the dashboard?',
];

let cityCache = { expiresAt: 0, cities: [] };

const cleanText = (value = '', limit = 1400) => String(value || '').trim().slice(0, limit);

const clampInt = (value, min, max) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.min(max, Math.max(min, Math.round(n)));
};

const sanitizeEstimateContext = (raw = {}) => {
    if (!raw || typeof raw !== 'object') return {};

    const sanitized = {};
    if (raw.skill) sanitized.skill = normalizeSkillKey(cleanText(raw.skill, 40));
    if (raw.city) sanitized.city = cleanText(raw.city, 80).replace(/[^a-zA-Z\s-]/g, '').trim();
    if (typeof raw.includeMaterial === 'boolean') sanitized.includeMaterial = raw.includeMaterial;

    const areaSqft = clampInt(raw.areaSqft, 50, 100000);
    const bhk = clampInt(raw.bhk, 1, 10);
    const walls = clampInt(raw.walls, 1, 80);
    const points = clampInt(raw.points, 1, 5000);
    const bathrooms = clampInt(raw.bathrooms, 1, 50);
    const doors = clampInt(raw.doors, 1, 200);
    const windows = clampInt(raw.windows, 1, 300);

    if (areaSqft !== null) sanitized.areaSqft = areaSqft;
    if (bhk !== null) sanitized.bhk = bhk;
    if (walls !== null) sanitized.walls = walls;
    if (points !== null) sanitized.points = points;
    if (bathrooms !== null) sanitized.bathrooms = bathrooms;
    if (doors !== null) sanitized.doors = doors;
    if (windows !== null) sanitized.windows = windows;

    return sanitized;
};

const sanitizeFollowUpState = (followUpState) => {
    if (!followUpState || typeof followUpState !== 'object') return null;

    const intentRaw = cleanText(followUpState.intent || '', 60);
    const intent = FOLLOW_UP_INTENTS.has(intentRaw) ? intentRaw : null;

    const fieldRaw = cleanText(followUpState.field || '', 60);
    const field = SAFE_FOLLOW_UP_FIELDS.has(fieldRaw) ? fieldRaw : null;

    const question = cleanText(followUpState.question || '', 240);
    const skill = cleanText(followUpState.skill || '', 40);
    const contextRaw = followUpState.contextSnapshot || followUpState.context || {};
    const contextSnapshot = sanitizeEstimateContext(contextRaw);

    if (!intent && !field && !question && Object.keys(contextSnapshot).length === 0) return null;

    return {
        ...(intent ? { intent } : {}),
        ...(field ? { field } : {}),
        ...(question ? { question } : {}),
        ...(skill ? { skill: normalizeSkillKey(skill) } : {}),
        ...(Object.keys(contextSnapshot).length ? { contextSnapshot } : {}),
    };
};

const redactSensitiveText = (text = '') => String(text || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/(?:\+?\d[\d\s-]{8,}\d)/g, '[redacted-phone]')
    .replace(/\b\d{6,}\b/g, '[redacted-number]');

const sanitizeToolResultForLlm = (toolResult = {}) => {
    const safeFacts = { ...(toolResult?.facts || {}) };
    delete safeFacts.contextSnapshot;
    delete safeFacts.followUpContext;
    delete safeFacts.estimate;

    if (safeFacts.message) safeFacts.message = cleanText(redactSensitiveText(safeFacts.message), 300);
    if (safeFacts.followUpQuestion) safeFacts.followUpQuestion = cleanText(safeFacts.followUpQuestion, 240);

    return {
        sourceType: toolResult?.sourceType || 'gui-knowledge',
        facts: safeFacts,
        actions: Array.isArray(toolResult?.actions)
            ? toolResult.actions.slice(0, 3).map((a) => ({
                label: cleanText(a?.label || '', 40),
                route: normalizeRoute(a?.route || '/client/dashboard'),
            }))
            : [],
    };
};

const normalizeRoute = (route = '') => {
    const safe = String(route || '').trim();
    if (!safe.startsWith('/client/')) return '/client/dashboard';
    return safe;
};

const isSensitiveRoute = (route = '') => {
    const safe = normalizeRoute(route);
    return SENSITIVE_ROUTE_PATTERNS.some((pattern) => pattern.test(safe));
};

const hasPrivateDataIntent = (message = '') => PRIVATE_DATA_PATTERNS.some((pattern) => pattern.test(String(message || '')));
const hasPromptInjectionIntent = (message = '') => PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(String(message || '')));

const normalizeConversation = (conversation = []) => (
    Array.isArray(conversation)
        ? conversation
            .filter((item) => item && typeof item === 'object')
            .map((item) => ({
                role: item.role === 'bot' ? 'bot' : 'user',
                text: cleanText(item.text || '', 500),
            }))
            .filter((item) => item.text)
            .slice(-20)
        : []
);

const matchesBlockedPattern = (message = '') => BLOCKED_PATTERNS.some((pattern) => pattern.test(message));

const bumpRateLimit = (userId) => {
    const now = Date.now();
    const key = String(userId || 'anonymous');
    const bucket = userRequestBuckets.get(key) || [];
    const fresh = bucket.filter((ts) => now - ts < RATE_WINDOW_MS);
    fresh.push(now);
    userRequestBuckets.set(key, fresh);
    return fresh.length;
};

const getKnownCities = async () => {
    const now = Date.now();
    if (cityCache.expiresAt > now && cityCache.cities.length) return cityCache.cities;

    try {
        const rows = await BaseRate.find({ isActive: true }).select('city cityKey').lean();
        const map = new Map();
        rows.forEach((row) => {
            const city = cleanText(row.city || '');
            const cityKey = cleanText(row.cityKey || '');
            if (!city && !cityKey) return;
            const key = (cityKey || city.toLowerCase()).trim();
            if (!map.has(key)) map.set(key, city || cityKey);
        });

        cityCache = {
            expiresAt: now + 10 * 60 * 1000,
            cities: [...map.values()].sort((a, b) => a.localeCompare(b)),
        };
        return cityCache.cities;
    } catch {
        return ['Pune', 'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata'];
    }
};

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cityRegexFromInput = (value = '') => new RegExp(`^${escapeRegex(String(value).trim())}$`, 'i');

const detectSkillFromText = (text = '') => {
    const t = String(text || '').toLowerCase();
    let bestSkill = '';
    let bestIndex = -1;

    for (const [skill, aliases] of Object.entries(SKILL_ALIASES)) {
        for (const alias of aliases) {
            const idx = t.lastIndexOf(alias);
            if (idx >= 0 && idx >= bestIndex) {
                bestSkill = skill;
                bestIndex = idx;
            }
        }
    }

    return bestSkill;
};

const detectIntentByRules = ({ messageEn = '', currentRoute = '' }) => {
    const text = String(messageEn || '').toLowerCase();

    if (/\b(hi|hello|hey|namaste|नमस्ते|नमस्कार)\b/i.test(text)) return { intent: 'greeting', confidence: 'high' };

    if (/how many|total|count|number/.test(text) && /job/.test(text) && /posted|post/.test(text)) return { intent: 'count_jobs_total', confidence: 'high' };
    if (/how many|total|count|number/.test(text) && /active/.test(text) && /job/.test(text)) return { intent: 'count_jobs_active', confidence: 'high' };
    if (/how many|total|count|number/.test(text) && /completed/.test(text) && /job/.test(text)) return { intent: 'count_jobs_completed', confidence: 'high' };
    if (/how many|total|count|number/.test(text) && /cancelled|canceled/.test(text) && /job/.test(text)) return { intent: 'count_jobs_cancelled', confidence: 'high' };
    if (/how many|total|count|number/.test(text) && /open/.test(text) && /job/.test(text)) return { intent: 'count_jobs_open', confidence: 'high' };
    if (/how many|total|count|number/.test(text) && /running|ongoing/.test(text) && /job/.test(text)) return { intent: 'count_jobs_running', confidence: 'high' };
    if (/how many|total|count|number/.test(text) && /scheduled/.test(text) && /job/.test(text)) return { intent: 'count_jobs_scheduled', confidence: 'high' };
    if (/how many|total|count|number/.test(text) && /proposal/.test(text) && /job/.test(text)) return { intent: 'count_jobs_proposal', confidence: 'high' };

    if (/direct hire/.test(text) && /how many|count|total/.test(text) && /pending/.test(text)) return { intent: 'count_direct_hires_pending', confidence: 'high' };
    if (/direct hire/.test(text) && /how many|count|total/.test(text) && /paid|payment done/.test(text)) return { intent: 'count_direct_hires_paid', confidence: 'high' };
    if (/direct hire/.test(text) && /how many|count|total/.test(text)) return { intent: 'count_direct_hires_total', confidence: 'high' };

    if (/complaint/.test(text) && /how many|count|total/.test(text)) return { intent: 'count_complaints_total', confidence: 'high' };
    if (/favorite|starred/.test(text) && /how many|count|total/.test(text)) return { intent: 'count_favorites', confidence: 'high' };
    if (/group/.test(text) && /how many|count|total/.test(text)) return { intent: 'count_groups_total', confidence: 'high' };
    if (/notification/.test(text) && /unread|pending|new|count|how many/.test(text)) return { intent: 'count_notifications_unread', confidence: 'high' };

    if (/worker|karigar/.test(text) && /city|my city|in my city/.test(text) && /available/.test(text)) return { intent: 'count_workers_city_available', confidence: 'high' };
    if (/worker|karigar/.test(text) && /city|my city|in my city/.test(text) && /how many|count|total|number/.test(text)) return { intent: 'count_workers_city_total', confidence: 'high' };

    if (/rate|price|cost/.test(text) && /(per day|\/day|day rate|daily)/.test(text) && detectSkillFromText(text)) return { intent: 'rate_skill_city_day', confidence: 'high' };
    if (/rate|price|cost/.test(text) && /(per hour|\/hour|hourly)/.test(text) && detectSkillFromText(text)) return { intent: 'rate_skill_city_hour', confidence: 'high' };

    if (/paint|painting|carpenter|plumber|electrician|tiler|mason|estimate|budget|workers needed|how many workers/.test(text)) {
        return { intent: 'job_estimate', confidence: 'medium' };
    }

    if (/dashboard|what can i do here|this page|current page/.test(text)) return { intent: 'page_help', confidence: 'high', actionRoute: currentRoute || '/client/dashboard' };
    if (/post job|create job|new job/.test(text)) return { intent: 'faq_post_job', confidence: 'high' };
    if (/manage job|track job|job status/.test(text)) return { intent: 'faq_manage_jobs', confidence: 'high' };
    if (/direct hire|hired worker/.test(text)) return { intent: 'faq_direct_hire', confidence: 'high' };
    if (/ai tool|ai assist|advisor/.test(text)) return { intent: 'faq_ai_tool', confidence: 'high' };
    if (/complaint support|how to complaint|file complaint/.test(text)) return { intent: 'faq_complaints', confidence: 'high' };
    if (/history/.test(text)) return { intent: 'faq_history', confidence: 'high' };
    if (/favorite/.test(text)) return { intent: 'faq_favorites', confidence: 'high' };
    if (/group/.test(text) && /where|how|page|section/.test(text)) return { intent: 'faq_groups', confidence: 'high' };
    if (/route|section|where can i|navigation|menu/.test(text)) return { intent: 'list_sections', confidence: 'medium' };

    return { intent: 'unknown', confidence: 'low' };
};

const classifyWithGroq = async ({ messageEn = '', currentRoute = '' }) => {
    if (!groq) return null;

    const prompt = `
Classify this client chatbot query for KarigarConnect.
Allowed intents:
${INTENT_LIST.map((item) => `- ${item}`).join('\n')}

Current route: ${currentRoute}
Query: ${messageEn}

Return strict JSON:
{ "intent":"...", "confidence":"high|medium|low" }`;

    try {
        const result = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            temperature: 0,
            max_tokens: 180,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: 'You are an intent classifier. Return strict JSON only.' },
                { role: 'user', content: prompt },
            ],
        });

        const parsed = JSON.parse(result?.choices?.[0]?.message?.content || '{}');
        const intent = INTENT_LIST.includes(parsed.intent) ? parsed.intent : 'unknown';
        const confidence = ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low';
        return { intent, confidence };
    } catch {
        return null;
    }
};

const detectIncludeMaterial = (text = '') => {
    const t = String(text || '').toLowerCase();
    if (/(without material|labour only|labor only|no material)/.test(t)) return false;
    if (/(with material|include material|material also|material needed|material chahiye)/.test(t)) return true;
    return null;
};

const extractAreaSqft = (text = '') => {
    const matches = String(text || '').match(/(\d{2,5})\s*(sq\.?\s*ft|sqft|square\s*feet|square\s*ft)/i);
    if (!matches) return null;
    const n = Number(matches[1]);
    return Number.isFinite(n) ? n : null;
};

const extractBhk = (text = '') => {
    const matches = String(text || '').match(/(\d)\s*bhk/i);
    if (!matches) return null;
    const n = Number(matches[1]);
    return Number.isFinite(n) ? n : null;
};

const extractWalls = (text = '') => {
    const matches = String(text || '').match(/(\d{1,2})\s*walls?/i);
    if (!matches) return null;
    const n = Number(matches[1]);
    return Number.isFinite(n) ? n : null;
};

const detectCityFromText = async (text = '', fallbackCity = '') => {
    const knownCities = await getKnownCities();
    const lower = String(text || '').toLowerCase();

    for (const city of knownCities) {
        const cityLower = String(city).toLowerCase();
        if (cityLower && lower.includes(cityLower)) return city;
    }

    const phrase = lower.match(/in\s+([a-z\s]{3,30})/i);
    if (phrase && phrase[1]) {
        const cityGuess = phrase[1].trim().replace(/\s+/g, ' ');
        if (cityGuess.length >= 3) return cityGuess;
    }

    return fallbackCity || '';
};

const extractEstimateContext = async ({ messageEn = '', conversation = [], user = null }) => {
    const combined = [
        ...conversation.map((item) => item.text || ''),
        messageEn,
    ].join(' \n ');

    const extractCount = (pattern, fallback = null) => {
        const match = combined.match(pattern);
        if (!match) return fallback;
        const value = Number(match[1]);
        return Number.isFinite(value) && value > 0 ? value : fallback;
    };

    const detected = {
        skill: detectSkillFromText(combined),
        city: await detectCityFromText(combined, cleanText(user?.address?.city || '')),
        areaSqft: extractAreaSqft(combined),
        bhk: extractBhk(combined),
        walls: extractWalls(combined),
        points: extractCount(/(\d{1,4})\s*(?:points?|switch\s*points?|electrical\s*points?|plumbing\s*points?)/i),
        bathrooms: extractCount(/(\d{1,2})\s*(?:bathrooms?|washrooms?|toilets?)/i),
        doors: extractCount(/(\d{1,2})\s*(?:doors?|shutters?)/i),
        windows: extractCount(/(\d{1,2})\s*(?:windows?|vents?)/i),
        includeMaterial: detectIncludeMaterial(combined),
    };

    if (groq) {
        try {
            const extractPrompt = `
Extract job-estimate fields from this text. Keep existing detected values if text is unclear.
Text: ${combined}
Detected values: ${JSON.stringify(detected)}

Return strict JSON:
{
  "skill":"",
  "city":"",
  "areaSqft":null,
  "bhk":null,
  "walls":null,
    "points":null,
    "bathrooms":null,
    "doors":null,
    "windows":null,
  "includeMaterial":null
}`;

            const result = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                temperature: 0,
                max_tokens: 220,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: 'Extract structured fields. JSON only.' },
                    { role: 'user', content: extractPrompt },
                ],
            });

            const parsed = JSON.parse(result?.choices?.[0]?.message?.content || '{}');
            if (parsed.skill && !detected.skill) detected.skill = detectSkillFromText(parsed.skill) || normalizeSkillKey(parsed.skill);
            if (parsed.city && !detected.city) detected.city = cleanText(parsed.city, 80);
            if (parsed.areaSqft && !detected.areaSqft) detected.areaSqft = Number(parsed.areaSqft) || null;
            if (parsed.bhk && !detected.bhk) detected.bhk = Number(parsed.bhk) || null;
            if (parsed.walls && !detected.walls) detected.walls = Number(parsed.walls) || null;
            if (parsed.points && !detected.points) detected.points = Number(parsed.points) || null;
            if (parsed.bathrooms && !detected.bathrooms) detected.bathrooms = Number(parsed.bathrooms) || null;
            if (parsed.doors && !detected.doors) detected.doors = Number(parsed.doors) || null;
            if (parsed.windows && !detected.windows) detected.windows = Number(parsed.windows) || null;
            if (typeof parsed.includeMaterial === 'boolean' && detected.includeMaterial === null) detected.includeMaterial = parsed.includeMaterial;
        } catch {
            // keep regex extraction
        }
    }

    return detected;
};

const ESTIMATE_QUESTION_PLANS = {
    painter: [
        {
            field: 'city',
            question: () => 'Which city should I use for the painting rate?',
        },
        {
            field: 'areaOrBhk',
            question: () => 'What is the approximate painting area in square feet, or the BHK type if you know that instead?',
        },
    ],
    carpenter: [
        {
            field: 'city',
            question: () => 'Which city should I use for the carpentry rate?',
        },
        {
            field: 'carpentryDetails',
            question: () => 'How many doors, windows, or custom fittings are involved in this carpentry work?',
        },
    ],
    plumber: [
        {
            field: 'city',
            question: () => 'Which city should I use for the plumbing rate?',
        },
        {
            field: 'plumbingDetails',
            question: () => 'How many bathrooms, kitchens, or plumbing points are involved in this plumbing work?',
        },
    ],
    electrician: [
        {
            field: 'city',
            question: () => 'Which city should I use for the electrician rate?',
        },
        {
            field: 'electricalPoints',
            question: () => 'How many switch points, light points, or fan points are included in this electrical work?',
        },
    ],
    tiler: [
        {
            field: 'city',
            question: () => 'Which city should I use for the tiling rate?',
        },
        {
            field: 'tilingArea',
            question: () => 'What is the approximate tiling area in square feet, or is it floor tiling, wall tiling, or both?',
        },
    ],
    default: [
        {
            field: 'city',
            question: () => 'Which city should I use for the rate calculation?',
        },
        {
            field: 'areaOrScope',
            question: () => 'What is the approximate work area or project size so I can estimate worker count more accurately?',
        },
    ],
};

const getEstimatePlan = (skill = 'other') => ESTIMATE_QUESTION_PLANS[normalizeSkillKey(skill)] || ESTIMATE_QUESTION_PLANS.default;

const isPlanStepSatisfied = (step, context) => {
    switch (step.field) {
        case 'city':
            return Boolean(context.city);
        case 'areaOrBhk':
            return Boolean(context.areaSqft || context.bhk);
        case 'carpentryDetails':
            return Boolean(context.doors || context.windows || context.areaSqft || context.bhk);
        case 'plumbingDetails':
            return Boolean(context.bathrooms || context.points || context.areaSqft || context.bhk);
        case 'electricalPoints':
            return Boolean(context.points || context.areaSqft || context.bhk);
        case 'tilingArea':
            return Boolean(context.areaSqft || context.bhk);
        case 'areaOrScope':
            return Boolean(context.areaSqft || context.bhk);
        default:
            return true;
    }
};

const findNextEstimateStep = (skill, context) => {
    const plan = getEstimatePlan(skill);
    return plan.find((step) => !isPlanStepSatisfied(step, context)) || null;
};

const extractAreaOrBhkPatch = (messageEn = '') => {
    const areaSqft = extractAreaSqft(messageEn);
    const bhk = extractBhk(messageEn);
    return {
        areaSqft,
        bhk,
        valid: Boolean(areaSqft || bhk),
    };
};

const extractFieldPatch = async ({ field, messageEn = '', context = {}, user = null }) => {
    const cityFallback = cleanText(user?.address?.city || context.city || '');
    switch (field) {
        case 'city': {
            const city = await detectCityFromText(messageEn, cityFallback);
            return { city, valid: Boolean(city) };
        }
        case 'areaOrBhk': {
            const patch = extractAreaOrBhkPatch(messageEn);
            return patch;
        }
        case 'carpentryDetails': {
            const doors = messageEn.match(/(\d{1,2})\s*(?:doors?|shutters?)/i);
            const windows = messageEn.match(/(\d{1,2})\s*(?:windows?|vents?)/i);
            const areaPatch = extractAreaOrBhkPatch(messageEn);
            return {
                doors: doors ? Number(doors[1]) : null,
                windows: windows ? Number(windows[1]) : null,
                areaSqft: areaPatch.areaSqft,
                bhk: areaPatch.bhk,
                valid: Boolean(doors || windows || areaPatch.valid),
            };
        }
        case 'plumbingDetails': {
            const bathrooms = messageEn.match(/(\d{1,2})\s*(?:bathrooms?|washrooms?|toilets?)/i);
            const points = messageEn.match(/(\d{1,4})\s*(?:points?|plumbing\s*points?|water\s*points?)/i);
            const areaPatch = extractAreaOrBhkPatch(messageEn);
            return {
                bathrooms: bathrooms ? Number(bathrooms[1]) : null,
                points: points ? Number(points[1]) : null,
                areaSqft: areaPatch.areaSqft,
                bhk: areaPatch.bhk,
                valid: Boolean(bathrooms || points || areaPatch.valid),
            };
        }
        case 'electricalPoints': {
            const points = messageEn.match(/(\d{1,4})\s*(?:points?|switch\s*points?|light\s*points?|fan\s*points?)/i);
            const areaPatch = extractAreaOrBhkPatch(messageEn);
            return {
                points: points ? Number(points[1]) : null,
                areaSqft: areaPatch.areaSqft,
                bhk: areaPatch.bhk,
                valid: Boolean(points || areaPatch.valid),
            };
        }
        case 'tilingArea': {
            const areaPatch = extractAreaOrBhkPatch(messageEn);
            return {
                areaSqft: areaPatch.areaSqft,
                bhk: areaPatch.bhk,
                valid: Boolean(areaPatch.valid),
            };
        }
        case 'areaOrScope': {
            const areaPatch = extractAreaOrBhkPatch(messageEn);
            return {
                areaSqft: areaPatch.areaSqft,
                bhk: areaPatch.bhk,
                valid: Boolean(areaPatch.valid),
            };
        }
        default:
            return { valid: false };
    }
};

const mergeEstimateContext = (baseContext = {}, patch = {}) => {
    const safeBase = sanitizeEstimateContext(baseContext);
    const safePatch = sanitizeEstimateContext(patch);
    const next = { ...safeBase };
    Object.entries(safePatch).forEach(([key, value]) => {
        if (SAFE_ESTIMATE_CONTEXT_KEYS.has(key) && value !== null && value !== undefined && value !== '') {
            next[key] = value;
        }
    });
    return next;
};

const generateSingleFollowUpQuestion = async ({ messageEn = '', context = {}, step = null, language = 'en' }) => {
    if (!step) return null;

    if (groq) {
        try {
            const prompt = `
Write one concise follow-up question for a KarigarConnect job estimate.
User query: ${messageEn}
Current context: ${JSON.stringify(context)}
Required field: ${step.field}
Base question: ${step.question(context)}

Rules:
- Ask only one question.
- Make it specific to the current job.
- Do not ask multiple details in a single sentence.
- Keep it short and natural.

Return strict JSON:
{ "question": "..." }`;

            const result = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                temperature: 0.35,
                max_tokens: 120,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: 'Return JSON only.' },
                    { role: 'user', content: prompt },
                ],
            });

            const parsed = JSON.parse(result?.choices?.[0]?.message?.content || '{}');
            const question = cleanText(parsed.question || '', 220);
            if (question) return question;
        } catch {
            // fallback below
        }
    }

    return step.question(context);
};

const formatNextEstimateQuestionPayload = async ({ messageEn = '', context = {}, step = null, user = null, language = 'en' }) => {
    const question = await generateSingleFollowUpQuestion({ messageEn, context, step, language });
    return {
        followUpRequired: true,
        followUpQuestion: question,
        followUpField: step?.field || null,
        followUpSkill: context.skill || null,
        followUpIntent: context.followUpIntent || 'job_estimate',
        followUpContext: context,
        ignoredAnswer: false,
    };
};

const generateDynamicFollowUpQuestion = async ({ messageEn = '', context = {}, missingFields = [] }) => {
    const plan = missingFields.includes('city')
        ? { field: 'city', question: () => 'Which city should I use for the rate calculation?' }
        : missingFields.includes('skill')
            ? { field: 'skill', question: () => 'Which skill or trade should I use for the rate calculation?' }
            : { field: 'areaOrScope', question: () => 'What is the approximate work area or project size so I can estimate accurately?' };

    return generateSingleFollowUpQuestion({ messageEn, context, step: plan });
};

const estimateSkillWorkforce = ({ skill = 'painter', areaSqft = 0, bhk = 0, walls = 0, points = 0, bathrooms = 0, doors = 0, windows = 0 }) => {
    const normalizedSkill = normalizeSkillKey(skill || 'other');
    const area = Math.max(0, Number(areaSqft || 0));
    const bhkCount = Math.max(0, Number(bhk || 0));
    const wallCount = Math.max(0, Number(walls || 0));
    const pointCount = Math.max(0, Number(points || 0));
    const bathroomCount = Math.max(0, Number(bathrooms || 0));
    const doorCount = Math.max(0, Number(doors || 0));
    const windowCount = Math.max(0, Number(windows || 0));

    const models = {
        painter: {
            label: 'painting',
            unit: 'sqft',
            workload: Math.max(60, area),
            coveragePerWorkerDay: 150,
            targetDays: area <= 250 ? 2 : area <= 700 ? 3 : 4,
            notes: 'Painting estimates use area coverage per day and adjust for wall complexity and BHK size.',
        },
        carpenter: {
            label: 'carpentry',
            unit: 'workload units',
            workload: Math.max(1, (area / 55) + (bhkCount * 2) + (wallCount * 0.5) + (doorCount * 0.75) + (windowCount * 0.5)),
            coveragePerWorkerDay: 3.2,
            targetDays: () => {
                const units = Math.max(1, (area / 55) + (bhkCount * 2) + (wallCount * 0.5) + (doorCount * 0.75) + (windowCount * 0.5));
                return units <= 6 ? 2 : units <= 12 ? 3 : 4;
            },
            notes: 'Carpentry math blends area, room count, and fittings so modular work does not undercount workers.',
        },
        plumber: {
            label: 'plumbing',
            unit: 'workload units',
            workload: Math.max(1, (area / 70) + (bhkCount * 1.75) + (bathroomCount * 2.75) + (pointCount * 0.12) + (wallCount * 0.35)),
            coveragePerWorkerDay: 4,
            targetDays: () => {
                const units = Math.max(1, (area / 70) + (bhkCount * 1.75) + (bathroomCount * 2.75) + (pointCount * 0.12) + (wallCount * 0.35));
                return units <= 5 ? 2 : units <= 10 ? 3 : 4;
            },
            notes: 'Plumbing math gives extra weight to bathrooms and explicit plumbing points.',
        },
        electrician: {
            label: 'electrical',
            unit: 'workload units',
            workload: Math.max(1, (area / 65) + (bhkCount * 2.25) + (pointCount * 0.18) + (wallCount * 0.45)),
            coveragePerWorkerDay: 4.5,
            targetDays: () => {
                const units = Math.max(1, (area / 65) + (bhkCount * 2.25) + (pointCount * 0.18) + (wallCount * 0.45));
                return units <= 6 ? 2 : units <= 12 ? 3 : 4;
            },
            notes: 'Electrical math uses switch/light point density and room count as the main workload driver.',
        },
        tiler: {
            label: 'tiling',
            unit: 'sqft',
            workload: Math.max(70, area + (wallCount * 14)),
            coveragePerWorkerDay: 95,
            targetDays: area <= 250 ? 2 : area <= 600 ? 3 : 4,
            notes: 'Tiling math gives a separate wall-load bump so wall tiling projects do not look undersized.',
        },
        default: {
            label: normalizedSkill,
            unit: 'sqft',
            workload: Math.max(60, area || 60),
            coveragePerWorkerDay: 120,
            targetDays: area <= 250 ? 2 : area <= 700 ? 3 : 4,
            notes: 'Generic fallback estimate used because this trade does not have a dedicated model.',
        },
    };

    const profile = models[normalizedSkill] || models.default;
    const targetDays = typeof profile.targetDays === 'function' ? profile.targetDays() : profile.targetDays;
    const workersNeeded = Math.max(1, Math.ceil(profile.workload / (profile.coveragePerWorkerDay * targetDays)));
    const estimatedDays = Math.max(1, Math.ceil(profile.workload / (profile.coveragePerWorkerDay * workersNeeded)));

    return {
        skill: normalizedSkill,
        label: profile.label,
        unit: profile.unit,
        workload: Math.round(profile.workload * 10) / 10,
        coveragePerWorkerDay: Math.round(profile.coveragePerWorkerDay * 10) / 10,
        workersNeeded,
        estimatedDays,
        notes: profile.notes,
        signals: {
            areaSqft: area,
            bhk: bhkCount,
            walls: wallCount,
            points: pointCount,
            bathrooms: bathroomCount,
            doors: doorCount,
            windows: windowCount,
        },
    };
};

const includeMaterialFromSkill = (skill) => ['painter', 'carpenter', 'plumber', 'electrician', 'tiler'].includes(skill);

const includeMaterialText = (include) => (include ? 'Material estimate is enabled for this trade.' : 'Labor-only estimate is the default for this trade.');

const calculateMaterialCost = ({ skill = 'painter', areaSqft = 0, city = '', points = 0, bathrooms = 0, includeMaterial = false }) => {
    if (!includeMaterial) return 0;

    const normalizedSkill = normalizeSkillKey(skill || 'other');
    const area = Math.max(0, Number(areaSqft || 0));
    const pointCount = Math.max(0, Number(points || 0));
    const bathroomCount = Math.max(0, Number(bathrooms || 0));
    const cityKey = normalizeCityKey(city || '');
    const cityBoost = ['mumbai', 'delhi', 'bangalore'].includes(cityKey) ? 1.18 : ['pune', 'hyderabad', 'chennai'].includes(cityKey) ? 1.08 : 1;

    const perTradeRate = {
        painter: area * (['mumbai', 'delhi', 'bangalore'].includes(cityKey) ? 30 : ['pune', 'hyderabad', 'chennai'].includes(cityKey) ? 26 : 23),
        carpenter: (area * 18) + (Math.max(0, pointCount) * 140) + (bathroomCount * 75),
        plumber: (pointCount * 210) + (bathroomCount * 260) + (area * 3),
        electrician: (pointCount * 185) + (area * 2.5),
        tiler: area * (['mumbai', 'delhi', 'bangalore'].includes(cityKey) ? 88 : ['pune', 'hyderabad', 'chennai'].includes(cityKey) ? 78 : 68),
        other: area * 0,
    };

    return Math.round((perTradeRate[normalizedSkill] || perTradeRate.other) * cityBoost);
};

const getRateForSkillCity = async ({ skill = '', city = '' }) => {
    const normalizedSkill = normalizeSkillKey(skill || 'other');
    const normalizedCity = normalizeCityKey(city || '');

    const estimate = await estimatePrice({
        skillKey: normalizedSkill,
        cityKey: normalizedCity,
        unit: 'day',
        quantity: 1,
        urgency: false,
        complexity: 'normal',
    });

    if (!estimate?.success || !estimate?.priceRange) {
        return {
            ok: false,
            dailyRate: 0,
            hourlyRate: 0,
            source: 'fallback',
            confidence: 0.4,
        };
    }

    const dailyRate = Math.round(Number(estimate.priceRange.expected || 0));
    const avgHours = Math.max(1, Number(estimate.priceRange.avgHours || 8));
    const hourlyRate = Math.round(dailyRate / avgHours);

    return {
        ok: true,
        dailyRate,
        hourlyRate,
        source: estimate.source || 'market_rate',
        confidence: Number(estimate.confidence || 0.6),
        p50: Math.round(Number(estimate.priceData?.p50 || dailyRate)),
        p75: Math.round(Number(estimate.priceData?.p75 || dailyRate)),
        p90: Math.round(Number(estimate.priceData?.p90 || dailyRate)),
    };
};

const buildEstimateResult = async ({ context = {} }) => {
    const skill = normalizeSkillKey(context.skill || 'other');
    const city = context.city || '';

    const rate = await getRateForSkillCity({ skill, city });

    const workforce = estimateSkillWorkforce({
        skill,
        areaSqft: context.areaSqft,
        bhk: context.bhk,
        walls: context.walls,
        points: context.points,
        bathrooms: context.bathrooms,
        doors: context.doors,
        windows: context.windows,
    });

    const workersNeeded = workforce.workersNeeded;
    const estimatedDays = workforce.estimatedDays;
    const laborCost = workersNeeded * estimatedDays * rate.dailyRate;
    const materialCost = calculateMaterialCost({
        skill,
        areaSqft: context.areaSqft,
        city,
        points: context.points,
        bathrooms: context.bathrooms,
        includeMaterial: context.includeMaterial,
    });

    return {
        skill,
        city,
        workersNeeded,
        estimatedDays,
        perWorkerPerDayRate: rate.dailyRate,
        perWorkerPerHourRate: rate.hourlyRate,
        laborCost,
        materialCost,
        totalEstimatedCost: laborCost + materialCost,
        rateSource: rate.source,
        rateConfidence: rate.confidence,
        rateBand: { p50: rate.p50, p75: rate.p75, p90: rate.p90 },
        tradeModel: {
            label: workforce.label,
            unit: workforce.unit,
            workload: workforce.workload,
            coveragePerWorkerDay: workforce.coveragePerWorkerDay,
            notes: workforce.notes,
            signals: workforce.signals,
        },
    };
};

const getRouteHelp = (route) => {
    const target = ROUTE_CATALOG.find((item) => item.route === route) || ROUTE_CATALOG.find((item) => item.route === '/client/dashboard');
    return {
        sourceType: 'gui-knowledge',
        facts: {
            route: target.route,
            label: target.label,
            purpose: target.purpose,
        },
        actions: [{ label: `Open ${target.label}`, route: target.route }],
    };
};

const listSections = () => ({
    sourceType: 'gui-knowledge',
    facts: {
        sections: ROUTE_CATALOG.map((item) => ({ label: item.label, route: item.route, purpose: item.purpose })),
    },
    actions: [{ label: 'Open Dashboard', route: '/client/dashboard' }],
});

const executeIntentTool = async ({ intent, user, currentRoute, messageEn, conversation, followUpState = null }) => {
    const clientId = user?._id;
    const clientCity = cleanText(user?.address?.city);

    const jobsByStatus = async (statusFilter) => Job.countDocuments({ postedBy: clientId, ...(statusFilter ? { status: statusFilter } : {}) });

    if (intent === 'count_jobs_total') return { sourceType: 'live-data', facts: { totalJobsPosted: await jobsByStatus() }, actions: [{ label: 'View My Jobs', route: '/client/job-manage' }] };
    if (intent === 'count_jobs_active') return { sourceType: 'live-data', facts: { activeJobs: await Job.countDocuments({ postedBy: clientId, status: { $in: ['open', 'proposal', 'scheduled', 'running'] } }) }, actions: [{ label: 'Track Active Jobs', route: '/client/job-manage' }] };
    if (intent === 'count_jobs_completed') return { sourceType: 'live-data', facts: { completedJobs: await jobsByStatus('completed') }, actions: [{ label: 'Open Job History', route: '/client/history' }] };
    if (intent === 'count_jobs_cancelled') return { sourceType: 'live-data', facts: { cancelledJobs: await Job.countDocuments({ postedBy: clientId, status: { $in: ['cancelled', 'cancelled_by_client'] } }) }, actions: [{ label: 'Open Job History', route: '/client/history' }] };
    if (intent === 'count_jobs_open') return { sourceType: 'live-data', facts: { openJobs: await jobsByStatus('open') }, actions: [{ label: 'Open Manage Jobs', route: '/client/job-manage' }] };
    if (intent === 'count_jobs_running') return { sourceType: 'live-data', facts: { runningJobs: await jobsByStatus('running') }, actions: [{ label: 'Open Manage Jobs', route: '/client/job-manage' }] };
    if (intent === 'count_jobs_scheduled') return { sourceType: 'live-data', facts: { scheduledJobs: await jobsByStatus('scheduled') }, actions: [{ label: 'Open Manage Jobs', route: '/client/job-manage' }] };
    if (intent === 'count_jobs_proposal') return { sourceType: 'live-data', facts: { proposalJobs: await jobsByStatus('proposal') }, actions: [{ label: 'Open Manage Jobs', route: '/client/job-manage' }] };

    if (intent === 'count_direct_hires_total') return { sourceType: 'live-data', facts: { directHiresTotal: await Job.countDocuments({ postedBy: clientId, hireMode: 'direct' }) }, actions: [{ label: 'Open Hired Workers', route: '/client/hired-workers' }] };
    if (intent === 'count_direct_hires_pending') return { sourceType: 'live-data', facts: { directHiresPending: await Job.countDocuments({ postedBy: clientId, hireMode: 'direct', 'directHire.paymentStatus': { $in: ['pending', 'partial'] } }) }, actions: [{ label: 'Open Hired Workers', route: '/client/hired-workers' }] };
    if (intent === 'count_direct_hires_paid') return { sourceType: 'live-data', facts: { directHiresPaid: await Job.countDocuments({ postedBy: clientId, hireMode: 'direct', 'directHire.paymentStatus': 'paid' }) }, actions: [{ label: 'Open Hired Workers', route: '/client/hired-workers' }] };

    if (intent === 'count_complaints_total') return { sourceType: 'live-data', facts: { complaintsTotal: await ClientComplaint.countDocuments({ filedBy: clientId }) }, actions: [{ label: 'Open Complaints', route: '/client/complaints' }] };

    if (intent === 'count_favorites') {
        const client = await User.findById(clientId).select('starredWorkers').lean();
        return { sourceType: 'live-data', facts: { favoritesCount: Array.isArray(client?.starredWorkers) ? client.starredWorkers.length : 0 }, actions: [{ label: 'Open Favorites', route: '/client/favorites' }] };
    }

    if (intent === 'count_groups_total') {
        const groupsCount = await Group.countDocuments({ $or: [{ creator: clientId }, { members: clientId }] });
        return { sourceType: 'live-data', facts: { groupsCount }, actions: [{ label: 'Open Groups', route: '/client/groups' }] };
    }

    if (intent === 'count_notifications_unread') {
        const unreadCount = await Notification.countDocuments({ userId: clientId, read: false });
        return { sourceType: 'live-data', facts: { unreadCount }, actions: [{ label: 'Open Dashboard', route: '/client/dashboard' }] };
    }

    if (intent === 'count_workers_city_total' || intent === 'count_workers_city_available') {
        const city = clientCity || '';
        if (!city) {
            return {
                sourceType: 'gui-knowledge',
                facts: { needsCity: true, message: 'Your city is not set in profile. Please update profile city to get exact worker count.' },
                actions: [{ label: 'Update Profile', route: '/client/profile' }],
            };
        }

        const baseFilter = { role: 'worker', verificationStatus: 'approved', 'address.city': cityRegexFromInput(city) };
        const totalWorkersInCity = await User.countDocuments(baseFilter);
        const availableWorkersInCity = await User.countDocuments({ ...baseFilter, availability: true });

        return {
            sourceType: 'live-data',
            facts: { city, totalWorkersInCity, availableWorkersInCity },
            actions: [{ label: 'Browse Workers', route: '/client/dashboard' }],
        };
    }

    if (intent === 'rate_skill_city_day' || intent === 'rate_skill_city_hour') {
        const textForSkill = [conversation.map((item) => item.text).join(' '), messageEn].join(' ');
        const skill = detectSkillFromText(textForSkill);
        const city = (await detectCityFromText(textForSkill, clientCity)) || '';

        if (!skill || !city) {
            const missing = [];
            if (!skill) missing.push('skill');
            if (!city) missing.push('city');
            const question = await generateDynamicFollowUpQuestion({
                messageEn,
                context: { skill, city },
                missingFields: missing,
            });

            return {
                sourceType: 'clarification',
                facts: {
                    followUpRequired: true,
                    followUpQuestion: question,
                    missingFields: missing,
                    followUpIntent: intent,
                },
                actions: [],
            };
        }

        const rate = await getRateForSkillCity({ skill, city });
        return {
            sourceType: 'live-data',
            facts: {
                skill,
                city,
                dailyRate: rate.dailyRate,
                hourlyRate: rate.hourlyRate,
                rateSource: rate.source,
                confidence: rate.confidence,
            },
            actions: [{ label: 'Open AI Tool', route: '/client/ai-assist' }],
        };
    }

    if (intent === 'job_estimate') {
        const estimateContext = await extractEstimateContext({
            messageEn,
            conversation,
            user,
        });

        if (followUpState?.contextSnapshot) {
            Object.assign(estimateContext, mergeEstimateContext(followUpState.contextSnapshot, estimateContext));
        }

        if (followUpState?.field) {
            const extractedPatch = await extractFieldPatch({
                field: followUpState.field,
                messageEn,
                context: estimateContext,
                user,
            });

            if (extractedPatch?.valid) {
                Object.assign(estimateContext, mergeEstimateContext(estimateContext, extractedPatch));
            } else {
                const fallbackStep = { field: followUpState.field, question: () => followUpState.question || 'Please share one more detail.' };
                const questionPayload = await formatNextEstimateQuestionPayload({
                    messageEn,
                    context: estimateContext,
                    step: fallbackStep,
                    user,
                });

                return {
                    sourceType: 'clarification',
                    facts: {
                        ...questionPayload,
                        contextSnapshot: estimateContext,
                        ignoredAnswer: true,
                    },
                    actions: [],
                };
            }
        }

        const nextStep = findNextEstimateStep(estimateContext.skill || followUpState?.skill || 'other', estimateContext);

        if (nextStep) {
            const questionPayload = await formatNextEstimateQuestionPayload({
                messageEn,
                context: estimateContext,
                step: nextStep,
                user,
            });

            return {
                sourceType: 'clarification',
                facts: {
                    ...questionPayload,
                    contextSnapshot: estimateContext,
                },
                actions: [],
            };
        }

        const estimate = await buildEstimateResult({ context: estimateContext });

        return {
            sourceType: 'live-data',
            facts: {
                followUpRequired: false,
                estimate,
                contextSnapshot: estimateContext,
            },
            actions: [{ label: 'Post Job', route: '/client/job-post' }, { label: 'Open AI Tool', route: '/client/ai-assist' }],
        };
    }

    if (intent === 'page_help') return getRouteHelp(currentRoute);
    if (intent === 'list_sections') return listSections();

    if (intent === 'faq_post_job') return { sourceType: 'gui-knowledge', facts: { message: 'Use Post Job page to add work details, budget, schedule, and location, then publish your job.' }, actions: [{ label: 'Go To Post Job', route: '/client/job-post' }] };
    if (intent === 'faq_manage_jobs') return { sourceType: 'gui-knowledge', facts: { message: 'Use Manage Jobs to review applicants, hire workers, track status, and close jobs.' }, actions: [{ label: 'Open Manage Jobs', route: '/client/job-manage' }] };
    if (intent === 'faq_direct_hire') return { sourceType: 'gui-knowledge', facts: { message: 'Use Hired Workers to monitor direct-hire requests, payment progress, and ticket status.' }, actions: [{ label: 'Open Hired Workers', route: '/client/hired-workers' }] };
    if (intent === 'faq_ai_tool') return { sourceType: 'gui-knowledge', facts: { message: 'AI Tool helps with detailed project analysis, budget planning, and design recommendations.' }, actions: [{ label: 'Open AI Tool', route: '/client/ai-assist' }] };
    if (intent === 'faq_complaints') return { sourceType: 'gui-knowledge', facts: { message: 'Use Complaints page to file, track, and review complaint status updates.' }, actions: [{ label: 'Open Complaints', route: '/client/complaints' }] };
    if (intent === 'faq_history') return { sourceType: 'gui-knowledge', facts: { message: 'History shows your completed and archived jobs for reference.' }, actions: [{ label: 'Open History', route: '/client/history' }] };
    if (intent === 'faq_favorites') return { sourceType: 'gui-knowledge', facts: { message: 'Favorites stores your starred workers for faster hiring.' }, actions: [{ label: 'Open Favorites', route: '/client/favorites' }] };
    if (intent === 'faq_groups') return { sourceType: 'gui-knowledge', facts: { message: 'Groups helps you discover worker teams for bigger projects.' }, actions: [{ label: 'Open Groups', route: '/client/groups' }] };

    if (intent === 'greeting') {
        return {
            sourceType: 'gui-knowledge',
            facts: {
                message: 'I can answer your client panel queries, live counts, worker/city rates, and dynamic job estimate questions.',
            },
            actions: [{ label: 'Open Dashboard', route: '/client/dashboard' }],
        };
    }

    return {
        sourceType: 'gui-knowledge',
        facts: {
            unsupported: true,
            message: 'I can answer client-panel, job, worker-count, rate, and estimation questions only.',
        },
        actions: [{ label: 'Open Dashboard', route: '/client/dashboard' }],
    };
};

const fallbackAnswerEn = ({ intent, toolResult }) => {
    const facts = toolResult?.facts || {};

    if (facts.followUpRequired) {
        return facts.followUpQuestion || 'Please share one more detail so I can estimate accurately.';
    }

    if (intent === 'count_jobs_total') return `You have posted ${facts.totalJobsPosted || 0} jobs in total.`;
    if (intent === 'count_jobs_active') return `You currently have ${facts.activeJobs || 0} active jobs.`;
    if (intent === 'count_jobs_completed') return `You have completed ${facts.completedJobs || 0} jobs.`;
    if (intent === 'count_jobs_cancelled') return `You have ${facts.cancelledJobs || 0} cancelled jobs.`;
    if (intent === 'count_jobs_open') return `You currently have ${facts.openJobs || 0} open jobs.`;
    if (intent === 'count_jobs_running') return `You currently have ${facts.runningJobs || 0} running jobs.`;
    if (intent === 'count_jobs_scheduled') return `You currently have ${facts.scheduledJobs || 0} scheduled jobs.`;
    if (intent === 'count_jobs_proposal') return `You currently have ${facts.proposalJobs || 0} jobs in proposal stage.`;

    if (intent === 'count_direct_hires_total') return `You have created ${facts.directHiresTotal || 0} direct-hire tickets.`;
    if (intent === 'count_direct_hires_pending') return `You have ${facts.directHiresPending || 0} direct-hire tickets with pending payment.`;
    if (intent === 'count_direct_hires_paid') return `You have ${facts.directHiresPaid || 0} fully paid direct-hire tickets.`;

    if (intent === 'count_complaints_total') return `You have filed ${facts.complaintsTotal || 0} complaints.`;
    if (intent === 'count_favorites') return `You have ${facts.favoritesCount || 0} workers in favorites.`;
    if (intent === 'count_groups_total') return `You are connected to ${facts.groupsCount || 0} groups.`;
    if (intent === 'count_notifications_unread') return `You currently have ${facts.unreadCount || 0} unread notifications.`;

    if (intent === 'count_workers_city_total' || intent === 'count_workers_city_available') {
        if (facts.needsCity) return facts.message;
        return `In ${facts.city}, there are ${facts.totalWorkersInCity || 0} approved workers, and ${facts.availableWorkersInCity || 0} are currently available.`;
    }

    if (intent === 'rate_skill_city_day') {
        return `Current estimated daily rate for ${facts.skill} in ${facts.city} is around ₹${Number(facts.dailyRate || 0).toLocaleString('en-IN')} per worker/day (source: ${facts.rateSource || 'rate data'}).`;
    }

    if (intent === 'rate_skill_city_hour') {
        return `Current estimated hourly rate for ${facts.skill} in ${facts.city} is around ₹${Number(facts.hourlyRate || 0).toLocaleString('en-IN')} per worker/hour (source: ${facts.rateSource || 'rate data'}).`;
    }

    if (intent === 'job_estimate' && facts.estimate) {
        const e = facts.estimate;
        return [
            `For ${e.skill} work in ${e.city}:`,
            `- Workers needed: ${e.workersNeeded}`,
            `- Estimated duration: ${e.estimatedDays} day(s)`,
            `- Current rate: ₹${Number(e.perWorkerPerDayRate || 0).toLocaleString('en-IN')} per worker/day`,
            `- Labor estimate: ₹${Number(e.laborCost || 0).toLocaleString('en-IN')}`,
            `- Material estimate: ₹${Number(e.materialCost || 0).toLocaleString('en-IN')}`,
            `- Total estimate: ₹${Number(e.totalEstimatedCost || 0).toLocaleString('en-IN')} (source: ${e.rateSource || 'rate data'})`,
        ].join('\n');
    }

    if (intent === 'page_help') return `${facts.label || 'This page'}: ${facts.purpose || 'Use this section for client operations.'}`;
    if (intent === 'list_sections') return `Client sections: ${(facts.sections || []).map((item) => item.label).join(', ')}.`;

    if (facts.message) return facts.message;
    return 'I can answer client-panel, rate, and job-estimation questions only.';
};

const composeWithGroq = async ({ messageEn = '', language = 'en', intent = 'unknown', toolResult = {}, currentRoute = '/client/dashboard' }) => {
    if (!groq) return null;

    const safeToolResult = sanitizeToolResultForLlm(toolResult);

    const prompt = `
You are KarigarConnect client chatbot.
Strict rules:
- Use only provided tool facts.
- Never reveal backend logs or confidential data.
- Keep answer concise and useful.
- If followUpRequired=true, ask user to answer the single follow-up question.
- Reply in ${language} (en/hi/mr code language preference already chosen by system).

Intent: ${intent}
Current route: ${currentRoute}
User question in English: ${messageEn}
Tool JSON: ${JSON.stringify(safeToolResult)}

Return strict JSON:
{ "answer":"string", "confidence":"high|medium|low" }`;

    try {
        const result = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            temperature: 0.2,
            max_tokens: 280,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: 'Return JSON only.' },
                { role: 'user', content: prompt },
            ],
        });

        const parsed = JSON.parse(result?.choices?.[0]?.message?.content || '{}');
        const answer = cleanText(parsed.answer || '', 1600);
        const confidence = ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium';
        if (!answer) return null;
        return { answer, confidence };
    } catch {
        return null;
    }
};

const ensureLanguage = async (textEn, language) => {
    if (language === 'en') return textEn;
    const translated = await translateText(textEn, language, 'en');
    return cleanText(translated.translatedText || textEn, 1800);
};

const logChatAudit = async ({ user, action, metadata }) => {
    try {
        await AuditLog.create({
            userId: user?._id || null,
            role: user?.role || 'client',
            action,
            metadata,
        });
    } catch {
        // no-op
    }
};

const maybeCleanupChatbotAuditLogs = async () => {
    try {
        const now = Date.now();
        if (now - lastAuditCleanupAt < CHATBOT_AUDIT_CLEANUP_INTERVAL_MS) return;
        lastAuditCleanupAt = now;

        const cutoff = new Date(now - (CHATBOT_AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000));
        await AuditLog.deleteMany({
            action: { $in: ['chatbot_query_served', 'chatbot_query_blocked'] },
            createdAt: { $lt: cutoff },
        });
    } catch {
        // no-op
    }
};

const getClientSuggestions = async ({ language = 'en' }) => {
    const lang = normalizeLanguage(language || 'en');
    if (lang === 'en') return SUGGESTIONS_EN;

    try {
        const translated = await translateBatch({ texts: SUGGESTIONS_EN, from: 'en', to: lang });
        return translated.map((item) => cleanText(item, 180));
    } catch {
        return SUGGESTIONS_EN;
    }
};

const handleClientChatQuery = async ({ user, message, currentRoute = '/client/dashboard', preferredLanguage = 'en', conversation = [], followUpState = null }) => {
    if (!CHATBOT_ENABLED) {
        return {
            status: 503,
            payload: {
                message: 'Chatbot is disabled by policy.',
            },
        };
    }

    await maybeCleanupChatbotAuditLogs();

    const safeMessage = cleanText(message, 800);
    const safeRoute = normalizeRoute(currentRoute);
    const safeConversation = normalizeConversation(conversation);

    if (!safeMessage) {
        return { status: 400, payload: { message: 'Question is required.' } };
    }

    const requestCount = bumpRateLimit(user?._id);
    if (requestCount > RATE_LIMIT_MAX) {
        return { status: 429, payload: { message: 'Too many chatbot requests. Please wait for a minute and try again.' } };
    }

    const language = normalizeLanguage(preferredLanguage || 'en');
    const blocked = matchesBlockedPattern(safeMessage);
    const routeIsSensitive = CHATBOT_DISABLE_ON_SECURE_ROUTES && isSensitiveRoute(safeRoute);
    const hasPrivateIntent = CHATBOT_BLOCK_PRIVATE_DATA && hasPrivateDataIntent(safeMessage);
    const hasPromptInjection = CHATBOT_BLOCK_PROMPT_INJECTION && hasPromptInjectionIntent(safeMessage);

    if (routeIsSensitive || hasPrivateIntent || hasPromptInjection) {
        const warningEn = routeIsSensitive
            ? 'Chatbot is disabled on secure pages such as payment, password, OTP, and security verification screens.'
            : hasPrivateIntent
                ? 'I cannot process OTP, password, payment, bank, card, or other private credentials. Please do not share sensitive data in chat.'
                : 'I cannot follow requests to bypass safety rules or reveal hidden/system instructions.';
        const warning = await ensureLanguage(warningEn, language);

        await logChatAudit({
            user,
            action: 'chatbot_query_blocked',
            metadata: {
                route: safeRoute,
                language,
                question: redactSensitiveText(safeMessage).slice(0, 200),
                reason: routeIsSensitive ? 'sensitive_route' : hasPrivateIntent ? 'private_data_pattern' : 'prompt_injection_pattern',
            },
        });

        return {
            status: 200,
            payload: {
                answer: warning,
                language,
                sourceType: 'policy-guard',
                confidence: 'high',
                intent: 'blocked',
                blocked: true,
                followUpRequired: false,
                followUpQuestion: null,
                followUpField: null,
                followUpSkill: null,
                followUpIntent: null,
                followUpContext: null,
                actions: [{ label: 'Open Dashboard', route: '/client/dashboard' }],
            },
        };
    }

    const detection = await detectAndTranslateToEnglish(safeMessage);
    const messageEn = cleanText(detection.textInEnglish || safeMessage);
    const safeFollowUpState = sanitizeFollowUpState(followUpState);

    if (blocked) {
        const warningEn = 'I cannot share confidential data, backend logs, secrets, or other users private information. Ask me about your client dashboard, jobs, workers, rates, or estimate questions.';
        const warning = await ensureLanguage(warningEn, language);

        await logChatAudit({
            user,
            action: 'chatbot_query_blocked',
            metadata: {
                route: safeRoute,
                language,
                question: redactSensitiveText(safeMessage).slice(0, 200),
                reason: 'blocked_pattern',
            },
        });

        return {
            status: 200,
            payload: {
                answer: warning,
                language,
                sourceType: 'policy-guard',
                confidence: 'high',
                intent: 'blocked',
                blocked: true,
                followUpRequired: false,
                    followUpQuestion: null,
                actions: [{ label: 'Open Dashboard', route: '/client/dashboard' }],
            },
        };
    }

    const ruleIntent = detectIntentByRules({ messageEn, currentRoute: safeRoute });
    const llmIntent = !safeFollowUpState?.intent && ruleIntent.intent === 'unknown' ? await classifyWithGroq({ messageEn, currentRoute: safeRoute }) : null;
    const finalIntent = safeFollowUpState?.intent || llmIntent?.intent || ruleIntent.intent;

    const toolResult = await executeIntentTool({
        intent: finalIntent,
        user,
        currentRoute: safeRoute,
        messageEn,
        conversation: safeConversation,
        followUpState: safeFollowUpState,
    });

    const followUpRequired = Boolean(toolResult?.facts?.followUpRequired);

    const shouldUseGroqComposer = !followUpRequired
        && !SENSITIVE_INTENTS.has(finalIntent)
        && (CHATBOT_ALLOW_LLM_FOR_LIVE_DATA || toolResult?.sourceType !== 'live-data');
    const groqComposed = shouldUseGroqComposer
        ? await composeWithGroq({
            messageEn,
            language,
            intent: finalIntent,
            toolResult,
            currentRoute: safeRoute,
        })
        : null;

    const answerEn = followUpRequired
        ? (toolResult?.facts?.followUpQuestion || fallbackAnswerEn({ intent: finalIntent, toolResult }))
        : (groqComposed?.answer || fallbackAnswerEn({ intent: finalIntent, toolResult }));
    const answer = language === 'en' ? answerEn : await ensureLanguage(answerEn, language);

    const payload = {
        answer,
        language,
        sourceType: toolResult?.sourceType || 'gui-knowledge',
        confidence: groqComposed?.confidence || llmIntent?.confidence || ruleIntent.confidence || 'medium',
        intent: finalIntent,
        blocked: false,
        followUpRequired,
        followUpQuestion: toolResult?.facts?.followUpQuestion || null,
        followUpField: toolResult?.facts?.followUpField || null,
        followUpSkill: toolResult?.facts?.followUpSkill || null,
        followUpIntent: toolResult?.facts?.followUpIntent || null,
        followUpContext: toolResult?.facts?.followUpContext || null,
        ignoredAnswer: Boolean(toolResult?.facts?.ignoredAnswer),
        estimate: toolResult?.facts?.estimate || null,
        actions: toolResult?.actions || [],
    };

    await logChatAudit({
        user,
        action: 'chatbot_query_served',
        metadata: {
            route: safeRoute,
            language,
            intent: payload.intent,
            sourceType: payload.sourceType,
            confidence: payload.confidence,
            followUpRequired,
            usedGroq: Boolean(groqComposed),
        },
    });

    return { status: 200, payload };
};

module.exports = {
    handleClientChatQuery,
    getClientSuggestions,
};
