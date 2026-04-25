import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getClientJobs,
    getImageUrl,
    permanentlyDeleteHistoryJob,
    permanentlyDeleteSelectedHistoryJobs,
    permanentlyDeleteAllHistoryJobs,
} from '../../api/index';
import {
    Calendar,
    Clock,
    MapPin,
    Users,
    Briefcase,
    IndianRupee,
    CheckCircle,
    XCircle,
    Eye,
    Star,
    Phone,
    X,
    Trash2,
    Search,
    Filter,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    Award,
    TrendingUp,
    DollarSign,
    RefreshCw,
    Shield,
    Crown,
    Zap,
    Gift,
    Heart,
    MessageCircle,
    ThumbsUp,
    Clock as ClockIcon,
    Calendar as CalendarIcon,
    FileText,
    Image,
    Camera,
    User,
    Verified,
    Building,
    Home,
    Locate,
    Upload,
    Copy,
    ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { openWorkerProfilePreview } from '../../utils/workerProfilePreview';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const fmtINR = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n || 0));
const normalizeText = (value) => String(value || '').trim().toLowerCase();
const JOB_POST_DRAFT_KEY = 'client_job_post_draft_v1';
const HISTORY_FILTERS = [
    { key: 'all', label: 'All', icon: Briefcase },
    { key: 'completed', label: 'Completed', icon: CheckCircle },
    { key: 'deleted', label: 'Deleted', icon: XCircle },
    { key: 'cancelled', label: 'Cancelled', icon: XCircle },
    { key: 'other', label: 'Other', icon: AlertCircle },
];

const HISTORY_AMOUNT_FILTERS = [
    { key: 'all', label: 'All Amounts' },
    { key: '0-1000', label: 'Up to ₹1,000' },
    { key: '1000-5000', label: '₹1,000 - ₹5,000' },
    { key: '5000-10000', label: '₹5,000 - ₹10,000' },
    { key: '10000+', label: '₹10,000+' },
];

const HISTORY_DATE_FILTERS = [
    { key: 'all', label: 'Any Date' },
    { key: '7d', label: 'Last 7 Days' },
    { key: '30d', label: 'Last 30 Days' },
    { key: '90d', label: 'Last 90 Days' },
];

const getHistoryType = (job) => {
    if (job?.archivedByClient) return 'deleted';
    if (job?.status === 'completed') return 'completed';
    if (['cancelled', 'cancelled_by_client'].includes(job?.status)) return 'cancelled';
    return 'other';
};

const isAutoCancelledJob = (job) => (
    Boolean(job?.isAutoCancelledOrDeleted) || (() => {
        const reason = normalizeText(job?.cancellationReason);
        const autoByReason = reason.includes('auto-cancel') || reason.includes('auto cancel') || reason.includes('auto-deleted') || reason.includes('auto deleted') || reason.includes('auto-delete');
        const status = normalizeText(job?.status);
        return autoByReason && status !== 'cancelled_by_client';
    })()
);

const getStatusMeta = (job) => {
    if (job.status === 'completed') return { label: 'Completed', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', Icon: CheckCircle, gradient: 'from-emerald-500 to-green-500' };
    if (job.archivedByClient) return { label: 'Deleted', cls: 'bg-red-100 text-red-700 border-red-200', Icon: XCircle, gradient: 'from-red-500 to-rose-500' };
    return { label: 'Cancelled', cls: 'bg-red-100 text-red-700 border-red-200', Icon: XCircle, gradient: 'from-red-500 to-rose-500' };
};

const getJobLocationLabel = (location = {}) => {
    const fullAddress = String(location?.fullAddress || '').trim();
    if (fullAddress) return fullAddress;
    return [location?.locality, location?.city, location?.state, location?.pincode].map((part) => String(part || '').trim()).filter(Boolean).join(', ') || '—';
};

const getJobLocationUnitLabel = (location = {}) => {
    const buildingName = String(location?.buildingName || '').trim();
    const unitNumber = String(location?.unitNumber || '').trim();
    const floorNumber = String(location?.floorNumber || '').trim();
    const parts = [];
    if (buildingName) parts.push(`🏢 Building: ${buildingName}`);
    if (unitNumber) parts.push(`📌 Unit: ${unitNumber}`);
    if (floorNumber) parts.push(`⬆️ Floor: ${floorNumber}`);
    return parts.join(' | ');
};

const getSkillBudgetInfo = (job, skill) => {
    const blocks = Array.isArray(job?.budgetBreakdown?.breakdown) ? job.budgetBreakdown.breakdown : [];
    const block = blocks.find((entry) => normalizeText(entry?.skill) === normalizeText(skill));
    const count = Math.max(1, Number(block?.count) || 1);
    const subtotal = Number(block?.subtotal || 0);
    const costPerWorker = subtotal > 0 ? Math.round(subtotal / count) : null;
    const negotiationAmount = block?.negotiationAmount != null ? Number(block.negotiationAmount) : (block?.negotiationMin != null ? Number(block.negotiationMin) : null);
    return { costPerWorker, negotiationAmount, hours: Number(block?.hours || 0) };
};

const normalizeDateInput = (value) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return null;
    const parsed = new Date(`${trimmed}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

// ── Premium History Job Card ──
const HistoryJobCard = ({ job, onViewDetails, onRepost, selected, onSelect }) => {
    const statusMeta = getStatusMeta(job);
    const StatusIcon = statusMeta.Icon;
    const image = job.photos?.[0] ? getImageUrl(job.photos[0]) : '';
    const assignedCount = (job.workerSlots || []).filter((slot) => slot.assignedWorker).length;
    const finalPaidNum = Number(job?.pricingMeta?.finalPaidPrice || 0);
    const hasFinalPaid = finalPaidNum > 0;
    const canRepost = isAutoCancelledJob(job);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            className="relative bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-xl transition-all overflow-hidden group"
        >
            {/* Selection Checkbox */}
            <div className="absolute top-3 left-3 z-10">
                <label className="inline-flex items-center gap-1.5 bg-white/95 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-gray-200 shadow-sm cursor-pointer hover:border-orange-300 transition-all">
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onSelect(job._id)}
                        className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                    />
                    <span className="text-[10px] font-semibold text-gray-600">Select</span>
                </label>
            </div>

            {/* Delete Button */}
            <div className="absolute top-3 right-3 z-10">
                <button
                    type="button"
                    onClick={() => onRepost && onRepost(job, 'delete')}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 bg-white/95 backdrop-blur-sm border border-red-200 text-red-600 text-[10px] font-bold hover:bg-red-50 transition-all"
                >
                    <Trash2 size={12} /> Delete
                </button>
            </div>

            {/* Image Header */}
            {image && (
                <div className="relative h-36 overflow-hidden">
                    <img src={image} alt={job.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-md bg-gradient-to-r ${statusMeta.gradient} text-white`}>
                        <StatusIcon size={10} /> {statusMeta.label}
                    </div>
                </div>
            )}

            <div className="p-5">
                <h3 className="font-bold text-gray-800 text-base leading-tight line-clamp-2 mb-2">{job.title}</h3>

                {/* Price Info */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-orange-600">
                        <IndianRupee size={14} /> {fmtINR(job.payment)}
                    </span>
                    {job.status === 'completed' && hasFinalPaid && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            Final {fmtINR(finalPaidNum)}
                        </span>
                    )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
                    <div className="flex items-center gap-1">
                        <Users size={12} className="text-orange-400" />
                        <span>{assignedCount} assigned</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Calendar size={12} className="text-orange-400" />
                        <span>{fmtDate(job.scheduledDate)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Clock size={12} className="text-orange-400" />
                        <span>{job.scheduledTime || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1 truncate">
                        <MapPin size={12} className="text-orange-400" />
                        <span className="truncate">{job.location?.city || '—'}</span>
                    </div>
                </div>

                {/* Skills Tags */}
                {(job.skills || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {(job.skills || []).slice(0, 3).map((skill, idx) => (
                            <span key={idx} className="text-[9px] bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 px-2 py-0.5 rounded-full font-semibold border border-orange-100">
                                {skill}
                            </span>
                        ))}
                        {(job.skills || []).length > 3 && (
                            <span className="text-[9px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">
                                +{(job.skills || []).length - 3}
                            </span>
                        )}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => onViewDetails(job._id)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg text-xs font-bold hover:shadow-md transition-all"
                    >
                        <Eye size={12} /> View Details
                    </button>
                    {canRepost && (
                        <button
                            type="button"
                            onClick={() => onRepost && onRepost(job)}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all"
                        >
                            <RefreshCw size={12} /> Repost
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

// ── Confirm Delete Modal ──
const ConfirmDeleteModal = ({ open, title, message, onCancel, onConfirm, loading }) => {
    if (!open) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[98] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
                <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-red-50 to-orange-50 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                        <AlertCircle size={20} className="text-red-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                </div>
                <div className="px-5 py-4">
                    <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
                </div>
                <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-all disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className="flex-1 py-2.5 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-60 shadow-md"
                    >
                        {loading ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

// ── History Job Preview Modal ──
const HistoryJobPreviewModal = ({ job, onClose, onOpenPhoto, onRepost }) => {
    const statusMeta = getStatusMeta(job);
    const StatusIcon = statusMeta.Icon;
    const locationLabel = getJobLocationLabel(job.location);
    const locationUnitLabel = getJobLocationUnitLabel(job.location);
    const hasCoordinates = Number.isFinite(Number(job.location?.lat)) && Number.isFinite(Number(job.location?.lng));
    const finalPaidNum = Number(job?.pricingMeta?.finalPaidPrice || 0);
    const hasFinalPaid = finalPaidNum > 0;
    const canRepost = isAutoCancelledJob(job);
    const completedAt = job.actualEndTime || (job.workerSlots || []).reduce((latest, slot) => {
        const candidate = slot?.actualEndTime || slot?.completedAt;
        if (!candidate) return latest;
        if (!latest) return candidate;
        return new Date(candidate) > new Date(latest) ? candidate : latest;
    }, null);
    const submittedRatings = Array.isArray(job.submittedRatings) ? job.submittedRatings : [];

    const getRatingsForSlot = (slot, workerId) => submittedRatings.filter((rating) => {
        const sameWorker = String(rating?.worker?._id || rating?.worker || '') === String(workerId || '');
        const sameSlot = slot?._id && rating?.slotId ? String(rating.slotId) === String(slot._id) : false;
        const sameSkill = normalizeText(rating?.skill) === normalizeText(slot?.skill);
        return sameWorker && (sameSlot || sameSkill);
    });

    const assignedSlots = (job.workerSlots || []).filter((slot) => slot.assignedWorker);

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[85] bg-black/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl overflow-hidden my-3 mx-auto"
                >
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-4 right-4 z-20 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/95 text-gray-700 shadow-lg hover:bg-gray-100 transition-all"
                    >
                        <X size={18} />
                    </button>

                    <div className="max-h-[calc(100vh-2rem)] overflow-y-auto">
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50">
                            <div className="flex flex-col lg:flex-row gap-5">
                                {job.photos?.[0] && (
                                    <button
                                        type="button"
                                        onClick={() => onOpenPhoto(getImageUrl(job.photos[0]))}
                                        className="lg:w-72 w-full shrink-0 overflow-hidden rounded-xl border border-orange-200 bg-white shadow-md hover:shadow-lg transition-all"
                                    >
                                        <img src={getImageUrl(job.photos[0])} alt={job.title} className="w-full h-44 lg:h-52 object-cover" />
                                    </button>
                                )}
                                <div className="flex-1 min-w-0 space-y-3">
                                    <div>
                                        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 leading-tight">{job.title}</h2>
                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusMeta.cls}`}>
                                                <StatusIcon size={10} /> {statusMeta.label}
                                            </span>
                                            {canRepost && (
                                                <button
                                                    type="button"
                                                    onClick={() => onRepost(job)}
                                                    className="px-2.5 py-1 rounded-full text-[11px] font-bold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all"
                                                >
                                                    <RefreshCw size={10} /> Repost
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                        <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><Users size={12} /> Workers</p>
                                            <p className="text-sm font-bold text-gray-800 mt-1">{assignedSlots.length} assigned</p>
                                            <p className="text-[11px] text-gray-500">{(job.workerSlots || []).length} total slots</p>
                                        </div>
                                        <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><Calendar size={12} /> Scheduled</p>
                                            <p className="text-sm font-bold text-gray-800 mt-1">{fmtDate(job.scheduledDate)}</p>
                                            <p className="text-[11px] text-gray-500">{job.scheduledTime || '—'}</p>
                                        </div>
                                        <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><Clock size={12} /> Closed</p>
                                            <p className="text-sm font-bold text-gray-800 mt-1">{fmtDateTime(completedAt || job.updatedAt)}</p>
                                            <p className="text-[11px] text-gray-500">{job.status === 'completed' ? 'Completed' : 'Cancelled/Deleted'}</p>
                                        </div>
                                        <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><MapPin size={12} /> Location</p>
                                            <p className="text-sm font-bold text-gray-800 mt-1 truncate" title={locationLabel}>{locationLabel}</p>
                                            {hasCoordinates && (
                                                <button
                                                    onClick={() => window.open(`https://www.google.com/maps?q=${job.location.lat},${job.location.lng}`, '_blank')}
                                                    className="text-[11px] text-blue-600 font-semibold hover:text-blue-700 mt-0.5"
                                                >
                                                    View on Maps ↗
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-3 text-sm">
                                        <span className="inline-flex items-center gap-1 font-bold text-orange-600">{fmtINR(job.payment)}</span>
                                        {job.status === 'completed' && hasFinalPaid && (
                                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">Final Paid: {fmtINR(finalPaidNum)}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-5 sm:p-6 space-y-5">
                            {/* Description */}
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Description</p>
                                <p className="text-sm text-gray-700 leading-relaxed">{job.description || '—'}</p>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                {/* Job Details */}
                                <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1"><FileText size={12} /> Job Details</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                        <div><span className="text-gray-500">Posted:</span> <span className="font-semibold text-gray-800">{fmtDateTime(job.createdAt)}</span></div>
                                        <div><span className="text-gray-500">Duration:</span> <span className="font-semibold text-gray-800">{job.duration || '—'}</span></div>
                                        <div><span className="text-gray-500">Budget:</span> <span className="font-semibold text-gray-800">{fmtINR(job.payment)}</span></div>
                                        <div><span className="text-gray-500">Estimated Cost:</span> <span className="font-semibold text-gray-800">{fmtINR(job.totalEstimatedCost || job.payment)}</span></div>
                                        <div className="sm:col-span-2"><span className="text-gray-500">Skills:</span> <span className="font-semibold text-gray-800">{(job.skills || []).length ? job.skills.join(', ') : '—'}</span></div>
                                        <div className="sm:col-span-2"><span className="text-gray-500">Location:</span> <span className="font-semibold text-gray-800">{locationLabel}</span></div>
                                        {locationUnitLabel && <div className="sm:col-span-2"><span className="text-gray-500">Address Details:</span> <span className="font-semibold text-gray-800">{locationUnitLabel}</span></div>}
                                        {job.cancellationReason && (
                                            <div className="sm:col-span-2"><span className="text-gray-500">Reason:</span> <span className="font-semibold text-red-600">{job.cancellationReason}</span></div>
                                        )}
                                    </div>
                                </div>

                                {/* Completion Photos */}
                                <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1"><Camera size={12} /> Completion Photos</p>
                                    {(job.completionPhotos || []).length > 0 ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            {(job.completionPhotos || []).map((photo, i) => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    onClick={() => onOpenPhoto(getImageUrl(photo))}
                                                    className="overflow-hidden rounded-lg border border-gray-200 hover:border-orange-300 transition-all"
                                                >
                                                    <img src={getImageUrl(photo)} alt={`Completion ${i + 1}`} className="h-24 w-full object-cover" />
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500 text-center py-4">No completion images uploaded.</p>
                                    )}
                                </div>
                            </div>

                            {/* Q&A Section */}
                            {(job.qaAnswers || []).length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-1"><MessageCircle size={12} /> Questions & Answers</p>
                                    <div className="space-y-2">
                                        {(job.qaAnswers || []).map((qa, idx) => (
                                            <div key={idx} className="rounded-lg border border-amber-200 bg-white p-3">
                                                <p className="text-xs font-semibold text-amber-800">Q: {qa.question}</p>
                                                <p className="text-xs text-gray-700 mt-1">A: {qa.answer}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Worker Slots & Ratings */}
                            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1"><Users size={12} /> Worker Slots & Ratings</p>
                                {(job.workerSlots || []).length === 0 ? (
                                    <p className="text-sm text-gray-500 text-center py-4">No worker slots available.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {(job.workerSlots || []).map((slot, idx) => {
                                            const worker = slot.assignedWorker;
                                            const slotBudget = getSkillBudgetInfo(job, slot.skill);
                                            const slotRatings = getRatingsForSlot(slot, worker?._id || worker);
                                            return (
                                                <div key={slot._id || idx} className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                                                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                                        <div>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-sm font-bold text-gray-800 capitalize">{slot.skill}</span>
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">{slot.status || '—'}</span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2 mt-1 text-[11px] text-gray-500">
                                                                <span>{slot.hoursEstimated || slotBudget.hours || 0} hours</span>
                                                                {slotBudget.costPerWorker && <span>• Worker: {fmtINR(slotBudget.costPerWorker)}</span>}
                                                                {job.negotiable && slotBudget.negotiationAmount && <span className="text-orange-600 font-semibold">• Negotiable: {fmtINR(slotBudget.negotiationAmount)}</span>}
                                                            </div>
                                                        </div>

                                                        {worker && (
                                                            <button
                                                                onClick={() => openWorkerProfilePreview(worker?._id || worker?.karigarId)}
                                                                className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left"
                                                            >
                                                                <img src={getImageUrl(worker?.photo)} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-orange-200 shadow-sm" onError={(e) => { e.target.src = '/admin.png'; }} />
                                                                <div>
                                                                    <span className="text-sm font-semibold text-gray-800 block max-w-[200px] truncate">{worker?.name || 'Worker'}</span>
                                                                    <span className="text-xs text-gray-500 flex items-center gap-1"><Phone size={10} />{worker?.mobile || 'No contact'}</span>
                                                                </div>
                                                            </button>
                                                        )}
                                                    </div>

                                                    {slotRatings.length > 0 ? (
                                                        <div className="space-y-2">
                                                            {slotRatings.map((rating, rIdx) => (
                                                                <div key={rIdx} className="rounded-lg border border-orange-200 bg-orange-50 p-3 space-y-2">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <div className="flex gap-0.5">
                                                                            {[1, 2, 3, 4, 5].map(star => (
                                                                                <Star key={star} size={12} className={star <= rating.stars ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
                                                                            ))}
                                                                        </div>
                                                                        <span className="text-xs font-semibold text-orange-700">{rating.points} pts</span>
                                                                        <span className="text-[10px] text-gray-400">{fmtDateTime(rating.createdAt)}</span>
                                                                    </div>
                                                                    {rating.message && <p className="text-xs text-gray-700">{rating.message}</p>}
                                                                    {(rating.workPhotos || []).length > 0 && (
                                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                                            {(rating.workPhotos || []).map((photo, pIdx) => (
                                                                                <button key={pIdx} onClick={() => onOpenPhoto(getImageUrl(photo))} className="overflow-hidden rounded-lg border border-orange-200">
                                                                                    <img src={getImageUrl(photo)} alt="Feedback" className="h-16 w-full object-cover" />
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-gray-500">No rating/feedback available for this slot.</p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

// ── Main Component ──
export default function ClientHistory() {
    const navigate = useNavigate();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [previewPhoto, setPreviewPhoto] = useState('');
    const [previewJobId, setPreviewJobId] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [amountFilter, setAmountFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('all');
    const [skillFilter, setSkillFilter] = useState('all');
    const [startDateFilter, setStartDateFilter] = useState('');
    const [endDateFilter, setEndDateFilter] = useState('');
    const [confirmState, setConfirmState] = useState({ open: false, type: '', jobId: null });
    const [deleting, setDeleting] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const { data } = await getClientJobs();
                if (!active) return;
                setJobs(Array.isArray(data) ? data : []);
            } catch {
                if (!active) return;
                toast.error('Failed to load history');
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, []);

    const historyJobs = useMemo(() => jobs.filter((job) => ['completed', 'cancelled', 'cancelled_by_client'].includes(job.status) || job.archivedByClient), [jobs]);

    const historyFilterCounts = useMemo(() => {
        const counts = { all: historyJobs.length, completed: 0, deleted: 0, cancelled: 0, other: 0 };
        historyJobs.forEach((job) => {
            const type = getHistoryType(job);
            counts[type] = Number(counts[type] || 0) + 1;
        });
        return counts;
    }, [historyJobs]);

    const availableSkills = useMemo(() => {
        const skills = new Set();
        historyJobs.forEach((job) => {
            (job.skills || []).forEach((skill) => { const normalized = String(skill || '').trim(); if (normalized) skills.add(normalized); });
            (job.workerSlots || []).forEach((slot) => { const normalized = String(slot?.skill || '').trim(); if (normalized) skills.add(normalized); });
        });
        return Array.from(skills).sort((a, b) => a.localeCompare(b));
    }, [historyJobs]);

    const filteredHistoryJobs = useMemo(() => {
        const q = normalizeText(searchQuery);
        const minDate = normalizeDateInput(startDateFilter);
        const maxDate = normalizeDateInput(endDateFilter);
        const now = new Date();

        return historyJobs.filter((job) => {
            if (statusFilter !== 'all' && getHistoryType(job) !== statusFilter) return false;
            if (q) {
                const title = normalizeText(job?.title);
                const skillPool = [...(Array.isArray(job?.skills) ? job.skills : []), ...((job?.workerSlots || []).map((slot) => slot?.skill))].map(normalizeText).filter(Boolean);
                if (!title.includes(q) && !skillPool.some((skill) => skill.includes(q))) return false;
            }

            const jobAmount = Number(job?.pricingMeta?.finalPaidPrice || job?.payment || 0);
            switch (amountFilter) {
                case '0-1000': if (jobAmount >= 1000) return false; break;
                case '1000-5000': if (jobAmount < 1000 || jobAmount >= 5000) return false; break;
                case '5000-10000': if (jobAmount < 5000 || jobAmount >= 10000) return false; break;
                case '10000+': if (jobAmount < 10000) return false; break;
                default: break;
            }

            const jobDate = job?.scheduledDate ? new Date(job.scheduledDate) : (job?.updatedAt ? new Date(job.updatedAt) : null);
            if (dateFilter !== 'all' && jobDate && !Number.isNaN(jobDate.getTime())) {
                const diffDays = Math.floor((now.getTime() - jobDate.getTime()) / (24 * 60 * 60 * 1000));
                if (dateFilter === '7d' && diffDays > 7) return false;
                if (dateFilter === '30d' && diffDays > 30) return false;
                if (dateFilter === '90d' && diffDays > 90) return false;
            }

            if (minDate || maxDate) {
                if (!jobDate || Number.isNaN(jobDate.getTime())) return false;
                if (minDate && jobDate < minDate) return false;
                if (maxDate) { const endOfDay = new Date(maxDate); endOfDay.setHours(23, 59, 59, 999); if (jobDate > endOfDay) return false; }
            }

            if (skillFilter !== 'all') {
                const match = [...(Array.isArray(job?.skills) ? job.skills : []), ...((job?.workerSlots || []).map((slot) => slot?.skill))].map((skill) => String(skill || '').trim().toLowerCase()).includes(String(skillFilter).trim().toLowerCase());
                if (!match) return false;
            }
            return true;
        });
    }, [historyJobs, statusFilter, searchQuery, amountFilter, dateFilter, skillFilter, startDateFilter, endDateFilter]);

    const historyJobIds = useMemo(() => filteredHistoryJobs.map((job) => String(job._id)), [filteredHistoryJobs]);
    const allSelected = historyJobIds.length > 0 && historyJobIds.every((id) => selectedIds.includes(id));
    const hasSelection = selectedIds.length > 0;
    const previewJob = historyJobs.find((job) => String(job._id) === String(previewJobId)) || null;

    useEffect(() => {
        setSelectedIds((prev) => { const next = prev.filter((id) => historyJobIds.includes(String(id))); return next.length === prev.length ? prev : next; });
    }, [historyJobIds]);

    const toggleSelectOne = (jobId) => { const id = String(jobId); setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])); };
    const toggleSelectAll = () => { if (allSelected) { setSelectedIds([]); return; } setSelectedIds(historyJobIds); };

    const removeDeletedFromUI = (deletedIds = []) => {
        const del = new Set((deletedIds || []).map((id) => String(id)));
        setJobs((prev) => prev.filter((job) => !del.has(String(job._id))));
        setSelectedIds((prev) => prev.filter((id) => !del.has(String(id))));
        setPreviewJobId((prev) => (prev && del.has(String(prev)) ? null : prev));
    };

    const runDeleteAction = async () => {
        if (!confirmState.open) return;
        setDeleting(true);
        try {
            if (confirmState.type === 'single' && confirmState.jobId) {
                const { data } = await permanentlyDeleteHistoryJob(confirmState.jobId);
                removeDeletedFromUI(data?.deletedParentJobIds || [confirmState.jobId]);
                toast.success(data?.message || 'Job permanently deleted.');
            } else if (confirmState.type === 'selected') {
                const { data } = await permanentlyDeleteSelectedHistoryJobs(selectedIds);
                removeDeletedFromUI(data?.deletedParentJobIds || selectedIds);
                toast.success(data?.message || 'Selected jobs permanently deleted.');
            } else if (confirmState.type === 'all') {
                const { data } = await permanentlyDeleteAllHistoryJobs();
                removeDeletedFromUI(data?.deletedParentJobIds || historyJobIds);
                toast.success(data?.message || 'All history jobs permanently deleted.');
            }
            setConfirmState({ open: false, type: '', jobId: null });
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Delete failed. Please try again.');
        } finally {
            setDeleting(false);
        }
    };

    const handleRepostAutoCancelled = (job, action = 'repost') => {
        if (action === 'delete') {
            setConfirmState({ open: true, type: 'single', jobId: String(job._id) });
            return;
        }
        if (!job?._id) return;

        const blocks = Array.isArray(job?.budgetBreakdown?.breakdown) ? job.budgetBreakdown.breakdown : [];
        const safeSkills = (job.skills || []).map((skill) => String(skill || '').trim()).filter(Boolean);
        const baseSkills = safeSkills.length ? safeSkills : blocks.map((b) => String(b?.skill || '').trim()).filter(Boolean);

        const skillWorkerCounts = {};
        const skillWorkerCountDrafts = {};
        const skillDurationHours = {};
        const skillDurationHoursDrafts = {};
        const skillNegotiationDrafts = {};

        blocks.forEach((block) => {
            const key = normalizeText(block?.skill);
            if (!key) return;
            const count = Math.max(1, Number(block?.count) || 1);
            const hours = Math.max(1, Number(block?.hours) || 8);
            const negotiation = Number(block?.negotiationAmount ?? block?.negotiationMin ?? 0);
            skillWorkerCounts[key] = count;
            skillWorkerCountDrafts[key] = String(count);
            skillDurationHours[key] = hours;
            skillDurationHoursDrafts[key] = String(hours);
            if (negotiation > 0) skillNegotiationDrafts[key] = String(Math.round(negotiation));
        });

        const workersRequired = Math.max(1, Number(job?.workersRequired || 0) || Object.values(skillWorkerCounts).reduce((sum, count) => sum + Number(count || 0), 0) || 1);

        const draftPayload = {
            step: 0, description: String(job?.description || ''), city: String(job?.location?.city || ''), urgent: Boolean(job?.urgent),
            questions: [], questionSourceKey: '', answers: {}, estimate: null, editableSkills: baseSkills, newSkillInput: '', selectedSkillOption: '',
            skillsChanged: false, workerCountChanged: false, title: String(job?.title || ''), titleDraft: String(job?.title || ''),
            durationDays: 0, durationHours: 0, durationDaysDraft: '', durationHoursDraft: '', workersRequired, skillWorkerCounts, skillWorkerCountDrafts,
            skillRateAnchors: {}, skillRateOverrides: {}, skillRateDrafts: {}, skillRateModes: {}, skillDurationHours, skillDurationDays: {},
            skillDurationHoursDrafts, skillDurationDaysDrafts: {}, skillDurationDraftSource: {}, skillNegotiationDrafts, skillNegotiationWarnings: {},
            lockedDemandMultiplier: null, removedSkills: [], durationChanged: false, durationDraftSource: '', customBudget: '', negotiable: Boolean(job?.negotiable),
            minBudget: String(job?.minBudget || ''), scheduledDate: '', scheduledTime: '', shift: '', scheduleError: '',
            location: { city: String(job?.location?.city || ''), locality: String(job?.location?.locality || ''), state: String(job?.location?.state || ''), pincode: String(job?.location?.pincode || ''), fullAddress: String(job?.location?.fullAddress || ''), lat: Number.isFinite(Number(job?.location?.lat)) ? Number(job.location.lat) : null, lng: Number.isFinite(Number(job?.location?.lng)) ? Number(job.location.lng) : null },
            photoDrafts: [], clientConfirmedDetails: true, isTopCityOther: false,
        };
        try {
            sessionStorage.setItem(JOB_POST_DRAFT_KEY, JSON.stringify(draftPayload));
            navigate('/client/job-post');
            toast.success('Repost draft prepared. Set new date/time and post again.');
        } catch { toast.error('Unable to prepare repost draft. Please try again.'); }
    };

    const clearHistoryFilters = () => { setSearchQuery(''); setStatusFilter('all'); setAmountFilter('all'); setDateFilter('all'); setSkillFilter('all'); setStartDateFilter(''); setEndDateFilter(''); };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 flex items-center justify-center">
                <div className="text-center"><Loader2 size="48" className="animate-spin text-orange-500 mx-auto mb-4" /><p className="text-gray-500 font-medium">Loading history...</p></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 pb-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-8">
                
                {/* Hero Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    data-guide-id="client-page-history"
                    className="mb-8"
                >
                    <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-xl">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                    <Briefcase size="24" className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black">Job History</h1>
                                    <p className="text-white/90 text-sm mt-0.5">Completed, cancelled and deleted jobs</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="bg-white/15 rounded-xl px-3 py-1.5 text-center">
                                    <p className="text-xl font-bold">{historyJobs.length}</p>
                                    <p className="text-[10px] text-white/80">Total Records</p>
                                </div>
                                <div className="bg-white/15 rounded-xl px-3 py-1.5 text-center">
                                    <p className="text-xl font-bold">{historyFilterCounts.completed || 0}</p>
                                    <p className="text-[10px] text-white/80">Completed</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {historyJobs.length > 0 ? (
                    <>
                        {/* Search & Filters Bar */}
                        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-6">
                            <div className="flex gap-3 mb-3">
                                <div className="flex-1 relative">
                                    <Search size="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search by job name or skill..."
                                        className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                                    />
                                </div>
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${showFilters ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-orange-50'}`}
                                >
                                    <Filter size="14" /> Filters
                                </button>
                            </div>

                            {/* Filter Panel */}
                            <AnimatePresence>
                                {showFilters && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <select value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                                                <option value="all">All Skills</option>
                                                {availableSkills.map((skill) => <option key={skill} value={skill}>{skill}</option>)}
                                            </select>
                                            <select value={amountFilter} onChange={(e) => setAmountFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                                                {HISTORY_AMOUNT_FILTERS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                                            </select>
                                            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                                                {HISTORY_DATE_FILTERS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                                            </select>
                                            <input type="date" value={startDateFilter} onChange={(e) => setStartDateFilter(e.target.value)} placeholder="From date" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                                            <input type="date" value={endDateFilter} onChange={(e) => setEndDateFilter(e.target.value)} placeholder="To date" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Filter Chips */}
                            <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-gray-100">
                                {HISTORY_FILTERS.map((filter) => {
                                    const isActive = statusFilter === filter.key;
                                    return (
                                        <button
                                            key={filter.key}
                                            onClick={() => setStatusFilter(filter.key)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${isActive ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-orange-100'}`}
                                        >
                                            {filter.label} ({historyFilterCounts[filter.key] || 0})
                                        </button>
                                    );
                                })}
                                {(searchQuery || statusFilter !== 'all' || amountFilter !== 'all' || dateFilter !== 'all' || skillFilter !== 'all' || startDateFilter || endDateFilter) && (
                                    <button onClick={clearHistoryFilters} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-orange-600 hover:bg-orange-50">Clear All</button>
                                )}
                            </div>

                            {/* Selection Controls */}
                            <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-2 border-t border-gray-100">
                                <div className="flex items-center gap-3">
                                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                                        <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400" />
                                        Select All
                                    </label>
                                    <span className="text-xs text-gray-500">{selectedIds.length} selected</span>
                                </div>
                                <div className="flex gap-2">
                                    <button disabled={!hasSelection} onClick={() => setConfirmState({ open: true, type: 'selected', jobId: null })} className="px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 transition-all inline-flex items-center gap-1">
                                        <Trash2 size={14} /> Delete Selected
                                    </button>
                                    <button onClick={() => setConfirmState({ open: true, type: 'all', jobId: null })} className="px-3 py-2 rounded-lg bg-gradient-to-r from-red-500 to-rose-500 text-white text-sm font-semibold hover:shadow-md transition-all inline-flex items-center gap-1">
                                        <Trash2 size={14} /> Delete All
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Results Count */}
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-xs text-gray-500 font-medium">{filteredHistoryJobs.length} job{filteredHistoryJobs.length !== 1 ? 's' : ''} found</p>
                        </div>

                        {/* Job Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {filteredHistoryJobs.map((job) => (
                                <HistoryJobCard
                                    key={job._id}
                                    job={job}
                                    selected={selectedIds.includes(String(job._id))}
                                    onSelect={toggleSelectOne}
                                    onViewDetails={setPreviewJobId}
                                    onRepost={handleRepostAutoCancelled}
                                />
                            ))}
                        </div>
                    </>
                ) : (
                    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                        <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Briefcase size="36" className="text-gray-400" />
                        </div>
                        <h3 className="font-bold text-gray-700 text-lg mb-2">No History Records</h3>
                        <p className="text-gray-400 text-sm">Your completed, cancelled, and deleted jobs will appear here.</p>
                    </motion.div>
                )}

                <ConfirmDeleteModal
                    open={confirmState.open}
                    title={confirmState.type === 'single' ? 'Delete This Job Permanently?' : confirmState.type === 'selected' ? 'Delete Selected Jobs Permanently?' : 'Delete All History Jobs Permanently?'}
                    message={confirmState.type === 'single' ? 'This will permanently remove the selected job post from history. This action cannot be undone.' : confirmState.type === 'selected' ? `This will permanently remove ${selectedIds.length} selected job post(s) from history. This action cannot be undone.` : 'This will permanently remove all job posts from your history. This action cannot be undone.'}
                    onCancel={() => setConfirmState({ open: false, type: '', jobId: null })}
                    onConfirm={runDeleteAction}
                    loading={deleting}
                />

                {previewJob && <HistoryJobPreviewModal job={previewJob} onClose={() => setPreviewJobId(null)} onOpenPhoto={setPreviewPhoto} onRepost={handleRepostAutoCancelled} />}

                {previewPhoto && (
                    <div className="fixed inset-0 z-[95] bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewPhoto('')}>
                        <button className="absolute top-4 right-4 text-white text-sm font-semibold" onClick={() => setPreviewPhoto('')}>Close ✕</button>
                        <img src={previewPhoto} alt="Preview" className="max-w-full max-h-[90vh] rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
                    </div>
                )}
            </div>
        </div>
    );
}

const Loader2 = ({ size, className }) => (
    <svg className={`animate-spin ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);