// server/routes/workerRoutes.js
// UPDATED: Added password-change OTP routes + permanent account delete
//
// NEW routes (mounted at the top, before any conflicting siblings):
//   POST   /api/worker/settings/password/send-otp   — send OTP to registered mobile
//   POST   /api/worker/settings/password/verify-otp — verify OTP → returns verifiedToken
//   POST   /api/worker/settings/password/change     — set new password (no old pwd needed)
//   DELETE /api/worker/account/delete-permanent     — OTP-verified permanent delete
//
// PRESERVED exactly from existing file:
//   - profilePhotoUploader from cloudinary (not multer diskStorage)
//   - respondToGroupJob from jobController
//   - Original notificationController export names: getNotifications, markRead,
//     markAllRead, deleteNotification, clearAllNotifications
//   - All original route paths, middleware order, and specific-before-wildcard ordering

const express = require('express');
const router  = express.Router();
const { protect, worker } = require('../middleware/authMiddleware');

// ── Worker controller ─────────────────────────────────────────────────────────
const {
    // Original
    getAvailableJobs,
    getJobDetails,
    applyForJob,
    applyForSubTask,
    cancelPendingJobApplication,
    cancelAcceptedJob,
    getWorkerBookings,
    getWorkerAnalytics,
    getWorkerProfile,
    updateWorkerProfile,
    getWorkerDailyProfile,
    updateWorkerDailyProfile,
    toggleAvailability,
    deleteAccount,
    getPublicWorkerProfile,
    getAllKarigars,
    getLeaderboard,
    getMyFeedback,
    fileComplaint,
    getMyComplaints,
    getNearClients,
    getDirectInvites,
    acceptDirectInvite,
    rejectDirectInvite,
    // NEW — password change OTP flow + permanent delete
    sendPasswordChangeOtp,
    verifyPasswordChangeOtp,
    changePasswordWithOtp,
    deleteAccountPermanently,
} = require('../controllers/workerController');
const {
    getWorkerDirectHireTickets,
    acceptDirectHireTicket,
    rejectDirectHireTicket,
} = require('../controllers/directHireController');

// ── Notification controller — original export names ───────────────────────────
const {
    getNotifications,
    markRead,
    markAllRead,
    deleteNotification,
    clearAllNotifications,
} = require('../controllers/notificationController');

// ── Job controller (respondToGroupJob lives here in your codebase) ────────────
const { respondToGroupJob } = require('../controllers/jobController');

// ── Cloudinary uploaders ──────────────────────────────────────────────────────
const { mixedUploader } = require('../utils/cloudinary');

// --- Purchase History Controller ---
const { getWorkerPurchaseHistory } = require('../controllers/shopController');

// ═════════════════════════════════════════════════════════════════════════════
// NEW: Password-change OTP flow — mounted FIRST to avoid any path conflicts
// ═════════════════════════════════════════════════════════════════════════════
router.post('/settings/password/send-otp',   protect, worker, sendPasswordChangeOtp);
router.post('/settings/password/verify-otp', protect, worker, verifyPasswordChangeOtp);
router.post('/settings/password/change',     protect, worker, changePasswordWithOtp);

// NEW: Permanent delete — BEFORE the legacy /account/delete
router.delete('/account/delete-permanent', protect, worker, deleteAccountPermanently);

// ═════════════════════════════════════════════════════════════════════════════
// ALL ORIGINAL ROUTES — preserved exactly
// ═════════════════════════════════════════════════════════════════════════════

// ── Jobs ──────────────────────────────────────────────────────────────────────
router.get('/jobs',                    protect, worker, getAvailableJobs);
router.get('/jobs/:jobId/details',     protect, worker, getJobDetails);
router.post('/jobs/:jobId/apply',      protect, worker, applyForJob);
router.patch('/jobs/:jobId/application/cancel', protect, worker, cancelPendingJobApplication);
router.patch('/jobs/:jobId/cancel',    protect, worker, cancelAcceptedJob);

// ── Sub-task apply ────────────────────────────────────────────────────────────
router.post('/jobs/:jobId/subtask/:subTaskId/apply', protect, worker, applyForSubTask);

// ── Bookings & analytics ──────────────────────────────────────────────────────
router.get('/bookings',   protect, worker, getWorkerBookings);
router.get('/analytics',  protect, worker, getWorkerAnalytics);
router.get('/direct-hires', protect, worker, getWorkerDirectHireTickets);
router.post('/direct-hires/:jobId/accept', protect, worker, acceptDirectHireTicket);
router.post('/direct-hires/:jobId/reject', protect, worker, rejectDirectHireTicket);

// --- Purchase History Route ---
router.get('/purchase-history', protect, worker, getWorkerPurchaseHistory);

// ── Profile ───────────────────────────────────────────────────────────────────
router.get('/profile',              protect, worker, getWorkerProfile);
router.put('/profile/update',       protect, worker, mixedUploader.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'eShramCard', maxCount: 1 },
    { name: 'skillCertificates', maxCount: 3 },
    { name: 'portfolioPhotos', maxCount: 4 },
]), updateWorkerProfile);
router.get('/daily-profile',        protect, worker, getWorkerDailyProfile);
router.put('/daily-profile',        protect, worker, updateWorkerDailyProfile);
router.post('/availability',        protect, worker, toggleAvailability);
router.delete('/account/delete',    protect, worker, deleteAccount);

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/public/:id',  protect, getPublicWorkerProfile);
router.get('/all',         protect, getAllKarigars);
router.get('/leaderboard', protect, getLeaderboard);

// ── Near Clients ──────────────────────────────────────────────────────────────
router.get('/near-clients', protect, worker, getNearClients);

// ── Direct Invites ──────────────────────────────────────────────────────────
router.get('/invites/direct', protect, worker, getDirectInvites);
router.post('/invites/:jobId/accept', protect, worker, acceptDirectInvite);
router.post('/invites/:jobId/reject', protect, worker, rejectDirectInvite);

// ── Feedback & complaints ─────────────────────────────────────────────────────
router.get('/feedback',         protect, worker, getMyFeedback);
router.post('/complaints/file', protect, worker, fileComplaint);
router.get('/complaints',       protect, worker, getMyComplaints);

// ── Group job ─────────────────────────────────────────────────────────────────
router.post('/group-job/respond', protect, worker, respondToGroupJob);

// ── Notifications — specific paths BEFORE wildcard /:id ───────────────────────
router.patch('/notifications/mark-all-read', protect, worker, markAllRead);           // BEFORE /:id
router.delete('/notifications/clear-all',    protect, worker, clearAllNotifications); // BEFORE /:id
router.get('/notifications',                 protect, worker, getNotifications);
router.patch('/notifications/:id/read',      protect, worker, markRead);
router.delete('/notifications/:id',          protect, worker, deleteNotification);

module.exports = router;