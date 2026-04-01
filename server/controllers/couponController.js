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

// ── GET COUPON DETAILS BY CODE (for coupon history lookup) ───────────────────
exports.getCouponByCode = async (req, res) => {
    try {
        const { code } = req.params;
        const Transaction = require('../models/transactionModel');
        const Product = require('../models/productModel');
        const Rating = require('../models/ratingModel');
        
        const coupon = await Coupon.findOne({ code: code.toUpperCase() })
            .populate('worker', 'name karigarId')
            .populate('usedBy', 'shopName shopLogo shopPhoto ownerName mobile city address category');
        
        if (!coupon) {
            return res.status(404).json({ message: 'Coupon not found.' });
        }

        // Return basic info if coupon not used yet
        if (!coupon.isUsed) {
            return res.json({
                code: coupon.code,
                discountPct: coupon.discountPct,
                isUsed: false,
                expiresAt: coupon.expiresAt,
                message: 'This coupon has not been used yet.',
            });
        }

        // Fetch transaction and product details for used coupon
        const transaction = await Transaction.findOne({ coupon: coupon._id })
            .populate('product', 'name image price');
        
        let productDetails = null;
        let productRating = null;

        if (transaction && transaction.product) {
            // Get average rating for the product from all users
            const ratings = await Rating.find({ 'jobId': { $exists: true } })
                .select('stars');
            const avgRating = ratings.length > 0 
                ? (ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length).toFixed(1)
                : null;

            productDetails = {
                productName: transaction.product.name,
                productImage: transaction.productPhoto || transaction.product.image,
                productPrice: transaction.originalPrice,
                discountAmount: transaction.discountAmount,
                finalPrice: transaction.finalPrice,
            };

            productRating = avgRating;
        }

        // Return detailed info if coupon is used
        return res.json({
            code: coupon.code,
            discountPct: coupon.discountPct,
            isUsed: true,
            usedAt: coupon.usedAt,
            expiresAt: coupon.expiresAt,
            shop: coupon.usedBy ? {
                shopName: coupon.usedBy.shopName,
                shopLogo: coupon.usedBy.shopLogo,
                shopPhoto: coupon.usedBy.shopPhoto,
                ownerName: coupon.usedBy.ownerName,
                mobile: coupon.usedBy.mobile,
                city: coupon.usedBy.city,
                address: coupon.usedBy.address,
                category: coupon.usedBy.category,
            } : null,
            product: productDetails,
            productRating: productRating,
        });
    } catch (err) {
        console.error('getCouponByCode:', err);
        return res.status(500).json({ message: 'Failed to retrieve coupon.' });
    }
};