// client/src/pages/worker/JobBookings.jsx
// UPDATED: Full i18n translation support added + Mobile optimized

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getWorkerBookings, workerCancelJob, getImageUrl } from '../../api/index';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Briefcase, MapPin, Calendar, Clock, DollarSign, Users,
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
    } catch {
        return { show: false, allowed: false, reason: 'error' };
    }
};

// ── Status Config ─────────────────────────────────────────────────────────────
const useStatusConfig = () => {
    const { t } = useTranslation();
    return {
        open:                { label: t('common.open'),      color: 'bg-green-500', bg: 'bg-green-50',  text: 'text-green-700',  icon: Zap },
        scheduled:           { label: t('common.scheduled'), color: 'bg-blue-500',  bg: 'bg-blue-50',   text: 'text-blue-700',   icon: Calendar },
        running:             { label: t('common.running'),   color: 'bg-yellow-500',bg: 'bg-yellow-50', text: 'text-yellow-700', icon: Truck },
        completed:           { label: t('common.completed'), color: 'bg-emerald-500',bg:'bg-emerald-50',text: 'text-emerald-700',icon: CheckCircle },
        cancelled_by_client: { label: t('common.cancelled'), color: 'bg-red-500',   bg: 'bg-red-50',    text: 'text-red-700',    icon: XCircle },
        cancelled:           { label: t('common.cancelled'), color: 'bg-red-500',   bg: 'bg-red-50',    text: 'text-red-700',    icon: XCircle },
    };
};

function SBadge({ status }) {
    const STATUS_CONFIG = useStatusConfig();
    const config = STATUS_CONFIG[status] || { label: status || 'Unknown', bg: 'bg-gray-100', text: 'text-gray-600', icon: AlertCircle };
    const Icon = config.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${config.bg} ${config.text} shadow-sm`}>
            <Icon size={12} />
            <span className="truncate">{config.label}</span>
        </span>
    );
}

// ── Cancel Confirm Modal (Mobile Optimized) ──────────────────────────────────────
function CancelModal({ job, mySlot, onClose, onCancelled }) {
    const { t } = useTranslation();
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');

    const handle = async () => {
        if (!reason.trim()) { setErr(t('job_bookings.reason_label') + ' required.'); return; }
        try {
            setLoading(true);
            await workerCancelJob(job._id, reason);
            toast.success(t('job_bookings.cancelled_success'));
            onCancelled(job._id);
            onClose();
        } catch (e) {
            setErr(e?.response?.data?.message || 'Failed to cancel.');
        } finally { setLoading(false); }
    };

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-white w-full sm:rounded-3xl sm:max-w-md rounded-t-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 mb-4 sticky top-0 bg-white pb-2">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <AlertCircle size={20} className="text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-black text-gray-900">{t('job_bookings.cancel_assignment')}</h3>
                        <p className="text-xs text-gray-500 truncate">{job?.title || 'Job'}</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                        <XCircle size={18} className="text-gray-400" />
                    </button>
                </div>

                {mySlot && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4">
                        <p className="text-xs text-orange-600 font-semibold">{t('job_bookings.your_role')}</p>
                        <p className="text-sm font-bold text-orange-700 capitalize">{mySlot.skill}</p>
                    </div>
                )}

                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 mb-4">
                    <div className="flex items-start gap-2">
                        <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-red-700 mb-0.5">⚠️ Warning</p>
                            <p className="text-xs text-red-600">{t('job_bookings.cancel_warning')}</p>
                        </div>
                    </div>
                </div>

                {err && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-center justify-between">
                        <p className="text-xs text-red-600 flex-1">{err}</p>
                        <button onClick={() => setErr('')} className="text-red-500 font-bold px-2 text-lg">×</button>
                    </div>
                )}

                <label className="block text-sm font-bold text-gray-700 mb-2">
                    {t('job_bookings.reason_label')} <span className="text-red-500">*</span>
                </label>
                <textarea
                    rows={3}
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Please explain why you need to cancel..."
                    className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50 resize-none mb-4"
                />
                <div className="flex gap-3 sticky bottom-0 bg-white pt-2 pb-1">
                    <button 
                        onClick={onClose} 
                        className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-all active:bg-gray-100"
                    >
                        {t('job_bookings.keep_job')}
                    </button>
                    <button
                        onClick={handle}
                        disabled={loading || !reason.trim()}
                        className="flex-1 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-bold disabled:opacity-60 transition-all shadow-md active:scale-95"
                    >
                        {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : t('job_bookings.confirm_cancel')}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ── Error Boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false }; }
    static getDerivedStateFromError() { return { hasError: true }; }
    render() {
        if (this.state.hasError) {
            return (
                <div className="max-w-3xl mx-auto p-4">
                    <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 text-center">
                        <AlertCircle size={40} className="text-red-500 mx-auto mb-3" />
                        <h2 className="text-base font-bold text-red-700 mb-2">Something went wrong</h2>
                        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm">Refresh Page</button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

// ── Job Card (Mobile Optimized) ──────────────────────────────────────────────────
function JobCard({ job, workerId, expanded, onToggle, onCancel, activeSection }) {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const allSlots = job?.mySlots || job?.workerSlots || [];
    const mySlots = allSlots.filter(s => {
        try {
            const assignedId = s?.assignedWorker?._id?.toString() || s?.assignedWorker?.toString() || '';
            return assignedId === workerId;
        } catch { return false; }
    });
    const myPrimary = mySlots[0];
    const myApps = (job?.applicants || []).filter(a => {
        try {
            const appId = a?.workerId?._id?.toString() || a?.workerId?.toString() || '';
            return appId === workerId;
        } catch { return false; }
    });

    const cancelInfo = getCancelInfo(job);
    const isExpanded = expanded === job?._id;

    if (!job) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            whileHover={{ y: -2 }}
            className="bg-white rounded-2xl border-2 border-gray-100 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
        >
            {/* Card Header - Mobile optimized with larger tap area */}
            <div 
                className="flex items-start gap-3 p-4 active:bg-gray-50 cursor-pointer touch-manipulation" 
                onClick={() => onToggle(job._id)}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => e.key === 'Enter' && onToggle(job._id)}
            >
                <div className="relative flex-shrink-0">
                    <img
                        src={getImageUrl(job?.postedBy?.photo)}
                        alt=""
                        className="w-10 h-10 rounded-xl object-cover border-2 border-orange-200 shadow-sm"
                        onError={e => { e.target.src = '/admin.png'; }}
                    />
                    {['scheduled', 'running'].includes(job?.status) && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                            <CheckCircle size={8} className="text-white" />
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-2 flex-1">{job?.title || 'Untitled Job'}</h3>
                        <div className="flex-shrink-0">
                            <SBadge status={job?.status} />
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-1.5">
                        <Users size={10} /> <span className="truncate">{job?.postedBy?.name || 'Unknown Client'}</span>
                    </p>

                    {/* My assigned slots - mobile scrollable */}
                    {mySlots.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                            {mySlots.map((s, i) => (
                                <span key={i} className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                                    s?.status === 'task_completed' ? 'bg-emerald-100 text-emerald-700' :
                                    s?.status === 'filled' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                    <Briefcase size={10} /> {s?.skill || 'General'} {s?.status === 'task_completed' && '✓'}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Pending apps */}
                    {mySlots.length === 0 && myApps.filter(a => a?.status === 'pending').length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                            {myApps.filter(a => a?.status === 'pending').map((a, i) => (
                                <span key={i} className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                    <Clock size={10} /> {t('job_bookings.applied_label', { skill: a?.skill || 'general' })}
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1 font-bold text-green-600">
                            <DollarSign size={11} /> ₹{job?.payment?.toLocaleString() || '0'}
                        </span>
                        {job?.scheduledDate && (
                            <span className="flex items-center gap-1">
                                <Calendar size={10} />
                                {new Date(job.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>
                        )}
                        {job?.scheduledTime && <span className="flex items-center gap-1"><Clock size={10} /> {job.scheduledTime}</span>}
                        {job?.location?.city && <span className="flex items-center gap-1"><MapPin size={10} /> {job.location.city}</span>}
                    </div>
                </div>

                <div className="flex-shrink-0 text-gray-400 pt-1">
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
            </div>

            {/* Expanded Content - Mobile optimized */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t border-gray-100"
                    >
                        <div className="p-4 space-y-3">
                            {job?.description && (
                                <div className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-3">
                                    <p className="text-xs text-gray-700 leading-relaxed">{job.description}</p>
                                </div>
                            )}

                            {/* Pending Applications info */}
                            {myApps.filter(a => a?.status === 'pending').length > 0 && (
                                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3">
                                    <div className="flex items-start gap-2">
                                        <Clock size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-amber-700 mb-1">{t('job_bookings.pending_apps')}</p>
                                            <div className="flex flex-wrap gap-1.5 mb-1.5">
                                                {myApps.filter(a => a?.status === 'pending').map((a, i) => (
                                                    <span key={i} className="text-xs bg-white border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full font-semibold capitalize">
                                                        {a?.skill || 'general'}
                                                    </span>
                                                ))}
                                            </div>
                                            <p className="text-xs text-amber-600">{t('job_bookings.waiting_client')}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Client Info - Mobile friendly */}
                            {job?.postedBy && (
                                <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-3 flex items-center gap-2">
                                    <img 
                                        src={getImageUrl(job.postedBy.photo)} 
                                        alt="" 
                                        className="w-10 h-10 rounded-full object-cover border-2 border-orange-200 flex-shrink-0" 
                                        onError={e => { e.target.src = '/admin.png'; }} 
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-800 truncate">{job.postedBy.name}</p>
                                        {job.postedBy.mobile && (
                                            <a 
                                                href={`tel:${job.postedBy.mobile}`} 
                                                className="text-xs text-blue-600 flex items-center gap-1 mt-0.5 inline-flex touch-manipulation"
                                            >
                                                <Phone size={10} /> <span className="truncate">{job.postedBy.mobile}</span>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Location */}
                            {job?.location?.city && (
                                <div className="bg-gray-50 rounded-xl p-3">
                                    <div className="flex items-start gap-2">
                                        <MapPin size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                                        <p className="text-xs font-semibold text-gray-700 flex-1 break-words">
                                            {[job.location.locality, job.location.city, job.location.pincode].filter(Boolean).join(', ')}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Running notice */}
                            {job?.status === 'running' && (
                                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-3">
                                    <div className="flex items-start gap-2">
                                        <Truck size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-yellow-700 mb-0.5">{t('job_bookings.sections.in_progress')}</p>
                                            <p className="text-xs text-yellow-600">{t('job_manage.in_progress_job')}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Live Location Button - Larger tap target for mobile */}
                            {['scheduled', 'running'].includes(job?.status) && mySlots.length > 0 && (
                                <motion.button
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => navigate(`/worker/live-tracking/${job._id}`)}
                                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg active:opacity-80 touch-manipulation"
                                >
                                    <Navigation size={16} /> {t('job_bookings.share_location')}
                                </motion.button>
                            )}

                            {/* Cancel Button */}
                            {cancelInfo.show && (
                                cancelInfo.allowed ? (
                                    <motion.button
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => onCancel({ job, mySlot: myPrimary })}
                                        className="w-full py-3.5 border-2 border-red-200 bg-white text-red-500 rounded-xl font-bold text-sm hover:bg-red-50 transition-all active:bg-red-50 touch-manipulation"
                                    >
                                        {t('job_bookings.cancel_assignment')}
                                    </motion.button>
                                ) : cancelInfo.reason === 'too_close' ? (
                                    <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-center">
                                        <p className="text-xs font-bold text-red-600 mb-0.5">{t('job_manage.cannot_cancel')}</p>
                                        <p className="text-xs text-red-500">
                                            {t('job_manage.cancel_window_closed', { mins: cancelInfo.minsLeft })}
                                        </p>
                                    </div>
                                ) : null
                            )}

                            {job?.status === 'running' && (
                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                                    <p className="text-xs text-gray-500 font-medium flex items-center justify-center gap-1.5">
                                        <Lock size={11} /> {t('job_bookings.cancel_locked')}
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

// ── Main Component (Mobile Optimized) ─────────────────────────────────────────────
export default function JobBookings() {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [cancelData, setCancelData] = useState(null);
    const [expanded, setExpanded] = useState(null);
    const [activeSection, setActiveSection] = useState('in_progress');
    const [error, setError] = useState(null);

    const workerData = JSON.parse(localStorage.getItem('user') || '{}');
    const workerId = String(workerData._id || workerData.id || '');
    const workerSkills = (workerData.skills || []).map(s => (typeof s === 'string' ? s : s?.name || '')).map(s => s.toLowerCase().trim()).filter(Boolean);

    const loadBookings = async () => {
        try {
            setLoading(true);
            setError(null);
            const { data } = await getWorkerBookings();
            setJobs(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to load bookings.');
            toast.error(t('job_bookings.failed_load'));
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
            const inAssignedTo = (job.assignedTo || []).some(id => (id?._id?.toString() || id?.toString() || '') === wid);
            const myApps = (job.applicants || []).filter(a => {
                const appId = a?.workerId?._id?.toString() || a?.workerId?.toString() || '';
                return appId === wid;
            });
            const isAssignedToMe = mySlots.length > 0 || inAssignedTo;

            if (['cancelled_by_client', 'cancelled'].includes(job.status) && (isAssignedToMe || myApps.length > 0)) return 'cancelled';
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
        } catch { return 'others'; }
    };

    const groupedJobs = jobs.reduce((acc, job) => {
        try {
            const section = getBookingSection(job);
            if (!acc[section]) acc[section] = [];
            acc[section].push(job);
        } catch {
            if (!acc.others) acc.others = [];
            acc.others.push(job);
        }
        return acc;
    }, { open: [], in_progress: [], completed: [], cancelled: [], others: [] });

    // Section metadata
    const sectionMeta = [
        { key: 'in_progress', title: t('job_bookings.sections.in_progress'), icon: Truck,        color: 'orange', empty: t('job_bookings.empty.in_progress') },
        { key: 'open',        title: t('job_bookings.sections.open'),        icon: Zap,          color: 'green',  empty: t('job_bookings.empty.open') },
        { key: 'completed',   title: t('job_bookings.sections.completed'),   icon: CheckCircle,  color: 'emerald',empty: t('job_bookings.empty.completed') },
        { key: 'cancelled',   title: t('job_bookings.sections.cancelled'),   icon: XCircle,      color: 'red',    empty: t('job_bookings.empty.cancelled') },
        { key: 'others',      title: t('job_bookings.sections.others'),      icon: AlertCircle,  color: 'gray',   empty: t('job_bookings.empty.others') },
    ];

    const handleCancelled = async () => { await loadBookings(); };

    // Mobile touch scroll for section tabs
    const scrollContainerRef = React.useRef(null);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
                <motion.div 
                    animate={{ rotate: 360 }} 
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }} 
                    className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full"
                />
                <p className="mt-4 text-gray-500 font-semibold text-sm">{t('job_bookings.loading')}</p>
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/20 pb-20">
                <div className="max-w-3xl mx-auto px-4 pt-4 md:pt-8 space-y-4">

                    {/* Header - Mobile optimized */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-4 text-white shadow-xl"
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                                <Briefcase size={20} className="text-white" />
                            </div>
                            <div className="flex-1">
                                <h1 className="text-xl font-black">{t('job_bookings.title')}</h1>
                                <p className="text-white/90 text-xs mt-0.5">{t('job_bookings.subtitle')}</p>
                            </div>
                        </div>
                        {jobs.length > 0 && (
                            <div className="flex gap-2 mt-2">
                                <span className="flex items-center gap-1 bg-white/20 rounded-full px-2.5 py-1 text-xs">
                                    <Briefcase size={10} /> {jobs.length} {t('job_bookings.total_jobs')}
                                </span>
                                <span className="flex items-center gap-1 bg-white/20 rounded-full px-2.5 py-1 text-xs">
                                    <Truck size={10} /> {groupedJobs.in_progress?.length || 0} {t('job_bookings.in_progress')}
                                </span>
                            </div>
                        )}
                    </motion.div>

                    {jobs.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-12 bg-white rounded-2xl shadow-xl border border-gray-100"
                        >
                            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity }} className="text-5xl mb-3">📋</motion.div>
                            <p className="font-bold text-gray-800 text-lg mb-1">{t('job_bookings.no_bookings')}</p>
                            <p className="text-gray-400 text-xs px-4">{t('job_bookings.apply_for_jobs')}</p>
                            <button
                                onClick={() => navigate('/worker/jobs')}
                                className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all touch-manipulation"
                            >
                                <Zap size={14} /> {t('job_bookings.browse_jobs')}
                            </button>
                        </motion.div>
                    ) : (
                        <div className="space-y-3">
                            {/* Section Tabs - Horizontal scroll for mobile */}
                            <div className="overflow-x-auto no-scrollbar -mx-4 px-4" ref={scrollContainerRef}>
                                <div className="flex items-center gap-1.5 min-w-max pb-1">
                                    {sectionMeta.map(section => {
                                        const count = (groupedJobs[section.key] || []).length;
                                        const active = activeSection === section.key;
                                        const Icon = section.icon;
                                        return (
                                            <motion.button
                                                key={section.key}
                                                whileTap={{ scale: 0.96 }}
                                                onClick={() => { setExpanded(null); setActiveSection(section.key); }}
                                                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap touch-manipulation ${
                                                    active
                                                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg'
                                                        : 'bg-white text-gray-600 border-2 border-gray-200 hover:border-orange-300'
                                                }`}
                                            >
                                                <Icon size={12} />
                                                {section.title}
                                                {count > 0 && (
                                                    <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
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
                                    const list = groupedJobs[section.key] || [];

                                    if (list.length === 0) {
                                        return (
                                            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                className="bg-white rounded-2xl border-2 border-gray-100 p-6 text-center shadow-sm"
                                            >
                                                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                                                    <section.icon size={20} className="text-gray-400" />
                                                </div>
                                                <p className="text-gray-500 text-sm font-medium">{section.empty}</p>
                                            </motion.div>
                                        );
                                    }

                                    return (
                                        <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
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