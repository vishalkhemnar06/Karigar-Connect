const { translate } = require('@vitalets/google-translate-api');

const SUPPORTED_LANGS = new Set(['en', 'hi', 'mr']);
const CACHE_LIMIT = 1000;
const translationCache = new Map();

const normalizeLanguage = (lang = 'en') => {
    const normalized = String(lang || '').trim().toLowerCase();
    return SUPPORTED_LANGS.has(normalized) ? normalized : 'en';
};

const isLikelyNonEnglish = (text = '') => /[\u0900-\u097F]/.test(String(text));

const cacheGet = (key) => translationCache.get(key);

const cacheSet = (key, value) => {
    if (translationCache.size >= CACHE_LIMIT) {
        const firstKey = translationCache.keys().next().value;
        translationCache.delete(firstKey);
    }
    translationCache.set(key, value);
};

const safeTranslate = async ({ text = '', from = 'auto', to = 'en' }) => {
    const source = String(text || '').trim();
    const fromLang = String(from || 'auto').toLowerCase();
    const toLang = normalizeLanguage(to);

    if (!source) {
        return {
            translatedText: '',
            detectedLanguage: fromLang === 'auto' ? 'en' : normalizeLanguage(fromLang),
            usedFallback: false,
        };
    }

    if (toLang === 'en' && !isLikelyNonEnglish(source) && source.length < 4) {
        return { translatedText: source, detectedLanguage: 'en', usedFallback: false };
    }

    const cacheKey = `${fromLang}|${toLang}|${source}`;
    const cached = cacheGet(cacheKey);
    if (cached) return { ...cached };

    try {
        const result = await translate(source, { from: fromLang, to: toLang });
        const detectedLanguage = normalizeLanguage(
            result?.raw?.src || result?.from?.language?.iso || fromLang
        );
        const payload = {
            translatedText: result?.text || source,
            detectedLanguage,
            usedFallback: false,
        };
        cacheSet(cacheKey, payload);
        return { ...payload };
    } catch (error) {
        return {
            translatedText: source,
            detectedLanguage: fromLang === 'auto' ? (isLikelyNonEnglish(source) ? 'hi' : 'en') : normalizeLanguage(fromLang),
            usedFallback: true,
            errorMessage: error?.message || 'Translation failed',
        };
    }
};

const detectAndTranslateToEnglish = async (text = '') => {
    const result = await safeTranslate({ text, from: 'auto', to: 'en' });
    return {
        textInEnglish: result.translatedText,
        detectedLanguage: normalizeLanguage(result.detectedLanguage),
        usedFallback: result.usedFallback,
        errorMessage: result.errorMessage,
    };
};

const translateText = async (text = '', to = 'en', from = 'auto') => {
    const result = await safeTranslate({ text, from, to });
    return {
        translatedText: result.translatedText,
        usedFallback: result.usedFallback,
        errorMessage: result.errorMessage,
    };
};

const translateBatch = async ({ texts = [], to = 'en', from = 'auto' }) => {
    const values = Array.isArray(texts) ? texts : [];
    const unique = [...new Set(values.map((v) => String(v || '').trim()).filter(Boolean))];
    const translatedMap = new Map();

    await Promise.all(unique.map(async (value) => {
        const result = await safeTranslate({ text: value, from, to });
        translatedMap.set(value, result.translatedText);
    }));

    return values.map((value) => {
        const key = String(value || '').trim();
        return key ? (translatedMap.get(key) || value) : value;
    });
};

module.exports = {
    SUPPORTED_LANGS,
    normalizeLanguage,
    detectAndTranslateToEnglish,
    translateText,
    translateBatch,
};
