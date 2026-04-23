// client/src/pages/client/ClientJobManage.jsx
// FIXED:
//   1. Missing closing </div> for max-w-6xl wrapper — caused all modals to render outside layout
//   2. Duplicate AnimatePresence/modal block removed (was rendered twice)
//   3. RatingModal onRated prop was missing in first duplicate block
//   4. CancelModal/RemoveWorkerModal/RepostModal moved before export default (hoisting safety)
//   5. Import cleanup — removed unused imports
// IMPROVED:
//   - Professional orange-theme cards with gradient headers
//   - Better slot/applicant display with clearer CTAs
//   - Countdown timer rendered inline on Start button
//   - Empty states with actionable prompts
//   - Accessible focus styles throughout

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    getClientJobs, deleteClientJob, cancelJob, updateJobStatus,
    uploadCompletionPhotos, startJob,
    removeAssignedWorker, completeWorkerTask, respondToApplicant,
    getJobSmartSuggestions, getSemanticWorkersForJob, inviteWorkersToJob,
    submitRating, toggleStarWorker, getWorkerFullProfile, getImageUrl,
    repostMissingSkill, dismissMissingSkill, respondToSubTaskApplicant,
    completeSubTask, initClientLocation, recordSemanticFeedback, removeCompletionPhoto,
} from '../../api/index';
import { openWorkerProfilePreview } from '../../utils/workerProfilePreview';
import {
    initiateRazorpayPayment,
    initiateCashOtpPayment,
    resendCashOtpPayment,
    verifyCashOtpPayment,
} from '../../utils/razorpayHelper';
import ClientLiveTracking from './ClientLiveTracking';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Briefcase, MapPin, Calendar, Clock, IndianRupee, Users,
    Star, AlertCircle, CheckCircle, XCircle, Truck,
    Phone, Mail, ChevronDown, ChevronUp,
    Navigation, Loader2, Award, Zap,
    RefreshCw, Bookmark, Sparkles, Layers,
    Camera, UserCheck, UserX, FileText, X,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

const fmtINR = (n) => {
    if (n == null) return '—';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
};

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const formatHoursAsDuration = (hoursValue) => {
    const totalHours = Math.max(0, Number(hoursValue) || 0);
    const days = Math.floor(totalHours / 8);
    const hours = Math.round(totalHours % 8);
    const parts = [];

    if (days > 0) {
        parts.push(`${days} day${days === 1 ? '' : 's'}`);
    }

    if (hours > 0 || parts.length === 0) {
        parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
    }

    return parts.join(' ');
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

const formatCommuteHint = (commute) => {
    if (!commute) return 'Distance unavailable';
    if (!commute.available) return 'Location unavailable';
    const bits = [];
    if (commute.distanceText || Number.isFinite(commute.distanceKm)) {
        bits.push(commute.distanceText || `${Number(commute.distanceKm || 0).toFixed(1)} km`);
    }
    if (commute.etaText) bits.push(`ETA ${commute.etaText}`);
    if (commute.isLocationStale) bits.push('stale location');
    return bits.join(' • ') || 'Distance unavailable';
};

const getCommuteTone = (commute) => {
    if (!commute?.available) return 'text-gray-500';
    if (commute.distanceColor === 'green') return 'text-emerald-700';
    if (commute.distanceColor === 'yellow') return 'text-amber-700';
    return 'text-red-600';
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
        block,
        costPerWorker,
        hours: Number(block?.hours || 0),
        negotiationAmount,
    };
};

const getDirectHireEstimatedAmount = (job) => {
    const directHire = job?.directHire || {};
    const candidates = [
        directHire.paymentAmount,
        directHire.expectedAmount,
        job?.totalEstimatedCost,
        job?.pricingMeta?.totalEstimatedCost,
        job?.pricingMeta?.suggestedAmount,
        job?.payment,
        directHire.fetchedAmount,
        directHire.fetchedBaseAmount,
    ];

    for (const candidate of candidates) {
        const amount = Number(candidate || 0);
        if (Number.isFinite(amount) && amount > 0) {
            return Math.round(amount);
        }
    }

    return 0;
};

const getPaymentOptionsForSlot = (job, slot) => {
    const skillBudget = getSkillBudgetInfo(job, slot?.skill);
    const slotWorkerId = String(slot?.assignedWorker?._id || slot?.assignedWorker || '');
    const matchedApplicant = (job?.applicants || []).find((app) => {
        const applicantWorkerId = String(app?.workerId?._id || app?.workerId || '');
        return applicantWorkerId === slotWorkerId && normalizeText(app?.skill) === normalizeText(slot?.skill);
    });
    const skillCost = Number(
        slot?.assignedCost
        ?? slot?.agreedAmount
        ?? skillBudget?.costPerWorker
        ?? skillBudget?.block?.perWorkerCost
        ?? skillBudget?.block?.perWorkerCostBase
        ?? 0,
    );
    const negotiableCost = Number(skillBudget?.negotiationAmount || 0);
    const workerQuotedPrice = Number(
        matchedApplicant?.quotedPrice
        ?? slot?.workerQuotedPrice
        ?? slot?.quotedPrice
        ?? slot?.assignedWorker?.quotedPrice
        ?? slot?.applicant?.quotedPrice
        ?? 0,
    );
    const directHireEstimatedAmount = getDirectHireEstimatedAmount(job);

    return {
        skillCost: skillCost > 0 ? Math.round(skillCost) : 0,
        negotiableCost: negotiableCost > 0 ? Math.round(negotiableCost) : 0,
        workerQuotedPrice: workerQuotedPrice > 0 ? Math.round(workerQuotedPrice) : 0,
        directHireEstimatedAmount,
    };
};

const getPaymentReferenceAmount = (job, slot, source, value) => {
    const options = getPaymentOptionsForSlot(job, slot);
    const fallback = Number(options.skillCost || options.negotiableCost || options.workerQuotedPrice || 0);
    const selected = Number(value || 0);
    const reference = source === 'skillCost'
        ? options.skillCost
        : source === 'negotiableCost'
            ? options.negotiableCost
            : source === 'workerQuotedPrice'
                ? options.workerQuotedPrice
                : fallback;
    return {
        reference: Number(reference || fallback || 0),
        fallback,
        selected: Number.isFinite(selected) && selected > 0 ? selected : 0,
    };
};

const getJobCountdown = (job) => {
    if (!job?.scheduledDate || !job?.scheduledTime) {
        return { hasSchedule: false, canStart: true, remaining: '00:00' };
    }

    const [hours, minutes] = String(job.scheduledTime).split(':').map(Number);
    const scheduledAt = new Date(job.scheduledDate);
    scheduledAt.setHours(hours, minutes, 0, 0);
    const minsLeft = Math.max(0, (scheduledAt.getTime() - Date.now()) / 60000);

    return {
        hasSchedule: true,
        canStart: minsLeft <= 0,
        remaining: `${pad2(Math.floor(minsLeft / 60))}:${pad2(Math.floor(minsLeft % 60))}`,
    };
};

const getRepostWindowState = (job) => {
    if (!job?.scheduledDate || !job?.scheduledTime) {
        return { hasSchedule: false, minsToStart: null, isInWindow: false, isPastStart: false };
    }

    const [hours, minutes] = String(job.scheduledTime).split(':').map(Number);
    const scheduledAt = new Date(job.scheduledDate);
    scheduledAt.setHours(hours, minutes, 0, 0);

    if (Number.isNaN(scheduledAt.getTime())) {
        return { hasSchedule: false, minsToStart: null, isInWindow: false, isPastStart: false };
    }

    const minsToStart = (scheduledAt.getTime() - Date.now()) / 60000;
    return {
        hasSchedule: true,
        minsToStart,
        isInWindow: minsToStart <= 30 && minsToStart > 0,
        isPastStart: minsToStart <= 0,
    };
};

const isCancelled = (s) => ['cancelled_by_client', 'cancelled'].includes(s);

const toPercent = (v) => Math.round(Math.max(0, Math.min(1, Number(v || 0))) * 100);

const pad2 = (n) => String(Math.max(0, n)).padStart(2, '0');

const STATUS_CFG = {
    open:               { label: 'Open',        Icon: Zap,          color: 'text-green-700',   bg: 'bg-green-50',   border: 'border-green-200'  },
    scheduled:          { label: 'Scheduled',   Icon: Calendar,     color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200'   },
    running:            { label: 'In Progress', Icon: Truck,        color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200' },
    completed:          { label: 'Completed',   Icon: CheckCircle,  color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200'},
    cancelled_by_client:{ label: 'Cancelled',   Icon: XCircle,      color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200'    },
    cancelled:          { label: 'Cancelled',   Icon: XCircle,      color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200'    },
};
const getStatusCfg = (s) => STATUS_CFG[s] || STATUS_CFG.open;

const SLOT_CFG = {
    open:         { label: 'Open',         Icon: Zap,         color: 'text-gray-500',   bg: 'bg-gray-100'   },
    filled:       { label: 'Assigned',     Icon: UserCheck,   color: 'text-blue-600',   bg: 'bg-blue-100'   },
    task_completed:{ label: 'Done',        Icon: CheckCircle, color: 'text-green-600',  bg: 'bg-green-100'  },
    cancelled:    { label: 'Cancelled',    Icon: XCircle,     color: 'text-red-500',    bg: 'bg-red-100'    },
    not_required: { label: 'Not Required', Icon: XCircle,     color: 'text-gray-400',   bg: 'bg-gray-100'   },
    reposted:     { label: 'Reposted',     Icon: RefreshCw,   color: 'text-purple-600', bg: 'bg-purple-100' },
};
const getSlotCfg = (s) => SLOT_CFG[s] || SLOT_CFG.open;

// ─────────────────────────────────────────────────────────────────────────────
// Countdown Hook
// ─────────────────────────────────────────────────────────────────────────────
const useStartCountdown = (job) => {
    const [info, setInfo] = useState({ hasSchedule: false, canStart: true, remaining: '00:00' });
    useEffect(() => {
        if (!job?.scheduledDate || !job?.scheduledTime || ['completed', 'cancelled', 'cancelled_by_client'].includes(job.status)) {
            setInfo({ hasSchedule: false, canStart: true, remaining: '00:00' });
            return;
        }
        const update = () => {
            setInfo(getJobCountdown(job));
        };
        update();
        const iv = setInterval(update, 10000);
        return () => clearInterval(iv);
    }, [job?._id, job?.status, job?.scheduledTime, job?.scheduledDate]);
    return info;
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared Components
// ─────────────────────────────────────────────────────────────────────────────
const InlineAlert = ({ msg, type = 'error', onDismiss }) => {
    if (!msg) return null;
    const cfg = {
        error:   { Icon: AlertCircle, bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-700'   },
        success: { Icon: CheckCircle, bg: 'bg-green-50',  border: 'border-green-200', text: 'text-green-700' },
        warning: { Icon: AlertCircle, bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-700' },
        info:    { Icon: AlertCircle, bg: 'bg-blue-50',   border: 'border-blue-200',  text: 'text-blue-700'  },
    }[type] || {};
    const { Icon, bg, border, text } = cfg;
    return (
        <div className={`${bg} border ${border} rounded-xl px-4 py-3 flex items-start gap-2.5`}>
            <Icon size={15} className={`${text} flex-shrink-0 mt-0.5`}/>
            <p className={`text-xs flex-1 leading-relaxed ${text}`}>{msg}</p>
            {onDismiss && <button onClick={onDismiss} className={`${text} text-sm leading-none hover:opacity-70 ml-1`}>×</button>}
        </div>
    );
};

const ModalShell = ({ children, onClose }) => (
    <motion.div
        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[96] flex items-center justify-center p-4"
        onClick={onClose}
    >
        <motion.div
            initial={{ scale:0.94, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0.94, opacity:0 }}
            transition={{ duration:0.18 }}
            className="bg-white rounded-2xl max-w-md w-full max-h-[92vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
        >
            {children}
        </motion.div>
    </motion.div>
);

const ModalHeader = ({ icon, title, subtitle, gradient = 'from-orange-500 to-amber-500' }) => (
    <div className={`bg-gradient-to-r ${gradient} px-5 py-4 rounded-t-2xl`}>
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                {typeof icon === 'string' ? <span className="text-xl">{icon}</span> : icon}
            </div>
            <div>
                <h3 className="text-lg font-black text-white">{title}</h3>
                {subtitle && <p className="text-white/75 text-xs mt-0.5">{subtitle}</p>}
            </div>
        </div>
    </div>
);

const ModalFooter = ({ onClose, onAction, closeLabel='Cancel', actionLabel, actionClass='bg-orange-500 hover:bg-orange-600', disabled, loading }) => (
    <div className="flex gap-3 p-4 border-t border-gray-100">
        <button onClick={onClose} className="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-all">
            {closeLabel}
        </button>
        {onAction && (
            <button onClick={onAction} disabled={disabled||loading}
                className={`flex-1 py-2.5 ${actionClass} text-white rounded-xl font-semibold text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2`}>
                {loading ? <Loader2 size={15} className="animate-spin"/> : actionLabel}
            </button>
        )}
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Worker Profile Modal
// ─────────────────────────────────────────────────────────────────────────────
const WorkerProfileModal = ({ workerId, onClose, onStar, starredIds = [] }) => {
    const [worker, setWorker] = useState(null);
    const [loading, setLoading] = useState(true);
    const isStarred = starredIds.includes(workerId?.toString());
    const dailyProfile = worker?.dailyProfile || {};
    const dailySkillRates = Array.isArray(dailyProfile.skillRates) ? dailyProfile.skillRates : [];
    const travelMethodLabel = {
        cycle: 'Cycle',
        motorcycle: 'Motorcycle',
        bus: 'Bus',
        lift: 'Using Lift',
        other: 'Other',
    }[String(worker?.travelMethod || dailyProfile.travelMethod || 'other').toLowerCase()] || 'Other';
    const paymentMethodLabel = {
        cash: 'Cash',
        online: 'Online',
        flexible: 'Flexible',
    }[String(dailyProfile.paymentMethod || 'flexible').toLowerCase()] || 'Flexible';

    useEffect(() => {
        getWorkerFullProfile(workerId)
            .then(({ data }) => setWorker(data))
            .catch(() => toast.error('Unable to load worker profile'))
            .finally(() => setLoading(false));
    }, [workerId]);

    if (loading) return (
        <ModalShell onClose={onClose}>
            <div className="flex items-center justify-center py-16">
                <Loader2 size={32} className="animate-spin text-orange-500"/>
            </div>
        </ModalShell>
    );
    if (!worker) return null;

    return (
        <ModalShell onClose={onClose}>
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-5 rounded-t-2xl">
                <div className="flex items-start gap-4">
                    <img src={getImageUrl(worker.photo)} alt={worker.name}
                        className="w-16 h-16 rounded-full object-cover border-3 border-white shadow-lg flex-shrink-0"
                        onError={e=>{ e.target.src='/admin.png'; }}/>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-lg font-black text-white">{worker.name}</h2>
                            {worker.verificationStatus === 'approved' && (
                                <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">✓ Verified</span>
                            )}
                        </div>
                        <p className="text-orange-100 text-xs mt-0.5">{worker.karigarId}</p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="flex items-center gap-1 text-white text-xs"><Star size={11}/> {worker.avgStars?.toFixed(1)||'—'}</span>
                            <span className="flex items-center gap-1 text-white text-xs"><Briefcase size={11}/> {worker.completedJobs||0} jobs</span>
                            <span className="flex items-center gap-1 text-white text-xs"><Award size={11}/> {worker.points||0} pts</span>
                        </div>
                    </div>
                    <button onClick={()=>onStar(workerId)}
                        className={`p-2 rounded-xl transition-all flex-shrink-0 ${isStarred?'bg-yellow-400':'bg-white/20 hover:bg-white/30'}`}>
                        <Star size={17} className="text-white" fill={isStarred?'white':'none'}/>
                    </button>
                </div>
            </div>

            <div className="p-5 space-y-4">
                {/* Contact */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">Contact</p>
                    <div className="space-y-1.5">
                        <p className="text-sm flex items-center gap-2 text-gray-700"><Phone size={13} className="text-gray-400 flex-shrink-0"/>{worker.mobile||'Not provided'}</p>
                        {worker.email && <p className="text-sm flex items-center gap-2 text-gray-700"><Mail size={13} className="text-gray-400 flex-shrink-0"/>{worker.email}</p>}
                    </div>
                </div>

                {worker.dailyProfile && (
                    <div className="bg-gradient-to-br from-orange-50 via-white to-amber-50 rounded-xl p-4 border border-orange-100 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Daily Details</p>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-orange-200 text-orange-700 font-bold">Public</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="bg-white rounded-lg p-3 border border-orange-100">
                                <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Travel</p>
                                <p className="text-sm font-bold text-gray-900 mt-1">{travelMethodLabel}</p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-orange-100">
                                <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Payment</p>
                                <p className="text-sm font-bold text-gray-900 mt-1">{paymentMethodLabel}</p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-orange-100">
                                <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Phone</p>
                                <p className="text-sm font-bold text-gray-900 mt-1">{dailyProfile.phoneType || 'Not specified'}</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-orange-100">
                            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400 mb-1">Live location</p>
                            <p className="text-sm text-gray-700">
                                {dailyProfile.liveLocation?.latitude && dailyProfile.liveLocation?.longitude
                                    ? `${dailyProfile.liveLocation.latitude}, ${dailyProfile.liveLocation.longitude}`
                                    : 'Not shared yet'}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Skill pricing</p>
                            <div className="grid grid-cols-1 gap-2">
                                {dailySkillRates.length ? dailySkillRates.map((skill, index) => (
                                    <div key={`${skill.skillName || 'skill'}-${index}`} className="bg-white rounded-lg p-3 border border-orange-100 flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-bold text-gray-900">{skill.skillName || 'Skill'}</p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Preference {skill.preferenceRank || 1}</p>
                                        </div>
                                        <div className="text-right text-[11px] font-bold text-gray-600">
                                            <p>/hour: ₹{Number(skill.hourlyPrice || 0).toLocaleString('en-IN')}</p>
                                            <p>/day: ₹{Number(skill.dailyPrice || 0).toLocaleString('en-IN')}</p>
                                            <p>/visit: ₹{Number(skill.visitPrice || 0).toLocaleString('en-IN')}</p>
                                        </div>
                                    </div>
                                )) : <p className="text-xs text-gray-500">No skill pricing has been added yet.</p>}
                            </div>
                        </div>
                    </div>
                )}

                {/* Skills */}
                {worker.skills?.length > 0 && (
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">Skills</p>
                        <div className="flex flex-wrap gap-1.5">
                            {worker.skills.map((s,i) => (
                                <span key={i} className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full text-xs font-semibold capitalize border border-orange-100">
                                    {s.name||s}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Reviews */}
                {worker.ratings?.length > 0 && (
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">Recent Reviews</p>
                        <div className="space-y-2">
                            {worker.ratings.slice(0,3).map((r,i) => (
                                <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-semibold text-gray-800">{r.client?.name}</span>
                                        <span className="text-yellow-400 text-sm">{'★'.repeat(r.stars||0)}{'☆'.repeat(5-(r.stars||0))}</span>
                                    </div>
                                    {r.message && <p className="text-xs text-gray-600 leading-relaxed">{r.message}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <ModalFooter onClose={onClose} closeLabel="Close"/>
        </ModalShell>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Rating Modal
// ─────────────────────────────────────────────────────────────────────────────
const RatingModal = ({ job, onClose, onRated }) => {
    const [idx, setIdx]         = useState(0);
    const [stars, setStars]     = useState(5);
    const [pts, setPts]         = useState(50);
    const [msg, setMsg]         = useState('');
    const [submitting, setSub]  = useState(false);
    const [error, setError]     = useState('');

    const slots = [
        ...(job.workerSlots||[]).filter(s=>s.assignedWorker && !s.ratingSubmitted && !['open','cancelled','not_required','reposted'].includes(s.status)).map(s=>({...s,_src:'slot'})),
        ...(job.subTasks||[]).filter(s=>s.assignedWorker && !s.ratingSubmitted && s.status!=='cancelled').map(s=>({...s,_src:'subtask'})),
    ];

    const cur    = slots[idx];
    const worker = cur?.assignedWorker;
    const wId    = (worker?._id||worker)?.toString();

    const handleSubmit = async () => {
        if (!cur) return;
        setSub(true); setError('');
        try {
            await submitRating(job._id, {
                workerId: wId,
                slotId:    cur._src==='slot'    ? cur._id : undefined,
                subTaskId: cur._src==='subtask' ? cur._id : undefined,
                skill: cur.skill, stars, points: pts, message: msg,
            });
            toast.success(`${cur.skill} rated!`);
            if (idx < slots.length-1) { setIdx(i=>i+1); setStars(5); setPts(50); setMsg(''); }
            else { onRated?.(job._id); onClose(); }
        } catch (err) {
            if (err?.response?.status === 409) {
                if (idx < slots.length-1) setIdx(i=>i+1);
                else { onRated?.(job._id); onClose(); }
            } else {
                setError(err?.response?.data?.message || 'Failed to submit rating');
            }
        } finally { setSub(false); }
    };

    if (slots.length === 0) return (
        <ModalShell onClose={onClose}>
            <div className="p-8 text-center">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={28} className="text-green-500"/>
                </div>
                <h3 className="font-black text-gray-900 mb-2">All Rated!</h3>
                <p className="text-sm text-gray-400 mb-5">Great job managing your team</p>
                <button onClick={onClose} className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold">Done</button>
            </div>
        </ModalShell>
    );

    return (
        <ModalShell onClose={onClose}>
            <ModalHeader icon="⭐" title="Rate Worker" subtitle={`${idx+1} / ${slots.length}`}/>
            <div className="p-5 space-y-5">
                {worker && (
                    <div className="flex items-center gap-3 bg-orange-50 border border-orange-100 rounded-xl p-4">
                        <img src={getImageUrl(worker.photo)} alt={worker.name} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" onError={e=>{e.target.src='/admin.png';}}/>
                        <div>
                            <p className="font-bold text-gray-900 text-sm">{worker.name}</p>
                            <p className="text-xs text-orange-600 capitalize font-medium">{cur.skill}</p>
                        </div>
                    </div>
                )}
                {error && <InlineAlert msg={error} type="error" onDismiss={()=>setError('')}/>}

                {/* Stars */}
                <div>
                    <p className="text-sm font-bold text-gray-700 mb-2.5">Rating</p>
                    <div className="flex gap-1.5">
                        {[1,2,3,4,5].map(s=>(
                            <button key={s} onClick={()=>setStars(s)} className={`text-3xl transition-transform active:scale-95 ${s<=stars?'text-yellow-400':'text-gray-200'}`}>★</button>
                        ))}
                    </div>
                </div>

                {/* Points slider */}
                <div>
                    <p className="text-sm font-bold text-gray-700 mb-2">
                        Points: <span className="text-orange-600">{pts}</span>
                    </p>
                    <input type="range" min={20} max={100} value={pts} onChange={e=>setPts(Number(e.target.value))}
                        className="w-full accent-orange-500"/>
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                        <span>Basic (20)</span><span>Good (50)</span><span>Excellent (75)</span><span>🏆 (100)</span>
                    </div>
                </div>

                {/* Feedback */}
                <div>
                    <p className="text-sm font-bold text-gray-700 mb-2">Feedback <span className="text-gray-400 font-normal">(optional)</span></p>
                    <textarea rows={3} value={msg} onChange={e=>setMsg(e.target.value)}
                        placeholder="Share your experience…"
                        className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none text-sm resize-none transition-all"/>
                </div>
            </div>
            <ModalFooter onClose={onClose} onAction={handleSubmit}
                actionLabel={idx<slots.length-1?'Submit & Next →':'Submit Rating'}
                loading={submitting}/>
        </ModalShell>
    );
};

const PayWorkerModal = ({ payload, onClose, onPaid }) => {
    const { job, slot, workerName, skill } = payload || {};
    const paymentOptions = getPaymentOptionsForSlot(job, slot);
    const isDirectHireJob = String(job?.hireMode || '').toLowerCase() === 'direct';
    const directHireEstimatedAmount = Number(paymentOptions.directHireEstimatedAmount || getDirectHireEstimatedAmount(job) || 0);
    const optionCards = isDirectHireJob
        ? [{ key: 'directHireEstimate', label: 'Direct Hire Estimated Total', amount: directHireEstimatedAmount }]
        : [
            { key: 'skillCost', label: 'Client Skill Cost', amount: paymentOptions.skillCost },
            { key: 'negotiableCost', label: 'Negotiable Cost', amount: paymentOptions.negotiableCost },
            { key: 'workerQuotedPrice', label: 'Worker Quoted Price', amount: paymentOptions.workerQuotedPrice },
        ].filter((option) => Number(option.amount || 0) > 0);

    const defaultOption = optionCards[0] || { key: 'skillCost', amount: 0 };
    const [selectedSource, setSelectedSource] = useState(defaultOption.key);
    const [amount, setAmount] = useState(String(defaultOption.amount || 0));
    const [acknowledged, setAcknowledged] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [confirmingPay, setConfirmingPay] = useState(false);
    const [paymentMode, setPaymentMode] = useState('online');
    const [cashSession, setCashSession] = useState(null);
    const [otpCode, setOtpCode] = useState('');
    const [otpDeadlineMs, setOtpDeadlineMs] = useState(0);
    const [otpSecondsLeft, setOtpSecondsLeft] = useState(0);
    const [resendingOtp, setResendingOtp] = useState(false);

    const selectedReference = Number((optionCards.find((option) => option.key === selectedSource) || defaultOption).amount || 0);
    const paidAmount = Number(amount || 0);
    const tooLow = selectedReference > 0 && paidAmount > 0 && paidAmount < (selectedReference * 0.7);
    const tooHigh = selectedReference > 0 && paidAmount > (selectedReference * 1.3);
    const isCashMode = paymentMode === 'cash';
    const hasCashSession = Boolean(cashSession?.transactionId);
    const canPay = Number.isFinite(paidAmount) && paidAmount > 0 && acknowledged && !tooLow && !tooHigh;

    useEffect(() => {
        if (!otpDeadlineMs) {
            setOtpSecondsLeft(0);
            return;
        }
        const update = () => {
            const next = Math.max(0, Math.floor((otpDeadlineMs - Date.now()) / 1000));
            setOtpSecondsLeft(next);
        };
        update();
        const iv = setInterval(update, 1000);
        return () => clearInterval(iv);
    }, [otpDeadlineMs]);

    const handleResendOtp = async () => {
        if (!cashSession?.transactionId) return;
        setResendingOtp(true);
        setError('');
        try {
            const data = await resendCashOtpPayment(cashSession.transactionId);
            setCashSession((prev) => ({
                ...(prev || {}),
                transactionId: data.transactionId || prev?.transactionId,
                maskedMobile: data.maskedMobile || prev?.maskedMobile,
                resendCount: Number(data.resendCount || (prev?.resendCount || 0)),
            }));
            setOtpDeadlineMs(new Date(data.otpExpiresAt).getTime());
            setOtpCode('');
            toast.success('OTP sent again to worker mobile.');
        } catch (e) {
            setError(e?.response?.data?.message || 'Failed to resend OTP.');
        } finally {
            setResendingOtp(false);
        }
    };

    const handlePay = async () => {
        if (!canPay) {
            setError('Please review the payment and confirm it is fair before continuing.');
            return;
        }

        if (!isCashMode && !confirmingPay) {
            setConfirmingPay(true);
            setError('');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const paymentPayload = {
                jobId: job._id,
                workerId: slot?.assignedWorker?._id || slot?.assignedWorker || '',
                slotId: slot?._id,
                skill: skill || slot?.skill || 'general',
                amount: paidAmount,
                priceSource: selectedSource,
                clientName: job?.clientName || 'Client',
                clientEmail: job?.clientEmail || '',
                clientPhone: job?.clientPhone || '',
            };

            if (isCashMode) {
                if (!hasCashSession) {
                    const data = await initiateCashOtpPayment(paymentPayload);
                    setCashSession({
                        transactionId: data.transactionId,
                        maskedMobile: data.maskedMobile,
                        resendCount: 0,
                    });
                    setOtpDeadlineMs(new Date(data.otpExpiresAt).getTime());
                    toast.success('OTP sent to worker mobile for cash payment verification.');
                    return;
                }

                if (!/^\d{6}$/.test(String(otpCode || '').trim())) {
                    setError('Please enter the 6-digit OTP sent to worker.');
                    return;
                }

                const data = await verifyCashOtpPayment({
                    transactionId: cashSession.transactionId,
                    otp: String(otpCode || '').trim(),
                });

                if (typeof onPaid === 'function') {
                    await onPaid(data);
                }
                toast.success(`Cash payment verified: ${fmtINR(paidAmount)}`);
                onClose();
                return;
            }

            const result = await initiateRazorpayPayment(paymentPayload);
            if (typeof onPaid === 'function') {
                await onPaid(result);
            }
            toast.success(`Payment successful: ${fmtINR(paidAmount)}`);
            onClose();
        } catch (e) {
            setError(e?.response?.data?.message || e?.message || 'Failed to complete payment.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalShell onClose={onClose}>
            <ModalHeader
                icon={<CheckCircle size={18} className="text-white" />}
                title="Pay Worker"
                subtitle={`${workerName || 'Worker'} · ${skill || 'Task'}`}
                gradient="from-emerald-500 to-green-600"
            />
            <div className="p-4 space-y-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <p className="text-sm text-emerald-700 font-semibold">
                        Select source and amount, then proceed to secure Razorpay checkout.
                    </p>
                </div>

                <div className="space-y-2">
                    {optionCards.map((option) => (
                        <button
                            key={option.key}
                            type="button"
                            onClick={() => {
                                setSelectedSource(option.key);
                                setAmount(String(option.amount || 0));
                                setConfirmingPay(false);
                                setError('');
                            }}
                            className={`w-full text-left rounded-xl border-2 px-3 py-2 transition-all ${selectedSource === option.key ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-bold text-gray-900">{option.label}</p>
                                    <p className="text-[11px] text-gray-500">Tap to use this amount as the starting point</p>
                                </div>
                                <p className="text-sm font-black text-emerald-700">{fmtINR(option.amount)}</p>
                            </div>
                        </button>
                    ))}
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Edit Amount</label>
                    <input
                        type="number"
                        min={1}
                        step="1"
                        value={amount}
                        onChange={(e) => {
                            setAmount(e.target.value);
                            setConfirmingPay(false);
                        }}
                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                    />
                    {tooLow && <p className="text-xs font-semibold text-red-600">Warning: amount is too low.</p>}
                    {tooHigh && <p className="text-xs font-semibold text-orange-600">Warning: amount is too high.</p>}
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Payment Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setPaymentMode('cash');
                                setConfirmingPay(false);
                                setError('');
                            }}
                            className={`rounded-xl border-2 px-3 py-2 text-sm font-bold transition-all ${isCashMode ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
                        >
                            Pay Cash
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setPaymentMode('online');
                                setConfirmingPay(false);
                                setError('');
                            }}
                            className={`rounded-xl border-2 px-3 py-2 text-sm font-bold transition-all ${!isCashMode ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
                        >
                            Pay Online
                        </button>
                    </div>
                </div>

                <label className="flex items-start gap-2.5 p-3 bg-white border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                        type="checkbox"
                        checked={acknowledged}
                        onChange={(e) => {
                            setAcknowledged(e.target.checked);
                            setConfirmingPay(false);
                        }}
                        className="mt-0.5 accent-emerald-500"
                    />
                    <span className="text-xs text-gray-700 font-semibold leading-snug">
                        This is the final and fair prize with coordination of worker.
                    </span>
                </label>

                {error && <InlineAlert msg={error} type="error" />}

                {confirmingPay && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-xs text-emerald-800 font-semibold">
                            Confirm payment of {fmtINR(paidAmount)} to {workerName || 'this worker'} and continue to Razorpay checkout.
                        </p>
                    </div>
                )}

                {isCashMode && hasCashSession && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                        <p className="text-xs text-amber-800 font-semibold">
                            OTP sent to worker mobile {cashSession?.maskedMobile || ''}. Enter OTP to confirm cash payment.
                        </p>
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => {
                                setOtpCode(String(e.target.value || '').replace(/\D/g, '').slice(0, 6));
                                setError('');
                            }}
                            placeholder="Enter 6-digit OTP"
                            className="w-full border-2 border-amber-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                        />
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-amber-700 font-semibold">
                                Valid for: {pad2(Math.floor(otpSecondsLeft / 60))}:{pad2(otpSecondsLeft % 60)}
                            </span>
                            <button
                                type="button"
                                onClick={handleResendOtp}
                                disabled={resendingOtp}
                                className="text-[11px] font-bold text-amber-700 hover:text-amber-800 disabled:opacity-50"
                            >
                                {resendingOtp ? 'Sending…' : 'Send OTP Again'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <ModalFooter
                onClose={() => {
                    if (!isCashMode && confirmingPay) {
                        setConfirmingPay(false);
                        return;
                    }
                    onClose();
                }}
                closeLabel={!isCashMode && confirmingPay ? 'Back' : 'Cancel'}
                onAction={handlePay}
                actionLabel={
                    loading
                        ? (isCashMode ? 'Processing…' : 'Opening Razorpay…')
                        : isCashMode
                            ? (hasCashSession ? 'Verify OTP & Mark Paid' : 'Send OTP')
                            : (confirmingPay ? 'Proceed To Razorpay' : 'Pay Now')
                }
                actionClass="bg-emerald-500 hover:bg-emerald-600"
                disabled={loading || !canPay || (isCashMode && hasCashSession && !/^\d{6}$/.test(String(otpCode || '').trim()))}
                loading={loading}
            />
        </ModalShell>
    );
};

const CompleteJobModal = ({ job, onClose, onComplete }) => {
    const completionSlots = (job?.workerSlots || []).filter((slot) => slot.assignedWorker && !['cancelled', 'open', 'reposted'].includes(slot.status));

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [confirmationChecked, setConfirmationChecked] = useState(false);

    const paidSlots = completionSlots.filter((slot) => Number(slot?.finalPaidPrice || 0) > 0);

    const canComplete = completionSlots.length > 0 && paidSlots.length === completionSlots.length && confirmationChecked;

    const handle = async () => {
        if (!confirmationChecked) {
            setError('Please confirm that you have paid each worker before completing the job.');
            return;
        }

        if (paidSlots.length !== completionSlots.length) {
            setError('Please pay each worker individually before completing the job.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            await onComplete(job._id, { manualComplete: true });
            onClose();
        } catch (e) {
            setError(e?.response?.data?.message || 'Failed to complete job.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalShell onClose={onClose}>
            <ModalHeader
                icon={<CheckCircle size={18} className="text-white"/>}
                title="Complete Job"
                subtitle={job?.title || 'Confirm completion'}
                gradient="from-emerald-500 to-green-600"
            />
            <div className="p-4 space-y-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <p className="text-xs text-emerald-700 font-semibold">Confirm that every assigned worker has already been paid individually before closing the job.</p>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {completionSlots.map((slot) => (
                        <div key={slot._id} className="border border-gray-200 rounded-xl p-3 bg-white">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <p className="text-sm font-bold text-gray-900 capitalize">{slot.skill}</p>
                                <p className="text-[11px] text-gray-500">{slot?.assignedWorker?.name || 'Worker'}</p>
                            </div>
                            <p className="text-[11px] text-slate-500">Payment recorded: {Number(slot.finalPaidPrice || 0) > 0 ? fmtINR(slot.finalPaidPrice) : 'Not paid yet'}</p>
                        </div>
                    ))}
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <p className="text-xs text-emerald-700 font-semibold">Paid workers: {paidSlots.length}/{completionSlots.length}</p>
                </div>

                <label className="flex items-start gap-2.5 p-3 bg-white border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                        type="checkbox"
                        checked={confirmationChecked}
                        onChange={(e) => setConfirmationChecked(e.target.checked)}
                        className="mt-0.5 accent-emerald-500"
                    />
                    <span className="text-xs text-gray-700 font-semibold leading-snug">
                        Have you paid each worker individually?
                    </span>
                </label>

                {error && <InlineAlert msg={error} type="error" />}
            </div>
            <ModalFooter
                onClose={onClose}
                closeLabel="Cancel"
                onAction={handle}
                actionLabel="Mark Completed"
                actionClass="bg-emerald-500 hover:bg-emerald-600"
                disabled={loading || !canComplete}
                loading={loading}
            />
        </ModalShell>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Cancel Modal
// ─────────────────────────────────────────────────────────────────────────────
const CancelModal = ({ job, onClose, onCancel }) => {
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError]   = useState('');

    const handle = async () => {
        if (!reason.trim()) { setError('Please provide a reason.'); return; }
        setLoading(true);
        try { await onCancel(job._id, reason); onClose(); }
        catch (e) { setError(e?.response?.data?.message||'Failed.'); }
        finally { setLoading(false); }
    };

    const workerCount = (job.workerSlots||[]).filter(s=>s.assignedWorker).length;

    return (
        <ModalShell onClose={onClose}>
            <ModalHeader icon={<XCircle size={18} className="text-white"/>} title="Cancel Job" subtitle={job.title} gradient="from-red-500 to-rose-500"/>
            <div className="p-5 space-y-4">
                {workerCount > 0 && (
                    <InlineAlert msg={`${workerCount} assigned worker(s) will be notified of this cancellation.`} type="warning"/>
                )}
                {error && <InlineAlert msg={error} type="error" onDismiss={()=>setError('')}/>}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Reason <span className="text-red-500">*</span></label>
                    <textarea rows={3} value={reason} onChange={e=>setReason(e.target.value)}
                        placeholder="Explain why you are cancelling…"
                        className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-red-400 focus:outline-none text-sm resize-none transition-all"/>
                </div>
            </div>
            <ModalFooter onClose={onClose} closeLabel="Keep Job" onAction={handle}
                actionLabel="Cancel Job" actionClass="bg-red-500 hover:bg-red-600" loading={loading}/>
        </ModalShell>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Remove Worker Modal
// ─────────────────────────────────────────────────────────────────────────────
const RemoveWorkerModal = ({ job, slotId, workerId, workerName, skill, onClose, onRemove }) => {
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError]   = useState('');

    const handle = async () => {
        if (!reason.trim()) { setError('Please provide a reason.'); return; }
        setLoading(true);
        try { await onRemove(job._id, workerId, slotId, reason); onClose(); }
        catch (e) { setError(e?.response?.data?.message||'Failed.'); }
        finally { setLoading(false); }
    };

    return (
        <ModalShell onClose={onClose}>
            <ModalHeader icon={<UserX size={18} className="text-white"/>} title="Remove Worker" subtitle={`${workerName} · ${skill}`} gradient="from-red-500 to-rose-500"/>
            <div className="p-5 space-y-4">
                <InlineAlert msg="Worker will be notified. The slot will reopen for other workers." type="warning"/>
                {error && <InlineAlert msg={error} type="error" onDismiss={()=>setError('')}/>}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Reason <span className="text-red-500">*</span></label>
                    <textarea rows={3} value={reason} onChange={e=>setReason(e.target.value)}
                        placeholder="Explain why you are removing this worker…"
                        className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-red-400 focus:outline-none text-sm resize-none transition-all"/>
                </div>
            </div>
            <ModalFooter onClose={onClose} onAction={handle}
                actionLabel="Remove Worker" actionClass="bg-red-500 hover:bg-red-600" loading={loading}/>
        </ModalShell>
    );
};

const RejectApplicantModal = ({ payload, onClose, onReject }) => {
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!payload) return null;

    const handle = async () => {
        const cleanReason = String(reason || '').trim();
        if (!cleanReason) {
            setError('Please provide a rejection reason.');
            return;
        }
        setLoading(true);
        try {
            await onReject(payload, cleanReason);
            onClose();
        } catch (e) {
            setError(e?.response?.data?.message || 'Failed to reject applicant.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalShell onClose={onClose}>
            <ModalHeader icon={<XCircle size={18} className="text-white" />} title="Reject Applicant" subtitle={`${payload.workerName || 'Worker'} · ${payload.skill || 'Skill'}`} gradient="from-red-500 to-rose-500" />
            <div className="p-5 space-y-4">
                <InlineAlert msg="This reason will be sent to the worker in app notification and SMS." type="warning" />
                {error && <InlineAlert msg={error} type="error" onDismiss={() => setError('')} />}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Reason <span className="text-red-500">*</span></label>
                    <textarea
                        rows={3}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Explain why this application is rejected..."
                        className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-red-400 focus:outline-none text-sm resize-none transition-all"
                    />
                </div>
            </div>
            <ModalFooter onClose={onClose} onAction={handle} actionLabel="Reject Applicant" actionClass="bg-red-500 hover:bg-red-600" loading={loading} />
        </ModalShell>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Repost Modal
// ─────────────────────────────────────────────────────────────────────────────
const RepostModal = ({ job, slot, onClose, onRepost }) => {
    const today  = () => { const d=new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; };
    const [date, setDate]     = useState(today());
    const [time, setTime]     = useState('');
    const [loading, setLoad]  = useState(false);
    const [error, setError]   = useState('');

    const handle = async () => {
        if (!time) { setError('Please select a start time.'); return; }
        const [h, m] = time.split(':').map(Number);
        const dt = new Date(date); dt.setHours(h,m,0,0);
        if ((dt.getTime()-Date.now())/60000 < 30) { setError('Must be at least 30 minutes from now.'); return; }
        const total = h*60+m;
        if (total<360||total>1260) { setError('Must be between 6:00 AM and 9:00 PM.'); return; }
        setLoad(true);
        try {
            const { data } = await repostMissingSkill(job._id, slot._id?.toString(), date, time);
            toast.success(`${slot.skill} sub-task created!`);
            onRepost(job._id, data.job);
            onClose();
        } catch (e) { setError(e?.response?.data?.message||'Failed.'); }
        finally { setLoad(false); }
    };

    const budgetBlock = job.budgetBreakdown?.breakdown?.find(b=>b.skill===slot.skill);
    const perWorker   = budgetBlock ? Math.round(budgetBlock.subtotal/(budgetBlock.count||1)) : null;

    return (
        <ModalShell onClose={onClose}>
            <ModalHeader icon={<RefreshCw size={18} className="text-white"/>} title="Repost Missing Skill" subtitle={`Create sub-task for ${slot.skill}`}/>
            <div className="p-5 space-y-4">
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-orange-700 capitalize text-sm">{slot.skill}</span>
                        {perWorker && <span className="font-black text-green-600 text-sm">{fmtINR(perWorker)}</span>}
                    </div>
                    <p className="text-xs text-orange-500">{slot.hoursEstimated}h estimated</p>
                </div>
                {error && <InlineAlert msg={error} type="error" onDismiss={()=>setError('')}/>}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">Start Date <span className="text-red-500">*</span></label>
                        <input type="date" min={today()} value={date} onChange={e=>setDate(e.target.value)}
                            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none text-sm transition-all"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">Start Time <span className="text-red-500">*</span></label>
                        <input type="time" value={time} onChange={e=>setTime(e.target.value)}
                            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none text-sm transition-all"/>
                    </div>
                </div>
                <p className="text-xs text-gray-400">6:00 AM – 9:00 PM · at least 30 min from now</p>
            </div>
            <ModalFooter onClose={onClose} onAction={handle}
                actionLabel="Create Sub-task" loading={loading} disabled={!date||!time}/>
        </ModalShell>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Job Card
// ─────────────────────────────────────────────────────────────────────────────
const JobPreviewModal = ({
    job, alert, suggestions, loadingSuggestions, invitingWorkers,
    starredWorkers, onClose, onSelectWorker, onRatingJob, onCancelJob,
    onRemoveWorker, onRepostData, onClearAlert, onOpenPhoto, handlers, onTrackWorkers,
}) => {
    const startInfo = useStartCountdown(job);
    const isDirectHire = String(job?.hireMode || '').toLowerCase() === 'direct';
    const [selectedInviteSkill, setSelectedInviteSkill] = useState('');
    const finalPaidNum = Number(job?.pricingMeta?.finalPaidPrice || 0);
    const hasFinalPaid = finalPaidNum > 0;
    const totalSlots = (job.workerSlots || []).length;
    const openSlots = (job.workerSlots || []).filter((s) => s.status === 'open').length;
    const filledSlots = (job.workerSlots || []).filter((s) => s.status === 'filled').length;
    const doneSlots = (job.workerSlots || []).filter((s) => s.status === 'task_completed').length;
    const pendingApps = (job.applicants || []).filter((a) => a.status === 'pending');
    const subTaskCount = (job.subTasks || []).filter((s) => s.status !== 'cancelled').length;
    const assignedSlots = (job.workerSlots || []).filter((s) => s.assignedWorker && !['open', 'cancelled', 'not_required', 'reposted'].includes(s.status));
    const subTaskSlots = (job.subTasks || []).filter((s) => s.assignedWorker && s.status !== 'cancelled');
    const unratedSlots = [...assignedSlots.filter((s) => !s.ratingSubmitted), ...subTaskSlots.filter((s) => !s.ratingSubmitted)];
    const jobSuggestions = suggestions[job._id] || [];
    const isLoadSugg = loadingSuggestions[job._id];
    const isInviting = invitingWorkers[job._id];
    const invitable = jobSuggestions.filter((w) => !handlers.getLifecycle(job, w._id));
    const statusCfg = getStatusCfg(job.status);
    const StatusIcon = statusCfg.Icon;
    const locationLabel = getJobLocationLabel(job.location);
    const locationUnitLabel = getJobLocationUnitLabel(job.location);
    const hasCoordinates = Number.isFinite(Number(job.location?.lat)) && Number.isFinite(Number(job.location?.lng));
    const repostWindow = getRepostWindowState(job);
    const primaryImage = job.photos?.[0] ? getImageUrl(job.photos[0]) : '';
    const inviteSkillOptions = Array.from(new Set([
        ...((job.workerSlots || [])
            .filter((slot) => slot.status === 'open')
            .map((slot) => String(slot.skill || '').trim())
            .filter(Boolean)),
        ...((job.skills || [])
            .map((skill) => String(skill || '').trim())
            .filter(Boolean)),
    ]));

    useEffect(() => {
        if (inviteSkillOptions.length === 0) {
            setSelectedInviteSkill('');
            return;
        }
        setSelectedInviteSkill((prev) => {
            if (prev && inviteSkillOptions.includes(prev)) return prev;
            return inviteSkillOptions[0];
        });
    }, [job?._id]);

    return (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
            <div className={`relative w-full max-w-6xl rounded-3xl shadow-2xl overflow-hidden my-4 ${isDirectHire ? 'bg-amber-50' : 'bg-white'}`}>
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/95 text-gray-700 shadow-lg hover:bg-gray-100 transition-all"
                    aria-label="Close job preview"
                >
                    <X size={18} />
                </button>

                <div className="max-h-[calc(100vh-2rem)] overflow-y-auto">
                    <div className={`px-5 py-5 sm:px-6 sm:py-6 border-b ${isDirectHire ? 'border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50' : 'border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50'}`}>
                        <div className="flex flex-col lg:flex-row gap-5">
                            {primaryImage && (
                                <button
                                    type="button"
                                    onClick={() => onOpenPhoto(primaryImage)}
                                    className="lg:w-72 w-full shrink-0 overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm"
                                    title="Open uploaded image"
                                >
                                    <img
                                        src={primaryImage}
                                        alt={job.title}
                                        className="w-full h-44 lg:h-52 object-cover"
                                    />
                                </button>
                            )}

                            <div className="flex-1 min-w-0 space-y-3">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div className="min-w-0">
                                        <h2 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight">{job.title}</h2>
                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border} flex items-center gap-1`}>
                                                <StatusIcon size={10} />{statusCfg.label}
                                            </span>
                                            {job.urgent && <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-bold">⚡ Urgent</span>}
                                            <span className="text-[10px] bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full font-bold">{job.skills?.length || 0} skill{(job.skills?.length || 0) === 1 ? '' : 's'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                                    <div className="rounded-2xl border border-gray-100 bg-white p-3">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Workers</p>
                                        <p className="text-sm font-black text-gray-900 mt-1">{job.workersRequired || totalSlots || 0} required</p>
                                        <p className="text-[11px] text-gray-500 mt-0.5">{filledSlots} assigned · {pendingApps.length} pending</p>
                                    </div>
                                    <div className="rounded-2xl border border-gray-100 bg-white p-3">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date & Time</p>
                                        <p className="text-sm font-black text-gray-900 mt-1">{fmtDate(job.scheduledDate)}</p>
                                        <p className="text-[11px] text-gray-500 mt-0.5">{job.scheduledTime || '—'}</p>
                                    </div>
                                    <div className="rounded-2xl border border-gray-100 bg-white p-3">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Countdown</p>
                                        <p className="text-sm font-black text-gray-900 mt-1">{startInfo.hasSchedule ? startInfo.remaining : '—'}</p>
                                        <p className="text-[11px] text-gray-500 mt-0.5">{startInfo.hasSchedule ? (startInfo.canStart ? 'Ready to start' : 'Live countdown HH:MM') : 'No schedule set'}</p>
                                    </div>
                                    <div className="rounded-2xl border border-gray-100 bg-white p-3">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Location</p>
                                        <p className="text-sm font-black text-gray-900 mt-1 truncate" title={locationLabel}>{locationLabel}</p>
                                        {locationUnitLabel ? <p className="text-[11px] text-gray-500 mt-0.5 truncate" title={locationUnitLabel}>{locationUnitLabel}</p> : null}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (hasCoordinates) {
                                                    const mapUrl = `https://www.google.com/maps?q=${job.location.lat},${job.location.lng}`;
                                                    window.open(mapUrl, '_blank');
                                                }
                                            }}
                                            disabled={!hasCoordinates}
                                            className="text-[11px] text-blue-600 font-semibold hover:text-blue-700 mt-0.5 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {hasCoordinates ? 'View on Google Maps' : 'Location not available'}
                                        </button>
                                    </div>
                                </div>

                                {isDirectHire && (
                                    <div className="rounded-2xl border border-amber-200 bg-white p-3">
                                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Direct Hire Skill Cost</p>
                                        <p className="text-sm font-black text-gray-900 mt-1">{fmtINR(getDirectHireEstimatedAmount(job) || job?.payment || 0)}</p>
                                        <p className="text-[11px] text-gray-500 mt-0.5">Payment from Job Manage only</p>
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                                    <span className="inline-flex items-center gap-1">{fmtINR(job.payment)}</span>
                                    <span className="inline-flex items-center gap-1"><Calendar size={12} />{fmtDate(job.scheduledDate)}{job.scheduledTime ? ` · ${job.scheduledTime}` : ''}</span>
                                    {job.status === 'completed' && hasFinalPaid && <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">Final Paid: {fmtINR(finalPaidNum)}</span>}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <span className="px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-semibold border border-orange-100">Open: {openSlots}</span>
                                    <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100">Assigned: {filledSlots}</span>
                                    <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-100">Pending: {pendingApps.length}</span>
                                    {subTaskCount > 0 && <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100">Sub-tasks: {subTaskCount}</span>}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 sm:p-6 space-y-5">
                        {alert && !alert.slotId && <InlineAlert msg={alert.message} type={alert.type} onDismiss={() => onClearAlert(job._id)} />}

                        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Description</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{job.description}</p>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-3">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Job Details</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                    <div><span className="text-gray-500">Title:</span> <span className="font-semibold text-gray-800">{job.title}</span></div>
                                    <div><span className="text-gray-500">Skill(s):</span> <span className="font-semibold text-gray-800">{(job.skills || []).length ? job.skills.join(', ') : '—'}</span></div>
                                    <div><span className="text-gray-500">Workers Required:</span> <span className="font-semibold text-gray-800">{job.workersRequired || totalSlots || '—'}</span></div>
                                    <div><span className="text-gray-500">Duration:</span> <span className="font-semibold text-gray-800">{job.duration || '—'}</span></div>
                                    <div><span className="text-gray-500">Budget:</span> <span className="font-semibold text-gray-800">{fmtINR(job.payment)}</span></div>
                                    <div><span className="text-gray-500">Estimated Cost:</span> <span className="font-semibold text-gray-800">{fmtINR(job.totalEstimatedCost || job.payment || getDirectHireEstimatedAmount(job))}</span></div>
                                    <div><span className="text-gray-500">Rate Basis:</span> <span className="font-semibold text-gray-800">{String(job?.duration || '').toLowerCase().includes('visit') ? '/visit' : (String(job?.duration || '').toLowerCase().includes('day') ? '/day' : '/hour')}</span></div>
                                    <div className="sm:col-span-2"><span className="text-gray-500">Live Location:</span> <span className="font-semibold text-gray-800">{locationLabel}</span></div>
                                    <div><span className="text-gray-500">Building / Home:</span> <span className="font-semibold text-gray-800">{job.location?.buildingName || '—'}</span></div>
                                    <div><span className="text-gray-500">Flat / Home No.:</span> <span className="font-semibold text-gray-800">{job.location?.unitNumber || '—'}</span></div>
                                    <div><span className="text-gray-500">Floor:</span> <span className="font-semibold text-gray-800">{job.location?.floorNumber || '—'}</span></div>
                                    {job.pricingMeta?.priceSource && <div><span className="text-gray-500">Price Source:</span> <span className="font-semibold text-gray-800 capitalize">{job.pricingMeta.priceSource}</span></div>}
                                    {job.pricingMeta?.finalPaidPrice > 0 && <div><span className="text-gray-500">Final Paid:</span> <span className="font-semibold text-emerald-700">{fmtINR(job.pricingMeta.finalPaidPrice)}</span></div>}
                                </div>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-3">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Uploaded Images</p>
                                {job.photos?.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {job.photos.map((photo, index) => {
                                            const photoUrl = getImageUrl(photo);
                                            return (
                                                <button
                                                    key={`${job._id}-photo-${index}`}
                                                    type="button"
                                                    onClick={() => onOpenPhoto(photoUrl)}
                                                    className="overflow-hidden rounded-xl border border-gray-200 hover:border-orange-300 transition-colors"
                                                    title="Open uploaded image"
                                                >
                                                    <img src={photoUrl} alt={`Job ${index + 1}`} className="h-28 w-full object-cover" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">No images were uploaded for this job.</p>
                                )}
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-3">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Worker Slots ({doneSlots}/{totalSlots} complete)</p>
                            {job.workerSlots?.length > 0 ? (
                                <div className="space-y-3">
                                    {job.workerSlots.map((slot, index) => {
                                        const sc = getSlotCfg(slot.status);
                                        const SlotIc = sc.Icon;
                                        const worker = slot.assignedWorker;
                                        const workerId = (worker?._id || worker)?.toString();
                                        const slotBudget = getSkillBudgetInfo(job, slot.skill);
                                        const slotApplicants = (job.applicants || []).filter((app) => normalizeText(app.skill || slot.skill) === normalizeText(slot.skill));
                                        const pendingForSlot = slotApplicants.filter((app) => app.status === 'pending');
                                        const acceptedForSlot = slotApplicants.filter((app) => app.status === 'accepted');
                                        const assignedApplicant = slotApplicants.find((app) => {
                                            const applicantWorkerId = String(app?.workerId?._id || app?.workerId || '');
                                            return applicantWorkerId === String(workerId || '');
                                        });
                                        const slotQuotedAmount = Number(
                                            assignedApplicant?.quotedPrice
                                            ?? slot?.workerQuotedPrice
                                            ?? slot?.quotedPrice
                                            ?? 0,
                                        );
                                        const slotAlert = alert && String(alert.slotId || '') === String(slot._id || '');
                                        const slotPaidFromSlot = Number(slot.finalPaidPrice || 0);
                                        const paidFromMeta = (job?.pricingMeta?.skillFinalPaid || []).find((entry) => {
                                            const sameSlot = String(entry?.slotId || '') === String(slot?._id || '');
                                            const sameWorker = String(entry?.workerId || '') === String(workerId || '');
                                            const sameSkill = normalizeText(entry?.skill) === normalizeText(slot?.skill);
                                            return sameSlot || (sameWorker && sameSkill);
                                        });
                                        const slotPaidAmount = slotPaidFromSlot > 0
                                            ? slotPaidFromSlot
                                            : Number(paidFromMeta?.amount || 0);
                                        const isSlotPaid = slotPaidAmount > 0;

                                        return (
                                            <div key={slot._id || index} className="rounded-2xl border border-gray-100 bg-gray-50 p-3 sm:p-4 space-y-3">
                                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-sm font-black text-gray-900 capitalize">{slot.skill}</span>
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sc.bg} ${sc.color} flex items-center gap-1`}>
                                                                <SlotIc size={9} />{sc.label}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2 mt-1 text-[11px] text-gray-500">
                                                            <span>{formatHoursAsDuration(slot.hoursEstimated || slotBudget.hours || 0)}</span>
                                                            <span>•</span>
                                                            <span>{job.scheduledDate ? `${fmtDate(job.scheduledDate)}${job.scheduledTime ? ` · ${job.scheduledTime}` : ''}` : 'No job date set'}</span>
                                                            {slotBudget.costPerWorker ? <span>•</span> : null}
                                                            {slotBudget.costPerWorker ? <span>Skill cost: {fmtINR(slotBudget.costPerWorker)}</span> : null}
                                                            {job.negotiable && slotBudget.negotiationAmount ? <span>•</span> : null}
                                                            {job.negotiable && slotBudget.negotiationAmount && <span className="text-orange-700 font-semibold">Negotiable Amount: {fmtINR(slotBudget.negotiationAmount)}</span>}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        {worker ? (
                                                            <button onClick={() => onSelectWorker(worker)} className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left">
                                                                <img src={getImageUrl(worker?.photo)} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-white shadow-sm" onError={(e) => { e.target.src = '/admin.png'; }} />
                                                                <span className="text-sm font-semibold text-gray-800 truncate max-w-[160px]">{worker?.name}</span>
                                                            </button>
                                                        ) : (
                                                            <span className="text-xs text-gray-400 italic">{slot.status === 'not_required' ? 'Not required' : slot.status === 'reposted' ? 'Sub-task created' : 'Unfilled'}</span>
                                                        )}
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sc.bg} ${sc.color} flex items-center gap-1`}>
                                                            <SlotIc size={9} />{sc.label}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-3 text-[11px] text-gray-500">
                                                    <span>Applied: {slotApplicants.length}</span>
                                                    <span>Pending: {pendingForSlot.length}</span>
                                                    <span>Assigned: {worker ? 1 : 0}</span>
                                                </div>

                                                {worker && (
                                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                                                        <div className="rounded-xl bg-white border border-gray-200 px-3 py-2"><span className="text-gray-500">Assigned Cost:</span> <span className="font-semibold text-gray-800">{slotBudget.costPerWorker ? fmtINR(slotBudget.costPerWorker) : '—'}</span></div>
                                                        <div className="rounded-xl bg-white border border-gray-200 px-3 py-2"><span className="text-gray-500">Duration:</span> <span className="font-semibold text-gray-800">{formatHoursAsDuration(slot.hoursEstimated || slotBudget.hours || 0)}</span></div>
                                                        <div className="rounded-xl bg-white border border-gray-200 px-3 py-2"><span className="text-gray-500">Job Date/Time:</span> <span className="font-semibold text-gray-800">{fmtDate(job.scheduledDate)} {job.scheduledTime || ''}</span></div>
                                                        <div className="rounded-xl bg-white border border-gray-200 px-3 py-2"><span className="text-gray-500">Worker Quoted:</span> <span className="font-semibold text-emerald-700">{slotQuotedAmount > 0 ? fmtINR(slotQuotedAmount) : '—'}</span></div>
                                                    </div>
                                                )}

                                                {pendingForSlot.length > 0 && (
                                                    <div className="space-y-2">
                                                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Applied Workers</p>
                                                        <div className="space-y-2">
                                                            {pendingForSlot.slice(0, 5).map((app, appIndex) => {
                                                                const pendingWorker = app.workerId;
                                                                return (
                                                                    <div key={`${slot._id || index}-app-${appIndex}`} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-3 py-2.5 gap-3">
                                                                        <button onClick={() => onSelectWorker(pendingWorker)} className="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-opacity">
                                                                            <img src={getImageUrl(pendingWorker?.photo)} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm" onError={(e) => { e.target.src = '/admin.png'; }} />
                                                                            <div className="min-w-0 text-left">
                                                                                <p className="text-sm font-bold text-gray-800 truncate">{pendingWorker?.name || 'Worker'}</p>
                                                                                <p className="text-[10px] text-blue-600 capitalize">{app.skill || slot.skill}</p>
                                                                                {Number(app?.quotedPrice || 0) > 0 && <p className="text-[10px] text-emerald-700 font-semibold">Quoted: {fmtINR(app.quotedPrice)}</p>}
                                                                                <p className={`text-[10px] ${getCommuteTone(app?.commute)}`}>{formatCommuteHint(app?.commute)}</p>
                                                                            </div>
                                                                        </button>
                                                                        <div className="flex gap-1.5 flex-shrink-0">
                                                                            <button onClick={() => handlers.respondApplicant(job._id, (pendingWorker?._id || pendingWorker)?.toString(), 'accepted', app.skill || slot.skill, '', slot._id)} className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-bold transition-all">Accept</button>
                                                                            <button
                                                                                onClick={() => handlers.openRejectApplicant({
                                                                                    jId: job._id,
                                                                                    wId: (pendingWorker?._id || pendingWorker)?.toString(),
                                                                                    skill: app.skill || slot.skill,
                                                                                    workerName: pendingWorker?.name || 'Worker',
                                                                                    slotId: slot._id,
                                                                                })}
                                                                                className="px-3 py-1.5 border border-red-200 text-red-500 hover:bg-red-50 rounded-lg text-xs font-bold transition-all"
                                                                            >
                                                                                Reject
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {slotAlert && (
                                                    <div className="pt-1">
                                                        <InlineAlert msg={alert.message} type={alert.type} onDismiss={() => onClearAlert(job._id)} />
                                                    </div>
                                                )}

                                                {acceptedForSlot.length > 0 && !worker && (
                                                    <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                                                        {acceptedForSlot.length} worker{acceptedForSlot.length === 1 ? '' : 's'} already accepted for this skill.
                                                    </div>
                                                )}

                                                {job.status === 'scheduled' && slot.status === 'open' && (
                                                    <div className="space-y-2">
                                                        {repostWindow.isInWindow ? (
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button onClick={() => onRepostData({ job, slot })} className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all">Repost</button>
                                                                <button onClick={() => handlers.dismissSkill(job._id, slot._id, slot.skill)} className="px-3 py-1.5 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-lg text-xs font-semibold transition-all">Skip</button>
                                                            </div>
                                                        ) : (
                                                            <div className="text-[11px] text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2 text-right">
                                                                {repostWindow.isPastStart
                                                                    ? 'Start time reached. This unfilled slot will be auto-cancelled.'
                                                                    : 'Repost/Skip opens only in the last 30 minutes before start.'}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {isSlotPaid ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold">
                                                            Paid: {fmtINR(slotPaidAmount)}
                                                        </span>
                                                    </div>
                                                ) : job.status === 'running' && ['filled', 'task_completed'].includes(slot.status) && workerId ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button onClick={() => handlers.payWorker({ jobId: job._id, workerId, slotId: slot._id, skill: slot.skill, workerName: worker?.name || 'Worker', job, slot })} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-all">Pay</button>
                                                    </div>
                                                ) : null}

                                                {['open', 'scheduled'].includes(job.status) && slot.status === 'filled' && workerId && (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button onClick={() => onRemoveWorker({ job, slotId: slot._id, workerId, workerName: worker?.name, skill: slot.skill })} className="px-3 py-1.5 border border-red-200 text-red-500 hover:bg-red-50 rounded-lg text-xs font-semibold transition-all">Remove</button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500">No worker slots defined for this job.</p>
                            )}
                        </div>

                        {!isDirectHire && ['open', 'scheduled'].includes(job.status) && (
                            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-4 sm:p-5">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                                    <p className="text-sm font-black text-indigo-700 flex items-center gap-1.5"><Sparkles size={13} /> Smart Suggestions</p>
                                    <div className="flex gap-2">
                                        <select
                                            value={selectedInviteSkill}
                                            onChange={(e) => setSelectedInviteSkill(e.target.value)}
                                            className="px-3 py-1.5 text-xs bg-white border border-indigo-200 text-indigo-700 rounded-lg font-bold"
                                            disabled={inviteSkillOptions.length === 0 || isInviting}
                                        >
                                            {inviteSkillOptions.length === 0 ? (
                                                <option value="">No open skills</option>
                                            ) : (
                                                inviteSkillOptions.map((skill) => (
                                                    <option key={`invite-skill-${skill}`} value={skill}>{skill}</option>
                                                ))
                                            )}
                                        </select>
                                        <button onClick={() => handlers.loadSuggestions(job._id)} disabled={isLoadSugg || isInviting} className="px-3 py-1.5 text-xs bg-white border border-indigo-200 text-indigo-600 rounded-lg font-bold hover:bg-indigo-50 disabled:opacity-50 transition-all">
                                            {isLoadSugg ? 'Finding…' : 'Find Matches'}
                                        </button>
                                        {jobSuggestions.length > 0 && (
                                            <button onClick={() => handlers.inviteWorkers(job._id, invitable.map((w) => w._id), selectedInviteSkill)} disabled={isInviting || invitable.length === 0 || !selectedInviteSkill} className="px-3 py-1.5 text-xs bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-bold disabled:opacity-50 transition-all">
                                                {isInviting ? 'Inviting…' : `Invite (${invitable.length})`}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {jobSuggestions.length === 0 ? (
                                    <p className="text-xs text-indigo-500">Click "Find Matches" to discover workers who match your job requirements.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {jobSuggestions.slice(0, 3).map((worker) => {
                                            const lifecycle = handlers.getLifecycle(job, worker._id);
                                            return (
                                                <div key={worker._id} className="bg-white border border-indigo-100 rounded-xl p-3 flex items-center gap-3">
                                                    <img src={getImageUrl(worker.photo)} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0 border-2 border-white shadow-sm" onError={(e) => { e.target.src = '/admin.png'; }} />
                                                    <div className="flex-1 min-w-0">
                                                        <button onClick={() => onSelectWorker(worker)} className="font-bold text-gray-900 text-sm hover:text-indigo-600 transition-colors">{worker.name}</button>
                                                        <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                                                            <span className="flex items-center gap-0.5"><Star size={9} />{(worker.avgStars || 0).toFixed(1)}</span>
                                                            <span className="flex items-center gap-0.5"><Award size={9} />{worker.points} pts</span>
                                                        </div>
                                                        <p className={`text-[10px] mt-0.5 ${getCommuteTone(worker?.commute)}`}>{formatCommuteHint(worker?.commute)}</p>
                                                    </div>
                                                    <div className="flex-shrink-0 text-right">
                                                        <p className="text-sm font-black text-indigo-600">{worker.matchPercent}%</p>
                                                        {!lifecycle ? (
                                                            <button onClick={() => handlers.inviteWorkers(job._id, [worker._id], selectedInviteSkill)} disabled={isInviting || !selectedInviteSkill} className="text-[10px] px-2 py-0.5 bg-indigo-500 text-white rounded-lg font-bold mt-0.5 disabled:opacity-50">Invite</button>
                                                        ) : (
                                                            <p className="text-[10px] text-gray-400 mt-0.5 capitalize">{lifecycle}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {['running', 'completed'].includes(job.status) && unratedSlots.length > 0 && (
                            <button onClick={() => onRatingJob(job)} className="w-full py-3 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-white font-black rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95">
                                <Star size={16} /> Rate Workers ({unratedSlots.length} remaining)
                            </button>
                        )}

                        {job.status === 'running' && (
                            <div>
                                <label className="flex items-center gap-2 cursor-pointer py-2.5 px-4 border-2 border-dashed border-orange-200 rounded-xl hover:border-orange-400 hover:bg-orange-50 transition-all">
                                    <Camera size={16} className="text-orange-400" />
                                    <span className="text-sm text-orange-600 font-semibold">Upload Completion Photos</span>
                                    <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handlers.uploadPhotos(job._id, e.target.files)} />
                                </label>
                            </div>
                        )}

                        {(job.completionPhotos || []).length > 0 && (
                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-3">Completion Photos</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {(job.completionPhotos || []).map((photo, index) => {
                                        const photoUrl = getImageUrl(photo);
                                        return (
                                            <div key={`${job._id}-completion-${index}`} className="relative rounded-xl overflow-hidden border border-emerald-200 bg-white hover:shadow-md transition-all">
                                                <button
                                                    type="button"
                                                    onClick={() => handlers.removeCompletionPhoto(job._id, index)}
                                                    className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full bg-black/70 hover:bg-red-500 text-white flex items-center justify-center transition-all"
                                                    aria-label="Delete completion photo"
                                                >
                                                    <X size={13} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenPhoto(photoUrl)}
                                                    className="w-full"
                                                >
                                                    <img src={photoUrl} alt={`Completion ${index + 1}`} className="h-24 w-full object-cover" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2 pt-1">
                            {job.status === 'scheduled' && !isDirectHire && (
                                <button onClick={() => handlers.startJob(job._id)} disabled={!startInfo.canStart} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95 ${startInfo.canStart ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                                    <Truck size={13} />{startInfo.canStart ? 'Start Job' : `Starts in ${startInfo.remaining}`}
                                </button>
                            )}
                            {job.status === 'running' && (
                                <button onClick={() => handlers.completeJob(job._id)} className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-all active:scale-95">
                                    <CheckCircle size={13} /> Complete Job
                                </button>
                            )}
                            {['scheduled', 'running'].includes(job.status) && (job.assignedTo || []).length > 0 && (
                                <button onClick={() => onTrackWorkers(job._id)} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95">
                                    <Navigation size={13} /> Track Workers
                                </button>
                            )}
                            {['open', 'scheduled'].includes(job.status) && (
                                <button onClick={() => onCancelJob(job)} className="px-4 py-2 border-2 border-red-200 text-red-500 hover:bg-red-50 rounded-xl text-sm font-bold transition-all active:scale-95">
                                    Cancel Job
                                </button>
                            )}
                            {job.status === 'open' && (
                                <button onClick={() => handlers.deleteJob(job._id)} className="px-4 py-2 border-2 border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl text-sm font-bold transition-all active:scale-95">
                                    Delete Post
                                </button>
                            )}
                            <button onClick={onClose} className="px-4 py-2 border-2 border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-bold transition-all active:scale-95">
                                Close Preview
                            </button>
                        </div>

                        {(job.qaAnswers || []).length > 0 && (
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
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const JobCard = ({ job, onViewDetails, onRefresh }) => {
    const startInfo = useStartCountdown(job);
    const isDirectHire = String(job?.hireMode || '').toLowerCase() === 'direct';
    const directHireCost = getDirectHireEstimatedAmount(job);
    const statusCfg = getStatusCfg(job.status);
    const StatusIcon = statusCfg.Icon;
    const primaryImage = job.photos?.[0] ? getImageUrl(job.photos[0]) : '';
    const totalSlots = (job.workerSlots || []).length;
    const assignedCount = (job.workerSlots || []).filter((slot) => slot.assignedWorker && !['open', 'cancelled', 'reposted'].includes(slot.status)).length;
    const pendingCount = (job.applicants || []).filter((app) => app.status === 'pending').length;
    const skillLabel = (job.skills || []).length ? job.skills.join(', ') : '—';
    const workerCountLabel = totalSlots > 0 ? `${assignedCount}/${totalSlots}` : `${job.workersRequired || 0}`;

    return (
        <div className={`h-full rounded-2xl border shadow-sm overflow-hidden hover:shadow-md transition-all ${isDirectHire ? 'bg-amber-50/60 border-amber-200' : 'bg-white border-gray-200'}`}>
            <div className="p-4 sm:p-5 h-full flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {primaryImage ? (
                        <img
                            src={primaryImage}
                            alt={job.title}
                            className="w-full sm:w-28 h-32 sm:h-24 rounded-2xl object-cover border border-gray-200 flex-shrink-0"
                        />
                    ) : null}

                    <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                    <h3 className="font-black text-gray-900 text-base sm:text-lg leading-snug truncate">{job.title}</h3>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border} flex items-center gap-1`}>
                                        <StatusIcon size={10} />{statusCfg.label}
                                    </span>
                                    {isDirectHire && (
                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-amber-100 text-amber-700 border-amber-200">
                                            Direct Hire
                                        </span>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                                    <span className="inline-flex items-center gap-1"><Users size={11} />{workerCountLabel} worker{(job.workersRequired || totalSlots || 0) === 1 ? '' : 's'}</span>
                                    <span className="inline-flex items-center gap-1"><Bookmark size={11} />{skillLabel}</span>
                                    <span className="inline-flex items-center gap-1"><Users size={11} />Assigned {assignedCount}</span>
                                    <span className="inline-flex items-center gap-1"><Users size={11} />Pending {pendingCount}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">{fmtINR(job.payment)}</span>
                            {isDirectHire && directHireCost > 0 && <span className="flex items-center gap-1 text-amber-700 font-semibold">Skill Cost {fmtINR(directHireCost)}</span>}
                            {job.scheduledDate && <span className="flex items-center gap-1"><Calendar size={11} />{fmtDate(job.scheduledDate)}{job.scheduledTime && ` · ${job.scheduledTime}`}</span>}
                            {startInfo.hasSchedule && <span className="flex items-center gap-1"><Clock size={11} />Starts in {startInfo.remaining}</span>}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {(job.skills || []).slice(0, 4).map((skill, index) => (
                                <span key={`${job._id}-skill-${index}`} className="px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 text-[11px] font-semibold border border-orange-100 capitalize">
                                    {skill}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
                        {job.status === 'completed' && Number(job?.pricingMeta?.finalPaidPrice || 0) > 0 && <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">Final Paid {fmtINR(job.pricingMeta.finalPaidPrice)}</span>}
                        {job.urgent && <span className="inline-flex items-center gap-1 text-red-600 font-semibold">⚡ Urgent</span>}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => onViewDetails(job._id)}
                            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition-all active:scale-95"
                        >
                            View Job Details
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
    { key: 'open',      label: 'Open'       },
    { key: 'scheduled', label: 'Scheduled'  },
    { key: 'running',   label: 'In Progress'},
    { key: 'completed', label: 'Completed'  },
    { key: 'cancelled', label: 'Cancelled'  },
];

export default function ClientJobManage() {
    const [jobs,           setJobs]          = useState([]);
    const [loading,        setLoading]       = useState(true);
    const [activeTab,      setActiveTab]     = useState('open');
    const [previewJobId,   setPreviewJobId]  = useState(null);
    const [trackingJobId,  setTrackingJobId] = useState(null);
    const [starredWorkers, setStarred]       = useState([]);
    const [alerts,         setAlerts]        = useState({});
    const [ratingJob,      setRatingJob]     = useState(null);
    const [completeJob_,   setCompleteJob]   = useState(null);
    const [cancelJob_,     setCancelJob]     = useState(null);
    const [removeWorker,   setRemoveWorker]  = useState(null);
    const [rejectApplicantData, setRejectApplicantData] = useState(null);
    const [repostData,     setRepostData]    = useState(null);
    const [suggestions,    setSuggestions]   = useState({});
    const [loadingSugg,    setLoadingSugg]   = useState({});
    const [inviting,       setInviting]      = useState({});
    const [previewPhoto,   setPreviewPhoto]  = useState('');
    const [payWorkerPrompt, setPayWorkerPrompt] = useState(null);

    // ── Fetch jobs ────────────────────────────────────────────────────────────
    const fetchJobs = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await getClientJobs();
            setJobs(Array.isArray(data) ? data : []);
            const user = JSON.parse(localStorage.getItem('user')||'{}');
            setStarred(user.starredWorkers?.map(id=>id?.toString())||[]);
        } catch { toast.error('Unable to load your jobs'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetchJobs();
        const iv = setInterval(fetchJobs, 60000);
        return () => clearInterval(iv);
    }, [fetchJobs]);

    // ── Alert helpers ─────────────────────────────────────────────────────────
    const setAlert   = (jId, msg, type='error', meta = {}) => setAlerts(p=>({...p,[jId]:{message:msg,type,...meta}}));
    const clearAlert = (jId) => setAlerts(p=>{ const n={...p}; delete n[jId]; return n; });

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleStarWorker = async (wId) => {
        try {
            const { data } = await toggleStarWorker(wId);
            setStarred(data.starredWorkers?.map(id=>id?.toString())||[]);
        } catch { toast.error('Unable to update favourite'); }
    };

    const handleOpenWorkerProfile = async (workerRef) => {
        const directKarigarId = workerRef?.karigarId || workerRef?.workerKarigarId;
        if (directKarigarId) {
            openWorkerProfilePreview(directKarigarId);
            return;
        }

        const workerMongoId = typeof workerRef === 'string'
            ? workerRef
            : (workerRef?._id || workerRef?.workerId || workerRef?.id);

        if (!workerMongoId) {
            toast.error('Worker profile is not available');
            return;
        }

        try {
            const { data } = await getWorkerFullProfile(workerMongoId);
            if (!data?.karigarId) {
                toast.error('Public profile is not available for this worker');
                return;
            }
            openWorkerProfilePreview(data.karigarId);
        } catch {
            toast.error('Unable to open worker profile');
        }
    };

    const handleRespondApplicant = async (jId, wId, status, skill, feedback = '', slotId = null) => {
        try {
            const payload = { workerId: wId, status, skill };
            if (status === 'rejected') payload.feedback = feedback;
            const { data } = await respondToApplicant(jId, payload);
            setJobs(p=>p.map(j=>j._id===jId?data.job:j));
            if (status==='accepted') {
                if (data?.notice) {
                    setAlert(jId, `${data.notice} Worker accepted for ${skill}.`, 'warning', { slotId, skill });
                } else {
                    setAlert(jId, `Worker accepted for ${skill}!`, 'success', { slotId, skill });
                }
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(pos=>{
                        initClientLocation(jId, pos.coords.latitude, pos.coords.longitude).catch(()=>null);
                    });
                }
            } else {
                setAlert(jId, `Applicant rejected for ${skill}.`, 'success', { slotId, skill });
            }
        } catch (e) { setAlert(jId, e?.response?.data?.message||'Failed.', e?.response?.status===409?'warning':'error', { slotId, skill }); }
    };

    const handleRejectApplicantWithReason = async (payload, reason) => {
        if (!payload) return;
        await handleRespondApplicant(payload.jId, payload.wId, 'rejected', payload.skill, reason, payload.slotId);
        setRejectApplicantData(null);
    };

    const handlePayWorker = async (payload) => {
        if (!payload) return;
        const targetJob = jobs.find((job) => job._id === payload.jobId);
        setPayWorkerPrompt({
            ...payload,
            jobTitle: targetJob?.title || '',
        });
    };

    const handleConfirmPayWorker = async (payload) => {
        if (!payload) return;
        const { jobId, workerId, slotId, skill, amount, priceSource } = payload;
        try {
            const { data } = await completeWorkerTask(jobId, workerId, slotId, {
                finalPaidPrice: amount,
                priceSource,
                workerQuotedPrice: amount,
            });
            setJobs(p=>p.map(j=>j._id===jobId?data.job:j));
            setAlert(jobId, `Payment done for ${skill}.`, 'success', { slotId, skill });
            setPayWorkerPrompt(null);
        } catch (e) { setAlert(jobId, e?.response?.data?.message||'Failed.', 'error', { slotId, skill }); }
    };

    const handleStartJob = async (jId) => {
        try {
            const { data } = await startJob(jId);
            setJobs(p=>p.map(j=>j._id===jId?data.job:j));
            setAlert(jId, 'Job started! Workers notified.', 'success');
        } catch (e) { setAlert(jId, e?.response?.data?.message||'Failed.', 'error'); }
    };

    const handleCompleteJob = async (jId) => {
        const targetJob = jobs.find((j) => j._id === jId);
        if (!targetJob) {
            toast.error('Job not found. Please refresh and try again.');
            return;
        }
        setCompleteJob(targetJob);
    };

    const handleConfirmCompleteJob = async (jId, slotFinalPaid, options = {}) => {
        try {
            const { data } = await updateJobStatus(jId, 'completed', { manualComplete: true });
            setJobs(p=>p.map(j=>j._id===jId?data.job:j));
            setCompleteJob(null);
            setAlert(jId, 'Job marked as completed.', 'success');
        } catch (e) {
            setAlert(jId, e?.response?.data?.message||'Failed.', 'error');
            throw e;
        }
    };

    const handleDeleteJob = async (jId) => {
        if (!window.confirm('Delete this job permanently?')) return;
        try {
            await deleteClientJob(jId);
            setJobs(p=>p.filter(j=>j._id!==jId));
            if (previewJobId === jId) setPreviewJobId(null);
            toast.success('Job deleted');
        } catch (e) { toast.error(e?.response?.data?.message||'Failed.'); }
    };

    const handleCancelJob = async (jId, reason) => {
        try {
            const { data } = await cancelJob(jId, reason);
            setJobs(p=>p.map(j=>j._id===jId?data.job:j));
            setAlert(jId, 'Job cancelled.', 'success');
        } catch (e) { setAlert(jId, e?.response?.data?.message||'Failed.', 'error'); }
    };

    const handleRemoveWorker = async (jId, wId, slotId, reason) => {
        try {
            const { data } = await removeAssignedWorker(jId, wId, reason, slotId);
            setJobs(p=>p.map(j=>j._id===jId?data.job:j));
            setAlert(jId, 'Worker removed.', 'success');
        } catch (e) { setAlert(jId, e?.response?.data?.message||'Failed.', 'error'); }
    };

    const handleDismissSkill = async (jId, slotId, skillName) => {
        if (!window.confirm(`Mark "${skillName}" as not required?`)) return;
        try {
            const { data } = await dismissMissingSkill(jId, slotId);
            setJobs(p=>p.map(j=>j._id===jId?data.job:j));
            setAlert(jId, `${skillName} dismissed.`, 'success');
        } catch (e) { setAlert(jId, e?.response?.data?.message||'Failed.', 'error'); }
    };

    const handleUploadPhotos = async (jId, files) => {
        if (!files.length) return;
        try {
            const fd = new FormData();
            Array.from(files).forEach(f=>fd.append('photos',f));
            const { data } = await uploadCompletionPhotos(jId, fd);
            setJobs(p=>p.map(j=>j._id===jId?{...j,completionPhotos:data.completionPhotos}:j));
            setAlert(jId, `${files.length} photo(s) uploaded!`, 'success');
        } catch (e) { setAlert(jId, e?.response?.data?.message||'Failed.', 'error'); }
    };

    const handleRemoveCompletionPhoto = async (jId, photoIndex) => {
        try {
            const { data } = await removeCompletionPhoto(jId, photoIndex);
            setJobs((p) => p.map((j) => (j._id === jId ? { ...j, completionPhotos: data.completionPhotos } : j)));
            setAlert(jId, 'Photo removed.', 'success');
        } catch (e) {
            setAlert(jId, e?.response?.data?.message || 'Failed.', 'error');
        }
    };

    const handleLoadSuggestions = async (jId) => {
        try {
            setLoadingSugg(p=>({...p,[jId]:true}));
            let rows = [];
            try {
                const { data } = await getSemanticWorkersForJob(jId, { topK:6, minScore:0.25 });
                rows = (data?.matches||[]);
            } catch {
                const { data } = await getJobSmartSuggestions(jId);
                rows = (data?.suggestions||[]);
            }
            const norm = rows.map(r=>{
                const w = r.worker||{};
                return {
                    _id:          r.workerId||r._id||w._id,
                    karigarId:    w.karigarId||r.karigarId||'',
                    name:         w.name||r.name||'',
                    photo:        w.photo||r.photo||'',
                    points:       Number(w.points||r.points||0),
                    avgStars:     Number(w.avgStars||r.avgStars||0),
                    matchPercent: Number(r.rankScorePercent || toPercent(r.score||r.semanticScore||0)),
                    commute:      r.commute || null,
                };
            });
            setSuggestions(p=>({...p,[jId]:norm}));
        } catch (e) { setAlert(jId, e?.response?.data?.message||'Failed.', 'error'); }
        finally { setLoadingSugg(p=>({...p,[jId]:false})); }
    };

    const handleInviteWorkers = async (jId, wIds, inviteSkill) => {
        if (!wIds.length) return;
        if (!String(inviteSkill || '').trim()) {
            setAlert(jId, 'Select a skill before sending invites.', 'warning');
            return;
        }
        try {
            setInviting(p=>({...p,[jId]:true}));
            const { data } = await inviteWorkersToJob(jId, wIds, inviteSkill);
            setAlert(jId, `${data?.invitedCount||wIds.length} worker(s) invited`, 'success');
            await Promise.all(wIds.map(wId=>recordSemanticFeedback({jobId:jId,workerId:wId,event:'invited',source:'client_ui'}).catch(()=>null)));
            await Promise.all([handleLoadSuggestions(jId), fetchJobs()]);
        } catch (e) { setAlert(jId, e?.response?.data?.message||'Failed.', 'error'); }
        finally { setInviting(p=>({...p,[jId]:false})); }
    };

    const getLifecycle = (job, wId) => {
        const s = String(wId);
        const assigned = new Set([
            ...(job.assignedTo||[]).map(w=>String(w?._id||w||'')),
            ...(job.workerSlots||[]).map(sl=>String(sl?.assignedWorker?._id||sl?.assignedWorker||'')),
        ]);
        if (assigned.has(s)) return 'assigned';
        const apps = (job.applicants||[]);
        if (apps.some(a=>String(a?.workerId?._id||a?.workerId||'')===s && a.status==='accepted')) return 'accepted';
        if (apps.some(a=>String(a?.workerId?._id||a?.workerId||'')===s && a.status==='pending'))  return 'pending';
        if ((job.invitedWorkers||[]).some(inv=>String(inv?.workerId?._id||inv?.workerId||'')===s)) return 'invited';
        return '';
    };

    // ── Filter jobs by tab ────────────────────────────────────────────────────
    const filtered = jobs.filter(j =>
        activeTab === 'cancelled' ? isCancelled(j.status) : j.status === activeTab
    );

    const tabCount = (key) =>
        jobs.filter(j => key==='cancelled' ? isCancelled(j.status) : j.status===key).length;

    const previewJob = previewJobId ? jobs.find((job) => job._id === previewJobId) : null;

    // ── Loading screen ────────────────────────────────────────────────────────
    if (loading && jobs.length === 0) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
                <Loader2 size={36} className="animate-spin text-orange-500 mx-auto mb-3"/>
                <p className="text-gray-500 text-sm font-medium">Loading your jobs…</p>
            </div>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">

                {/* ── HEADER ── */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-5 sm:p-6 mb-6 text-white shadow-lg">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <div className="flex items-center gap-2.5 mb-1.5">
                                <Briefcase size={22}/>
                                <h1 className="text-xl sm:text-2xl font-black">Manage Jobs</h1>
                            </div>
                            <p className="text-orange-100 text-sm">Track and manage all your posted jobs</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <button onClick={() => fetchJobs()} className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-sm font-bold transition-all active:scale-95 border border-white/20">
                                Refresh
                            </button>
                            <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
                                <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider">Total</p>
                                <p className="text-2xl font-black">{jobs.length}</p>
                            </div>
                            <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
                                <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider">Active</p>
                                <p className="text-2xl font-black">{jobs.filter(j=>j.status==='running').length}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── TABS ── */}
                <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
                    {TABS.map(tab => {
                        const count   = tabCount(tab.key);
                        const isActive = activeTab === tab.key;
                        return (
                            <button key={tab.key} onClick={()=>setActiveTab(tab.key)}
                                className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-all flex-shrink-0 flex items-center gap-2 ${
                                    isActive
                                        ? 'bg-orange-500 text-white shadow-md'
                                        : 'bg-white text-gray-600 border-2 border-gray-200 hover:border-orange-300'
                                }`}>
                                {tab.label}
                                {count > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${isActive?'bg-white/20 text-white':'bg-orange-100 text-orange-600'}`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* ── JOB LIST ── */}
                {filtered.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                        <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Briefcase size={28} className="text-orange-300"/>
                        </div>
                        <h3 className="text-base font-black text-gray-800 mb-1">No {TABS.find(t=>t.key===activeTab)?.label} Jobs</h3>
                        <p className="text-sm text-gray-400">
                            {activeTab === 'open' ? 'Post a new job to get started.' : 'Jobs will appear here once they match this status.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {filtered.map(job => (
                            <JobCard
                                key={job._id}
                                job={job}
                                onViewDetails={setPreviewJobId}
                                onRefresh={fetchJobs}
                            />
                        ))}
                    </div>
                )}

            </div>{/* ← closes max-w-4xl */}

            {/* ── MODALS ── */}
            <AnimatePresence>
                {previewJob && (
                    <JobPreviewModal
                        key={previewJob._id}
                        job={previewJob}
                        alert={alerts[previewJob._id]}
                        suggestions={suggestions}
                        loadingSuggestions={loadingSugg}
                        invitingWorkers={inviting}
                        starredWorkers={starredWorkers}
                        onClose={() => setPreviewJobId(null)}
                        onSelectWorker={handleOpenWorkerProfile}
                        onRatingJob={setRatingJob}
                        onCancelJob={setCancelJob}
                        onRemoveWorker={setRemoveWorker}
                        onRepostData={setRepostData}
                        onClearAlert={clearAlert}
                        onOpenPhoto={setPreviewPhoto}
                        handlers={{
                            respondApplicant: handleRespondApplicant,
                            openRejectApplicant: setRejectApplicantData,
                            payWorker:        handlePayWorker,
                            startJob:         handleStartJob,
                            completeJob:      handleCompleteJob,
                            deleteJob:        handleDeleteJob,
                            dismissSkill:     handleDismissSkill,
                            uploadPhotos:     handleUploadPhotos,
                            removeCompletionPhoto: handleRemoveCompletionPhoto,
                            loadSuggestions:  handleLoadSuggestions,
                            inviteWorkers:    handleInviteWorkers,
                            refreshJobs:      fetchJobs,
                            getLifecycle,
                        }}
                        onTrackWorkers={setTrackingJobId}
                    />
                )}
                {trackingJobId && (
                    <motion.div
                        key="tracking-modal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm p-3 sm:p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.98, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.98, opacity: 0 }}
                            className="h-full max-h-[calc(100vh-1.5rem)] overflow-hidden rounded-2xl shadow-2xl"
                        >
                            <ClientLiveTracking
                                embedded
                                jobId={trackingJobId}
                                onClose={() => setTrackingJobId(null)}
                            />
                        </motion.div>
                    </motion.div>
                )}
                {ratingJob && (
                    <RatingModal key="rate"
                        job={ratingJob}
                        onClose={()=>setRatingJob(null)}
                        onRated={() => fetchJobs()}
                    />
                )}
                {payWorkerPrompt && (
                    <PayWorkerModal
                        payload={payWorkerPrompt}
                        onClose={() => setPayWorkerPrompt(null)}
                        onPaid={async () => {
                            await fetchJobs();
                        }}
                    />
                )}
                {completeJob_ && (
                    <CompleteJobModal
                        key="complete"
                        job={completeJob_}
                        onClose={() => setCompleteJob(null)}
                        onComplete={handleConfirmCompleteJob}
                    />
                )}
                {cancelJob_ && (
                    <CancelModal key="cancel"
                        job={cancelJob_}
                        onClose={()=>setCancelJob(null)}
                        onCancel={handleCancelJob}
                    />
                )}
                {removeWorker && (
                    <RemoveWorkerModal key="remove"
                        {...removeWorker}
                        onClose={()=>setRemoveWorker(null)}
                        onRemove={handleRemoveWorker}
                    />
                )}
                {rejectApplicantData && (
                    <RejectApplicantModal
                        key="reject-applicant"
                        payload={rejectApplicantData}
                        onClose={() => setRejectApplicantData(null)}
                        onReject={handleRejectApplicantWithReason}
                    />
                )}
                {repostData && (
                    <RepostModal key="repost"
                        job={repostData.job}
                        slot={repostData.slot}
                        onClose={()=>setRepostData(null)}
                        onRepost={(jId,updatedJob)=>setJobs(p=>p.map(j=>j._id===jId?updatedJob:j))}
                    />
                )}
                {previewPhoto && (
                    <motion.div
                        key="photo-preview"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 z-[95] flex items-center justify-center p-4"
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
                                alt="Job preview"
                                className="w-full max-h-[85vh] object-contain rounded-xl border border-white/20"
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>/* ← closes min-h-screen */
    );
}
