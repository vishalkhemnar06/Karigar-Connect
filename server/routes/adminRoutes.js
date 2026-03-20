// routes/adminRoutes.js

const express = require('express');
const router  = express.Router();

const {
    getAllWorkers,
    getAllClients,
    updateWorkerStatus,
    deleteUser,
    getAdminStats,
    getAllJobs,
} = require('../controllers/adminController');
const { fraudNotify } = require('../controllers/adminFraudController');

const { protect, admin } = require('../middleware/authMiddleware');

// All admin routes are protected and restricted to admin role.
router.get('/workers',        protect, admin, getAllWorkers);
router.get('/clients',        protect, admin, getAllClients);
router.put('/workers/status', protect, admin, updateWorkerStatus);
router.delete('/user/:id',    protect, admin, deleteUser);

// Dashboard/supporting endpoints used by frontend admin panel
router.get('/stats', protect, admin, getAdminStats);
router.get('/jobs',  protect, admin, getAllJobs);
router.post('/fraud-notify', fraudNotify);

module.exports = router;