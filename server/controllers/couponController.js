// server/controllers/couponController.js
const Coupon  = require('../models/couponModel');
const User    = require('../models/userModel');
const Job     = require('../models/jobModel');

// ── Generate a unique 8-char alphanumeric code ────────────────────────────────
const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
};

// ── Calculate discount based on leaderboard points + completed jobs ────────────
// Points >= 200  → 20%
// Points >= 100  → 15%
// Points >= 50   → 10%
// Points >= 25   → 5%
// Below 25 → not eligible
const calcDiscount = (points, completedJobs) => {
    const score = points + completedJobs * 5;
    if (score >= 200) return 20;
    if (score >= 100) return 15;
    if (score >= 50)  return 10;
    if (score >= 25)  return 5;
    return 0;
};

// ── GET MY COUPON (or generate if eligible) ───────────────────────────────────
exports.getOrGenerateCoupon = async (req, res) => {
    try {
        const worker = await User.findById(req.user.id).select('points name karigarId');
        if (!worker) return res.status(404).json({ message: 'Worker not found.' });

        const completedJobs = await Job.countDocuments({ assignedTo: worker._id, status: 'completed' });
        const discountPct   = calcDiscount(worker.points || 0, completedJobs);

        if (discountPct === 0)
            return res.status(403).json({
                message: 'Not eligible. Minimum 25 points (or equivalent score) required.',
                eligible: false,
            });

        const now      = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // Check if coupon already exists this month (used or unused)
        const existing = await Coupon.findOne({ worker: worker._id, monthKey })
            .populate('usedBy', 'shopName');

        if (existing) {
            return res.json({
                eligible:    true,
                discountPct,
                coupon:      existing,
                alreadyHave: true,
            });
        }

        // Generate new coupon
        let code;
        let attempts = 0;
        do {
            code = generateCode();
            attempts++;
        } while (await Coupon.findOne({ code }) && attempts < 10);

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const coupon = await Coupon.create({
            worker:      worker._id,
            code,
            discountPct,
            expiresAt,
            monthKey,
        });

        return res.status(201).json({ eligible: true, discountPct, coupon, alreadyHave: false });
    } catch (err) {
        console.error('getOrGenerateCoupon:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};

// ── GET COUPON HISTORY for worker ────────────────────────────────────────────
exports.getMyCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find({ worker: req.user.id })
            .populate('usedBy', 'shopName city')
            .sort({ createdAt: -1 });
        return res.json(coupons);
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};