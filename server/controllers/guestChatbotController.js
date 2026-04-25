const { normalizeLanguage } = require('../services/translationService');
const {
    handleGuestChatQuery,
    getGuestSuggestions,
    getGuestMeta,
} = require('../services/guestChatbotService');

const cleanText = (value = '', limit = 2200) => String(value || '').trim().slice(0, limit);

const sanitizeGuestActions = (actions = []) => (
    Array.isArray(actions)
        ? actions
            .filter((item) => item && typeof item === 'object')
            .map((item) => ({
                label: cleanText(item.label || 'Open', 40),
                route: String(item.route || '/home').startsWith('/') ? String(item.route || '/home') : '/home',
            }))
            .slice(0, 8)
        : []
);

const sanitizeGuestPayload = (payload = {}, fallbackMessage = 'Guest chatbot failed to process this query.') => {
    if (!payload || typeof payload !== 'object') {
        return { message: fallbackMessage };
    }

    const message = cleanText(payload.message || '', 280);
    const answer = cleanText(payload.answer || '', 2200);

    if (!answer && message) return { message };

    return {
        answer: answer || fallbackMessage,
        language: normalizeLanguage(payload.language || 'en'),
        sourceType: ['policy-guard', 'clarification', 'gui-knowledge', 'error'].includes(payload.sourceType)
            ? payload.sourceType
            : 'gui-knowledge',
        confidence: ['high', 'medium', 'low'].includes(payload.confidence) ? payload.confidence : 'medium',
        intent: cleanText(payload.intent || 'unknown', 80),
        blocked: Boolean(payload.blocked),
        role: cleanText(payload.role || '', 20) || null,
        actions: sanitizeGuestActions(payload.actions),
    };
};

exports.guestChatQuery = async (req, res) => {
    try {
        const {
            message = '',
            preferredLanguage = 'en',
            role = null,
            currentRoute = '/home',
            conversation = [],
        } = req.body || {};

        const result = await handleGuestChatQuery({
            message,
            preferredLanguage,
            role,
            currentRoute,
            conversation,
            requestMeta: {
                ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
                userAgent: req.get('user-agent') || '',
            },
        });

        const status = result?.status || 200;
        const safePayload = sanitizeGuestPayload(result?.payload || {}, 'Guest chatbot failed to process this query.');
        return res.status(status).json(safePayload);
    } catch (error) {
        console.error('guestChatQuery error:', error.message);
        return res.status(500).json({ message: 'Guest chatbot failed to process this query.' });
    }
};

exports.guestChatSuggestions = async (req, res) => {
    try {
        const preferredLanguage = normalizeLanguage(req.query?.lang || 'en');
        const suggestions = await getGuestSuggestions({ language: preferredLanguage });
        return res.status(200).json({ suggestions, language: preferredLanguage });
    } catch (error) {
        console.error('guestChatSuggestions error:', error.message);
        return res.status(500).json({ message: 'Unable to load guest chatbot suggestions.' });
    }
};

exports.guestChatMeta = async (_req, res) => {
    try {
        const meta = await getGuestMeta();
        return res.status(200).json(meta);
    } catch (error) {
        console.error('guestChatMeta error:', error.message);
        return res.status(500).json({ message: 'Unable to load guest chatbot metadata.' });
    }
};
