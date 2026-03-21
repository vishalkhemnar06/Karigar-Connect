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
    fraudNotify,           // FIX: was exported by controller but never registered
} = require('../controllers/adminFraudController');

router.get('/queue',           protect, admin, getFraudQueue);
router.get('/metrics',         protect, admin, getFraudMetrics);
router.get('/stats',           protect, admin, getFraudStats);
router.get('/actions',         protect, admin, getFraudActions);
router.get('/health',          protect, admin, getFraudHealth);
router.post('/scan',           protect, admin, triggerFraudScan);
router.post('/action',         protect, admin, takeFraudAction);
router.delete('/queue/:userId',protect, admin, dismissFraudQueueItem);

// FIX: Python fraud service calls POST /api/admin/fraud-notify (internal only,
//      guarded by x-internal-secret header — no JWT middleware needed here).
//      Without this route Node returned 404 → Python logged a warning and
//      the 502 cascaded back to the browser.
router.post('/notify', fraudNotify);

module.exports = router;