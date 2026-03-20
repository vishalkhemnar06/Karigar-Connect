// server/routes/clientComplaintRoutes.js
const express = require('express');
const router  = express.Router();
const { protect, client } = require('../middleware/authMiddleware');
const {
    fileComplaint,
    getMyComplaints,
    searchWorker,
} = require('../controllers/clientComplaintController');

// Apply middleware individually on each route instead of router.use()
router.get('/search-worker', protect, client, searchWorker);
router.post('/file',         protect, client, fileComplaint);
router.get('/',              protect, client, getMyComplaints);

module.exports = router;