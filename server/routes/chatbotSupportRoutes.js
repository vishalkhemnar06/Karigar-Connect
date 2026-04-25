const express = require('express');
const router = express.Router();

const { protect, admin, client } = require('../middleware/authMiddleware');
const {
    requestHumanSupport,
    getMySupportRequest,
    sendClientSupportMessage,
    closeMySupportRequest,
    listSupportRequests,
    getSupportRequestById,
    acceptSupportRequest,
    rejectSupportRequest,
    sendAdminSupportMessage,
    closeSupportRequest,
    deleteSupportRequest,
} = require('../controllers/chatbotSupportController');

router.post('/request', protect, client, requestHumanSupport);
router.get('/current', protect, client, getMySupportRequest);
router.post('/message', protect, client, sendClientSupportMessage);
router.post('/close', protect, client, closeMySupportRequest);

router.get('/admin', protect, admin, listSupportRequests);
router.get('/admin/:id', protect, admin, getSupportRequestById);
router.post('/admin/:id/accept', protect, admin, acceptSupportRequest);
router.post('/admin/:id/reject', protect, admin, rejectSupportRequest);
router.post('/admin/:id/message', protect, admin, sendAdminSupportMessage);
router.post('/admin/:id/close', protect, admin, closeSupportRequest);
router.delete('/admin/:id', protect, admin, deleteSupportRequest);

module.exports = router;
