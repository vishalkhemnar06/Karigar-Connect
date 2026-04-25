// src/pages/client/ClientComplaints.jsx
// PREMIUM VERSION - Fully responsive, mobile-optimized, modern design

import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../../api';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle, Search, ChevronRight, X, CheckCircle,
    Clock, ShieldAlert, User, Phone, Briefcase, Star,
    FileText, Send, Loader2, MapPin, AlertCircle, RefreshCw,
    MessageSquare, Flag, Award, Shield, Calendar, ThumbsUp,
    ExternalLink, Eye, Filter, Zap, Sparkles, Crown, ArrowRight,
    Verified, Heart, TrendingUp, DollarSign, Clock3
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Status Badge Helper (Enhanced) ────────────────────────────────────────────
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
        <span className={`inline-flex items-center gap-1.5 text-[10px] md:text-xs font-bold px-2.5 md:px-3 py-1 md:py-1.5 rounded-full border ${cls}`}>
            <Icon size={10} className="md:size-3" />
            <span>{label}</span>
        </span>
    );
};

// ── Category Options with Icons ──────────────────────────────────────────────
const CATEGORIES = [
    { label: 'Poor Quality Work', icon: Star, color: 'orange', gradient: 'from-orange-500 to-amber-500' },
    { label: 'Unprofessional Behavior', icon: AlertTriangle, color: 'red', gradient: 'from-red-500 to-rose-500' },
    { label: 'Did Not Show Up', icon: Clock, color: 'amber', gradient: 'from-amber-500 to-yellow-500' },
    { label: 'Damaged Property', icon: AlertCircle, color: 'red', gradient: 'from-red-500 to-rose-500' },
    { label: 'Overcharged / Fraud', icon: TrendingUp, color: 'orange', gradient: 'from-orange-500 to-amber-500' },
    { label: 'Harassment', icon: ShieldAlert, color: 'purple', gradient: 'from-purple-500 to-pink-500' },
    { label: 'Other', icon: FileText, color: 'gray', gradient: 'from-gray-500 to-gray-600' },
];

// ── Premium Worker Card ──────────────────────────────────────────────────────
const WorkerCard = ({ worker, onSelect, selected }) => {
    const skills = Array.isArray(worker.skills)
        ? worker.skills.map(s => (typeof s === 'object' ? s.name : s)).slice(0, 3)
        : [];
    const hasMoreSkills = (worker.skills?.length || 0) > 3;

    return (
        <motion.div
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={onSelect}
            className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                selected
                    ? 'border-orange-500 bg-gradient-to-r from-orange-50 to-amber-50 shadow-lg shadow-orange-100'
                    : 'border-gray-100 bg-white hover:border-orange-200 hover:shadow-md'
            }`}
        >
            <div className="relative flex-shrink-0">
                <img
                    src={worker.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.name)}&background=f97316&color=fff&bold=true`}
                    alt={worker.name}
                    className="w-12 h-12 md:w-14 md:h-14 rounded-xl object-cover border-2 border-orange-200 shadow-sm"
                    onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.name)}&background=f97316&color=fff&bold=true`; }}
                />
                {worker.verificationStatus === 'approved' && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                        <Verified size={8} className="text-white" />
                    </div>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <p className="font-bold text-gray-800 text-sm md:text-base truncate">{worker.name}</p>
                    {worker.avgStars > 0 && (
                        <span className="flex items-center gap-0.5 text-[9px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                            <Star size={8} className="fill-yellow-500" />
                            {worker.avgStars.toFixed(1)}
                        </span>
                    )}
                </div>
                <p className="text-[9px] text-orange-600 font-mono font-semibold mb-1 truncate">{worker.karigarId}</p>
                {skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {skills.map((skill, i) => (
                            <span key={i} className="text-[8px] md:text-[10px] bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">
                                {skill}
                            </span>
                        ))}
                        {hasMoreSkills && (
                            <span className="text-[8px] text-gray-400">+{worker.skills.length - 3}</span>
                        )}
                    </div>
                )}
            </div>

            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {worker.mobile && (
                    <div className="flex items-center gap-1 text-[9px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
                        <Phone size={8} />
                        <span className="hidden sm:inline">{worker.mobile}</span>
                    </div>
                )}
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                    worker.verificationStatus === 'approved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-600'
                }`}>
                    {worker.completedJobs || 0} jobs
                </span>
                {selected && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-5 h-5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full flex items-center justify-center shadow-md"
                    >
                        <CheckCircle size={10} className="text-white" />
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
};

// ── Premium Success Popup ─────────────────────────────────────────────────────
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
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center"
            onClick={e => e.stopPropagation()}
        >
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg"
            >
                <CheckCircle size="32" className="text-white" />
            </motion.div>
            <h3 className="text-xl font-bold text-gray-800 mb-1">Complaint Submitted!</h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-4">
                We have received your complaint and will review it carefully.
            </p>
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-3 mb-4 border border-orange-200">
                <p className="text-xs text-orange-700 font-semibold flex items-center justify-center gap-2">
                    <Clock size="12" /> Action will be taken within 24 hours
                </p>
            </div>
            <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all"
            >
                Got It, Thanks!
            </motion.button>
        </motion.div>
    </motion.div>
);

// ── Premium Complaint Card for History ───────────────────────────────────────
const ComplaintCard = ({ complaint, index }) => {
    const [expanded, setExpanded] = useState(false);
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -2 }}
            className="bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-xl transition-all overflow-hidden"
        >
            {/* Header - Click to Expand */}
            <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="relative flex-shrink-0">
                            <img
                                src={complaint.againstWorker?.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(complaint.againstWorker?.name || 'W')}&background=f97316&color=fff&bold=true`}
                                alt={complaint.againstWorker?.name}
                                className="w-12 h-12 rounded-xl object-cover border-2 border-orange-200 shadow-sm"
                                onError={e => { e.target.src = `https://ui-avatars.com/api/?name=W&background=f97316&color=fff&bold=true`; }}
                            />
                            {complaint.againstWorker?.verificationStatus === 'approved' && (
                                <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-800 text-sm truncate">{complaint.againstWorker?.name || 'Unknown Worker'}</p>
                            <p className="text-[10px] text-orange-600 font-mono truncate">{complaint.againstWorker?.karigarId}</p>
                            <p className="text-[9px] text-gray-400 mt-0.5 flex items-center gap-1">
                                <Calendar size="8" />
                                {new Date(complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                        </div>
                    </div>
                    <StatusBadge status={complaint.status} />
                    <div className="flex-shrink-0 text-gray-400">
                        <ChevronRight size="16" className={`transform transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    </div>
                </div>

                {/* Category Badge */}
                <div className="mt-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 border border-orange-200">
                        <Flag size="10" /> {complaint.category}
                    </span>
                </div>

                {/* Description Preview */}
                <p className="text-xs text-gray-600 mt-2 line-clamp-2 leading-relaxed">
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
                        <div className="p-4 space-y-4">
                            {/* Full Description */}
                            <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Full Description</p>
                                <p className="text-xs text-gray-700 leading-relaxed">{complaint.description}</p>
                            </div>

                            {/* Admin Notes */}
                            {complaint.adminNotes && (
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Shield size="12" className="text-blue-600" />
                                        <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Admin Response</p>
                                    </div>
                                    <p className="text-xs text-blue-800 leading-relaxed">{complaint.adminNotes}</p>
                                </div>
                            )}

                            {/* Admin Action */}
                            {complaint.adminAction && (
                                <div className={`rounded-lg p-3 flex items-center gap-2 ${
                                    complaint.adminAction === 'blocked' ? 'bg-red-50 border border-red-200' :
                                    complaint.adminAction === 'warned' ? 'bg-yellow-50 border border-yellow-200' :
                                    complaint.adminAction === 'cleared' ? 'bg-green-50 border border-green-200' :
                                    'bg-gray-50 border border-gray-200'
                                }`}>
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                                        complaint.adminAction === 'blocked' ? 'bg-red-100' :
                                        complaint.adminAction === 'warned' ? 'bg-yellow-100' :
                                        complaint.adminAction === 'cleared' ? 'bg-green-100' :
                                        'bg-gray-100'
                                    }`}>
                                        {complaint.adminAction === 'blocked' && <X size="12" className="text-red-500" />}
                                        {complaint.adminAction === 'warned' && <AlertTriangle size="12" className="text-yellow-500" />}
                                        {complaint.adminAction === 'cleared' && <CheckCircle size="12" className="text-green-500" />}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[9px] font-bold text-gray-700 uppercase">Action Taken</p>
                                        <p className={`text-xs font-semibold capitalize ${
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
                            <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                                <div className="flex items-center gap-1.5 text-[9px] text-gray-400">
                                    <FileText size="9" />
                                    <span>ID: {complaint._id.slice(-6)}</span>
                                </div>
                                {complaint.resolvedAt && (
                                    <span className="text-[9px] text-emerald-600 flex items-center gap-0.5">
                                        <CheckCircle size="9" /> Resolved
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

// ── Main Page (Premium Design) ────────────────────────────────────────────────
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
    const [refreshing, setRefreshing]   = useState(false);
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

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchComplaints();
        setRefreshing(false);
        toast.success('Complaints refreshed');
    };

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
        <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 pb-20">
            <AnimatePresence>
                {showSuccess && <SuccessPopup onClose={() => setShowSuccess(false)} />}
            </AnimatePresence>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-5 pb-8">
                
                {/* Hero Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-xl">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                    <AlertTriangle size="24" className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black" data-guide-id="client-page-complaints">File a Complaint</h1>
                                    <p className="text-white/90 text-sm mt-0.5">Report issues with workers you have hired</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="bg-white/15 rounded-xl px-3 py-1.5 text-center">
                                    <p className="text-xl font-bold">{complaints.length}</p>
                                    <p className="text-[10px] text-white/80">Total Complaints</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Tabs */}
                <div className="flex gap-2 bg-white rounded-xl p-1.5 mb-6 shadow-sm border border-gray-100">
                    {[
                        { id: 'new', label: 'New Complaint', icon: MessageSquare },
                        { id: 'history', label: complaints.length ? `My Complaints (${complaints.length})` : 'My Complaints', icon: FileText },
                    ].map(({ id, label, icon: Icon }) => (
                        <motion.button
                            key={id}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setActiveTab(id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
                                activeTab === id
                                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                                    : 'text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            <Icon size="14" />
                            <span>{label}</span>
                        </motion.button>
                    ))}
                </div>

                {/* New Complaint Tab */}
                {activeTab === 'new' && (
                    <div className="space-y-5">
                        {/* Step 1: Search Worker */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-xl border border-gray-100 shadow-md p-5"
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-6 h-6 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">1</div>
                                <h2 className="font-bold text-gray-800 text-sm">Find the Worker</h2>
                            </div>

                            <p className="text-xs text-gray-500 mb-3">
                                Enter the worker's <span className="font-semibold text-orange-600">Karigar ID</span> or <span className="font-semibold text-orange-600">mobile number</span>
                            </p>

                            <div className="flex gap-2">
                                <div className="flex-1 relative">
                                    <Search size="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => { setSearchQuery(e.target.value); setSearchError(''); }}
                                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                        placeholder="Karigar ID or mobile..."
                                        className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                                    />
                                </div>
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleSearch}
                                    disabled={searching}
                                    className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                                >
                                    {searching ? <Loader2 size="16" className="animate-spin" /> : <Search size="16" />}
                                </motion.button>
                            </div>

                            <AnimatePresence>
                                {searchError && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="mt-2 flex items-center gap-1.5 text-red-600 text-xs bg-red-50 rounded-lg px-3 py-2 border border-red-100"
                                    >
                                        <AlertCircle size="12" /> {searchError}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {searchResult && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-3"
                                >
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                        <User size="10" /> Search Result
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
                                            <CheckCircle size="12" /> Worker selected — fill complaint below
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
                            className={`bg-white rounded-xl border shadow-md p-5 transition-all ${
                                selectedWorker ? 'border-orange-100' : 'border-gray-100 opacity-60 pointer-events-none'
                            }`}
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shadow-sm transition-all ${
                                    selectedWorker
                                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white'
                                        : 'bg-gray-200 text-gray-400'
                                }`}>
                                    2
                                </div>
                                <h2 className="font-bold text-gray-800 text-sm">Describe the Issue</h2>
                            </div>

                            {/* Category */}
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-700 mb-2">
                                    Complaint Category <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {CATEGORIES.map(({ label, icon: Icon, color }) => (
                                        <motion.button
                                            key={label}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => setCategory(label)}
                                            className={`flex items-center gap-1.5 px-2 py-2 rounded-lg border text-xs font-medium transition-all ${
                                                category === label
                                                    ? `border-${color}-500 bg-${color}-50 text-${color}-700 shadow-sm`
                                                    : 'border-gray-200 text-gray-600 hover:border-orange-200 hover:bg-orange-50'
                                            }`}
                                        >
                                            <Icon size="12" />
                                            <span className="truncate">{label}</span>
                                        </motion.button>
                                    ))}
                                </div>
                            </div>

                            {/* Description */}
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-700 mb-2">
                                    Detailed Description <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={description}
                                    onChange={e => { setDescription(e.target.value); setFormError(''); }}
                                    placeholder="Describe what happened in detail..."
                                    rows={4}
                                    maxLength={2000}
                                    className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 resize-none"
                                />
                                <div className="flex justify-between items-center mt-1">
                                    <span className="text-[10px] text-gray-400">Min 20 characters</span>
                                    <span className={`text-[10px] font-mono ${description.length < 20 ? 'text-red-400' : 'text-green-500'}`}>
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
                                        className="mb-4 flex items-center gap-1.5 text-red-600 text-xs bg-red-50 rounded-lg px-3 py-2 border border-red-100"
                                    >
                                        <AlertCircle size="12" /> {formError}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={handleSubmit}
                                disabled={submitting || !selectedWorker}
                                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 size="14" className="animate-spin inline mr-2" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Send size="14" className="inline mr-2" />
                                        Submit Complaint
                                    </>
                                )}
                            </motion.button>

                            <p className="text-[9px] text-gray-400 text-center mt-3 flex items-center justify-center gap-1">
                                <Shield size="10" /> Your complaint is confidential. Action within 24 hours.
                            </p>
                        </motion.div>
                    </div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                <FileText size="12" /> {complaints.length} Complaint{complaints.length !== 1 ? 's' : ''}
                            </p>
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="p-2 text-gray-400 hover:text-orange-500 transition-all"
                            >
                                <RefreshCw size="14" className={refreshing ? 'animate-spin' : ''} />
                            </motion.button>
                        </div>

                        {loadingPast ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <Loader2 size="40" className="animate-spin text-orange-500 mb-4" />
                                <p className="text-gray-500 font-medium">Loading complaints...</p>
                            </div>
                        ) : complaints.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.96 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center"
                            >
                                <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <ShieldAlert size="36" className="text-gray-400" />
                                </div>
                                <h3 className="font-bold text-gray-700 text-lg mb-2">No complaints filed yet</h3>
                                <p className="text-gray-400 text-sm">Complaints you file will appear here</p>
                                <button
                                    onClick={() => setActiveTab('new')}
                                    className="mt-5 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold text-sm hover:shadow-md transition-all inline-flex items-center gap-2"
                                >
                                    <MessageSquare size="14" /> File First Complaint
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