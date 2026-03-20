// client/src/api/index.js — UPDATED
// Added: initClientLocation, updateWorkerLocation, toggleWorkerLocationSharing,
//        getWorkerTrackingJobs, getJobLocationData
// All original exports preserved exactly

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API = axios.create({ baseURL: BASE_URL });
API.interceptors.request.use((req) => {
    const token = localStorage.getItem('token');
    if (token) req.headers.Authorization = `Bearer ${token}`;
    return req;
});
const mp = { headers: { 'Content-Type': 'multipart/form-data' } };

// ── AUTH ──────────────────────────────────────────────────────────────────────
export const sendOtp               = (d)      => API.post('/api/auth/send-otp',               d);
export const verifyOtp             = (d)      => API.post('/api/auth/verify-otp',              d);
export const registerWorker        = (fd)     => API.post('/api/auth/register/worker',         fd, mp);
export const registerClient        = (fd)     => API.post('/api/auth/register/client',         fd, mp);
export const loginWithPassword     = (d)      => API.post('/api/auth/login-password',          d);
export const loginWithOtp          = (d)      => API.post('/api/auth/login-otp',               d);
export const previewFaceSimilarity = (fd)     => API.post('/api/auth/face-similarity-preview', fd, mp);
export const forgotPassword        = (d)      => API.post('/api/auth/forgot-password',         d);
export const resetPassword         = (t, d)   => API.put(`/api/auth/reset-password/${t}`,     d);

// ── ADMIN ─────────────────────────────────────────────────────────────────────
export const getAllWorkers          = ()       => API.get('/api/admin/workers');
export const getAllClients          = ()       => API.get('/api/admin/clients');
export const updateWorkerStatus    = (d)      => API.put('/api/admin/workers/status',          d);
export const deleteUser            = (id)     => API.delete(`/api/admin/user/${id}`);
export const getAdminStats         = ()       => API.get('/api/admin/stats');
export const getAllJobs             = ()       => API.get('/api/admin/jobs');
export const getFraudQueue         = (p = {}) => API.get('/api/admin/fraud/queue',             { params: p });
export const getFraudMetrics       = ()       => API.get('/api/admin/fraud/metrics');
export const getFraudActions       = (p = {}) => API.get('/api/admin/fraud/actions',           { params: p });
export const runFraudScan          = ()       => API.post('/api/admin/fraud/scan');
export const takeFraudAction       = (d)      => API.post('/api/admin/fraud/action',           d);
export const dismissFraudQueueItem = (userId) => API.delete(`/api/admin/fraud/queue/${userId}`);
export const getFraudHealth        = ()       => API.get('/api/admin/fraud/health');

// ── ADMIN COMPLAINTS ──────────────────────────────────────────────────────────
export const getAdminComplaints         = (p = {}) => API.get('/api/admin/complaints',              { params: p });
export const getAdminComplaintStats     = ()        => API.get('/api/admin/complaints/stats');
export const getAdminComplaintById      = (id)      => API.get(`/api/admin/complaints/${id}`);
export const takeAdminActionOnComplaint = (id, b)   => API.post(`/api/admin/complaints/${id}/action`, b);

// ── ADMIN COMMUNITY ───────────────────────────────────────────────────────────
export const adminGetCommunityPosts       = (page = 1)  => API.get('/api/admin/community/posts',          { params: { page } });
export const adminGetCommunityStats       = ()           => API.get('/api/admin/community/stats');
export const adminCreateCommunityPost     = (fd)         => API.post('/api/admin/community/posts',          fd, mp);
export const adminEditCommunityPost       = (id, fd)     => API.put(`/api/admin/community/posts/${id}`,     fd, mp);
export const adminDeleteCommunityPost     = (id, reason) => API.delete(`/api/admin/community/posts/${id}`,  { data: { reason } });
export const adminHardDeleteCommunityPost = (id)         => API.delete(`/api/admin/community/posts/${id}/hard`);
export const adminRestoreCommunityPost    = (id)         => API.post(`/api/admin/community/posts/${id}/restore`);

// ── WORKER ────────────────────────────────────────────────────────────────────
export const getAvailableJobs               = ()              => API.get('/api/worker/jobs');
export const getJobDetails                  = (jobId)         => API.get(`/api/worker/jobs/${jobId}/details`);
export const applyForJob                    = (jobId, skills) => API.post(`/api/worker/jobs/${jobId}/apply`, { selectedSkills: skills });
export const workerCancelJob                = (jobId, reason) => API.patch(`/api/worker/jobs/${jobId}/cancel`, { reason });
export const getWorkerBookings              = ()              => API.get('/api/worker/bookings');
export const getWorkerAnalytics             = ()              => API.get('/api/worker/analytics');
export const getNearClients                 = ()              => API.get('/api/worker/near-clients');
export const getWorkerProfile               = ()              => API.get('/api/worker/profile');
export const updateWorkerProfile            = (fd)            => API.put('/api/worker/profile/update',         fd, mp);
export const toggleAvailability             = (d = {})        => API.post('/api/worker/availability',           d);
export const deleteAccount                  = ()              => API.delete('/api/worker/account/delete');
export const getPublicWorkerProfile         = (id)            => API.get(`/api/worker/public/${id}`);
export const getAllKarigars                 = ()              => API.get('/api/worker/all');
export const getLeaderboard                 = ()              => API.get('/api/worker/leaderboard');
export const getMyFeedback                  = ()              => API.get('/api/worker/feedback');
export const fileComplaint                  = (d)             => API.post('/api/worker/complaints/file',        d);
export const getMyComplaints                = ()              => API.get('/api/worker/complaints');
export const respondToGroupJob              = (d)             => API.post('/api/worker/group-job/respond',      d);
export const getWorkerNotifications         = ()              => API.get('/api/worker/notifications');
export const markWorkerNotificationRead     = (id)            => API.patch(`/api/worker/notifications/${id}/read`);
export const markAllWorkerNotificationsRead = ()              => API.patch('/api/worker/notifications/mark-all-read');
export const deleteWorkerNotification       = (id)            => API.delete(`/api/worker/notifications/${id}`);
export const clearAllWorkerNotifications    = ()              => API.delete('/api/worker/notifications/clear-all');

// ── CLIENT ────────────────────────────────────────────────────────────────────
export const getClientProfile           = ()      => API.get('/api/client/profile');
export const updateClientProfile        = (fd)    => API.put('/api/client/profile/update',          fd, mp);
export const deleteClientAccount        = ()      => API.delete('/api/client/account/delete');
export const getWorkerFullProfile       = (wId)   => API.get(`/api/client/workers/${wId}/profile`);
export const toggleStarWorker           = (wId)   => API.post('/api/client/star/worker',            { workerId: wId });

export const getClientJobs              = ()                              => API.get('/api/client/jobs');
export const postJob                    = (fd)                            => API.post('/api/client/jobs/post',              fd, mp);
export const deleteClientJob            = (id)                            => API.delete(`/api/client/jobs/${id}`);
export const updateJobStatus            = (id, status)                    => API.patch(`/api/client/jobs/${id}/status`,    { status });
export const cancelJob                  = (id, reason)                    => API.patch(`/api/client/jobs/${id}/cancel`,    { reason });
export const startJob                   = (id)                            => API.patch(`/api/client/jobs/${id}/start`);
export const toggleJobApplications      = (id)                            => API.patch(`/api/client/jobs/${id}/toggle-applications`);
export const removeAssignedWorker       = (id, workerId, reason, slotId)  => API.patch(`/api/client/jobs/${id}/remove-worker`, { workerId, reason, slotId });
export const completeWorkerTask         = (id, workerId, slotId)          => API.patch(`/api/client/jobs/${id}/complete-worker-task`, { workerId, slotId });
export const completeSubTask            = (id, subTaskId)                 => API.patch(`/api/client/jobs/${id}/subtask/complete`,     { subTaskId });
export const uploadCompletionPhotos     = (id, fd)                        => API.post(`/api/client/jobs/${id}/completion-photos`,     fd, mp);
export const getJobApplicants           = (jobId)                         => API.get(`/api/client/jobs/${jobId}/applicants`);
export const respondToApplicant         = (jobId, d)                      => API.post(`/api/client/jobs/${jobId}/respond`,  d);
export const hireWorker                 = (jobId, wId)                    => API.post(`/api/client/jobs/${jobId}/hire`,    { workerId: wId });
export const submitRating               = (jobId, d)                      => API.post(`/api/client/jobs/${jobId}/rate`,    d);

export const repostMissingSkill = (id, d, newDate, newTime) => {
    const payload = typeof d === 'object' && d !== null ? d : { slotId: d, newScheduledDate: newDate, newScheduledTime: newTime };
    return API.post(`/api/client/jobs/${id}/repost-skill`, payload);
};
export const cancelSlotRequirement      = (id, slotId) => API.patch(`/api/client/jobs/${id}/cancel-slot`,    { slotId });
export const dismissMissingSkill        = (id, slotId) => API.patch(`/api/client/jobs/${id}/cancel-slot`,    { slotId });
export const respondToSubTaskApplicant  = (id, d)      => API.post(`/api/client/jobs/${id}/subtask/respond`, d);
export const applyForSubTask            = (parentJobId, subTaskId) => API.post(`/api/worker/jobs/${parentJobId}/subtask/${subTaskId}/apply`);

export const getClientNotifications         = ()   => API.get('/api/client/notifications');
export const markClientNotificationRead     = (id) => API.patch(`/api/client/notifications/${id}/read`);
export const markAllClientNotificationsRead = ()   => API.patch('/api/client/notifications/mark-all-read');
export const deleteClientNotification       = (id) => API.delete(`/api/client/notifications/${id}`);
export const clearAllClientNotifications    = ()   => API.delete('/api/client/notifications/clear-all');

// ── CLIENT COMPLAINTS ─────────────────────────────────────────────────────────
export const searchWorkerForComplaint = (query) => API.get('/api/client/complaints/search-worker', { params: { query } });
export const fileClientComplaint      = (body)  => API.post('/api/client/complaints/file',          body);
export const getClientComplaints      = ()       => API.get('/api/client/complaints');

// ── AI HISTORY ────────────────────────────────────────────────────────────────
export const getClientAIHistory   = ()       => API.get('/api/client/ai/history');
export const getAIHistoryItem     = (id)     => API.get(`/api/client/ai/history/${id}`);
export const saveAIAnalysis       = (d)      => API.post('/api/client/ai/history/save',  d);
export const updateAIHistoryItem  = (id, d)  => API.patch(`/api/client/ai/history/${id}`, d);
export const clearClientAIHistory = ()       => API.delete('/api/client/ai/history/clear');
export const deleteAIHistoryItem  = (id)     => API.delete(`/api/client/ai/history/${id}`);

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiGenerateQuestions = (d)  => API.post('/api/ai/generate-questions',       d);
export const aiGenerateEstimate  = (d)  => API.post('/api/ai/generate-estimate',        d);
export const startAIAssistant    = (fd) => API.post('/api/ai/assistant',                fd, mp);
export const getAIAdvisorReport  = (fd) => API.post('/api/ai/advisor',                  fd, mp);
export const aiGeneratePreviews  = (fd) => API.post('/api/ai/generate-preview-images',  fd, mp);

// ── GROUPS ────────────────────────────────────────────────────────────────────
export const createGroupAPI = (d)        => API.post('/api/groups',              d);
export const getMyGroupsAPI = ()         => API.get('/api/groups/my');
export const addMemberAPI   = (gId, kId) => API.put(`/api/groups/${gId}/add`,   { karigarId: kId });
export const deleteGroupAPI = (gId)      => API.delete(`/api/groups/${gId}`);
export const leaveGroupAPI  = (gId)      => API.put(`/api/groups/${gId}/leave`, {});
export const hireGroupJob   = (d)        => API.post('/api/jobs/group/hire',     d);
// Client group browsing
export const browseGroups   = (params = {}) => API.get('/api/groups/browse',            { params });
export const getGroupPublic = (groupId)     => API.get(`/api/groups/${groupId}/public`);

// ── COMMUNITY (Worker) ────────────────────────────────────────────────────────
export const getCommunityPosts      = (page = 1) => API.get('/api/community/',               { params: { page } });
export const createCommunityPost    = (fd)        => API.post('/api/community/',              fd, mp);
export const editCommunityPost      = (id, fd)    => API.put(`/api/community/${id}`,          fd, mp);
export const deleteCommunityPost    = (id)        => API.delete(`/api/community/${id}`);
export const likeCommunityPost      = (id)        => API.post(`/api/community/${id}/like`);
export const commentOnCommunityPost = (id, text)  => API.post(`/api/community/${id}/comments`, { text });
export const deleteCommunityComment = (pId, cId)  => API.delete(`/api/community/${pId}/comments/${cId}`);

// ── LOCATION TRACKING ─────────────────────────────────────────────────────────
// NEW: Live location tracking for booked jobs

/**
 * CLIENT: Capture static client location when a worker booking is confirmed.
 * Call this from ClientJobManage after a worker is accepted / job scheduled.
 * @param {string} jobId
 * @param {number} lat
 * @param {number} lng
 * @param {string} address  - optional reverse-geocoded address string
 */
export const initClientLocation = (jobId, lat, lng, address = '') =>
    API.post('/api/location/init', { jobId, lat, lng, address });

/**
 * WORKER: Push the worker's live GPS position to the server.
 * Called every 5 seconds while a job is scheduled/running.
 * @param {string} jobId
 * @param {number} lat
 * @param {number} lng
 * @param {object} extras  - { accuracy, heading, speed } — all optional
 */
export const updateWorkerLocation = (jobId, lat, lng, extras = {}) =>
    API.put('/api/location/worker/update', { jobId, lat, lng, ...extras });

/**
 * WORKER: Enable or disable live sharing for a job.
 * @param {string}  jobId
 * @param {boolean} active
 */
export const toggleWorkerLocationSharing = (jobId, active) =>
    API.put('/api/location/worker/toggle', { jobId, active });

/**
 * WORKER: Get all jobs for which location tracking is active.
 * Used on the worker dashboard to show the tracking widget.
 */
export const getWorkerTrackingJobs = () =>
    API.get('/api/location/worker/jobs');

/**
 * CLIENT + WORKER: Get the current location snapshot for a specific job.
 * Returns { clientLocation, workers[], isClient, isWorker }
 * @param {string} jobId
 */
export const getJobLocationData = (jobId) =>
    API.get(`/api/location/${jobId}`);

// ── HELPERS ───────────────────────────────────────────────────────────────────
export const getImageUrl = (path, fallback = '/admin.png') => {
    if (!path) return fallback;
    if (path.startsWith('http')) return path;
    return `${BASE_URL}/${path}`;
};

export default API;