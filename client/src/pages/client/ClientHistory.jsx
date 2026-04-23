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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { openWorkerProfilePreview } from '../../utils/workerProfilePreview';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const fmtINR = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n || 0));
const normalizeText = (value) => String(value || '').trim().toLowerCase();
const JOB_POST_DRAFT_KEY = 'client_job_post_draft_v1';
const HISTORY_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'completed', label: 'Completed' },
    { key: 'deleted', label: 'Deleted' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: 'other', label: 'Other' },
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
        const autoByReason =
            reason.includes('auto-cancel')
            || reason.includes('auto cancel')
            || reason.includes('auto-deleted')
            || reason.includes('auto deleted')
            || reason.includes('auto-delete');
        const status = normalizeText(job?.status);
        return autoByReason && status !== 'cancelled_by_client';
    })()
);

const getStatusMeta = (job) => {
    if (job.status === 'completed') return { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle };
    if (job.archivedByClient) return { label: 'Deleted', cls: 'bg-red-50 text-red-700 border-red-200', Icon: XCircle };
    return { label: 'Cancelled', cls: 'bg-red-50 text-red-700 border-red-200', Icon: XCircle };
};

const getJobLocationLabel = (location = {}) => {
    const fullAddress = String(location?.fullAddress || '').trim();
    if (fullAddress) return fullAddress;
    return [location?.locality, location?.city, location?.state, location?.pincode]
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .join(', ') || '—';
};

const getJobLocationUnitLabel = (location = {}) => {
    const buildingName = String(location?.buildingName || '').trim();
    const unitNumber = String(location?.unitNumber || '').trim();
    const floorNumber = String(location?.floorNumber || '').trim();
    const parts = [];
    if (buildingName) parts.push(`Building: ${buildingName}`);
    if (unitNumber) parts.push(`Unit: ${unitNumber}`);
    if (floorNumber) parts.push(`Floor: ${floorNumber}`);
    return parts.join(' | ');
};

const getSkillBudgetInfo = (job, skill) => {
    const blocks = Array.isArray(job?.budgetBreakdown?.breakdown) ? job.budgetBreakdown.breakdown : [];
    const block = blocks.find((entry) => normalizeText(entry?.skill) === normalizeText(skill));
    const count = Math.max(1, Number(block?.count) || 1);
    const subtotal = Number(block?.subtotal || 0);
    const costPerWorker = subtotal > 0 ? Math.round(subtotal / count) : null;
    const negotiationAmount = block?.negotiationAmount != null
        ? Number(block.negotiationAmount)
        : (block?.negotiationMin != null ? Number(block.negotiationMin) : null);

    return {
        costPerWorker,
        negotiationAmount,
        hours: Number(block?.hours || 0),
    };
};

const normalizeDateInput = (value) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return null;
    const parsed = new Date(`${trimmed}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const HistoryJobCard = ({ job, onViewDetails, onRepost }) => {
    const statusMeta = getStatusMeta(job);
    const StatusIcon = statusMeta.Icon;
    const image = job.photos?.[0] ? getImageUrl(job.photos[0]) : '';
    const assignedCount = (job.workerSlots || []).filter((slot) => slot.assignedWorker).length;
    const finalPaidNum = Number(job?.pricingMeta?.finalPaidPrice || 0);
    const hasFinalPaid = finalPaidNum > 0;
    const canRepost = isAutoCancelledJob(job);

    return (
        <div className="h-full bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-all flex flex-col">
            {image ? (
                <img src={image} alt={job.title} className="w-full h-36 object-cover border-b border-gray-100" />
            ) : null}

            <div className="p-4 flex flex-col gap-3 flex-1 min-h-0">
                <div className="pt-7">
                    <h3 className="text-base font-black text-gray-900 leading-tight line-clamp-2">{job.title}</h3>
                    <span className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${statusMeta.cls}`}>
                        <StatusIcon size={10} /> {statusMeta.label}
                    </span>
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1"><IndianRupee size={11} />{fmtINR(job.payment)}</span>
                    {job.status === 'completed' && hasFinalPaid ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">Final {fmtINR(finalPaidNum)}</span>
                    ) : null}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <p className="inline-flex items-center gap-1"><Users size={11} /> {assignedCount} assigned</p>
                    <p className="inline-flex items-center gap-1"><Calendar size={11} /> {fmtDate(job.scheduledDate)}</p>
                    <p className="inline-flex items-center gap-1"><Clock size={11} /> {job.scheduledTime || '—'}</p>
                    <p className="inline-flex items-center gap-1 truncate"><MapPin size={11} /> {job.location?.city || '—'}</p>
                </div>

                <div className="mt-auto pt-1 grid gap-2">
                    <button
                        type="button"
                        onClick={() => onViewDetails(job._id)}
                        className="w-full px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition-all active:scale-95 inline-flex items-center justify-center gap-1.5"
                    >
                        <Eye size={14} /> View Details
                    </button>
                    {canRepost ? (
                        <button
                            type="button"
                            onClick={() => onRepost(job)}
                            className="w-full px-3 py-2 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-sm font-bold transition-all"
                        >
                            Repost This Job
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

const ConfirmDeleteModal = ({ open, title, message, onCancel, onConfirm, loading }) => {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[98] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-red-50 to-orange-50">
                    <h3 className="text-lg font-black text-gray-900">{title}</h3>
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
                        className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-60"
                    >
                        {loading ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const HistoryJobPreviewModal = ({ job, onClose, onOpenPhoto, onRepost }) => {
    const statusMeta = getStatusMeta(job);
    const StatusIcon = statusMeta.Icon;
    const locationLabel = getJobLocationLabel(job.location);
    const locationUnitLabel = getJobLocationUnitLabel(job.location);
    const hasCoordinates = Number.isFinite(Number(job.location?.lat)) && Number.isFinite(Number(job.location?.lng));

    const finalPaidNum = Number(job?.pricingMeta?.finalPaidPrice || 0);
    const hasFinalPaid = finalPaidNum > 0;
    const canRepost = isAutoCancelledJob(job);

    const completedAt = job.actualEndTime
        || (job.workerSlots || []).reduce((latest, slot) => {
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
        <div className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
            <div className="relative w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden my-3 mx-auto">
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/95 text-gray-700 shadow-lg hover:bg-gray-100 transition-all"
                    aria-label="Close history details"
                >
                    <X size={18} />
                </button>

                <div className="max-h-[calc(100vh-2rem)] overflow-y-auto">
                    <div className="px-5 py-5 sm:px-6 sm:py-6 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50">
                        <div className="flex flex-col lg:flex-row gap-5">
                            {job.photos?.[0] ? (
                                <button
                                    type="button"
                                    onClick={() => onOpenPhoto(getImageUrl(job.photos[0]))}
                                    className="lg:w-72 w-full shrink-0 overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm"
                                >
                                    <img src={getImageUrl(job.photos[0])} alt={job.title} className="w-full h-44 lg:h-52 object-cover" />
                                </button>
                            ) : null}

                            <div className="flex-1 min-w-0 space-y-3">
                                <div className="min-w-0">
                                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight">{job.title}</h2>
                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border inline-flex items-center gap-1 ${statusMeta.cls}`}>
                                            <StatusIcon size={10} /> {statusMeta.label}
                                        </span>
                                        {canRepost ? (
                                            <button
                                                type="button"
                                                onClick={() => onRepost(job)}
                                                className="px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                                            >
                                                Repost
                                            </button>
                                        ) : null}
                                        <span className="text-[10px] bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full font-bold">
                                            {(job.skills || []).length} skill{(job.skills || []).length === 1 ? '' : 's'}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                                    <div className="rounded-2xl border border-gray-100 bg-white p-3">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Workers</p>
                                        <p className="text-sm font-black text-gray-900 mt-1">{assignedSlots.length} assigned</p>
                                        <p className="text-[11px] text-gray-500 mt-0.5">{(job.workerSlots || []).length} total slots</p>
                                    </div>
                                    <div className="rounded-2xl border border-gray-100 bg-white p-3">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Scheduled</p>
                                        <p className="text-sm font-black text-gray-900 mt-1">{fmtDate(job.scheduledDate)}</p>
                                        <p className="text-[11px] text-gray-500 mt-0.5">{job.scheduledTime || '—'}</p>
                                    </div>
                                    <div className="rounded-2xl border border-gray-100 bg-white p-3">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Closed</p>
                                        <p className="text-sm font-black text-gray-900 mt-1">{fmtDateTime(completedAt || job.updatedAt)}</p>
                                        <p className="text-[11px] text-gray-500 mt-0.5">{job.status === 'completed' ? 'Completed' : 'Cancelled/Deleted'}</p>
                                    </div>
                                    <div className="rounded-2xl border border-gray-100 bg-white p-3">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Location</p>
                                        <p className="text-sm font-black text-gray-900 mt-1 truncate" title={locationLabel}>{locationLabel}</p>
                                        {locationUnitLabel ? <p className="text-[11px] text-gray-500 mt-0.5 truncate" title={locationUnitLabel}>{locationUnitLabel}</p> : null}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (hasCoordinates) {
                                                    window.open(`https://www.google.com/maps?q=${job.location.lat},${job.location.lng}`, '_blank');
                                                }
                                            }}
                                            disabled={!hasCoordinates}
                                            className="text-[11px] text-blue-600 font-semibold hover:text-blue-700 mt-0.5 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {hasCoordinates ? 'View on Google Maps' : 'Location not available'}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                                    <span className="inline-flex items-center gap-1">{fmtINR(job.payment)}</span>
                                    {job.status === 'completed' && hasFinalPaid ? (
                                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">Final Paid: {fmtINR(finalPaidNum)}</span>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 sm:p-6 space-y-5">
                        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Description</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{job.description || '—'}</p>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-3">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Job Details</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                    <div><span className="text-gray-500">Posted:</span> <span className="font-semibold text-gray-800">{fmtDateTime(job.createdAt)}</span></div>
                                    <div><span className="text-gray-500">Duration:</span> <span className="font-semibold text-gray-800">{job.duration || '—'}</span></div>
                                    <div><span className="text-gray-500">Budget:</span> <span className="font-semibold text-gray-800">{fmtINR(job.payment)}</span></div>
                                    <div><span className="text-gray-500">Estimated Cost:</span> <span className="font-semibold text-gray-800">{fmtINR(job.totalEstimatedCost || job.payment)}</span></div>
                                    <div className="sm:col-span-2"><span className="text-gray-500">Skills:</span> <span className="font-semibold text-gray-800">{(job.skills || []).length ? job.skills.join(', ') : '—'}</span></div>
                                    <div className="sm:col-span-2"><span className="text-gray-500">Live Location:</span> <span className="font-semibold text-gray-800">{locationLabel}</span></div>
                                    <div><span className="text-gray-500">Building / Home:</span> <span className="font-semibold text-gray-800">{job.location?.buildingName || '—'}</span></div>
                                    <div><span className="text-gray-500">Flat / Home No.:</span> <span className="font-semibold text-gray-800">{job.location?.unitNumber || '—'}</span></div>
                                    <div><span className="text-gray-500">Floor:</span> <span className="font-semibold text-gray-800">{job.location?.floorNumber || '—'}</span></div>
                                    {job.cancellationReason ? (
                                        <div className="sm:col-span-2"><span className="text-gray-500">Reason:</span> <span className="font-semibold text-red-700">{job.cancellationReason}</span></div>
                                    ) : null}
                                </div>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-3">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Completion / Feedback Images</p>
                                {(job.completionPhotos || []).length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {job.completionPhotos.map((photo, i) => {
                                            const photoUrl = getImageUrl(photo);
                                            return (
                                                <button
                                                    key={`done-${i}`}
                                                    type="button"
                                                    onClick={() => onOpenPhoto(photoUrl)}
                                                    className="overflow-hidden rounded-xl border border-gray-200 hover:border-orange-300 transition-colors"
                                                >
                                                    <img src={photoUrl} alt={`Completion ${i + 1}`} className="h-24 w-full object-cover" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">No completion images uploaded.</p>
                                )}
                            </div>
                        </div>

                        {(job.qaAnswers || []).length > 0 ? (
                            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-5">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Questions & Answers</p>
                                <div className="space-y-3">
                                    {job.qaAnswers.map((qa, idx) => (
                                        <div key={idx} className="rounded-xl border border-gray-200 bg-white p-3">
                                            <p className="text-xs font-semibold text-gray-700">Q: {qa.question}</p>
                                            <p className="text-xs text-gray-600 mt-1">A: {qa.answer}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-3">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Worker Slots & Ratings</p>
                            {(job.workerSlots || []).length === 0 ? (
                                <p className="text-sm text-gray-500">No worker slots available.</p>
                            ) : (
                                <div className="space-y-3">
                                    {(job.workerSlots || []).map((slot, idx) => {
                                        const worker = slot.assignedWorker;
                                        const slotBudget = getSkillBudgetInfo(job, slot.skill);
                                        const slotRatings = getRatingsForSlot(slot, worker?._id || worker);
                                        return (
                                            <div key={slot._id || idx} className="rounded-2xl border border-gray-100 bg-gray-50 p-3 sm:p-4 space-y-3">
                                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-sm font-black text-gray-900 capitalize">{slot.skill}</span>
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                                                                {slot.status || '—'}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2 mt-1 text-[11px] text-gray-500">
                                                            <span>{slot.hoursEstimated || slotBudget.hours || 0} hours</span>
                                                            {slotBudget.costPerWorker ? <span>•</span> : null}
                                                            {slotBudget.costPerWorker ? <span>Worker amount: {fmtINR(slotBudget.costPerWorker)}</span> : null}
                                                            {job.negotiable && slotBudget.negotiationAmount ? <span>•</span> : null}
                                                            {job.negotiable && slotBudget.negotiationAmount ? <span className="text-orange-700 font-semibold">Negotiable amount: {fmtINR(slotBudget.negotiationAmount)}</span> : null}
                                                        </div>
                                                    </div>

                                                    {worker ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => openWorkerProfilePreview(worker?._id || worker?.karigarId)}
                                                            className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left"
                                                        >
                                                            <img
                                                                src={getImageUrl(worker?.photo)}
                                                                alt=""
                                                                className="w-9 h-9 rounded-full object-cover border-2 border-white shadow-sm"
                                                                onError={(e) => { e.target.src = '/admin.png'; }}
                                                            />
                                                            <div>
                                                                <span className="text-sm font-semibold text-gray-800 block max-w-[220px] truncate">{worker?.name || 'Worker'}</span>
                                                                <span className="text-xs text-gray-500 inline-flex items-center gap-1"><Phone size={11} />{worker?.mobile || 'No contact'}</span>
                                                            </div>
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic">No worker assigned</span>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                                    <div className="rounded-xl bg-white border border-gray-200 px-3 py-2"><span className="text-gray-500">Assigned Cost:</span> <span className="font-semibold text-gray-800">{slotBudget.costPerWorker ? fmtINR(slotBudget.costPerWorker) : '—'}</span></div>
                                                    <div className="rounded-xl bg-white border border-gray-200 px-3 py-2"><span className="text-gray-500">Negotiable:</span> <span className="font-semibold text-gray-800">{job.negotiable && slotBudget.negotiationAmount ? fmtINR(slotBudget.negotiationAmount) : '—'}</span></div>
                                                    <div className="rounded-xl bg-white border border-gray-200 px-3 py-2"><span className="text-gray-500">Completion:</span> <span className="font-semibold text-gray-800">{fmtDateTime(slot.actualEndTime || slot.completedAt || job.updatedAt)}</span></div>
                                                </div>

                                                {slotRatings.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {slotRatings.map((rating, rIdx) => (
                                                            <div key={`${slot._id || idx}-rating-${rIdx}`} className="rounded-xl border border-orange-200 bg-orange-50 p-3 space-y-2">
                                                                <p className="text-xs text-gray-700">
                                                                    <span className="font-semibold">Rating:</span> {rating.stars}/5 <span className="mx-1">•</span>
                                                                    <span className="font-semibold">Points:</span> {rating.points} <span className="mx-1">•</span>
                                                                    <span className="font-semibold">When:</span> {fmtDateTime(rating.createdAt)}
                                                                </p>
                                                                {rating.message ? <p className="text-xs text-gray-600">Feedback: {rating.message}</p> : null}
                                                                {(rating.workPhotos || []).length > 0 ? (
                                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                                        {(rating.workPhotos || []).map((photo, pIdx) => {
                                                                            const photoUrl = getImageUrl(photo);
                                                                            return (
                                                                                <button
                                                                                    key={`rating-photo-${rIdx}-${pIdx}`}
                                                                                    type="button"
                                                                                    onClick={() => onOpenPhoto(photoUrl)}
                                                                                    className="overflow-hidden rounded-lg border border-orange-200 hover:border-orange-400 transition-colors"
                                                                                >
                                                                                    <img src={photoUrl} alt="Feedback" className="h-20 w-full object-cover" />
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                ) : null}
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
            </div>
        </div>
    );
};

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

    const historyJobs = useMemo(() => (
        jobs.filter((job) => ['completed', 'cancelled', 'cancelled_by_client'].includes(job.status) || job.archivedByClient)
    ), [jobs]);

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
            (job.skills || []).forEach((skill) => {
                const normalized = String(skill || '').trim();
                if (normalized) skills.add(normalized);
            });
            (job.workerSlots || []).forEach((slot) => {
                const normalized = String(slot?.skill || '').trim();
                if (normalized) skills.add(normalized);
            });
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
                const skillPool = [
                    ...(Array.isArray(job?.skills) ? job.skills : []),
                    ...((job?.workerSlots || []).map((slot) => slot?.skill)),
                ].map(normalizeText).filter(Boolean);
                if (!title.includes(q) && !skillPool.some((skill) => skill.includes(q))) return false;
            }

            const jobAmount = Number(job?.pricingMeta?.finalPaidPrice || job?.payment || 0);
            switch (amountFilter) {
                case '0-1000':
                    if (jobAmount >= 1000) return false;
                    break;
                case '1000-5000':
                    if (jobAmount < 1000 || jobAmount >= 5000) return false;
                    break;
                case '5000-10000':
                    if (jobAmount < 5000 || jobAmount >= 10000) return false;
                    break;
                case '10000+':
                    if (jobAmount < 10000) return false;
                    break;
                default:
                    break;
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
                if (maxDate) {
                    const endOfDay = new Date(maxDate);
                    endOfDay.setHours(23, 59, 59, 999);
                    if (jobDate > endOfDay) return false;
                }
            }

            if (skillFilter !== 'all') {
                const match = [
                    ...(Array.isArray(job?.skills) ? job.skills : []),
                    ...((job?.workerSlots || []).map((slot) => slot?.skill)),
                ]
                    .map((skill) => String(skill || '').trim().toLowerCase())
                    .includes(String(skillFilter).trim().toLowerCase());
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
        setSelectedIds((prev) => {
            const next = prev.filter((id) => historyJobIds.includes(String(id)));
            return next.length === prev.length ? prev : next;
        });
    }, [historyJobIds]);

    const toggleSelectOne = (jobId) => {
        const id = String(jobId);
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedIds([]);
            return;
        }
        setSelectedIds(historyJobIds);
    };

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

    const handleRepostAutoCancelled = (job) => {
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

        const workersRequired = Math.max(
            1,
            Number(job?.workersRequired || 0)
            || Object.values(skillWorkerCounts).reduce((sum, count) => sum + Number(count || 0), 0)
            || 1,
        );

        const draftPayload = {
            step: 0,
            description: String(job?.description || ''),
            city: String(job?.location?.city || ''),
            urgent: Boolean(job?.urgent),
            questions: [],
            questionSourceKey: '',
            answers: {},
            estimate: null,
            editableSkills: baseSkills,
            newSkillInput: '',
            selectedSkillOption: '',
            skillsChanged: false,
            workerCountChanged: false,
            title: String(job?.title || ''),
            titleDraft: String(job?.title || ''),
            durationDays: 0,
            durationHours: 0,
            durationDaysDraft: '',
            durationHoursDraft: '',
            workersRequired,
            skillWorkerCounts,
            skillWorkerCountDrafts,
            skillRateAnchors: {},
            skillRateOverrides: {},
            skillRateDrafts: {},
            skillRateModes: {},
            skillDurationHours,
            skillDurationDays: {},
            skillDurationHoursDrafts,
            skillDurationDaysDrafts: {},
            skillDurationDraftSource: {},
            skillNegotiationDrafts,
            skillNegotiationWarnings: {},
            lockedDemandMultiplier: null,
            removedSkills: [],
            durationChanged: false,
            durationDraftSource: '',
            customBudget: '',
            negotiable: Boolean(job?.negotiable),
            minBudget: String(job?.minBudget || ''),
            scheduledDate: '',
            scheduledTime: '',
            shift: '',
            scheduleError: '',
            location: {
                city: String(job?.location?.city || ''),
                locality: String(job?.location?.locality || ''),
                state: String(job?.location?.state || ''),
                pincode: String(job?.location?.pincode || ''),
                fullAddress: String(job?.location?.fullAddress || ''),
                lat: Number.isFinite(Number(job?.location?.lat)) ? Number(job.location.lat) : null,
                lng: Number.isFinite(Number(job?.location?.lng)) ? Number(job.location.lng) : null,
            },
            photoDrafts: [],
            clientConfirmedDetails: true,
            isTopCityOther: false,
        };

        try {
            sessionStorage.setItem(JOB_POST_DRAFT_KEY, JSON.stringify(draftPayload));
            navigate('/client/job-post');
            toast.success('Repost draft prepared. Set new date/time and post again.');
        } catch {
            toast.error('Unable to prepare repost draft. Please try again.');
        }
    };

    const clearHistoryFilters = () => {
        setSearchQuery('');
        setStatusFilter('all');
        setAmountFilter('all');
        setDateFilter('all');
        setSkillFilter('all');
        setStartDateFilter('');
        setEndDateFilter('');
    };

    if (loading) {
        return <div className="max-w-6xl mx-auto px-4 py-10 text-sm text-gray-500">Loading history...</div>;
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-6 pb-24 space-y-4">
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-3xl p-6 text-white">
                <h1 className="text-3xl font-black">Job History</h1>
                <p className="text-sm text-orange-100 mt-1">Completed, cancelled and deleted jobs</p>
            </div>

            {historyJobs.length > 0 ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
                        <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100 lg:col-span-2">
                            <Search size={16} className="text-gray-400 shrink-0" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search old posts by job name or skill"
                                className="w-full bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none"
                            />
                        </label>

                        <select
                            value={skillFilter}
                            onChange={(e) => setSkillFilter(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                        >
                            <option value="all">All Skills</option>
                            {availableSkills.map((skill) => (
                                <option key={skill} value={skill}>{skill}</option>
                            ))}
                        </select>

                        <select
                            value={amountFilter}
                            onChange={(e) => setAmountFilter(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                        >
                            {HISTORY_AMOUNT_FILTERS.map((option) => (
                                <option key={option.key} value={option.key}>{option.label}</option>
                            ))}
                        </select>

                        <select
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                        >
                            {HISTORY_DATE_FILTERS.map((option) => (
                                <option key={option.key} value={option.key}>{option.label}</option>
                            ))}
                        </select>

                        <input
                            type="date"
                            value={startDateFilter}
                            onChange={(e) => setStartDateFilter(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                            aria-label="Start date filter"
                        />

                        <input
                            type="date"
                            value={endDateFilter}
                            onChange={(e) => setEndDateFilter(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                            aria-label="End date filter"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {HISTORY_FILTERS.map((filter) => {
                            const isActive = statusFilter === filter.key;
                            const count = Number(historyFilterCounts?.[filter.key] || 0);
                            return (
                                <button
                                    key={filter.key}
                                    type="button"
                                    onClick={() => setStatusFilter(filter.key)}
                                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${isActive ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                                >
                                    {filter.label} ({count})
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            onClick={clearHistoryFilters}
                            className="px-3 py-1.5 rounded-xl border text-xs font-bold transition-all bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                        >
                            Reset Filters
                        </button>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700 font-semibold">
                            <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={toggleSelectAll}
                                className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                            />
                            Select All
                        </label>
                            <span className="text-xs text-gray-500">{selectedIds.length} selected</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            disabled={!hasSelection}
                            onClick={() => setConfirmState({ open: true, type: 'selected', jobId: null })}
                            className="px-3 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1.5"
                        >
                            <Trash2 size={14} /> Delete Selected
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfirmState({ open: true, type: 'all', jobId: null })}
                            className="px-3 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-all inline-flex items-center gap-1.5"
                        >
                            <Trash2 size={14} /> Delete All
                        </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {historyJobs.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-500">No history records found.</div>
            ) : filteredHistoryJobs.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-500">No records found for this filter.</div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredHistoryJobs.map((job) => (
                        <div key={job._id} className="relative">
                            <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
                                <label className="inline-flex items-center gap-2 bg-white/95 rounded-lg px-2 py-1 border border-gray-200 shadow-sm">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(String(job._id))}
                                        onChange={() => toggleSelectOne(job._id)}
                                        className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                                    />
                                    <span className="text-[11px] font-semibold text-gray-700">Select</span>
                                </label>
                            </div>
                            <div className="absolute top-3 right-3 z-10">
                                <button
                                    type="button"
                                    onClick={() => setConfirmState({ open: true, type: 'single', jobId: String(job._id) })}
                                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 bg-white/95 border border-red-200 text-red-600 text-[11px] font-bold hover:bg-red-50 transition-all"
                                >
                                    <Trash2 size={12} /> Delete
                                </button>
                            </div>
                            <HistoryJobCard job={job} onViewDetails={setPreviewJobId} onRepost={handleRepostAutoCancelled} />
                        </div>
                    ))}
                </div>
            )}

            <ConfirmDeleteModal
                open={confirmState.open}
                title={
                    confirmState.type === 'single'
                        ? 'Delete This Job Permanently?'
                        : confirmState.type === 'selected'
                            ? 'Delete Selected Jobs Permanently?'
                            : 'Delete All History Jobs Permanently?'
                }
                message={
                    confirmState.type === 'single'
                        ? 'This will permanently remove the selected job post from history. This action cannot be undone.'
                        : confirmState.type === 'selected'
                            ? `This will permanently remove ${selectedIds.length} selected job post(s) from history. This action cannot be undone.`
                            : 'This will permanently remove all job posts from your history. This action cannot be undone.'
                }
                onCancel={() => setConfirmState({ open: false, type: '', jobId: null })}
                onConfirm={runDeleteAction}
                loading={deleting}
            />

            {previewJob ? (
                <HistoryJobPreviewModal
                    job={previewJob}
                    onClose={() => setPreviewJobId(null)}
                    onOpenPhoto={setPreviewPhoto}
                    onRepost={handleRepostAutoCancelled}
                />
            ) : null}

            {previewPhoto ? (
                <div
                    className="fixed inset-0 z-[95] bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setPreviewPhoto('')}
                >
                    <button
                        type="button"
                        className="absolute top-4 right-4 bg-white text-gray-800 px-3 py-1 rounded-lg text-sm font-semibold"
                        onClick={() => setPreviewPhoto('')}
                    >
                        Close
                    </button>
                    <img
                        src={previewPhoto}
                        alt="Preview"
                        className="max-w-full max-h-[90vh] rounded-xl shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            ) : null}
        </div>
    );
}
