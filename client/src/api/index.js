// client/src/api/index.js
// FIXED:
//   1. getAdminComplaints / getAdminComplaintStats / getAdminComplaintById /
//      takeAdminActionOnComplaint now clearly separated per model:
//        - /api/admin/complaints        → ClientComplaint model (client-vs-worker)
//        - /api/admin/worker-complaints → Complaint model      (worker support tickets)
//   2. Added getAdminWorkerComplaintById (was missing, caused blank detail panel)
//   3. Removed stale "getAdminComplaintById" export that pointed at the wrong route
//      and was being imported by AdminWorkerComplaints.jsx

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API = axios.create({ baseURL: BASE_URL });
API.interceptors.request.use((req) => {
    const token = localStorage.getItem('token');
    if (token) req.headers.Authorization = `Bearer ${token}`;
    return req;
});
// For FormData, let axios auto-detect and set Content-Type with boundary
const mp = {};

// ── AUTH ──────────────────────────────────────────────────────────────────────
export const sendOtp               = (d)      => API.post('/api/auth/send-otp',               d);
export const verifyOtp             = (d)      => API.post('/api/auth/verify-otp',              d);
export const registerWorker        = (fd)     => API.post('/api/auth/register/worker',         fd, mp);
export const registerClient        = (fd)     => API.post('/api/auth/register/client',         fd, mp);
export const loginWithPassword     = (d)      => API.post('/api/auth/login-password',          d);
export const loginWithOtp          = (d)      => API.post('/api/auth/login-otp',               d);
export const previewFaceSimilarity = (fd)     => API.post('/api/auth/face-similarity-preview', fd, mp);
export const getWorkerApplicationStatus = (d) => API.post('/api/auth/worker-application-status', d);
export const forgotPassword        = (d)      => API.post('/api/auth/forgot-password',         d);
export const resetPassword         = (t, d)   => API.put(`/api/auth/reset-password/${t}`,     d);

// ── ADMIN ─────────────────────────────────────────────────────────────────────
export const getAllWorkers          = ()       => API.get('/api/admin/workers');
export const getAllClients          = ()       => API.get('/api/admin/clients');
export const claimWorkerForReview   = (workerId) => API.post(`/api/admin/workers/${workerId}/claim`);
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

// Document proxy for admin profile previews (supports Cloudinary private assets)
export const proxyDocument         = (url)    => API.get('/api/admin/document-proxy', { params: { url }, responseType: 'blob' });

// ── ADMIN CLIENT-VS-WORKER COMPLAINTS ─────────────────────────────────────────
// Route: /api/admin/complaints → adminComplaintRoutes → adminComplaintController
// Model: ClientComplaint  (complaints filed by clients against workers)
// Used by: AdminClientComplaints page (NOT AdminWorkerComplaints)
export const getAdminClientComplaints         = (p = {}) => API.get('/api/admin/complaints',                { params: p });
export const getAdminClientComplaintStats     = ()        => API.get('/api/admin/complaints/stats');
export const getAdminClientComplaintById      = (id)      => API.get(`/api/admin/complaints/${id}`);
export const takeAdminClientComplaintAction   = (id, b)   => API.post(`/api/admin/complaints/${id}/action`, b);

// ── ADMIN WORKER SUPPORT TICKETS ──────────────────────────────────────────────
// Route: /api/admin/worker-complaints → adminWorkerComplaintRoutes → adminWorkerComplaintController
// Model: Complaint  (worker support tickets / worker-filed complaints)
// Used by: AdminWorkerComplaints page
export const getAdminWorkerComplaints         = (p = {}) => API.get('/api/admin/worker-complaints',                   { params: p });
export const getAdminWorkerComplaintStats     = ()        => API.get('/api/admin/worker-complaints/stats');
export const getAdminWorkerComplaintById      = (id)      => API.get(`/api/admin/worker-complaints/${id}`);            // ← FIXED: was missing
export const takeAdminWorkerComplaintAction   = (id, b)   => API.post(`/api/admin/worker-complaints/${id}/action`,    b);
export const adminReplyToComplaint            = (id, b)   => API.post(`/api/admin/worker-complaints/${id}/reply`,     b);
export const adminMarkComplaintRead           = (id)      => API.patch(`/api/admin/worker-complaints/${id}/read`);
export const adminUpdateComplaintPriority     = (id, b)   => API.patch(`/api/admin/worker-complaints/${id}/priority`, b);

// Legacy aliases kept so any other page that imported the old names doesn't break.
// New code should use the explicit names above.
/** @deprecated use getAdminClientComplaints */
export const getAdminComplaints           = getAdminClientComplaints;
/** @deprecated use getAdminClientComplaintStats */
export const getAdminComplaintStats       = getAdminClientComplaintStats;
/** @deprecated use getAdminClientComplaintById */
export const getAdminComplaintById        = getAdminClientComplaintById;
/** @deprecated use takeAdminClientComplaintAction */
export const takeAdminActionOnComplaint   = takeAdminClientComplaintAction;

// ── ADMIN COMMUNITY ───────────────────────────────────────────────────────────
export const adminGetCommunityPosts       = (page = 1)  => API.get('/api/admin/community/posts',          { params: { page } });
export const adminGetCommunityStats       = ()           => API.get('/api/admin/community/stats');
export const adminCreateCommunityPost     = (fd)         => API.post('/api/admin/community/posts',          fd, mp);
export const adminEditCommunityPost       = (id, fd)     => API.put(`/api/admin/community/posts/${id}`,     fd, mp);
export const adminDeleteCommunityPost     = (id, reason) => API.delete(`/api/admin/community/posts/${id}`,  { data: { reason } });
export const adminHardDeleteCommunityPost = (id)         => API.delete(`/api/admin/community/posts/${id}/hard`);
export const adminRestoreCommunityPost    = (id)         => API.post(`/api/admin/community/posts/${id}/restore`);

// ── ADMIN SHOPS ───────────────────────────────────────────────────────────────
export const adminGetAllShops          = ()        => API.get('/api/admin/shops');
export const adminGetShopById          = (id)      => API.get(`/api/admin/shops/${id}`);
export const adminApproveShop          = (id)      => API.patch(`/api/admin/shops/${id}/approve`);
export const adminRejectShop           = (id, b)   => API.patch(`/api/admin/shops/${id}/reject`, b);
export const adminBlockShop            = (id)      => API.patch(`/api/admin/shops/${id}/block`);
export const adminDeleteShop           = (id)      => API.delete(`/api/admin/shops/${id}`);
export const adminGetAllCoupons        = ()        => API.get('/api/admin/shops/coupons');
export const adminGetUnclaimedCoupons  = ()        => API.get('/api/admin/shops/coupons/unclaimed');
export const adminGetCouponHistory     = ()        => API.get('/api/admin/shops/coupons/history');

// ── SHOP AUTH ─────────────────────────────────────────────────────────────────
export const shopSendMobileOtp   = (d)  => API.post('/api/shop/auth/send-mobile-otp',   d);
export const shopVerifyMobileOtp = (d)  => API.post('/api/shop/auth/verify-mobile-otp', d);
export const shopSendEmailOtp    = (d)  => API.post('/api/shop/auth/send-email-otp',    d);
export const shopVerifyEmailOtp  = (d)  => API.post('/api/shop/auth/verify-email-otp',  d);
export const shopSendLoginOtp    = (d)  => API.post('/api/shop/auth/send-login-otp',    d);
export const shopVerifyLoginOtp  = (d)  => API.post('/api/shop/auth/verify-login-otp',  d);
export const shopRegister        = (fd) => API.post('/api/shop/auth/register',           fd, mp);
export const shopLogin           = (d)  => API.post('/api/shop/auth/login',              d);

// ── SHOP DASHBOARD ────────────────────────────────────────────────────────────
export const getShopProfile      = ()       => API.get('/api/shop/profile');
export const updateShopProfile   = (fd)     => API.put('/api/shop/profile',               fd, mp);export const deleteShopAccount   = ()       => API.delete('/api/shop/account/delete');export const getShopProducts     = ()       => API.get('/api/shop/products');
export const addShopProduct      = (fd)     => API.post('/api/shop/products',              fd, mp);
export const editShopProduct     = (id, fd) => API.put(`/api/shop/products/${id}`,        fd, mp);
export const deleteShopProduct   = (id)     => API.delete(`/api/shop/products/${id}`);
export const verifyCoupon        = (d)      => API.post('/api/shop/coupons/verify',        d);
export const applyCoupon         = (fd)     => API.post('/api/shop/coupons/apply',         fd, mp);
export const getShopTransactions = ()       => API.get('/api/shop/transactions');
export const getShopAnalytics    = ()       => API.get('/api/shop/analytics');

// ── WORKER COUPON ─────────────────────────────────────────────────────────────
export const generateMyCoupon = ()  => API.post('/api/worker/coupons/generate');
export const getMyCoupons     = ()  => API.get('/api/worker/coupons/my');
export const getCouponByCode  = (code) => API.get(`/api/worker/coupons/code/${code}`);

// ── WORKER PURCHASE HISTORY ───────────────────────────────────────────────────
export const getWorkerPurchaseHistory = () => API.get('/api/worker/purchase-history');
// ── WORKER — PUBLIC SHOP BROWSING ─────────────────────────────────────────────
export const getApprovedShops      = ()         => API.get('/api/shop/public/all');
export const getShopPublicProducts = (shopId)   => API.get(`/api/shop/public/${shopId}/products`);

// ── WORKER ────────────────────────────────────────────────────────────────────
export const getAvailableJobs               = ()              => API.get('/api/worker/jobs');
export const getJobDetails                  = (jobId)         => API.get(`/api/worker/jobs/${jobId}/details`);
export const applyForJob                    = (jobId, skills, extra = {}) => {
    const payload = Array.isArray(skills)
        ? { selectedSkills: skills, ...extra }
        : { ...skills, ...extra };
    return API.post(`/api/worker/jobs/${jobId}/apply`, payload);
};
export const cancelPendingJobApplication    = (jobId)         => API.patch(`/api/worker/jobs/${jobId}/application/cancel`);
export const workerCancelJob                = (jobId, reason) => API.patch(`/api/worker/jobs/${jobId}/cancel`, { reason });
export const getWorkerBookings              = ()              => API.get('/api/worker/bookings');
export const getWorkerAnalytics             = ()              => API.get('/api/worker/analytics');
export const getNearClients                 = ()              => API.get('/api/worker/near-clients');
export const getDirectInvites               = ()              => API.get('/api/worker/invites/direct');
export const getWorkerDirectHires           = ()              => API.get('/api/worker/direct-hires');
export const acceptDirectInvite             = (jobId)         => API.post(`/api/worker/invites/${jobId}/accept`);
export const rejectDirectInvite             = (jobId)         => API.post(`/api/worker/invites/${jobId}/reject`);
export const acceptDirectHireTicket         = (jobId)         => API.post(`/api/worker/direct-hires/${jobId}/accept`);
export const rejectDirectHireTicket         = (jobId)         => API.post(`/api/worker/direct-hires/${jobId}/reject`);
export const getWorkerProfile               = ()              => API.get('/api/worker/profile');
export const getWorkerDailyProfile          = ()              => API.get('/api/worker/daily-profile');
export const updateWorkerDailyProfile       = (body)          => API.put('/api/worker/daily-profile', body);
export const updateWorkerProfile            = (fd)            => API.put('/api/worker/profile/update',         fd, mp);
export const toggleAvailability             = (d = {})        => API.post('/api/worker/availability',           d);
export const deleteAccount                  = ()              => API.delete('/api/worker/account/delete');
export const getPublicWorkerProfile         = (id)            => API.get(`/api/worker/public/${id}`);
export const getAllKarigars                 = ()              => API.get('/api/worker/all');
export const getLeaderboard                 = ()              => API.get('/api/worker/leaderboard');
export const getMyFeedback                  = ()              => API.get('/api/worker/feedback');

// Admin user profile access (generic by _id or karigarId)
export const getAdminUserProfile            = (identifier)    => API.get(`/api/admin/users/${identifier}`);
export const respondToGroupJob              = (d)             => API.post('/api/worker/group-job/respond',      d);


// ── WORKER SETTINGS — Password change ────────────────────────────────────────
export const sendPasswordChangeOtp    = ()  => API.post('/api/worker/settings/password/send-otp');
export const verifyPasswordChangeOtp  = (d) => API.post('/api/worker/settings/password/verify-otp',  d);
export const changePasswordWithOtp    = (d) => API.post('/api/worker/settings/password/change',       d);
export const deleteAccountPermanently = (d) => API.delete('/api/worker/account/delete-permanent',     { data: d });

// ── CLIENT SETTINGS — Password change ────────────────────────────────────────
export const sendClientPasswordChangeOtp   = ()  => API.post('/api/client/settings/password/send-otp');
export const verifyClientPasswordChangeOtp = (d) => API.post('/api/client/settings/password/verify-otp', d);
export const changeClientPasswordWithOtp   = (d) => API.post('/api/client/settings/password/change', d);

// ── WORKER COMPLAINTS & SUPPORT ───────────────────────────────────────────────
export const fileComplaint            = (d)     => API.post('/api/worker/complaints/file',            d);
export const getMyComplaints          = ()       => API.get('/api/worker/complaints');
export const getMyComplaintById       = (id)     => API.get(`/api/worker/complaints/${id}`);
export const deleteMyComplaint        = (id)     => API.delete(`/api/worker/complaints/${id}`);
export const sendComplaintMessage     = (id, d)  => API.post(`/api/worker/complaints/${id}/message`,  d);
export const markComplaintRead        = (id)     => API.patch(`/api/worker/complaints/${id}/read`);
export const searchClientForComplaint = (q)      => API.get('/api/worker/complaints/search-client',   { params: { query: q } });

// ── CLIENT ────────────────────────────────────────────────────────────────────
export const getClientProfile           = ()      => API.get('/api/client/profile');
export const getClientDocumentPreviewUrl = (url)  => API.get('/api/client/profile/document-preview-url', { params: { url } });
export const verifyAssignedWorkerFace   = (fd)    => API.post('/api/client/face/verify-assigned-worker', fd, mp);
export const updateClientProfile        = (fd)    => API.put('/api/client/profile/update',          fd, mp);
export const deleteClientAccount        = ()      => API.delete('/api/client/account/delete');
export const getWorkerFullProfile       = (wId)   => API.get(`/api/client/workers/${wId}/profile`);
export const generateWorkerProfileSummary = (wId) => API.get(`/api/client/workers/${wId}/profile-summary`);
export const toggleStarWorker           = (wId)   => API.post('/api/client/star/worker',            { workerId: wId });
export const getDirectHireSuggestedAmount = (body) => API.post('/api/client/direct-hires/amount', body);
export const createDirectHireTicket       = (body) => API.post('/api/client/direct-hires', body);
export const getClientDirectHireTickets   = ()     => API.get('/api/client/direct-hires');
export const logDirectHireCallIntent    = (jobId) => API.post(`/api/client/direct-hires/${jobId}/call-intent`);
export const sendDirectHireStartOtp     = (jobId) => API.post(`/api/client/direct-hires/${jobId}/start-otp/send`);
export const verifyDirectHireStartOtp   = (jobId, body) => API.post(`/api/client/direct-hires/${jobId}/start-otp/verify`, body);
export const sendDirectHireCompletionOtp = (jobId, body = {}) => API.post(`/api/client/direct-hires/${jobId}/completion-otp/send`, body);
export const verifyDirectHireCompletionOtp = (jobId, body) => API.post(`/api/client/direct-hires/${jobId}/completion-otp/verify`, body);

export const getClientJobs              = ()                              => API.get('/api/client/jobs');
export const postJob                    = (fd)                            => API.post('/api/client/jobs/post',              fd, mp);
export const deleteClientJob            = (id)                            => API.delete(`/api/client/jobs/${id}`);
export const permanentlyDeleteHistoryJob = (id)                           => API.delete(`/api/client/jobs/${id}/permanent`);
export const permanentlyDeleteSelectedHistoryJobs = (jobIds = [])         => API.post('/api/client/jobs/history/delete-selected', { jobIds });
export const permanentlyDeleteAllHistoryJobs = ()                         => API.delete('/api/client/jobs/history/delete-all');
export const updateJobStatus            = (id, status, options = {})      => API.patch(`/api/client/jobs/${id}/status`,    { status, ...options });
export const cancelJob                  = (id, reason)                    => API.patch(`/api/client/jobs/${id}/cancel`,    { reason });
export const startJob                   = (id)                            => API.patch(`/api/client/jobs/${id}/start`);
export const toggleJobApplications      = (id)                            => API.patch(`/api/client/jobs/${id}/toggle-applications`);
export const removeAssignedWorker       = (id, workerId, reason, slotId)  => API.patch(`/api/client/jobs/${id}/remove-worker`, { workerId, reason, slotId });
export const completeWorkerTask         = (id, workerId, slotId, options = {}) => API.patch(`/api/client/jobs/${id}/complete-worker-task`, { workerId, slotId, ...options });
export const completeSubTask            = (id, subTaskId)                 => API.patch(`/api/client/jobs/${id}/subtask/complete`,     { subTaskId });
export const uploadCompletionPhotos     = (id, fd)                        => API.post(`/api/client/jobs/${id}/completion-photos`,     fd, mp);
export const removeCompletionPhoto      = (id, photoIndex)                => API.delete(`/api/client/jobs/${id}/completion-photos/${photoIndex}`);
export const getJobApplicants           = (jobId)                         => API.get(`/api/client/jobs/${jobId}/applicants`);
export const getJobSmartSuggestions     = (jobId)                         => API.get(`/api/client/jobs/${jobId}/smart-suggestions`);
export const inviteWorkersToJob         = (jobId, workerIds = [], inviteSkill = '') => API.post(`/api/client/jobs/${jobId}/invite`, { workerIds, inviteSkill });
export const respondToApplicant         = (jobId, d)                      => API.post(`/api/client/jobs/${jobId}/respond`,  d);
export const hireWorker                 = (jobId, wId)                    => API.post(`/api/client/jobs/${jobId}/hire`,    { workerId: wId });
export const submitRating               = (jobId, d)                      => API.post(`/api/client/jobs/${jobId}/rate`,    d);

// ── SEMANTIC MATCHING ───────────────────────────────────────────────────────
export const getSemanticWorkersForJob = (jobId, params = {}) => API.get(`/api/matching/jobs/${jobId}/workers`, { params });
export const getSemanticJobsForWorker = (params = {}) => API.get('/api/matching/worker/jobs', { params });
export const recordSemanticFeedback = (payload) => API.post('/api/matching/feedback', payload);

export const repostMissingSkill = (id, d, newDate, newTime) => {
    const payload = typeof d === 'object' && d !== null ? d : { slotId: d, newScheduledDate: newDate, newScheduledTime: newTime };
    return API.post(`/api/client/jobs/${id}/repost-skill`, payload);
};
export const cancelSlotRequirement      = (id, slotId) => API.patch(`/api/client/jobs/${id}/cancel-slot`,    { slotId });
export const dismissMissingSkill        = (id, slotId) => API.patch(`/api/client/jobs/${id}/cancel-slot`,    { slotId });
export const respondToSubTaskApplicant  = (id, d)      => API.post(`/api/client/jobs/${id}/subtask/respond`, d);
export const applyForSubTask            = (parentJobId, subTaskId) => API.post(`/api/worker/jobs/${parentJobId}/subtask/${subTaskId}/apply`);

// ── NOTIFICATIONS ───────────────────────────────────────────────────────────
export const getClientNotifications         = ()   => API.get('/api/client/notifications');
export const markClientNotificationRead     = (id) => API.patch(`/api/client/notifications/${id}/read`);
export const markAllClientNotificationsRead = ()   => API.patch('/api/client/notifications/mark-all-read');
export const deleteClientNotification       = (id) => API.delete(`/api/client/notifications/${id}`);
export const clearAllClientNotifications    = ()   => API.delete('/api/client/notifications/clear-all');

export const getWorkerNotifications         = ()   => API.get('/api/worker/notifications');
export const markWorkerNotificationRead     = (id) => API.patch(`/api/worker/notifications/${id}/read`);
export const markAllWorkerNotificationsRead = ()   => API.patch('/api/worker/notifications/mark-all-read');
export const deleteWorkerNotification       = (id) => API.delete(`/api/worker/notifications/${id}`);
export const clearAllWorkerNotifications    = ()   => API.delete('/api/worker/notifications/clear-all');

// ADMIN NOTIFICATIONS
export const getAdminNotifications         = ()   => API.get('/api/admin/notifications');
export const markAdminNotificationRead     = (id) => API.patch(`/api/admin/notifications/${id}/read`);
export const markAllAdminNotificationsRead = ()   => API.patch('/api/admin/notifications/mark-all-read');
export const deleteAdminNotification       = (id) => API.delete(`/api/admin/notifications/${id}`);
export const clearAllAdminNotifications    = ()   => API.delete('/api/admin/notifications/clear-all');
export const getAdminPendingDirectHirePayments = () => API.get('/api/admin/direct-hires/pending-payments');
export const adminUnblockDirectHireClient      = (jobId) => API.post(`/api/admin/direct-hires/${jobId}/unblock-client`);

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
export const getRateTableCities  = ()   => API.get('/api/ai/rate-table-cities');
export const startAIAssistant    = (fd) => API.post('/api/ai/assistant',                fd, mp);
export const getAIAdvisorReport  = (fd) => API.post('/api/ai/advisor',                  fd, mp);
export const aiGeneratePreviews  = (fd) => API.post('/api/ai/generate-preview-images',  fd, mp);

// ── GROUPS ────────────────────────────────────────────────────────────────────
export const createGroupAPI = (d)        => API.post('/api/groups',              d);
export const getMyGroupsAPI = ()         => API.get('/api/groups/my');
export const addMemberAPI   = (gId, userId) => API.put(`/api/groups/${gId}/add`,   { userId });
export const deleteGroupAPI = (gId)      => API.delete(`/api/groups/${gId}`);
export const leaveGroupAPI  = (gId)      => API.put(`/api/groups/${gId}/leave`, {});
export const hireGroupJob   = (d)        => API.post('/api/jobs/group/hire',     d);
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
export const initClientLocation          = (jobId, lat, lng, address = '') => API.post('/api/location/init',           { jobId, lat, lng, address });
export const updateWorkerLocation        = (jobId, lat, lng, extras = {})  => API.put('/api/location/worker/update',   { jobId, lat, lng, ...extras });
export const toggleWorkerLocationSharing = (jobId, active)                 => API.put('/api/location/worker/toggle',   { jobId, active });
export const getWorkerTrackingJobs       = ()                              => API.get('/api/location/worker/jobs');
export const getJobLocationData          = (jobId)                         => API.get(`/api/location/${jobId}`);

// ── HELPERS ───────────────────────────────────────────────────────────────────
export const getImageUrl = (path, fallback = '/admin.png') => {
    if (!path) return fallback;
    if (path.startsWith('http')) return path;
    return `${BASE_URL}/${path}`;
};


export default API;