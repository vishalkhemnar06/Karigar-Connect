// server/routes/communityRoutes.js — FIXED
// Uses communityUpload middleware which saves to Cloudinary
// and produces a real public URL stored in post.mediaUrl

const express = require('express');
const router  = express.Router();
const { protect, worker } = require('../middleware/authMiddleware');
const { communityUpload } = require('../middleware/communityUpload');
const {
    getPosts,
    createPost,
    editPost,
    deletePost,
    toggleLike,
    addComment,
    deleteComment,
} = require('../controllers/communityController');

// Field name 'media' matches the frontend FormData key
router.get('/',                                              protect, worker, getPosts);
router.post('/',           communityUpload.single('media'), protect, worker, createPost);
router.put('/:id',         communityUpload.single('media'), protect, worker, editPost);
router.delete('/:id',                                        protect, worker, deletePost);
router.post('/:id/like',                                     protect, worker, toggleLike);
router.post('/:id/comments',                                 protect, worker, addComment);
router.delete('/:id/comments/:commentId',                    protect, worker, deleteComment);

module.exports = router;