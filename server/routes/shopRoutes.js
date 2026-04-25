// server/routes/shopRoutes.js

const express = require('express');
const router  = express.Router();

const shopAuth = require('../controllers/shopAuthController');
const shopCtrl = require('../controllers/shopController');
const { protectShop } = require('../middleware/shopAuthMiddleware');
const { createUploader } = require('../utils/cloudinary');

const upload = createUploader('karigarconnect/shop-media', ['image', 'application/pdf']);

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