// server/routes/workerRoutes.js
const express = require('express');
const router  = express.Router();
const { protect, worker } = require('../middleware/authMiddleware');

const {
    getAvailableJobs,
    getJobDetails,
    applyForJob,
    applyForSubTask,
    cancelAcceptedJob,
    getWorkerBookings,
    getWorkerAnalytics,
    getWorkerProfile,
    updateWorkerProfile,
    toggleAvailability,
    deleteAccount,
    getPublicWorkerProfile,
    getAllKarigars,
    getLeaderboard,
    getMyFeedback,
    fileComplaint,
    getMyComplaints,
    getNearClients,
} = require('../controllers/workerController');

const {
    getNotifications,
    markRead,
    markAllRead,
    deleteNotification,
    clearAllNotifications,
} = require('../controllers/notificationController');

const { respondToGroupJob } = require('../controllers/jobController');
const { profilePhotoUploader } = require('../utils/cloudinary');

// ── Jobs ───────────────────────────────────────────────────────────────────────
router.get('/jobs',                    protect, worker, getAvailableJobs);
router.get('/jobs/:jobId/details',     protect, worker, getJobDetails);
router.post('/jobs/:jobId/apply',      protect, worker, applyForJob);
router.patch('/jobs/:jobId/cancel',    protect, worker, cancelAcceptedJob);

// ── Sub-task apply ─────────────────────────────────────────────────────────────
router.post('/jobs/:jobId/subtask/:subTaskId/apply', protect, worker, applyForSubTask);

// ── Bookings & analytics ───────────────────────────────────────────────────────
router.get('/bookings',   protect, worker, getWorkerBookings);
router.get('/analytics',  protect, worker, getWorkerAnalytics);

// ── Profile ────────────────────────────────────────────────────────────────────
router.get('/profile',              protect, worker, getWorkerProfile);
router.put('/profile/update',       protect, worker, profilePhotoUploader.single('photo'), updateWorkerProfile);
router.post('/availability',        protect, worker, toggleAvailability);
router.delete('/account/delete',    protect, worker, deleteAccount);

// ── Public ─────────────────────────────────────────────────────────────────────
router.get('/public/:id',  protect, getPublicWorkerProfile);
router.get('/all',         protect, getAllKarigars);
router.get('/leaderboard', protect, getLeaderboard);

// ── Near Clients ──────────────────────────────────────────────────────────────
router.get('/near-clients',      protect, worker, getNearClients);

// ── Feedback & complaints ──────────────────────────────────────────────────────
router.get('/feedback',          protect, worker, getMyFeedback);
router.post('/complaints/file',  protect, worker, fileComplaint);
router.get('/complaints',        protect, worker, getMyComplaints);

// ── Group job ──────────────────────────────────────────────────────────────────
router.post('/group-job/respond', protect, worker, respondToGroupJob);

// ── Notifications — specific BEFORE wildcard ──────────────────────────────────
router.patch('/notifications/mark-all-read', protect, worker, markAllRead);           // BEFORE /:id
router.delete('/notifications/clear-all',    protect, worker, clearAllNotifications); // BEFORE /:id
router.get('/notifications',                 protect, worker, getNotifications);
router.patch('/notifications/:id/read',      protect, worker, markRead);
router.delete('/notifications/:id',          protect, worker, deleteNotification);

module.exports = router;
