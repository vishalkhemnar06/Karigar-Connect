// server/routes/locationRoutes.js
// ADD this file to your server/routes/ directory
// Then register it in server.js (instructions at bottom of this file)

const express = require('express');
const router  = express.Router();
const { protect, client, worker } = require('../middleware/authMiddleware');
const {
    initClientLocation,
    updateWorkerLocation,
    getJobLocation,
    toggleWorkerSharing,
    getWorkerTrackingJobs,
} = require('../controllers/locationController');

// ── Client routes ──────────────────────────────────────────────────────────
// Capture/update the static client location when a worker is confirmed
// POST /api/location/init
router.post('/init', protect, client, initClientLocation);

// ── Worker routes ──────────────────────────────────────────────────────────
// Worker pushes live GPS coordinates (called every 5 s from frontend)
// PUT /api/location/worker/update
router.put('/worker/update', protect, worker, updateWorkerLocation);

// Worker enables/disables their sharing for a job
// PUT /api/location/worker/toggle
router.put('/worker/toggle', protect, worker, toggleWorkerSharing);

// Worker: list all jobs with active tracking sessions
// GET /api/location/worker/jobs
router.get('/worker/jobs', protect, worker, getWorkerTrackingJobs);

// ── Shared route ───────────────────────────────────────────────────────────
// Both client and worker can read location data for a job they're part of
// GET /api/location/:jobId
router.get('/:jobId', protect, getJobLocation);

module.exports = router;

/*
═══════════════════════════════════════════════════════════════════════════════
ADD THE FOLLOWING LINE to your server/server.js IMPORTS section:

    const locationRoutes = require('./routes/locationRoutes');

ADD THE FOLLOWING LINE to your server/server.js ROUTES section
(before the 404 handler):

    app.use('/api/location', locationRoutes);

═══════════════════════════════════════════════════════════════════════════════
*/