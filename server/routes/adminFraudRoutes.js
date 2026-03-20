const express = require('express');
const router = express.Router();

const { protect, admin } = require('../middleware/authMiddleware');
const {
    getFraudQueue,
    getFraudMetrics,
    getFraudStats,
    getFraudActions,
    triggerFraudScan,
    takeFraudAction,
    dismissFraudQueueItem,
    getFraudHealth,
} = require('../controllers/adminFraudController');

router.get('/queue', protect, admin, getFraudQueue);
router.get('/metrics', protect, admin, getFraudMetrics);
router.get('/stats', protect, admin, getFraudStats);
router.get('/actions', protect, admin, getFraudActions);
router.get('/health', protect, admin, getFraudHealth);
router.post('/scan', protect, admin, triggerFraudScan);
router.post('/action', protect, admin, takeFraudAction);
router.delete('/queue/:userId', protect, admin, dismissFraudQueueItem);

module.exports = router;