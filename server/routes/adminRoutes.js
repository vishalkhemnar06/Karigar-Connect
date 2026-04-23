// server/routes/adminRoutes.js — UPDATED
// Changes: Added worker-complaints routes and shop routes registration reference
// All original routes preserved exactly.

const express = require('express');
const router  = express.Router();
const multer  = require('multer');

const {
    getAllWorkers,
    getAllClients,
    getMarketplaceRates,
    getWorkerLeaderboard,
    claimWorkerForReview,
    updateWorkerStatus,
    deleteUser,
    getAdminStats,
    getAllJobs,
    getUserByIdOrKarigarId,
    proxyDocument,
    uploadBaseRatesCsv,
    manuallyUpdateMarketRates,
} = require('../controllers/adminController');
const {
    listAdminDirectHirePayments,
    listAdminPendingDirectHirePayments,
    sendAdminDirectHirePaymentWarning,
    blockClientFromDirectHire,
    unblockClientFromDirectHire,
} = require('../controllers/directHireController');
const { fraudNotify } = require('../controllers/adminFraudController');

const { protect, admin } = require('../middleware/authMiddleware');

// Multer configuration for CSV file upload (in-memory)
const csvUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        const ext = file.originalname.toLowerCase().split('.').pop();
        if (ext === 'csv') {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed.'));
        }
    },
});

// All admin routes are protected and restricted to admin role.
router.get('/workers',                  protect, admin, getAllWorkers);
router.get('/workers/leaderboard',      protect, admin, getWorkerLeaderboard);
router.get('/clients',                  protect, admin, getAllClients);
router.get('/marketplace/rates',        protect, admin, getMarketplaceRates);
router.post('/workers/:workerId/claim', protect, admin, claimWorkerForReview);
router.put('/workers/status',           protect, admin, updateWorkerStatus);
router.get('/users/:id',                protect, admin, getUserByIdOrKarigarId);
router.delete('/user/:id',              protect, admin, deleteUser);

// Dashboard/supporting endpoints used by frontend admin panel
router.get('/stats', protect, admin, getAdminStats);
router.get('/jobs',  protect, admin, getAllJobs);
router.get('/direct-hires/payments', protect, admin, listAdminDirectHirePayments);
router.get('/direct-hires/pending-payments', protect, admin, listAdminPendingDirectHirePayments);
router.post('/direct-hires/:jobId/warn-client', protect, admin, sendAdminDirectHirePaymentWarning);
router.post('/direct-hires/:jobId/block-client', protect, admin, blockClientFromDirectHire);
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

// Rate management endpoints
router.post('/rates/import-base-csv', protect, admin, csvUpload.single('file'), uploadBaseRatesCsv);
router.post('/rates/update-market-manual', protect, admin, manuallyUpdateMarketRates);

// NOTE: The following sub-routers are mounted in server.js (not here):
//   /api/admin/shops      → adminShopRoutes
//   /api/admin/worker-complaints → workerComplaintsAdminRoutes (existing)
//   /api/admin/community  → adminCommunityRoutes (existing)
//   /api/admin/fraud      → adminFraudRoutes (existing)

module.exports = router;