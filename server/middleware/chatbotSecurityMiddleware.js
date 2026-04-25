const { normalizeLanguage } = require('../services/translationService');

const parseBooleanEnv = (value, defaultValue) => {
    if (value === undefined || value === null || value === '') return defaultValue;
    return !['0', 'false', 'no', 'off'].includes(String(value).toLowerCase());
};

const CHATBOT_ENABLED = parseBooleanEnv(process.env.CHATBOT_ENABLED, true);
const CHATBOT_DISABLE_ON_SECURE_ROUTES = parseBooleanEnv(process.env.CHATBOT_DISABLE_ON_SECURE_ROUTES, true);
const CHATBOT_BLOCK_PRIVATE_DATA = parseBooleanEnv(process.env.CHATBOT_BLOCK_PRIVATE_DATA, true);
const CHATBOT_BLOCK_PROMPT_INJECTION = parseBooleanEnv(process.env.CHATBOT_BLOCK_PROMPT_INJECTION, true);
const CHATBOT_BLOCK_SENSITIVE_PAYLOAD_KEYS = parseBooleanEnv(process.env.CHATBOT_BLOCK_SENSITIVE_PAYLOAD_KEYS, true);

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
    /bypass\s+(your\s+)?(safety|policy|guardrails?)/i,
    /developer\s+message/i,
    /jailbreak/i,
];

const SENSITIVE_KEY_PATTERNS = [
    /password/i,
    /otp/i,
    /pin/i,
    /cvv|cvc/i,
    /card/i,
    /bank/i,
    /ifsc/i,
    /security\s*answer|securityAnswer/i,
    /token/i,
    /secret/i,
];

const sanitizeText = (value, limit = 220) => String(value || '').trim().slice(0, limit);

const isSensitiveRoute = (route = '') => {
    const safeRoute = String(route || '').trim();
    return SENSITIVE_ROUTE_PATTERNS.some((pattern) => pattern.test(safeRoute));
};

const hasPrivateDataIntent = (message = '') => PRIVATE_DATA_PATTERNS.some((pattern) => pattern.test(String(message || '')));

const hasPromptInjectionIntent = (message = '') => PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(String(message || '')));

const containsSensitivePayloadKeys = (value, depth = 0, seen = new Set()) => {
    if (depth > 8 || value === null || value === undefined) return false;
    if (typeof value !== 'object') return false;
    if (seen.has(value)) return false;
    seen.add(value);

    if (Array.isArray(value)) {
        return value.some((item) => containsSensitivePayloadKeys(item, depth + 1, seen));
    }

    return Object.entries(value).some(([key, child]) => {
        const keyText = String(key || '');
        if (SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(keyText))) return true;
        return containsSensitivePayloadKeys(child, depth + 1, seen);
    });
};

const blockPayload = (language, answer, reason) => ({
    status: 200,
    body: {
        answer,
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
        ignoredAnswer: false,
        estimate: null,
        actions: [{ label: 'Open Dashboard', route: '/client/dashboard' }],
        reason,
    },
});

const chatbotSecurityGate = (req, res, next) => {
    if (!CHATBOT_ENABLED) {
        const language = normalizeLanguage(req.body?.preferredLanguage || 'en');
        const blocked = blockPayload(language, 'Chatbot is disabled by security policy.', 'chatbot_disabled');
        return res.status(blocked.status).json(blocked.body);
    }

    const body = req.body || {};
    const currentRoute = sanitizeText(body.currentRoute || '/client/dashboard', 120);
    const message = sanitizeText(body.message || '', 1200);
    const language = normalizeLanguage(body.preferredLanguage || 'en');

    if (CHATBOT_BLOCK_SENSITIVE_PAYLOAD_KEYS && containsSensitivePayloadKeys(body)) {
        const blocked = blockPayload(
            language,
            'I cannot process this request because sensitive payload fields were detected. Remove private credentials and try again.',
            'sensitive_payload_keys',
        );
        return res.status(blocked.status).json(blocked.body);
    }

    if (CHATBOT_DISABLE_ON_SECURE_ROUTES && isSensitiveRoute(currentRoute)) {
        const blocked = blockPayload(
            language,
            'Chatbot is disabled on secure pages such as payment, password, OTP, and security verification screens.',
            'sensitive_route',
        );
        return res.status(blocked.status).json(blocked.body);
    }

    if (CHATBOT_BLOCK_PRIVATE_DATA && hasPrivateDataIntent(message)) {
        const blocked = blockPayload(
            language,
            'I cannot process OTP, password, payment, bank, card, or other private credentials. Please do not share sensitive data in chat.',
            'private_data_pattern',
        );
        return res.status(blocked.status).json(blocked.body);
    }

    if (CHATBOT_BLOCK_PROMPT_INJECTION && hasPromptInjectionIntent(message)) {
        const blocked = blockPayload(
            language,
            'I cannot follow requests to bypass safety rules or reveal hidden/system instructions.',
            'prompt_injection_pattern',
        );
        return res.status(blocked.status).json(blocked.body);
    }

    return next();
};

module.exports = {
    chatbotSecurityGate,
    __test__: {
        isSensitiveRoute,
        hasPrivateDataIntent,
        hasPromptInjectionIntent,
        containsSensitivePayloadKeys,
    },
};
