const BaseRate = require('../models/baseRateModel');
const AuditLog = require('../models/auditLogModel');
const { WORKER_SKILLS } = require('../constants/workerSkills');
const { normalizeLanguage } = require('./translationService');
const fs = require('fs');
const path = require('path');

const cleanText = (value = '', limit = 1200) => String(value || '').trim().slice(0, limit);

const ROLE_LABELS = {
    worker: 'Worker',
    client: 'Client',
    shop: 'Shop Owner',
};

const ROLE_KEYWORDS = {
    worker: ['worker', 'karigar', 'labour', 'labor'],
    client: ['client', 'customer', 'home owner', 'homeowner'],
    shop: ['shop', 'shop owner', 'store', 'vendor'],
};

const BLOCKED_PATTERNS = [
    /admin\s*name/i,
    /admin\s*panel/i,
    /internal\s*(dashboard|data|config|api|logs?)/i,
    /backend\s*logs?/i,
    /server\s*logs?/i,
    /database|mongodb|sql\s*query/i,
    /token|jwt|secret|api\s*key|password|otp/i,
    /show\s+all\s+users/i,
    /other\s+user\s+data/i,
    /prompt\s*injection/i,
    /jailbreak/i,
];

const PUBLIC_PAGE_ACTIONS = [
    { label: 'FAQ', route: '/faq' },
    { label: 'About', route: '/home#about-us' },
    { label: 'Terms', route: '/terms-and-conditions' },
    { label: 'Privacy', route: '/privacy-policy' },
    { label: 'Check Status', route: '/check-status' },
    { label: 'Register', route: '/register' },
];

const STARTER_SUGGESTIONS = [
    'I am a worker. What features do I get?',
    'I am a client. What features are available?',
    'I am a shop owner. What can I do here?',
    'What documents are required for registration?',
    'How much time is required for verification?',
    'How many skills are available?',
    'How many cities are supported?',
    'What does your terms policy say about refunds/cancellations?',
    'What does your privacy policy say about biometric data?',
];

const DOC_SOURCES = [
    {
        id: 'terms',
        title: 'Terms & Conditions',
        route: '/terms-and-conditions',
        filePath: path.resolve(__dirname, '../../client/src/components/TermsAndConditions.jsx'),
        keywords: ['terms', 'condition', 'refund', 'cancellation', 'dispute', 'payment', 'liability', 'law', 'arbitration'],
    },
    {
        id: 'privacy',
        title: 'Privacy Policy',
        route: '/privacy-policy',
        filePath: path.resolve(__dirname, '../../client/src/components/PrivacyPolicy.jsx'),
        keywords: ['privacy', 'policy', 'data', 'biometric', 'face', 'retention', 'consent', 'cookies', 'grievance'],
    },
    {
        id: 'faq',
        title: 'FAQ',
        route: '/faq',
        filePath: path.resolve(__dirname, '../../client/src/constants/faqData.js'),
        keywords: ['faq', 'register', 'registration', 'verification', 'features', 'support', 'contact'],
    },
];

const knowledgeCache = new Map();

const STOP_WORDS = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'and', 'or', 'to', 'of', 'in', 'on', 'for',
    'with', 'by', 'from', 'at', 'it', 'this', 'that', 'be', 'as', 'if', 'how', 'what', 'when',
    'do', 'does', 'i', 'we', 'you', 'your', 'our', 'can', 'should', 'about', 'there', 'their',
    'they', 'who', 'which', 'will', 'would', 'could', 'any', 'all', 'into', 'under', 'than',
]);

const tokenize = (value = '') => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));

const stripMarkup = (value = '') => String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/&nbsp;|&amp;|&quot;|&#39;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const collectRegexMatches = (text = '', pattern) => {
    const matches = [];
    let m = pattern.exec(text);
    while (m) {
        const chunk = stripMarkup(m[1] || '');
        if (chunk.length >= 25) matches.push(chunk);
        m = pattern.exec(text);
    }
    return matches;
};

const extractKnowledgeChunks = (raw = '') => {
    const text = String(raw || '');
    const chunks = [];

    chunks.push(...collectRegexMatches(text, /<p[^>]*>([\s\S]*?)<\/p>/gi));
    chunks.push(...collectRegexMatches(text, /<li[^>]*>([\s\S]*?)<\/li>/gi));

    const fieldPattern = /\b(?:question|answer|examples|purpose|retention|description|how|detail|title)\s*:\s*['"]([\s\S]*?)['"]/gi;
    chunks.push(...collectRegexMatches(text, fieldPattern));

    const unique = [];
    const seen = new Set();
    for (const chunk of chunks) {
        const normalized = chunk.toLowerCase();
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        unique.push(cleanText(chunk, 600));
    }
    return unique;
};

const loadDocKnowledge = (doc) => {
    try {
        const stat = fs.statSync(doc.filePath);
        const last = knowledgeCache.get(doc.id);
        if (last && Number(last.mtimeMs) === Number(stat.mtimeMs)) return last;

        const raw = fs.readFileSync(doc.filePath, 'utf8');
        const chunks = extractKnowledgeChunks(raw);
        const payload = {
            ...doc,
            mtimeMs: stat.mtimeMs,
            chunks,
        };
        knowledgeCache.set(doc.id, payload);
        return payload;
    } catch {
        const fallback = {
            ...doc,
            mtimeMs: 0,
            chunks: [],
        };
        knowledgeCache.set(doc.id, fallback);
        return fallback;
    }
};

const getKnowledgeHits = (query = '', limit = 3, allowedDocIds = null) => {
    const q = cleanText(query, 600).toLowerCase();
    const queryTokens = tokenize(q);
    if (!queryTokens.length) return [];

    const scored = [];

    const allowSet = Array.isArray(allowedDocIds) && allowedDocIds.length
        ? new Set(allowedDocIds)
        : null;

    for (const doc of DOC_SOURCES) {
        if (allowSet && !allowSet.has(doc.id)) continue;
        const loaded = loadDocKnowledge(doc);
        if (!loaded.chunks.length) continue;

        for (const chunk of loaded.chunks) {
            const lower = chunk.toLowerCase();
            let score = 0;

            for (const token of queryTokens) {
                if (lower.includes(token)) score += 2;
            }

            for (const kw of loaded.keywords || []) {
                if (q.includes(kw)) score += 2;
            }

            if (score > 0) {
                scored.push({
                    docId: loaded.id,
                    docTitle: loaded.title,
                    route: loaded.route,
                    chunk,
                    score,
                });
            }
        }
    }

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
};

const buildPageScannedAnswer = (question = '') => {
    const hits = getKnowledgeHits(question, 3);
    if (!hits.length) return null;

    const answerLines = hits.map((item) => `- ${item.chunk}`);
    const uniqueActions = [];
    const seenRoutes = new Set();
    for (const item of hits) {
        if (!seenRoutes.has(item.route)) {
            seenRoutes.add(item.route);
            uniqueActions.push({ label: item.docTitle, route: item.route });
        }
    }

    return {
        answer: `From our pages, here is what I found:\n${answerLines.join('\n')}\n\nIf you want, I can give a shorter summary too.`,
        actions: uniqueActions,
    };
};

const buildTargetedPolicyAnswer = (question = '') => {
    const q = String(question || '').toLowerCase();
    let allowed = ['terms', 'privacy'];

    if (/(terms|condition|refund|cancellation|payment|dispute|arbitration|liability|law)/i.test(q)) {
        allowed = ['terms'];
    } else if (/(privacy|data|retention|biometric|face|cookie|consent|grievance)/i.test(q)) {
        allowed = ['privacy'];
    }

    const hits = getKnowledgeHits(question, 3, allowed);
    if (!hits.length) return null;

    const answerLines = hits.map((item) => `- ${item.chunk}`);
    const uniqueActions = [];
    const seenRoutes = new Set();
    for (const item of hits) {
        if (!seenRoutes.has(item.route)) {
            seenRoutes.add(item.route);
            uniqueActions.push({ label: item.docTitle, route: item.route });
        }
    }

    return {
        answer: `From our ${allowed.join('/')} page, here is what I found:\n${answerLines.join('\n')}\n\nIf you want, I can give a shorter summary too.`,
        actions: uniqueActions,
    };
};

const WORKER_FEATURES = [
    'Worker dashboard with jobs, bookings, and direct invites',
    'Profile, ID card, ratings, and skill visibility',
    'Groups, community, leaderboard, and history',
    'Complaint and support options from worker flows',
    'Live tracking support for active jobs',
];

const CLIENT_FEATURES = [
    'Client dashboard to post and manage jobs',
    'AI assist, favorites, groups, and history',
    'Track hired workers and live job progress',
    'Complaints flow and profile/security settings',
    'Nearby shops and worker discovery tools',
];

const SHOP_FEATURES = [
    'Shop registration and dashboard management',
    'Coupon verification and product activity tools',
    'Business profile, address, and shop identity management',
    'History and operational activity monitoring',
];

const REGISTRATION_DOCS = {
    worker: [
        'Profile photo',
        'One government ID proof: Aadhar Card / PAN Card / Voter ID / Driving License / Passport',
        'Clear recent ID card image is mandatory (not blurred, not cropped)',
        'Face verification (live photo match)',
    ],
    client: [
        'Profile photo',
        'ID proof upload',
        'Recommended: clear recent ID card image for smooth verification',
        'Face verification (live photo match)',
    ],
    shop: [
        'Owner photo',
        'Owner ID proof (Aadhar Card / PAN Card / Voter ID / Driving Licence / Passport)',
        'Shop photo and shop logo',
        'GSTN certificate (if available in your registration flow)',
        'Clear recent ID card image is mandatory for identity verification',
    ],
};

const isBlockedMessage = (message = '') => BLOCKED_PATTERNS.some((pattern) => pattern.test(message));

const detectRoleFromText = (message = '') => {
    const lower = String(message || '').toLowerCase();
    for (const [role, aliases] of Object.entries(ROLE_KEYWORDS)) {
        if (aliases.some((alias) => lower.includes(alias))) return role;
    }
    return null;
};

const normalizeRole = (value = '') => {
    const role = String(value || '').toLowerCase().trim();
    if (role === 'worker' || role === 'client' || role === 'shop') return role;
    return null;
};

const getSupportedCities = async () => {
    try {
        const rows = await BaseRate.aggregate([
            { $match: { isActive: true } },
            {
                $group: {
                    _id: '$cityKey',
                    city: { $first: '$city' },
                },
            },
            { $project: { _id: 0, city: 1 } },
            { $sort: { city: 1 } },
        ]);

        return (rows || [])
            .map((row) => cleanText(row?.city || '', 80))
            .filter(Boolean);
    } catch {
        return [];
    }
};

const listToLine = (items = []) => items.filter(Boolean).join(', ');

const buildRoleFeaturesAnswer = (role) => {
    if (role === 'worker') {
        return `Worker features:\n- ${WORKER_FEATURES.join('\n- ')}\n\nYou can also check FAQ/About/Terms/Privacy from the links below.`;
    }
    if (role === 'shop') {
        return `Shop Owner features:\n- ${SHOP_FEATURES.join('\n- ')}\n\nYou can also check FAQ/About/Terms/Privacy from the links below.`;
    }
    return `Client features:\n- ${CLIENT_FEATURES.join('\n- ')}\n\nYou can also check FAQ/About/Terms/Privacy from the links below.`;
};

const buildRegistrationDocAnswer = (role) => {
    if (!role) {
        return [
            'Select your role first for exact registration guidance.',
            'Common requirement for all roles: clear recent government ID card image is important for verification.',
            'Roles: Worker, Client, Shop Owner.',
        ].join(' ');
    }

    const docs = REGISTRATION_DOCS[role] || [];
    return `${ROLE_LABELS[role]} registration documents:\n- ${docs.join('\n- ')}`;
};

const buildFaqAnswer = (role) => {
    const roleLabel = role ? ROLE_LABELS[role] : 'your role';
    return `I can answer public FAQ and feature details for ${roleLabel}. Use the quick links for FAQ, About, Terms & Conditions, and Privacy Policy.`;
};

const buildVerificationAnswer = () => 'Verification usually completes within next 48 hours. If it is delayed, please contact support. You can check status from the home page using Check Status.';

const isPolicyOrRegistrationQuery = (text = '') => {
    const lower = String(text || '').toLowerCase();
    return /(terms|condition|privacy|policy|refund|cancellation|grievance|data|retention|consent|register|registration|document|verification|kyc|legal)/i.test(lower);
};

const isPolicyOnlyQuery = (text = '') => /(terms|condition|privacy|policy|refund|cancellation|grievance|data|retention|consent|legal|law|arbitration|liability)/i.test(String(text || ''));

const buildSkillsAnswer = () => {
    const skills = Array.isArray(WORKER_SKILLS) ? WORKER_SKILLS.filter(Boolean) : [];
    return `Total skills available: ${skills.length}. Skills: ${listToLine(skills)}.`;
};

const buildCitiesAnswer = async () => {
    const cities = await getSupportedCities();
    if (!cities.length) {
        return 'Supported city list is currently unavailable. Please check FAQ or contact support.';
    }
    return `Total supported cities: ${cities.length}. Cities: ${listToLine(cities)}.`;
};

const answerForUnknown = (role) => {
    if (!role) {
        return 'Welcome to KarigarConnect public assistant. Please tell me first: are you a Worker, Client, or Shop Owner?';
    }
    return `I can help with ${ROLE_LABELS[role]} features, registration documents, verification timeline, skills list, city coverage, and FAQ/legal pages.`;
};

const logGuestAudit = async ({ action, metadata = {}, requestMeta = {} }) => {
    try {
        await AuditLog.create({
            userId: null,
            role: 'guest',
            action,
            ipAddress: cleanText(requestMeta.ipAddress || '', 80) || null,
            userAgent: cleanText(requestMeta.userAgent || '', 240) || null,
            metadata,
        });
    } catch {
        // no-op
    }
};

const handleGuestChatQuery = async ({ message, preferredLanguage = 'en', role = null, currentRoute = '/home', requestMeta = {} }) => {
    const safeMessage = cleanText(message, 900);
    const language = normalizeLanguage(preferredLanguage || 'en');
    const resolvedRole = normalizeRole(role) || detectRoleFromText(safeMessage);

    if (!safeMessage) {
        return {
            status: 400,
            payload: { message: 'Question is required.' },
        };
    }

    if (isBlockedMessage(safeMessage)) {
        await logGuestAudit({
            action: 'guest_chatbot_query_blocked',
            metadata: {
                reason: 'blocked_pattern',
                currentRoute: cleanText(currentRoute, 80),
                questionPreview: cleanText(safeMessage, 180),
            },
            requestMeta,
        });

        return {
            status: 200,
            payload: {
                answer: 'I cannot share internal/admin/private data. I can only answer public platform questions for Worker, Client, and Shop Owner users.',
                language,
                sourceType: 'policy-guard',
                confidence: 'high',
                intent: 'blocked',
                blocked: true,
                role: resolvedRole,
                actions: PUBLIC_PAGE_ACTIONS,
            },
        };
    }

    const lower = safeMessage.toLowerCase();
    let intent = 'unknown';
    let answer = '';

    const scannedPolicy = isPolicyOnlyQuery(lower) ? buildTargetedPolicyAnswer(lower) : null;

    if (/(document|id\s*proof|registration\s*documents|required\s*documents|kyc)/i.test(lower)) {
        intent = 'registration_documents';
        answer = buildRegistrationDocAnswer(resolvedRole);
    } else if (scannedPolicy) {
        intent = 'page_scanned_policy';
        answer = scannedPolicy.answer;
    } else if (!resolvedRole && /(who\s+are\s+you|i\s+am|worker|client|shop)/i.test(lower)) {
        intent = 'role_selection';
        answer = 'Please choose your role so I can share exact details: Worker, Client, or Shop Owner.';
    } else if (!resolvedRole && !isPolicyOrRegistrationQuery(lower)) {
        intent = 'role_required';
        answer = answerForUnknown(null);
    } else if (/(feature|what\s+can\s+i\s+do|dashboard|benefit|faq)/i.test(lower)) {
        intent = 'role_features';
        answer = buildRoleFeaturesAnswer(resolvedRole);
    } else if (/(register|registration|proof)/i.test(lower) && resolvedRole) {
        intent = 'registration_documents';
        answer = buildRegistrationDocAnswer(resolvedRole);
    } else if (/(verification|how\s+much\s+time|how\s+long|status)/i.test(lower)) {
        intent = 'verification_timeline';
        answer = buildVerificationAnswer();
    } else if (/(how\s+many\s+skills|skills\s+list|list\s+of\s+skills|available\s+skills)/i.test(lower)) {
        intent = 'skills_list';
        answer = buildSkillsAnswer();
    } else if (/(how\s+many\s+cities|cities|supported\s+cities|city\s+list)/i.test(lower)) {
        intent = 'cities_list';
        answer = await buildCitiesAnswer();
    } else if (/(faq|about|terms|privacy|policy)/i.test(lower)) {
        intent = 'public_pages';
        answer = buildFaqAnswer(resolvedRole);
    } else {
        intent = 'fallback';
        answer = answerForUnknown(resolvedRole);
    }

    const payload = {
        answer,
        language,
        sourceType: 'gui-knowledge',
        confidence: intent === 'fallback' ? 'medium' : 'high',
        intent,
        blocked: false,
        role: resolvedRole,
        actions: scannedPolicy?.actions?.length ? scannedPolicy.actions : PUBLIC_PAGE_ACTIONS,
    };

    await logGuestAudit({
        action: 'guest_chatbot_query_served',
        metadata: {
            intent,
            role: resolvedRole,
            currentRoute: cleanText(currentRoute, 80),
            language,
            blocked: false,
        },
        requestMeta,
    });

    return { status: 200, payload };
};

const getGuestSuggestions = async () => STARTER_SUGGESTIONS;

const getGuestMeta = async () => {
    const cities = await getSupportedCities();
    const skills = Array.isArray(WORKER_SKILLS) ? WORKER_SKILLS.filter(Boolean) : [];

    return {
        skills,
        cities,
    };
};

module.exports = {
    handleGuestChatQuery,
    getGuestSuggestions,
    getGuestMeta,
};
