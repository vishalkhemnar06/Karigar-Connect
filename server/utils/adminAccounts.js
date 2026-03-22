const User = require('../models/userModel');

const DEFAULT_ADMIN_ACCOUNTS = [
    { name: 'Admin One', mobile: '1234', password: '1234' },
    { name: 'Admin Two', mobile: '12345', password: '12345' },
    { name: 'Admin Three', mobile: '123456', password: '123456' },
    { name: 'Admin Four', mobile: '1234567', password: '1234567' },
];

const sanitizeMobile = (mobile) => String(mobile || '').replace(/\D/g, '').slice(-10);

const getConfiguredAdminAccounts = () => {
    try {
        const raw = process.env.ADMIN_ACCOUNTS_JSON;
        if (!raw) return DEFAULT_ADMIN_ACCOUNTS;

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length !== 4) return DEFAULT_ADMIN_ACCOUNTS;

        const normalized = parsed.map((acc, idx) => ({
            name: String(acc?.name || `Admin ${idx + 1}`),
            mobile: sanitizeMobile(acc?.mobile),
            password: String(acc?.password || ''),
        }));

        const valid = normalized.every(acc => acc.mobile.length === 10 && acc.password.length >= 6);
        const uniqueMobiles = new Set(normalized.map(acc => acc.mobile)).size === 4;
        if (!valid || !uniqueMobiles) return DEFAULT_ADMIN_ACCOUNTS;

        return normalized;
    } catch {
        return DEFAULT_ADMIN_ACCOUNTS;
    }
};

const ensureAdminAccounts = async () => {
    const accounts = getConfiguredAdminAccounts();

    for (let i = 0; i < accounts.length; i += 1) {
        const acc = accounts[i];
        const existing = await User.findOne({ role: 'admin', mobile: acc.mobile });
        if (existing) continue;

        await User.create({
            karigarId: `ADMIN-${acc.mobile.slice(-4)}`,
            email: `admin-${acc.mobile}@karigarconnect.local`,
            role: 'admin',
            name: acc.name,
            mobile: acc.mobile,
            password: acc.password,
            verificationStatus: 'approved',
        });
    }

    return accounts;
};

module.exports = {
    getConfiguredAdminAccounts,
    ensureAdminAccounts,
};
