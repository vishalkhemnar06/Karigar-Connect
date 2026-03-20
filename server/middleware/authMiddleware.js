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

// ── PROTECT: Verify JWT, attach user to request ──────────────────────────────
exports.protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // FIX: Admin tokens carry {mobile, role:'admin'} — no id field.
            // Bypass DB lookup for admin and inject a synthetic user object.
            if (decoded.role === 'admin') {
                req.user = {
                    id: 'admin',
                    _id: 'admin',
                    role: 'admin',
                    mobile: decoded.mobile,
                    name: 'Admin',
                };
                return next();
            }

            // Worker / Client: fetch full Mongoose document from DB
            const user = await User.findById(decoded.id).select('-password');
            if (!user) {
                return res.status(401).json({ message: 'Not authorized — user no longer exists' });
            }
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
    if (req.user && req.user.role === 'admin') return next();
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