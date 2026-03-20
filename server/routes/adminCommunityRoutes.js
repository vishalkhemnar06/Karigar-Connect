// server/routes/adminCommunityRoutes.js — FIXED
const express = require('express');
const router  = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { communityUpload } = require('../middleware/communityUpload');
const {
    adminGetAllPosts,
    adminCreatePost,
    adminEditPost,
    adminDeletePost,
    adminHardDeletePost,
    adminRestorePost,
    adminGetStats,
} = require('../controllers/communityController');

router.get('/stats',               protect, admin, adminGetStats);
router.get('/posts',               protect, admin, adminGetAllPosts);
router.post('/posts',              communityUpload.single('media'), protect, admin, adminCreatePost);
router.put('/posts/:id',           communityUpload.single('media'), protect, admin, adminEditPost);
router.delete('/posts/:id',        protect, admin, adminDeletePost);
router.delete('/posts/:id/hard',   protect, admin, adminHardDeletePost);
router.post('/posts/:id/restore',  protect, admin, adminRestorePost);

module.exports = router;