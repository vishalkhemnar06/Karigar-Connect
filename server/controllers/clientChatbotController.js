const { handleClientChatQuery, getClientSuggestions } = require('../services/clientChatbotService');
const { normalizeLanguage } = require('../services/translationService');

const cleanText = (value = '', limit = 1600) => String(value || '').trim().slice(0, limit);
const clampNumber = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(min, Math.min(max, n));
};

const ALLOWED_SOURCE_TYPES = new Set(['policy-guard', 'clarification', 'live-data', 'gui-knowledge', 'error']);
const ALLOWED_CONFIDENCE = new Set(['high', 'medium', 'low']);

const sanitizeActions = (actions = []) => (
    Array.isArray(actions)
        ? actions
            .filter((item) => item && typeof item === 'object')
            .map((item) => ({
                label: cleanText(item.label || 'Open', 40),
                route: String(item.route || '/client/dashboard').startsWith('/client/') ? item.route : '/client/dashboard',
            }))
            .slice(0, 5)
        : []
);

const sanitizeEstimate = (estimate) => {
    if (!estimate || typeof estimate !== 'object') return null;
    return {
        skill: cleanText(estimate.skill || '', 40),
        city: cleanText(estimate.city || '', 80),
        workersNeeded: clampNumber(estimate.workersNeeded, 0, 1000),
        estimatedDays: clampNumber(estimate.estimatedDays, 0, 365),
        perWorkerPerDayRate: clampNumber(estimate.perWorkerPerDayRate, 0, 1e7),
        perWorkerPerHourRate: clampNumber(estimate.perWorkerPerHourRate, 0, 1e6),
        laborCost: clampNumber(estimate.laborCost, 0, 1e9),
        materialCost: clampNumber(estimate.materialCost, 0, 1e9),
        totalEstimatedCost: clampNumber(estimate.totalEstimatedCost, 0, 1e9),
        rateSource: cleanText(estimate.rateSource || '', 40),
        rateConfidence: clampNumber(estimate.rateConfidence, 0, 1),
        rateBand: estimate.rateBand && typeof estimate.rateBand === 'object'
            ? {
                p50: clampNumber(estimate.rateBand.p50, 0, 1e7),
                p75: clampNumber(estimate.rateBand.p75, 0, 1e7),
                p90: clampNumber(estimate.rateBand.p90, 0, 1e7),
            }
            : null,
    };
};

const sanitizeChatbotPayload = (payload = {}, fallbackMessage = 'Chatbot failed to process this query.') => {
    if (!payload || typeof payload !== 'object') {
        return { message: fallbackMessage };
    }

    const message = cleanText(payload.message || '', 300);
    const answer = cleanText(payload.answer || '', 2200);

    if (!answer && message) {
        return { message };
    }

    return {
        answer: answer || fallbackMessage,
        language: normalizeLanguage(payload.language || 'en'),
        sourceType: ALLOWED_SOURCE_TYPES.has(payload.sourceType) ? payload.sourceType : 'gui-knowledge',
        confidence: ALLOWED_CONFIDENCE.has(payload.confidence) ? payload.confidence : 'medium',
        intent: cleanText(payload.intent || 'unknown', 60),
        blocked: Boolean(payload.blocked),
        followUpRequired: Boolean(payload.followUpRequired),
        followUpQuestion: cleanText(payload.followUpQuestion || '', 260) || null,
        followUpField: cleanText(payload.followUpField || '', 60) || null,
        followUpSkill: cleanText(payload.followUpSkill || '', 40) || null,
        followUpIntent: cleanText(payload.followUpIntent || '', 60) || null,
        followUpContext: payload.followUpContext && typeof payload.followUpContext === 'object' ? payload.followUpContext : null,
        ignoredAnswer: Boolean(payload.ignoredAnswer),
        estimate: sanitizeEstimate(payload.estimate),
        actions: sanitizeActions(payload.actions),
    };
};

exports.clientChatQuery = async (req, res) => {
    try {
        const { message = '', currentRoute = '', preferredLanguage = '', conversation = [], followUpState = null } = req.body || {};
        const result = await handleClientChatQuery({
            user: req.user,
            message,
            currentRoute,
            preferredLanguage,
            conversation,
            followUpState,
        });

        const status = result?.status || 200;
        const safePayload = sanitizeChatbotPayload(result?.payload || {}, 'Chatbot failed to process this query.');
        return res.status(status).json(safePayload);
    } catch (error) {
        console.error('clientChatQuery error:', error.message);
        return res.status(500).json({ message: 'Chatbot failed to process this query.' });
    }
};

exports.clientChatSuggestions = async (req, res) => {
    try {
        const preferredLanguage = normalizeLanguage(req.query?.lang || 'en');
        const suggestions = await getClientSuggestions({ language: preferredLanguage });
        return res.status(200).json({ suggestions, language: preferredLanguage });
    } catch (error) {
        console.error('clientChatSuggestions error:', error.message);
        return res.status(500).json({ message: 'Unable to load chatbot suggestions.' });
    }
};
