// server/routes/jobRoutes.js
// Group job workflows only.
// Individual job CRUD lives in clientRoutes.js / workerRoutes.js

const express = require('express');
const router  = express.Router();
const { protect, client, worker } = require('../middleware/authMiddleware');
const { hireGroupJob, respondToGroupJob } = require('../controllers/jobController');

// Client hires a whole group for a job
// POST /api/jobs/group/hire
router.post('/group/hire', protect, client, hireGroupJob);

// Worker responds to a group job proposal
// POST /api/jobs/group/respond
router.post('/group/respond', protect, worker, respondToGroupJob);

module.exports = router;
