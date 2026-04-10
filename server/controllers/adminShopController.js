// server/controllers/adminShopController.js
const Shop        = require('../models/shopModel');
const Coupon      = require('../models/couponModel');
const Transaction = require('../models/transactionModel');
const twilio      = require('twilio');

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const sendSms = async (to, body) => {
    try {
        await twilioClient.messages.create({
            body,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: to.startsWith('+') ? to : `+91${to}`,
        });
    } catch (err) {
        console.error('SMS failed:', err.message);
    }
};

// ── GET ALL SHOPS ─────────────────────────────────────────────────────────────
exports.getAllShops = async (req, res) => {
    try {
        const shops = await Shop.find({}).sort({ createdAt: -1 }).select('-password');
        return res.json(shops);
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

// ── GET SHOP BY ID ────────────────────────────────────────────────────────────
exports.getShopById = async (req, res) => {
    try {
        const shop = await Shop.findById(req.params.id).select('-password');
        if (!shop) return res.status(404).json({ message: 'Not found.' });
        return res.json(shop);
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

// ── APPROVE SHOP ──────────────────────────────────────────────────────────────
exports.approveShop = async (req, res) => {
    try {
        const shop = await Shop.findById(req.params.id);
        if (!shop) return res.status(404).json({ message: 'Shop not found.' });

        shop.verificationStatus = 'approved';
        shop.approvedAt = new Date();
        shop.rejectionReason = null;
        await shop.save({ validateBeforeSave: false });

        await sendSms(
            shop.mobile,
            `Congratulations ${shop.ownerName}! Your shop "${shop.shopName}" has been approved on KarigarConnect. You can now login to your dashboard.`
        );

        return res.json({ message: 'Shop approved.', shop });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

// ── REJECT SHOP (permanently delete from DB) ──────────────────────────────────
exports.rejectShop = async (req, res) => {
    try {
        const { reason } = req.body;
        const shop = await Shop.findById(req.params.id);
        if (!shop) return res.status(404).json({ message: 'Shop not found.' });

        const mobile    = shop.mobile;
        const ownerName = shop.ownerName;
        const shopName  = shop.shopName;

        // SMS before delete
        await sendSms(
            mobile,
            `Hi ${ownerName}, your shop "${shopName}" registration on KarigarConnect has been rejected. Reason: ${reason || 'Does not meet requirements'}. Contact support for more info.`
        );

        // Permanently delete
        await Shop.findByIdAndDelete(req.params.id);

        return res.json({ message: 'Shop rejected and deleted.' });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

// ── BLOCK SHOP ────────────────────────────────────────────────────────────────
exports.blockShop = async (req, res) => {
    try {
        const shop = await Shop.findByIdAndUpdate(
            req.params.id,
            { verificationStatus: 'blocked' },
            { new: true }
        );
        if (!shop) return res.status(404).json({ message: 'Not found.' });
        await sendSms(shop.mobile, `Hi ${shop.ownerName}, your shop "${shop.shopName}" has been blocked on KarigarConnect. Contact support for details.`);
        return res.json({ message: 'Shop blocked.', shop });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

// ── DELETE SHOP ───────────────────────────────────────────────────────────────
exports.deleteShop = async (req, res) => {
    try {
        await Shop.findByIdAndDelete(req.params.id);
        return res.json({ message: 'Shop deleted.' });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

// ── ALL COUPONS ───────────────────────────────────────────────────────────────
exports.getAllCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find({})
           .populate('worker', 'name userId karigarId photo')
            .populate('usedBy', 'shopName')
            .sort({ createdAt: -1 });
        return res.json(coupons);
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

// ── COUPON USAGE HISTORY (all transactions) ───────────────────────────────────
exports.getCouponUsageHistory = async (req, res) => {
    try {
        const txns = await Transaction.find({})
            .populate('shop',    'shopName ownerName')
           .populate('worker', 'name userId karigarId photo')
            .populate('product', 'name price image')
            .populate('coupon',  'code discountPct')
            .sort({ createdAt: -1 });
        return res.json(txns);
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

// ── UNCLAIMED COUPONS (issued but not used) ───────────────────────────────────
exports.getUnclaimedCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find({ isUsed: false, expiresAt: { $gt: new Date() } })
           .populate('worker', 'name userId karigarId photo')
            .sort({ createdAt: -1 });
        return res.json(coupons);
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};