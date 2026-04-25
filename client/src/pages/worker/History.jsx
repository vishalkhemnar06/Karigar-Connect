// src/pages/worker/History.jsx
// PREMIUM VERSION - Modern design with glassmorphism, animations, and enhanced UX

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { getWorkerBookings, getMyFeedback, getImageUrl } from '../../api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Star, MapPin, Calendar, IndianRupee, User,
    Search, Filter, TrendingUp, Briefcase, Award,
    ChevronDown, Clock, CheckCircle2, XCircle, RefreshCw,
    Sparkles, Trophy, Heart, ThumbsUp, Smile, Frown,
    AlertCircle, ChevronRight, LayoutGrid, List,
    ArrowUp, ArrowDown, Eye, Verified, Shield,
    Building2, Wallet, Gift, Crown, Diamond, Zap
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_CFG = {
    completed: { label: 'Completed', bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2 },
    cancelled: { label: 'Cancelled', bg: 'bg-red-100', text: 'text-red-600', icon: XCircle },
    cancelled_by_client: { label: 'Cancelled by Client', bg: 'bg-red-100', text: 'text-red-600', icon: XCircle },
    cancelled_by_worker: { label: 'Cancelled by You', bg: 'bg-orange-100', text: 'text-orange-600', icon: XCircle },
};

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

// ── Loading Skeleton ──────────────────────────────────────────────────────────
function Skeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
                    <div className="flex justify-between mb-3">
                        <div className="space-y-2 flex-1">
                            <div className="h-5 w-3/4 bg-gray-200 rounded-full" />
                            <div className="h-3 w-1/2 bg-gray-100 rounded-full" />
                        </div>
                        <div className="h-6 w-20 bg-gray-100 rounded-full" />
                    </div>
                    <div className="flex gap-2 mt-3">
                        <div className="h-6 w-16 bg-gray-100 rounded-full" />
                        <div className="h-6 w-20 bg-gray-100 rounded-full" />
                    </div>
                    <div className="flex gap-3 mt-3">
                        <div className="h-3 w-24 bg-gray-100 rounded-full" />
                        <div className="h-3 w-28 bg-gray-100 rounded-full" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Star Rating Component ─────────────────────────────────────────────────────
function StarRow({ rating, size = 14, animated = false }) {
    const stars = [1, 2, 3, 4, 5];
    return (
        <div className="flex items-center gap-0.5">
            {stars.map((s, idx) => (
                <motion.div
                    key={s}
                    initial={animated ? { scale: 0, rotate: -180 } : false}
                    animate={animated ? { scale: 1, rotate: 0 } : {}}
                    transition={{ delay: idx * 0.05, type: 'spring', stiffness: 200 }}
                >
                    <Star
                        size={size}
                        className={s <= rating ? 'text-yellow-400 fill-yellow-400 drop-shadow-sm' : 'text-gray-200 fill-gray-200'}
                    />
                </motion.div>
            ))}
        </div>
    );
}

// ── Analytics Dashboard ────────────────────────────────────────────────────────
function AnalyticsDashboard({ bookings, feedback }) {
    const totalEarnings = bookings
        .filter(j => j.status === 'completed')
        .reduce((s, j) => s + (j.payment || 0), 0);
    const completedCount = bookings.filter(j => j.status === 'completed').length;
    const avgRating = feedback.length
        ? (feedback.reduce((s, f) => s + (f.stars || 0), 0) / feedback.length).toFixed(1)
        : '—';
    const totalPoints = feedback.reduce((s, f) => s + (f.points || 0), 0);
    const fiveStarCount = feedback.filter(f => f.stars === 5).length;

    const stats = [
        { icon: Briefcase, label: 'Jobs Completed', value: completedCount, suffix: 'jobs', gradient: 'from-orange-500 to-amber-500', color: 'text-orange-600' },
        { icon: Wallet, label: 'Total Earnings', value: `₹${fmt(totalEarnings)}`, suffix: 'earned', gradient: 'from-emerald-500 to-teal-500', color: 'text-emerald-600' },
        { icon: Star, label: 'Avg Rating', value: avgRating, suffix: '/5 stars', gradient: 'from-yellow-500 to-amber-500', color: 'text-yellow-600' },
        { icon: Diamond, label: 'Points Earned', value: `+${fmt(totalPoints)}`, suffix: 'total points', gradient: 'from-purple-500 to-pink-500', color: 'text-purple-600' },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map(({ icon: Icon, label, value, suffix, gradient }, idx) => (
                <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    whileHover={{ y: -4, scale: 1.02 }}
                    className={`bg-gradient-to-br ${gradient} rounded-xl p-4 text-white shadow-lg hover:shadow-xl transition-all`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                            <Icon size={16} className="text-white" />
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-black">{value}</p>
                            <p className="text-[10px] opacity-80">{suffix}</p>
                        </div>
                    </div>
                    <p className="text-xs font-semibold opacity-90">{label}</p>
                </motion.div>
            ))}
        </div>
    );
}

// ── Job Card Component ────────────────────────────────────────────────────────
function JobCard({ job, index }) {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const cancelledByWorker = String(job?.cancelledWorkerId || '') === String(currentUser?._id || '');
    const isRejectedDirectHire = String(job?.directHire?.requestStatus || '').toLowerCase() === 'rejected';
    const displayStatus = job.status === 'completed'
        ? 'completed'
        : (cancelledByWorker ? 'cancelled_by_worker' : (job.status === 'cancelled_by_client' ? 'cancelled_by_client' : 'cancelled'));
    const cfg = STATUS_CFG[displayStatus] || STATUS_CFG.cancelled;
    const Icon = cfg.icon;
    const skills = job.mySlots?.map(s => s.skill).filter(Boolean) ||
                   (job.workerSlots || [])
                       .filter(s => s.assignedWorker?.toString() === currentUser?._id?.toString())
                       .map(s => s.skill) || [];
    const jobPhoto = job?.photos?.[0] ? getImageUrl(job.photos[0]) : '';
    const slotPaid = (Array.isArray(job?.mySlots) ? job.mySlots : []).reduce((sum, slot) => sum + Math.max(0, Number(slot?.finalPaidPrice || 0)), 0);
    const paidAmount = Math.max(
        Number(job?.pricingMeta?.finalPaidPrice || 0),
        Number(job?.directHire?.paymentAmount || 0),
        Number(slotPaid || 0),
        Number(job?.payment || 0),
    );

    const [expanded, setExpanded] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -4 }}
            className="bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group"
        >
            {/* Status Bar */}
            <div className={`h-1 ${job.status === 'completed' ? 'bg-gradient-to-r from-emerald-400 to-green-500' : 'bg-gradient-to-r from-red-400 to-rose-500'}`} />
            
            {/* Image Header */}
            {jobPhoto && (
                <div className="relative h-32 overflow-hidden">
                    <img
                        src={jobPhoto}
                        alt={job?.title || 'Job'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg ${cfg.bg} ${cfg.text}`}>
                        <Icon size={10} /> {cfg.label}
                    </div>
                </div>
            )}

            <div className="p-5">
                {/* Title & Client */}
                <div className="mb-3">
                    <h3 className="font-bold text-gray-800 text-base leading-tight line-clamp-2 mb-1">
                        {job.title}
                    </h3>
                    <div className="flex items-center gap-2">
                        <img
                            src={getImageUrl(job?.postedBy?.photo)}
                            alt=""
                            className="w-5 h-5 rounded-full object-cover border border-orange-200"
                            onError={(e) => { e.target.src = '/admin.png'; }}
                        />
                        <p className="text-xs text-gray-500">{job?.postedBy?.name || 'Client'}</p>
                        {job?.postedBy?.verificationStatus === 'approved' && (
                            <Verified size={12} className="text-emerald-500" />
                        )}
                    </div>
                </div>

                {/* Skills */}
                {skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {skills.slice(0, 3).map((sk, i) => (
                            <span key={i} className="text-[10px] bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 font-semibold px-2 py-0.5 rounded-full capitalize border border-orange-100">
                                {sk}
                            </span>
                        ))}
                        {skills.length > 3 && (
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                +{skills.length - 3}
                            </span>
                        )}
                    </div>
                )}

                {/* Meta Info Grid */}
                <div className="grid grid-cols-2 gap-2 mb-3 text-xs text-gray-500">
                    {!isRejectedDirectHire && paidAmount > 0 && (
                        <div className="flex items-center gap-1">
                            <Wallet size={12} className="text-emerald-500" />
                            <span className="font-semibold text-emerald-600">₹{fmt(paidAmount)}</span>
                        </div>
                    )}
                    {job.location?.city && (
                        <div className="flex items-center gap-1">
                            <MapPin size={12} className="text-orange-400" />
                            <span className="truncate">{job.location.city}</span>
                        </div>
                    )}
                    {(job.scheduledDate || job.updatedAt) && (
                        <div className="flex items-center gap-1">
                            <Calendar size={12} className="text-orange-400" />
                            <span>{new Date(job.scheduledDate || job.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        </div>
                    )}
                    {job.scheduledTime && (
                        <div className="flex items-center gap-1">
                            <Clock size={12} className="text-orange-400" />
                            <span>{job.scheduledTime}</span>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={() => {
                            if (job?.location?.lat && job?.location?.lng) {
                                window.open(`https://www.google.com/maps?q=${job.location.lat},${job.location.lng}`, '_blank', 'noopener,noreferrer');
                            } else {
                                toast.error('Location not available');
                            }
                        }}
                        className="text-xs px-2 py-2 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 font-semibold transition-all"
                    >
                        🗺️ Map
                    </button>
                    <button
                        type="button"
                        onClick={() => setExpanded(!expanded)}
                        className="text-xs px-2 py-2 border border-orange-200 text-orange-600 rounded-lg hover:bg-orange-50 font-semibold transition-all flex items-center justify-center gap-1"
                    >
                        <Eye size={12} /> Details
                    </button>
                    <div className="text-xs px-2 py-2 rounded-lg font-semibold bg-gray-100 text-gray-500 text-center flex items-center justify-center gap-1">
                        <Clock size={12} /> Archive
                    </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                    {expanded && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-lg p-3 space-y-2"
                        >
                            <p className="text-xs text-gray-700 leading-relaxed">{job?.description || 'No description available.'}</p>
                            <p className="text-xs text-gray-600">
                                <span className="font-semibold">📍 Location:</span>{' '}
                                {[job?.location?.locality, job?.location?.city, job?.location?.pincode].filter(Boolean).join(', ') || 'N/A'}
                            </p>
                            {['cancelled', 'cancelled_by_client'].includes(job.status) && job.cancellationReason && (
                                <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">
                                    <span className="font-semibold">⚠️ Cancellation Reason:</span> {job.cancellationReason}
                                </p>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}

// ── Feedback Card Component ───────────────────────────────────────────────────
function FeedbackCard({ item, index }) {
    const [expanded, setExpanded] = useState(false);
    const hasLongMessage = item.message?.length > 100;

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ x: 4 }}
            className="bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-lg transition-all overflow-hidden"
        >
            <div className="p-5">
                <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <motion.div whileHover={{ scale: 1.05 }} className="flex-shrink-0 relative">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-orange-100 to-amber-100 border-2 border-orange-200 flex items-center justify-center shadow-md">
                            {item.client?.photo ? (
                                <img
                                    src={getImageUrl(item.client.photo)}
                                    alt={item.client.name}
                                    className="w-full h-full object-cover"
                                    onError={e => { e.target.src = '/admin.png'; }}
                                />
                            ) : (
                                <User size={18} className="text-orange-500" />
                            )}
                        </div>
                        {item.stars === 5 && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full border-2 border-white flex items-center justify-center shadow-md">
                                <Crown size={8} className="text-white" />
                            </div>
                        )}
                    </motion.div>

                    <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                            <div className="flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="font-bold text-gray-800 text-base">{item.client?.name || 'Client'}</p>
                                    {item.client?.verificationStatus === 'approved' && (
                                        <Verified size={14} className="text-emerald-500" />
                                    )}
                                </div>
                                <p className="text-[10px] text-gray-500 mt-0.5 truncate">{item.jobId?.title || 'Job'}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <StarRow rating={item.stars} size={14} animated={index < 3} />
                                <motion.span
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: index * 0.1, type: 'spring' }}
                                    className="text-[10px] font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent px-2 py-0.5 rounded-full border border-orange-200 bg-orange-50"
                                >
                                    +{item.points} pts
                                </motion.span>
                            </div>
                        </div>

                        {/* Skill Badge */}
                        {item.skill && (
                            <span className="inline-flex text-[10px] bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 font-bold px-2 py-0.5 rounded-full capitalize mb-2 border border-blue-100">
                                {getSkillIcon(item.skill)} {item.skill}
                            </span>
                        )}

                        {/* Message */}
                        {item.message?.trim() ? (
                            <div className="mt-2">
                                <div className={`relative ${!expanded && hasLongMessage ? 'max-h-16 overflow-hidden' : ''}`}>
                                    <p className={`text-sm text-gray-600 italic bg-gradient-to-r from-gray-50 to-white rounded-lg px-3 py-2 border border-gray-100 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
                                        "{item.message}"
                                    </p>
                                    {!expanded && hasLongMessage && (
                                        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent" />
                                    )}
                                </div>
                                {hasLongMessage && (
                                    <button
                                        onClick={() => setExpanded(!expanded)}
                                        className="mt-1 text-[10px] text-orange-500 font-semibold hover:underline flex items-center gap-0.5"
                                    >
                                        {expanded ? 'Show less' : 'Read more'}
                                        <ChevronRight size={10} className={`transform transition-transform ${expanded ? 'rotate-90' : ''}`} />
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                                <MessageCircle size={12} />
                                <span className="italic">No written feedback provided</span>
                            </div>
                        )}

                        {/* Date */}
                        <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                            <Calendar size={10} />
                            {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// Helper for skill icons
function getSkillIcon(skill) {
    const icons = {
        'plumbing': '🔧', 'electrical': '⚡', 'carpentry': '🪚',
        'cleaning': '🧹', 'painting': '🎨', 'gardening': '🌱',
        'moving': '📦', 'repair': '🔨', 'default': '⭐'
    };
    return icons[skill?.toLowerCase()] || icons.default;
}

// Helper for MessageCircle icon
const MessageCircle = ({ size, className }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
);

// ── Empty State Component ─────────────────────────────────────────────────────
function EmptyState({ onClear, icon: Icon, message, suggestion, actionText }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center"
        >
            <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-20 h-20 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4"
            >
                <Icon size={36} className="text-orange-400" />
            </motion.div>
            <p className="font-bold text-gray-800 text-lg mb-2">{message}</p>
            <p className="text-gray-400 text-sm">{suggestion}</p>
            {onClear && (
                <button
                    onClick={onClear}
                    className="mt-5 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg transition-all inline-flex items-center gap-2"
                >
                    <RefreshCw size={14} /> {actionText || 'Clear Filters'}
                </button>
            )}
        </motion.div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function History() {
    const [bookings, setBookings] = useState([]);
    const [feedback, setFeedback] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('jobs');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortBy, setSortBy] = useState('date-desc');
    const [showSort, setShowSort] = useState(false);
    const sortRef = useRef(null);

    const load = async () => {
        setLoading(true);
        try {
            const [bRes, fRes] = await Promise.all([getWorkerBookings(), getMyFeedback()]);
            const past = (bRes.data || []).filter(j =>
                ['completed', 'cancelled', 'cancelled_by_client'].includes(j.status)
            );
            setBookings(past);
            setFeedback(fRes.data || []);
        } catch {
            toast.error('Failed to load history.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (sortRef.current && !sortRef.current.contains(event.target)) {
                setShowSort(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredJobs = useMemo(() => {
        let list = [...bookings];
        if (statusFilter !== 'all') {
            list = list.filter(j =>
                statusFilter === 'completed'
                    ? j.status === 'completed'
                    : ['cancelled', 'cancelled_by_client'].includes(j.status)
            );
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(j =>
                j.title?.toLowerCase().includes(q) ||
                j.postedBy?.name?.toLowerCase().includes(q) ||
                j.location?.city?.toLowerCase().includes(q) ||
                j.description?.toLowerCase().includes(q)
            );
        }
        list.sort((a, b) => {
            if (sortBy === 'date-desc') return new Date(b.updatedAt) - new Date(a.updatedAt);
            if (sortBy === 'date-asc') return new Date(a.updatedAt) - new Date(b.updatedAt);
            if (sortBy === 'pay-desc') return (b.payment || 0) - (a.payment || 0);
            if (sortBy === 'pay-asc') return (a.payment || 0) - (b.payment || 0);
            return 0;
        });
        return list;
    }, [bookings, statusFilter, search, sortBy]);

    const filteredFeedback = useMemo(() => {
        if (!search.trim()) return feedback;
        const q = search.toLowerCase();
        return feedback.filter(f =>
            f.jobId?.title?.toLowerCase().includes(q) ||
            f.client?.name?.toLowerCase().includes(q) ||
            f.skill?.toLowerCase().includes(q) ||
            f.message?.toLowerCase().includes(q)
        );
    }, [feedback, search]);

    const SORT_OPTIONS = [
        { v: 'date-desc', l: 'Newest First', icon: ArrowDown },
        { v: 'date-asc', l: 'Oldest First', icon: ArrowUp },
        { v: 'pay-desc', l: 'Highest Pay', icon: TrendingUp },
        { v: 'pay-asc', l: 'Lowest Pay', icon: TrendingUp },
    ];

    const clearFilters = () => {
        setSearch('');
        setStatusFilter('all');
        setSortBy('date-desc');
        toast.success('Filters cleared');
    };

    const hasActiveFilters = search || statusFilter !== 'all' || sortBy !== 'date-desc';

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 pb-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-8">
                
                {/* Hero Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    data-guide-id="worker-page-history"
                    className="mb-8"
                >
                    <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-xl">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                    <Trophy size="24" className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black">Work History</h1>
                                    <p className="text-white/90 text-sm mt-0.5">Track your completed jobs and client feedback</p>
                                </div>
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.05, rotate: 180 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={load}
                                className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-xl text-sm font-semibold hover:bg-white/30 transition-all"
                            >
                                <RefreshCw size="14" className={loading ? 'animate-spin' : ''} />
                                Refresh
                            </motion.button>
                        </div>
                    </div>
                </motion.div>

                {/* Analytics Dashboard */}
                {!loading && (bookings.length > 0 || feedback.length > 0) && (
                    <AnalyticsDashboard bookings={bookings} feedback={feedback} />
                )}

                {/* Tabs */}
                <div className="flex gap-2 mb-6 bg-white p-1.5 rounded-xl shadow-sm border border-gray-100">
                    {[
                        { key: 'jobs', label: 'Job History', count: bookings.length, icon: Briefcase, color: 'orange' },
                        { key: 'ratings', label: 'Client Ratings', count: feedback.length, icon: Star, color: 'yellow' },
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
                                tab === t.key
                                    ? `bg-gradient-to-r from-${t.color}-500 to-amber-500 text-white shadow-md`
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            <t.icon size="14" />
                            <span>{t.label}</span>
                            {t.count > 0 && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                                    tab === t.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                                }`}>
                                    {t.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Search & Filters */}
                <div className="mb-6 space-y-3">
                    <div className="relative">
                        <Search size="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={tab === 'jobs' ? "Search jobs, clients, locations..." : "Search ratings, clients, skills..."}
                            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 bg-white transition-all"
                        />
                    </div>

                    {tab === 'jobs' && (
                        <div className="flex gap-3">
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 focus:outline-none focus:border-orange-400 bg-white"
                            >
                                <option value="all">All Status</option>
                                <option value="completed">✓ Completed</option>
                                <option value="cancelled">✗ Cancelled</option>
                            </select>

                            <div className="relative" ref={sortRef}>
                                <button
                                    onClick={() => setShowSort(!showSort)}
                                    className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:border-orange-300 transition-colors bg-white"
                                >
                                    <Filter size="14" />
                                    <span className="hidden sm:inline">Sort</span>
                                    <ChevronDown size="12" className={`transition-transform ${showSort ? 'rotate-180' : ''}`} />
                                </button>
                                <AnimatePresence>
                                    {showSort && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden min-w-[160px]"
                                        >
                                            {SORT_OPTIONS.map(o => {
                                                const Icon = o.icon;
                                                const isActive = sortBy === o.v;
                                                return (
                                                    <button
                                                        key={o.v}
                                                        onClick={() => { setSortBy(o.v); setShowSort(false); }}
                                                        className={`w-full text-left px-4 py-2.5 text-sm transition-all flex items-center gap-2 ${
                                                            isActive
                                                                ? 'bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 font-semibold'
                                                                : 'text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        <Icon size="12" className={isActive ? 'text-orange-500' : 'text-gray-400'} />
                                                        {o.l}
                                                        {isActive && <CheckCircle2 size="12" className="ml-auto text-orange-500" />}
                                                    </button>
                                                );
                                            })}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    )}

                    {/* Active Filters */}
                    {hasActiveFilters && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span className="text-[10px] text-gray-500">Active filters:</span>
                            {search && (
                                <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-semibold px-2 py-1 rounded-full">
                                    Search: {search}
                                    <button onClick={() => setSearch('')} className="hover:text-orange-900">✕</button>
                                </span>
                            )}
                            {statusFilter !== 'all' && (
                                <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-semibold px-2 py-1 rounded-full">
                                    Status: {statusFilter === 'completed' ? 'Completed' : 'Cancelled'}
                                    <button onClick={() => setStatusFilter('all')} className="hover:text-orange-900">✕</button>
                                </span>
                            )}
                            {sortBy !== 'date-desc' && (
                                <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-semibold px-2 py-1 rounded-full">
                                    Sort: {SORT_OPTIONS.find(o => o.v === sortBy)?.l}
                                    <button onClick={() => setSortBy('date-desc')} className="hover:text-orange-900">✕</button>
                                </span>
                            )}
                            <button
                                onClick={clearFilters}
                                className="text-[10px] text-orange-500 font-semibold hover:underline"
                            >
                                Clear all
                            </button>
                        </div>
                    )}
                </div>

                {/* Content */}
                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <Skeleton />
                        </motion.div>
                    ) : tab === 'jobs' ? (
                        <motion.div key="jobs" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                            {filteredJobs.length === 0 ? (
                                <EmptyState
                                    icon={search || statusFilter !== 'all' ? Search : Briefcase}
                                    message={search || statusFilter !== 'all' ? "No matching jobs found" : "No jobs yet"}
                                    suggestion={search || statusFilter !== 'all' ? "Try adjusting your filters" : "Your completed and cancelled jobs will appear here"}
                                    onClear={search || statusFilter !== 'all' ? clearFilters : null}
                                    actionText="Clear Filters"
                                />
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
                                            <Briefcase size="12" />
                                            {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''} found
                                        </p>
                                        <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                            <Clock size="10" />
                                            <span>Updated recently</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                        {filteredJobs.map((job, idx) => (
                                            <JobCard key={job._id} job={job} index={idx} />
                                        ))}
                                    </div>
                                </>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div key="ratings" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                            {filteredFeedback.length === 0 ? (
                                <EmptyState
                                    icon={search ? Search : Star}
                                    message={search ? "No matching ratings found" : "No ratings yet"}
                                    suggestion={search ? "Try a different search term" : "Client ratings will appear here after you complete jobs"}
                                    onClear={search ? () => setSearch('') : null}
                                    actionText="Clear Search"
                                />
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
                                            <Star size="12" />
                                            {filteredFeedback.length} rating{filteredFeedback.length !== 1 ? 's' : ''}
                                        </p>
                                        <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                            <ThumbsUp size="10" />
                                            <span>From happy clients</span>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        {filteredFeedback.map((item, idx) => (
                                            <FeedbackCard key={item._id} item={item} index={idx} />
                                        ))}
                                    </div>
                                </>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}