// server/routes/adminRoutes.js — UPDATED
// Changes: Added worker-complaints routes and shop routes registration reference
// All original routes preserved exactly.

const express = require('express');
const router  = express.Router();

const {
    getAllWorkers,
    getAllClients,
    claimWorkerForReview,
    updateWorkerStatus,
    deleteUser,
    getAdminStats,
    getAllJobs,
} = require('../controllers/adminController');
const { fraudNotify } = require('../controllers/adminFraudController');

const { protect, admin } = require('../middleware/authMiddleware');

// All admin routes are protected and restricted to admin role.
router.get('/workers',                  protect, admin, getAllWorkers);
router.get('/clients',                  protect, admin, getAllClients);
router.post('/workers/:workerId/claim', protect, admin, claimWorkerForReview);
router.put('/workers/status',           protect, admin, updateWorkerStatus);
router.delete('/user/:id',    protect, admin, deleteUser);

// Dashboard/supporting endpoints used by frontend admin panel
router.get('/stats', protect, admin, getAdminStats);
router.get('/jobs',  protect, admin, getAllJobs);
router.post('/fraud-notify', fraudNotify);

// NOTE: The following sub-routers are mounted in server.js (not here):
//   /api/admin/shops      → adminShopRoutes
//   /api/admin/worker-complaints → workerComplaintsAdminRoutes (existing)
//   /api/admin/community  → adminCommunityRoutes (existing)
//   /api/admin/fraud      → adminFraudRoutes (existing)

module.exports = router;