// server/routes/clientRoutes.js
const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const { protect, client } = require('../middleware/authMiddleware');
const {
    getClientProfile, updateClientProfile,
    getClientMarketplaceDiscount,
    getClientJobs, postJob, deleteJob, cancelJob, updateJobStatus,
    permanentlyDeleteHistoryJob, permanentlyDeleteSelectedHistoryJobs, permanentlyDeleteAllHistoryJobs,
    uploadCompletionPhotos, removeCompletionPhoto, startJob, toggleJobApplications,
    removeAssignedWorker, completeWorkerTask,
    repostMissingSkill, cancelSlotRequirement, respondToSubTaskApplicant, completeSubTask,
    getJobApplicants, getSmartWorkerSuggestions, inviteWorkersToJob, respondToApplicant, hireWorker, submitRating,
    getWorkerPublicProfile, generateWorkerProfileSummary, toggleStarWorker,
    getClientAIHistory, getAIHistoryItem, saveAIAnalysis,
    updateAIHistoryItem, deleteAIHistoryItem, clearClientAIHistory,
    deleteClientAccount,
    verifyAssignedWorkerFace,
    getClientDocumentPreviewUrl,
    sendClientPasswordChangeOtp,
    verifyClientPasswordChangeOtp,
    changeClientPasswordWithOtp,
} = require('../controllers/clientController');
const {
    getDirectHireSuggestedAmount,
    createDirectHireTicket,
    getClientDirectHireTickets,
    logDirectHireCallIntent,
    sendDirectHireStartOtp,
    verifyDirectHireStartOtp,
    sendDirectHireCompletionOtp,
    verifyDirectHireCompletionOtp,
} = require('../controllers/directHireController');
const { getNotifications, markRead, markAllRead, deleteNotification, clearAllNotifications } = require('../controllers/notificationController');
const { jobPhotoUploader, profilePhotoUploader, mixedUploader, clientJobPhotoUploader } = require('../utils/cloudinary');
const faceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/profile',        protect, client, getClientProfile);
router.get('/marketplace/discount', protect, client, getClientMarketplaceDiscount);
router.get('/profile/document-preview-url', protect, client, getClientDocumentPreviewUrl);
router.put('/profile/update', protect, client, mixedUploader.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'proofOfResidence', maxCount: 1 },
    { name: 'secondaryIdProof', maxCount: 1 },
    { name: 'professionalCertification', maxCount: 1 },
]), updateClientProfile);
router.post('/face/verify-assigned-worker', protect, client, faceUpload.single('livePhoto'), verifyAssignedWorkerFace);

router.get('/jobs',       protect, client, getClientJobs);
router.post('/jobs/post', protect, client, clientJobPhotoUploader.array('photos', 3), postJob);

router.post('/jobs/history/delete-selected',   protect, client, permanentlyDeleteSelectedHistoryJobs);
router.delete('/jobs/history/delete-all',      protect, client, permanentlyDeleteAllHistoryJobs);
router.delete('/jobs/:id/permanent',           protect, client, permanentlyDeleteHistoryJob);

router.delete('/jobs/:id',                     protect, client, deleteJob);
router.patch('/jobs/:id/status',               protect, client, updateJobStatus);
router.patch('/jobs/:id/cancel',               protect, client, cancelJob);
router.patch('/jobs/:id/start',                protect, client, startJob);
router.patch('/jobs/:id/toggle-applications',  protect, client, toggleJobApplications);
router.patch('/jobs/:id/remove-worker',        protect, client, removeAssignedWorker);
router.patch('/jobs/:id/complete-worker-task', protect, client, completeWorkerTask);
router.post('/jobs/:id/completion-photos',     protect, client, jobPhotoUploader.array('photos', 10), uploadCompletionPhotos);
router.delete('/jobs/:id/completion-photos/:photoIndex', protect, client, removeCompletionPhoto);

// Missing-skill sub-task system
router.post('/jobs/:id/repost-skill',    protect, client, repostMissingSkill);
router.patch('/jobs/:id/cancel-slot',    protect, client, cancelSlotRequirement);
router.post('/jobs/:id/subtask/respond', protect, client, respondToSubTaskApplicant);
router.patch('/jobs/:id/subtask/complete', protect, client, completeSubTask);

router.get('/jobs/:jobId/applicants', protect, client, getJobApplicants);
router.get('/jobs/:jobId/smart-suggestions', protect, client, getSmartWorkerSuggestions);
router.post('/jobs/:jobId/invite', protect, client, inviteWorkersToJob);
router.post('/jobs/:jobId/respond',   protect, client, respondToApplicant);
router.post('/jobs/:jobId/hire',      protect, client, hireWorker);
router.post('/jobs/:jobId/rate',      protect, client, submitRating);

// Direct hire flow
router.get('/direct-hires', protect, client, getClientDirectHireTickets);
router.post('/direct-hires/amount', protect, client, getDirectHireSuggestedAmount);
router.post('/direct-hires', protect, client, createDirectHireTicket);
router.post('/direct-hires/:jobId/call-intent', protect, client, logDirectHireCallIntent);
router.post('/direct-hires/:jobId/start-otp/send', protect, client, sendDirectHireStartOtp);
router.post('/direct-hires/:jobId/start-otp/verify', protect, client, verifyDirectHireStartOtp);
router.post('/direct-hires/:jobId/completion-otp/send', protect, client, sendDirectHireCompletionOtp);
router.post('/direct-hires/:jobId/completion-otp/verify', protect, client, verifyDirectHireCompletionOtp);

router.get('/workers/:workerId/profile', protect, client, getWorkerPublicProfile);
router.get('/workers/:workerId/profile-summary', protect, client, generateWorkerProfileSummary);
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
router.post('/settings/password/send-otp',   protect, client, sendClientPasswordChangeOtp);
router.post('/settings/password/verify-otp', protect, client, verifyClientPasswordChangeOtp);
router.post('/settings/password/change',     protect, client, changeClientPasswordWithOtp);
router.delete('/account/delete', protect, client, deleteClientAccount);

module.exports = router;
