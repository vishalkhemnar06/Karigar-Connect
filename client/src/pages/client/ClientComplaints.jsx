// src/pages/client/ClientComplaints.jsx
// ENHANCED UI VERSION - All original functionality preserved
// Enhanced with: Modern gradients, animations, better visual hierarchy, micro-interactions

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

// ── Status badge helper (Enhanced) ────────────────────────────────────────────
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
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full border ${cls}`}>
            <Icon size={12} />
            {label}
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

// ── Enhanced Worker Preview Card ──────────────────────────────────────────────
const WorkerCard = ({ worker, onSelect, selected }) => {
    const skills = Array.isArray(worker.skills)
        ? worker.skills.map(s => (typeof s === 'object' ? s.name : s)).slice(0, 3)
        : [];
    const hasMoreSkills = (worker.skills?.length || 0) > 3;

    return (
        <motion.div
            whileHover={{ scale: 1.01, y: -2 }}
            whileTap={{ scale: 0.99 }}
            onClick={onSelect}
            className={`flex items-start gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
                selected
                    ? 'border-orange-500 bg-gradient-to-r from-orange-50 to-amber-50 shadow-xl shadow-orange-100'
                    : 'border-gray-100 bg-white hover:border-orange-200 hover:shadow-md'
            }`}
        >
            <div className="relative flex-shrink-0">
                <img
                    src={worker.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.name)}&background=f97316&color=fff&bold=true`}
                    alt={worker.name}
                    className="w-16 h-16 rounded-2xl object-cover border-3 border-orange-100 shadow-md"
                    onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.name)}&background=f97316&color=fff&bold=true`; }}
                />
                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${
                    worker.verificationStatus === 'approved' ? 'bg-green-500' : 'bg-gray-400'
                }`} />
                {worker.verificationStatus === 'approved' && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                        <CheckCircle size={10} className="text-white" />
                    </div>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <p className="font-black text-gray-900 text-base">{worker.name}</p>
                    {worker.avgStars > 0 && (
                        <span className="flex items-center gap-0.5 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                            <Star size={10} className="fill-yellow-500" />
                            {worker.avgStars.toFixed(1)}
                        </span>
                    )}
                </div>
                <p className="text-xs text-orange-600 font-mono font-bold mb-1">{worker.karigarId}</p>
                {skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                        {skills.map((skill, i) => (
                            <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                                {skill}
                            </span>
                        ))}
                        {hasMoreSkills && (
                            <span className="text-[10px] text-gray-400">+{worker.skills.length - 3}</span>
                        )}
                    </div>
                )}
            </div>

            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full">
                    <Phone size={10} />
                    <span className="font-medium">{worker.mobile}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    worker.verificationStatus === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                }`}>
                    {worker.completedJobs || 0} jobs completed
                </span>
                {selected && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center shadow-md"
                    >
                        <CheckCircle size={14} className="text-white" />
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
};

// ── Enhanced Success Popup ────────────────────────────────────────────────────
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
            className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center"
            onClick={e => e.stopPropagation()}
        >
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-xl shadow-green-200"
            >
                <CheckCircle size={48} className="text-white" />
            </motion.div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">Complaint Submitted!</h3>
            <p className="text-gray-500 text-sm leading-relaxed mb-4">
                We have received your complaint and will review it carefully.
            </p>
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-3 mb-5 border border-orange-200">
                <p className="text-xs text-orange-700 font-semibold flex items-center justify-center gap-2">
                    <Clock size={12} />
                    Action will be taken within 24 hours
                </p>
            </div>
            <p className="text-xs text-gray-400 mb-5">
                You can track the status in your complaints history below.
            </p>
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 rounded-2xl font-bold shadow-lg shadow-orange-200 hover:shadow-orange-300 transition-all"
            >
                Got It, Thanks!
            </motion.button>
        </motion.div>
    </motion.div>
);

// ── Enhanced Complaint Card for History ───────────────────────────────────────
const ComplaintCard = ({ complaint, index }) => {
    const [expanded, setExpanded] = useState(false);
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -2 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-md hover:shadow-xl transition-all overflow-hidden"
        >
            {/* Header */}
            <div className="p-5 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="relative flex-shrink-0">
                            <img
                                src={complaint.againstWorker?.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(complaint.againstWorker?.name || 'W')}&background=f97316&color=fff&bold=true`}
                                alt={complaint.againstWorker?.name}
                                className="w-12 h-12 rounded-2xl object-cover border-2 border-orange-100 shadow-sm"
                                onError={e => { e.target.src = `https://ui-avatars.com/api/?name=W&background=f97316&color=fff&bold=true`; }}
                            />
                            <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                                complaint.againstWorker?.verificationStatus === 'approved' ? 'bg-green-500' : 'bg-gray-400'
                            }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 truncate">{complaint.againstWorker?.name || 'Unknown Worker'}</p>
                            <p className="text-xs text-orange-600 font-mono">{complaint.againstWorker?.karigarId}</p>
                            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                <Calendar size={10} />
                                {new Date(complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                        </div>
                    </div>
                    <StatusBadge status={complaint.status} />
                    <div className="flex-shrink-0 text-gray-400">
                        {expanded ? <ChevronRight size={16} className="rotate-90" /> : <ChevronRight size={16} />}
                    </div>
                </div>

                {/* Category Badge */}
                <div className="mt-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 border border-orange-200">
                        <Flag size={10} />
                        {complaint.category}
                    </span>
                </div>

                {/* Preview of description */}
                <p className="text-sm text-gray-600 mt-3 line-clamp-2 leading-relaxed">
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
                        <div className="p-5 space-y-4">
                            {/* Full Description */}
                            <div className="bg-gradient-to-r from-gray-50 to-white rounded-2xl p-4">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Full Description</p>
                                <p className="text-sm text-gray-700 leading-relaxed">{complaint.description}</p>
                            </div>

                            {/* Admin Notes */}
                            {complaint.adminNotes && (
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Shield size={14} className="text-blue-600" />
                                        <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Admin Response</p>
                                    </div>
                                    <p className="text-sm text-blue-800 leading-relaxed">{complaint.adminNotes}</p>
                                </div>
                            )}

                            {/* Admin Action */}
                            {complaint.adminAction && (
                                <div className={`rounded-2xl p-3 flex items-center gap-3 ${
                                    complaint.adminAction === 'blocked' ? 'bg-red-50 border border-red-200' :
                                    complaint.adminAction === 'warned' ? 'bg-yellow-50 border border-yellow-200' :
                                    complaint.adminAction === 'cleared' ? 'bg-green-50 border border-green-200' :
                                    'bg-gray-50 border border-gray-200'
                                }`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                        complaint.adminAction === 'blocked' ? 'bg-red-100' :
                                        complaint.adminAction === 'warned' ? 'bg-yellow-100' :
                                        complaint.adminAction === 'cleared' ? 'bg-green-100' :
                                        'bg-gray-100'
                                    }`}>
                                        {complaint.adminAction === 'blocked' && <X size={14} className="text-red-500" />}
                                        {complaint.adminAction === 'warned' && <AlertTriangle size={14} className="text-yellow-500" />}
                                        {complaint.adminAction === 'cleared' && <CheckCircle size={14} className="text-green-500" />}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-700 uppercase">Action Taken</p>
                                        <p className={`text-sm font-semibold capitalize ${
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
                            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                <div className="flex items-center gap-3 text-xs text-gray-400">
                                    <span className="flex items-center gap-1">
                                        <FileText size={10} />
                                        Complaint ID: {complaint._id.slice(-6)}
                                    </span>
                                </div>
                                {complaint.resolvedAt && (
                                    <span className="text-xs text-green-600 flex items-center gap-1">
                                        <CheckCircle size={10} />
                                        Resolved {new Date(complaint.resolvedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
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

// ── Main Page ────────────────────────────────────────────────────────────────
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
        <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/20 p-4 md:p-8">
            <AnimatePresence>
                {showSuccess && <SuccessPopup onClose={() => setShowSuccess(false)} />}
            </AnimatePresence>

            <div className="max-w-3xl mx-auto">
                {/* Enhanced Page Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-r from-orange-500 to-red-500 rounded-3xl p-6 mb-8 text-white shadow-xl relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
                    <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
                    
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                            <AlertTriangle size={24} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black">File a Complaint</h1>
                            <p className="text-white/90 text-sm mt-1">Report issues with workers you have hired</p>
                        </div>
                    </div>
                </motion.div>

                {/* Enhanced Tabs */}
                <div className="flex bg-gray-100 rounded-2xl p-1 mb-8 gap-1">
                    {[
                        { id: 'new', label: 'New Complaint', icon: MessageSquare, color: 'orange' },
                        { id: 'history', label: `My Complaints${complaints.length ? ` (${complaints.length})` : ''}`, icon: FileText, color: 'gray' },
                    ].map(({ id, label, icon: Icon, color }) => (
                        <motion.button
                            key={id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setActiveTab(id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                activeTab === id
                                    ? `bg-gradient-to-r from-${color}-500 to-${color}-600 text-white shadow-md`
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Icon size={15} />
                            {label}
                        </motion.button>
                    ))}
                </div>

                {/* ── NEW COMPLAINT TAB (Enhanced) ── */}
                {activeTab === 'new' && (
                    <div className="space-y-6">
                        {/* Step 1: Search Worker */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-3xl border-2 border-orange-100 shadow-xl p-6"
                        >
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl flex items-center justify-center text-sm font-black shadow-md">
                                    1
                                </div>
                                <h2 className="font-bold text-gray-800 text-lg">Find the Worker</h2>
                            </div>

                            <p className="text-sm text-gray-500 mb-4">
                                Enter the worker's <strong className="text-orange-600">Karigar ID</strong> or <strong className="text-orange-600">mobile number</strong> to find their profile.
                            </p>

                            <div className="flex gap-3">
                                <div className="flex-1 relative">
                                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => { setSearchQuery(e.target.value); setSearchError(''); }}
                                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                        placeholder="Enter Karigar ID or mobile number..."
                                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-100 rounded-2xl text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-50 outline-none transition-all"
                                    />
                                </div>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleSearch}
                                    disabled={searching}
                                    className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-60 flex items-center gap-2"
                                >
                                    {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                                    Search
                                </motion.button>
                            </div>

                            <AnimatePresence>
                                {searchError && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="mt-3 flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-xl px-4 py-2.5 border border-red-100"
                                    >
                                        <AlertCircle size={14} />
                                        {searchError}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {searchResult && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-4"
                                >
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <User size={10} /> Search Result
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
                                            className="text-xs text-orange-600 font-semibold mt-2 flex items-center gap-1"
                                        >
                                            <CheckCircle size={12} />
                                            Worker selected — fill in your complaint below
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
                            className={`bg-white rounded-3xl border-2 shadow-xl p-6 transition-all ${
                                selectedWorker ? 'border-orange-100' : 'border-gray-100 opacity-60 pointer-events-none'
                            }`}
                        >
                            <div className="flex items-center gap-3 mb-5">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black shadow-md transition-all ${
                                    selectedWorker
                                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
                                        : 'bg-gray-200 text-gray-400'
                                }`}>
                                    2
                                </div>
                                <h2 className="font-bold text-gray-800 text-lg">Describe the Issue</h2>
                            </div>

                            {/* Category */}
                            <div className="mb-5">
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Complaint Category <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {CATEGORIES.map(({ label, icon: Icon, color }) => (
                                        <motion.button
                                            key={label}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => setCategory(label)}
                                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                                                category === label
                                                    ? `border-${color}-500 bg-${color}-50 text-${color}-700 shadow-md`
                                                    : 'border-gray-100 text-gray-600 hover:border-orange-200 hover:bg-orange-50/50'
                                            }`}
                                        >
                                            <Icon size={14} />
                                            {label}
                                        </motion.button>
                                    ))}
                                </div>
                            </div>

                            {/* Description */}
                            <div className="mb-5">
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Detailed Description <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={description}
                                    onChange={e => { setDescription(e.target.value); setFormError(''); }}
                                    placeholder="Describe what happened in detail — what work was done, what went wrong, any evidence you have..."
                                    rows={5}
                                    maxLength={2000}
                                    className="w-full border-2 border-gray-100 rounded-2xl p-4 text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-50 outline-none transition-all resize-none"
                                />
                                <div className="flex justify-between items-center mt-1">
                                    <span className="text-xs text-gray-400">Minimum 20 characters</span>
                                    <span className={`text-xs font-mono ${description.length < 20 ? 'text-red-400' : 'text-green-500'}`}>
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
                                        className="mb-4 flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-xl px-4 py-2.5 border border-red-100"
                                    >
                                        <AlertCircle size={14} />
                                        {formError}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleSubmit}
                                disabled={submitting || !selectedWorker}
                                className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 rounded-2xl font-black text-base shadow-lg hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Submitting Complaint...
                                    </>
                                ) : (
                                    <>
                                        <Send size={18} />
                                        Submit Complaint
                                    </>
                                )}
                            </motion.button>

                            <p className="text-xs text-gray-400 text-center mt-3 flex items-center justify-center gap-1">
                                <Shield size={10} />
                                Your complaint is confidential. We will take action within 24 hours.
                            </p>
                        </motion.div>
                    </div>
                )}

                {/* ── HISTORY TAB (Enhanced) ── */}
                {activeTab === 'history' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                <FileText size={12} />
                                {complaints.length} Complaint{complaints.length !== 1 ? 's' : ''}
                            </p>
                            <motion.button
                                whileHover={{ scale: 1.05, rotate: 180 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={fetchComplaints}
                                disabled={loadingPast}
                                className="p-2 text-gray-400 hover:text-orange-500 transition-all"
                            >
                                <RefreshCw size={16} className={loadingPast ? 'animate-spin' : ''} />
                            </motion.button>
                        </div>

                        {loadingPast ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <Loader2 size={32} className="animate-spin text-orange-400 mb-3" />
                                <p className="text-gray-500 font-semibold">Loading complaints...</p>
                            </div>
                        ) : complaints.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-20 bg-white rounded-3xl shadow-xl border border-gray-100"
                            >
                                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <ShieldAlert size={32} className="text-gray-300" />
                                </div>
                                <p className="font-bold text-gray-800 text-lg mb-2">No complaints filed yet</p>
                                <p className="text-gray-400 text-sm">Complaints you file will appear here</p>
                                <button
                                    onClick={() => setActiveTab('new')}
                                    className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all"
                                >
                                    <MessageSquare size={14} />
                                    File Your First Complaint
                                </button>
                            </motion.div>
                        ) : (
                            <div className="space-y-4">
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