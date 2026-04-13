// src/pages/worker/WorkerProposals.jsx
// ENHANCED UI VERSION - Mobile Optimized
// Modern gradients, animations, better visual hierarchy, micro-interactions

import React, { useEffect, useState } from 'react';
import { getWorkerBookings, respondToGroupJob } from '../../api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Briefcase, MapPin, Calendar, Clock, IndianRupee, Users,
    CheckCircle, XCircle, AlertCircle, ChevronRight, RefreshCw,
    Sparkles, TrendingUp, Award, Zap, Gift, Star, 
    MessageCircle, Heart, Shield, Truck, Building
} from 'lucide-react';

export default function WorkerProposals() {
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [responding, setResponding] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [filter, setFilter] = useState('all'); // 'all', 'today', 'week'

    const fetchProposals = async () => {
        try {
            setLoading(true);
            const { data } = await getWorkerBookings();
            const pending = (data || []).filter((j) => j.status === 'proposal');
            setProposals(pending);
        } catch {
            toast.error('Failed to load proposals');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProposals(); }, []);

    const handleRespond = async (jobId, status) => {
        setResponding(jobId + status);
        try {
            await respondToGroupJob({ jobId, status });
            toast.success(status === 'accepted' ? '✅ Job accepted successfully!' : 'Job declined');
            fetchProposals();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to respond');
        } finally {
            setResponding(null);
        }
    };

    const getFilteredProposals = () => {
        if (filter === 'today') {
            const today = new Date().toDateString();
            return proposals.filter(p => new Date(p.createdAt).toDateString() === today);
        }
        if (filter === 'week') {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return proposals.filter(p => new Date(p.createdAt) >= weekAgo);
        }
        return proposals;
    };

    const filteredProposals = getFilteredProposals();
    const totalPayment = filteredProposals.reduce((sum, p) => sum + (p.payment || 0), 0);

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-10 h-10 md:w-12 md:h-12 border-3 md:border-4 border-orange-500 border-t-transparent rounded-full"
            />
            <p className="mt-3 md:mt-4 text-gray-500 font-semibold text-sm md:text-base">Loading proposals...</p>
            <p className="text-xs text-gray-400 mt-1">Checking for new group job opportunities</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white pb-20">
            <div className="max-w-2xl mx-auto px-4 pt-4 md:pt-6 pb-16">
                {/* Enhanced Header */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl md:rounded-3xl p-4 md:p-6 mb-5 md:mb-6 text-white shadow-2xl relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 md:w-32 md:h-32 bg-white/10 rounded-full blur-2xl" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 md:w-32 md:h-32 bg-white/10 rounded-full blur-2xl" />
                    
                    <div className="flex items-center gap-2 md:gap-3 relative z-10">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-white/20 rounded-xl md:rounded-2xl flex items-center justify-center backdrop-blur-sm">
                            <Briefcase size={20} className="md:size-6 text-white" />
                        </div>
                        <div className="flex-1">
                            <h1 className="text-xl md:text-2xl font-black">Group Job Proposals</h1>
                            <p className="text-white/80 text-[10px] md:text-xs mt-0.5 md:mt-1">
                                {proposals.length} pending proposal{proposals.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={fetchProposals}
                            className="p-2 md:p-2.5 rounded-xl bg-white/20 hover:bg-white/30 transition-all touch-manipulation"
                        >
                            <RefreshCw size={16} className="md:size-4 text-white" />
                        </motion.button>
                    </div>
                </motion.div>

                {/* Stats Cards */}
                {proposals.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="grid grid-cols-2 gap-2 md:gap-3 mb-4 md:mb-6"
                    >
                        <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl md:rounded-2xl p-3 md:p-4 border border-emerald-100">
                            <div className="flex items-center justify-between mb-1">
                                <IndianRupee size={16} className="md:size-5 text-emerald-600" />
                                <Sparkles size={12} className="md:size-4 text-emerald-400" />
                            </div>
                            <p className="text-xl md:text-2xl font-black text-emerald-600">
                                ₹{totalPayment.toLocaleString('en-IN')}
                            </p>
                            <p className="text-[9px] md:text-xs text-gray-500 font-medium">Total Value</p>
                        </div>
                        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl md:rounded-2xl p-3 md:p-4 border border-orange-100">
                            <div className="flex items-center justify-between mb-1">
                                <Users size={16} className="md:size-5 text-orange-600" />
                                <TrendingUp size={12} className="md:size-4 text-orange-400" />
                            </div>
                            <p className="text-xl md:text-2xl font-black text-orange-600">{filteredProposals.length}</p>
                            <p className="text-[9px] md:text-xs text-gray-500 font-medium">Active Proposals</p>
                        </div>
                    </motion.div>
                )}

                {/* Filter Tabs - Horizontal Scroll */}
                {proposals.length > 0 && (
                    <div className="overflow-x-auto no-scrollbar -mx-4 px-4 mb-4 md:mb-6">
                        <div className="flex items-center gap-1.5 md:gap-2 min-w-max pb-1">
                            {[
                                { key: 'all', label: 'All', icon: Briefcase, count: proposals.length },
                                { key: 'today', label: 'Today', icon: Clock, count: proposals.filter(p => new Date(p.createdAt).toDateString() === new Date().toDateString()).length },
                                { key: 'week', label: 'This Week', icon: Calendar, count: proposals.filter(p => {
                                    const weekAgo = new Date();
                                    weekAgo.setDate(weekAgo.getDate() - 7);
                                    return new Date(p.createdAt) >= weekAgo;
                                }).length },
                            ].map(f => {
                                const Icon = f.icon;
                                const active = filter === f.key;
                                return (
                                    <motion.button
                                        key={f.key}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setFilter(f.key)}
                                        className={`flex-shrink-0 flex items-center gap-1 md:gap-2 px-2.5 md:px-4 py-1.5 md:py-2 rounded-full text-[10px] md:text-xs font-bold border-2 transition-all ${
                                            active 
                                                ? 'border-orange-500 bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md' 
                                                : 'border-gray-200 bg-white text-gray-600 hover:border-orange-300'
                                        }`}
                                    >
                                        <Icon size={10} className="md:size-3" />
                                        {f.label}
                                        {f.count > 0 && (
                                            <span className={`ml-0.5 ${active ? 'text-white/80' : 'text-gray-400'}`}>
                                                ({f.count})
                                            </span>
                                        )}
                                    </motion.button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Main Content */}
                {proposals.length === 0 ? (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-2xl md:rounded-3xl border-2 border-gray-100 p-6 md:p-10 text-center shadow-lg"
                    >
                        <motion.div
                            animate={{ y: [0, -8, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="text-5xl md:text-6xl mb-3 md:mb-4"
                        >
                            📨
                        </motion.div>
                        <p className="font-bold text-gray-800 text-lg md:text-xl mb-1">No Pending Proposals</p>
                        <p className="text-gray-500 text-xs md:text-sm max-w-sm mx-auto leading-relaxed">
                            When a client sends a job proposal to your group, it will appear here. 
                            Check back later for new opportunities!
                        </p>
                        <div className="mt-4 md:mt-5 flex items-center justify-center gap-2 text-[10px] md:text-xs text-gray-400">
                            <Shield size={10} className="md:size-3" />
                            <span>Proposals are sent by verified clients only</span>
                        </div>
                    </motion.div>
                ) : filteredProposals.length === 0 ? (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-white rounded-2xl border-2 border-gray-100 p-6 md:p-8 text-center shadow-lg"
                    >
                        <div className="text-4xl md:text-5xl mb-2 md:mb-3">🔍</div>
                        <p className="font-bold text-gray-700 text-sm md:text-base">No proposals for this period</p>
                        <button
                            onClick={() => setFilter('all')}
                            className="mt-3 md:mt-4 text-orange-500 text-xs md:text-sm font-semibold hover:text-orange-600 transition-colors"
                        >
                            View all proposals →
                        </button>
                    </motion.div>
                ) : (
                    <div className="space-y-3 md:space-y-4">
                        <AnimatePresence>
                            {filteredProposals.map((job, index) => {
                                const isExpanded = expandedId === job._id;
                                
                                return (
                                    <motion.div
                                        key={job._id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="bg-white rounded-xl md:rounded-2xl border-2 border-gray-100 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
                                    >
                                        <div className="p-3 md:p-5">
                                            {/* Header */}
                                            <div className="flex items-start justify-between gap-2 mb-2 md:mb-3">
                                                <div className="flex-1 min-w-0">
                                                    <h2 className="font-bold text-gray-800 text-sm md:text-base truncate">
                                                        {job.title}
                                                    </h2>
                                                    <div className="flex items-center gap-1 mt-0.5">
                                                        <Users size={10} className="md:size-3 text-gray-400" />
                                                        <p className="text-[9px] md:text-xs text-gray-500 truncate">
                                                            {job.postedBy?.name || 'Client'} • Group Proposal
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="flex-shrink-0 px-2 md:px-3 py-1 rounded-full text-[9px] md:text-xs font-semibold bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-sm">
                                                    ⏳ Pending
                                                </span>
                                            </div>

                                            {/* Description - Expandable */}
                                            {job.description && (
                                                <div className="mb-2 md:mb-3">
                                                    <div className={`relative ${!isExpanded && job.description.length > 100 ? 'max-h-12 overflow-hidden' : ''}`}>
                                                        <p className="text-gray-600 text-[11px] md:text-sm leading-relaxed">
                                                            {job.description}
                                                        </p>
                                                        {!isExpanded && job.description.length > 100 && (
                                                            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent" />
                                                        )}
                                                    </div>
                                                    {job.description.length > 100 && (
                                                        <button
                                                            onClick={() => setExpandedId(isExpanded ? null : job._id)}
                                                            className="text-[9px] md:text-xs font-semibold text-orange-500 mt-1 flex items-center gap-0.5 touch-manipulation"
                                                        >
                                                            {isExpanded ? 'Show less' : 'Read more'}
                                                            <ChevronRight size={10} className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {/* Tags */}
                                            <div className="flex flex-wrap gap-1.5 md:gap-2 mb-3 md:mb-4">
                                                {job.payment > 0 && (
                                                    <span className="inline-flex items-center gap-0.5 md:gap-1 bg-green-50 text-green-700 px-2 md:px-3 py-0.5 md:py-1 rounded-lg text-[9px] md:text-xs font-semibold">
                                                        <IndianRupee size={10} className="md:size-3" />
                                                        ₹{job.payment.toLocaleString('en-IN')}
                                                    </span>
                                                )}
                                                {job.duration && (
                                                    <span className="inline-flex items-center gap-0.5 md:gap-1 bg-blue-50 text-blue-700 px-2 md:px-3 py-0.5 md:py-1 rounded-lg text-[9px] md:text-xs font-semibold">
                                                        <Clock size={10} className="md:size-3" />
                                                        {job.duration}
                                                    </span>
                                                )}
                                                {job.location?.city && (
                                                    <span className="inline-flex items-center gap-0.5 md:gap-1 bg-orange-50 text-orange-700 px-2 md:px-3 py-0.5 md:py-1 rounded-lg text-[9px] md:text-xs font-semibold">
                                                        <MapPin size={10} className="md:size-3" />
                                                        {job.location.city}{job.location.locality ? `, ${job.location.locality}` : ''}
                                                    </span>
                                                )}
                                                {job.skills?.length > 0 && (
                                                    <span className="inline-flex items-center gap-0.5 md:gap-1 bg-purple-50 text-purple-700 px-2 md:px-3 py-0.5 md:py-1 rounded-lg text-[9px] md:text-xs font-semibold">
                                                        <Zap size={10} className="md:size-3" />
                                                        {job.skills[0]}{job.skills.length > 1 ? ` +${job.skills.length - 1}` : ''}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex gap-2 md:gap-3">
                                                <motion.button
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => handleRespond(job._id, 'accepted')}
                                                    disabled={!!responding}
                                                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-2 md:py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all hover:shadow-lg disabled:opacity-50 touch-manipulation"
                                                >
                                                    {responding === job._id + 'accepted' ? (
                                                        <div className="flex items-center justify-center gap-1">
                                                            <div className="w-3 h-3 md:w-4 md:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                            <span>Processing...</span>
                                                        </div>
                                                    ) : (
                                                        <span className="flex items-center justify-center gap-1">
                                                            <CheckCircle size={14} className="md:size-4" />
                                                            Accept Job
                                                        </span>
                                                    )}
                                                </motion.button>
                                                <motion.button
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => handleRespond(job._id, 'rejected')}
                                                    disabled={!!responding}
                                                    className="flex-1 bg-red-50 text-red-600 py-2 md:py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all hover:bg-red-100 disabled:opacity-50 touch-manipulation"
                                                >
                                                    {responding === job._id + 'rejected' ? (
                                                        <div className="flex items-center justify-center gap-1">
                                                            <div className="w-3 h-3 md:w-4 md:h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                                            <span>Processing...</span>
                                                        </div>
                                                    ) : (
                                                        <span className="flex items-center justify-center gap-1">
                                                            <XCircle size={14} className="md:size-4" />
                                                            Decline
                                                        </span>
                                                    )}
                                                </motion.button>
                                            </div>

                                            {/* Timestamp */}
                                            <p className="text-[8px] md:text-[9px] text-gray-400 mt-2 text-right">
                                                Proposed {new Date(job.createdAt).toLocaleDateString('en-IN', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}

                {/* Motivational Banner */}
                {proposals.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-5 md:mt-6 p-3 md:p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl md:rounded-2xl border border-orange-200 text-center"
                    >
                        <div className="flex items-center justify-center gap-1.5 md:gap-2 mb-1">
                            <Sparkles size={12} className="md:size-4 text-orange-500" />
                            <p className="text-[10px] md:text-xs font-semibold text-gray-700">Quick Response Recommended</p>
                            <Sparkles size={12} className="md:size-4 text-orange-500" />
                        </div>
                        <p className="text-[8px] md:text-[10px] text-gray-600">
                            Responding quickly increases your chances of getting the job. Clients prefer groups that are responsive and reliable.
                        </p>
                    </motion.div>
                )}

                {/* Pro Tip */}
                {proposals.length === 0 && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-4 text-center p-3 bg-gray-50 rounded-xl"
                    >
                        <div className="flex items-center justify-center gap-1 text-gray-500">
                            <Heart size={12} className="fill-orange-200" />
                            <p className="text-[9px] md:text-[10px]">Complete more jobs to receive more proposals!</p>
                            <Heart size={12} className="fill-orange-200" />
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}