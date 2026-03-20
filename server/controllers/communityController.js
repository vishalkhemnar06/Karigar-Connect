// server/controllers/communityController.js
const CommunityPost = require('../models/communityPostModel');
const mongoose      = require('mongoose');
const { getMediaUrl, getMediaType } = require('../middleware/communityUpload');

const POPULATE_AUTHOR  = 'name photo karigarId skills overallExperience';
const POPULATE_COMMENT = 'name photo karigarId';

// ─────────────────────────────────────────────────────────────────────────────
// WORKER — GET /api/community/?page=1
// ─────────────────────────────────────────────────────────────────────────────
exports.getPosts = async (req, res) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(20, parseInt(req.query.limit) || 10);

        const total = await CommunityPost.countDocuments({ deletedByAdmin: false });
        const posts = await CommunityPost.find({ deletedByAdmin: false })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('author',          POPULATE_AUTHOR)
            .populate('comments.author', POPULATE_COMMENT)
            .lean();

        return res.status(200).json({ posts, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) {
        console.error('getPosts error:', err);
        return res.status(500).json({ message: 'Failed to fetch posts.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// WORKER — POST /api/community/
// ─────────────────────────────────────────────────────────────────────────────
exports.createPost = async (req, res) => {
    try {
        const { content } = req.body;
        const authorId    = req.user._id || req.user.id;

        if (!content || !content.trim()) {
            return res.status(400).json({ message: 'Post content is required.' });
        }
        if (content.trim().length > 2000) {
            return res.status(400).json({ message: 'Content must be under 2000 characters.' });
        }

        const mediaUrl  = getMediaUrl(req, req.file);
        const mediaType = getMediaType(req.file);

        console.log('[createPost] file:', req.file?.originalname, '| mediaUrl:', mediaUrl);

        const post = await CommunityPost.create({
            author:     authorId,
            authorType: 'worker',
            content:    content.trim(),
            mediaUrl,
            mediaType,
        });

        const populated = await CommunityPost.findById(post._id)
            .populate('author', POPULATE_AUTHOR)
            .lean();

        return res.status(201).json({ message: 'Post created.', post: populated });
    } catch (err) {
        console.error('createPost error:', err);
        return res.status(500).json({ message: 'Failed to create post.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// WORKER — PUT /api/community/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.editPost = async (req, res) => {
    try {
        const { content } = req.body;
        const authorId    = String(req.user._id || req.user.id);

        const post = await CommunityPost.findById(req.params.id);
        if (!post)                              return res.status(404).json({ message: 'Post not found.' });
        if (String(post.author) !== authorId)   return res.status(403).json({ message: 'You can only edit your own posts.' });
        if (post.deletedByAdmin)                return res.status(403).json({ message: 'This post has been removed by admin.' });

        if (content && content.trim()) post.content = content.trim();

        if (req.file) {
            post.mediaUrl  = getMediaUrl(req, req.file);
            post.mediaType = getMediaType(req.file);
        }

        await post.save();

        const populated = await CommunityPost.findById(post._id)
            .populate('author',          POPULATE_AUTHOR)
            .populate('comments.author', POPULATE_COMMENT)
            .lean();

        return res.status(200).json({ message: 'Post updated.', post: populated });
    } catch (err) {
        console.error('editPost error:', err);
        return res.status(500).json({ message: 'Failed to update post.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// WORKER — DELETE /api/community/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.deletePost = async (req, res) => {
    try {
        const authorId = String(req.user._id || req.user.id);
        const post     = await CommunityPost.findById(req.params.id);
        if (!post)                            return res.status(404).json({ message: 'Post not found.' });
        if (String(post.author) !== authorId) return res.status(403).json({ message: 'You can only delete your own posts.' });

        await CommunityPost.findByIdAndDelete(req.params.id);
        return res.status(200).json({ message: 'Post deleted.' });
    } catch (err) {
        console.error('deletePost error:', err);
        return res.status(500).json({ message: 'Failed to delete post.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// WORKER — POST /api/community/:id/like
// ─────────────────────────────────────────────────────────────────────────────
exports.toggleLike = async (req, res) => {
    try {
        const userId = String(req.user._id || req.user.id);
        const post   = await CommunityPost.findById(req.params.id);
        if (!post || post.deletedByAdmin) return res.status(404).json({ message: 'Post not found.' });

        const idx = post.likes.findIndex(id => String(id) === userId);
        if (idx === -1) { post.likes.push(userId); }
        else            { post.likes.splice(idx, 1); }

        await post.save();
        return res.status(200).json({ liked: idx === -1, likeCount: post.likes.length });
    } catch (err) {
        console.error('toggleLike error:', err);
        return res.status(500).json({ message: 'Failed to update like.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// WORKER — POST /api/community/:id/comments
// Workers can comment only on worker posts, NOT admin posts
// ─────────────────────────────────────────────────────────────────────────────
exports.addComment = async (req, res) => {
    try {
        const { text } = req.body;
        const userId   = req.user._id || req.user.id;

        if (!text || !text.trim())         return res.status(400).json({ message: 'Comment text is required.' });
        if (text.trim().length > 500)      return res.status(400).json({ message: 'Comment must be under 500 characters.' });

        const post = await CommunityPost.findById(req.params.id);
        if (!post || post.deletedByAdmin)  return res.status(404).json({ message: 'Post not found.' });
        if (post.authorType === 'admin')   return res.status(403).json({ message: 'Comments are disabled on admin posts.' });

        post.comments.push({ author: userId, text: text.trim() });
        await post.save();

        const populated = await CommunityPost.findById(post._id)
            .populate('author',          POPULATE_AUTHOR)
            .populate('comments.author', POPULATE_COMMENT)
            .lean();

        return res.status(201).json({ message: 'Comment added.', post: populated });
    } catch (err) {
        console.error('addComment error:', err);
        return res.status(500).json({ message: 'Failed to add comment.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// WORKER — DELETE /api/community/:id/comments/:commentId
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteComment = async (req, res) => {
    try {
        const userId  = String(req.user._id || req.user.id);
        const post    = await CommunityPost.findById(req.params.id);
        if (!post) return res.status(404).json({ message: 'Post not found.' });

        const comment = post.comments.id(req.params.commentId);
        if (!comment)                              return res.status(404).json({ message: 'Comment not found.' });
        if (String(comment.author) !== userId)     return res.status(403).json({ message: 'You can only delete your own comments.' });

        comment.deleteOne();
        await post.save();
        return res.status(200).json({ message: 'Comment deleted.' });
    } catch (err) {
        console.error('deleteComment error:', err);
        return res.status(500).json({ message: 'Failed to delete comment.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — POST /api/admin/community/posts
// ─────────────────────────────────────────────────────────────────────────────
exports.adminCreatePost = async (req, res) => {
    try {
        const { content } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ message: 'Content is required.' });
        }

        const mediaUrl  = getMediaUrl(req, req.file);
        const mediaType = getMediaType(req.file);

        console.log('[adminCreatePost] file:', req.file?.originalname, '| mediaUrl:', mediaUrl);

        const post = await CommunityPost.create({
            author:     null,
            authorType: 'admin',
            content:    content.trim(),
            mediaUrl,
            mediaType,
        });

        return res.status(201).json({ message: 'Admin post created.', post });
    } catch (err) {
        console.error('adminCreatePost error:', err);
        return res.status(500).json({ message: 'Failed to create post.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — PUT /api/admin/community/posts/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.adminEditPost = async (req, res) => {
    try {
        const post = await CommunityPost.findById(req.params.id);
        if (!post)                           return res.status(404).json({ message: 'Post not found.' });
        if (post.authorType !== 'admin')     return res.status(403).json({ message: 'You can only edit admin posts.' });

        const { content } = req.body;
        if (content && content.trim()) post.content = content.trim();

        if (req.file) {
            post.mediaUrl  = getMediaUrl(req, req.file);
            post.mediaType = getMediaType(req.file);
        }

        await post.save();
        return res.status(200).json({ message: 'Post updated.', post });
    } catch (err) {
        console.error('adminEditPost error:', err);
        return res.status(500).json({ message: 'Failed to update post.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — DELETE /api/admin/community/posts/:id  (soft-delete any post)
// ─────────────────────────────────────────────────────────────────────────────
exports.adminDeletePost = async (req, res) => {
    try {
        const { reason } = req.body;
        const post       = await CommunityPost.findById(req.params.id);
        if (!post) return res.status(404).json({ message: 'Post not found.' });

        post.deletedByAdmin = true;
        post.deletionReason = reason?.trim() || 'Removed by admin.';
        post.deletedAt      = new Date();
        await post.save();

        return res.status(200).json({ message: 'Post removed.', post });
    } catch (err) {
        console.error('adminDeletePost error:', err);
        return res.status(500).json({ message: 'Failed to remove post.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — DELETE /api/admin/community/posts/:id/hard
// ─────────────────────────────────────────────────────────────────────────────
exports.adminHardDeletePost = async (req, res) => {
    try {
        const post = await CommunityPost.findById(req.params.id);
        if (!post)                       return res.status(404).json({ message: 'Post not found.' });
        if (post.authorType !== 'admin') return res.status(403).json({ message: 'You can only permanently delete your own admin posts.' });

        await CommunityPost.findByIdAndDelete(req.params.id);
        return res.status(200).json({ message: 'Post permanently deleted.' });
    } catch (err) {
        console.error('adminHardDeletePost error:', err);
        return res.status(500).json({ message: 'Failed to delete post.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — POST /api/admin/community/posts/:id/restore
// ─────────────────────────────────────────────────────────────────────────────
exports.adminRestorePost = async (req, res) => {
    try {
        const post = await CommunityPost.findById(req.params.id);
        if (!post) return res.status(404).json({ message: 'Post not found.' });

        post.deletedByAdmin = false;
        post.deletionReason = null;
        post.deletedAt      = null;
        await post.save();

        return res.status(200).json({ message: 'Post restored.', post });
    } catch (err) {
        console.error('adminRestorePost error:', err);
        return res.status(500).json({ message: 'Failed to restore post.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — GET /api/admin/community/posts
// ─────────────────────────────────────────────────────────────────────────────
exports.adminGetAllPosts = async (req, res) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(30, parseInt(req.query.limit) || 15);

        const total = await CommunityPost.countDocuments({});
        const posts = await CommunityPost.find({})
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('author',          POPULATE_AUTHOR)
            .populate('comments.author', POPULATE_COMMENT)
            .lean();

        return res.status(200).json({ posts, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) {
        console.error('adminGetAllPosts error:', err);
        return res.status(500).json({ message: 'Failed to fetch posts.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — GET /api/admin/community/stats
// ─────────────────────────────────────────────────────────────────────────────
exports.adminGetStats = async (req, res) => {
    try {
        const [total, active, removed, adminPosts, workerPosts] = await Promise.all([
            CommunityPost.countDocuments({}),
            CommunityPost.countDocuments({ deletedByAdmin: false }),
            CommunityPost.countDocuments({ deletedByAdmin: true }),
            CommunityPost.countDocuments({ authorType: 'admin',  deletedByAdmin: false }),
            CommunityPost.countDocuments({ authorType: 'worker', deletedByAdmin: false }),
        ]);
        return res.status(200).json({ total, active, removed, adminPosts, workerPosts });
    } catch (err) {
        return res.status(500).json({ message: 'Failed to fetch stats.' });
    }
};