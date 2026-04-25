// client/src/pages/worker/JobBookings.jsx
// IMPROVED: Industry-oriented design with premium UI, consistent with system theme

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getWorkerBookings, workerCancelJob, cancelPendingJobApplication, getImageUrl, getJobDetails } from '../../api/index';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Briefcase, MapPin, Calendar, Clock, IndianRupee, Users,
    Star, Shield, AlertCircle, CheckCircle, XCircle, Truck,
    Phone, Mail, ExternalLink, Navigation, Loader2, Award, 
    TrendingUp, Zap, Gift, Lock, MessageCircle, X, Eye,
    Building2, ThumbsUp, Clock3, CalendarDays, Wallet, 
    FileText, UserCircle, Verified, Home, Route, AlertTriangle
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
const CANCEL_CUTOFF_MINS = 30;

const normSkill = (s) => {
    if (!s) return '';
    if (typeof s === 'string') return s.toLowerCase().trim();
    if (typeof s === 'object') return (s.name || s.skill || '').toLowerCase().trim();
    return String(s).toLowerCase().trim();
};

const formatPaymentMethod = (method) => {
    switch (method) {
        case 'cash': return 'Cash on Completion';
        case 'upi_qr': return 'UPI / QR Code';
        case 'bank_transfer': return 'Bank Transfer';
        default: return 'Flexible Payment';
    }
};

const formatCommuteText = (commute) => {
    if (!commute) return 'Distance unavailable';
    if (!commute.available) return 'Location unavailable';
    const distance = commute.distanceText || `${Number(commute.distanceKm || 0).toFixed(1)} km`;
    const eta = commute.etaText ? `ETA ${commute.etaText}` : '';
    return [distance, eta].filter(Boolean).join(' • ');
};

const getCommuteToneClass = (commute) => {
    if (!commute?.available) return 'text-gray-400';
    if (commute.distanceColor === 'green') return 'text-emerald-600';
    if (commute.distanceColor === 'yellow') return 'text-amber-600';
    return 'text-rose-600';
};

const openGoogleMapsDirections = ({ lat, lng }) => {
    const dLat = Number(lat);
    const dLng = Number(lng);
    if (!Number.isFinite(dLat) || !Number.isFinite(dLng)) {
        toast.error('Job location coordinates are not available.');
        return;
    }

    const openUrl = (originLat, originLng) => {
        let url = `https://www.google.com/maps/dir/?api=1&destination=${dLat},${dLng}&travelmode=driving`;
        if (Number.isFinite(originLat) && Number.isFinite(originLng)) {
            url += `&origin=${originLat},${originLng}`;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
        openUrl();
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (pos) => openUrl(Number(pos.coords.latitude), Number(pos.coords.longitude)),
        () => openUrl(),
        { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
    );
};

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

// ── Status Config with i18n ─────────────────────────────────────────────────────────────
const useStatusConfig = () => {
    const { t } = useTranslation();
    return {
        open:                { label: t('common.open', 'Open for Applications'), color: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: Zap, badge: 'Open' },
        scheduled:           { label: t('common.scheduled', 'Scheduled'), color: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', icon: Calendar, badge: 'Confirmed' },
        running:             { label: t('common.running', 'In Progress'), color: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', icon: Truck, badge: 'Active' },
        completed:           { label: t('common.completed', 'Completed'), color: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle, badge: 'Done' },
        cancelled_by_client: { label: t('common.cancelled', 'Cancelled'), color: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', icon: XCircle, badge: 'Cancelled' },
        cancelled_by_worker: { label: t('job_bookings.cancelled_by_worker', 'Cancelled'), color: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', icon: XCircle, badge: 'Cancelled' },
        cancelled:           { label: t('common.cancelled', 'Cancelled'), color: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', icon: XCircle, badge: 'Cancelled' },
    };
};

function SBadge({ status, size = 'sm' }) {
    const STATUS_CONFIG = useStatusConfig();
    const config = STATUS_CONFIG[status] || { label: status || 'Unknown', bg: 'bg-gray-100', text: 'text-gray-600', icon: AlertCircle, badge: 'Unknown' };
    const Icon = config.icon;
    const sizeClasses = size === 'sm' ? 'text-xs px-2.5 py-1 gap-1' : 'text-sm px-3 py-1.5 gap-1.5';
    return (
        <span className={`inline-flex items-center ${sizeClasses} font-bold rounded-full ${config.bg} ${config.text} shadow-sm border border-current/10`}>
            <Icon size={size === 'sm' ? 12 : 14} />
            <span className="truncate">{config.badge}</span>
        </span>
    );
}

// ── Cancel Confirm Modal ──────────────────────────────────────────────────────
function CancelModal({ job, mySlot, onClose, onCancelled }) {
    const { t } = useTranslation();
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');

    const handle = async () => {
        if (!reason.trim()) { 
            setErr(t('job_bookings.reason_required', 'Please provide a reason for cancellation.')); 
            return; 
        }
        try {
            setLoading(true);
            await workerCancelJob(job._id, reason);
            toast.success(t('job_bookings.cancelled_success', 'Job cancelled successfully.'));
            onCancelled(job._id);
            onClose();
        } catch (e) {
            setErr(e?.response?.data?.message || t('job_bookings.cancel_failed', 'Failed to cancel job.'));
        } finally { 
            setLoading(false); 
        }
    };

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
                className="bg-white w-full sm:rounded-2xl sm:max-w-md rounded-t-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-md">
                        <AlertTriangle size={22} className="text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900">{t('job_bookings.cancel_assignment', 'Cancel Assignment')}</h3>
                        <p className="text-xs text-gray-500">{job?.title || 'Job'}</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
                        <X size={18} className="text-gray-400" />
                    </button>
                </div>

                {mySlot && (
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-3 mb-4">
                        <p className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                            <Award size={12} /> {t('job_bookings.your_role', 'Your Assigned Role')}
                        </p>
                        <p className="text-sm font-bold text-amber-700 capitalize mt-0.5">{mySlot.skill}</p>
                    </div>
                )}

                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5">
                    <div className="flex items-start gap-2">
                        <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-red-700 mb-0.5">⚠️ {t('job_bookings.warning', 'Important Note')}</p>
                            <p className="text-xs text-red-600">{t('job_bookings.cancel_warning', 'Cancelling may affect your reliability score and future job opportunities.')}</p>
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
                    {t('job_bookings.reason_label', 'Cancellation Reason')} <span className="text-red-500">*</span>
                </label>
                <textarea
                    rows={3}
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder={t('job_bookings.reason_placeholder', 'Please explain why you need to cancel (e.g., emergency, scheduling conflict)...')}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 resize-none mb-5"
                />
                <div className="flex gap-3">
                    <button 
                        onClick={onClose} 
                        className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-all active:bg-gray-100"
                    >
                        {t('job_bookings.keep_job', 'Keep Job')}
                    </button>
                    <button
                        onClick={handle}
                        disabled={loading || !reason.trim()}
                        className="flex-1 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-bold disabled:opacity-60 transition-all shadow-md active:scale-95"
                    >
                        {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : t('job_bookings.confirm_cancel', 'Confirm Cancel')}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ── Booking Detail Modal ──────────────────────────────────────────────────────
function BookingDetailModal({ jobId, workerSkills, onClose }) {
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [previewPhoto, setPreviewPhoto] = useState('');

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const { data } = await getJobDetails(jobId);
                if (!active) return;
                setJob(data || null);
            } catch {
                if (!active) return;
                setError('Failed to load job details.');
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [jobId]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-white w-full sm:rounded-2xl shadow-xl sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {loading ? (
                    <div className="p-8 text-center">
                        <Loader2 size="40" className="animate-spin text-orange-500 mx-auto mb-4" />
                        <p className="text-gray-500">Loading job details...</p>
                    </div>
                ) : error || !job ? (
                    <div className="p-8 text-center">
                        <AlertCircle size="48" className="text-red-500 mx-auto mb-4" />
                        <p className="text-gray-600">{error || 'Job not found.'}</p>
                        <button onClick={onClose} className="mt-5 px-5 py-2.5 bg-gray-100 rounded-xl text-sm font-semibold">Close</button>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-5 flex-shrink-0">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Briefcase size="18" className="text-white/80" />
                                        <h2 className="text-white font-bold text-xl leading-tight">{job.title}</h2>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {job.urgent && (
                                            <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                                                <Zap size="10" /> Urgent Hiring
                                            </span>
                                        )}
                                        {job.negotiable && (
                                            <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                                                <Gift size="10" /> Negotiable
                                            </span>
                                        )}
                                        {job.shift && (
                                            <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-bold">
                                                {job.shift.split('(')[0].trim()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button 
                                    onClick={onClose} 
                                    className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all active:scale-95"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
                            {/* Client Info */}
                            {job.postedBy && (
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                                    <div className="flex items-center gap-4">
                                        <img
                                            src={getImageUrl(job.postedBy.photo)}
                                            alt={job.postedBy.name || 'Client'}
                                            className="w-14 h-14 rounded-xl object-cover border-2 border-white shadow-md"
                                            onError={e => { e.target.src = '/admin.png'; }}
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <UserCircle size="16" className="text-blue-600" />
                                                <span className="font-bold text-gray-800">{job.postedBy.name || 'Unknown Client'}</span>
                                                <Verified size="14" className="text-blue-500" />
                                            </div>
                                            {job.postedBy.mobile && (
                                                <a href={`tel:${job.postedBy.mobile}`} className="text-sm text-blue-600 font-medium inline-flex items-center gap-1">
                                                    <Phone size="12" /> {job.postedBy.mobile}
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Job Description */}
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <FileText size="16" className="text-orange-500" />
                                    <h3 className="font-bold text-gray-800">Job Description</h3>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-sm text-gray-700 leading-relaxed">{job.description || job.title}</p>
                                </div>
                            </div>

                            {/* Photos */}
                            {job.photos?.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Eye size="16" className="text-orange-500" />
                                        <h3 className="font-bold text-gray-800">Work Site Photos</h3>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {job.photos.slice(0, 6).map((p, i) => {
                                            const url = getImageUrl(p);
                                            return (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    onClick={() => setPreviewPhoto(url)}
                                                    className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-orange-300 transition-all"
                                                >
                                                    <img
                                                        src={url}
                                                        alt={`Site ${i + 1}`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Available Positions */}
                            {job.openSlotSummary && Object.keys(job.openSlotSummary).length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Users size="16" className="text-orange-500" />
                                        <h3 className="font-bold text-gray-800">Positions Available</h3>
                                    </div>
                                    <div className="space-y-2">
                                        {Object.entries(job.openSlotSummary).map(([skill, count]) => {
                                            const isMatch = workerSkills.includes(normSkill(skill));
                                            return (
                                                <div key={skill} className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-3 border border-orange-100">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-orange-700 capitalize">{skill}</span>
                                                            {isMatch && (
                                                                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                                                                    <Star size="10" /> Your Skill
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-sm bg-orange-500 text-white px-3 py-1 rounded-full font-bold">
                                                            {count} slot{count > 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Payment */}
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Wallet size="16" className="text-orange-500" />
                                    <h3 className="font-bold text-gray-800">Payment Details</h3>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Payment Method</span>
                                        <span className="text-sm font-semibold text-gray-800">{formatPaymentMethod(job.paymentMethod)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Schedule */}
                            {(job.scheduledDate || job.scheduledTime) && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <CalendarDays size="16" className="text-orange-500" />
                                        <h3 className="font-bold text-gray-800">Schedule</h3>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                                        {job.scheduledDate && (
                                            <div className="flex items-center gap-3 text-sm text-gray-700">
                                                <Calendar size="14" className="text-gray-400" />
                                                <span>{new Date(job.scheduledDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                            </div>
                                        )}
                                        {job.scheduledTime && (
                                            <div className="flex items-center gap-3 text-sm text-gray-700">
                                                <Clock size="14" className="text-gray-400" />
                                                <span>{job.scheduledTime}</span>
                                            </div>
                                        )}
                                        {job.shift && (
                                            <div className="flex items-center gap-3 text-sm text-gray-600">
                                                <Clock3 size="14" className="text-gray-400" />
                                                <span>{job.shift}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Location */}
                            {job.location?.city && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Home size="16" className="text-orange-500" />
                                        <h3 className="font-bold text-gray-800">Work Location</h3>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                                        {job.location?.fullAddress && (
                                            <p className="text-sm text-gray-700">{job.location.fullAddress}</p>
                                        )}
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <MapPin size="14" className="text-gray-400" />
                                            <span>{[job.location.locality, job.location.city, job.location.pincode].filter(Boolean).join(', ')}</span>
                                        </div>
                                        {job.location?.buildingName && (
                                            <p className="text-sm text-gray-600"><span className="font-semibold">Building:</span> {job.location.buildingName}</p>
                                        )}
                                        {job.location?.unitNumber && (
                                            <p className="text-sm text-gray-600"><span className="font-semibold">Unit/Flat:</span> {job.location.unitNumber}</p>
                                        )}
                                        <p className={`text-xs font-semibold mt-2 flex items-center gap-1 ${getCommuteToneClass(job?.commute)}`}>
                                            <Route size="12" /> {formatCommuteText(job?.commute)}
                                            {job?.commute?.isLocationStale ? ' • Location may be stale' : ''}
                                        </p>
                                        {Number.isFinite(Number(job.location?.lat)) && Number.isFinite(Number(job.location?.lng)) && (
                                            <button
                                                type="button"
                                                onClick={() => openGoogleMapsDirections({ lat: job.location.lat, lng: job.location.lng })}
                                                className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-xl font-semibold text-sm hover:bg-blue-100 transition-all"
                                            >
                                                <Navigation size="14" /> Get Directions
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Client Answers */}
                            {job.qaAnswers?.filter(q => q.answer).length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <MessageCircle size="16" className="text-orange-500" />
                                        <h3 className="font-bold text-gray-800">Client Requirements</h3>
                                    </div>
                                    <div className="space-y-2">
                                        {job.qaAnswers.filter(q => q.answer).slice(0, 5).map((qa, i) => (
                                            <div key={i} className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                                                <p className="text-xs font-bold text-amber-700 mb-1">Q: {qa.question}</p>
                                                <p className="text-sm text-gray-700">A: {qa.answer}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </motion.div>

            <AnimatePresence>
                {previewPhoto && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
                        onClick={() => setPreviewPhoto('')}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="relative max-w-5xl w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                type="button"
                                onClick={() => setPreviewPhoto('')}
                                className="absolute -top-12 right-0 bg-white/20 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-white/30 transition-colors"
                            >
                                Close ✕
                            </button>
                            <img
                                src={previewPhoto}
                                alt="Work site preview"
                                className="w-full max-h-[85vh] object-contain rounded-xl"
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ── Error Boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
    constructor(props) { 
        super(props); 
        this.state = { hasError: false, error: null }; 
    }
    static getDerivedStateFromError(error) { 
        return { hasError: true, error }; 
    }
    componentDidCatch(error, errorInfo) {
        console.error('JobBookings error:', error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="max-w-3xl mx-auto p-5">
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
                        <AlertCircle size="48" className="text-red-500 mx-auto mb-4" />
                        <h2 className="text-lg font-bold text-red-700 mb-2">Something went wrong</h2>
                        <p className="text-sm text-red-600 mb-5">{this.state.error?.message || 'Unable to load bookings'}</p>
                        <button 
                            onClick={() => window.location.reload()} 
                            className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all"
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

// ── Job Card (Premium Design) ──────────────────────────────────────────────────
function JobCard({ job, workerId, onCancel, onCancelPending, onViewDetails, activeSection, cancellingPending }) {
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
    const pendingApps = myApps.filter((a) => a?.status === 'pending');
    const rejectedApps = myApps.filter((a) => a?.status === 'rejected' && !a?.workerCancelled);
    const cancelledByYouApps = myApps.filter((a) => !!a?.workerCancelled);
    const quotedEntriesFromApps = myApps
        .filter((a) => Number(a?.quotedPrice || 0) > 0)
        .map((a, i) => ({ key: `app-${i}`, amount: Number(a?.quotedPrice || 0), skill: a?.skill || '' }));
    const quotedEntriesFromSlots = mySlots
        .filter((s) => Number(s?.workerQuotedPrice || s?.quotedPrice || 0) > 0)
        .map((s, i) => ({ key: `slot-${i}`, amount: Number(s?.workerQuotedPrice || s?.quotedPrice || 0), skill: s?.skill || '' }));
    const quoteEntryMap = new Map();
    [...quotedEntriesFromApps, ...quotedEntriesFromSlots].forEach((entry) => {
        const dedupeKey = `${entry.skill || 'general'}-${entry.amount}`;
        if (!quoteEntryMap.has(dedupeKey)) quoteEntryMap.set(dedupeKey, entry);
    });
    const myQuotedEntries = Array.from(quoteEntryMap.values());

    const paidEntriesFromSlots = mySlots
        .filter((s) => Number(s?.finalPaidPrice || 0) > 0)
        .map((s, i) => ({ key: `slot-paid-${i}`, amount: Number(s?.finalPaidPrice || 0), skill: s?.skill || '' }));
    const paidEntriesFromPricingMeta = (Array.isArray(job?.pricingMeta?.skillFinalPaid) ? job.pricingMeta.skillFinalPaid : [])
        .filter((row) => {
            const rowWorkerId = String(row?.workerId?._id || row?.workerId || '');
            return rowWorkerId === String(workerId || '') && Number(row?.amount || 0) > 0;
        })
        .map((row, i) => ({ key: `meta-paid-${i}`, amount: Number(row?.amount || 0), skill: row?.skill || '' }));
    const paidEntryMap = new Map();
    [...paidEntriesFromSlots, ...paidEntriesFromPricingMeta].forEach((entry) => {
        const dedupeKey = `${entry.skill || 'general'}-${entry.amount}`;
        if (!paidEntryMap.has(dedupeKey)) paidEntryMap.set(dedupeKey, entry);
    });
    const myPaidEntries = Array.from(paidEntryMap.values());
    const myPaidTotal = myPaidEntries.reduce((sum, entry) => sum + Number(entry?.amount || 0), 0);

    const showApplicationState = activeSection === 'open' && mySlots.length === 0;
    const cancelledByWorker = String(job?.cancelledWorkerId || '') === String(workerId || '');
    const cancelledByClient = ['cancelled', 'cancelled_by_client'].includes(String(job?.status || '').toLowerCase());
    const displayStatus = activeSection === 'cancelled'
        ? (cancelledByWorker ? 'cancelled_by_worker' : (cancelledByClient ? 'cancelled_by_client' : 'cancelled'))
        : job?.status;
    const jobPhoto = job?.photos?.[0] ? getImageUrl(job.photos[0]) : '';
    const cancelInfo = getCancelInfo(job);
    
    // Format date for display
    const formattedDate = job?.scheduledDate 
        ? new Date(job.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        : 'Date TBD';
    
    const formattedPay = job?.payment?.toLocaleString('en-IN') || '0';

    if (!job) return null;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden"
        >
            {/* Card Header with Image */}
            <div className="relative">
                {jobPhoto ? (
                    <>
                        <img
                            src={jobPhoto}
                            alt={job?.title || 'Job'}
                            className="w-full h-36 object-cover"
                            onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement?.querySelector('.no-image')?.classList.remove('hidden');
                            }}
                        />
                        <div className="no-image hidden absolute inset-0 bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
                            <Briefcase size="32" className="text-orange-300" />
                        </div>
                    </>
                ) : (
                    <div className="w-full h-36 bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
                        <Briefcase size="36" className="text-orange-300" />
                    </div>
                )}
                
                {/* Status Badge Overlay */}
                <div className="absolute top-3 left-3">
                    <SBadge status={displayStatus} size="sm" />
                </div>
                
                {/* Payment Badge */}
                <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-full px-2.5 py-1 shadow-md">
                    <span className="text-sm font-bold text-orange-600 flex items-center gap-1">
                        <IndianRupee size="12" /> {formattedPay}
                    </span>
                </div>
            </div>

            {/* Card Content */}
            <div className="p-4">
                {/* Job Title & Client */}
                <div className="mb-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-bold text-gray-800 text-base leading-tight line-clamp-2 flex-1">
                            {job?.title || 'Untitled Job'}
                        </h3>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <UserCircle size="12" className="text-gray-400" />
                        <span className="truncate">{job?.postedBy?.name || 'Unknown Client'}</span>
                    </div>
                </div>

                {/* Quick Info Row */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-3 pb-2 border-b border-gray-100">
                    <span className="flex items-center gap-1">
                        <Calendar size="10" className="text-orange-400" />
                        {formattedDate}
                    </span>
                    {job?.scheduledTime && (
                        <span className="flex items-center gap-1">
                            <Clock size="10" className="text-orange-400" />
                            {job.scheduledTime}
                        </span>
                    )}
                    {job?.location?.city && (
                        <span className="flex items-center gap-1">
                            <MapPin size="10" className="text-orange-400" />
                            {job.location.city}
                        </span>
                    )}
                </div>

                {/* Skills / Tags */}
                {mySlots.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {mySlots.map((s, i) => (
                            <span key={i} className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                s?.status === 'task_completed' ? 'bg-emerald-100 text-emerald-700' :
                                s?.status === 'filled' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                                <Briefcase size="10" /> {s?.skill || 'General'}
                                {s?.status === 'task_completed' && <CheckCircle size="10" />}
                            </span>
                        ))}
                    </div>
                )}

                {/* Application Status Tags */}
                {showApplicationState && (pendingApps.length > 0 || rejectedApps.length > 0 || cancelledByYouApps.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {pendingApps.map((a, i) => (
                            <span key={i} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                <Clock size="10" /> Pending Review
                            </span>
                        ))}
                        {rejectedApps.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                <XCircle size="10" /> Not Selected
                            </span>
                        )}
                        {cancelledByYouApps.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                <X size="10" /> Withdrawn
                            </span>
                        )}
                    </div>
                )}

                {/* Quote & Payment Info */}
                {myQuotedEntries.length > 0 && (
                    <div className="mb-3">
                        {myQuotedEntries.map((entry) => (
                            <span key={`quote-${entry.key}`} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 mr-1.5">
                                <IndianRupee size="10" /> Quoted: ₹{Number(entry.amount).toLocaleString('en-IN')}
                                {entry?.skill && <span className="text-emerald-600">· {entry.skill}</span>}
                            </span>
                        ))}
                    </div>
                )}

                {myPaidEntries.length > 0 && (
                    <div className="mb-3 p-2 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                                <Wallet size="12" /> Total Paid
                            </span>
                            <span className="text-sm font-bold text-blue-800">₹{Number(myPaidTotal || 0).toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                )}

                {/* Commute Info */}
                <div className={`text-xs font-medium mb-3 flex items-center gap-1 ${getCommuteToneClass(job?.commute)}`}>
                    <Route size="12" />
                    <span className="truncate">{formatCommuteText(job?.commute)}</span>
                    {job?.commute?.isLocationStale && <span className="text-gray-400 text-[10px]">• stale</span>}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            if (Number.isFinite(Number(job?.location?.lat)) && Number.isFinite(Number(job?.location?.lng))) {
                                openGoogleMapsDirections({ lat: job.location.lat, lng: job.location.lng });
                            } else {
                                toast.error('Location coordinates not available');
                            }
                        }}
                        disabled={!(Number.isFinite(Number(job?.location?.lat)) && Number.isFinite(Number(job?.location?.lng)))}
                        className="flex items-center justify-center gap-1.5 text-xs px-2 py-2 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Navigation size="12" /> Map
                    </button>
                    <button
                        type="button"
                        onClick={() => onViewDetails(job._id)}
                        className="flex items-center justify-center gap-1.5 text-xs px-2 py-2 border border-orange-200 text-orange-600 rounded-lg hover:bg-orange-50 font-semibold transition-all"
                    >
                        <Eye size="12" /> Details
                    </button>
                    <button
                        type="button"
                        className="flex items-center justify-center gap-1.5 text-xs px-2 py-2 bg-gray-100 text-gray-600 rounded-lg font-semibold cursor-default"
                    >
                        <Briefcase size="12" /> Status
                    </button>
                </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="border-t border-gray-100 p-3 bg-gray-50/50">
                {showApplicationState && pendingApps.length > 0 && (
                    <button
                        type="button"
                        onClick={() => onCancelPending(job)}
                        disabled={!!cancellingPending}
                        className="w-full py-2.5 border border-red-200 bg-white text-red-600 rounded-xl font-semibold text-sm hover:bg-red-50 disabled:opacity-60 transition-all"
                    >
                        {cancellingPending ? (
                            <Loader2 size="14" className="animate-spin mx-auto" />
                        ) : (
                            'Withdraw Application'
                        )}
                    </button>
                )}

                {cancelInfo.show && cancelInfo.allowed && (
                    <button
                        type="button"
                        onClick={() => onCancel({ job, mySlot: myPrimary })}
                        className="w-full py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold text-sm hover:shadow-md transition-all active:scale-95"
                    >
                        Cancel Assignment
                    </button>
                )}
            </div>
        </motion.div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function JobBookings() {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [cancelData, setCancelData] = useState(null);
    const [detailId, setDetailId] = useState(null);
    const [activeSection, setActiveSection] = useState('running');
    const [error, setError] = useState(null);
    const [cancellingPendingByJob, setCancellingPendingByJob] = useState({});

    const workerData = JSON.parse(localStorage.getItem('user') || '{}');
    const workerId = String(workerData._id || workerData.id || '');
    const workerSkills = (workerData.skills || []).map(normSkill).filter(Boolean);

    const loadBookings = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const { data } = await getWorkerBookings();
            setJobs(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err?.response?.data?.message || t('job_bookings.failed_load', 'Failed to load bookings.'));
            toast.error(t('job_bookings.failed_load', 'Failed to load bookings.'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => { 
        loadBookings(); 
    }, [loadBookings]);

    const getBookingSection = useCallback((job) => {
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
            const cancelledByWorkerAfterAssignment = String(job.cancelledWorkerId || '') === String(wid);

            if (['cancelled_by_client', 'cancelled'].includes(job.status) && (isAssignedToMe || myApps.length > 0)) return 'cancelled';
            if (cancelledByWorkerAfterAssignment) return 'cancelled';
            if (job.status === 'completed') return 'completed';
            if (mySlots.length > 0 && mySlots.every(s => s?.status === 'task_completed')) return 'completed';
            if (job.status === 'running') return 'running';
            if (mySlots.some(s => ['filled', 'running'].includes(s?.status))) return 'in_progress';
            if (job.status === 'scheduled' && (mySlots.length > 0 || inAssignedTo)) return 'in_progress';
            if (!isAssignedToMe && myApps.some(a => a?.status === 'pending')) return 'open';
            if (!isAssignedToMe && myApps.some(a => a?.status === 'rejected')) return 'open';
            if (!isAssignedToMe && myApps.some(a => a?.workerCancelled)) return 'open';
            if (myApps.some(a => a?.status === 'accepted')) return 'in_progress';
            if (!isAssignedToMe && job.status === 'open' && myApps.length > 0) return 'open';
            if (job.status === 'scheduled' && myApps.length === 0 && !isAssignedToMe) return 'open';
            return 'others';
        } catch { 
            return 'others'; 
        }
    }, [workerId]);

    const groupedJobs = useMemo(() => {
        return jobs.reduce((acc, job) => {
            try {
                const section = getBookingSection(job);
                if (!acc[section]) acc[section] = [];
                acc[section].push(job);
            } catch {
                if (!acc.others) acc.others = [];
                acc.others.push(job);
            }
            return acc;
        }, { running: [], in_progress: [], open: [], completed: [], cancelled: [], others: [] });
    }, [jobs, getBookingSection]);

    // Section metadata with enhanced icons
    const sectionMeta = [
        { key: 'running', title: 'Active Jobs', icon: Truck, color: 'amber', count: groupedJobs.running?.length || 0, gradient: 'from-amber-500 to-orange-500' },
        { key: 'in_progress', title: 'Upcoming', icon: Calendar, color: 'blue', count: groupedJobs.in_progress?.length || 0, gradient: 'from-blue-500 to-indigo-500' },
        { key: 'open', title: 'Applications', icon: FileText, color: 'emerald', count: groupedJobs.open?.length || 0, gradient: 'from-emerald-500 to-teal-500' },
        { key: 'completed', title: 'Completed', icon: CheckCircle, color: 'green', count: groupedJobs.completed?.length || 0, gradient: 'from-green-500 to-emerald-500' },
        { key: 'cancelled', title: 'Cancelled', icon: XCircle, color: 'red', count: groupedJobs.cancelled?.length || 0, gradient: 'from-red-500 to-rose-500' },
    ];

    const handleCancelPendingApplication = useCallback(async (job) => {
        if (!job?._id) return;
        try {
            setCancellingPendingByJob((prev) => ({ ...prev, [job._id]: true }));
            const { data } = await cancelPendingJobApplication(job._id);
            toast.success(data?.message || 'Application withdrawn successfully.');
            await loadBookings();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to withdraw application.');
        } finally {
            setCancellingPendingByJob((prev) => ({ ...prev, [job._id]: false }));
        }
    }, [loadBookings]);

    const handleCancelled = useCallback(async () => { 
        await loadBookings(); 
    }, [loadBookings]);

    const scrollContainerRef = useRef(null);

    // Calculate KPI metrics
    const totalEarnings = useMemo(() => {
        return jobs.reduce((total, job) => {
            const allSlots = job.mySlots || job.workerSlots || [];
            const mySlots = allSlots.filter(s => {
                const assignedId = s?.assignedWorker?._id?.toString() || s?.assignedWorker?.toString() || '';
                return assignedId === workerId;
            });
            const paidAmount = mySlots.reduce((sum, slot) => sum + Number(slot?.finalPaidPrice || 0), 0);
            return total + paidAmount;
        }, 0);
    }, [jobs, workerId]);

    const activeJobsCount = (groupedJobs.running?.length || 0) + (groupedJobs.in_progress?.length || 0);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/20 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 size="48" className="animate-spin text-orange-500 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">Loading your bookings...</p>
                </div>
            </div>
        );
    }

    if (error && jobs.length === 0) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/20 flex items-center justify-center p-5">
                <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md shadow-xl">
                    <AlertCircle size="48" className="text-red-500 mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-gray-800 mb-2">Unable to Load Bookings</h2>
                    <p className="text-sm text-gray-500 mb-5">{error}</p>
                    <button 
                        onClick={loadBookings} 
                        className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 pb-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-8">
                    
                    {/* Hero Header */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6"
                    >
                        <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-xl">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                        <Briefcase size="24" className="text-white" />
                                    </div>
                                    <div>
                                        <h1 className="text-2xl font-black">My Work Dashboard</h1>
                                        <p className="text-white/90 text-sm mt-0.5">Track and manage your job assignments</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <div className="bg-white/15 rounded-xl px-4 py-2 text-center">
                                        <p className="text-2xl font-bold">{activeJobsCount}</p>
                                        <p className="text-xs text-white/80">Active Jobs</p>
                                    </div>
                                    <div className="bg-white/15 rounded-xl px-4 py-2 text-center">
                                        <p className="text-2xl font-bold">₹{totalEarnings.toLocaleString('en-IN')}</p>
                                        <p className="text-xs text-white/80">Total Earned</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {jobs.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center"
                        >
                            <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Briefcase size="36" className="text-orange-400" />
                            </div>
                            <h3 className="font-bold text-gray-800 text-xl mb-2">No Bookings Yet</h3>
                            <p className="text-gray-400 text-sm mb-5">Apply for jobs to get started with earning</p>
                            <button
                                onClick={() => navigate('/worker/jobs')}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
                            >
                                <Zap size="16" /> Browse Available Jobs
                            </button>
                        </motion.div>
                    ) : (
                        <>
                            {/* Section Tabs */}
                            <div className="overflow-x-auto no-scrollbar mb-6 -mx-4 px-4" ref={scrollContainerRef}>
                                <div className="flex items-center gap-2 min-w-max pb-1">
                                    {sectionMeta.map(section => {
                                        const active = activeSection === section.key;
                                        const Icon = section.icon;
                                        const count = section.count;
                                        return (
                                            <motion.button
                                                key={section.key}
                                                whileTap={{ scale: 0.96 }}
                                                onClick={() => setActiveSection(section.key)}
                                                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                                                    active
                                                        ? `bg-gradient-to-r ${section.gradient} text-white shadow-md`
                                                        : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-200 hover:text-orange-600'
                                                }`}
                                            >
                                                <Icon size="16" />
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

                            {/* KPI Summary Row - Dynamic */}
                            {activeSection === 'running' && groupedJobs.running?.length > 0 && (
                                <div className="mb-5 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Truck size="18" className="text-amber-600" />
                                        <h3 className="font-bold text-amber-800">Active Assignments</h3>
                                    </div>
                                    <p className="text-sm text-amber-700">You have {groupedJobs.running.length} job{groupedJobs.running.length > 1 ? 's' : ''} in progress. Stay on track to complete on time.</p>
                                </div>
                            )}

                            {/* Job Cards Grid */}
                            <AnimatePresence mode="wait">
                                {(() => {
                                    const activeSectionData = sectionMeta.find(s => s.key === activeSection);
                                    const list = groupedJobs[activeSection] || [];

                                    if (list.length === 0) {
                                        return (
                                            <motion.div 
                                                key="empty" 
                                                initial={{ opacity: 0 }} 
                                                animate={{ opacity: 1 }} 
                                                exit={{ opacity: 0 }}
                                                className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm"
                                            >
                                                <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                                                    {activeSectionData?.icon && <activeSectionData.icon size="28" className="text-gray-400" />}
                                                </div>
                                                <p className="text-gray-500 font-medium">No {activeSectionData?.title?.toLowerCase()} jobs found</p>
                                                {activeSection === 'open' && (
                                                    <button
                                                        onClick={() => navigate('/worker/jobs')}
                                                        className="mt-4 inline-flex items-center gap-1.5 text-sm text-orange-500 font-semibold hover:text-orange-600"
                                                    >
                                                        Browse available jobs →
                                                    </button>
                                                )}
                                            </motion.div>
                                        );
                                    }

                                    return (
                                        <motion.div 
                                            key="list" 
                                            initial={{ opacity: 0 }} 
                                            animate={{ opacity: 1 }} 
                                            exit={{ opacity: 0 }} 
                                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
                                        >
                                            {list.map(job => (
                                                <JobCard
                                                    key={job._id}
                                                    job={job}
                                                    workerId={workerId}
                                                    onCancel={setCancelData}
                                                    onCancelPending={handleCancelPendingApplication}
                                                    onViewDetails={setDetailId}
                                                    activeSection={activeSection}
                                                    cancellingPending={!!cancellingPendingByJob[job._id]}
                                                />
                                            ))}
                                        </motion.div>
                                    );
                                })()}
                            </AnimatePresence>
                        </>
                    )}
                </div>

                {/* Modals */}
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

                <AnimatePresence>
                    {detailId && (
                        <BookingDetailModal
                            jobId={detailId}
                            workerSkills={workerSkills}
                            onClose={() => setDetailId(null)}
                        />
                    )}
                </AnimatePresence>
            </div>
        </ErrorBoundary>
    );
}