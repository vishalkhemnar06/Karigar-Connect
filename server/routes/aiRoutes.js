// server/routes/aiRoutes.js
const express  = require('express');
const router   = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    generateQuestions,
    generateEstimate,
    generateAdvisorReport,   // NEW
    generatePreviewImages,
    startConversation,
} = require('../controllers/aiAssistantController');
const { aiImageUploader } = require('../utils/cloudinary');

// Stage 1: Generate clarifying questions based on work description
// POST /api/ai/generate-questions
router.post('/generate-questions', protect, generateQuestions);

// Stage 2: Full structured estimate with component-based budget
// POST /api/ai/generate-estimate
router.post('/generate-estimate', protect, generateEstimate);

// NEW: Full advisory report — work plan, materials, cost, time, design, workers
// POST /api/ai/advisor
router.post('/advisor', protect, aiImageUploader.single('workImage'), generateAdvisorReport);

// NEW: Before-vs-after image preview generation
// POST /api/ai/generate-preview-images
router.post('/generate-preview-images', protect, aiImageUploader.single('workImage'), generatePreviewImages);

// Legacy endpoint (backward compat for ClientAIAssist.jsx)
// POST /api/ai/assistant
router.post('/assistant', protect, aiImageUploader.single('workImage'), startConversation);

module.exports = router;
