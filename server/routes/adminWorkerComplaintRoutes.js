// server/routes/adminWorkerComplaintRoutes.js
// ENHANCED: Added /reply, /read, /priority endpoints
// Mount at: app.use('/api/admin/complaints', adminComplaintRoutes)  (BEFORE /api/admin)

const express = require('express');
const router  = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
    getComplaints,
    getComplaintStats,
    getComplaintById,
    takeAction,
    replyToComplaint,
    markComplaintRead,
    updatePriority,
} = require('../controllers/adminWorkerComplaintController');

// Stats
router.get('/stats', protect, admin, getComplaintStats);

// List all complaints (with filters)
router.get('/', protect, admin, getComplaints);

// Single complaint
router.get('/:id', protect, admin, getComplaintById);

// Take action (status update + optional message)
router.post('/:id/action', protect, admin, takeAction);

// Reply (message only, no status change)
router.post('/:id/reply', protect, admin, replyToComplaint);

// Mark as read by admin
router.patch('/:id/read', protect, admin, markComplaintRead);

// Update priority
router.patch('/:id/priority', protect, admin, updatePriority);

module.exports = router;