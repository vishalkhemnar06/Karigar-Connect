// server/routes/workerComplaintRoutes.js
// UPDATED: Added DELETE /:id route for 24-hour delete window

const express = require('express');
const router  = express.Router();
const { protect, worker } = require('../middleware/authMiddleware');
const {
    fileComplaint,
    getMyComplaints,
    getComplaintById,
    deleteComplaint,
    sendMessage,
    markThreadRead,
    searchClient,
} = require('../controllers/workerComplaintController');

// Search clients (for "complaint against" autocomplete) — must be before /:id
router.get('/search-client', protect, worker, searchClient);

// File a new complaint or support request
router.post('/file', protect, worker, fileComplaint);

// List all my complaints/requests
router.get('/', protect, worker, getMyComplaints);

// Single complaint with full thread
router.get('/:id', protect, worker, getComplaintById);

// Delete complaint (within 24 hours, no admin reply)
router.delete('/:id', protect, worker, deleteComplaint);

// Send a message in a thread
router.post('/:id/message', protect, worker, sendMessage);

// Mark admin messages as read
router.patch('/:id/read', protect, worker, markThreadRead);

module.exports = router;