// src/pages/worker/Feedback.jsx
// PREMIUM UI - Modern gradients, animations, glassmorphism, better visual hierarchy

import React, { useState, useEffect, useMemo } from 'react';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { 
    Star, User, Award, TrendingUp, Search, ChevronDown, 
    RefreshCw, Filter, Calendar, MessageCircle, ThumbsUp, 
    BarChart3, Sparkles, Crown, Trophy, Target, 
    Eye, EyeOff, ChevronRight, Heart, Smile, Shield,
    Verified, Clock, Briefcase, MapPin, Diamond, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Star Row Component ──────────────────────────────────────────────────────────
function StarRow({ rating, size = 16, animated = false }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(s => (
                <motion.div
                    key={s}
                    initial={animated ? { scale: 0, rotate: -180 } : false}
                    animate={animated ? { scale: 1, rotate: 0 } : false}
                    transition={{ delay: s * 0.05, type: "spring", stiffness: 200 }}
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

// ── Star Breakdown Bar ────────────────────────────────────────────────────────
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
                        <span className="w-10 text-gray-500 font-semibold text-xs">{count}</span>
                        <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">{pct}%</span>
                    </motion.div>
                );
            })}
        </div>
    );
}

// ── Skill Breakdown Table ─────────────────────────────────────────────────────
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
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center shadow-md">
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
                            <span className="text-gray-500 font-semibold hidden sm:inline">{r.count} rating{r.count !== 1 ? 's' : ''}</span>
                            <div className="flex items-center gap-1.5">
                                <StarRow rating={parseFloat(r.avg)} size={10} />
                                <span className="font-bold text-gray-800 text-xs ml-0.5">{r.avg}</span>
                            </div>
                            <motion.span 
                                whileHover={{ scale: 1.05 }}
                                className="font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent text-xs"
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

// ── Analytics Panel ────────────────────────────────────────────────────────────
function AnalyticsPanel({ feedback }) {
    const avg      = feedback.length
        ? (feedback.reduce((s, f) => s + (f.stars || 0), 0) / feedback.length)
        : 0;
    const points   = feedback.reduce((s, f) => s + (f.points || 0), 0);
    const fiveStarCount = feedback.filter(f => f.stars === 5).length;
    const fourStarCount = feedback.filter(f => f.stars === 4).length;
    const threeStarCount = feedback.filter(f => f.stars === 3).length;

    if (feedback.length === 0) return null;

    return (
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-xl mb-6 relative overflow-hidden"
        >
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-200 to-red-200 rounded-full blur-3xl opacity-20" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-yellow-200 to-orange-200 rounded-full blur-3xl opacity-20" />
            
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-4 relative z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                            <BarChart3 size={16} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white">Performance Analytics</h3>
                            <p className="text-[10px] text-white/80">Your rating breakdown and insights</p>
                        </div>
                    </div>
                    <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center"
                    >
                        <Sparkles size={10} className="text-white" />
                    </motion.div>
                </div>
            </div>

            <div className="p-5">
                {/* Stats Cards - 2x2 Grid */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                    {[
                        { label: 'Total Ratings', value: feedback.length, sub: 'from clients', icon: Star, gradient: 'from-blue-500 to-indigo-500', color: 'text-blue-600' },
                        { label: 'Average Rating', value: avg.toFixed(1), sub: 'out of 5 stars', icon: Trophy, gradient: 'from-yellow-500 to-orange-500', color: 'text-yellow-600' },
                        { label: 'Points Earned', value: `+${points.toLocaleString('en-IN')}`, sub: 'total points', icon: Award, gradient: 'from-orange-500 to-red-500', color: 'text-orange-600' },
                        { label: '5-Star Rate', value: `${Math.round((fiveStarCount / Math.max(feedback.length, 1)) * 100)}%`, sub: 'excellent ratings', icon: Diamond, gradient: 'from-emerald-500 to-teal-500', color: 'text-emerald-600' },
                    ].map(({ label, value, sub, icon: Icon, gradient, color }, idx) => (
                        <motion.div
                            key={label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-white rounded-xl p-3 text-center shadow-sm hover:shadow-md transition-all border border-gray-100"
                        >
                            <div className={`w-9 h-9 rounded-lg bg-gradient-to-r ${gradient} flex items-center justify-center mx-auto mb-2 shadow-md`}>
                                <Icon size={14} className="text-white" />
                            </div>
                            <p className={`text-lg font-black ${color}`}>{value}</p>
                            <p className="text-[10px] font-semibold text-gray-700 mt-0.5">{label}</p>
                            <p className="text-[8px] text-gray-400 mt-0.5 hidden sm:block">{sub}</p>
                        </motion.div>
                    ))}
                </div>

                {/* Star Display */}
                <div className="flex items-center justify-between gap-4 mb-5 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl border border-orange-100">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200 }}
                        className="text-4xl font-black bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent"
                    >
                        {avg.toFixed(1)}
                    </motion.div>
                    <div className="text-center">
                        <StarRow rating={Math.round(avg)} size={14} animated />
                        <p className="text-[10px] text-gray-500 mt-1 font-semibold">{feedback.length} total ratings</p>
                    </div>
                    <div className="flex gap-2">
                        {[5, 4, 3].map((star) => {
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

                {/* Star Breakdown */}
                <StarBreakdown feedback={feedback} />

                {/* Skill Breakdown */}
                <SkillBreakdown feedback={feedback} />
            </div>
        </motion.div>
    );
}

// ── Feedback Card ──────────────────────────────────────────────────────────────
function FeedbackCard({ item, index }) {
    const [expanded, setExpanded] = useState(false);
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -2 }}
            className="bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
        >
            <div className="p-5">
                <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <motion.div 
                        whileHover={{ scale: 1.05 }}
                        className="flex-shrink-0 relative"
                    >
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-orange-100 to-amber-100 border-2 border-orange-200 flex items-center justify-center shadow-md relative">
                            {item.client?.photo
                                ? <img
                                    src={api.getImageUrl(item.client.photo)}
                                    alt={item.client.name}
                                    className="w-full h-full object-cover"
                                    onError={e => { e.target.src = '/admin.png'; }}
                                  />
                                : <User size={18} className="text-orange-400" />
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
                        <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="font-bold text-gray-800 text-base truncate">{item.client?.name || 'Client'}</p>
                                    {item.client?.verificationStatus === 'approved' && (
                                        <Verified size={14} className="text-emerald-500 flex-shrink-0" />
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                    <p className="text-[10px] text-gray-500 flex items-center gap-1">
                                        <Calendar size={10} />
                                        {new Date(item.createdAt).toLocaleDateString('en-IN', {
                                            day: 'numeric', month: 'short', year: 'numeric',
                                        })}
                                    </p>
                                    <span className="text-[9px] text-gray-300 hidden xs:inline">•</span>
                                    <p className="text-[10px] text-gray-500 truncate font-medium hidden xs:inline max-w-[120px]">
                                        {item.jobId?.title || 'Job'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <StarRow rating={item.stars} size={14} animated />
                                <motion.span 
                                    whileHover={{ scale: 1.05 }}
                                    className="text-[10px] font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent px-2 py-0.5 rounded-full border border-orange-200 bg-orange-50"
                                >
                                    +{item.points} pts
                                </motion.span>
                            </div>
                        </div>

                        {/* Skill Badge */}
                        {item.skill && (
                            <motion.span 
                                whileHover={{ scale: 1.05 }}
                                className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm mb-3"
                            >
                                {getSkillIcon(item.skill)} {item.skill}
                            </motion.span>
                        )}

                        {/* Feedback Message */}
                        {item.message?.trim() ? (
                            <div className="mt-2">
                                <div className={`relative ${!expanded && item.message.length > 120 ? 'max-h-16 overflow-hidden' : ''}`}>
                                    <p className={`text-sm text-gray-600 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
                                        "{item.message}"
                                    </p>
                                    {!expanded && item.message.length > 120 && (
                                        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent" />
                                    )}
                                </div>
                                {item.message.length > 120 && (
                                    <button
                                        onClick={() => setExpanded(!expanded)}
                                        className="text-[10px] font-semibold text-orange-500 hover:text-orange-600 mt-1 flex items-center gap-0.5"
                                    >
                                        {expanded ? 'Show less' : 'Read more'}
                                        <ChevronRight size={10} className={`transform transition-transform ${expanded ? 'rotate-90' : ''}`} />
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                                <MessageCircle size={12} />
                                <span className="italic">No written feedback provided</span>
                            </div>
                        )}

                        {/* Work Photos */}
                        {(Array.isArray(item.workPhotos) && item.workPhotos.length > 0) && (
                            <div className="mt-3">
                                <p className="text-[10px] text-gray-500 mb-2 font-semibold">📸 Work Photos</p>
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                    {item.workPhotos.map((p, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => window.open(api.getImageUrl(p), '_blank')}
                                            className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 hover:shadow-md transition-all"
                                        >
                                            <img
                                                src={api.getImageUrl(p)}
                                                alt={`work-${i}`}
                                                className="w-full h-full object-cover"
                                                onError={(e) => { e.target.onerror = null; e.target.src = '/admin.png'; }}
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center gap-3 mt-3 pt-2 border-t border-gray-100">
                            <div className="flex items-center gap-1 text-[9px] text-gray-400">
                                <ThumbsUp size={10} />
                                <span>Helpful review</span>
                            </div>
                            {item.stars >= 4 && (
                                <div className="flex items-center gap-1 text-[9px] text-emerald-500">
                                    <Heart size={10} className="fill-emerald-500" />
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

// ── Empty State ────────────────────────────────────────────────────────────────
function EmptyState({ search, onClearSearch }) {
    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center"
        >
            <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-6xl mb-4"
            >
                {search ? '🔍' : '⭐'}
            </motion.div>
            <p className="font-bold text-gray-800 text-xl mb-2">
                {search ? 'No matching ratings' : 'No ratings yet'}
            </p>
            <p className="text-gray-400 text-sm max-w-sm mx-auto leading-relaxed">
                {search
                    ? "We couldn't find any ratings matching your search. Try different keywords."
                    : "Complete jobs and your clients will be able to rate your work. Your ratings will appear here."}
            </p>
            {search && (
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={onClearSearch}
                    className="mt-5 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all"
                >
                    Clear Search
                </motion.button>
            )}
        </motion.div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
const Feedback = () => {
    const [feedback,  setFeedback]  = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [search,    setSearch]    = useState('');
    const [sortBy,    setSortBy]    = useState('date-desc');
    const [showSort,  setShowSort]  = useState(false);
    const [refreshing, setRefreshing] = useState(false);

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

    const handleRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
        toast.success('Ratings refreshed!');
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
        <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 pb-16">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-5 pb-8">
                
                {/* Hero Header */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    data-guide-id="worker-page-feedback"
                    className="mb-6"
                >
                    <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-xl">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                    <Trophy size="24" className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black">My Ratings</h1>
                                    <p className="text-white/90 text-sm mt-0.5">
                                        {feedback.length > 0
                                            ? `${feedback.length} rating${feedback.length !== 1 ? 's' : ''} · ${avgStars}★ average · +${totalPoints} points`
                                            : 'Ratings from clients after completed jobs'}
                                    </p>
                                </div>
                            </div>
                            <motion.button 
                                whileTap={{ scale: 0.95 }}
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-xl text-sm font-semibold hover:bg-white/30 transition-all"
                            >
                                <RefreshCw size="14" className={refreshing ? 'animate-spin' : ''} />
                                Refresh
                            </motion.button>
                        </div>
                    </div>
                </motion.div>

                {/* Analytics Panel */}
                {!loading && feedback.length > 0 && <AnalyticsPanel feedback={feedback} />}

                {/* Search + Sort */}
                {!loading && feedback.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-3 mb-5"
                    >
                        <div className="relative flex-1">
                            <Search size="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search by client, job, skill..."
                                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 bg-white transition-all"
                            />
                        </div>
                        <div className="relative">
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setShowSort(s => !s)}
                                className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:border-orange-300 hover:shadow-md transition-all bg-white"
                            >
                                <Filter size="14" />
                                <span className="hidden sm:inline">Sort</span>
                                <ChevronDown size="14" />
                            </motion.button>
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
                                            return (
                                                <button
                                                    key={o.v}
                                                    onClick={() => { setSortBy(o.v); setShowSort(false); }}
                                                    className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs transition-all ${
                                                        sortBy === o.v
                                                            ? 'bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 font-semibold border-l-2 border-orange-500'
                                                            : 'text-gray-600 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <Icon size="12" />
                                                    <span className="whitespace-nowrap">{o.l}</span>
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
                        <Loader2 size="48" className="animate-spin text-orange-500 mx-auto mb-4" />
                        <p className="text-gray-500 font-medium">Loading your ratings...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <EmptyState search={search} onClearSearch={() => setSearch('')} />
                ) : (
                    <div className="space-y-4">
                        {filtered.length < feedback.length && (
                            <motion.p 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-xs text-gray-500 font-semibold flex items-center gap-1.5"
                            >
                                <Eye size="12" />
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
        </div>
    );
};

// Helper component for Loader
const Loader2 = ({ size, className }) => (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);

export default Feedback;