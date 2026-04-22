// client/src/pages/worker/JobBookings.jsx
// FIXED: i18n translation issues, mobile optimization, and component bugs

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getWorkerBookings, workerCancelJob, cancelPendingJobApplication, getImageUrl, getJobDetails } from '../../api/index';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Briefcase, MapPin, Calendar, Clock, IndianRupee, Users,
    Star, Shield, AlertCircle, CheckCircle, XCircle, Truck,
    Phone, Mail, ExternalLink,
    Navigation, Loader2, Award, TrendingUp, Zap, Gift, Lock, MessageCircle, X, Eye
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
        case 'cash': return 'Cash';
        case 'upi_qr': return 'Online UPI / QR';
        case 'bank_transfer': return 'Direct Bank Account';
        default: return 'Flexible (Any)';
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
    if (!commute?.available) return 'text-gray-500';
    if (commute.distanceColor === 'green') return 'text-emerald-700';
    if (commute.distanceColor === 'yellow') return 'text-amber-700';
    return 'text-rose-700';
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
        open:                { label: t('common.open', 'Open'),      color: 'bg-green-500', bg: 'bg-green-50',  text: 'text-green-700',  icon: Zap },
        scheduled:           { label: t('common.scheduled', 'Scheduled'), color: 'bg-blue-500',  bg: 'bg-blue-50',   text: 'text-blue-700',   icon: Calendar },
        running:             { label: t('common.running', 'Running'),   color: 'bg-yellow-500',bg: 'bg-yellow-50', text: 'text-yellow-700', icon: Truck },
        completed:           { label: t('common.completed', 'Completed'), color: 'bg-emerald-500',bg:'bg-emerald-50',text: 'text-emerald-700',icon: CheckCircle },
        cancelled_by_client: { label: t('common.cancelled', 'Cancelled'), color: 'bg-red-500',   bg: 'bg-red-50',    text: 'text-red-700',    icon: XCircle },
        cancelled_by_worker: { label: t('job_bookings.cancelled_by_worker', 'Cancelled by Worker'), color: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', icon: XCircle },
        cancelled:           { label: t('common.cancelled', 'Cancelled'), color: 'bg-red-500',   bg: 'bg-red-50',    text: 'text-red-700',    icon: XCircle },
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
                        <h3 className="text-lg font-black text-gray-900">{t('job_bookings.cancel_assignment', 'Cancel Assignment')}</h3>
                        <p className="text-xs text-gray-500 truncate">{job?.title || 'Job'}</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                        <X size={18} className="text-gray-400" />
                    </button>
                </div>

                {mySlot && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4">
                        <p className="text-xs text-orange-600 font-semibold">{t('job_bookings.your_role', 'Your Role')}</p>
                        <p className="text-sm font-bold text-orange-700 capitalize">{mySlot.skill}</p>
                    </div>
                )}

                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 mb-4">
                    <div className="flex items-start gap-2">
                        <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-red-700 mb-0.5">⚠️ {t('job_bookings.warning', 'Warning')}</p>
                            <p className="text-xs text-red-600">{t('job_bookings.cancel_warning', 'Cancelling may affect your reliability score.')}</p>
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
                    placeholder={t('job_bookings.reason_placeholder', 'Please explain why you need to cancel...')}
                    className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50 resize-none mb-4"
                />
                <div className="flex gap-3 sticky bottom-0 bg-white pt-2 pb-1">
                    <button 
                        onClick={onClose} 
                        className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-all active:bg-gray-100"
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
                className="bg-white w-full sm:rounded-3xl shadow-2xl sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {loading ? (
                    <div className="p-6 text-center">
                        <Loader2 size={32} className="animate-spin text-orange-500 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">Loading job details...</p>
                    </div>
                ) : error || !job ? (
                    <div className="p-6 text-center">
                        <AlertCircle size={42} className="text-red-500 mx-auto mb-3" />
                        <p className="text-gray-600 text-sm">{error || 'Job not found.'}</p>
                        <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-100 rounded-xl text-sm">Close</button>
                    </div>
                ) : (
                    <>
                        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-4 sm:px-6 py-4 sm:py-5 flex-shrink-0">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-white font-black text-lg sm:text-xl leading-tight line-clamp-2">{job.title}</h2>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {job.urgent && (
                                            <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                                                <Zap size={10} /> Urgent
                                            </span>
                                        )}
                                        {job.negotiable && (
                                            <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                                                <Gift size={10} /> Negotiable
                                            </span>
                                        )}
                                        {job.shift && (
                                            <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-bold">
                                                {job.shift.split('(')[0].trim()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white flex-shrink-0 active:scale-95">
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">
                            {job.postedBy && (
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4">
                                    <div className="flex items-start gap-3 sm:gap-4">
                                        <img
                                            src={getImageUrl(job.postedBy.photo)}
                                            alt={job.postedBy.name || 'Client'}
                                            className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover border-2 border-white shadow-md flex-shrink-0"
                                            onError={e => { e.target.src = '/admin.png'; }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <span className="font-bold text-gray-900 text-base sm:text-lg truncate block">{job.postedBy.name || 'Unknown Client'}</span>
                                            {job.postedBy.mobile && (
                                                <a href={`tel:${job.postedBy.mobile}`} className="text-sm text-blue-600 font-semibold mt-1 inline-flex items-center gap-1 break-all">
                                                    <Phone size={12} /> {job.postedBy.mobile}
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className={`gap-4 ${job.photos?.length > 0 ? 'lg:flex lg:items-start' : ''}`}>
                                <div className={job.photos?.length > 0 ? 'lg:flex-1' : ''}>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <Briefcase size={12} /> About the Job
                                    </p>
                                    <div className="bg-gray-50 rounded-2xl p-4">
                                        <p className="text-sm text-gray-700 leading-relaxed break-words">{job.description || job.title}</p>
                                    </div>
                                </div>

                                {job.photos?.length > 0 && (
                                    <div className="mt-3 lg:mt-0 lg:w-56 xl:w-64">
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Work Area Photos</p>
                                        <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                                            {job.photos.slice(0, 6).map((p, i) => {
                                                const url = getImageUrl(p);
                                                return (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        onClick={() => setPreviewPhoto(url)}
                                                        className="group block w-full text-left"
                                                    >
                                                        <img
                                                            src={url}
                                                            alt={`Work area ${i + 1}`}
                                                            className="w-full aspect-square object-cover rounded-xl border border-gray-200 group-hover:border-orange-300 transition-colors"
                                                        />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {job.openSlotSummary && Object.keys(job.openSlotSummary).length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <Users size={12} /> Positions Available
                                    </p>
                                    <div className="space-y-2">
                                        {Object.entries(job.openSlotSummary).map(([skill, count]) => {
                                            const isMatch = workerSkills.includes(normSkill(skill));
                                            return (
                                                <div key={skill} className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-3">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="font-bold text-orange-700 capitalize text-sm">{skill}</span>
                                                            {isMatch && (
                                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                                                    <Star size={10} /> Your skill
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-xs bg-orange-500 text-white px-2.5 py-1 rounded-full font-bold">
                                                            {count} slot{count > 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <IndianRupee size={12} /> Payment Terms
                                </p>
                                <div className="bg-gray-50 rounded-2xl p-3 space-y-1.5">
                                    <p className="text-sm text-gray-700 break-words">
                                        <span className="font-semibold">Method:</span> {formatPaymentMethod(job.paymentMethod)}
                                    </p>
                                </div>
                            </div>

                            {(job.scheduledDate || job.scheduledTime) && (
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <Calendar size={12} /> Schedule
                                    </p>
                                    <div className="bg-gray-50 rounded-2xl p-3 space-y-1">
                                        {job.scheduledDate && (
                                            <p className="text-sm text-gray-700 flex items-center gap-2 break-words">
                                                <Calendar size={14} className="flex-shrink-0" />
                                                {new Date(job.scheduledDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                            </p>
                                        )}
                                        {job.scheduledTime && <p className="text-sm text-gray-700 break-words">🕐 {job.scheduledTime}</p>}
                                        {job.shift && <p className="text-sm text-gray-600 break-words">{job.shift}</p>}
                                    </div>
                                </div>
                            )}

                            {job.location?.city && (
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <MapPin size={12} /> Location
                                    </p>
                                    <div className="bg-gray-50 rounded-2xl p-3">
                                        {job.location?.fullAddress && (
                                            <p className="text-sm text-gray-700 break-words mb-1.5">{job.location.fullAddress}</p>
                                        )}
                                        <p className="text-sm text-gray-600 flex items-center gap-2 flex-wrap">
                                            <MapPin size={14} />
                                            {[job.location.locality, job.location.city, job.location.pincode].filter(Boolean).join(', ')}
                                        </p>
                                        {job.location?.buildingName && (
                                            <p className="text-sm text-gray-700 break-words mt-1">
                                                <span className="font-semibold">Building/Home:</span> {job.location.buildingName}
                                            </p>
                                        )}
                                        {job.location?.unitNumber && (
                                            <p className="text-sm text-gray-700 break-words mt-1">
                                                <span className="font-semibold">Flat/Home No.:</span> {job.location.unitNumber}
                                            </p>
                                        )}
                                        {job.location?.floorNumber && (
                                            <p className="text-sm text-gray-700 break-words mt-1">
                                                <span className="font-semibold">Floor:</span> {job.location.floorNumber}
                                            </p>
                                        )}
                                        <p className={`text-xs font-semibold mt-2 ${getCommuteToneClass(job?.commute)}`}>
                                            {formatCommuteText(job?.commute)}
                                            {job?.commute?.isLocationStale ? ' • stale location' : ''}
                                        </p>
                                    </div>
                                    {Number.isFinite(Number(job.location?.lat)) && Number.isFinite(Number(job.location?.lng)) && (
                                        <button
                                            type="button"
                                            onClick={() => openGoogleMapsDirections({ lat: job.location.lat, lng: job.location.lng })}
                                            className="mt-2 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-semibold text-sm hover:bg-blue-100 transition-all"
                                        >
                                            <Navigation size={14} /> View Location In Google Maps
                                        </button>
                                    )}
                                </div>
                            )}

                            {job.qaAnswers?.filter(q => q.answer).length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <MessageCircle size={12} /> Client's Answers
                                    </p>
                                    <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
                                        {job.qaAnswers.filter(q => q.answer).slice(0, 5).map((qa, i) => (
                                            <div key={i} className="p-3 sm:p-4 border-b border-amber-100 last:border-0">
                                                <p className="text-xs font-bold text-amber-700 mb-1 break-words">Q: {qa.question}</p>
                                                <p className="text-sm text-gray-800 break-words">A: {qa.answer}</p>
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
                        className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
                        onClick={() => setPreviewPhoto('')}
                    >
                        <motion.div
                            initial={{ scale: 0.94, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.94, opacity: 0 }}
                            className="relative max-w-5xl w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                type="button"
                                onClick={() => setPreviewPhoto('')}
                                className="absolute -top-3 -right-3 bg-white text-gray-700 rounded-full px-3 py-1.5 text-xs font-bold shadow"
                            >
                                Close
                            </button>
                            <img
                                src={previewPhoto}
                                alt="Work area preview"
                                className="w-full max-h-[85vh] object-contain rounded-xl border border-white/20"
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
                <div className="max-w-3xl mx-auto p-4">
                    <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 text-center">
                        <AlertCircle size={40} className="text-red-500 mx-auto mb-3" />
                        <h2 className="text-base font-bold text-red-700 mb-2">Something went wrong</h2>
                        <p className="text-sm text-red-600 mb-4">{this.state.error?.message || 'Unable to load bookings'}</p>
                        <button 
                            onClick={() => window.location.reload()} 
                            className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors"
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

// ── Job Card (Mobile Optimized) ──────────────────────────────────────────────────
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

    if (!job) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            whileHover={{ y: -2 }}
            className="bg-white rounded-2xl border-2 border-gray-100 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden h-full flex flex-col"
        >
            {jobPhoto && (
                <div className="relative h-32 border-b border-gray-100 overflow-hidden">
                    <img
                        src={jobPhoto}
                        alt={job?.title || 'Job'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            e.target.style.display = 'none';
                        }}
                    />
                </div>
            )}

            <div className="flex items-start gap-3 p-4">
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
                            <SBadge status={displayStatus} />
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

                    {/* Application tags */}
                    {showApplicationState && (pendingApps.length > 0 || rejectedApps.length > 0 || cancelledByYouApps.length > 0) && (
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                            {pendingApps.map((a, i) => (
                                <span key={i} className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                    <Clock size={10} /> Applied
                                </span>
                            ))}
                            {rejectedApps.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                    <XCircle size={10} /> Rejected
                                </span>
                            )}
                            {cancelledByYouApps.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                    <X size={10} /> Cancelled by You
                                </span>
                            )}
                            {rejectedApps.length > 0 && rejectedApps[0]?.feedback && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                    Reason: {String(rejectedApps[0].feedback)}
                                </span>
                            )}
                        </div>
                    )}

                    {myQuotedEntries.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                            {myQuotedEntries.map((entry) => (
                                <span key={`quote-${entry.key}`} className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <IndianRupee size={10} /> Quoted: {Number(entry.amount).toLocaleString('en-IN')}{entry?.skill ? ` · ${entry.skill}` : ''}
                                </span>
                            ))}
                        </div>
                    )}

                    {myPaidEntries.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                            <span className="inline-flex items-center gap-1 text-xs font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                <IndianRupee size={10} /> Paid: {Number(myPaidTotal || 0).toLocaleString('en-IN')}
                            </span>
                            {myPaidEntries.map((entry) => (
                                <span key={`paid-${entry.key}`} className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    <IndianRupee size={10} /> {Number(entry.amount).toLocaleString('en-IN')}{entry?.skill ? ` · ${entry.skill}` : ''}
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1 font-bold text-green-600">
                            <IndianRupee size={11} /> {job?.payment?.toLocaleString() || '0'}
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

                    <p className={`mt-2 text-xs font-semibold ${getCommuteToneClass(job?.commute)}`}>
                        {formatCommuteText(job?.commute)}
                        {job?.commute?.isLocationStale ? ' • stale location' : ''}
                    </p>

                    <div className="grid grid-cols-3 gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            onClick={() => {
                                if (Number.isFinite(Number(job?.location?.lat)) && Number.isFinite(Number(job?.location?.lng))) {
                                    openGoogleMapsDirections({ lat: job.location.lat, lng: job.location.lng });
                                }
                            }}
                            className="text-xs px-2 py-2 border-2 border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 font-bold disabled:opacity-60"
                            disabled={!(Number.isFinite(Number(job?.location?.lat)) && Number.isFinite(Number(job?.location?.lng)))}
                        >
                            Maps
                        </button>
                        <button
                            type="button"
                            onClick={() => onViewDetails(job._id)}
                            className="text-xs px-2 py-2 border-2 border-orange-200 text-orange-600 rounded-lg hover:bg-orange-50 font-bold"
                        >
                            Details
                        </button>
                        <div className="text-xs px-2 py-2 rounded-lg font-bold bg-gray-100 text-gray-500 text-center">Status</div>
                    </div>
                </div>
            </div>

            <div className="border-t border-gray-100 p-3 space-y-2">
                {showApplicationState && pendingApps.length > 0 && (
                    <button
                        type="button"
                        onClick={() => onCancelPending(job)}
                        disabled={!!cancellingPending}
                        className="w-full py-2 border-2 border-red-200 bg-white text-red-600 rounded-xl font-bold text-xs hover:bg-red-50 disabled:opacity-60"
                    >
                        {cancellingPending ? 'Cancelling Application...' : 'Cancel Application'}
                    </button>
                )}

                {cancelInfo.show && cancelInfo.allowed && (
                    <button
                        type="button"
                        onClick={() => onCancel({ job, mySlot: myPrimary })}
                        className="w-full py-2 border-2 border-red-200 bg-white text-red-500 rounded-xl font-bold text-xs hover:bg-red-50"
                    >
                        {t('job_bookings.cancel_assignment', 'Cancel Assignment')}
                    </button>
                )}
            </div>
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
    const [detailId, setDetailId] = useState(null);
    const [activeSection, setActiveSection] = useState('in_progress');
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
            if (job.status === 'running') return 'in_progress';
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
                // Separate 'running' jobs
                if (job.status === 'running') {
                    if (!acc.running) acc.running = [];
                    acc.running.push(job);
                } else if (section === 'completed') {
                    // Exclude running jobs from completed
                    if (!acc.completed) acc.completed = [];
                    acc.completed.push(job);
                } else {
                    if (!acc[section]) acc[section] = [];
                    acc[section].push(job);
                }
            } catch {
                if (!acc.others) acc.others = [];
                acc.others.push(job);
            }
            return acc;
        }, { open: [], running: [], in_progress: [], completed: [], cancelled: [], others: [] });
    }, [jobs, getBookingSection]);

    // Section metadata with translations
    const sectionMeta = [
        { key: 'running',     title: t('job_bookings.sections.running', 'Running'),     icon: Truck,        color: 'yellow', empty: t('job_bookings.empty.running', 'No running jobs') },
        { key: 'in_progress', title: t('job_bookings.sections.in_progress', 'In Progress'), icon: Zap,          color: 'orange', empty: t('job_bookings.empty.in_progress', 'No jobs in progress') },
        { key: 'open',        title: 'Applied and Rejected',        icon: Award,         color: 'green',  empty: 'No applied or rejected jobs' },
        { key: 'completed',   title: t('job_bookings.sections.completed', 'Completed'),   icon: CheckCircle,  color: 'emerald',empty: t('job_bookings.empty.completed', 'No completed jobs') },
        { key: 'cancelled',   title: t('job_bookings.sections.cancelled', 'Cancelled'),   icon: XCircle,      color: 'red',    empty: t('job_bookings.empty.cancelled', 'No cancelled jobs') },
        { key: 'others',      title: t('job_bookings.sections.others', 'Others'),      icon: AlertCircle,  color: 'gray',   empty: t('job_bookings.empty.others', 'No other jobs') },
    ];

    const handleCancelPendingApplication = useCallback(async (job) => {
        if (!job?._id) return;
        try {
            setCancellingPendingByJob((prev) => ({ ...prev, [job._id]: true }));
            const { data } = await cancelPendingJobApplication(job._id);
            toast.success(data?.message || 'Application cancelled.');
            await loadBookings();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to cancel application.');
        } finally {
            setCancellingPendingByJob((prev) => ({ ...prev, [job._id]: false }));
        }
    }, [loadBookings]);

    const handleCancelled = useCallback(async () => { 
        await loadBookings(); 
    }, [loadBookings]);

    // Mobile touch scroll for section tabs
    const scrollContainerRef = useRef(null);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
                <motion.div 
                    animate={{ rotate: 360 }} 
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }} 
                    className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full"
                />
                <p className="mt-4 text-gray-500 font-semibold text-sm">{t('job_bookings.loading', 'Loading your bookings...')}</p>
            </div>
        );
    }

    if (error && jobs.length === 0) {
        return (
            <div className="max-w-5xl mx-auto p-4" style={{ fontFamily: 'Inter, sans-serif', fontSize: '4.13rem' }}>
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 text-center">
                    <AlertCircle size={40} className="text-red-500 mx-auto mb-3" />
                    <h2 className="text-base font-bold text-red-700 mb-2">Error Loading Bookings</h2>
                    <p className="text-sm text-red-600 mb-4">{error}</p>
                    <button 
                        onClick={loadBookings} 
                        className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/20 pb-20">
                <div className="max-w-5xl mx-auto px-4 pt-4 md:pt-8 space-y-4" style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.13rem' }}>

                    {/* Header - Mobile optimized */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        data-guide-id="worker-page-job-bookings"
                        className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-4 text-white shadow-xl"
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                                <Briefcase size={20} className="text-white" />
                            </div>
                            <div className="flex-1">
                                <h1 className="text-xl font-black">{t('job_bookings.title', 'My Bookings')}</h1>
                                <p className="text-white/90 text-xs mt-0.5">{t('job_bookings.subtitle', 'Track and manage your job assignments')}</p>
                            </div>
                        </div>
                        {jobs.length > 0 && (
                            <div className="flex gap-2 mt-2">
                                <span className="flex items-center gap-1 bg-white/20 rounded-full px-2.5 py-1 text-xs">
                                    <Briefcase size={10} /> {jobs.length} {t('job_bookings.total_jobs', 'Total Jobs')}
                                </span>
                                <span className="flex items-center gap-1 bg-white/20 rounded-full px-2.5 py-1 text-xs">
                                    <Truck size={10} /> {groupedJobs.in_progress?.length || 0} {t('job_bookings.in_progress', 'In Progress')}
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
                            <p className="font-bold text-gray-800 text-lg mb-1">{t('job_bookings.no_bookings', 'No Bookings Yet')}</p>
                            <p className="text-gray-400 text-xs px-4">{t('job_bookings.apply_for_jobs', 'Apply for jobs to get started')}</p>
                            <button
                                onClick={() => navigate('/worker/jobs')}
                                className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all touch-manipulation"
                            >
                                <Zap size={14} /> {t('job_bookings.browse_jobs', 'Browse Jobs')}
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
                                                onClick={() => setActiveSection(section.key)}
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
                                        <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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