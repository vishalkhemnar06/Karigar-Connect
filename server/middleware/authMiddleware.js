// middleware/authMiddleware.js
// FIXES:
//  1. CRITICAL — Admin 401 bug: Admin token signed as {mobile,role:'admin'} but
//     protect() read decoded.id (undefined) → User.findById(undefined) = null → 401.
//     FIX: detect admin role in token, inject synthetic req.user, skip DB lookup.
//  2. JWT_TOKEN env var renamed to JWT_SECRET throughout.
//  3. exports.admin role guard added (was MISSING — all admin routes were public).
//  4. exports.client role guard added (was MISSING).
//  5. exports.worker already existed — kept.

const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const { getConfiguredAdminAccounts } = require('../utils/adminAccounts');

// const LOCKED_SECTION_RULES = {
//     dashboard: ['/api/worker/all', '/api/worker/public', '/api/worker/leaderboard'],
//     favorites: ['/api/client/star/worker', '/api/client/workers'],
//     ai: ['/api/ai', '/api/client/ai'],
//     job_post: ['/api/client/jobs/post'],
//     history: ['/api/client/jobs'],
//     groups: ['/api/groups'],
// };

// const isDirectHireSafePath = (pathname = '') => (
//     pathname.startsWith('/api/client/direct-hires')
//     || pathname.startsWith('/api/client/notifications')
//     || pathname.startsWith('/api/client/profile')
//     || pathname.startsWith('/api/client/account')
// );

// const getLockedSectionHit = (pathname = '', sections = []) => {
//     const safePath = String(pathname || '');
//     if (!sections.length || isDirectHireSafePath(safePath)) return null;

//     for (const section of sections) {
//         const rules = LOCKED_SECTION_RULES[String(section || '').trim()];
//         if (!rules) continue;
//         if (rules.some((prefix) => safePath.startsWith(prefix))) return section;
//     }
//     return null;
// };

// ── PROTECT: Verify JWT, attach user to request ──────────────────────────────
exports.protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Admin / Worker / Client: fetch full Mongoose document from DB.
            // Admin tokens now also carry a real user id.
            const user = await User.findById(decoded.id).select('-password');
            if (!user) {
                return res.status(401).json({ message: 'Not authorized — user no longer exists' });
            }

            // const paymentLock = user.paymentLock || {};
            // const lockedSection = user.role === 'client'
            //     ? getLockedSectionHit(req.originalUrl || req.path || '', Array.isArray(paymentLock.sections) ? paymentLock.sections : [])
            //     : null;
            // if (lockedSection) {
            //     return res.status(403).json({
            //         message: 'Payment pending for a direct hire ticket. Access to this section is temporarily restricted until the worker is paid.',
            //         paymentLock: {
            //             active: Boolean(paymentLock.active),
            //             sections: Array.isArray(paymentLock.sections) ? paymentLock.sections : [],
            //             lockedSection,
            //             reason: String(paymentLock.reason || ''),
            //             updatedAt: paymentLock.updatedAt || null,
            //         },
            //     });
            // }

            req.user = user;
            return next();
        } catch (err) {
            console.error('Auth middleware error:', err.message);
            return res.status(401).json({ message: 'Not authorized — token invalid or expired' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized — no token provided' });
    }
};

// ── ROLE GUARD: Admin ─────────────────────────────────────────────────────────
exports.admin = (req, res, next) => {
    const allowedMobiles = getConfiguredAdminAccounts().map(acc => acc.mobile);
    if (req.user && req.user.role === 'admin' && allowedMobiles.includes(String(req.user.mobile || ''))) return next();
    return res.status(403).json({ message: 'Access denied — admins only' });
};

// ── ROLE GUARD: Worker ────────────────────────────────────────────────────────
exports.worker = (req, res, next) => {
    if (req.user && req.user.role === 'worker') return next();
    return res.status(403).json({ message: 'Access denied — workers only' });
};

// ── ROLE GUARD: Client ────────────────────────────────────────────────────────
exports.client = (req, res, next) => {
    if (req.user && req.user.role === 'client') return next();
    return res.status(403).json({ message: 'Access denied — clients only' });
};