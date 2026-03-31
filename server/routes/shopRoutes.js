// server/routes/shopRoutes.js
// FIXED:
//   - Multer destination now uses path.join(__dirname, '..', 'uploads')
//     so files land in server/uploads/ (same folder Express serves statically)
//   - Stored file path uses forward slashes only (no Windows backslash bug):
//     req.file.path is normalised before saving to DB in shopAuthController
//   - multer filename uses Date.now() + original name (spaces replaced)

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const shopAuth = require('../controllers/shopAuthController');
const shopCtrl = require('../controllers/shopController');
const { protectShop } = require('../middleware/shopAuthMiddleware');

// ── Multer — saves directly to uploads/ root ──────────────────────────────────
// Files will be accessible at:  GET /uploads/<filename>
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename:    (_req, file, cb) => {
        const safe = file.originalname.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
        cb(null, `${Date.now()}-${safe}`);
    },
});

const fileFilter = (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|pdf/i;
    if (allowed.test(path.extname(file.originalname))) return cb(null, true);
    cb(new Error('Only jpeg, jpg, png, webp and pdf files are allowed.'));
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ── AUTH ──────────────────────────────────────────────────────────────────────
router.post('/auth/send-mobile-otp',   shopAuth.sendMobileOtp);
router.post('/auth/verify-mobile-otp', shopAuth.verifyMobileOtp);
router.post('/auth/send-email-otp',    shopAuth.sendEmailOtp);
router.post('/auth/verify-email-otp',  shopAuth.verifyEmailOtp);
router.post('/auth/send-login-otp',    shopAuth.sendLoginOtp);
router.post('/auth/verify-login-otp',  shopAuth.verifyLoginOtp);

router.post('/auth/register', upload.fields([
    { name: 'ownerPhoto', maxCount: 1 },
    { name: 'idProof',    maxCount: 1 },
    { name: 'shopLogo',   maxCount: 1 },
    { name: 'shopPhoto',  maxCount: 1 },
    { name: 'gstnCertificate', maxCount: 1 },
]), shopAuth.registerShop);

router.post('/auth/login', shopAuth.loginShop);

// ── PROFILE ───────────────────────────────────────────────────────────────────
router.get('/profile', protectShop, shopCtrl.getShopProfile);
router.put('/profile', protectShop, upload.fields([
    { name: 'shopLogo',   maxCount: 1 },
    { name: 'ownerPhoto', maxCount: 1 },
]), shopCtrl.updateShopProfile);
router.delete('/account/delete', protectShop, shopCtrl.deleteShopAccount);

// ── PRODUCTS ──────────────────────────────────────────────────────────────────
router.get('/products',        protectShop, shopCtrl.getProducts);
router.post('/products',       protectShop, upload.single('image'), shopCtrl.addProduct);
router.put('/products/:id',    protectShop, upload.single('image'), shopCtrl.editProduct);
router.delete('/products/:id', protectShop, shopCtrl.deleteProduct);

// ── COUPONS ───────────────────────────────────────────────────────────────────
router.post('/coupons/verify', protectShop, shopCtrl.verifyCoupon);
router.post('/coupons/apply',  protectShop, upload.single('productPhoto'), shopCtrl.applyCoupon);

// ── TRANSACTIONS ──────────────────────────────────────────────────────────────
router.get('/transactions', protectShop, shopCtrl.getTransactions);

// ── ANALYTICS ─────────────────────────────────────────────────────────────────
router.get('/analytics', protectShop, shopCtrl.getShopAnalytics);

// ── PUBLIC (worker-facing) ────────────────────────────────────────────────────
router.get('/public/all',              shopCtrl.getAllApprovedShops);
router.get('/public/:shopId/products', shopCtrl.getShopProducts);

module.exports = router;