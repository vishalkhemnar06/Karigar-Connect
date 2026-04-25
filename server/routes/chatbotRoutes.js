const express = require('express');
const router = express.Router();
const { protect, client } = require('../middleware/authMiddleware');
const { clientChatQuery, clientChatSuggestions } = require('../controllers/clientChatbotController');
const { guestChatQuery, guestChatSuggestions, guestChatMeta } = require('../controllers/guestChatbotController');
const { chatbotSecurityGate } = require('../middleware/chatbotSecurityMiddleware');

router.post('/client/query', protect, client, chatbotSecurityGate, clientChatQuery);
router.get('/client/suggestions', protect, client, clientChatSuggestions);

router.post('/guest/query', guestChatQuery);
router.get('/guest/suggestions', guestChatSuggestions);
router.get('/guest/meta', guestChatMeta);

module.exports = router;
