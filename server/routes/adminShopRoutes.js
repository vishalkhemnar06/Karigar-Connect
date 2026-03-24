// server/routes/adminShopRoutes.js
// Mount at: /api/admin/shops
const express  = require('express');
const router   = express.Router();
const ctrl     = require('../controllers/adminShopController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/',                       protect, admin, ctrl.getAllShops);
router.get('/coupons',                protect, admin, ctrl.getAllCoupons);
router.get('/coupons/unclaimed',      protect, admin, ctrl.getUnclaimedCoupons);
router.get('/coupons/history',        protect, admin, ctrl.getCouponUsageHistory);
router.get('/:id',                    protect, admin, ctrl.getShopById);
router.patch('/:id/approve',          protect, admin, ctrl.approveShop);
router.patch('/:id/reject',           protect, admin, ctrl.rejectShop);
router.patch('/:id/block',            protect, admin, ctrl.blockShop);
router.delete('/:id',                 protect, admin, ctrl.deleteShop);

module.exports = router;