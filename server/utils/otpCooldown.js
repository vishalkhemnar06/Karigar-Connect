const OTP_COOLDOWN_MS = 5 * 60 * 1000;

const cooldownStore = new Map();

const normalizeKey = (value) => String(value || '').trim().toLowerCase();

const cleanupExpired = (now = Date.now()) => {
    for (const [key, expiresAt] of cooldownStore.entries()) {
        if (!expiresAt || expiresAt <= now) {
            cooldownStore.delete(key);
        }
    }
};

const getOtpCooldownState = (key) => {
    const normalizedKey = normalizeKey(key);
    if (!normalizedKey) {
        return { allowed: false, remainingMs: OTP_COOLDOWN_MS, reason: 'missing_key' };
    }

    const now = Date.now();
    cleanupExpired(now);

    const cooldownUntil = cooldownStore.get(normalizedKey);
    if (!cooldownUntil || cooldownUntil <= now) {
        return { allowed: true, remainingMs: 0, cooldownUntil: null };
    }

    return {
        allowed: false,
        remainingMs: cooldownUntil - now,
        cooldownUntil,
    };
};

const markOtpCooldown = (key) => {
    const normalizedKey = normalizeKey(key);
    if (!normalizedKey) return null;

    const cooldownUntil = Date.now() + OTP_COOLDOWN_MS;
    cooldownStore.set(normalizedKey, cooldownUntil);
    return cooldownUntil;
};

const clearOtpCooldown = (key) => {
    const normalizedKey = normalizeKey(key);
    if (!normalizedKey) return false;
    return cooldownStore.delete(normalizedKey);
};

const formatOtpCooldownMessage = (remainingMs) => {
    const seconds = Math.max(1, Math.ceil(Number(remainingMs || 0) / 1000));
    if (seconds >= 60) {
        const minutes = Math.ceil(seconds / 60);
        return `Please wait ${minutes} minute${minutes === 1 ? '' : 's'} before requesting a new OTP.`;
    }
    return `Please wait ${seconds} second${seconds === 1 ? '' : 's'} before requesting a new OTP.`;
};

module.exports = {
    OTP_COOLDOWN_MS,
    getOtpCooldownState,
    markOtpCooldown,
    clearOtpCooldown,
    formatOtpCooldownMessage,
};