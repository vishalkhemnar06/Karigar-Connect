// src/pages/worker/Feedback.jsx
// ENHANCED UI VERSION - All original functionality preserved
// Enhanced with: Modern gradients, animations, glassmorphism, better visual hierarchy, micro-interactions

import React, { useState, useEffect, useMemo } from 'react';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { 
    Star, User, Award, TrendingUp, Search, ChevronDown, 
    RefreshCw, Filter, Calendar, MessageCircle, ThumbsUp, 
    BarChart3, Sparkles, Crown, Trophy, Target, 
    Eye, EyeOff, ChevronRight, Heart, Smile 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Enhanced Star Row ──────────────────────────────────────────────────────────
function StarRow({ rating, size = 16, animated = false }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(s => (
                <motion.div
                    key={s}
                    initial={animated ? { scale: 0 } : false}
                    animate={animated ? { scale: 1 } : false}
                    transition={{ delay: s * 0.05 }}
                >
                    <Star
                        size={size}
                        className={s <= rating 
                            ? 'text-yellow-400 fill-yellow-400 drop-shadow-sm' 
                            : 'text-gray-200 fill-gray-200'
                        }
                    />
                </motion.div>
            ))}
        </div>
    );
}

// ── Enhanced Star breakdown bar ────────────────────────────────────────────────
function StarBreakdown({ feedback }) {
    const max = Math.max(...[5, 4, 3, 2, 1].map(s => feedback.filter(f => f.stars === s).length), 1);
    
    return (
        <div className="space-y-2">
            {[5, 4, 3, 2, 1].map(s => {
                const count = feedback.filter(f => f.stars === s).length;
                const pct   = Math.round((count / Math.max(feedback.length, 1)) * 100);
                const barW  = Math.round((count / max) * 100);
                return (
                    <motion.div 
                        key={s} 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: (5 - s) * 0.1 }}
                        className="flex items-center gap-2 text-xs group"
                    >
                        <span className="w-5 text-gray-700 font-bold text-right">{s}</span>
                        <Star size={12} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />
                        <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${barW}%` }}
                                transition={{ duration: 0.8, delay: (5 - s) * 0.05 }}
                                className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full"
                            />
                        </div>
                        <span className="w-10 text-gray-500 font-semibold">{count}</span>
                        <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">{pct}%</span>
                    </motion.div>
                );
            })}
        </div>
    );
}

// ── Enhanced Skill breakdown table ─────────────────────────────────────────────
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
        .map(([sk, v]) => ({ 
            sk, 
            avg: (v.total / v.count).toFixed(1), 
            count: v.count, 
            points: v.points,
            icon: getSkillIcon(sk)
        }))
        .sort((a, b) => b.avg - a.avg);

    if (rows.length === 0) return null;
    
    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6"
        >
            <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center">
                    <Target size={12} className="text-white" />
                </div>
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Performance by Skill</p>
            </div>
            <div className="space-y-2">
                {rows.map((r, idx) => (
                    <motion.div
                        key={r.sk}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="group flex items-center justify-between bg-gradient-to-r from-gray-50 to-white rounded-xl px-4 py-3 hover:shadow-md transition-all border border-gray-100"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-xl">{r.icon}</span>
                            <span className="text-sm font-bold text-gray-700 capitalize">{r.sk}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                            <span className="text-gray-500 font-semibold">{r.count} rating{r.count !== 1 ? 's' : ''}</span>
                            <div className="flex items-center gap-1.5">
                                <StarRow rating={parseFloat(r.avg)} size={12} />
                                <span className="font-bold text-gray-800 ml-1">{r.avg}</span>
                            </div>
                            <motion.span 
                                whileHover={{ scale: 1.05 }}
                                className="font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent"
                            >
                                +{r.points} pts
                            </motion.span>
                        </div>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
}

function getSkillIcon(skill) {
    const icons = {
        'plumbing': '🔧',
        'electrical': '⚡',
        'carpentry': '🪚',
        'cleaning': '🧹',
        'painting': '🎨',
        'gardening': '🌱',
        'moving': '📦',
        'repair': '🔨',
        'default': '⭐'
    };
    return icons[skill?.toLowerCase()] || icons.default;
}

// ── Enhanced Analytics panel ───────────────────────────────────────────────────
function AnalyticsPanel({ feedback }) {
    const avg      = feedback.length
        ? (feedback.reduce((s, f) => s + (f.stars || 0), 0) / feedback.length)
        : 0;
    const points   = feedback.reduce((s, f) => s + (f.points || 0), 0);
    const best     = feedback.length ? Math.max(...feedback.map(f => f.stars || 0)) : 0;
    const fiveStarCount = feedback.filter(f => f.stars === 5).length;
    const fourStarCount = feedback.filter(f => f.stars === 4).length;
    const threeStarCount = feedback.filter(f => f.stars === 3).length;

    if (feedback.length === 0) return null;

    return (
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-white to-orange-50/30 rounded-3xl border-2 border-orange-100 shadow-xl p-6 mb-6 relative overflow-hidden"
        >
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-200 to-red-200 rounded-full blur-3xl opacity-20" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-yellow-200 to-orange-200 rounded-full blur-3xl opacity-20" />
            
            {/* Header */}
            <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center shadow-lg">
                        <BarChart3 size={20} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-gray-800">Performance Analytics</h3>
                        <p className="text-xs text-gray-500">Your rating breakdown and insights</p>
                    </div>
                </div>
                <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="w-8 h-8 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 flex items-center justify-center shadow-md"
                >
                    <Sparkles size={14} className="text-white" />
                </motion.div>
            </div>

            {/* Top stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Total Ratings', value: feedback.length, sub: 'from clients', icon: Star, gradient: 'from-blue-500 to-indigo-500', color: 'text-blue-600' },
                    { label: 'Average Rating', value: avg.toFixed(1), sub: 'out of 5 stars', icon: Trophy, gradient: 'from-yellow-500 to-orange-500', color: 'text-yellow-600' },
                    { label: 'Points Earned', value: `+${points.toLocaleString('en-IN')}`, sub: 'total points', icon: Award, gradient: 'from-orange-500 to-red-500', color: 'text-orange-600' },
                    { label: '5-Star Rate', value: `${Math.round((fiveStarCount / Math.max(feedback.length, 1)) * 100)}%`, sub: 'excellent ratings', icon: Crown, gradient: 'from-emerald-500 to-teal-500', color: 'text-emerald-600' },
                ].map(({ label, value, sub, icon: Icon, gradient, color }, idx) => (
                    <motion.div
                        key={label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-white rounded-2xl p-3 text-center shadow-sm hover:shadow-md transition-all border border-gray-100"
                    >
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${gradient} flex items-center justify-center mx-auto mb-2 shadow-md`}>
                            <Icon size={16} className="text-white" />
                        </div>
                        <p className={`text-xl font-black ${color}`}>{value}</p>
                        <p className="text-xs font-semibold text-gray-700 mt-0.5">{label}</p>
                        <p className="text-[9px] text-gray-400 mt-0.5">{sub}</p>
                    </motion.div>
                ))}
            </div>

            {/* Overall star display with animation */}
            <div className="flex items-center justify-center gap-4 mb-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl border border-orange-100">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    className="text-5xl font-black bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent"
                >
                    {avg.toFixed(1)}
                </motion.div>
                <div className="text-center">
                    <StarRow rating={Math.round(avg)} size={24} animated />
                    <p className="text-xs text-gray-500 mt-1 font-semibold">{feedback.length} total ratings</p>
                </div>
                <div className="flex gap-1">
                    {[5, 4, 3].map((star, idx) => {
                        const count = star === 5 ? fiveStarCount : star === 4 ? fourStarCount : threeStarCount;
                        return (
                            <div key={star} className="text-center">
                                <div className="text-xs font-bold text-gray-600">{star}★</div>
                                <div className="text-sm font-black text-gray-800">{count}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Star breakdown */}
            <StarBreakdown feedback={feedback} />

            {/* Skill breakdown */}
            <SkillBreakdown feedback={feedback} />
        </motion.div>
    );
}

// ── Enhanced Feedback Card ─────────────────────────────────────────────────────
function FeedbackCard({ item, index }) {
    const [expanded, setExpanded] = useState(false);
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -2 }}
            className="bg-white rounded-2xl border-2 border-gray-100 hover:border-orange-200 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
        >
            <div className="p-5">
                <div className="flex items-start gap-4">
                    {/* Client avatar with glow effect */}
                    <motion.div 
                        whileHover={{ scale: 1.05 }}
                        className="flex-shrink-0 relative"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-full blur-sm opacity-0 group-hover:opacity-50 transition-opacity" />
                        <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-orange-100 to-amber-100 border-2 border-orange-200 flex items-center justify-center shadow-md relative">
                            {item.client?.photo
                                ? <img
                                    src={api.getImageUrl(item.client.photo)}
                                    alt={item.client.name}
                                    className="w-full h-full object-cover"
                                    onError={e => { e.target.src = '/admin.png'; }}
                                  />
                                : <User size={24} className="text-orange-400" />
                            }
                        </div>
                        {item.stars === 5 && (
                            <motion.div 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full flex items-center justify-center shadow-md"
                            >
                                <Crown size={10} className="text-white" />
                            </motion.div>
                        )}
                    </motion.div>

                    <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0">
                                <p className="font-bold text-gray-900 text-lg truncate">{item.client?.name || 'Client'}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                                        <Calendar size={10} />
                                        {new Date(item.createdAt).toLocaleDateString('en-IN', {
                                            day: 'numeric', month: 'short', year: 'numeric',
                                        })}
                                    </p>
                                    <span className="text-xs text-gray-300">•</span>
                                    <p className="text-xs text-gray-500 truncate font-medium">
                                        {item.jobId?.title || 'Job'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                <StarRow rating={item.stars} size={18} animated />
                                <motion.span 
                                    whileHover={{ scale: 1.05 }}
                                    className="text-xs font-black bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent px-2.5 py-0.5 rounded-full border border-orange-200 bg-orange-50"
                                >
                                    +{item.points} points
                                </motion.span>
                            </div>
                        </div>

                        {/* Skill badge */}
                        {item.skill && (
                            <motion.span 
                                whileHover={{ scale: 1.05 }}
                                className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm mb-3"
                            >
                                {getSkillIcon(item.skill)} {item.skill}
                            </motion.span>
                        )}

                        {/* Message with expand/collapse */}
                        {item.message?.trim() ? (
                            <motion.div 
                                className="mt-2"
                                initial={false}
                                animate={{ height: expanded ? 'auto' : 'auto' }}
                            >
                                <div className={`relative ${!expanded && item.message.length > 150 ? 'max-h-20 overflow-hidden' : ''}`}>
                                    <p className={`text-sm text-gray-700 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
                                        "{item.message}"
                                    </p>
                                    {!expanded && item.message.length > 150 && (
                                        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent" />
                                    )}
                                </div>
                                {item.message.length > 150 && (
                                    <button
                                        onClick={() => setExpanded(!expanded)}
                                        className="text-xs font-semibold text-orange-500 hover:text-orange-600 mt-1 flex items-center gap-1"
                                    >
                                        {expanded ? 'Show less' : 'Read more'}
                                        <ChevronRight size={12} className={`transform transition-transform ${expanded ? 'rotate-90' : ''}`} />
                                    </button>
                                )}
                            </motion.div>
                        ) : (
                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2">
                                <MessageCircle size={12} />
                                <span className="italic">No written feedback provided</span>
                            </div>
                        )}

                        {/* Feedback footer */}
                        <div className="flex items-center gap-3 mt-3 pt-2 border-t border-gray-100">
                            <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                <ThumbsUp size={10} />
                                <span>Helpful review</span>
                            </div>
                            {item.stars >= 4 && (
                                <div className="flex items-center gap-1 text-[10px] text-green-500">
                                    <Heart size={10} className="fill-green-500" />
                                    <span>Satisfied client</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// ── Enhanced Empty State ───────────────────────────────────────────────────────
function EmptyState({ search, onClearSearch }) {
    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-br from-white to-gray-50 rounded-3xl border-2 border-gray-100 p-14 text-center shadow-xl"
        >
            <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-7xl mb-6"
            >
                {search ? '🔍' : '⭐'}
            </motion.div>
            <p className="font-black text-gray-800 text-2xl mb-2">
                {search ? 'No matching ratings' : 'No ratings yet'}
            </p>
            <p className="text-gray-500 text-sm max-w-sm mx-auto leading-relaxed">
                {search
                    ? "We couldn't find any ratings matching your search. Try different keywords."
                    : "Complete jobs and your clients will be able to rate your work. Your ratings will appear here."}
            </p>
            {search && (
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onClearSearch}
                    className="mt-6 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all"
                >
                    Clear Search
                </motion.button>
            )}
            {!search && feedback.length === 0 && (
                <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
                    <Smile size={14} />
                    <span>Your first rating is just around the corner!</span>
                </div>
            )}
        </motion.div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
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
        { v: 'date-desc',   l: 'Newest first', icon: Calendar },
        { v: 'date-asc',    l: 'Oldest first', icon: Calendar },
        { v: 'stars-desc',  l: 'Highest rating', icon: Star },
        { v: 'stars-asc',   l: 'Lowest rating', icon: Star },
        { v: 'points-desc', l: 'Most points', icon: Award },
    ];

    const avgStars = feedback.length
        ? (feedback.reduce((s, f) => s + (f.stars || 0), 0) / feedback.length).toFixed(1)
        : null;
    
    const totalPoints = feedback.reduce((s, f) => s + (f.points || 0), 0);

    return (
        <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
            {/* Enhanced Header */}
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-orange-500 to-red-500 rounded-3xl p-6 mb-6 text-white shadow-2xl relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
                
                <div className="flex items-start justify-between relative z-10">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Trophy size={24} className="text-yellow-300" />
                            <h1 className="text-3xl font-black">My Ratings</h1>
                        </div>
                        <p className="text-white/90 text-sm">
                            {feedback.length > 0
                                ? `${feedback.length} rating${feedback.length !== 1 ? 's' : ''} from clients · ${avgStars}★ average · +${totalPoints} total points`
                                : 'Ratings from clients after completed jobs'}
                        </p>
                    </div>
                    <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={load} 
                        className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-all backdrop-blur-sm"
                    >
                        <RefreshCw size={18} className="text-white" />
                    </motion.button>
                </div>
            </motion.div>

            {/* Analytics panel (only if data exists) */}
            {!loading && feedback.length > 0 && <AnalyticsPanel feedback={feedback} />}

            {/* Search + Sort */}
            {!loading && feedback.length > 0 && (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3 mb-5"
                >
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by client, job, skill, or feedback..."
                            className="w-full pl-11 pr-4 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200 transition-all"
                        />
                    </div>
                    <div className="relative">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowSort(s => !s)}
                            className="flex items-center gap-2 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-600 hover:border-orange-300 hover:shadow-md transition-all bg-white"
                        >
                            <Filter size={14} />
                            <span className="hidden sm:inline">Sort</span>
                            <ChevronDown size={14} />
                        </motion.button>
                        <AnimatePresence>
                            {showSort && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute right-0 top-full mt-2 bg-white border-2 border-gray-200 rounded-2xl shadow-xl z-20 overflow-hidden min-w-[180px]"
                                >
                                    {SORT_OPTIONS.map(o => {
                                        const Icon = o.icon;
                                        return (
                                            <button
                                                key={o.v}
                                                onClick={() => { setSortBy(o.v); setShowSort(false); }}
                                                className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-all ${
                                                    sortBy === o.v
                                                        ? 'bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 font-semibold border-l-4 border-orange-500'
                                                        : 'text-gray-600 hover:bg-gray-50'
                                                }`}
                                            >
                                                <Icon size={14} className={sortBy === o.v ? 'text-orange-500' : 'text-gray-400'} />
                                                {o.l}
                                            </button>
                                        );
                                    })}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            )}

            {/* Content */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full"
                    />
                    <p className="mt-4 text-gray-500 font-semibold">Loading your ratings...</p>
                </div>
            ) : filtered.length === 0 ? (
                <EmptyState search={search} onClearSearch={() => setSearch('')} />
            ) : (
                <div className="space-y-4">
                    {filtered.length < feedback.length && (
                        <motion.p 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-xs text-gray-500 font-semibold flex items-center gap-2"
                        >
                            <Eye size={10} />
                            Showing {filtered.length} of {feedback.length} ratings
                        </motion.p>
                    )}
                    <AnimatePresence>
                        {filtered.map((item, idx) => (
                            <FeedbackCard key={item._id} item={item} index={idx} />
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};

export default Feedback;