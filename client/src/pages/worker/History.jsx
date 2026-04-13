// src/pages/worker/History.jsx
// MOBILE-FRIENDLY & ENHANCED VERSION
// Features: Responsive design, touch-friendly, modern cards, animations, better UX

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
    ArrowUp, ArrowDown, Eye
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_CFG = {
    completed: { label: 'Completed', bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 },
    cancelled: { label: 'Cancelled', bg: 'bg-red-100', text: 'text-red-600', icon: XCircle },
    cancelled_by_client: { label: 'Cancelled', bg: 'bg-red-100', text: 'text-red-600', icon: XCircle },
};

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

// ── Loading Skeleton with shimmer effect ──────────────────────────────────────
function Skeleton() {
    return (
        <div className="space-y-4">
            {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
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

// ── Star Rating Component with animation ─────────────────────────────────────
function StarRow({ rating, size = 14, animated = false }) {
    const stars = [1, 2, 3, 4, 5];
    return (
        <div className="flex items-center gap-0.5">
            {stars.map((s, idx) => (
                <motion.div
                    key={s}
                    initial={animated ? { scale: 0, rotate: -180 } : false}
                    animate={animated ? { scale: 1, rotate: 0 } : {}}
                    transition={{ delay: idx * 0.05, type: 'spring' }}
                >
                    <Star
                        size={size}
                        className={s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}
                    />
                </motion.div>
            ))}
        </div>
    );
}

// ── Analytics Card with hover effects ────────────────────────────────────────
function AnalyticsBar({ bookings, feedback }) {
    const totalEarnings = bookings
        .filter(j => j.status === 'completed')
        .reduce((s, j) => s + (j.payment || 0), 0);
    const completedCount = bookings.filter(j => j.status === 'completed').length;
    const avgRating = feedback.length
        ? (feedback.reduce((s, f) => s + (f.stars || 0), 0) / feedback.length).toFixed(1)
        : '—';
    const totalPoints = feedback.reduce((s, f) => s + (f.points || 0), 0);

    const stats = [
        { icon: Briefcase, label: 'Jobs Done', value: completedCount, color: 'text-orange-600', bg: 'bg-orange-50', gradient: 'from-orange-500 to-orange-600' },
        { icon: TrendingUp, label: 'Total Earned', value: `₹${fmt(totalEarnings)}`, color: 'text-green-600', bg: 'bg-green-50', gradient: 'from-green-500 to-emerald-600' },
        { icon: Star, label: 'Avg Rating', value: avgRating, color: 'text-yellow-600', bg: 'bg-yellow-50', gradient: 'from-yellow-500 to-amber-500' },
        { icon: Award, label: 'Points', value: `+${fmt(totalPoints)}`, color: 'text-blue-600', bg: 'bg-blue-50', gradient: 'from-blue-500 to-cyan-600' },
    ];

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {stats.map(({ icon: Icon, label, value, gradient }, idx) => (
                <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    whileHover={{ y: -2, scale: 1.02 }}
                    className={`bg-gradient-to-br ${gradient} rounded-2xl p-3 sm:p-4 text-white shadow-lg hover:shadow-xl transition-all`}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] sm:text-xs opacity-90 font-medium">{label}</p>
                            <p className="text-sm sm:text-base lg:text-lg font-black mt-1 truncate">{value}</p>
                        </div>
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                            <Icon size={16} className="text-white" />
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}

// ── Enhanced Job Card with animations ─────────────────────────────────────────
function JobCard({ job, index }) {
    const cfg = STATUS_CFG[job.status] || STATUS_CFG.cancelled;
    const Icon = cfg.icon;
    const skills = job.mySlots?.map(s => s.skill).filter(Boolean) ||
                   (job.workerSlots || [])
                       .filter(s => s.assignedWorker?.toString() === JSON.parse(localStorage.getItem('user') || '{}')._id?.toString())
                       .map(s => s.skill) || [];

    const [expanded, setExpanded] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -2 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden"
        >
            <div className={`h-1 ${job.status === 'completed' ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-red-400 to-rose-500'}`} />
            
            <div className="p-4 sm:p-5">
                {/* Top row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-snug line-clamp-2">
                            {job.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-500 line-clamp-2 mt-1">{job.description}</p>
                    </div>
                    <span className={`flex-shrink-0 inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold px-2 sm:px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
                        <Icon size={10} /> {cfg.label}
                    </span>
                </div>

                {/* Skills */}
                {skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {skills.slice(0, 3).map((sk, i) => (
                            <span key={i} className="text-[10px] sm:text-[11px] bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full capitalize">
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

                {/* Meta row */}
                <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs sm:text-sm text-gray-500">
                    {job.payment > 0 && (
                        <span className="flex items-center gap-1 font-bold text-green-600">
                            <IndianRupee size={12} /> ₹{fmt(job.payment)}
                        </span>
                    )}
                    {job.location?.city && (
                        <span className="flex items-center gap-1">
                            <MapPin size={11} /> {job.location.city}
                        </span>
                    )}
                    {job.postedBy?.name && (
                        <span className="flex items-center gap-1">
                            <User size={11} /> {job.postedBy.name}
                        </span>
                    )}
                    {(job.scheduledDate || job.updatedAt) && (
                        <span className="flex items-center gap-1">
                            <Calendar size={11} />
                            {new Date(job.scheduledDate || job.updatedAt).toLocaleDateString('en-IN', {
                                day: 'numeric', month: 'short', year: 'numeric',
                            })}
                        </span>
                    )}
                </div>

                {/* Expandable section for cancellation reason */}
                {['cancelled', 'cancelled_by_client'].includes(job.status) && job.cancellationReason && (
                    <div className="mt-3">
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="flex items-center gap-1 text-red-500 text-xs font-semibold"
                        >
                            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            {expanded ? 'Hide reason' : 'Show cancellation reason'}
                        </button>
                        <AnimatePresence>
                            {expanded && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2"
                                >
                                    <p className="text-xs text-red-600 font-medium break-words">
                                        {job.cancellationReason}
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

// ── Enhanced Feedback Card with animations ────────────────────────────────────
function FeedbackCard({ item, index }) {
    const [expanded, setExpanded] = useState(false);
    const hasLongMessage = item.message?.length > 100;

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -2 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden"
        >
            <div className="p-4 sm:p-5">
                <div className="flex items-start gap-3 sm:gap-4">
                    {/* Client avatar with pulse animation for new */}
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        className="flex-shrink-0 relative"
                    >
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden bg-gradient-to-r from-orange-100 to-amber-100 border-2 border-orange-200 flex items-center justify-center">
                            {item.client?.photo ? (
                                <img
                                    src={getImageUrl(item.client.photo)}
                                    alt={item.client.name}
                                    className="w-full h-full object-cover"
                                    onError={e => { e.target.src = '/admin.png'; }}
                                />
                            ) : (
                                <User size={16} className="text-orange-500" />
                            )}
                        </div>
                        {item.points > 0 && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full border-2 border-white flex items-center justify-center">
                                <Sparkles size={8} className="text-white" />
                            </div>
                        )}
                    </motion.div>

                    <div className="flex-1 min-w-0">
                        {/* Client + job */}
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-gray-900 text-sm sm:text-base truncate">
                                    {item.client?.name || 'Client'}
                                </p>
                                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 truncate">
                                    {item.jobId?.title || 'Job'}
                                </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <StarRow rating={item.stars} size={12} animated={index < 3} />
                                <motion.span
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: index * 0.1, type: 'spring' }}
                                    className="text-[10px] sm:text-xs font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full"
                                >
                                    +{item.points} pts
                                </motion.span>
                            </div>
                        </div>

                        {/* Skill tag */}
                        {item.skill && (
                            <span className="inline-flex text-[9px] sm:text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full capitalize mb-2">
                                {item.skill}
                            </span>
                        )}

                        {/* Message with expand/collapse */}
                        {item.message?.trim() ? (
                            <div>
                                <p className={`text-xs sm:text-sm text-gray-700 italic bg-gray-50 rounded-xl px-3 py-2 border border-gray-100 ${!expanded && hasLongMessage ? 'line-clamp-2' : ''}`}>
                                    "{item.message}"
                                </p>
                                {hasLongMessage && (
                                    <button
                                        onClick={() => setExpanded(!expanded)}
                                        className="mt-1 text-[10px] text-orange-500 font-semibold hover:underline"
                                    >
                                        {expanded ? 'Show less' : 'Read more'}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 italic">No written feedback.</p>
                        )}

                        <p className="text-[10px] sm:text-xs text-gray-400 mt-2">
                            {new Date(item.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric', month: 'long', year: 'numeric',
                            })}
                        </p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// ── Empty State Component ─────────────────────────────────────────────────────
function EmptyState({ onClear, icon: Icon, message, suggestion }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-gray-100 p-8 sm:p-12 text-center"
        >
            <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-5xl sm:text-6xl mb-4"
            >
                <Icon size={48} className="mx-auto text-gray-300" />
            </motion.div>
            <p className="font-bold text-gray-800 text-base sm:text-lg mb-2">{message}</p>
            <p className="text-gray-400 text-xs sm:text-sm">{suggestion}</p>
            {onClear && (
                <button
                    onClick={onClear}
                    className="mt-4 text-orange-500 text-xs sm:text-sm font-bold hover:underline inline-flex items-center gap-1"
                >
                    Clear filters <RefreshCw size={12} />
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

    // Close sort dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (sortRef.current && !sortRef.current.contains(event.target)) {
                setShowSort(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filtered & sorted jobs
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

    // Filtered feedback
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
        { v: 'date-desc', l: 'Newest first', icon: ArrowDown },
        { v: 'date-asc', l: 'Oldest first', icon: ArrowUp },
        { v: 'pay-desc', l: 'Highest pay', icon: TrendingUp },
        { v: 'pay-asc', l: 'Lowest pay', icon: TrendingUp },
    ];

    const clearFilters = () => {
        setSearch('');
        setStatusFilter('all');
        setSortBy('date-desc');
    };

    const hasActiveFilters = search || statusFilter !== 'all' || sortBy !== 'date-desc';

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-24" style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.13rem' }}>
                {/* Page header with animation */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start justify-between mb-4"
                >
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                            Work History
                        </h1>
                        <p className="text-xs sm:text-sm text-gray-500 mt-1">
                            Track your completed jobs and client feedback
                        </p>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.05, rotate: 180 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={load}
                        className="p-2 rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-orange-500 hover:border-orange-200 transition-all shadow-sm"
                        title="Refresh"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </motion.button>
                </motion.div>

                {/* Analytics Bar */}
                {!loading && <AnalyticsBar bookings={bookings} feedback={feedback} />}

                {/* Enhanced Tabs */}
                <div className="flex gap-1 mb-5 bg-white p-1 rounded-2xl shadow-sm border border-gray-100">
                    {[
                        { key: 'jobs', label: 'Jobs', count: bookings.length, icon: Briefcase, color: 'orange' },
                        { key: 'ratings', label: 'Ratings', count: feedback.length, icon: Star, color: 'yellow' },
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                tab === t.key
                                    ? `bg-gradient-to-r from-${t.color}-500 to-amber-500 text-white shadow-md`
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            <t.icon size={14} />
                            <span className="hidden xs:inline">{t.label}</span>
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

                {/* Search + Filters Section */}
                <div className="space-y-3 mb-4">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={tab === 'jobs' ? "Search jobs, clients, cities..." : "Search ratings, clients, skills..."}
                            className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50 transition-all bg-white"
                        />
                    </div>

                    {tab === 'jobs' && (
                        <div className="flex gap-2">
                            {/* Status Filter */}
                            <div className="flex-1">
                                <select
                                    value={statusFilter}
                                    onChange={e => setStatusFilter(e.target.value)}
                                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 focus:outline-none focus:border-orange-400 bg-white"
                                >
                                    <option value="all">All Status</option>
                                    <option value="completed">✓ Completed</option>
                                    <option value="cancelled">✗ Cancelled</option>
                                </select>
                            </div>

                            {/* Sort Dropdown */}
                            <div className="relative" ref={sortRef}>
                                <button
                                    onClick={() => setShowSort(!showSort)}
                                    className="flex items-center gap-1.5 border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 hover:border-orange-300 transition-colors bg-white"
                                >
                                    <Filter size={14} />
                                    <span className="hidden xs:inline">Sort</span>
                                    <ChevronDown size={12} className={`transition-transform ${showSort ? 'rotate-180' : ''}`} />
                                </button>
                                <AnimatePresence>
                                    {showSort && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute right-0 top-full mt-1 bg-white border-2 border-gray-100 rounded-xl shadow-xl z-20 overflow-hidden min-w-[160px]"
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
                                                        <Icon size={12} className={isActive ? 'text-orange-500' : 'text-gray-400'} />
                                                        {o.l}
                                                        {isActive && <CheckCircle2 size={12} className="ml-auto text-orange-500" />}
                                                    </button>
                                                );
                                            })}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    )}

                    {/* Active Filters Display */}
                    {hasActiveFilters && (
                        <div className="flex flex-wrap items-center gap-2">
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

                {/* Content with animations */}
                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <Skeleton />
                        </motion.div>
                    ) : tab === 'jobs' ? (
                        <motion.div
                            key="jobs"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="space-y-3 sm:space-y-4"
                        >
                            {filteredJobs.length === 0 ? (
                                <EmptyState
                                    type="jobs"
                                    icon={search || statusFilter !== 'all' ? Search : Briefcase}
                                    message={search || statusFilter !== 'all' ? "No matching jobs found" : "No past jobs yet"}
                                    suggestion={search || statusFilter !== 'all' ? "Try adjusting your filters" : "Your completed and cancelled jobs will appear here"}
                                    onClear={search || statusFilter !== 'all' ? clearFilters : null}
                                />
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-[10px] sm:text-xs text-gray-400 font-semibold">
                                            {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''} found
                                        </p>
                                        <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                            <Clock size={10} />
                                            <span>Updated recently</span>
                                        </div>
                                    </div>
                                    {filteredJobs.map((job, idx) => (
                                        <JobCard key={job._id} job={job} index={idx} />
                                    ))}
                                </>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="ratings"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="space-y-3 sm:space-y-4"
                        >
                            {filteredFeedback.length === 0 ? (
                                <EmptyState
                                    type="ratings"
                                    icon={search ? Search : Star}
                                    message={search ? "No matching ratings found" : "No ratings yet"}
                                    suggestion={search ? "Try a different search term" : "Client ratings will appear here after you complete jobs"}
                                    onClear={search ? () => setSearch('') : null}
                                />
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-[10px] sm:text-xs text-gray-400 font-semibold">
                                            {filteredFeedback.length} rating{filteredFeedback.length !== 1 ? 's' : ''}
                                        </p>
                                        <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                            <ThumbsUp size={10} />
                                            <span>From happy clients</span>
                                        </div>
                                    </div>
                                    {filteredFeedback.map((item, idx) => (
                                        <FeedbackCard key={item._id} item={item} index={idx} />
                                    ))}
                                </>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}