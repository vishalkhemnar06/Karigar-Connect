// src/pages/admin/AdminCommunity.jsx — with Fullscreen Lightbox
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';
import logo from '../../assets/logo.jpg';
import {
    Users, Trash2, RefreshCw, ChevronLeft, Loader2,
    Search, Eye, EyeOff, MessageCircle, Heart, Shield,
    AlertTriangle, X, RotateCcw, Image as ImageIcon,
    Video, Plus, Edit2, Send, MoreVertical, CheckCircle,
    ZoomIn, Play, Maximize2
} from 'lucide-react';

const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
};

// ─────────────────────────────────────────────────────────────────────────────
// LIGHTBOX
// ─────────────────────────────────────────────────────────────────────────────
const Lightbox = ({ mediaUrl, mediaType, onClose }) => {
    const videoRef = useRef(null);

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

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.96)' }}
            onClick={onClose}
        >
            <button
                onClick={onClose}
                className="absolute top-5 right-5 z-[201] p-3 bg-white/10 hover:bg-white/25 rounded-full transition-all border border-white/15 backdrop-blur-sm"
            >
                <X size={22} className="text-white" />
            </button>
            <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/35 text-xs select-none pointer-events-none">
                Click outside or press ESC to close
            </p>
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
                        style={{ maxWidth: '95vw', maxHeight: '88vh', background: '#000' }}
                    />
                ) : (
                    <img
                        src={mediaUrl}
                        alt="Full size"
                        className="rounded-2xl shadow-2xl object-contain"
                        style={{ maxWidth: '95vw', maxHeight: '88vh' }}
                        onError={e => { e.target.alt = 'Image failed to load'; }}
                    />
                )}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// MEDIA PREVIEW — compact card thumbnail, click opens lightbox
// ─────────────────────────────────────────────────────────────────────────────
const MediaPreview = ({ mediaUrl, mediaType, compact = false, onOpenLightbox }) => {
    if (!mediaUrl) return null;

    if (mediaType === 'video') {
        return (
            <div
                className={`rounded-xl overflow-hidden bg-gray-900 border border-gray-100 relative cursor-pointer group ${compact ? 'max-h-32' : 'max-h-64'}`}
                onClick={() => onOpenLightbox(mediaUrl, 'video')}
            >
                <video
                    src={mediaUrl}
                    className="w-full object-cover"
                    style={{ maxHeight: compact ? '8rem' : '16rem' }}
                    preload="metadata"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/35 group-hover:bg-black/55 transition-all duration-200">
                    <div className={`bg-white/90 rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 group-hover:bg-white transition-all duration-200 ${compact ? 'w-10 h-10' : 'w-14 h-14'}`}>
                        <Play size={compact ? 18 : 24} className="text-orange-500 ml-0.5" fill="currentColor" />
                    </div>
                </div>
                <div className="absolute bottom-2 right-2 bg-black/55 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-sm">
                    <Maximize2 size={9} /> Tap to play
                </div>
            </div>
        );
    }

    return (
        <div
            className={`rounded-xl overflow-hidden border border-gray-100 cursor-pointer group relative ${compact ? 'max-h-32' : 'max-h-64'}`}
            onClick={() => onOpenLightbox(mediaUrl, 'image')}
        >
            <img
                src={mediaUrl}
                alt="media"
                className="w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                style={{ maxHeight: compact ? '8rem' : '16rem' }}
                onError={e => { e.target.style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center">
                <div className={`opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/85 rounded-full flex items-center justify-center shadow-xl ${compact ? 'w-8 h-8' : 'w-12 h-12'}`}>
                    <ZoomIn size={compact ? 14 : 20} className="text-gray-700" />
                </div>
            </div>
        </div>
    );
};

// ── Admin Create / Edit Modal ─────────────────────────────────────────────────
const AdminPostModal = ({ post, onClose, onSaved }) => {
    const [content, setContent]         = useState(post?.content || '');
    const [mediaFile, setMediaFile]     = useState(null);
    const [preview, setPreview]         = useState(post?.mediaUrl || null);
    const [previewType, setPreviewType] = useState(post?.mediaType || null);
    const [saving, setSaving]           = useState(false);
    const fileRef = useRef();

    const handleMedia = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 50 * 1024 * 1024) { toast.error('File must be under 50 MB.'); return; }
        setMediaFile(file);
        setPreview(URL.createObjectURL(file));
        setPreviewType(file.type.startsWith('video/') ? 'video' : 'image');
    };

    const handleSubmit = async () => {
        if (!content.trim()) { toast.error('Content is required.'); return; }
        setSaving(true);
        try {
            const fd = new FormData();
            fd.append('content', content.trim());
            if (mediaFile) fd.append('media', mediaFile);
            const result = post
                ? await api.adminEditCommunityPost(post._id, fd)
                : await api.adminCreateCommunityPost(fd);
            onSaved(result.data.post, !!post);
            toast.success(post ? 'Post updated!' : 'Admin post published!');
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save post.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="bg-gradient-to-r from-orange-600 to-red-500 p-5 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                            <Shield size={20} className="text-white" />
                        </div>
                        <div>
                            <p className="font-black text-base">KarigarConnect Admin</p>
                            <p className="text-orange-100 text-xs">{post ? 'Edit post' : 'Create community post'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all">
                        <X size={18} />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <textarea
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        placeholder="Write an announcement, tip, or update for the community..."
                        rows={5}
                        maxLength={2000}
                        className="w-full border-2 border-gray-100 rounded-2xl p-4 text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-50 outline-none transition-all resize-none"
                        autoFocus
                    />
                    <div className="flex justify-between items-center text-xs text-gray-400">
                        <span>Workers can only like admin posts</span>
                        <span className={content.length > 1800 ? 'text-red-500 font-mono' : 'font-mono'}>{content.length}/2000</span>
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
                            <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                                {previewType === 'video' ? '📹 Video' : '🖼️ Image'}
                            </div>
                        </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                        <div className="flex gap-2">
                            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-orange-500 hover:text-orange-600 text-sm font-medium px-3 py-2 rounded-xl hover:bg-orange-50 transition-all">
                                <ImageIcon size={15} /> Image
                            </button>
                            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-orange-500 hover:text-orange-600 text-sm font-medium px-3 py-2 rounded-xl hover:bg-orange-50 transition-all">
                                <Video size={15} /> Video
                            </button>
                        </div>
                        <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleMedia} />
                        <button
                            onClick={handleSubmit}
                            disabled={saving || !content.trim()}
                            className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-5 py-2.5 rounded-2xl font-bold text-sm shadow-lg shadow-orange-200 hover:shadow-orange-300 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                            {post ? 'Update' : 'Publish'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Delete Reason Modal ───────────────────────────────────────────────────────
const DeleteModal = ({ post, onConfirm, onClose }) => {
    const [reason, setReason] = useState('');
    const [deleting, setDel]  = useState(false);
    const handle = async () => {
        setDel(true);
        await onConfirm(post._id, reason.trim() || 'Removed by admin.');
        setDel(false);
    };
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
                <div className="bg-gradient-to-r from-red-500 to-red-600 p-5 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-black text-lg">Remove Post</h3>
                            <p className="text-red-100 text-xs mt-0.5">By {post?.authorType === 'admin' ? 'Admin' : post?.author?.name}</p>
                        </div>
                        <button onClick={onClose} className="p-2 bg-white/20 rounded-xl hover:bg-white/30"><X size={18} /></button>
                    </div>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
                        <p className="text-sm text-gray-700 line-clamp-3">{post?.content}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Reason <span className="text-gray-400 font-normal">(optional)</span></label>
                        <textarea
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="e.g. Violates community guidelines, inappropriate content..."
                            rows={3}
                            className="w-full border-2 border-gray-100 rounded-2xl p-3 text-sm focus:border-red-400 focus:ring-4 focus:ring-red-50 outline-none transition-all resize-none"
                        />
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 py-3 border-2 border-gray-200 rounded-2xl font-bold text-gray-600 hover:bg-gray-50 transition-all">Cancel</button>
                        <button onClick={handle} disabled={deleting} className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                            {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                            Remove Post
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Post Card ─────────────────────────────────────────────────────────────────
const AdminPostCard = ({ post, onDelete, onRestore, onEdit, onHardDelete, onOpenLightbox }) => {
    const isRemoved   = post.deletedByAdmin;
    const isAdminPost = post.authorType === 'admin';
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef();

    useEffect(() => {
        const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    return (
        <div className={`bg-white rounded-2xl border shadow-sm transition-all overflow-hidden ${
            isRemoved ? 'border-red-200 opacity-80' : isAdminPost ? 'border-orange-200' : 'border-gray-100 hover:shadow-md'
        }`}>
            {/* Removed banner */}
            {isRemoved && (
                <div className="bg-red-50 border-b border-red-100 px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-red-600 text-xs font-semibold">
                        <AlertTriangle size={12} />
                        Removed · {post.deletedAt ? timeAgo(post.deletedAt) : ''}
                    </div>
                    {post.deletionReason && (
                        <span className="text-xs text-red-500 italic truncate max-w-[180px]">"{post.deletionReason}"</span>
                    )}
                </div>
            )}

            {/* Admin banner */}
            {isAdminPost && !isRemoved && (
                <div className="bg-gradient-to-r from-orange-500 to-red-500 px-4 py-1.5 flex items-center gap-2">
                    <Shield size={11} className="text-white" />
                    <span className="text-white text-xs font-bold">Admin Post</span>
                </div>
            )}

            <div className="p-4">
                {/* Author row */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        {isAdminPost ? (
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center border-2 border-orange-100">
                                <Shield size={14} className="text-white" />
                            </div>
                        ) : (
                            <img
                                src={post.author?.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author?.name || 'W')}&background=f97316&color=fff`}
                                alt={post.author?.name}
                                className="w-9 h-9 rounded-xl object-cover border-2 border-orange-100"
                                onError={e => { e.target.src = `https://ui-avatars.com/api/?name=W&background=f97316&color=fff`; }}
                            />
                        )}
                        <div>
                            <p className="font-bold text-gray-900 text-sm">
                                {isAdminPost ? 'KarigarConnect Admin' : post.author?.name}
                            </p>
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                {!isAdminPost && <span className="text-orange-500 font-mono">{post.author?.karigarId}</span>}
                                {!isAdminPost && <span>·</span>}
                                <span>{timeAgo(post.createdAt)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Actions menu */}
                    {!isRemoved && (
                        <div className="relative" ref={menuRef}>
                            <button onClick={() => setShowMenu(v => !v)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
                                <MoreVertical size={15} />
                            </button>
                            {showMenu && (
                                <div className="absolute right-0 top-9 bg-white border border-gray-100 rounded-2xl shadow-xl z-10 overflow-hidden w-40">
                                    {isAdminPost && (
                                        <button onClick={() => { setShowMenu(false); onEdit(post); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-all">
                                            <Edit2 size={13} /> Edit Post
                                        </button>
                                    )}
                                    <button onClick={() => { setShowMenu(false); onDelete(post); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-all">
                                        <Trash2 size={13} /> Remove Post
                                    </button>
                                    {isAdminPost && (
                                        <button onClick={() => { setShowMenu(false); onHardDelete(post._id); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-700 hover:bg-red-50 transition-all border-t border-red-100">
                                            <Trash2 size={13} /> Delete Permanently
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Content */}
                <p className="text-sm text-gray-700 leading-relaxed mb-3 line-clamp-4">{post.content}</p>

                {/* Media — clickable thumbnail */}
                {post.mediaUrl && !isRemoved && (
                    <div className="mb-3">
                        <MediaPreview
                            mediaUrl={post.mediaUrl}
                            mediaType={post.mediaType}
                            compact
                            onOpenLightbox={onOpenLightbox}
                        />
                    </div>
                )}

                {/* Stats + restore */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Heart size={11} /> {post.likes?.length || 0}</span>
                        <span className="flex items-center gap-1"><MessageCircle size={11} /> {post.comments?.length || 0}</span>
                        {post.mediaType && (
                            <span className="flex items-center gap-1">
                                {post.mediaType === 'video' ? <Video size={11} /> : <ImageIcon size={11} />}
                                {post.mediaType}
                            </span>
                        )}
                    </div>
                    {isRemoved && (
                        <button onClick={() => onRestore(post._id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-xl text-xs font-bold hover:bg-green-200 transition-all">
                            <RotateCcw size={11} /> Restore
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminCommunity() {
    const navigate = useNavigate();

    const [posts, setPosts]               = useState([]);
    const [stats, setStats]               = useState({});
    const [loading, setLoading]           = useState(true);
    const [page, setPage]                 = useState(1);
    const [totalPages, setTotalPages]     = useState(1);
    const [filter, setFilter]             = useState('all');
    const [search, setSearch]             = useState('');
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [showCreate, setShowCreate]     = useState(false);
    const [editTarget, setEditTarget]     = useState(null);
    const [lightbox, setLightbox]         = useState(null); // { url, type }

    const fetchData = useCallback(async (p = 1) => {
        setLoading(true);
        try {
            const [postsRes, statsRes] = await Promise.all([
                api.adminGetCommunityPosts(p),
                api.adminGetCommunityStats(),
            ]);
            setPosts(postsRes.data.posts || []);
            setTotalPages(postsRes.data.totalPages || 1);
            setStats(statsRes.data || {});
            setPage(p);
        } catch {
            toast.error('Failed to load posts.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(1); }, [fetchData]);

    const handlePostSaved = (savedPost, isEdit) => {
        if (isEdit) {
            setPosts(prev => prev.map(p => p._id === savedPost._id ? savedPost : p));
        } else {
            setPosts(prev => [savedPost, ...prev]);
            setStats(s => ({ ...s, total: (s.total || 0) + 1, active: (s.active || 0) + 1, adminPosts: (s.adminPosts || 0) + 1 }));
        }
    };

    const handleSoftDelete = async (postId, reason) => {
        try {
            await api.adminDeleteCommunityPost(postId, reason);
            setPosts(prev => prev.map(p =>
                p._id === postId ? { ...p, deletedByAdmin: true, deletionReason: reason, deletedAt: new Date() } : p
            ));
            setStats(s => ({ ...s, active: Math.max(0, (s.active || 1) - 1), removed: (s.removed || 0) + 1 }));
            toast.success('Post removed.');
            setDeleteTarget(null);
        } catch { toast.error('Failed to remove post.'); }
    };

    const handleHardDelete = async (postId) => {
        if (!window.confirm('Permanently delete this admin post? This cannot be undone.')) return;
        try {
            await api.adminHardDeleteCommunityPost(postId);
            setPosts(prev => prev.filter(p => p._id !== postId));
            setStats(s => ({ ...s, total: Math.max(0, (s.total || 1) - 1), adminPosts: Math.max(0, (s.adminPosts || 1) - 1) }));
            toast.success('Post permanently deleted.');
        } catch { toast.error('Failed to delete post.'); }
    };

    const handleRestore = async (postId) => {
        try {
            await api.adminRestoreCommunityPost(postId);
            setPosts(prev => prev.map(p =>
                p._id === postId ? { ...p, deletedByAdmin: false, deletionReason: null, deletedAt: null } : p
            ));
            setStats(s => ({ ...s, active: (s.active || 0) + 1, removed: Math.max(0, (s.removed || 1) - 1) }));
            toast.success('Post restored.');
        } catch { toast.error('Failed to restore post.'); }
    };

    const filtered = posts.filter(p => {
        if (filter === 'active'  && p.deletedByAdmin)         return false;
        if (filter === 'removed' && !p.deletedByAdmin)        return false;
        if (filter === 'admin'   && p.authorType !== 'admin') return false;
        if (filter === 'workers' && p.authorType !== 'worker')return false;
        if (search) {
            const q = search.toLowerCase();
            return (
                p.author?.name?.toLowerCase().includes(q) ||
                p.author?.karigarId?.toLowerCase().includes(q) ||
                p.content?.toLowerCase().includes(q)
            );
        }
        return true;
    });

    const STAT_CARDS = [
        { label: 'Total Posts',  value: stats.total       || 0, color: 'border-gray-400' },
        { label: 'Active',        value: stats.active      || 0, color: 'border-green-500' },
        { label: 'Removed',       value: stats.removed     || 0, color: 'border-red-500' },
        { label: 'Admin Posts',   value: stats.adminPosts  || 0, color: 'border-orange-500' },
        { label: 'Worker Posts',  value: stats.workerPosts || 0, color: 'border-blue-500' },
    ];

    const FILTERS = [
        { id: 'all',     label: 'All' },
        { id: 'active',  label: 'Active' },
        { id: 'removed', label: 'Removed' },
        { id: 'admin',   label: 'Admin Posts' },
        { id: 'workers', label: 'Worker Posts' },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white">

            {/* Lightbox */}
            {lightbox && (
                <Lightbox
                    mediaUrl={lightbox.url}
                    mediaType={lightbox.type}
                    onClose={() => setLightbox(null)}
                />
            )}

            {/* Modals */}
            {(showCreate || editTarget) && (
                <AdminPostModal
                    post={editTarget}
                    onClose={() => { setShowCreate(false); setEditTarget(null); }}
                    onSaved={handlePostSaved}
                />
            )}
            {deleteTarget && (
                <DeleteModal
                    post={deleteTarget}
                    onConfirm={handleSoftDelete}
                    onClose={() => setDeleteTarget(null)}
                />
            )}

            {/* Header */}
            <header className="bg-gradient-to-r from-orange-600 to-orange-400 shadow-lg sticky top-0 z-40">
                <div className="flex items-center gap-4 p-4">
                    <button onClick={() => navigate('/admin/dashboard')} className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all text-white">
                        <ChevronLeft size={18} />
                    </button>
                    <img src={logo} alt="Logo" className="w-9 h-9 rounded-full object-cover border-2 border-white/40" />
                    <div className="flex-1">
                        <h1 className="text-lg font-black text-white">Community Management</h1>
                        <p className="text-orange-100 text-xs">Manage all worker & admin posts</p>
                    </div>
                    <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-white text-orange-600 px-3 py-2 rounded-xl font-bold text-sm hover:bg-orange-50 transition-all">
                        <Plus size={15} /> New Post
                    </button>
                    <button onClick={() => fetchData(page)} className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all text-white">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

            <div className="p-4 md:p-6 max-w-6xl mx-auto">
                {/* Stats */}
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-6">
                    {STAT_CARDS.map(({ label, value, color }) => (
                        <div key={label} className={`bg-white rounded-2xl p-3 border-l-4 shadow-sm ${color}`}>
                            <p className="text-2xl font-black text-gray-900">{value}</p>
                            <p className="text-[10px] text-gray-500 font-medium mt-0.5 leading-tight">{label}</p>
                        </div>
                    ))}
                </div>

                {/* Create CTA */}
                <button
                    onClick={() => setShowCreate(true)}
                    className="w-full flex items-center gap-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-2xl border-2 border-orange-200 border-dashed p-4 mb-6 hover:border-orange-400 hover:shadow-md transition-all text-left group"
                >
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-orange-200">
                        <Shield size={22} className="text-white" />
                    </div>
                    <div>
                        <p className="font-bold text-gray-800 text-sm group-hover:text-orange-700 transition-colors">Post as Admin</p>
                        <p className="text-xs text-gray-500">Share announcements, tips, or updates — visible to all workers</p>
                    </div>
                    <div className="ml-auto">
                        <div className="flex items-center gap-2 bg-orange-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold">
                            <Plus size={12} /> Create Post
                        </div>
                    </div>
                </button>

                {/* Filter & search */}
                <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-4 mb-6 flex flex-col sm:flex-row gap-3">
                    <div className="flex flex-wrap gap-2 flex-1">
                        {FILTERS.map(({ id, label }) => (
                            <button
                                key={id}
                                onClick={() => setFilter(id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    filter === id ? 'bg-orange-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="relative sm:w-56">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search posts..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border-2 border-gray-100 rounded-xl text-sm focus:border-orange-400 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Posts */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 size={32} className="animate-spin text-orange-400" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <Users size={48} className="mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No posts found</p>
                        <p className="text-sm mt-1">Try a different filter or search term</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filtered.map(post => (
                                <AdminPostCard
                                    key={post._id}
                                    post={post}
                                    onDelete={setDeleteTarget}
                                    onRestore={handleRestore}
                                    onEdit={setEditTarget}
                                    onHardDelete={handleHardDelete}
                                    onOpenLightbox={(url, type) => setLightbox({ url, type })}
                                />
                            ))}
                        </div>
                        {totalPages > 1 && (
                            <div className="flex justify-center gap-2 mt-6">
                                <button onClick={() => fetchData(Math.max(1, page - 1))} disabled={page === 1 || loading} className="px-4 py-2 rounded-xl border text-sm font-medium disabled:opacity-40 hover:bg-orange-50 transition-all">Previous</button>
                                <span className="px-4 py-2 text-sm text-gray-600 font-medium">{page} / {totalPages}</span>
                                <button onClick={() => fetchData(Math.min(totalPages, page + 1))} disabled={page === totalPages || loading} className="px-4 py-2 rounded-xl border text-sm font-medium disabled:opacity-40 hover:bg-orange-50 transition-all">Next</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}