const express = require('express');
const router = express.Router();
const { protect, admin, client, worker } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/semanticMatchingController');

router.get('/health', ctrl.health);

router.post('/admin/rebuild', protect, admin, ctrl.rebuildIndex);
router.post('/admin/workers/:workerId/sync', protect, admin, ctrl.syncWorker);
router.post('/admin/jobs/:jobId/sync', protect, admin, ctrl.syncJob);
router.delete('/admin/workers/:workerId', protect, admin, ctrl.deleteIndexedWorker);
router.delete('/admin/jobs/:jobId', protect, admin, ctrl.deleteIndexedJob);

router.get('/jobs/:jobId/workers', protect, client, ctrl.getWorkersForJob);
router.get('/workers/:workerId/jobs', protect, worker, ctrl.getJobsForWorker);
router.get('/worker/jobs', protect, worker, ctrl.getJobsForWorker);

router.post('/feedback', protect, ctrl.recordFeedback);

module.exports = router;
