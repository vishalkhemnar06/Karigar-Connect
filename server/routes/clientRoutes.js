// server/routes/clientRoutes.js
const express  = require('express');
const router   = express.Router();
const { protect, client } = require('../middleware/authMiddleware');
const {
    getClientProfile, updateClientProfile,
    getClientJobs, postJob, deleteJob, cancelJob, updateJobStatus,
    uploadCompletionPhotos, startJob, toggleJobApplications,
    removeAssignedWorker, completeWorkerTask,
    repostMissingSkill, cancelSlotRequirement, respondToSubTaskApplicant, completeSubTask,
    getJobApplicants, respondToApplicant, hireWorker, submitRating,
    getWorkerPublicProfile, toggleStarWorker,
    getClientAIHistory, getAIHistoryItem, saveAIAnalysis,
    updateAIHistoryItem, deleteAIHistoryItem, clearClientAIHistory,
    deleteClientAccount,
} = require('../controllers/clientController');
const { getNotifications, markRead, markAllRead, deleteNotification, clearAllNotifications } = require('../controllers/notificationController');
const { jobPhotoUploader, profilePhotoUploader } = require('../utils/cloudinary');

router.get('/profile',        protect, client, getClientProfile);
router.put('/profile/update', protect, client, profilePhotoUploader.single('photo'), updateClientProfile);

router.get('/jobs',       protect, client, getClientJobs);
router.post('/jobs/post', protect, client, jobPhotoUploader.array('photos', 5), postJob);

router.delete('/jobs/:id',                     protect, client, deleteJob);
router.patch('/jobs/:id/status',               protect, client, updateJobStatus);
router.patch('/jobs/:id/cancel',               protect, client, cancelJob);
router.patch('/jobs/:id/start',                protect, client, startJob);
router.patch('/jobs/:id/toggle-applications',  protect, client, toggleJobApplications);
router.patch('/jobs/:id/remove-worker',        protect, client, removeAssignedWorker);
router.patch('/jobs/:id/complete-worker-task', protect, client, completeWorkerTask);
router.post('/jobs/:id/completion-photos',     protect, client, jobPhotoUploader.array('photos', 10), uploadCompletionPhotos);

// Missing-skill sub-task system
router.post('/jobs/:id/repost-skill',    protect, client, repostMissingSkill);
router.patch('/jobs/:id/cancel-slot',    protect, client, cancelSlotRequirement);
router.post('/jobs/:id/subtask/respond', protect, client, respondToSubTaskApplicant);
router.patch('/jobs/:id/subtask/complete', protect, client, completeSubTask);

router.get('/jobs/:jobId/applicants', protect, client, getJobApplicants);
router.post('/jobs/:jobId/respond',   protect, client, respondToApplicant);
router.post('/jobs/:jobId/hire',      protect, client, hireWorker);
router.post('/jobs/:jobId/rate',      protect, client, submitRating);

router.get('/workers/:workerId/profile', protect, client, getWorkerPublicProfile);
router.post('/star/worker',              protect, client, toggleStarWorker);

// Notifications — specific BEFORE :id
router.patch('/notifications/mark-all-read', protect, client, markAllRead);
router.delete('/notifications/clear-all',    protect, client, clearAllNotifications);
router.get('/notifications',                 protect, client, getNotifications);
router.patch('/notifications/:id/read',      protect, client, markRead);
router.delete('/notifications/:id',          protect, client, deleteNotification);

// AI History — order matters: specific routes BEFORE :id wildcard
router.get('/ai/history',           protect, client, getClientAIHistory);       // GET list
router.post('/ai/history/save',     protect, client, saveAIAnalysis);           // POST save
router.delete('/ai/history/clear',  protect, client, clearClientAIHistory);     // DELETE all
router.get('/ai/history/:id',       protect, client, getAIHistoryItem);         // GET single (NEW)
router.patch('/ai/history/:id',     protect, client, updateAIHistoryItem);      // PATCH edit (NEW)
router.delete('/ai/history/:id',    protect, client, deleteAIHistoryItem);      // DELETE one


// Account
router.delete('/account/delete', protect, client, deleteClientAccount);

module.exports = router;
