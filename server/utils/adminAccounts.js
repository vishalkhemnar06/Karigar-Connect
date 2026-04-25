const User = require('../models/userModel');

const ENV_VAR_NAME = 'ADMIN_ACCOUNTS_JSON';
let hasLoggedMissingConfig = false;

const sanitizeMobile = (mobile) => String(mobile || '').replace(/\D/g, '').slice(-10);

const getConfiguredAdminAccounts = () => {
    try {
        const raw = process.env[ENV_VAR_NAME];

        if (!raw) {
            if (!hasLoggedMissingConfig) {
                console.warn(`⚠️ ${ENV_VAR_NAME} not found in .env. Admin login configuration is empty.`);
                hasLoggedMissingConfig = true;
            }
            return [];
        }

        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed) || parsed.length !== 4) {
            throw new Error('Exactly 4 admin accounts required');
        }

        const normalized = parsed.map((acc, idx) => ({
            name: String(acc?.name || `Admin ${idx + 1}`),
            mobile: sanitizeMobile(acc?.mobile),
            password: String(acc?.password || ''),
        }));

        // ✅ UPDATED VALIDATION (for your short credentials)
        const valid = normalized.every(
            acc => acc.mobile.length >= 4 && acc.password.length >= 4
        );

        const uniqueMobiles =
            new Set(normalized.map(acc => acc.mobile)).size === 4;

        if (!valid || !uniqueMobiles) {
            throw new Error('Invalid admin data in .env');
        }

        return normalized;
    } catch (err) {
        console.error('❌ Admin config error:', err.message);
        return [];
    }
};

const ensureAdminAccounts = async () => {
    const accounts = getConfiguredAdminAccounts();

    if (accounts.length === 0) {
        console.log("⚠️ No admin accounts created");
        return [];
    }

    for (let i = 0; i < accounts.length; i++) {
        const acc = accounts[i];

        const existing = await User.findOne({
            role: 'admin',
            mobile: acc.mobile,
        });

        if (existing) {
            // Update existing admin name if it has changed in .env file
            if (existing.name !== acc.name) {
                await User.findByIdAndUpdate(
                    existing._id,
                    { name: acc.name },
                    { new: true }
                );
                console.log(`🔄 Admin name updated: ${existing.name} → ${acc.name}`);
            }
            continue;
        }

        await User.create({
            userId: `ADMIN-${acc.mobile.slice(-4)}`,
            email: `admin-${acc.mobile}@karigarconnect.local`,
            role: 'admin',
            name: acc.name,
            mobile: acc.mobile,
            password: acc.password,
            verificationStatus: 'approved',
        });

        console.log(`✅ Admin created: ${acc.name}`);
    }

    return accounts;
};

module.exports = {
    getConfiguredAdminAccounts,
    ensureAdminAccounts,
};