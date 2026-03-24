const express = require('express');

const {
    twilioVoiceWebhook,
    twilioStateHandler,
} = require('../controllers/ivrController');

const router = express.Router();

// Twilio IVR webhooks (webhook from Twilio)
router.post('/twilio/voice', twilioVoiceWebhook);
router.post('/twilio/state', twilioStateHandler);

module.exports = router;
