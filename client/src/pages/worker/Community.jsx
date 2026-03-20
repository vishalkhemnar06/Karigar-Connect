// src/pages/worker/Community.jsx — with Fullscreen Lightbox
import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../../api';
import toast from 'react-hot-toast';
import {
    Heart, MessageCircle, Edit2, Trash2, Send, X,
    Image as ImageIcon, Video, Plus, Loader2, MoreVertical,
    ChevronDown, RefreshCw, Users, Shield, ZoomIn, Play, Maximize2
} from 'lucide-react';

// ── helpers ───────────────────────────────────────────────────────────────────
const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
};

const Avatar = ({ user, size = 10, isAdmin = false }) => {
    if (isAdmin) {
        return (
            <div className={`w-${size} h-${size} rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center flex-shrink-0 border-2 border-orange-200`}>
                <Shield size={size === 10 ? 18 : 14} className="text-white" />
            </div>
        );
    }
    return (
        <img
            src={user?.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'W')}&background=f97316&color=fff`}
            alt={user?.name}
            className={`w-${size} h-${size} rounded-2xl object-cover border-2 border-orange-100 flex-shrink-0`}
            onError={e => { e.target.src = `https://ui-avatars.com/api/?name=W&background=f97316&color=fff`; }}
        />
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// LIGHTBOX — fullscreen overlay for image or video
// ─────────────────────────────────────────────────────────────────────────────
const Lightbox = ({ mediaUrl, mediaType, onClose }) => {
    const videoRef = useRef(null);

    // Close on Escape
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', handler);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    // Auto-play video
    useEffect(() => {
        if (mediaType === 'video' && videoRef.current) {
            videoRef.current.play().catch(() => {});
        }
    }, [mediaType]);

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.96)' }}
            onClick={onClose}
        >
            {/* Close button */}
            <button
                onClick={onClose}
                className="absolute top-5 right-5 z-[201] p-3 bg-white/10 hover:bg-white/25 rounded-full transition-all border border-white/15 backdrop-blur-sm"
            >
                <X size={22} className="text-white" />
            </button>

            {/* Hint */}
            <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/35 text-xs select-none pointer-events-none">
                Click outside or press ESC to close
            </p>

            {/* Media — click stops propagation so clicking media won't close */}
            <div
                className="relative flex items-center justify-center"
                style={{ maxWidth: '95vw', maxHeight: '90vh' }}
                onClick={e => e.stopPropagation()}
            >
                {mediaType === 'video' ? (
                    <video
                        ref={videoRef}
                        src={mediaUrl}
                        controls
                        autoPlay
                        className="rounded-2xl shadow-2xl outline-none"
                        style={{
                            maxWidth:  '95vw',
                            maxHeight: '88vh',
                            background: '#000',
                        }}
                    />
                ) : (
                    <img
                        src={mediaUrl}
                        alt="Full size"
                        className="rounded-2xl shadow-2xl object-contain"
                        style={{
                            maxWidth:  '95vw',
                            maxHeight: '88vh',
                        }}
                        onError={e => { e.target.alt = 'Image failed to load'; }}
                    />
                )}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// MEDIA THUMBNAIL — click opens Lightbox
// ─────────────────────────────────────────────────────────────────────────────
const MediaDisplay = ({ mediaUrl, mediaType, onOpenLightbox }) => {
    if (!mediaUrl) return null;

    if (mediaType === 'video') {
        return (
            <div
                className="mx-5 mb-3 rounded-2xl overflow-hidden border border-gray-100 bg-gray-900 relative cursor-pointer group"
                onClick={() => onOpenLightbox(mediaUrl, 'video')}
            >
                {/* Thumbnail frame */}
                <video
                    src={mediaUrl}
                    className="w-full max-h-72 object-cover"
                    preload="metadata"
                />
                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/35 group-hover:bg-black/55 transition-all duration-200">
                    <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 group-hover:bg-white transition-all duration-200">
                        <Play size={28} className="text-orange-500 ml-1" fill="currentColor" />
                    </div>
                </div>
                {/* Fullscreen hint badge */}
                <div className="absolute bottom-3 right-3 bg-black/55 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-sm">
                    <Maximize2 size={10} />
                    Tap to play
                </div>
            </div>
        );
    }

    // Image
    return (
        <div
            className="mx-5 mb-3 rounded-2xl overflow-hidden border border-gray-100 cursor-pointer group relative"
            onClick={() => onOpenLightbox(mediaUrl, 'image')}
        >
            <img
                src={mediaUrl}
                alt="post media"
                className="w-full max-h-80 object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                onError={e => { e.target.style.display = 'none'; }}
            />
            {/* Zoom overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-12 h-12 bg-white/85 rounded-full flex items-center justify-center shadow-xl">
                    <ZoomIn size={20} className="text-gray-700" />
                </div>
            </div>
        </div>
    );
};

// ── Create / Edit Post Modal ──────────────────────────────────────────────────
const PostModal = ({ post, onClose, onSaved, currentUser }) => {
    const [content, setContent]         = useState(post?.content || '');
    const [mediaFile, setMediaFile]     = useState(null);
    const [preview, setPreview]         = useState(post?.mediaUrl || null);
    const [previewType, setPreviewType] = useState(post?.mediaType || null);
    const [saving, setSaving]           = useState(false);
    const fileRef = useRef();

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

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <Avatar user={currentUser} size={9} />
                        <div>
                            <p className="font-bold text-gray-900 text-sm">{currentUser?.name}</p>
                            <p className="text-xs text-orange-500">{currentUser?.karigarId}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <textarea
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        placeholder="Share something with the community..."
                        rows={4}
                        maxLength={2000}
                        className="w-full border-2 border-gray-100 rounded-2xl p-4 text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-50 outline-none transition-all resize-none"
                        autoFocus
                    />
                    <div className="flex justify-end">
                        <span className={`text-xs font-mono ${content.length > 1800 ? 'text-red-500' : 'text-gray-400'}`}>
                            {content.length}/2000
                        </span>
                    </div>

                    {preview && (
                        <div className="relative rounded-2xl overflow-hidden border border-gray-100">
                            {previewType === 'video'
                                ? <video src={preview} className="w-full max-h-48" controls />
                                : <img src={preview} alt="preview" className="w-full max-h-48 object-cover" />
                            }
                            <button
                                onClick={() => { setMediaFile(null); setPreview(null); setPreviewType(null); }}
                                className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition-all"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                        <div className="flex gap-2">
                            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 text-orange-500 hover:text-orange-600 text-sm font-medium px-3 py-2 rounded-xl hover:bg-orange-50 transition-all">
                                <ImageIcon size={16} /> Image
                            </button>
                            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 text-orange-500 hover:text-orange-600 text-sm font-medium px-3 py-2 rounded-xl hover:bg-orange-50 transition-all">
                                <Video size={16} /> Video
                            </button>
                        </div>
                        <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleMedia} />
                        <button
                            onClick={handleSubmit}
                            disabled={saving || !content.trim()}
                            className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-5 py-2.5 rounded-2xl font-bold text-sm shadow-lg shadow-orange-200 hover:shadow-orange-300 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                            {post ? 'Update' : 'Share'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Delete Confirm ────────────────────────────────────────────────────────────
const DeleteModal = ({ onConfirm, onClose }) => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-500" />
            </div>
            <h3 className="font-black text-gray-900 text-lg mb-2">Delete Post?</h3>
            <p className="text-gray-500 text-sm mb-6">This cannot be undone.</p>
            <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-3 border-2 border-gray-200 rounded-2xl font-bold text-gray-600 hover:bg-gray-50 transition-all">Cancel</button>
                <button onClick={onConfirm} className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all">Delete</button>
            </div>
        </div>
    </div>
);

// ── Post Card ─────────────────────────────────────────────────────────────────
const PostCard = ({ post, currentUserId, onEdit, onDelete, onLike, onComment, onDeleteComment, onOpenLightbox }) => {
    const [showComments, setShowComments]    = useState(false);
    const [commentText, setCommentText]      = useState('');
    const [submittingComment, setSubmitting] = useState(false);
    const [showMenu, setShowMenu]            = useState(false);
    const menuRef = useRef();

    const isAdminPost = post.authorType === 'admin';
    const isOwn       = !isAdminPost && String(post.author?._id) === String(currentUserId);
    const liked       = post.likes?.some(id => String(id) === String(currentUserId));
    const likeCount   = post.likes?.length || 0;

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

    return (
        <div className={`bg-white rounded-3xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${
            isAdminPost ? 'border-orange-200' : 'border-gray-100'
        }`}>
            {isAdminPost && (
                <div className="bg-gradient-to-r from-orange-500 to-red-500 px-5 py-2 flex items-center gap-2">
                    <Shield size={13} className="text-white" />
                    <span className="text-white text-xs font-bold tracking-wide">Posted by Admin · KarigarConnect</span>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
                <div className="flex items-center gap-3">
                    <Avatar user={post.author} size={11} isAdmin={isAdminPost} />
                    <div>
                        <p className="font-bold text-gray-900 text-sm">
                            {isAdminPost ? 'KarigarConnect Admin' : (post.author?.name || 'Unknown')}
                        </p>
                        <div className="flex items-center gap-2">
                            {!isAdminPost && (
                                <>
                                    <span className="text-xs text-orange-500 font-mono">{post.author?.karigarId}</span>
                                    <span className="text-gray-300 text-xs">·</span>
                                </>
                            )}
                            <span className="text-xs text-gray-400">{timeAgo(post.createdAt)}</span>
                        </div>
                    </div>
                </div>

                {isOwn && (
                    <div className="relative" ref={menuRef}>
                        <button onClick={() => setShowMenu(v => !v)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
                            <MoreVertical size={16} />
                        </button>
                        {showMenu && (
                            <div className="absolute right-0 top-9 bg-white border border-gray-100 rounded-2xl shadow-xl z-10 overflow-hidden w-36">
                                <button onClick={() => { setShowMenu(false); onEdit(post); }} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-all">
                                    <Edit2 size={14} /> Edit
                                </button>
                                <button onClick={() => { setShowMenu(false); onDelete(post._id); }} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-all">
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="px-5 pb-3">
                <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
            </div>

            {/* Media with lightbox */}
            <MediaDisplay
                mediaUrl={post.mediaUrl}
                mediaType={post.mediaType}
                onOpenLightbox={onOpenLightbox}
            />

            {/* Stats */}
            {(likeCount > 0 || post.comments?.length > 0) && (
                <div className="px-5 pb-2 flex items-center gap-4 text-xs text-gray-400">
                    {likeCount > 0 && <span>{likeCount} like{likeCount !== 1 ? 's' : ''}</span>}
                    {!isAdminPost && post.comments?.length > 0 && (
                        <span>{post.comments.length} comment{post.comments.length !== 1 ? 's' : ''}</span>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="px-5 pb-4 border-t border-gray-50 pt-3 flex items-center gap-2">
                <button
                    onClick={() => onLike(post._id)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-medium transition-all ${
                        liked ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'text-gray-500 hover:bg-gray-100'
                    }`}
                >
                    <Heart size={16} className={liked ? 'fill-red-500' : ''} />
                    {liked ? 'Liked' : 'Like'}
                </button>

                {!isAdminPost && (
                    <button
                        onClick={() => setShowComments(v => !v)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-medium text-gray-500 hover:bg-gray-100 transition-all"
                    >
                        <MessageCircle size={16} />
                        Comment
                        {post.comments?.length > 0 && (
                            <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {post.comments.length}
                            </span>
                        )}
                    </button>
                )}

                {isAdminPost && (
                    <span className="text-xs text-gray-400 italic ml-1">Admin post — likes only</span>
                )}
            </div>

            {/* Comments */}
            {!isAdminPost && showComments && (
                <div className="border-t border-gray-50 px-5 pb-5 pt-4 space-y-3">
                    {post.comments?.length > 0 && (
                        <div className="space-y-3 mb-4">
                            {post.comments.map(c => (
                                <div key={c._id} className="flex items-start gap-3">
                                    <Avatar user={c.author} size={8} />
                                    <div className="flex-1 bg-gray-50 rounded-2xl px-3 py-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-bold text-gray-800">{c.author?.name}</p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-gray-400">{timeAgo(c.createdAt)}</span>
                                                {String(c.author?._id) === String(currentUserId) && (
                                                    <button onClick={() => onDeleteComment(post._id, c._id)} className="text-gray-300 hover:text-red-400 transition-colors">
                                                        <X size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-700 mt-0.5 leading-relaxed">{c.text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleComment()}
                            placeholder="Write a comment..."
                            maxLength={500}
                            className="flex-1 border-2 border-gray-100 rounded-2xl px-4 py-2 text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-50 outline-none transition-all"
                        />
                        <button
                            onClick={handleComment}
                            disabled={!commentText.trim() || submittingComment}
                            className="p-2.5 bg-orange-500 text-white rounded-2xl hover:bg-orange-600 transition-all disabled:opacity-50 flex-shrink-0"
                        >
                            {submittingComment ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Community() {
    const [posts, setPosts]             = useState([]);
    const [loading, setLoading]         = useState(true);
    const [page, setPage]               = useState(1);
    const [totalPages, setTotalPages]   = useState(1);
    const [showCreate, setShowCreate]   = useState(false);
    const [editPost, setEditPost]       = useState(null);
    const [deleteId, setDeleteId]       = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [lightbox, setLightbox]       = useState(null); // { url, type }

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
            toast.success('Post deleted.');
        } catch { toast.error('Failed to delete.'); }
        finally  { setDeleteId(null); }
    };

    const handleLike = async (postId) => {
        try {
            const { data } = await api.likeCommunityPost(postId);
            setPosts(prev => prev.map(p => {
                if (p._id !== postId) return p;
                const uid   = String(currentUser?._id || currentUser?.id);
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
        <div className="min-h-screen bg-gradient-to-br from-orange-50/40 via-white to-orange-50/20 p-4 md:p-8">

            {/* Fullscreen Lightbox */}
            {lightbox && (
                <Lightbox
                    mediaUrl={lightbox.url}
                    mediaType={lightbox.type}
                    onClose={() => setLightbox(null)}
                />
            )}

            {/* Create / Edit modal */}
            {(showCreate || editPost) && (
                <PostModal
                    post={editPost}
                    currentUser={currentUser}
                    onClose={() => { setShowCreate(false); setEditPost(null); }}
                    onSaved={handlePostSaved}
                />
            )}

            {/* Delete confirm */}
            {deleteId && <DeleteModal onConfirm={handleDelete} onClose={() => setDeleteId(null)} />}

            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-200">
                            <Users size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900">Community</h1>
                            <p className="text-xs text-gray-500">Share & connect with fellow workers</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => fetchPosts(1)} className="p-2.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-2xl transition-all">
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={() => setShowCreate(true)}
                            className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2.5 rounded-2xl font-bold text-sm shadow-lg shadow-orange-200 hover:shadow-orange-300 active:scale-95 transition-all"
                        >
                            <Plus size={16} /> Post
                        </button>
                    </div>
                </div>

                {/* Create prompt */}
                <button
                    onClick={() => setShowCreate(true)}
                    className="w-full flex items-center gap-4 bg-white rounded-3xl border border-gray-100 shadow-sm p-4 mb-6 hover:border-orange-200 hover:shadow-md transition-all text-left group"
                >
                    <Avatar user={currentUser} size={11} />
                    <span className="flex-1 text-sm text-gray-400 group-hover:text-gray-500">
                        Share something with the community...
                    </span>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-orange-50 rounded-xl group-hover:bg-orange-100 transition-all">
                            <ImageIcon size={15} className="text-orange-500" />
                        </div>
                        <div className="p-2 bg-orange-50 rounded-xl group-hover:bg-orange-100 transition-all">
                            <Video size={15} className="text-orange-500" />
                        </div>
                    </div>
                </button>

                {/* Posts feed */}
                {loading && posts.length === 0 ? (
                    <div className="flex justify-center py-20">
                        <Loader2 size={32} className="animate-spin text-orange-400" />
                    </div>
                ) : posts.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <Users size={48} className="mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No posts yet</p>
                        <p className="text-sm mt-1">Be the first to share something!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
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

                        {page < totalPages && (
                            <button
                                onClick={() => fetchPosts(page + 1)}
                                disabled={loading}
                                className="w-full py-3 border-2 border-orange-200 text-orange-600 rounded-2xl font-bold text-sm hover:bg-orange-50 transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <ChevronDown size={16} />}
                                Load more
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}