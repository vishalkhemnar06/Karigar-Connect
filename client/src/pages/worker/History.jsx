// src/pages/worker/History.jsx
// ENHANCED:
//   - Job history with search, filter by status/month, sort by date/payment
//   - Rich job cards showing client info, skills, payment, location, dates
//   - Ratings tab with star display, points, skill-wise breakdown, client photo
//   - Analytics summary bar: total jobs, total earnings, avg rating, total points
//   - Empty states with clear CTAs
//   - Loading skeleton

import React, { useEffect, useState, useMemo } from 'react';
import { getWorkerBookings, getMyFeedback, getImageUrl } from '../../api';
import toast from 'react-hot-toast';
import {
    Star, MapPin, Calendar, DollarSign, User,
    Search, Filter, TrendingUp, Briefcase, Award,
    ChevronDown, Clock, CheckCircle2, XCircle, RefreshCw,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_CFG = {
    completed: { label: 'Completed', bg: 'bg-green-100',  text: 'text-green-700',  icon: CheckCircle2 },
    cancelled:  { label: 'Cancelled', bg: 'bg-red-100',    text: 'text-red-600',    icon: XCircle },
    cancelled_by_client: { label: 'Cancelled', bg: 'bg-red-100', text: 'text-red-600', icon: XCircle },
};

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
    return (
        <div className="space-y-4">
            {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                    <div className="flex justify-between mb-3">
                        <div className="space-y-2">
                            <div className="h-4 w-48 bg-gray-200 rounded-full" />
                            <div className="h-3 w-32 bg-gray-100 rounded-full" />
                        </div>
                        <div className="h-6 w-20 bg-gray-100 rounded-full" />
                    </div>
                    <div className="flex gap-3">
                        {[1, 2, 3].map(j => <div key={j} className="h-3 w-20 bg-gray-100 rounded-full" />)}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Star row ──────────────────────────────────────────────────────────────────
function StarRow({ rating, size = 14 }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} size={size}
                    className={s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'} />
            ))}
        </div>
    );
}

// ── Analytics bar ─────────────────────────────────────────────────────────────
function AnalyticsBar({ bookings, feedback }) {
    const totalEarnings = bookings
        .filter(j => j.status === 'completed')
        .reduce((s, j) => s + (j.payment || 0), 0);
    const completedCount = bookings.filter(j => j.status === 'completed').length;
    const avgRating      = feedback.length
        ? (feedback.reduce((s, f) => s + (f.stars || 0), 0) / feedback.length).toFixed(1)
        : '—';
    const totalPoints    = feedback.reduce((s, f) => s + (f.points || 0), 0);

    const stats = [
        { icon: Briefcase,  label: 'Jobs Done',       value: completedCount,       color: 'text-orange-600', bg: 'bg-orange-50' },
        { icon: TrendingUp, label: 'Total Earned',     value: `₹${fmt(totalEarnings)}`, color: 'text-green-600',  bg: 'bg-green-50' },
        { icon: Star,       label: 'Avg Rating',       value: avgRating,            color: 'text-yellow-600', bg: 'bg-yellow-50' },
        { icon: Award,      label: 'Points Earned',    value: `+${fmt(totalPoints)}`,   color: 'text-blue-600',   bg: 'bg-blue-50' },
    ];

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {stats.map(({ icon: Icon, label, value, color, bg }) => (
                <div key={label} className={`${bg} rounded-2xl p-4 flex items-center gap-3 border border-white shadow-sm`}>
                    <div className={`w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm flex-shrink-0`}>
                        <Icon size={16} className={color} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs text-gray-500 font-medium">{label}</p>
                        <p className={`text-base font-black ${color} leading-tight`}>{value}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Job Card ──────────────────────────────────────────────────────────────────
function JobCard({ job }) {
    const cfg    = STATUS_CFG[job.status] || STATUS_CFG.cancelled;
    const Icon   = cfg.icon;
    const skills = job.mySlots?.map(s => s.skill).filter(Boolean) ||
                   (job.workerSlots || [])
                       .filter(s => s.assignedWorker?.toString() === JSON.parse(localStorage.getItem('user') || '{}')._id?.toString())
                       .map(s => s.skill) || [];

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
            {/* Top row */}
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-base leading-snug truncate">{job.title}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mt-0.5">{job.description}</p>
                </div>
                <span className={`flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
                    <Icon size={11} /> {cfg.label}
                </span>
            </div>

            {/* Skills */}
            {skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {skills.map((sk, i) => (
                        <span key={i} className="text-[11px] bg-orange-100 text-orange-700 font-semibold px-2.5 py-0.5 rounded-full capitalize">{sk}</span>
                    ))}
                </div>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-gray-500">
                {job.payment > 0 && (
                    <span className="flex items-center gap-1 font-semibold text-green-600">
                        <DollarSign size={13} /> ₹{fmt(job.payment)}
                    </span>
                )}
                {job.location?.city && (
                    <span className="flex items-center gap-1">
                        <MapPin size={12} /> {job.location.city}
                    </span>
                )}
                {job.postedBy?.name && (
                    <span className="flex items-center gap-1">
                        <User size={12} /> {job.postedBy.name}
                    </span>
                )}
                {(job.scheduledDate || job.updatedAt) && (
                    <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(job.scheduledDate || job.updatedAt).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric',
                        })}
                    </span>
                )}
            </div>

            {/* Cancellation reason */}
            {['cancelled', 'cancelled_by_client'].includes(job.status) && job.cancellationReason && (
                <div className="mt-3 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                    <p className="text-xs text-red-600 font-medium">
                        Reason: {job.cancellationReason}
                    </p>
                </div>
            )}
        </div>
    );
}

// ── Feedback Card ─────────────────────────────────────────────────────────────
function FeedbackCard({ item }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
            <div className="flex items-start gap-4">
                {/* Client avatar */}
                <div className="flex-shrink-0">
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-orange-100 border-2 border-orange-200 flex items-center justify-center">
                        {item.client?.photo
                            ? <img src={getImageUrl(item.client.photo)} alt={item.client.name}
                                   className="w-full h-full object-cover"
                                   onError={e => { e.target.src = '/admin.png'; }} />
                            : <User size={18} className="text-orange-500" />
                        }
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    {/* Client + job */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                            <p className="font-bold text-gray-900">{item.client?.name || 'Client'}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{item.jobId?.title || 'Job'}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <StarRow rating={item.stars} />
                            <span className="text-xs font-black text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-full">
                                +{item.points} pts
                            </span>
                        </div>
                    </div>

                    {/* Skill tag */}
                    {item.skill && (
                        <span className="text-[11px] bg-blue-100 text-blue-700 font-semibold px-2.5 py-0.5 rounded-full capitalize inline-block mb-2">
                            {item.skill}
                        </span>
                    )}

                    {/* Message */}
                    {item.message?.trim() ? (
                        <p className="text-sm text-gray-700 italic bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                            "{item.message}"
                        </p>
                    ) : (
                        <p className="text-xs text-gray-400 italic">No written feedback.</p>
                    )}

                    <p className="text-xs text-gray-400 mt-2">
                        {new Date(item.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'long', year: 'numeric',
                        })}
                    </p>
                </div>
            </div>
        </div>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function History() {
    const [bookings,  setBookings]  = useState([]);
    const [feedback,  setFeedback]  = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [tab,       setTab]       = useState('jobs');
    const [search,    setSearch]    = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortBy,    setSortBy]    = useState('date-desc');
    const [showSort,  setShowSort]  = useState(false);

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

    // ── Filtered & sorted jobs ────────────────────────────────────────────────
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
                j.location?.city?.toLowerCase().includes(q)
            );
        }
        list.sort((a, b) => {
            if (sortBy === 'date-desc') return new Date(b.updatedAt) - new Date(a.updatedAt);
            if (sortBy === 'date-asc')  return new Date(a.updatedAt) - new Date(b.updatedAt);
            if (sortBy === 'pay-desc')  return (b.payment || 0) - (a.payment || 0);
            if (sortBy === 'pay-asc')   return (a.payment || 0) - (b.payment || 0);
            return 0;
        });
        return list;
    }, [bookings, statusFilter, search, sortBy]);

    // ── Filtered feedback ─────────────────────────────────────────────────────
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
        { v: 'date-desc', l: 'Newest first' },
        { v: 'date-asc',  l: 'Oldest first' },
        { v: 'pay-desc',  l: 'Highest pay' },
        { v: 'pay-asc',   l: 'Lowest pay' },
    ];

    return (
        <div className="max-w-3xl mx-auto px-4 py-6 pb-24">

            {/* Page header */}
            <div className="flex items-start justify-between mb-2">
                <div>
                    <h1 className="text-2xl font-black text-gray-900">Work History</h1>
                    <p className="text-sm text-gray-500 mt-0.5">All your past jobs and ratings from clients</p>
                </div>
                <button onClick={load} className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-orange-500 hover:border-orange-200 transition-colors mt-1">
                    <RefreshCw size={15} />
                </button>
            </div>

            {/* Analytics */}
            {!loading && <AnalyticsBar bookings={bookings} feedback={feedback} />}

            {/* Tabs */}
            <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-2xl">
                {[
                    { key: 'jobs',    label: `Jobs (${bookings.length})`,    emoji: '📋' },
                    { key: 'ratings', label: `Ratings (${feedback.length})`, emoji: '⭐' },
                ].map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                            tab === t.key
                                ? 'bg-white text-orange-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {t.emoji} {t.label}
                    </button>
                ))}
            </div>

            {/* Search + Filter (Jobs tab) */}
            {tab === 'jobs' && (
                <div className="flex gap-2 mb-4">
                    <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search jobs, clients, cities…"
                            className="w-full pl-9 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                        />
                    </div>

                    {/* Status filter */}
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                    >
                        <option value="all">All</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>

                    {/* Sort */}
                    <div className="relative">
                        <button
                            onClick={() => setShowSort(s => !s)}
                            className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-600 hover:border-orange-300 transition-colors bg-white"
                        >
                            <Filter size={13} />
                            <ChevronDown size={12} />
                        </button>
                        {showSort && (
                            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden min-w-[150px]">
                                {SORT_OPTIONS.map(o => (
                                    <button
                                        key={o.v}
                                        onClick={() => { setSortBy(o.v); setShowSort(false); }}
                                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                                            sortBy === o.v
                                                ? 'bg-orange-50 text-orange-700 font-semibold'
                                                : 'text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >{o.l}</button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Search (Ratings tab) */}
            {tab === 'ratings' && (
                <div className="relative mb-4">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search ratings, clients, skills…"
                        className="w-full pl-9 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                    />
                </div>
            )}

            {/* Content */}
            {loading ? (
                <Skeleton />
            ) : tab === 'jobs' ? (
                filteredJobs.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                        <div className="text-5xl mb-3">📋</div>
                        <p className="font-bold text-gray-600">
                            {search || statusFilter !== 'all' ? 'No matching jobs' : 'No past jobs yet'}
                        </p>
                        <p className="text-gray-400 text-sm mt-1">
                            {search || statusFilter !== 'all'
                                ? 'Try different filters.'
                                : 'Your completed and cancelled jobs will show up here.'}
                        </p>
                        {(search || statusFilter !== 'all') && (
                            <button
                                onClick={() => { setSearch(''); setStatusFilter('all'); }}
                                className="mt-4 text-orange-500 text-sm font-bold underline"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-xs text-gray-400 font-semibold">{filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''}</p>
                        {filteredJobs.map(job => <JobCard key={job._id} job={job} />)}
                    </div>
                )
            ) : (
                filteredFeedback.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                        <div className="text-5xl mb-3">⭐</div>
                        <p className="font-bold text-gray-600">
                            {search ? 'No matching ratings' : 'No ratings yet'}
                        </p>
                        <p className="text-gray-400 text-sm mt-1">
                            {search
                                ? 'Try a different search term.'
                                : 'Client ratings will appear here after you complete jobs.'}
                        </p>
                        {search && (
                            <button onClick={() => setSearch('')} className="mt-4 text-orange-500 text-sm font-bold underline">
                                Clear search
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-xs text-gray-400 font-semibold">{filteredFeedback.length} rating{filteredFeedback.length !== 1 ? 's' : ''}</p>
                        {filteredFeedback.map(item => <FeedbackCard key={item._id} item={item} />)}
                    </div>
                )
            )}
        </div>
    );
}