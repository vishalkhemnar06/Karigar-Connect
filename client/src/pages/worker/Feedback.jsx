// src/pages/worker/Feedback.jsx
// ENHANCED:
//   - Analytics header: total ratings, average stars, total points, best rating
//   - Star breakdown bar chart (how many 5★, 4★, etc.)
//   - Skill-wise average rating table
//   - Each rating card: client photo, job title, skill tag, stars, points, message, date
//   - Search by client name, job, skill, message
//   - Sort by date / stars / points
//   - Empty state with illustration

import React, { useState, useEffect, useMemo } from 'react';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { Star, User, Award, TrendingUp, Search, ChevronDown, RefreshCw, Filter } from 'lucide-react';

// ── Star Row ──────────────────────────────────────────────────────────────────
function StarRow({ rating, size = 15 }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(s => (
                <Star
                    key={s}
                    size={size}
                    className={s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}
                />
            ))}
        </div>
    );
}

// ── Star breakdown bar ────────────────────────────────────────────────────────
function StarBreakdown({ feedback }) {
    const max = Math.max(...[5, 4, 3, 2, 1].map(s => feedback.filter(f => f.stars === s).length), 1);
    return (
        <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map(s => {
                const count = feedback.filter(f => f.stars === s).length;
                const pct   = Math.round((count / Math.max(feedback.length, 1)) * 100);
                const barW  = Math.round((count / max) * 100);
                return (
                    <div key={s} className="flex items-center gap-2 text-xs">
                        <span className="w-4 text-gray-600 font-bold text-right">{s}</span>
                        <Star size={10} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                                style={{ width: `${barW}%` }}
                            />
                        </div>
                        <span className="w-8 text-gray-400 font-medium">{count}</span>
                    </div>
                );
            })}
        </div>
    );
}

// ── Skill breakdown table ─────────────────────────────────────────────────────
function SkillBreakdown({ feedback }) {
    const skills = {};
    feedback.forEach(f => {
        if (!f.skill) return;
        if (!skills[f.skill]) skills[f.skill] = { total: 0, count: 0, points: 0 };
        skills[f.skill].total  += f.stars || 0;
        skills[f.skill].count  += 1;
        skills[f.skill].points += f.points || 0;
    });
    const rows = Object.entries(skills)
        .map(([sk, v]) => ({ sk, avg: (v.total / v.count).toFixed(1), count: v.count, points: v.points }))
        .sort((a, b) => b.avg - a.avg);

    if (rows.length === 0) return null;
    return (
        <div className="mt-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">By Skill</p>
            <div className="space-y-2">
                {rows.map(r => (
                    <div key={r.sk} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                        <span className="text-sm font-semibold text-gray-700 capitalize">{r.sk}</span>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>{r.count} rating{r.count !== 1 ? 's' : ''}</span>
                            <div className="flex items-center gap-1">
                                <Star size={11} className="text-yellow-400 fill-yellow-400" />
                                <span className="font-bold text-gray-800">{r.avg}</span>
                            </div>
                            <span className="font-bold text-orange-600">+{r.points}pts</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Analytics panel ───────────────────────────────────────────────────────────
function AnalyticsPanel({ feedback }) {
    const avg      = feedback.length
        ? (feedback.reduce((s, f) => s + (f.stars || 0), 0) / feedback.length)
        : 0;
    const points   = feedback.reduce((s, f) => s + (f.points || 0), 0);
    const best     = feedback.length ? Math.max(...feedback.map(f => f.stars || 0)) : 0;
    const fiveStarCount = feedback.filter(f => f.stars === 5).length;

    if (feedback.length === 0) return null;

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
            {/* Top stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                {[
                    { label: 'Total Ratings', value: feedback.length,                   sub: 'from clients',        color: 'text-gray-800',   icon: Star },
                    { label: 'Avg Rating',     value: avg.toFixed(1),                   sub: 'out of 5 stars',      color: 'text-yellow-600', icon: Star },
                    { label: 'Points Earned',  value: `+${points.toLocaleString('en-IN')}`, sub: 'total points',    color: 'text-orange-600', icon: Award },
                    { label: '5-Star Ratings', value: fiveStarCount,                    sub: `${Math.round((fiveStarCount / Math.max(feedback.length, 1)) * 100)}% of all`, color: 'text-green-600', icon: TrendingUp },
                ].map(({ label, value, sub, color, icon: Icon }) => (
                    <div key={label} className="text-center">
                        <p className={`text-2xl font-black ${color}`}>{value}</p>
                        <p className="text-xs font-semibold text-gray-700">{label}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
                    </div>
                ))}
            </div>

            {/* Overall star display */}
            <div className="flex items-center justify-center gap-2 mb-5">
                <span className="text-4xl font-black text-gray-900">{avg.toFixed(1)}</span>
                <div>
                    <StarRow rating={Math.round(avg)} size={20} />
                    <p className="text-xs text-gray-400 mt-1 text-center">{feedback.length} ratings</p>
                </div>
            </div>

            {/* Star breakdown */}
            <StarBreakdown feedback={feedback} />

            {/* Skill breakdown */}
            <SkillBreakdown feedback={feedback} />
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
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-orange-100 border-2 border-orange-200 flex items-center justify-center">
                        {item.client?.photo
                            ? <img
                                src={api.getImageUrl(item.client.photo)}
                                alt={item.client.name}
                                className="w-full h-full object-cover"
                                onError={e => { e.target.src = '/admin.png'; }}
                              />
                            : <User size={20} className="text-orange-400" />
                        }
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="min-w-0">
                            <p className="font-bold text-gray-900 truncate">{item.client?.name || 'Client'}</p>
                            <p className="text-xs text-gray-500 truncate mt-0.5">{item.jobId?.title || 'Job'}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <StarRow rating={item.stars} />
                            <span className="text-xs font-black text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-200">
                                +{item.points} pts
                            </span>
                        </div>
                    </div>

                    {/* Skill */}
                    {item.skill && (
                        <span className="inline-block text-[11px] bg-blue-50 text-blue-700 font-bold px-2.5 py-0.5 rounded-full capitalize mb-2 border border-blue-100">
                            {item.skill}
                        </span>
                    )}

                    {/* Message */}
                    {item.message?.trim() ? (
                        <p className="text-sm text-gray-700 italic leading-relaxed bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 mt-1">
                            "{item.message}"
                        </p>
                    ) : (
                        <p className="text-xs text-gray-400 italic mt-1">No written message.</p>
                    )}

                    {/* Date */}
                    <p className="text-[11px] text-gray-400 mt-2.5">
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
const Feedback = () => {
    const [feedback,  setFeedback]  = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [search,    setSearch]    = useState('');
    const [sortBy,    setSortBy]    = useState('date-desc');
    const [showSort,  setShowSort]  = useState(false);
    const [viewMode,  setViewMode]  = useState('all'); // 'all' | 'analytics'

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await api.getMyFeedback();
            setFeedback(Array.isArray(data) ? data : []);
        } catch {
            toast.error('Could not load ratings.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const filtered = useMemo(() => {
        let list = [...feedback];
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(f =>
                f.client?.name?.toLowerCase().includes(q) ||
                f.jobId?.title?.toLowerCase().includes(q) ||
                f.skill?.toLowerCase().includes(q) ||
                f.message?.toLowerCase().includes(q)
            );
        }
        list.sort((a, b) => {
            if (sortBy === 'date-desc')   return new Date(b.createdAt) - new Date(a.createdAt);
            if (sortBy === 'date-asc')    return new Date(a.createdAt) - new Date(b.createdAt);
            if (sortBy === 'stars-desc')  return (b.stars || 0) - (a.stars || 0);
            if (sortBy === 'stars-asc')   return (a.stars || 0) - (b.stars || 0);
            if (sortBy === 'points-desc') return (b.points || 0) - (a.points || 0);
            return 0;
        });
        return list;
    }, [feedback, search, sortBy]);

    const SORT_OPTIONS = [
        { v: 'date-desc',   l: 'Newest first' },
        { v: 'date-asc',    l: 'Oldest first' },
        { v: 'stars-desc',  l: 'Highest rating' },
        { v: 'stars-asc',   l: 'Lowest rating' },
        { v: 'points-desc', l: 'Most points' },
    ];

    const avgStars = feedback.length
        ? (feedback.reduce((s, f) => s + (f.stars || 0), 0) / feedback.length).toFixed(1)
        : null;

    return (
        <div className="max-w-3xl mx-auto px-4 py-6 pb-24">

            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-black text-gray-900">My Ratings</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {feedback.length > 0
                            ? `${feedback.length} rating${feedback.length !== 1 ? 's' : ''} from clients · avg ${avgStars}★`
                            : 'Ratings from clients after completed jobs'}
                    </p>
                </div>
                <button onClick={load} className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-orange-500 hover:border-orange-200 transition-colors mt-1">
                    <RefreshCw size={15} />
                </button>
            </div>

            {/* Analytics panel (only if data exists) */}
            {!loading && feedback.length > 0 && <AnalyticsPanel feedback={feedback} />}

            {/* Search + Sort */}
            {!loading && feedback.length > 0 && (
                <div className="flex gap-2 mb-4">
                    <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by client, job, skill, or message…"
                            className="w-full pl-9 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                        />
                    </div>
                    <div className="relative">
                        <button
                            onClick={() => setShowSort(s => !s)}
                            className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-600 hover:border-orange-300 transition-colors bg-white"
                        >
                            <Filter size={13} />
                            <ChevronDown size={12} />
                        </button>
                        {showSort && (
                            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden min-w-[160px]">
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

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-14 text-center">
                    <div className="text-6xl mb-4">⭐</div>
                    <p className="font-bold text-gray-700 text-lg">
                        {search ? 'No matching ratings' : 'No ratings yet'}
                    </p>
                    <p className="text-gray-400 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
                        {search
                            ? 'Try different search terms.'
                            : 'Complete jobs and your clients will be able to rate your work. Ratings appear here.'}
                    </p>
                    {search && (
                        <button onClick={() => setSearch('')} className="mt-4 text-orange-500 text-sm font-bold underline">
                            Clear search
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {filtered.length < feedback.length && (
                        <p className="text-xs text-gray-400 font-semibold">{filtered.length} of {feedback.length} ratings</p>
                    )}
                    {filtered.map(item => <FeedbackCard key={item._id} item={item} />)}
                </div>
            )}
        </div>
    );
};

export default Feedback;