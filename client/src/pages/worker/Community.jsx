// src/pages/worker/Community.jsx — Enhanced with Modern UI + Mobile Optimized (Centered Modal)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../../api';
import { getImageUrl } from '../../constants/config';
import toast from 'react-hot-toast';
import {
    Heart, MessageCircle, Edit2, Trash2, Send, X,
    Image as ImageIcon, Video, Plus, Loader2, MoreVertical,
    ChevronDown, RefreshCw, Users, Shield, ZoomIn, Play, Maximize2,
    Sparkles, Award, TrendingUp, Camera, Music, Smile, 
    Gift, Star, Crown, Flame, Share2, Bookmark, Flag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── helpers ───────────────────────────────────────────────────────────────────
const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const Avatar = ({ user, size = 10, isAdmin = false }) => {
  const sizeMap = {
    8: 'w-8 h-8',
    10: 'w-10 h-10',
    11: 'w-11 h-11',
  };
  const sizeClass = sizeMap[size] || `w-${size} h-${size}`;

  if (isAdmin) {
    return (
      <div className={`${sizeClass} rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center flex-shrink-0 border-2 border-orange-200 shadow-md`}>
        <Shield size={size === 10 ? 18 : 14} className="text-white" />
      </div>
    );
  }

  const imageSrc = getImageUrl(
    user?.photo,
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'W')}&background=f97316&color=fff&bold=true`
  );

  return (
    <img
      src={imageSrc}
      alt={user?.name}
      className={`${sizeClass} rounded-2xl object-cover border-2 border-orange-100 flex-shrink-0 shadow-sm`}
      onError={(e) => {
        e.target.src = `https://ui-avatars.com/api/?name=W&background=f97316&color=fff&bold=true`;
      }}
    />
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LIGHTBOX — Enhanced fullscreen overlay (Mobile Optimized)
// ─────────────────────────────────────────────────────────────────────────────
const Lightbox = ({ mediaUrl, mediaType, onClose }) => {
    const videoRef = useRef(null);
    const [isLandscape, setIsLandscape] = useState(false);

    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', handler);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    useEffect(() => {
        if (mediaType === 'video' && videoRef.current) {
            videoRef.current.play().catch(() => {});
        }
    }, [mediaType]);

    useEffect(() => {
        const checkOrientation = () => {
            setIsLandscape(window.innerWidth > window.innerHeight);
        };
        checkOrientation();
        window.addEventListener('resize', checkOrientation);
        return () => window.removeEventListener('resize', checkOrientation);
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.96)' }}
            onClick={onClose}
        >
            <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="absolute top-4 right-4 z-[201] p-2.5 bg-white/10 hover:bg-white/25 rounded-full transition-all border border-white/15 backdrop-blur-sm touch-manipulation"
            >
                <X size={20} className="text-white" />
            </motion.button>

            <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/35 text-[10px] select-none pointer-events-none whitespace-nowrap"
            >
                Tap outside or press ESC to close
            </motion.p>

            <div
                className="relative flex items-center justify-center w-full h-full p-4"
                onClick={e => e.stopPropagation()}
            >
                {mediaType === 'video' ? (
                    <video
                        ref={videoRef}
                        src={mediaUrl}
                        controls
                        autoPlay
                        playsInline
                        className="rounded-2xl shadow-2xl outline-none max-w-full max-h-full"
                        style={{ maxWidth: '100%', maxHeight: '100%', background: '#000' }}
                    />
                ) : (
                    <img
                        src={mediaUrl}
                        alt="Full size"
                        className="rounded-2xl shadow-2xl object-contain max-w-full max-h-full"
                        style={{ maxWidth: '100%', maxHeight: '100%' }}
                        onError={e => { e.target.alt = 'Image failed to load'; }}
                    />
                )}
            </div>
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// MEDIA THUMBNAIL — Enhanced with better overlay (Mobile Optimized)
// ─────────────────────────────────────────────────────────────────────────────
const MediaDisplay = ({ mediaUrl, mediaType, onOpenLightbox, compact }) => {
    if (!mediaUrl) return null;

    if (mediaType === 'video') {
        return (
            <motion.div
                whileTap={{ scale: 0.98 }}
                className={`rounded-xl overflow-hidden border border-gray-100 bg-gray-900 relative cursor-pointer group ${compact ? 'w-28 h-28 mb-0 mx-0' : 'mx-4 mb-3 w-full'}`}
                style={compact ? { minWidth: 80, minHeight: 80, maxWidth: 112, maxHeight: 112 } : {}}
                onClick={() => onOpenLightbox(mediaUrl, 'video')}
            >
                <video
                    src={mediaUrl}
                    className={`object-cover ${compact ? 'w-full h-full' : 'w-full max-h-64'}`}
                    preload="metadata"
                    playsInline
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/60 transition-all duration-300">
                    <motion.div
                        whileTap={{ scale: 0.9 }}
                        className="w-10 h-10 bg-white/95 rounded-full flex items-center justify-center shadow-2xl"
                    >
                        <Play size={18} className="text-orange-500 ml-0.5" fill="currentColor" />
                    </motion.div>
                </div>
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm">
                    <Maximize2 size={8} />
                    Tap to play
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            whileTap={{ scale: 0.98 }}
            className={`rounded-xl overflow-hidden border border-gray-100 cursor-pointer group relative ${compact ? 'w-28 h-28 mb-0 mx-0' : 'mx-4 mb-3 w-full'}`}
            style={compact ? { minWidth: 80, minHeight: 80, maxWidth: 112, maxHeight: 112 } : {}}
            onClick={() => onOpenLightbox(mediaUrl, 'image')}
        >
            <img
                src={mediaUrl}
                alt="post media"
                className={`object-contain transition-transform duration-500 group-hover:scale-105 ${compact ? 'w-full h-full' : ''}`}
                style={compact ? { background: '#222', width: '100%', height: '100%', display: 'block', margin: 0 } : { maxHeight: '500px', background: '#222', width: '100%', display: 'block', margin: '0 auto' }}
                onError={e => { e.target.style.display = 'none'; }}
                loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <motion.div
                    initial={{ scale: 0 }}
                    whileTap={{ scale: 0.9 }}
                    className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-xl"
                >
                    <ZoomIn size={14} className="text-gray-700" />
                </motion.div>
            </div>
        </motion.div>
    );
};

// ── Enhanced Create / Edit Post Modal (Centered on all devices) ──────────────────────────────────────────
const PostModal = ({ post, onClose, onSaved, currentUser }) => {
    const [content, setContent]         = useState(post?.content || '');
    const [mediaFile, setMediaFile]     = useState(null);
    const [preview, setPreview]         = useState(post?.mediaUrl || null);
    const [previewType, setPreviewType] = useState(post?.mediaType || null);
    const [saving, setSaving]           = useState(false);
    const [charCount, setCharCount]     = useState(0);
    const fileRef = useRef();
    const textareaRef = useRef(null);

    const handleMedia = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 20 * 1024 * 1024) { toast.error('File must be under 20 MB.'); return; }
        setMediaFile(file);
        setPreview(URL.createObjectURL(file));
        setPreviewType(file.type.startsWith('video/') ? 'video' : 'image');
    };

    const handleSubmit = async () => {
        if (!content.trim()) { toast.error('Please write something.'); return; }
        setSaving(true);
        try {
            const fd = new FormData();
            fd.append('content', content.trim());
            if (mediaFile) fd.append('media', mediaFile);
            const result = post
                ? await api.editCommunityPost(post._id, fd)
                : await api.createCommunityPost(fd);
            onSaved(result.data.post, !!post);
            toast.success(post ? 'Post updated!' : 'Post shared!');
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save post.');
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        setCharCount(content.length);
    }, [content]);

    // Auto-focus textarea
    useEffect(() => {
        if (textareaRef.current) {
            setTimeout(() => textareaRef.current?.focus(), 100);
        }
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Avatar user={currentUser} size={10} />
                        <div className="min-w-0 flex-1">
                            <p className="font-bold text-gray-900 text-sm truncate">{currentUser?.name}</p>
                            <p className="text-[10px] text-orange-500 font-mono truncate">{currentUser?.karigarId}</p>
                        </div>
                    </div>
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all flex-shrink-0"
                    >
                        <X size={18} />
                    </motion.button>
                </div>

                <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        placeholder="Share something with the community..."
                        rows={4}
                        maxLength={2000}
                        className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-50 outline-none transition-all resize-none"
                    />
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                            <Smile size={12} className="text-gray-400" />
                            <span className={`text-[10px] font-mono ${charCount > 1800 ? 'text-red-500' : 'text-gray-400'}`}>
                                {charCount}/2000
                            </span>
                        </div>
                        {charCount > 1800 && (
                            <span className="text-[9px] text-red-500">⚠️ Approaching limit</span>
                        )}
                    </div>

                    <AnimatePresence>
                        {preview && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="relative rounded-xl overflow-hidden border border-gray-100"
                            >
                                {previewType === 'video'
                                    ? <video src={preview} className="w-full max-h-40" controls playsInline />
                                    : <img src={preview} alt="preview" className="w-full max-h-40 object-cover" />
                                }
                                <button
                                    onClick={() => { setMediaFile(null); setPreview(null); setPreviewType(null); }}
                                    className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition-all touch-manipulation"
                                >
                                    <X size={10} />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="p-5 border-t border-gray-100 flex-shrink-0">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex gap-1">
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => fileRef.current?.click()}
                                className="flex items-center gap-1.5 text-orange-500 text-sm font-medium px-3 py-2 rounded-xl hover:bg-orange-50 transition-all touch-manipulation"
                            >
                                <Camera size={14} /> 
                                <span className="hidden xs:inline">Media</span>
                            </motion.button>
                        </div>
                        <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleMedia} />
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={handleSubmit}
                            disabled={saving || !content.trim()}
                            className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-orange-200 hover:shadow-orange-300 transition-all disabled:opacity-50 touch-manipulation"
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            {post ? 'Update' : 'Share'}
                        </motion.button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

// ── Enhanced Delete Confirm (Mobile Optimized) ────────────────────────────────────────────────────
const DeleteModal = ({ onConfirm, onClose }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
    >
        <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 text-center mx-4"
            onClick={e => e.stopPropagation()}
        >
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3"
            >
                <Trash2 size={24} className="text-red-500" />
            </motion.div>
            <h3 className="font-black text-gray-900 text-lg mb-1">Delete Post?</h3>
            <p className="text-gray-500 text-xs mb-5">This action cannot be undone. All likes and comments will be removed.</p>
            <div className="flex gap-3">
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={onClose}
                    className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-bold text-gray-600 text-sm hover:bg-gray-50 transition-all touch-manipulation"
                >
                    Cancel
                </motion.button>
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={onConfirm}
                    className="flex-1 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-bold text-sm hover:shadow-lg transition-all touch-manipulation"
                >
                    Delete
                </motion.button>
            </div>
        </motion.div>
    </motion.div>
);

// ── Enhanced Post Card (Mobile Optimized) ─────────────────────────────────────────────────────────
const PostCard = ({ post, currentUserId, onEdit, onDelete, onLike, onComment, onDeleteComment, onOpenLightbox }) => {
    const [showComments, setShowComments]    = useState(false);
    const [commentText, setCommentText]      = useState('');
    const [submittingComment, setSubmitting] = useState(false);
    const [showMenu, setShowMenu]            = useState(false);
    const [liked, setLiked]                  = useState(false);
    const [likeCount, setLikeCount]          = useState(0);
    const menuRef = useRef();
    const commentInputRef = useRef(null);

    const isAdminPost = post.authorType === 'admin';
    const isOwn       = !isAdminPost && String(post.author?._id) === String(currentUserId);
    
    useEffect(() => {
        setLiked(post.likes?.some(id => String(id) === String(currentUserId)));
        setLikeCount(post.likes?.length || 0);
    }, [post.likes, currentUserId]);

    useEffect(() => {
        const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleComment = async () => {
        if (!commentText.trim()) return;
        setSubmitting(true);
        await onComment(post._id, commentText.trim());
        setCommentText('');
        setSubmitting(false);
    };

    const handleLikeClick = async () => {
        await onLike(post._id);
    };

    const toggleComments = () => {
        setShowComments(v => !v);
        if (!showComments && commentInputRef.current) {
            setTimeout(() => commentInputRef.current?.focus(), 100);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            className={`bg-white rounded-2xl border shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden ${
                isAdminPost ? 'border-orange-200 shadow-orange-100' : 'border-gray-100'
            }`}
        >
            {isAdminPost && (
                <div className="bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2 flex items-center gap-1.5">
                    <Shield size={12} className="text-white" />
                    <span className="text-white text-[10px] font-bold tracking-wide">Official Announcement · KarigarConnect Admin</span>
                </div>
            )}

            {/* Header - Mobile optimized */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Avatar user={post.author} size={10} isAdmin={isAdminPost} />
                    <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900 text-sm truncate">
                            {isAdminPost ? 'KarigarConnect Admin' : (post.author?.name || 'Unknown')}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {!isAdminPost && (
                                <>
                                    <span className="text-[10px] text-orange-500 font-mono font-semibold truncate max-w-[100px]">
                                        {post.author?.karigarId}
                                    </span>
                                    <span className="text-gray-300 text-[10px]">·</span>
                                </>
                            )}
                            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                <TrendingUp size={8} />
                                {timeAgo(post.createdAt)}
                            </span>
                        </div>
                    </div>
                </div>

                {isOwn && (
                    <div className="relative flex-shrink-0" ref={menuRef}>
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setShowMenu(v => !v)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all touch-manipulation"
                        >
                            <MoreVertical size={14} />
                        </motion.button>
                        <AnimatePresence>
                            {showMenu && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                    className="absolute right-0 top-8 bg-white border border-gray-100 rounded-xl shadow-xl z-10 overflow-hidden w-32"
                                >
                                    <button
                                        onClick={() => { setShowMenu(false); onEdit(post); }}
                                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-all"
                                    >
                                        <Edit2 size={12} /> Edit
                                    </button>
                                    <button
                                        onClick={() => { setShowMenu(false); onDelete(post._id); }}
                                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-500 hover:bg-red-50 transition-all"
                                    >
                                        <Trash2 size={12} /> Delete
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Two-column layout: left message, right image */}
            <div className="flex flex-row items-stretch gap-4 px-4 pb-2">
                <div className="flex-1 flex items-center">
                    <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap break-words">{post.content}</p>
                </div>
                {post.mediaUrl && (
                    <div className="flex-shrink-0 flex items-center justify-center">
                        <MediaDisplay
                            mediaUrl={post.mediaUrl}
                            mediaType={post.mediaType}
                            onOpenLightbox={onOpenLightbox}
                            compact
                        />
                    </div>
                )}
            </div>

            {/* Stats */}
            {(likeCount > 0 || post.comments?.length > 0) && (
                <div className="px-4 pb-1 flex items-center gap-3 text-[11px] text-gray-400">
                    {likeCount > 0 && (
                        <span className="flex items-center gap-1">
                            <Heart size={9} className="text-red-500 fill-red-500" />
                            {likeCount} like{likeCount !== 1 ? 's' : ''}
                        </span>
                    )}
                    {!isAdminPost && post.comments?.length > 0 && (
                        <span className="flex items-center gap-1">
                            <MessageCircle size={9} />
                            {post.comments.length} comment{post.comments.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
            )}

            {/* Actions - Larger tap targets */}
            <div className="px-4 pb-3 border-t border-gray-50 pt-2 flex items-center gap-1">
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleLikeClick}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all touch-manipulation ${
                        liked ? 'bg-red-50 text-red-500' : 'text-gray-500 hover:bg-gray-100'
                    }`}
                >
                    <Heart size={14} className={liked ? 'fill-red-500' : ''} />
                    {liked ? 'Liked' : 'Like'}
                </motion.button>

                {!isAdminPost && (
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={toggleComments}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-500 hover:bg-gray-100 transition-all touch-manipulation"
                    >
                        <MessageCircle size={14} />
                        Comment
                        {post.comments?.length > 0 && (
                            <span className="bg-orange-100 text-orange-600 text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-0.5">
                                {post.comments.length}
                            </span>
                        )}
                    </motion.button>
                )}

                <motion.button
                    whileTap={{ scale: 0.95 }}
                    className="ml-auto flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-medium text-gray-400 hover:text-gray-600 transition-all touch-manipulation"
                >
                    <Share2 size={12} />
                    <span className="hidden xs:inline">Share</span>
                </motion.button>
            </div>

            {/* Comments Section - Enhanced & Mobile Optimized */}
            <AnimatePresence>
                {!isAdminPost && showComments && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-gray-50 px-4 pb-4 pt-3 space-y-3"
                    >
                        {post.comments?.length > 0 && (
                            <div className="space-y-2.5 mb-3 max-h-64 overflow-y-auto custom-scrollbar">
                                {post.comments.map((c, idx) => (
                                    <motion.div
                                        key={c._id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.03 }}
                                        className="flex items-start gap-2"
                                    >
                                        <Avatar user={c.author} size={8} />
                                        <div className="flex-1 bg-gradient-to-r from-gray-50 to-white rounded-xl px-3 py-2 shadow-sm">
                                            <div className="flex items-center justify-between gap-2 mb-0.5">
                                                <p className="text-xs font-bold text-gray-800 truncate flex-1">{c.author?.name}</p>
                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    <span className="text-[9px] text-gray-400">{timeAgo(c.createdAt)}</span>
                                                    {String(c.author?._id) === String(currentUserId) && (
                                                        <button
                                                            onClick={() => onDeleteComment(post._id, c._id)}
                                                            className="text-gray-300 hover:text-red-400 transition-colors touch-manipulation p-0.5"
                                                        >
                                                            <X size={9} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-700 leading-relaxed break-words">{c.text}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <input
                                ref={commentInputRef}
                                type="text"
                                value={commentText}
                                onChange={e => setCommentText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleComment()}
                                placeholder="Write a comment..."
                                maxLength={500}
                                className="flex-1 border-2 border-gray-100 rounded-xl px-3 py-2 text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-50 outline-none transition-all"
                            />
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={handleComment}
                                disabled={!commentText.trim() || submittingComment}
                                className="p-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex-shrink-0 touch-manipulation"
                            >
                                {submittingComment ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// ── Main Community Page (Mobile Optimized) ─────────────────────────────────────────────────────────
export default function Community() {
    const [posts, setPosts]             = useState([]);
    const [loading, setLoading]         = useState(true);
    const [page, setPage]               = useState(1);
    const [totalPages, setTotalPages]   = useState(1);
    const [showCreate, setShowCreate]   = useState(false);
    const [editPost, setEditPost]       = useState(null);
    const [deleteId, setDeleteId]       = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [lightbox, setLightbox]       = useState(null);

    useEffect(() => {
        try {
            const u = JSON.parse(localStorage.getItem('user') || '{}');
            setCurrentUser(u);
        } catch { /* ignore */ }
    }, []);

    const fetchPosts = useCallback(async (p = 1) => {
        setLoading(true);
        try {
            const { data } = await api.getCommunityPosts(p);
            if (p === 1) setPosts(data.posts || []);
            else         setPosts(prev => [...prev, ...(data.posts || [])]);
            setTotalPages(data.totalPages || 1);
            setPage(p);
        } catch {
            toast.error('Failed to load posts.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchPosts(1); }, [fetchPosts]);

    const handlePostSaved = (savedPost, isEdit) => {
        if (isEdit) setPosts(prev => prev.map(p => p._id === savedPost._id ? savedPost : p));
        else        setPosts(prev => [savedPost, ...prev]);
    };

    const handleDelete = async () => {
        try {
            await api.deleteCommunityPost(deleteId);
            setPosts(prev => prev.filter(p => p._id !== deleteId));
            toast.success('Post deleted successfully.');
        } catch { toast.error('Failed to delete.'); }
        finally  { setDeleteId(null); }
    };

    const handleLike = async (postId) => {
        try {
            const { data } = await api.likeCommunityPost(postId);
            setPosts(prev => prev.map(p => {
                if (p._id !== postId) return p;
                const uid = String(currentUser?._id || currentUser?.id);
                const likes = data.liked
                    ? [...(p.likes || []), uid]
                    : (p.likes || []).filter(id => String(id) !== uid);
                return { ...p, likes };
            }));
        } catch { toast.error('Failed to update like.'); }
    };

    const handleComment = async (postId, text) => {
        try {
            const { data } = await api.commentOnCommunityPost(postId, text);
            setPosts(prev => prev.map(p => p._id === postId ? data.post : p));
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to add comment.');
        }
    };

    const handleDeleteComment = async (postId, commentId) => {
        try {
            await api.deleteCommunityComment(postId, commentId);
            setPosts(prev => prev.map(p => {
                if (p._id !== postId) return p;
                return { ...p, comments: p.comments.filter(c => c._id !== commentId) };
            }));
        } catch { toast.error('Failed to delete comment.'); }
    };

    const currentUserId = currentUser?._id || currentUser?.id;

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/40 via-white to-orange-50/20 pb-20">
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #f97316;
                    border-radius: 10px;
                }
                @media (max-width: 640px) {
                    .custom-scrollbar::-webkit-scrollbar {
                        width: 2px;
                    }
                }
                .xs\\:inline {
                    @media (min-width: 480px) {
                        display: inline;
                    }
                }
            `}</style>

            <AnimatePresence>
                {lightbox && (
                    <Lightbox
                        mediaUrl={lightbox.url}
                        mediaType={lightbox.type}
                        onClose={() => setLightbox(null)}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {(showCreate || editPost) && (
                    <PostModal
                        post={editPost}
                        currentUser={currentUser}
                        onClose={() => { setShowCreate(false); setEditPost(null); }}
                        onSaved={handlePostSaved}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {deleteId && <DeleteModal onConfirm={handleDelete} onClose={() => setDeleteId(null)} />}
            </AnimatePresence>

            <div className="max-w-5xl mx-auto px-4 pt-4 md:pt-8" style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.13rem' }}>
                {/* Enhanced Header - Mobile Optimized */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    data-guide-id="worker-page-community"
                    className="flex items-center justify-between mb-5"
                >
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-200">
                            <Users size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                                Community
                            </h1>
                            <p className="text-[10px] text-gray-500">Share & connect with fellow karigars</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => fetchPosts(1)}
                            className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all touch-manipulation"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </motion.button>
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowCreate(true)}
                            className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-2 rounded-xl font-bold text-xs shadow-lg shadow-orange-200 hover:shadow-orange-300 transition-all touch-manipulation"
                        >
                            <Plus size={12} /> 
                            <span>Create</span>
                        </motion.button>
                    </div>
                </motion.div>

                {/* Enhanced Create Prompt - Mobile Optimized */}
                <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowCreate(true)}
                    className="w-full flex items-center gap-3 bg-white rounded-2xl border-2 border-gray-100 shadow-md p-3 mb-5 hover:border-orange-200 hover:shadow-xl transition-all text-left group touch-manipulation"
                >
                    <Avatar user={currentUser} size={10} />
                    <span className="flex-1 text-xs text-gray-400 group-hover:text-gray-500 transition-all truncate">
                        What's on your mind, {currentUser?.name?.split(' ')[0]}?
                    </span>
                    <div className="flex items-center gap-1.5">
                        <div className="p-1.5 bg-orange-50 rounded-lg group-hover:bg-orange-100 transition-all">
                            <Camera size={12} className="text-orange-500" />
                        </div>
                        <div className="p-1.5 bg-orange-50 rounded-lg group-hover:bg-orange-100 transition-all">
                            <Video size={12} className="text-orange-500" />
                        </div>
                        <div className="p-1.5 bg-orange-50 rounded-lg group-hover:bg-orange-100 transition-all">
                            <Smile size={12} className="text-orange-500" />
                        </div>
                    </div>
                </motion.button>

                {/* Posts Feed */}
                {loading && posts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full"
                        />
                        <p className="mt-3 text-gray-500 font-semibold text-sm">Loading community posts...</p>
                    </div>
                ) : posts.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-12 bg-white rounded-2xl shadow-lg border border-gray-100"
                    >
                        <motion.div
                            animate={{ y: [0, -8, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            <Users size={48} className="mx-auto mb-3 text-gray-300" />
                        </motion.div>
                        <p className="font-bold text-gray-700 text-lg mb-1">No posts yet</p>
                        <p className="text-gray-400 text-xs mb-5 px-4">Be the first to share something with the community!</p>
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowCreate(true)}
                            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold text-sm shadow-lg touch-manipulation"
                        >
                            <Sparkles size={14} /> Create First Post
                        </motion.button>
                    </motion.div>
                ) : (
                    <div className="space-y-4">
                        <AnimatePresence>
                            {posts.map(post => (
                                <PostCard
                                    key={post._id}
                                    post={post}
                                    currentUserId={currentUserId}
                                    onEdit={setEditPost}
                                    onDelete={setDeleteId}
                                    onLike={handleLike}
                                    onComment={handleComment}
                                    onDeleteComment={handleDeleteComment}
                                    onOpenLightbox={(url, type) => setLightbox({ url, type })}
                                />
                            ))}
                        </AnimatePresence>

                        {page < totalPages && (
                            <motion.button
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => fetchPosts(page + 1)}
                                disabled={loading}
                                className="w-full py-3 border-2 border-orange-200 bg-white text-orange-600 rounded-xl font-bold text-sm hover:bg-orange-50 transition-all flex items-center justify-center gap-2 shadow-md touch-manipulation"
                            >
                                {loading ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
                                Load more posts
                            </motion.button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}