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
    getUserByIdOrKarigarId,
    proxyDocument,
} = require('../controllers/adminController');
const {
    listAdminPendingDirectHirePayments,
    unblockClientFromDirectHire,
} = require('../controllers/directHireController');
const { fraudNotify } = require('../controllers/adminFraudController');

const { protect, admin } = require('../middleware/authMiddleware');

// All admin routes are protected and restricted to admin role.
router.get('/workers',                  protect, admin, getAllWorkers);
router.get('/clients',                  protect, admin, getAllClients);
router.post('/workers/:workerId/claim', protect, admin, claimWorkerForReview);
router.put('/workers/status',           protect, admin, updateWorkerStatus);
router.get('/users/:id',                protect, admin, getUserByIdOrKarigarId);
router.delete('/user/:id',              protect, admin, deleteUser);

// Dashboard/supporting endpoints used by frontend admin panel
router.get('/stats', protect, admin, getAdminStats);
router.get('/jobs',  protect, admin, getAllJobs);
router.get('/direct-hires/pending-payments', protect, admin, listAdminPendingDirectHirePayments);
router.post('/direct-hires/:jobId/unblock-client', protect, admin, unblockClientFromDirectHire);
router.post('/fraud-notify', fraudNotify);

// Notifications controller
const { getAdminNotifications, clearAllAdminNotifications, deleteAdminNotification } = require('../controllers/notificationController');

// Admin notifications route
router.get('/notifications', protect, admin, getAdminNotifications);
router.delete('/notifications/clear-all', protect, admin, clearAllAdminNotifications);
router.delete('/notifications/:id', protect, admin, deleteAdminNotification);

// Document proxy for preview
router.get('/document-proxy', protect, admin, proxyDocument);

// NOTE: The following sub-routers are mounted in server.js (not here):
//   /api/admin/shops      → adminShopRoutes
//   /api/admin/worker-complaints → workerComplaintsAdminRoutes (existing)
//   /api/admin/community  → adminCommunityRoutes (existing)
//   /api/admin/fraud      → adminFraudRoutes (existing)

module.exports = router;