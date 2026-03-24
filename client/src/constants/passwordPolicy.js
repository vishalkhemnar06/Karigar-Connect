export const PASSWORD_POLICY_TEXT =
    'At least 7 characters with uppercase, lowercase, number, and special character.';

export const getPasswordChecks = (password = '') => {
    const value = String(password);
    return {
        minLength: value.length >= 7,
        uppercase: /[A-Z]/.test(value),
        lowercase: /[a-z]/.test(value),
        number: /\d/.test(value),
        special: /[^A-Za-z0-9]/.test(value),
    };
};

export const getPasswordStrength = (password = '') => {
    if (!password) {
        return { label: 'Low', color: 'bg-red-500', text: 'text-red-600', width: '0%' };
    }

    const checks = getPasswordChecks(password);
    const score = Object.values(checks).filter(Boolean).length;

    if (score <= 2) {
        return { label: 'Low', color: 'bg-red-500', text: 'text-red-600', width: '33%' };
    }
    if (score <= 4) {
        return { label: 'Medium', color: 'bg-yellow-500', text: 'text-yellow-700', width: '66%' };
    }

    return { label: 'Strong', color: 'bg-green-500', text: 'text-green-700', width: '100%' };
};

export const isStrongPassword = (password = '') =>
    Object.values(getPasswordChecks(password)).every(Boolean);
