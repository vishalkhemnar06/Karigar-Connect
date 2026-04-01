// server/routes/couponRoutes.js
// Mount at: /api/worker/coupons
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/couponController');
const { protect, worker } = require('../middleware/authMiddleware');

router.get('/my',    protect, worker, ctrl.getMyCoupons);
router.post('/generate', protect, worker, ctrl.getOrGenerateCoupon);
router.get('/code/:code', protect, worker, ctrl.getCouponByCode);

module.exports = router;