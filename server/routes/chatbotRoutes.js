const express = require('express');
const router = express.Router();
const { protect, client } = require('../middleware/authMiddleware');
const { clientChatQuery, clientChatSuggestions } = require('../controllers/clientChatbotController');
const { chatbotSecurityGate } = require('../middleware/chatbotSecurityMiddleware');

router.post('/client/query', protect, client, chatbotSecurityGate, clientChatQuery);
router.get('/client/suggestions', protect, client, clientChatSuggestions);

module.exports = router;
