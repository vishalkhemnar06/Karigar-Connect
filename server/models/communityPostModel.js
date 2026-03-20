// server/models/communityPostModel.js
const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    author:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text:      { type: String, required: true, maxlength: 500 },
    createdAt: { type: Date, default: Date.now },
});

const communityPostSchema = new mongoose.Schema({
    // Author — ObjectId for workers, null for admin posts
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },

    // 'worker' | 'admin'
    authorType: {
        type: String,
        enum: ['worker', 'admin'],
        default: 'worker',
    },

    content: {
        type: String,
        required: true,
        maxlength: 2000,
    },

    // Supports image, video, or any media URL (Cloudinary)
    mediaUrl:  { type: String, default: null },   // public URL
    mediaType: {
        type: String,
        enum: ['image', 'video', null],
        default: null,
    },

    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Only workers can comment; admin posts allow likes only
    comments: [commentSchema],

    // Admin soft-delete
    deletedByAdmin:  { type: Boolean, default: false },
    deletionReason:  { type: String, default: null },
    deletedAt:       { type: Date, default: null },

}, { timestamps: true });

communityPostSchema.index({ createdAt: -1 });
communityPostSchema.index({ authorType: 1 });

module.exports = mongoose.model('CommunityPost', communityPostSchema);