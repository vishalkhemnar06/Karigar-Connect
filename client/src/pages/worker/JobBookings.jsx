// client/src/pages/worker/JobBookings.jsx
// FIXED VERSION - Added React import and fixed all references

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWorkerBookings, workerCancelJob, getImageUrl } from '../../api/index';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar, Clock, MapPin, DollarSign, Briefcase, Users,
    Star, Shield, AlertCircle, CheckCircle, XCircle, Truck,
    Phone, Mail, ExternalLink, ChevronDown, ChevronUp,
    Navigation, Loader2, Award, TrendingUp, Zap, Gift, Lock, MessageCircle
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
const CANCEL_CUTOFF_MINS = 30;

const getCancelInfo = (job) => {
    if (!job) return { show: false, allowed: false, reason: 'invalid' };
    if (job.status === 'running') return { show: false, allowed: false, reason: 'running' };
    if (job.status !== 'scheduled') return { show: false, allowed: false, reason: 'wrong_status' };
    if (!job.scheduledDate || !job.scheduledTime) return { show: true, allowed: true };

    try {
        const [h, m] = job.scheduledTime.split(':').map(Number);
        const sched = new Date(job.scheduledDate);
        sched.setHours(h, m, 0, 0);
        const minsLeft = (sched.getTime() - Date.now()) / 60000;

        if (minsLeft <= 0) return { show: false, allowed: false, reason: 'past_start' };
        if (minsLeft <= CANCEL_CUTOFF_MINS) return { show: true, allowed: false, minsLeft: Math.max(0, Math.floor(minsLeft)), reason: 'too_close' };
        return { show: true, allowed: true, minsLeft: Math.floor(minsLeft) };
    } catch (error) {
        console.error('Error calculating cancel info:', error);
        return { show: false, allowed: false, reason: 'error' };
    }
};

const STATUS_CONFIG = {
    open: { label: 'Open', color: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700', icon: Zap },
    scheduled: { label: 'Scheduled', color: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', icon: Calendar },
    running: { label: 'Running', color: 'bg-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-700', icon: Truck },
    completed: { label: 'Completed', color: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle },
    cancelled_by_client: { label: 'Cancelled', color: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', icon: XCircle },
    cancelled: { label: 'Cancelled', color: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', icon: XCircle },
};

function SBadge({ status }) {
    const config = STATUS_CONFIG[status] || { label: status || 'Unknown', bg: 'bg-gray-100', text: 'text-gray-600', icon: AlertCircle };
    const Icon = config.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${config.bg} ${config.text} shadow-sm`}>
            <Icon size={12} />
            {config.label}
        </span>
    );
}

// ── Cancel Confirm Modal ──────────────────────────────────────────────────────
function CancelModal({ job, mySlot, onClose, onCancelled }) {
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');

    const handle = async () => {
        if (!reason.trim()) { setErr('Please provide a reason.'); return; }
        try {
            setLoading(true);
            await workerCancelJob(job._id, reason);
            toast.success('Assignment cancelled. 30 penalty points deducted.');
            onCancelled(job._id);
            onClose();
        } catch (e) {
            setErr(e?.response?.data?.message || 'Failed to cancel.');
        } finally { setLoading(false); }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: 50, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: 50, opacity: 0 }}
                className="bg-white w-full sm:rounded-3xl sm:max-w-md rounded-t-3xl p-6 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                        <AlertCircle size={24} className="text-red-500" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-gray-900">Cancel Assignment</h3>
                        <p className="text-sm text-gray-500 truncate max-w-[200px]">{job?.title || 'Job'}</p>
                    </div>
                </div>

                {mySlot && (
                    <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3 mb-4">
                        <p className="text-xs text-orange-600 font-semibold">Your Role</p>
                        <p className="text-sm font-bold text-orange-700 capitalize">{mySlot.skill}</p>
                    </div>
                )}

                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 mb-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-red-700 mb-1">⚠️ Warning: Points Deduction</p>
                            <p className="text-xs text-red-600">
                                Cancelling will deduct <strong className="font-bold">30 points</strong> from your account 
                                and re-open the slot for other workers.
                            </p>
                        </div>
                    </div>
                </div>

                {err && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-3 mb-4 flex items-center justify-between">
                        <p className="text-xs text-red-600 flex-1">{err}</p>
                        <button onClick={() => setErr('')} className="text-red-500 font-bold px-2">×</button>
                    </div>
                )}

                <label className="block text-sm font-bold text-gray-700 mb-2">
                    Reason for Cancellation <span className="text-red-500">*</span>
                </label>
                <textarea
                    rows={3}
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Please explain why you need to cancel..."
                    className="w-full border-2 border-gray-200 rounded-2xl p-3 text-sm focus:outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50 resize-none mb-5"
                />
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-2xl font-semibold hover:bg-gray-50 transition-all"
                    >
                        Keep Job
                    </button>
                    <button
                        onClick={handle}
                        disabled={loading || !reason.trim()}
                        className="flex-1 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-2xl font-bold disabled:opacity-60 transition-all shadow-md"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Confirm Cancel'}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ── Error Boundary Component (Fixed - now uses React.Component) ─────────────────
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('JobBookings Error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="max-w-3xl mx-auto p-4">
                    <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 text-center">
                        <AlertCircle size={48} className="text-red-500 mx-auto mb-3" />
                        <h2 className="text-lg font-bold text-red-700 mb-2">Something went wrong</h2>
                        <p className="text-sm text-red-600 mb-4">There was an error loading your bookings.</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                            Refresh Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// ── Job Card Component ─────────────────────────────────────────────────────
function JobCard({ job, workerId, expanded, onToggle, onCancel, activeSection }) {
    const navigate = useNavigate();
    
    // Safe data extraction with fallbacks
    const allSlots = job?.mySlots || job?.workerSlots || [];
    const mySlots = allSlots.filter(s => {
        try {
            const assignedId = s?.assignedWorker?._id?.toString() || s?.assignedWorker?.toString() || '';
            return assignedId === workerId;
        } catch (error) {
            console.error('Error filtering slots:', error);
            return false;
        }
    });
    const myPrimary = mySlots[0];

    const myApps = (job?.applicants || []).filter(a => {
        try {
            const appId = a?.workerId?._id?.toString() || a?.workerId?.toString() || '';
            return appId === workerId;
        } catch (error) {
            console.error('Error filtering applicants:', error);
            return false;
        }
    });

    const cancelInfo = getCancelInfo(job);
    const isExpanded = expanded === job?._id;

    // Early return if job is invalid
    if (!job) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            whileHover={{ y: -2 }}
            className="bg-white rounded-2xl border-2 border-gray-100 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
        >
            {/* Card Header - Clickable */}
            <div
                className="p-5 cursor-pointer hover:bg-gradient-to-r hover:from-gray-50 hover:to-orange-50/30 transition-all"
                onClick={() => onToggle(job._id)}
            >
                <div className="flex items-start gap-4">
                    {/* Client Avatar */}
                    <div className="relative flex-shrink-0">
                        <img
                            src={getImageUrl(job?.postedBy?.photo)}
                            alt=""
                            className="w-12 h-12 rounded-2xl object-cover border-2 border-orange-200 shadow-sm"
                            onError={e => { e.target.src = '/admin.png'; }}
                        />
                        {['scheduled', 'running'].includes(job?.status) && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                                <CheckCircle size={10} className="text-white" />
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="font-bold text-gray-900 text-base leading-tight line-clamp-1">
                                {job?.title || 'Untitled Job'}
                            </h3>
                            <SBadge status={job?.status} />
                        </div>
                        
                        <p className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                            <Users size={10} />
                            {job?.postedBy?.name || 'Unknown Client'}
                        </p>

                        {/* My assigned slots badges */}
                        {mySlots.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                                {mySlots.map((s, i) => (
                                    <span
                                        key={i}
                                        className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                                            s?.status === 'task_completed' ? 'bg-emerald-100 text-emerald-700' :
                                            s?.status === 'filled' ? 'bg-blue-100 text-blue-700' :
                                            'bg-gray-100 text-gray-600'
                                        }`}
                                    >
                                        <Briefcase size={10} />
                                        {s?.skill || 'General'} {s?.status === 'task_completed' && '✓'}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Pending applications */}
                        {mySlots.length === 0 && myApps.filter(a => a?.status === 'pending').length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                                {myApps.filter(a => a?.status === 'pending').map((a, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                                        <Clock size={10} />
                                        Applied: {a?.skill || 'general'} ⏳
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Job Meta Info */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1 font-bold text-green-600">
                                <DollarSign size={12} />
                                ₹{job?.payment?.toLocaleString() || '0'}
                            </span>
                            {job?.scheduledDate && (
                                <span className="flex items-center gap-1">
                                    <Calendar size={10} />
                                    {new Date(job.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                </span>
                            )}
                            {job?.scheduledTime && (
                                <span className="flex items-center gap-1">
                                    <Clock size={10} />
                                    {job.scheduledTime}
                                </span>
                            )}
                            {job?.location?.city && (
                                <span className="flex items-center gap-1">
                                    <MapPin size={10} />
                                    {job.location.city}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex-shrink-0 text-gray-400">
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                </div>
            </div>

            {/* Expanded Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t border-gray-100"
                    >
                        <div className="p-5 space-y-4">
                            {/* Description */}
                            {job?.description && (
                                <div className="bg-gradient-to-r from-gray-50 to-white rounded-2xl p-4">
                                    <p className="text-sm text-gray-700 leading-relaxed">{job.description}</p>
                                </div>
                            )}

                            {/* Details Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    { label: 'Scheduled Date', value: job?.scheduledDate ? new Date(job.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set', icon: Calendar },
                                    { label: 'Scheduled Time', value: job?.scheduledTime || 'Not set', icon: Clock },
                                    { label: 'Duration', value: job?.duration || 'Not provided', icon: TrendingUp },
                                    { label: 'Workers Required', value: job?.workersRequired || (job?.workerSlots || []).length || 'Not provided', icon: Users },
                                    { label: 'Budget', value: `₹${job?.payment?.toLocaleString() || '0'}`, icon: DollarSign },
                                    { label: 'Negotiable', value: job?.negotiable ? 'Yes' : 'No', icon: Gift },
                                ].map((item, idx) => (
                                    <div key={idx} className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                                            <item.icon size={14} className="text-orange-500" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase">{item.label}</p>
                                            <p className="text-sm font-semibold text-gray-800">{item.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Required Skills */}
                            {Array.isArray(job?.skills) && job.skills.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <Zap size={12} /> Required Skills
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {job.skills.map((sk, i) => (
                                            <span key={i} className="text-xs bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-full font-semibold capitalize">
                                                {sk}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* All Worker Slots */}
                            {!!(job?.workerSlots || []).length && (
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <Briefcase size={12} /> All Positions
                                    </p>
                                    <div className="space-y-2">
                                        {(job.workerSlots || []).map((s, i) => (
                                            <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                                                <div>
                                                    <p className="text-sm font-bold text-gray-800 capitalize">{s?.skill || 'General'}</p>
                                                    <p className="text-xs text-gray-500">~{s?.hoursEstimated || 0}h estimated</p>
                                                </div>
                                                <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                                                    s?.status === 'filled' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                                                }`}>
                                                    {s?.status === 'filled' ? '✓ Assigned' : s?.status || 'Open'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* My Assigned Slots Detail */}
                            {mySlots.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <Award size={12} /> Your Assignments
                                    </p>
                                    <div className="space-y-2">
                                        {mySlots.map((s, i) => (
                                            <div key={i} className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl px-4 py-3">
                                                <div>
                                                    <p className="text-sm font-bold text-blue-800 capitalize">{s?.skill || 'General'}</p>
                                                    <p className="text-xs text-blue-600">~{s?.hoursEstimated || 0}h estimated</p>
                                                </div>
                                                <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                                                    s?.status === 'task_completed' ? 'bg-emerald-100 text-emerald-700' :
                                                    s?.status === 'filled' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {s?.status === 'task_completed' ? '✓ Complete' : s?.status === 'filled' ? 'In Progress' : s?.status || 'Pending'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Pending Applications */}
                            {myApps.filter(a => a?.status === 'pending').length > 0 && (
                                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
                                    <div className="flex items-start gap-3">
                                        <Clock size={18} className="text-amber-600 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-bold text-amber-700 mb-1">Pending Applications</p>
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                {myApps.filter(a => a?.status === 'pending').map((a, i) => (
                                                    <span key={i} className="text-xs bg-white border border-amber-200 text-amber-700 px-3 py-1.5 rounded-full font-semibold capitalize">
                                                        {a?.skill || 'general'}
                                                    </span>
                                                ))}
                                            </div>
                                            <p className="text-xs text-amber-600">Waiting for the client to accept your application.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Client Info */}
                            {job?.postedBy && (
                                <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-4 flex items-center gap-3">
                                    <img
                                        src={getImageUrl(job.postedBy.photo)}
                                        alt=""
                                        className="w-12 h-12 rounded-full object-cover border-2 border-orange-200"
                                        onError={e => { e.target.src = '/admin.png'; }}
                                    />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-gray-800">{job.postedBy.name}</p>
                                        {job.postedBy.mobile && (
                                            <a href={`tel:${job.postedBy.mobile}`} className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
                                                <Phone size={10} /> {job.postedBy.mobile}
                                            </a>
                                        )}
                                    </div>
                                    <button className="p-2 bg-orange-100 rounded-xl hover:bg-orange-200 transition-all">
                                        <MessageCircle size={14} className="text-orange-600" />
                                    </button>
                                </div>
                            )}

                            {/* Location */}
                            {job?.location?.city && (
                                <div className="bg-gray-50 rounded-2xl p-4">
                                    <div className="flex items-start gap-2">
                                        <MapPin size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-semibold text-gray-700">
                                                {[job.location.locality, job.location.city, job.location.pincode].filter(Boolean).join(', ')}
                                            </p>
                                            {job.location.fullAddress && (
                                                <p className="text-xs text-gray-500 mt-1">{job.location.fullAddress}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Client Q&A */}
                            {!!(job?.qaAnswers || []).length && (
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <MessageCircle size={12} /> Client Q&A
                                    </p>
                                    <div className="space-y-2">
                                        {(job.qaAnswers || []).map((qa, i) => (
                                            <div key={i} className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                                                <p className="text-xs font-bold text-indigo-700 flex items-center gap-1 mb-1">
                                                    <Shield size={10} /> Q: {qa?.question || 'Question'}
                                                </p>
                                                <p className="text-sm text-indigo-900">A: {qa?.answer || '—'}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Job Photos */}
                            {!!(job?.photos || []).length && (
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Job Photos</p>
                                    <div className="grid grid-cols-4 gap-2">
                                        {(job.photos || []).map((p, i) => (
                                            <img
                                                key={i}
                                                src={getImageUrl(p)}
                                                alt=""
                                                className="w-full aspect-square object-cover rounded-xl border border-gray-200"
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Completion Photos */}
                            {job?.completionPhotos?.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Completion Photos</p>
                                    <div className="grid grid-cols-4 gap-2">
                                        {job.completionPhotos.map((p, i) => (
                                            <img
                                                key={i}
                                                src={getImageUrl(p)}
                                                alt=""
                                                className="w-full aspect-square object-cover rounded-xl border border-gray-200"
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Running Notice */}
                            {job?.status === 'running' && (
                                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4">
                                    <div className="flex items-start gap-3">
                                        <Truck size={18} className="text-yellow-600 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-bold text-yellow-700 mb-1">Job In Progress</p>
                                            <p className="text-xs text-yellow-600">
                                                Complete your assigned tasks. The client will mark your task as done and provide a rating.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Live Location Sharing Button */}
                            {['scheduled', 'running'].includes(job?.status) && mySlots.length > 0 && (
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => navigate(`/worker/live-tracking/${job._id}`)}
                                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-2xl font-bold text-sm transition-all shadow-lg"
                                >
                                    <Navigation size={16} />
                                    Share My Live Location with Client
                                </motion.button>
                            )}

                            {/* Cancel Button */}
                            {cancelInfo.show && (
                                <div>
                                    {cancelInfo.allowed ? (
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => onCancel({ job, mySlot: myPrimary })}
                                            className="w-full py-3.5 border-2 border-red-200 bg-white text-red-500 rounded-2xl font-bold text-sm hover:bg-red-50 transition-all"
                                        >
                                            Cancel Assignment
                                        </motion.button>
                                    ) : cancelInfo.reason === 'too_close' ? (
                                        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-center">
                                            <div className="flex items-center justify-center gap-2 mb-2">
                                                <AlertCircle size={16} className="text-red-500" />
                                                <p className="text-xs font-bold text-red-600">Cannot Cancel</p>
                                            </div>
                                            <p className="text-xs text-red-500">
                                                Cancellation window closed. Job starts in {cancelInfo.minsLeft} min.
                                                (Must cancel more than {CANCEL_CUTOFF_MINS} minutes before start)
                                            </p>
                                        </div>
                                    ) : null}
                                </div>
                            )}

                            {/* Running: no cancel */}
                            {job?.status === 'running' && (
                                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
                                    <p className="text-xs text-gray-500 font-medium flex items-center justify-center gap-2">
                                        <Lock size={12} /> Job is running — cancellation not available
                                    </p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function JobBookings() {
    const navigate = useNavigate();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [cancelData, setCancelData] = useState(null);
    const [expanded, setExpanded] = useState(null);
    const [activeSection, setActiveSection] = useState('in_progress');
    const [error, setError] = useState(null);

    // Get worker ID robustly
    const workerData = JSON.parse(localStorage.getItem('user') || '{}');
    const workerId = String(workerData._id || workerData.id || '');
    const workerSkills = (workerData.skills || [])
        .map(s => (typeof s === 'string' ? s : s?.name || ''))
        .map(s => s.toLowerCase().trim())
        .filter(Boolean);

    const loadBookings = async () => {
        try {
            setLoading(true);
            setError(null);
            const { data } = await getWorkerBookings();
            // Ensure data is an array
            const bookingsData = Array.isArray(data) ? data : [];
            setJobs(bookingsData);
        } catch (err) {
            console.error('Error loading bookings:', err);
            setError(err?.response?.data?.message || 'Failed to load bookings.');
            toast.error('Failed to load bookings.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadBookings(); }, []);

    const getBookingSection = (job) => {
        if (!job) return 'others';
        
        const wid = workerId;

        try {
            const allSlots = job.mySlots || job.workerSlots || [];
            const mySlots = allSlots.filter(s => {
                const assignedId = s?.assignedWorker?._id?.toString() || s?.assignedWorker?.toString() || '';
                return assignedId === wid;
            });

            const inAssignedTo = (job.assignedTo || []).some(id => {
                return (id?._id?.toString() || id?.toString() || '') === wid;
            });

            const myApps = (job.applicants || []).filter(a => {
                const appId = a?.workerId?._id?.toString() || a?.workerId?.toString() || '';
                return appId === wid;
            });

            const isAssignedToMe = mySlots.length > 0 || inAssignedTo;

            if (['cancelled_by_client', 'cancelled'].includes(job.status) && (isAssignedToMe || myApps.length > 0)) {
                return 'cancelled';
            }

            if (job.status === 'completed') return 'completed';
            if (mySlots.length > 0 && mySlots.every(s => s?.status === 'task_completed')) return 'completed';

            if (job.status === 'running') return 'in_progress';
            if (mySlots.some(s => ['filled', 'running'].includes(s?.status))) return 'in_progress';
            if (job.status === 'scheduled' && (mySlots.length > 0 || inAssignedTo)) return 'in_progress';

            if (myApps.some(a => a?.status === 'pending')) return 'open';
            if (myApps.some(a => a?.status === 'accepted')) return 'in_progress';

            if (job.status === 'open') return 'open';
            if (job.status === 'scheduled' && myApps.length === 0 && !isAssignedToMe) return 'open';

            return 'others';
        } catch (error) {
            console.error('Error in getBookingSection:', error);
            return 'others';
        }
    };

    const groupedJobs = jobs.reduce((acc, job) => {
        try {
            const section = getBookingSection(job);
            if (!acc[section]) acc[section] = [];
            acc[section].push(job);
        } catch (error) {
            console.error('Error grouping job:', error);
            if (!acc.others) acc.others = [];
            acc.others.push(job);
        }
        return acc;
    }, {
        open: [],
        in_progress: [],
        completed: [],
        cancelled: [],
        others: [],
    });

    const sectionMeta = [
        { key: 'in_progress', title: 'In Progress', icon: Truck, color: 'orange', empty: 'No in-progress jobs right now.' },
        { key: 'open', title: 'Open Opportunities', icon: Zap, color: 'green', empty: 'No open jobs match your skills right now.' },
        { key: 'completed', title: 'Completed', icon: CheckCircle, color: 'emerald', empty: 'No completed jobs yet.' },
        { key: 'cancelled', title: 'Cancelled', icon: XCircle, color: 'red', empty: 'No cancelled jobs.' },
        { key: 'others', title: 'Other', icon: AlertCircle, color: 'gray', empty: 'No jobs in other statuses.' },
    ];

    const getJobSkillSet = (job) => {
        try {
            const fromSkills = Array.isArray(job?.skills) ? job.skills : [];
            const fromSlots = (job?.workerSlots || []).map(s => s?.skill).filter(Boolean);
            const all = [...fromSkills, ...fromSlots, job?.subTaskSkill].filter(Boolean);
            return [...new Set(all.map(s => String(s).toLowerCase().trim()))];
        } catch (error) {
            console.error('Error getting job skills:', error);
            return [];
        }
    };

    const isRelevantToWorkerSkill = (job) => {
        if (!workerSkills.length) return true;
        try {
            const myApps = (job?.applicants || []).filter(a => {
                return (a?.workerId?._id?.toString() || a?.workerId?.toString() || '') === workerId;
            });
            if (myApps.length) return true;
            const skills = getJobSkillSet(job);
            return skills.some(sk => workerSkills.includes(sk));
        } catch (error) {
            console.error('Error checking relevance:', error);
            return true;
        }
    };

    useEffect(() => {
        try {
            const hasActive = (groupedJobs[activeSection] || []).length > 0;
            if (hasActive) return;
            const firstNonEmpty = sectionMeta.find(s => (groupedJobs[s.key] || []).length > 0);
            if (firstNonEmpty && firstNonEmpty.key !== activeSection) {
                setActiveSection(firstNonEmpty.key);
            }
        } catch (error) {
            console.error('Error in useEffect:', error);
        }
    }, [jobs]);

    const handleCancelled = async () => { await loadBookings(); };

    // Show error state
    if (error && !loading) {
        return (
            <div className="max-w-3xl mx-auto p-4">
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8 text-center">
                    <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-red-700 mb-2">Failed to Load Bookings</h2>
                    <p className="text-sm text-red-600 mb-4">{error}</p>
                    <button
                        onClick={loadBookings}
                        className="px-6 py-2.5 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full"
                />
                <p className="mt-4 text-gray-500 font-semibold">Loading your bookings...</p>
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/20 p-4 md:p-8">
                <div className="max-w-3xl mx-auto space-y-6 pb-20">
                    {/* Header */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-r from-orange-500 to-red-500 rounded-3xl p-6 text-white shadow-xl"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                                <Briefcase size={24} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black">My Job Bookings</h1>
                                <p className="text-white/90 text-sm mt-1">Track and manage your assigned jobs</p>
                            </div>
                        </div>
                        {jobs.length > 0 && (
                            <div className="flex gap-4 mt-4 text-sm">
                                <span className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
                                    <Briefcase size={12} /> {jobs.length} Total Jobs
                                </span>
                                <span className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
                                    <Truck size={12} /> {groupedJobs.in_progress?.length || 0} In Progress
                                </span>
                            </div>
                        )}
                    </motion.div>

                    {jobs.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-20 bg-white rounded-3xl shadow-xl border border-gray-100"
                        >
                            <motion.div
                                animate={{ y: [0, -10, 0] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="text-6xl mb-4"
                            >
                                📋
                            </motion.div>
                            <p className="font-bold text-gray-800 text-xl mb-2">No bookings yet</p>
                            <p className="text-gray-400 text-sm">Apply for available jobs to see them here</p>
                            <button
                                onClick={() => navigate('/worker/jobs')}
                                className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
                            >
                                <Zap size={16} /> Browse Jobs
                            </button>
                        </motion.div>
                    ) : (
                        <div className="space-y-4">
                            {/* Section Tabs */}
                            <div className="overflow-x-auto no-scrollbar">
                                <div className="flex items-center gap-2 min-w-max pb-2">
                                    {sectionMeta.map(section => {
                                        const count = (groupedJobs[section.key] || []).length;
                                        const active = activeSection === section.key;
                                        const Icon = section.icon;
                                        return (
                                            <motion.button
                                                key={section.key}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => { setExpanded(null); setActiveSection(section.key); }}
                                                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                                    active
                                                        ? `bg-gradient-to-r from-${section.color}-500 to-${section.color}-600 text-white shadow-lg`
                                                        : 'bg-white text-gray-600 border-2 border-gray-200 hover:border-orange-300'
                                                }`}
                                            >
                                                <Icon size={14} />
                                                {section.title}
                                                {count > 0 && (
                                                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                                                        active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                        {count}
                                                    </span>
                                                )}
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Job List */}
                            <AnimatePresence mode="wait">
                                {(() => {
                                    const section = sectionMeta.find(s => s.key === activeSection) || sectionMeta[0];
                                    const rawList = groupedJobs[section.key] || [];
                                    const list = section.key === 'open'
                                        ? rawList.filter(isRelevantToWorkerSkill)
                                        : rawList;

                                    if (list.length === 0) {
                                        return (
                                            <motion.div
                                                key="empty"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="bg-white rounded-2xl border-2 border-gray-100 p-8 text-center shadow-sm"
                                            >
                                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <section.icon size={24} className="text-gray-400" />
                                                </div>
                                                <p className="text-gray-500 font-medium">{section.empty}</p>
                                            </motion.div>
                                        );
                                    }

                                    return (
                                        <motion.div
                                            key="list"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="space-y-4"
                                        >
                                            {list.map(job => (
                                                <JobCard
                                                    key={job._id}
                                                    job={job}
                                                    workerId={workerId}
                                                    expanded={expanded}
                                                    onToggle={(id) => setExpanded(expanded === id ? null : id)}
                                                    onCancel={setCancelData}
                                                    activeSection={activeSection}
                                                />
                                            ))}
                                        </motion.div>
                                    );
                                })()}
                            </AnimatePresence>
                        </div>
                    )}
                </div>

                <AnimatePresence>
                    {cancelData && (
                        <CancelModal
                            job={cancelData.job}
                            mySlot={cancelData.mySlot}
                            onClose={() => setCancelData(null)}
                            onCancelled={handleCancelled}
                        />
                    )}
                </AnimatePresence>
            </div>
        </ErrorBoundary>
    );
}