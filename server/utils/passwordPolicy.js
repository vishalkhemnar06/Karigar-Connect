const PASSWORD_POLICY_TEXT = 'Password must be at least 7 characters and include uppercase, lowercase, number, and special character.';

const getPasswordChecks = (password = '') => {
    const value = String(password);
    return {
        minLength: value.length >= 7,
        uppercase: /[A-Z]/.test(value),
        lowercase: /[a-z]/.test(value),
        number: /\d/.test(value),
        special: /[^A-Za-z0-9]/.test(value),
    };
};

const getStrengthLevel = (checks) => {
    const score = Object.values(checks).filter(Boolean).length;
    if (score <= 2) return 'LOW';
    if (score <= 4) return 'MEDIUM';
    return 'STRONG';
};

const validateStrongPassword = (password = '') => {
    const checks = getPasswordChecks(password);
    const isValid = Object.values(checks).every(Boolean);
    return {
        isValid,
        checks,
        level: getStrengthLevel(checks),
        message: isValid ? null : PASSWORD_POLICY_TEXT,
    };
};

module.exports = {
    PASSWORD_POLICY_TEXT,
    getPasswordChecks,
    getStrengthLevel,
    validateStrongPassword,
};
