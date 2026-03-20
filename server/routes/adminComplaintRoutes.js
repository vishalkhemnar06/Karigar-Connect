// server/routes/adminComplaintRoutes.js
const express = require('express');
const router  = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
    getAllComplaints,
    getComplaintById,
    takeAction,
    getComplaintStats,
} = require('../controllers/adminComplaintController');

// Apply middleware individually on each route instead of router.use()
router.get('/stats',       protect, admin, getComplaintStats);
router.get('/',            protect, admin, getAllComplaints);
router.get('/:id',         protect, admin, getComplaintById);
router.post('/:id/action', protect, admin, takeAction);

module.exports = router;