// src/pages/client/ClientComplaints.jsx
// ENHANCED UI VERSION - Mobile Optimized
// Modern gradients, animations, better visual hierarchy, micro-interactions

import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../../api';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle, Search, ChevronRight, X, CheckCircle,
    Clock, ShieldAlert, User, Phone, Briefcase, Star,
    FileText, Send, Loader2, MapPin, AlertCircle, RefreshCw,
    MessageSquare, Flag, Award, Shield, Calendar, ThumbsUp,
    ExternalLink, Eye, Filter, Zap, Sparkles, Crown, ArrowRight
} from 'lucide-react';

// ── Status badge helper (Enhanced & Mobile Optimized) ────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const map = {
        submitted:    { cls: 'bg-gradient-to-r from-yellow-50 to-amber-50 text-yellow-700 border-yellow-200', icon: Clock, label: 'Submitted' },
        'in-review':  { cls: 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-blue-200', icon: Shield, label: 'In Review' },
        'action-taken':{ cls: 'bg-gradient-to-r from-orange-50 to-red-50 text-orange-700 border-orange-200', icon: Flag, label: 'Action Taken' },
        resolved:     { cls: 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-emerald-200', icon: CheckCircle, label: 'Resolved' },
        dismissed:    { cls: 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-600 border-gray-200', icon: X, label: 'Dismissed' },
    };
    const { cls, icon: Icon, label } = map[status] || map.submitted;
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] md:text-xs font-bold px-2 md:px-3 py-1 md:py-1.5 rounded-full border ${cls}`}>
            <Icon size={10} className="md:size-3" />
            <span className="hidden xs:inline">{label}</span>
        </span>
    );
};

// ── Category options with icons ──────────────────────────────────────────────
const CATEGORIES = [
    { label: 'Poor Quality Work', icon: Star, color: 'orange' },
    { label: 'Unprofessional Behavior', icon: AlertTriangle, color: 'red' },
    { label: 'Did Not Show Up', icon: Clock, color: 'amber' },
    { label: 'Damaged Property', icon: AlertCircle, color: 'red' },
    { label: 'Overcharged / Fraud', icon: AlertTriangle, color: 'orange' },
    { label: 'Harassment', icon: ShieldAlert, color: 'red' },
    { label: 'Other', icon: FileText, color: 'gray' },
];

// ── Enhanced Worker Preview Card (Mobile Optimized) ──────────────────────────────────────────────
const WorkerCard = ({ worker, onSelect, selected }) => {
    const skills = Array.isArray(worker.skills)
        ? worker.skills.map(s => (typeof s === 'object' ? s.name : s)).slice(0, 2)
        : [];
    const hasMoreSkills = (worker.skills?.length || 0) > 2;

    return (
        <motion.div
            whileTap={{ scale: 0.98 }}
            onClick={onSelect}
            className={`flex items-start gap-2 md:gap-4 p-3 md:p-5 rounded-xl md:rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
                selected
                    ? 'border-orange-500 bg-gradient-to-r from-orange-50 to-amber-50 shadow-xl shadow-orange-100'
                    : 'border-gray-100 bg-white hover:border-orange-200 hover:shadow-md'
            }`}
        >
            <div className="relative flex-shrink-0">
                <img
                    src={worker.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.name)}&background=f97316&color=fff&bold=true`}
                    alt={worker.name}
                    className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl object-cover border-2 md:border-3 border-orange-100 shadow-md"
                    onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.name)}&background=f97316&color=fff&bold=true`; }}
                />
                <div className={`absolute -bottom-1 -right-1 w-3 h-3 md:w-4 md:h-4 rounded-full border-2 border-white ${
                    worker.verificationStatus === 'approved' ? 'bg-green-500' : 'bg-gray-400'
                }`} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 flex-wrap">
                    <p className="font-bold text-gray-900 text-sm md:text-base truncate">{worker.name}</p>
                    {worker.avgStars > 0 && (
                        <span className="flex items-center gap-0.5 text-[9px] md:text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                            <Star size={8} className="md:size-3 fill-yellow-500" />
                            {worker.avgStars.toFixed(1)}
                        </span>
                    )}
                </div>
                <p className="text-[9px] md:text-xs text-orange-600 font-mono font-bold mb-0.5 truncate">{worker.karigarId}</p>
                {skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                        {skills.map((skill, i) => (
                            <span key={i} className="text-[8px] md:text-[10px] bg-gray-100 text-gray-600 px-1.5 md:px-2 py-0.5 rounded-full font-medium">
                                {skill}
                            </span>
                        ))}
                        {hasMoreSkills && (
                            <span className="text-[8px] md:text-[10px] text-gray-400">+{worker.skills.length - 2}</span>
                        )}
                    </div>
                )}
            </div>

            <div className="flex flex-col items-end gap-1 md:gap-2 flex-shrink-0">
                <div className="flex items-center gap-0.5 md:gap-1 text-[9px] md:text-xs text-gray-500 bg-gray-50 px-1.5 md:px-2.5 py-0.5 md:py-1 rounded-full">
                    <Phone size={8} className="md:size-2.5" />
                    <span className="font-medium hidden xs:inline">{worker.mobile}</span>
                </div>
                <span className={`text-[8px] md:text-[10px] font-bold px-1.5 md:px-2 py-0.5 rounded-full ${
                    worker.verificationStatus === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                }`}>
                    {worker.completedJobs || 0} jobs
                </span>
                {selected && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-4 h-4 md:w-5 md:h-5 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center shadow-md"
                    >
                        <CheckCircle size={10} className="md:size-3 text-white" />
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
};

// ── Enhanced Success Popup (Mobile Optimized) ────────────────────────────────────────────────────
const SuccessPopup = ({ onClose }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
        onClick={onClose}
    >
        <motion.div
            initial={{ scale: 0.9, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 50, opacity: 0 }}
            className="bg-white rounded-2xl md:rounded-3xl shadow-2xl max-w-sm w-full p-5 md:p-8 text-center mx-4"
            onClick={e => e.stopPropagation()}
        >
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4 shadow-xl shadow-green-200"
            >
                <CheckCircle size={32} className="md:size-10 text-white" />
            </motion.div>
            <h3 className="text-lg md:text-2xl font-black text-gray-900 mb-1 md:mb-2">Complaint Submitted!</h3>
            <p className="text-gray-500 text-xs md:text-sm leading-relaxed mb-3 md:mb-4">
                We have received your complaint and will review it carefully.
            </p>
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl md:rounded-2xl p-2 md:p-3 mb-3 md:mb-4 border border-orange-200">
                <p className="text-[10px] md:text-xs text-orange-700 font-semibold flex items-center justify-center gap-1 md:gap-2">
                    <Clock size={10} className="md:size-3" />
                    Action will be taken within 24 hours
                </p>
            </div>
            <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-2 md:py-3 rounded-xl md:rounded-2xl font-bold text-xs md:text-sm shadow-lg hover:shadow-orange-300 transition-all"
            >
                Got It, Thanks!
            </motion.button>
        </motion.div>
    </motion.div>
);

// ── Enhanced Complaint Card for History (Mobile Optimized) ───────────────────────────────────────
const ComplaintCard = ({ complaint, index }) => {
    const [expanded, setExpanded] = useState(false);
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileTap={{ scale: 0.98 }}
            className="bg-white rounded-xl md:rounded-2xl border border-gray-100 shadow-md hover:shadow-xl transition-all overflow-hidden"
        >
            {/* Header */}
            <div className="p-3 md:p-5 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-start justify-between gap-2 md:gap-3">
                    <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                        <div className="relative flex-shrink-0">
                            <img
                                src={complaint.againstWorker?.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(complaint.againstWorker?.name || 'W')}&background=f97316&color=fff&bold=true`}
                                alt={complaint.againstWorker?.name}
                                className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl object-cover border-2 border-orange-100 shadow-sm"
                                onError={e => { e.target.src = `https://ui-avatars.com/api/?name=W&background=f97316&color=fff&bold=true`; }}
                            />
                            <div className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full border-2 border-white ${
                                complaint.againstWorker?.verificationStatus === 'approved' ? 'bg-green-500' : 'bg-gray-400'
                            }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 text-xs md:text-sm truncate">{complaint.againstWorker?.name || 'Unknown Worker'}</p>
                            <p className="text-[9px] md:text-xs text-orange-600 font-mono truncate">{complaint.againstWorker?.karigarId}</p>
                            <p className="text-[8px] md:text-[10px] text-gray-400 mt-0.5 flex items-center gap-0.5">
                                <Calendar size={7} className="md:size-2.5" />
                                {new Date(complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                        </div>
                    </div>
                    <StatusBadge status={complaint.status} />
                    <div className="flex-shrink-0 text-gray-400">
                        <ChevronRight size={12} className={`md:size-4 transform transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    </div>
                </div>

                {/* Category Badge */}
                <div className="mt-2 md:mt-3">
                    <span className="inline-flex items-center gap-1 text-[9px] md:text-xs font-bold px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 border border-orange-200">
                        <Flag size={8} className="md:size-2.5" />
                        {complaint.category}
                    </span>
                </div>

                {/* Preview of description */}
                <p className="text-[11px] md:text-sm text-gray-600 mt-2 md:mt-3 line-clamp-2 leading-relaxed">
                    {complaint.description}
                </p>
            </div>

            {/* Expanded Content */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-gray-100"
                    >
                        <div className="p-3 md:p-5 space-y-3 md:space-y-4">
                            {/* Full Description */}
                            <div className="bg-gradient-to-r from-gray-50 to-white rounded-xl md:rounded-2xl p-3 md:p-4">
                                <p className="text-[9px] md:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 md:mb-2">Full Description</p>
                                <p className="text-[11px] md:text-sm text-gray-700 leading-relaxed">{complaint.description}</p>
                            </div>

                            {/* Admin Notes */}
                            {complaint.adminNotes && (
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl md:rounded-2xl p-3 md:p-4 border border-blue-200">
                                    <div className="flex items-center gap-1.5 md:gap-2 mb-1 md:mb-2">
                                        <Shield size={12} className="md:size-3.5 text-blue-600" />
                                        <p className="text-[9px] md:text-xs font-bold text-blue-700 uppercase tracking-wider">Admin Response</p>
                                    </div>
                                    <p className="text-[11px] md:text-sm text-blue-800 leading-relaxed">{complaint.adminNotes}</p>
                                </div>
                            )}

                            {/* Admin Action */}
                            {complaint.adminAction && (
                                <div className={`rounded-xl md:rounded-2xl p-2 md:p-3 flex items-center gap-2 md:gap-3 ${
                                    complaint.adminAction === 'blocked' ? 'bg-red-50 border border-red-200' :
                                    complaint.adminAction === 'warned' ? 'bg-yellow-50 border border-yellow-200' :
                                    complaint.adminAction === 'cleared' ? 'bg-green-50 border border-green-200' :
                                    'bg-gray-50 border border-gray-200'
                                }`}>
                                    <div className={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center ${
                                        complaint.adminAction === 'blocked' ? 'bg-red-100' :
                                        complaint.adminAction === 'warned' ? 'bg-yellow-100' :
                                        complaint.adminAction === 'cleared' ? 'bg-green-100' :
                                        'bg-gray-100'
                                    }`}>
                                        {complaint.adminAction === 'blocked' && <X size={10} className="md:size-3 text-red-500" />}
                                        {complaint.adminAction === 'warned' && <AlertTriangle size={10} className="md:size-3 text-yellow-500" />}
                                        {complaint.adminAction === 'cleared' && <CheckCircle size={10} className="md:size-3 text-green-500" />}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[9px] md:text-xs font-bold text-gray-700 uppercase">Action Taken</p>
                                        <p className={`text-[10px] md:text-sm font-semibold capitalize ${
                                            complaint.adminAction === 'blocked' ? 'text-red-600' :
                                            complaint.adminAction === 'warned' ? 'text-yellow-600' :
                                            complaint.adminAction === 'cleared' ? 'text-green-600' :
                                            'text-gray-600'
                                        }`}>
                                            {complaint.adminAction}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Footer Info */}
                            <div className="flex items-center justify-between pt-1 md:pt-2 border-t border-gray-100">
                                <div className="flex items-center gap-1.5 md:gap-2 text-[8px] md:text-[10px] text-gray-400">
                                    <FileText size={8} className="md:size-2.5" />
                                    <span>ID: {complaint._id.slice(-6)}</span>
                                </div>
                                {complaint.resolvedAt && (
                                    <span className="text-[8px] md:text-[10px] text-green-600 flex items-center gap-0.5">
                                        <CheckCircle size={8} className="md:size-2.5" />
                                        Resolved
                                    </span>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// ── Main Page (Mobile Optimized) ────────────────────────────────────────────────────────────────
export default function ClientComplaints() {
    // Search state
    const [searchQuery, setSearchQuery]     = useState('');
    const [searchResult, setSearchResult]   = useState(null);
    const [searchError, setSearchError]     = useState('');
    const [searching, setSearching]         = useState(false);
    const [selectedWorker, setSelectedWorker] = useState(null);

    // Form state
    const [category, setCategory]     = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError]   = useState('');

    // Popups
    const [showSuccess, setShowSuccess] = useState(false);

    // Past complaints
    const [complaints, setComplaints]   = useState([]);
    const [loadingPast, setLoadingPast] = useState(true);
    const [activeTab, setActiveTab]     = useState('new');

    // Fetch past complaints
    const fetchComplaints = useCallback(async () => {
        setLoadingPast(true);
        try {
            const { data } = await api.getClientComplaints();
            setComplaints(data.complaints || []);
        } catch { /* silent */ } finally { setLoadingPast(false); }
    }, []);

    useEffect(() => { fetchComplaints(); }, [fetchComplaints]);

    // Search handler
    const handleSearch = async () => {
        if (!searchQuery.trim() || searchQuery.trim().length < 3) {
            setSearchError('Please enter at least 3 characters.');
            return;
        }
        setSearching(true);
        setSearchError('');
        setSearchResult(null);
        setSelectedWorker(null);

        try {
            const { data } = await api.searchWorkerForComplaint(searchQuery.trim());
            setSearchResult(data.worker);
        } catch (err) {
            setSearchError(err.response?.data?.message || 'Worker not found.');
        } finally {
            setSearching(false);
        }
    };

    // Submit complaint
    const handleSubmit = async () => {
        if (!selectedWorker) { setFormError('Please select a worker first.'); return; }
        if (!category)       { setFormError('Please choose a complaint category.'); return; }
        if (description.trim().length < 20) { setFormError('Please write at least 20 characters describing the issue.'); return; }

        setSubmitting(true);
        setFormError('');
        try {
            await api.fileClientComplaint({
                workerId:    selectedWorker._id,
                category,
                description: description.trim(),
            });
            setSearchQuery('');
            setSearchResult(null);
            setSelectedWorker(null);
            setCategory('');
            setDescription('');
            setShowSuccess(true);
            fetchComplaints();
        } catch (err) {
            setFormError(err.response?.data?.message || 'Failed to submit complaint. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/20 pb-20">
            <AnimatePresence>
                {showSuccess && <SuccessPopup onClose={() => setShowSuccess(false)} />}
            </AnimatePresence>

            <div className="max-w-3xl mx-auto px-4 pt-4 md:pt-6">
                {/* Enhanced Page Header - Mobile Optimized */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl md:rounded-3xl p-4 md:p-6 mb-5 md:mb-8 text-white shadow-xl relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 md:w-40 md:h-40 bg-white/10 rounded-full blur-2xl" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 md:w-40 md:h-40 bg-white/10 rounded-full blur-2xl" />
                    
                    <div className="flex items-center gap-2 md:gap-3 relative z-10">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-white/20 rounded-xl md:rounded-2xl flex items-center justify-center backdrop-blur-sm">
                            <AlertTriangle size={18} className="md:size-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-3xl font-black" data-guide-id="client-page-complaints">File a Complaint</h1>
                            <p className="text-white/90 text-[10px] md:text-sm mt-0.5">Report issues with workers you have hired</p>
                        </div>
                    </div>
                </motion.div>

                {/* Enhanced Tabs - Mobile Optimized */}
                <div className="flex bg-gray-100 rounded-xl md:rounded-2xl p-1 mb-5 md:mb-8 gap-1">
                    {[
                        { id: 'new', label: 'New Complaint', icon: MessageSquare },
                        { id: 'history', label: complaints.length ? `My (${complaints.length})` : 'My Complaints', icon: FileText },
                    ].map(({ id, label, icon: Icon }) => (
                        <motion.button
                            key={id}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setActiveTab(id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 md:gap-2 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[11px] md:text-sm font-bold transition-all ${
                                activeTab === id
                                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Icon size={12} className="md:size-3.5" />
                            <span className="text-[10px] md:text-sm">{label}</span>
                        </motion.button>
                    ))}
                </div>

                {/* ── NEW COMPLAINT TAB (Mobile Optimized) ── */}
                {activeTab === 'new' && (
                    <div className="space-y-4 md:space-y-6">
                        {/* Step 1: Search Worker */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-2xl md:rounded-3xl border-2 border-orange-100 shadow-xl p-4 md:p-6"
                        >
                            <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-5">
                                <div className="w-6 h-6 md:w-7 md:h-7 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg md:rounded-xl flex items-center justify-center text-[10px] md:text-xs font-black shadow-md">
                                    1
                                </div>
                                <h2 className="font-bold text-gray-800 text-sm md:text-lg">Find the Worker</h2>
                            </div>

                            <p className="text-[11px] md:text-sm text-gray-500 mb-3 md:mb-4">
                                Enter the worker's <strong className="text-orange-600">Karigar ID</strong> or <strong className="text-orange-600">mobile number</strong>
                            </p>

                            <div className="flex gap-2 md:gap-3">
                                <div className="flex-1 relative">
                                    <Search size={12} className="md:size-4 absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => { setSearchQuery(e.target.value); setSearchError(''); }}
                                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                        placeholder="Karigar ID or mobile..."
                                        className="w-full pl-8 md:pl-10 pr-3 md:pr-4 py-2 md:py-3 border-2 border-gray-100 rounded-xl md:rounded-2xl text-xs md:text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-50 outline-none transition-all"
                                    />
                                </div>
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleSearch}
                                    disabled={searching}
                                    className="px-3 md:px-6 py-2 md:py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl md:rounded-2xl font-bold text-xs md:text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-60 flex items-center gap-1 md:gap-2 touch-manipulation"
                                >
                                    {searching ? <Loader2 size={12} className="md:size-4 animate-spin" /> : <Search size={12} className="md:size-4" />}
                                    <span className="hidden xs:inline">Search</span>
                                </motion.button>
                            </div>

                            <AnimatePresence>
                                {searchError && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="mt-2 md:mt-3 flex items-center gap-1.5 md:gap-2 text-red-600 text-[10px] md:text-sm bg-red-50 rounded-lg md:rounded-xl px-3 md:px-4 py-1.5 md:py-2.5 border border-red-100"
                                    >
                                        <AlertCircle size={10} className="md:size-3" />
                                        {searchError}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {searchResult && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-3 md:mt-4"
                                >
                                    <p className="text-[9px] md:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 md:mb-2 flex items-center gap-1 md:gap-2">
                                        <User size={8} className="md:size-2.5" /> Search Result
                                    </p>
                                    <WorkerCard
                                        worker={searchResult}
                                        selected={selectedWorker?._id === searchResult._id}
                                        onSelect={() => setSelectedWorker(
                                            selectedWorker?._id === searchResult._id ? null : searchResult
                                        )}
                                    />
                                    {selectedWorker?._id === searchResult._id && (
                                        <motion.p
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="text-[9px] md:text-xs text-orange-600 font-semibold mt-1 md:mt-2 flex items-center gap-0.5 md:gap-1"
                                        >
                                            <CheckCircle size={8} className="md:size-3" />
                                            Worker selected — fill complaint below
                                        </motion.p>
                                    )}
                                </motion.div>
                            )}
                        </motion.div>

                        {/* Step 2: Complaint Details */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className={`bg-white rounded-2xl md:rounded-3xl border-2 shadow-xl p-4 md:p-6 transition-all ${
                                selectedWorker ? 'border-orange-100' : 'border-gray-100 opacity-60 pointer-events-none'
                            }`}
                        >
                            <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-5">
                                <div className={`w-6 h-6 md:w-7 md:h-7 rounded-lg md:rounded-xl flex items-center justify-center text-[10px] md:text-xs font-black shadow-md transition-all ${
                                    selectedWorker
                                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
                                        : 'bg-gray-200 text-gray-400'
                                }`}>
                                    2
                                </div>
                                <h2 className="font-bold text-gray-800 text-sm md:text-lg">Describe the Issue</h2>
                            </div>

                            {/* Category */}
                            <div className="mb-4 md:mb-5">
                                <label className="block text-[11px] md:text-sm font-bold text-gray-700 mb-1.5 md:mb-2">
                                    Complaint Category <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-1.5 md:gap-2">
                                    {CATEGORIES.map(({ label, icon: Icon, color }) => (
                                        <motion.button
                                            key={label}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => setCategory(label)}
                                            className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 md:py-2.5 rounded-lg md:rounded-xl border-2 text-[10px] md:text-sm font-medium transition-all ${
                                                category === label
                                                    ? `border-${color}-500 bg-${color}-50 text-${color}-700 shadow-md`
                                                    : 'border-gray-100 text-gray-600 hover:border-orange-200 hover:bg-orange-50/50'
                                            }`}
                                        >
                                            <Icon size={10} className="md:size-3.5" />
                                            <span className="truncate">{label}</span>
                                        </motion.button>
                                    ))}
                                </div>
                            </div>

                            {/* Description */}
                            <div className="mb-4 md:mb-5">
                                <label className="block text-[11px] md:text-sm font-bold text-gray-700 mb-1.5 md:mb-2">
                                    Detailed Description <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={description}
                                    onChange={e => { setDescription(e.target.value); setFormError(''); }}
                                    placeholder="Describe what happened in detail..."
                                    rows={4}
                                    maxLength={2000}
                                    className="w-full border-2 border-gray-100 rounded-xl md:rounded-2xl p-3 md:p-4 text-xs md:text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-50 outline-none transition-all resize-none"
                                />
                                <div className="flex justify-between items-center mt-1">
                                    <span className="text-[8px] md:text-xs text-gray-400">Min 20 characters</span>
                                    <span className={`text-[8px] md:text-xs font-mono ${description.length < 20 ? 'text-red-400' : 'text-green-500'}`}>
                                        {description.length} / 2000
                                    </span>
                                </div>
                            </div>

                            <AnimatePresence>
                                {formError && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="mb-3 md:mb-4 flex items-center gap-1.5 md:gap-2 text-red-600 text-[10px] md:text-sm bg-red-50 rounded-lg md:rounded-xl px-3 md:px-4 py-1.5 md:py-2.5 border border-red-100"
                                    >
                                        <AlertCircle size={10} className="md:size-3" />
                                        {formError}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={handleSubmit}
                                disabled={submitting || !selectedWorker}
                                className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-2.5 md:py-4 rounded-xl md:rounded-2xl font-bold text-xs md:text-base shadow-lg hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 md:gap-3 touch-manipulation"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 size={14} className="md:size-4 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Send size={14} className="md:size-4" />
                                        Submit Complaint
                                    </>
                                )}
                            </motion.button>

                            <p className="text-[8px] md:text-[10px] text-gray-400 text-center mt-2 md:mt-3 flex items-center justify-center gap-1">
                                <Shield size={8} className="md:size-2.5" />
                                Your complaint is confidential. Action within 24 hours.
                            </p>
                        </motion.div>
                    </div>
                )}

                {/* ── HISTORY TAB (Mobile Optimized) ── */}
                {activeTab === 'history' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        <div className="flex items-center justify-between mb-3 md:mb-4">
                            <p className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1 md:gap-2">
                                <FileText size={10} className="md:size-3" />
                                {complaints.length} Complaint{complaints.length !== 1 ? 's' : ''}
                            </p>
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={fetchComplaints}
                                disabled={loadingPast}
                                className="p-1.5 md:p-2 text-gray-400 hover:text-orange-500 transition-all touch-manipulation"
                            >
                                <RefreshCw size={12} className="md:size-4" />
                            </motion.button>
                        </div>

                        {loadingPast ? (
                            <div className="flex flex-col items-center justify-center py-12 md:py-20">
                                <Loader2 size={24} className="md:size-8 animate-spin text-orange-400 mb-2 md:mb-3" />
                                <p className="text-gray-500 font-semibold text-sm md:text-base">Loading complaints...</p>
                            </div>
                        ) : complaints.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-12 md:py-20 bg-white rounded-2xl md:rounded-3xl shadow-xl border border-gray-100"
                            >
                                <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                                    <ShieldAlert size={24} className="md:size-8 text-gray-300" />
                                </div>
                                <p className="font-bold text-gray-800 text-base md:text-lg mb-1">No complaints filed yet</p>
                                <p className="text-gray-400 text-[10px] md:text-sm">Complaints you file will appear here</p>
                                <button
                                    onClick={() => setActiveTab('new')}
                                    className="mt-4 md:mt-6 inline-flex items-center gap-1.5 md:gap-2 px-4 md:px-5 py-2 md:py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg md:rounded-xl font-bold text-xs md:text-sm shadow-md hover:shadow-lg transition-all touch-manipulation"
                                >
                                    <MessageSquare size={12} className="md:size-3.5" />
                                    File First Complaint
                                </button>
                            </motion.div>
                        ) : (
                            <div className="space-y-3 md:space-y-4">
                                {complaints.map((complaint, idx) => (
                                    <ComplaintCard key={complaint._id} complaint={complaint} index={idx} />
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </div>
        </div>
    );
}