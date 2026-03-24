// client/src/pages/client/ClientJobManage.jsx
// FULLY RESPONSIVE - Mobile-first design, touch-optimized

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getClientJobs, deleteClientJob, cancelJob, updateJobStatus,
    uploadCompletionPhotos, startJob, toggleJobApplications,
    removeAssignedWorker, completeWorkerTask, respondToApplicant,
    getJobSmartSuggestions, inviteWorkersToJob,
    submitRating, toggleStarWorker, getWorkerFullProfile, getImageUrl,
    repostMissingSkill, dismissMissingSkill, respondToSubTaskApplicant,
    completeSubTask,
    initClientLocation,
} from '../../api/index';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Briefcase, MapPin, Calendar, Clock, DollarSign, Users,
    Star, Shield, AlertCircle, CheckCircle, XCircle, Truck,
    Phone, Mail, ExternalLink, ChevronDown, ChevronUp,
    Navigation, Loader2, Award, TrendingUp, Zap, Gift,
    Search, Filter, RefreshCw, Eye, Bookmark, Share2,
    Building, Sparkles, Crown, Target, Layers, Heart,
    MessageCircle, Camera, Upload, ThumbsUp, Flag,
    Settings, UserCheck, UserX, UserPlus, Clock as ClockIcon
} from 'lucide-react';

// ── Helpers (Mobile Optimized) ────────────────────────────────────────────────────
const isCancelled = s => ['cancelled_by_client', 'cancelled'].includes(s);
const SLOT_SC = {
    open: 'bg-gradient-to-r from-gray-100 to-gray-50 text-gray-600 border border-gray-200',
    filled: 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200',
    task_completed: 'bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border border-emerald-200',
    cancelled: 'bg-gradient-to-r from-red-50 to-rose-50 text-red-400 border border-red-100',
    not_required: 'bg-gradient-to-r from-gray-100 to-gray-50 text-gray-400 border border-gray-200',
    reposted: 'bg-gradient-to-r from-purple-50 to-pink-50 text-purple-600 border border-purple-200'
};
const STATUS_C = {
    open: 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200',
    scheduled: 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200',
    running: 'bg-gradient-to-r from-yellow-50 to-amber-50 text-yellow-700 border border-yellow-200',
    completed: 'bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border border-emerald-200',
    cancelled_by_client: 'bg-gradient-to-r from-red-50 to-rose-50 text-red-600 border border-red-200',
    cancelled: 'bg-gradient-to-r from-red-50 to-rose-50 text-red-600 border border-red-200'
};
const STATUS_L = {
    open: 'Open', scheduled: 'Scheduled', running: 'Running',
    completed: 'Completed', cancelled_by_client: 'Cancelled', cancelled: 'Cancelled'
};

function SBadge({ status }) {
    return (
        <span className={`inline-flex items-center gap-1 text-[9px] sm:text-[10px] md:text-xs font-bold px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 rounded-full ${STATUS_C[status] || 'bg-gray-100 text-gray-500'}`}>
            {status === 'open' && <Zap size={10} />}
            {status === 'scheduled' && <Clock size={10} />}
            {status === 'running' && <Truck size={10} />}
            {status === 'completed' && <CheckCircle size={10} />}
            {STATUS_L[status] || status}
        </span>
    );
}

function Alert({ msg, type = 'error', onDismiss }) {
    if (!msg) return null;
    const styles = {
        error: 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200 text-red-700',
        success: 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 text-green-700',
        info: 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-700',
        warning: 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200 text-amber-700'
    };
    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`${styles[type]} rounded-xl px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-3 text-[10px] sm:text-[11px] md:text-sm flex items-start justify-between gap-2 border`}
        >
            <p className="leading-relaxed flex items-center gap-1 flex-1 flex-wrap">
                {type === 'error' && <AlertCircle size={12} className="flex-shrink-0" />}
                {type === 'success' && <CheckCircle size={12} className="flex-shrink-0" />}
                {type === 'warning' && <AlertCircle size={12} className="flex-shrink-0" />}
                {type === 'info' && <MessageCircle size={12} className="flex-shrink-0" />}
                <span className="break-words">{msg}</span>
            </p>
            {onDismiss && (
                <button onClick={onDismiss} className="flex-shrink-0 opacity-50 hover:opacity-100 font-bold text-base leading-none px-1">×</button>
            )}
        </motion.div>
    );
}

// ── Countdown hook with animation (Mobile Optimized) ─────────────────────────────
const pad2 = n => String(Math.max(0, n)).padStart(2, '0');
function useStartCountdown(job) {
    const [info, setInfo] = useState({ canStart: true, remaining: '00:00:00', progress: 100 });
    useEffect(() => {
        if (!job.scheduledDate || !job.scheduledTime || job.status !== 'scheduled') {
            setInfo({ canStart: true, remaining: '00:00:00', progress: 100 });
            return;
        }
        const update = () => {
            const [h, m] = job.scheduledTime.split(':').map(Number);
            const sched = new Date(job.scheduledDate);
            sched.setHours(h, m, 0, 0);
            const ms = sched.getTime() - Date.now();
            const tm = Math.max(0, Math.floor(ms / 60000));
            setInfo({
                canStart: ms <= 0,
                remaining: `${pad2(Math.floor(tm / 60))}:${pad2(tm % 60)}`,
                progress: ms <= 0 ? 100 : 100
            });
        };
        update();
        const t = setInterval(update, 1000);
        return () => clearInterval(t);
    }, [job._id, job.status, job.scheduledTime, job.scheduledDate]);
    return info;
}

// ── Worker Profile Modal (Enhanced & Mobile Optimized) ───────────────────────────
function WorkerModal({ workerId, onClose, onStar, starredIds = [] }) {
    const [w, setW] = useState(null);
    const [load, setLoad] = useState(true);
    useEffect(() => {
        (async () => {
            try {
                const { data } = await getWorkerFullProfile(workerId);
                setW(data);
            } catch { }
            finally { setLoad(false); }
        })();
    }, [workerId]);
    const starred = starredIds.includes(workerId?.toString());
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
                className="bg-white w-full sm:rounded-3xl shadow-2xl sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl"
                onClick={e => e.stopPropagation()}
            >
                {load ? (
                    <div className="flex items-center justify-center h-48">
                        <Loader2 size={28} className="animate-spin text-orange-500" />
                    </div>
                ) : !w ? null : (
                    <>
                        <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-red-500 px-4 sm:px-5 md:px-6 pt-4 sm:pt-5 md:pt-6 pb-3 sm:pb-4 md:pb-5 z-10">
                            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                                <img
                                    src={getImageUrl(w.photo)}
                                    alt={w.name}
                                    className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl object-cover border-2 border-white shadow-lg"
                                    onError={e => { e.target.src = '/admin.png'; }}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1 flex-wrap">
                                        <h2 className="font-black text-white text-sm sm:text-base md:text-xl truncate">{w.name}</h2>
                                        {w.verificationStatus === 'approved' && (
                                            <span className="text-[8px] bg-white/20 text-white px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                                                <CheckCircle size={8} /> Verified
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-white/80 text-[8px] sm:text-[9px] md:text-xs mt-0.5 font-mono truncate">{w.karigarId} · 📞 {w.mobile || 'N/A'}</p>
                                    <div className="flex items-center gap-2 mt-1 text-[8px] text-white/90">
                                        <span className="flex items-center gap-0.5">⭐ {w.avgStars?.toFixed(1) || '—'}</span>
                                        <span className="flex items-center gap-0.5">💼 {w.completedJobs || 0}</span>
                                        <span className="flex items-center gap-0.5">🏆 {w.points || 0} pts</span>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => onStar(workerId)}
                                        className={`w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center text-sm md:text-lg transition-all ${starred ? 'bg-yellow-400 text-white shadow-lg' : 'bg-white/20 text-white/80 hover:bg-white/30'}`}
                                    >
                                        {starred ? '★' : '☆'}
                                    </button>
                                    <button
                                        onClick={onClose}
                                        className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-xs md:text-base"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="px-4 sm:px-5 md:px-6 py-4 md:py-5 space-y-3 md:space-y-5">
                            {w.skills?.length > 0 && (
                                <div>
                                    <p className="text-[9px] sm:text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                        <Zap size={12} /> Skills
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {w.skills.map((s, i) => (
                                            <span key={i} className="text-[9px] sm:text-[10px] bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 px-2 py-1 rounded-full font-semibold capitalize border border-purple-200">
                                                {s?.name || s}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {w.ratings?.length > 0 && (
                                <div>
                                    <p className="text-[9px] sm:text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                        <Star size={12} /> Recent Reviews
                                    </p>
                                    <div className="space-y-1.5">
                                        {w.ratings.slice(0, 3).map((r, i) => (
                                            <div key={i} className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                                                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                                    <img
                                                        src={getImageUrl(r.client?.photo)}
                                                        alt=""
                                                        className="w-5 h-5 rounded-full object-cover"
                                                        onError={e => { e.target.src = '/admin.png'; }}
                                                    />
                                                    <span className="text-[9px] font-semibold text-gray-700 truncate">{r.client?.name}</span>
                                                    <div className="flex text-yellow-400 text-[9px]">
                                                        {'★'.repeat(r.stars || 0)}
                                                        {'☆'.repeat(5 - (r.stars || 0))}
                                                    </div>
                                                    {r.skill && <span className="text-[8px] text-gray-400 capitalize truncate">{r.skill}</span>}
                                                </div>
                                                {r.message && <p className="text-[8px] text-gray-500 line-clamp-2">{r.message}</p>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </motion.div>
        </motion.div>
    );
}

// ── Repost Missing Skill Modal (Mobile Optimized) ─────────────────────────────────────
function RepostModal({ job, slot, onClose, onReposted }) {
    const todayStr = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const [newDate, setNewDate] = useState(todayStr());
    const [newTime, setNewTime] = useState('');
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState('');

    const budgetBlock = job.budgetBreakdown?.breakdown?.find(b => b.skill === slot.skill);
    const perWorker = budgetBlock ? Math.round(budgetBlock.subtotal / (budgetBlock.count || 1)) : null;

    const handle = async () => {
        if (!newTime) { setAlert('Please select a new start time.'); return; }
        const [h, m] = newTime.split(':').map(Number);
        const sched = new Date(newDate);
        sched.setHours(h, m, 0, 0);
        if ((sched.getTime() - Date.now()) / 60000 < 30) {
            setAlert('New start time must be at least 30 minutes from now.');
            return;
        }
        const mins = h * 60 + m;
        if (mins < 360 || mins > 1260) {
            setAlert('Time must be between 6:00 AM and 9:00 PM.');
            return;
        }
        try {
            setLoading(true);
            const { data } = await repostMissingSkill(job._id, slot._id?.toString(), newDate, newTime);
            toast.success(`${slot.skill} sub-task created!`);
            onReposted(job._id, data.job);
            onClose();
        } catch (err) {
            setAlert(err?.response?.data?.message || 'Failed to repost.');
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
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-white w-full sm:rounded-3xl shadow-2xl sm:max-w-md rounded-t-3xl p-4 sm:p-5 md:p-6"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg">
                        <Briefcase size={16} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm sm:text-base md:text-xl font-black text-gray-900">Repost Missing Skill</h3>
                        <p className="text-[9px] sm:text-[10px] text-gray-500">Create a sub-task for unfilled position</p>
                    </div>
                </div>

                <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-3 mb-4">
                    <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                        <span className="font-bold text-orange-700 capitalize text-sm">{slot.skill}</span>
                        {perWorker && (
                            <span className="text-base font-black text-green-600">₹{perWorker.toLocaleString()}</span>
                        )}
                    </div>
                    <div className="text-[9px] text-orange-600 space-y-0.5">
                        <p>~{slot.hoursEstimated}h estimated work</p>
                        <p>Same location, description, and budget.</p>
                    </div>
                </div>

                <AnimatePresence>
                    {alert && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mb-3"
                        >
                            <Alert msg={alert} type="error" onDismiss={() => setAlert('')} />
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="space-y-3 mb-4">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-700 mb-1">
                            New Start Date <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            min={todayStr()}
                            value={newDate}
                            onChange={e => setNewDate(e.target.value)}
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-700 mb-1">
                            New Start Time <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="time"
                            value={newTime}
                            onChange={e => setNewTime(e.target.value)}
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                        />
                        <p className="text-[8px] text-gray-400 mt-0.5">Must be 6:00 AM – 9:00 PM and at least 30 min from now</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 border-2 border-gray-200 text-gray-600 rounded-lg font-semibold text-xs hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handle}
                        disabled={loading || !newTime}
                        className="flex-1 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg font-bold text-xs disabled:opacity-60 shadow-md"
                    >
                        {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : `Repost Sub-task`}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ── Slot Rating Modal (Mobile Optimized) ──────────────────────────────────────────────
function SlotRatingModal({ job, onClose, onSlotRated }) {
    const unratedSlots = [
        ...(job.workerSlots || []).filter(s => s.assignedWorker && !s.ratingSubmitted && !['open', 'cancelled', 'not_required', 'reposted'].includes(s.status)).map(s => ({ ...s, _source: 'slot' })),
        ...(job.subTasks || []).filter(s => s.assignedWorker && !s.ratingSubmitted && !['cancelled'].includes(s.status)).map(s => ({ ...s, _source: 'subtask' })),
    ];

    const [idx, setIdx] = useState(0);
    const [stars, setStars] = useState(5);
    const [points, setPoints] = useState(50);
    const [msg, setMsg] = useState('');
    const [sub, setSub] = useState(false);
    const [alert, setAlert] = useState({ m: '', t: 'error' });

    if (unratedSlots.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                onClick={onClose}
            >
                <div className="bg-white rounded-2xl p-5 max-w-sm w-full text-center shadow-2xl">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <CheckCircle size={24} className="text-green-500" />
                    </div>
                    <h3 className="font-black text-gray-900 text-base mb-1">All Workers Rated!</h3>
                    <p className="text-gray-500 text-xs mb-3">Great job managing your team</p>
                    <button
                        onClick={onClose}
                        className="w-full py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-bold text-xs"
                    >
                        Done
                    </button>
                </div>
            </motion.div>
        );
    }

    const slot = unratedSlots[idx];
    const worker = slot.assignedWorker;
    const wid = (worker?._id || worker)?.toString();

    const handleSubmit = async () => {
        setAlert({ m: '', t: 'error' });
        try {
            setSub(true);
            const payload = {
                workerId: wid,
                slotId: slot._source === 'slot' ? slot._id : undefined,
                subTaskId: slot._source === 'subtask' ? slot._id : undefined,
                skill: slot.skill,
                stars,
                points,
                message: msg
            };
            await submitRating(job._id, payload);
            toast.success(`${slot.skill} rating submitted!`);
            onSlotRated(job._id, slot._id?.toString(), wid, slot._source);
            if (idx < unratedSlots.length - 1) {
                setIdx(i => i + 1);
                setStars(5);
                setPoints(50);
                setMsg('');
            } else onClose();
        } catch (err) {
            const m = err?.response?.data?.message || 'Failed.';
            if (err?.response?.status === 409) {
                onSlotRated(job._id, slot._id?.toString(), wid, slot._source);
                if (idx < unratedSlots.length - 1) setIdx(i => i + 1);
                else onClose();
            } else setAlert({ m, t: 'error' });
        } finally { setSub(false); }
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
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-white w-full sm:rounded-3xl sm:max-w-md shadow-2xl rounded-t-3xl overflow-hidden"
            >
                <div className="bg-gradient-to-r from-orange-500 to-red-500 px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm sm:text-base md:text-xl font-black text-white">Rate Worker</h3>
                            <p className="text-white/80 text-[10px]">Rate each worker individually</p>
                        </div>
                        <span className="text-[9px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
                            {idx + 1}/{unratedSlots.length}
                        </span>
                    </div>
                </div>

                <div className="px-4 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                    {unratedSlots.length > 1 && (
                        <div>
                            <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Select Worker</label>
                            <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                {unratedSlots.map((s, i) => {
                                    const w2 = s.assignedWorker;
                                    return (
                                        <button
                                            key={s._id?.toString() || i}
                                            onClick={() => { setIdx(i); setStars(5); setPoints(50); setMsg(''); setAlert({ m: '', t: 'error' }); }}
                                            className={`w-full flex items-center gap-2 p-2 rounded-lg border-2 text-left transition-all ${i === idx ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}
                                        >
                                            <img
                                                src={getImageUrl(w2?.photo)}
                                                alt=""
                                                className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                                                onError={e => { e.target.src = '/admin.png'; }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[9px] font-bold text-gray-800 truncate">{w2?.name || 'Worker'}</p>
                                                <p className="text-[8px] text-gray-400 capitalize">{s.skill}</p>
                                            </div>
                                            {i === idx && <CheckCircle size={12} className="text-orange-500 flex-shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 flex items-center gap-2">
                        <img
                            src={getImageUrl(worker?.photo)}
                            alt={worker?.name}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-orange-200"
                            onError={e => { e.target.src = '/admin.png'; }}
                        />
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-800 text-xs truncate">{worker?.name || 'Worker'}</p>
                            <p className="text-[8px] text-orange-600 capitalize font-semibold">{slot.skill}</p>
                        </div>
                    </div>

                    <AnimatePresence>
                        {alert.m && (
                            <Alert msg={alert.m} type={alert.t} onDismiss={() => setAlert({ m: '', t: 'error' })} />
                        )}
                    </AnimatePresence>

                    <div>
                        <label className="block text-[10px] font-bold text-gray-700 mb-1">Rating <span className="text-red-500">*</span></label>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(s => (
                                <button
                                    key={s}
                                    onClick={() => setStars(s)}
                                    className={`text-2xl transition-all ${s <= stars ? 'text-yellow-400 drop-shadow-md' : 'text-gray-200'}`}
                                >
                                    ★
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-gray-700 mb-1">
                            Points: <span className="text-orange-600 font-black">{points}</span>
                        </label>
                        <input
                            type="range"
                            min={20}
                            max={100}
                            value={points}
                            onChange={e => setPoints(Number(e.target.value))}
                            className="w-full accent-orange-500"
                        />
                        <div className="flex justify-between text-[8px] text-gray-400 mt-0.5">
                            <span>⚡ Basic</span>
                            <span>⭐ Good</span>
                            <span>🏆 Excellent</span>
                            <span>👑 Outstanding</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-gray-700 mb-1">Feedback <span className="text-gray-400 font-normal">(optional)</span></label>
                        <textarea
                            rows={2}
                            value={msg}
                            onChange={e => setMsg(e.target.value)}
                            placeholder="Share your feedback about their work..."
                            className="w-full border-2 border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:border-orange-400 resize-none"
                        />
                    </div>
                </div>

                <div className="px-4 pb-4 flex gap-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 border-2 border-gray-200 text-gray-600 rounded-lg font-semibold text-xs hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={sub}
                        className="flex-1 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg font-bold text-xs disabled:opacity-60 shadow-md"
                    >
                        {sub ? (
                            <span className="flex items-center justify-center gap-1">
                                <Loader2 size={12} className="animate-spin" />
                                Submitting...
                            </span>
                        ) : idx < unratedSlots.length - 1 ? (
                            'Submit & Next →'
                        ) : (
                            'Submit Rating'
                        )}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ── Remove/Cancel Modals (Mobile Optimized) ────────────────────────────────────────────
function RemoveModal({ job, slotId, workerId, workerName, skill, onClose, onRemoved }) {
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState('');
    const handle = async () => {
        if (!reason.trim()) { setAlert('Reason required.'); return; }
        try {
            setLoading(true);
            const { data } = await removeAssignedWorker(job._id, workerId, reason, slotId);
            onRemoved(job._id, data.job);
            onClose();
        } catch (err) {
            setAlert(err?.response?.data?.message || 'Failed.');
        } finally { setLoading(false); }
    };
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
            <div className="bg-white w-full sm:rounded-3xl sm:max-w-md rounded-t-3xl p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                        <UserX size={18} className="text-red-500" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-gray-900">Remove Worker</h3>
                        <p className="text-[9px] text-gray-500">
                            Remove <strong className="truncate">{workerName}</strong> from <strong className="capitalize">{skill}</strong>
                        </p>
                    </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">
                    <p className="text-[9px] text-amber-700 flex items-center gap-1">
                        <AlertCircle size={10} /> Worker notified. Slot reopens for others.
                    </p>
                </div>

                <AnimatePresence>
                    {alert && <Alert msg={alert} type="error" onDismiss={() => setAlert('')} />}
                </AnimatePresence>

                <label className="block text-[10px] font-bold text-gray-700 mb-1">
                    Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                    rows={2}
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Please explain why you're removing this worker..."
                    className="w-full border-2 border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:border-red-300 resize-none mb-3"
                />
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 border-2 border-gray-200 text-gray-600 rounded-lg font-semibold text-xs hover:bg-gray-50">
                        Cancel
                    </button>
                    <button onClick={handle} disabled={loading || !reason.trim()}
                        className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold text-xs disabled:opacity-60">
                        {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Remove Worker'}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

function CancelModal({ job, onClose, onCancelled }) {
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState('');
    const handle = async () => {
        if (!reason.trim()) { setAlert('Reason required.'); return; }
        try {
            setLoading(true);
            await cancelJob(job._id, reason);
            onCancelled(job._id);
            onClose();
        } catch (err) {
            setAlert(err?.response?.data?.message || 'Failed.');
        } finally { setLoading(false); }
    };
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
            <div className="bg-white w-full sm:rounded-3xl sm:max-w-md rounded-t-3xl p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                        <XCircle size={18} className="text-red-500" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-gray-900">Cancel Job</h3>
                        <p className="text-[9px] text-gray-500 truncate max-w-[160px]">"{job.title}"</p>
                    </div>
                </div>

                {job.assignedTo?.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">
                        <p className="text-[9px] text-amber-700 flex items-center gap-1">
                            <AlertCircle size={10} /> {job.assignedTo.length} worker(s) will be notified.
                        </p>
                    </div>
                )}

                <AnimatePresence>
                    {alert && <Alert msg={alert} type="error" onDismiss={() => setAlert('')} />}
                </AnimatePresence>

                <label className="block text-[10px] font-bold text-gray-700 mb-1">
                    Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                    rows={2}
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Please explain why you're cancelling this job..."
                    className="w-full border-2 border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:border-red-300 resize-none mb-3"
                />
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 border-2 border-gray-200 text-gray-600 rounded-lg font-semibold text-xs hover:bg-gray-50">
                        Keep Job
                    </button>
                    <button onClick={handle} disabled={loading || !reason.trim()}
                        className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold text-xs disabled:opacity-60">
                        {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Confirm Cancel'}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

// ── Pre-Start Alert Panel (Mobile Optimized) ──────────────────────────────────────────
function PreStartAlert({ job, onRepost, onDismiss }) {
    const unfilledSlots = (job.workerSlots || []).filter(s => s.status === 'open');
    if (!unfilledSlots.length) return null;
    if (!job.scheduledDate || !job.scheduledTime) return null;
    const [h, m] = job.scheduledTime.split(':').map(Number);
    const sched = new Date(job.scheduledDate);
    sched.setHours(h, m, 0, 0);
    const minsLeft = (sched.getTime() - Date.now()) / 60000;
    if (minsLeft > 30 || minsLeft <= 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border-2 border-red-200 rounded-xl p-3 space-y-2"
        >
            <div className="flex items-start gap-2">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AlertCircle size={14} className="text-red-500" />
                </div>
                <div className="flex-1">
                    <p className="font-bold text-red-800 text-xs">Unfilled Positions — Job Starts Soon!</p>
                    <p className="text-[9px] text-red-600 mt-0.5">
                        Job starts in ~{Math.max(1, Math.floor(minsLeft))} min.
                    </p>
                </div>
            </div>
            <div className="space-y-1.5">
                {unfilledSlots.map(slot => (
                    <div key={slot._id?.toString()} className="bg-white border border-red-100 rounded-lg p-2 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1">
                            <span className="font-bold text-gray-800 capitalize text-xs">{slot.skill}</span>
                            <span className="text-[8px] text-gray-400">~{slot.hoursEstimated}h</span>
                        </div>
                        <div className="flex gap-1">
                            <button
                                onClick={() => onRepost(slot)}
                                className="text-[8px] px-2 py-0.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-bold"
                            >
                                📤 Repost
                            </button>
                            <button
                                onClick={() => onDismiss(slot._id?.toString(), slot.skill)}
                                className="text-[8px] px-2 py-0.5 border border-gray-300 text-gray-500 rounded-lg font-bold hover:bg-gray-50"
                            >
                                ✕ Skip
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            <p className="text-[8px] text-red-500">
                Repost creates a sub-task with new time. Skip marks it as not required.
            </p>
        </motion.div>
    );
}

// ── Sub-Tasks Panel (Mobile Optimized) ─────────────────────────────────────────────────
function SubTasksPanel({ job, onViewProfile, onAlert, onMarkDone, onRate }) {
    const subTasks = (job.subTasks || []).filter(s => s.status !== 'cancelled');
    if (!subTasks.length) return null;

    return (
        <div>
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Layers size={12} /> Sub-tasks ({subTasks.filter(s => s.status === 'task_completed').length}/{subTasks.length} done)
            </p>
            <div className="space-y-1.5">
                {subTasks.map((sub, si) => {
                    const w = sub.assignedWorker;
                    const wid = (w?._id || w)?.toString();
                    const pendingApps = sub.applicants?.filter(a => a.status === 'pending') || [];

                    return (
                        <div key={sub._id?.toString() || si} className="border border-purple-200 rounded-lg bg-purple-50 overflow-hidden">
                            <div className="flex items-center justify-between px-2 py-1.5 bg-purple-100 border-b border-purple-200 flex-wrap gap-1">
                                <div className="flex items-center gap-1 flex-wrap">
                                    <span className="text-[9px] font-bold text-purple-700 capitalize">{sub.skill}</span>
                                    <span className="text-[7px] text-purple-500">~{sub.hoursEstimated}h</span>
                                    {sub.scheduledTime && (
                                        <span className="text-[7px] text-purple-500 flex items-center gap-0.5">
                                            <Clock size={8} /> {sub.scheduledTime}
                                        </span>
                                    )}
                                </div>
                                <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded-full ${SLOT_SC[sub.status] || 'bg-gray-100 text-gray-400'}`}>
                                    {sub.status === 'open' ? 'Open' : sub.status === 'scheduled' ? 'Scheduled' : sub.status === 'running' ? 'Running' : sub.status === 'task_completed' ? '✓ Done' : sub.status}
                                </span>
                            </div>
                            <div className="px-2 py-1.5 space-y-1.5">
                                {w && (
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => onViewProfile(wid)}
                                            className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                                        >
                                            <img
                                                src={getImageUrl(w?.photo)}
                                                alt=""
                                                className="w-6 h-6 rounded-full object-cover border border-gray-200 flex-shrink-0"
                                                onError={e => { e.target.src = '/admin.png'; }}
                                            />
                                            <span className="text-[8px] font-semibold text-gray-700 truncate">{w?.name || 'Worker'}</span>
                                        </button>
                                        <div className="flex gap-1">
                                            {['running', 'scheduled'].includes(sub.status) && !sub.ratingSubmitted && job.completionPhotos?.length > 0 && (
                                                <button
                                                    onClick={() => onRate(sub)}
                                                    className="text-[7px] px-1.5 py-0.5 bg-yellow-400 hover:bg-yellow-500 text-white rounded font-bold"
                                                >
                                                    Rate
                                                </button>
                                            )}
                                            {['running', 'scheduled'].includes(sub.status) && sub.ratingSubmitted && (
                                                <button
                                                    onClick={() => onMarkDone(sub._id?.toString())}
                                                    className="text-[7px] px-1.5 py-0.5 bg-green-500 hover:bg-green-600 text-white rounded font-bold"
                                                >
                                                    Done
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {!w && sub.status === 'open' && (
                                    <p className="text-[8px] text-gray-400 italic">Waiting for applications…</p>
                                )}
                                {pendingApps.length > 0 && (
                                    <div>
                                        <p className="text-[7px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                            {pendingApps.length} applicant{pendingApps.length > 1 ? 's' : ''}
                                        </p>
                                        {pendingApps.map(app => {
                                            const appWid = (app.workerId?._id || app.workerId)?.toString();
                                            return (
                                                <div key={app._id} className="flex items-center gap-1.5 mb-1">
                                                    <button
                                                        onClick={() => onViewProfile(appWid)}
                                                        className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                                                    >
                                                        <img
                                                            src={getImageUrl(app.workerId?.photo)}
                                                            alt=""
                                                            className="w-5 h-5 rounded-full object-cover border border-gray-200 flex-shrink-0"
                                                            onError={e => { e.target.src = '/admin.png'; }}
                                                        />
                                                        <div className="min-w-0">
                                                            <p className="text-[7px] font-semibold text-gray-700 truncate">{app.workerId?.name || 'Worker'}</p>
                                                        </div>
                                                    </button>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => onAlert('subtask-accept', sub._id?.toString(), appWid)}
                                                            className="text-[7px] px-1.5 py-0.5 bg-green-500 text-white rounded font-bold"
                                                        >
                                                            Accept
                                                        </button>
                                                        <button
                                                            onClick={() => onAlert('subtask-reject', sub._id?.toString(), appWid)}
                                                            className="text-[7px] px-1.5 py-0.5 border border-red-200 text-red-400 rounded hover:bg-red-50 font-bold"
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Job Card Header (Mobile Optimized) ─────────────────────────────────────────────────
function JobCardHeader({ job, isExpanded, onExpand, openSlots, filledSlots, doneSlots, totalSlots, pending, unratedSlots }) {
    const startInfo = useStartCountdown(job);
    const subTaskCount = (job.subTasks || []).filter(s => !['cancelled'].includes(s.status)).length;

    return (
        <div
            className="flex items-start gap-2 p-3 cursor-pointer hover:bg-gray-50 transition-all"
            onClick={onExpand}
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                    <h3 className="font-bold text-gray-900 text-xs sm:text-sm leading-snug line-clamp-1 flex-1">{job.title}</h3>
                    <SBadge status={job.status} />
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[9px] sm:text-[10px]">
                    <span className="font-black text-green-600 text-xs">₹{job.payment?.toLocaleString()}</span>
                    {job.location?.city && (
                        <span className="text-gray-400 flex items-center gap-0.5">
                            <MapPin size={10} /> {job.location.city}
                        </span>
                    )}
                    {job.scheduledDate && (
                        <span className="text-gray-400 flex items-center gap-0.5">
                            <Calendar size={10} />
                            {new Date(job.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            {job.scheduledTime && ` ${job.scheduledTime}`}
                        </span>
                    )}
                </div>

                {totalSlots > 0 && (
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[7px] sm:text-[8px]">
                        {openSlots > 0 && <span className="text-gray-500 flex items-center gap-0.5"><Zap size={8} /> {openSlots} open</span>}
                        {filledSlots > 0 && <span className="text-blue-600 flex items-center gap-0.5"><UserCheck size={8} /> {filledSlots} assigned</span>}
                        {doneSlots > 0 && <span className="text-green-600 flex items-center gap-0.5"><CheckCircle size={8} /> {doneSlots} done</span>}
                        {pending.length > 0 && <span className="text-orange-500 flex items-center gap-0.5"><Users size={8} /> {pending.length} pending</span>}
                        {job.status === 'running' && unratedSlots.length > 0 && <span className="text-purple-500 flex items-center gap-0.5"><Star size={8} /> {unratedSlots.length} to rate</span>}
                        {job.status === 'scheduled' && !startInfo.canStart && <span className="text-blue-500 font-mono flex items-center gap-0.5"><ClockIcon size={8} /> {startInfo.remaining}</span>}
                    </div>
                )}

                {subTaskCount > 0 && (
                    <span className="text-[7px] text-purple-600 font-bold bg-purple-50 px-1.5 py-0.5 rounded-full mt-1 inline-flex items-center gap-0.5">
                        <Layers size={8} /> {subTaskCount} sub-task(s)
                    </span>
                )}
            </div>
            <div className="flex-shrink-0 text-gray-400">
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
        </div>
    );
}

// ── Start Button (Mobile Optimized) ────────────────────────────────────────────────────
function StartButton({ job, onStart }) {
    const startInfo = useStartCountdown(job);
    return (
        <button
            onClick={() => onStart(job._id)}
            disabled={!startInfo.canStart}
            className={`flex-1 min-w-[80px] py-1.5 rounded-lg font-bold text-[9px] transition-all ${startInfo.canStart
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
        >
            {startInfo.canStart ? (
                <span className="flex items-center justify-center gap-1">
                    <Truck size={10} /> Start
                </span>
            ) : (
                <span className="flex items-center justify-center gap-1">
                    <ClockIcon size={10} /> {startInfo.remaining}
                </span>
            )}
        </button>
    );
}

// ── Main Component (Mobile Optimized) ─────────────────────────────────────────────────────────────
const TABS = ['open', 'scheduled', 'running', 'completed', 'cancelled', 'favourites'];
const TLABELS = { open: 'Open', scheduled: 'Scheduled', running: 'Running', completed: 'Completed', cancelled: 'Cancelled', favourites: '⭐' };

export default function ClientJobManage() {
    const navigate = useNavigate();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('open');
    const [expanded, setExpanded] = useState(null);
    const [starredIds, setStarredIds] = useState([]);
    const [cardAlerts, setCardAlerts] = useState({});
    const [profileWid, setProfileWid] = useState(null);
    const [ratingJob, setRatingJob] = useState(null);
    const [cancelModal, setCancelModal] = useState(null);
    const [removeData, setRemoveData] = useState(null);
    const [repostData, setRepostData] = useState(null);
    const [uploadingPhotos, setUploadingPhotos] = useState({});
    const [smartSuggestionsByJob, setSmartSuggestionsByJob] = useState({});
    const [loadingSuggestionsByJob, setLoadingSuggestionsByJob] = useState({});
    const [invitingByJob, setInvitingByJob] = useState({});
    const photoRef = useRef({});

    const setAlert = (id, msg, type = 'error') => setCardAlerts(p => ({ ...p, [id]: { msg, type } }));
    const clearAlert = id => setCardAlerts(p => { const n = { ...p }; delete n[id]; return n; });

    const captureClientLocationForJob = async (jobId) => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    let address = '';
                    try {
                        const r = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`,
                            { headers: { 'Accept-Language': 'en' } }
                        );
                        const g = await r.json();
                        address = g.display_name || '';
                    } catch { }
                    await initClientLocation(jobId, pos.coords.latitude, pos.coords.longitude, address);
                } catch { }
            },
            () => { },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    };

    const fetchJobs = async () => {
        try {
            setLoading(true);
            const { data } = await getClientJobs();
            setJobs(Array.isArray(data) ? data : []);
            const u = JSON.parse(localStorage.getItem('user') || '{}');
            setStarredIds(u.starredWorkers?.map(id => id?.toString()) || []);
        } catch { }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchJobs(); }, []);
    useEffect(() => { const t = setInterval(fetchJobs, 60000); return () => clearInterval(t); }, []);

    const tabJobs = jobs.filter(j => {
        if (tab === 'cancelled') return isCancelled(j.status);
        if (tab === 'favourites') return false;
        return j.status === tab;
    });
    const tabCount = t => {
        if (t === 'cancelled') return jobs.filter(j => isCancelled(j.status)).length;
        if (t === 'favourites') return starredIds.length;
        return jobs.filter(j => j.status === t).length;
    };

    const handleStar = async wId => {
        try {
            const { data } = await toggleStarWorker(wId);
            setStarredIds(data.starredWorkers?.map(id => id?.toString()) || []);
        } catch { }
    };

    const handleRespond = async (jobId, workerId, status, skill) => {
        if (!workerId || !status) return;
        try {
            const { data } = await respondToApplicant(jobId, { workerId, status, skill });
            setJobs(p => p.map(j => j._id === jobId ? data.job : j));
            if (status === 'accepted') {
                captureClientLocationForJob(jobId);
                setAlert(jobId, `Worker accepted as ${skill}!`, 'success');
            }
        } catch (err) {
            setAlert(jobId, err?.response?.data?.message || 'Failed.', err?.response?.status === 409 ? 'warning' : 'error');
        }
    };

    const handleLoadSmartSuggestions = async (jobId) => {
        try {
            setLoadingSuggestionsByJob(p => ({ ...p, [jobId]: true }));
            const { data } = await getJobSmartSuggestions(jobId);
            setSmartSuggestionsByJob(p => ({ ...p, [jobId]: data?.suggestions || [] }));
        } catch (err) {
            setAlert(jobId, err?.response?.data?.message || 'Failed to load smart suggestions.');
        } finally {
            setLoadingSuggestionsByJob(p => ({ ...p, [jobId]: false }));
        }
    };

    const handleInviteWorkers = async (jobId, workerIds = []) => {
        if (!workerIds.length) return;
        try {
            setInvitingByJob(p => ({ ...p, [jobId]: true }));
            const { data } = await inviteWorkersToJob(jobId, workerIds);
            setAlert(jobId, `${data?.invitedCount || workerIds.length} worker(s) invited successfully.`, 'success');
            await Promise.all([handleLoadSmartSuggestions(jobId), fetchJobs()]);
        } catch (err) {
            setAlert(jobId, err?.response?.data?.message || 'Failed to invite workers.');
        } finally {
            setInvitingByJob(p => ({ ...p, [jobId]: false }));
        }
    };

    const handleSubTaskRespond = async (jobId, subTaskId, workerId, status) => {
        try {
            const { data } = await respondToSubTaskApplicant(jobId, { subTaskId, workerId, status });
            setJobs(p => p.map(j => j._id === jobId ? data.job : j));
            if (status === 'accepted') setAlert(jobId, 'Sub-task applicant accepted!', 'success');
        } catch (err) {
            setAlert(jobId, err?.response?.data?.message || 'Failed.', err?.response?.status === 409 ? 'warning' : 'error');
        }
    };

    const handleMarkSlotDone = async (jobId, workerId, slotId, skill) => {
        if (!window.confirm(`Mark ${skill} task complete?`)) return;
        try {
            const { data } = await completeWorkerTask(jobId, workerId, slotId);
            setJobs(p => p.map(j => j._id === jobId ? data.job : j));
            setAlert(jobId, `${skill} task done.`, 'success');
        } catch (err) {
            setAlert(jobId, err?.response?.data?.message || 'Failed.');
        }
    };

    const handleMarkSubTaskDone = async (jobId, subTaskId) => {
        if (!window.confirm('Mark this sub-task complete?')) return;
        try {
            const { data } = await completeSubTask(jobId, subTaskId);
            setJobs(p => p.map(j => j._id === jobId ? data.job : j));
            setAlert(jobId, 'Sub-task marked complete.', 'success');
        } catch (err) {
            setAlert(jobId, err?.response?.data?.message || 'Failed.');
        }
    };

    const handleStartJob = async jobId => {
        try {
            const { data } = await startJob(jobId);
            setJobs(p => p.map(j => j._id === jobId ? data.job : j));
            setAlert(jobId, 'Job started! Workers notified.', 'success');
        } catch (err) {
            setAlert(jobId, err?.response?.data?.message || 'Cannot start yet.');
        }
    };

    const handleMarkComplete = async jobId => {
        try {
            const { data } = await updateJobStatus(jobId, 'completed');
            setJobs(p => p.map(j => j._id === jobId ? data.job : j));
            setAlert(jobId, 'Job complete!', 'success');
        } catch (err) {
            setAlert(jobId, err?.response?.data?.message || 'Failed.');
        }
    };

    const handleUploadPhotos = async (jobId, files) => {
        try {
            setUploadingPhotos(p => ({ ...p, [jobId]: true }));
            const fd = new FormData();
            Array.from(files).forEach(f => fd.append('photos', f));
            const { data } = await uploadCompletionPhotos(jobId, fd);
            setJobs(p => p.map(j => j._id === jobId ? { ...j, completionPhotos: data.completionPhotos } : j));
            setAlert(jobId, `${files.length} photo(s) uploaded. Now rate each worker.`, 'success');
        } catch (err) {
            setAlert(jobId, err?.response?.data?.message || 'Upload failed.');
        } finally {
            setUploadingPhotos(p => ({ ...p, [jobId]: false }));
        }
    };

    const handleDelete = async id => {
        if (!window.confirm('Delete permanently?')) return;
        try {
            await deleteClientJob(id);
            setJobs(p => p.filter(j => j._id !== id));
        } catch (err) {
            setAlert(id, err?.response?.data?.message || 'Failed.');
        }
    };

    const handleDismissSkill = async (jobId, slotId, skillName) => {
        if (!window.confirm(`Mark "${skillName}" as not required?`)) return;
        try {
            const { data } = await dismissMissingSkill(jobId, slotId);
            setJobs(p => p.map(j => j._id === jobId ? data.job : j));
            setAlert(jobId, `${skillName} marked as not required.`, 'success');
        } catch (err) {
            setAlert(jobId, err?.response?.data?.message || 'Failed.');
        }
    };

    const handleSlotRated = (jobId, slotId, workerId, source) => {
        setJobs(p => p.map(j => {
            if (j._id !== jobId) return j;
            if (source === 'subtask') {
                const subs = (j.subTasks || []).map(s => s._id?.toString() === slotId ? { ...s, ratingSubmitted: true } : s);
                return { ...j, subTasks: subs };
            }
            const slots = (j.workerSlots || []).map(s => s._id?.toString() === slotId ? { ...s, ratingSubmitted: true } : s);
            return { ...j, workerSlots: slots };
        }));
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96">
                <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <p className="mt-3 text-gray-500 font-semibold text-sm">Loading your jobs...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/20 pb-20">
            <div className="max-w-4xl mx-auto px-3 sm:px-4 pt-4 space-y-4">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-4 text-white shadow-xl">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                            <Briefcase size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black">Manage Jobs</h1>
                            <p className="text-white/90 text-[10px] mt-0.5">Track and manage your posted jobs</p>
                        </div>
                    </div>
                    <div className="flex gap-1.5 mt-2">
                        <span className="flex items-center gap-0.5 bg-white/20 rounded-full px-2 py-0.5 text-[9px]">
                            <Briefcase size={10} /> {jobs.length} Total
                        </span>
                        <span className="flex items-center gap-0.5 bg-white/20 rounded-full px-2 py-0.5 text-[9px]">
                            <TrendingUp size={10} /> {jobs.filter(j => j.status === 'running').length} In Progress
                        </span>
                    </div>
                </div>

                {/* Tabs - Horizontal Scroll */}
                <div className="overflow-x-auto no-scrollbar -mx-3 px-3">
                    <div className="flex gap-1 min-w-max pb-1">
                        {TABS.map(t => (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${tab === t
                                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                                        : 'bg-white text-gray-600 border-2 border-gray-200 hover:border-orange-300'
                                    }`}
                            >
                                {TLABELS[t]}
                                {tabCount(t) > 0 && (
                                    <span className={`ml-1 text-[8px] px-1 py-0.5 rounded-full ${tab === t ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                        {tabCount(t)}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Favourites Tab */}
                {tab === 'favourites' && (
                    <div>
                        {starredIds.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-2xl shadow-xl border border-gray-100">
                                <div className="text-4xl mb-2">⭐</div>
                                <p className="font-bold text-gray-800 text-base mb-1">No favourite workers</p>
                                <p className="text-gray-400 text-[10px]">Star workers you like to easily find them later</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {starredIds.map(wid => (
                                    <div
                                        key={wid}
                                        onClick={() => setProfileWid(wid)}
                                        className="bg-white border-2 border-gray-100 rounded-lg p-2 flex items-center gap-2 cursor-pointer hover:border-orange-200 hover:shadow-md transition-all"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-sm">
                                            👷
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[9px] font-bold text-gray-700">Starred Worker</p>
                                            <p className="text-[7px] text-gray-400">Tap to view</p>
                                        </div>
                                        <button
                                            onClick={e => { e.stopPropagation(); handleStar(wid); }}
                                            className="text-yellow-400 text-sm hover:scale-110 transition-transform"
                                        >
                                            ★
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Job Cards */}
                {tab !== 'favourites' && (
                    <>
                        {tabJobs.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-2xl shadow-xl border border-gray-100">
                                <div className="text-4xl mb-2">📋</div>
                                <p className="font-bold text-gray-800 text-base mb-1">No {tab} jobs</p>
                                <p className="text-gray-400 text-[10px]">Jobs you post will appear here</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {tabJobs.map(job => {
                                    const isExp = expanded === job._id;
                                    const cAlert = cardAlerts[job._id];
                                    const hasPhotos = job.completionPhotos?.length > 0;

                                    const assignedSlots = (job.workerSlots || []).filter(s => s.assignedWorker && !['open', 'cancelled', 'not_required', 'reposted'].includes(s.status));
                                    const subTaskSlots = (job.subTasks || []).filter(s => s.assignedWorker && !['cancelled'].includes(s.status));
                                    const unratedSlots = [...assignedSlots.filter(s => !s.ratingSubmitted), ...subTaskSlots.filter(s => !s.ratingSubmitted)];
                                    const allRated = (assignedSlots.length + subTaskSlots.length) > 0 && unratedSlots.length === 0;

                                    const totalSlots = (job.workerSlots || []).length;
                                    const openSlots = (job.workerSlots || []).filter(s => s.status === 'open').length;
                                    const filledSlots = (job.workerSlots || []).filter(s => s.status === 'filled').length;
                                    const doneSlots = (job.workerSlots || []).filter(s => s.status === 'task_completed').length;
                                    const pending = (job.applicants || []).filter(a => a.status === 'pending');
                                    const bySkill = {};
                                    pending.forEach(a => { const sk = a.skill || 'general'; if (!bySkill[sk]) bySkill[sk] = []; bySkill[sk].push(a); });
                                    const openBySkill = {};
                                    (job.workerSlots || []).filter(s => s.status === 'open').forEach(s => { openBySkill[s.skill] = (openBySkill[s.skill] || 0) + 1; });
                                    const suggestedWorkers = smartSuggestionsByJob[job._id] || [];
                                    const suggestionsLoading = !!loadingSuggestionsByJob[job._id];
                                    const isInviting = !!invitingByJob[job._id];

                                    return (
                                        <div
                                            key={job._id}
                                            className="bg-white rounded-xl border-2 border-gray-100 shadow-md hover:shadow-xl transition-all overflow-hidden"
                                        >
                                            <JobCardHeader
                                                job={job}
                                                isExpanded={isExp}
                                                onExpand={() => setExpanded(isExp ? null : job._id)}
                                                openSlots={openSlots}
                                                filledSlots={filledSlots}
                                                doneSlots={doneSlots}
                                                totalSlots={totalSlots}
                                                pending={pending}
                                                unratedSlots={unratedSlots}
                                            />

                                            {isExp && (
                                                <div className="border-t border-gray-100 px-3 pb-3 pt-2 space-y-3">
                                                    <AnimatePresence>
                                                        {cAlert?.msg && (
                                                            <Alert msg={cAlert.msg} type={cAlert.type} onDismiss={() => clearAlert(job._id)} />
                                                        )}
                                                    </AnimatePresence>

                                                    <p className="text-[11px] text-gray-600 leading-relaxed">{job.description}</p>

                                                    {isCancelled(job.status) && job.cancellationReason && (
                                                        <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                                                            <p className="text-[9px] font-bold text-red-700 flex items-center gap-1">
                                                                <XCircle size={10} /> Cancelled
                                                            </p>
                                                            <p className="text-[8px] text-red-600 mt-0.5">Reason: {job.cancellationReason}</p>
                                                        </div>
                                                    )}

                                                    {/* Pre-Start Alert */}
                                                    <PreStartAlert
                                                        job={job}
                                                        onRepost={slot => setRepostData({ job, slot })}
                                                        onDismiss={(slotId, skill) => handleDismissSkill(job._id, slotId, skill)}
                                                    />

                                                    {/* Worker Slots */}
                                                    {(job.workerSlots || []).length > 0 && (
                                                        <div>
                                                            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                                                <Users size={10} /> Worker Slots ({doneSlots}/{totalSlots} done)
                                                            </p>
                                                            <div className="space-y-1.5">
                                                                {job.workerSlots.map((slot, si) => {
                                                                    const w = slot.assignedWorker;
                                                                    const wid = (w?._id || w)?.toString();
                                                                    return (
                                                                        <div key={slot._id?.toString() || si} className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-2 border border-gray-100 flex-wrap">
                                                                            <div className="flex-shrink-0 w-[55px]">
                                                                                <span className="text-[8px] font-bold text-gray-700 capitalize block">{slot.skill}</span>
                                                                                <span className="text-[6px] text-gray-400">{slot.hoursEstimated}h est.</span>
                                                                            </div>
                                                                            {w ? (
                                                                                <button
                                                                                    onClick={() => setProfileWid(wid)}
                                                                                    className="flex items-center gap-1 flex-1 min-w-0 text-left"
                                                                                >
                                                                                    <img
                                                                                        src={getImageUrl(w?.photo)}
                                                                                        alt=""
                                                                                        className="w-5 h-5 rounded-full object-cover border border-gray-200 flex-shrink-0"
                                                                                        onError={e => { e.target.src = '/admin.png'; }}
                                                                                    />
                                                                                    <div className="min-w-0">
                                                                                        <span className="text-[7px] font-semibold text-gray-800 truncate block">{w?.name || 'Worker'}</span>
                                                                                    </div>
                                                                                </button>
                                                                            ) : (
                                                                                <span className="flex-1 text-[7px] text-gray-400 italic">
                                                                                    {slot.status === 'not_required' ? 'Not required' : slot.status === 'reposted' ? '→ Sub-task created' : 'No worker'}
                                                                                </span>
                                                                            )}
                                                                            <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
                                                                                <span className={`text-[6px] font-bold px-1 py-0.5 rounded-full ${SLOT_SC[slot.status] || 'bg-gray-100 text-gray-400'}`}>
                                                                                    {slot.status === 'open' ? 'Open' : slot.status === 'filled' ? 'Assigned' : slot.status === 'task_completed' ? '✓ Done' : slot.status === 'not_required' ? 'Skip' : slot.status === 'reposted' ? 'Reposted' : 'Cancelled'}
                                                                                </span>
                                                                                {slot.ratingSubmitted && (
                                                                                    <span className="text-[6px] bg-yellow-100 text-yellow-600 px-1 py-0.5 rounded-full">⭐</span>
                                                                                )}
                                                                                {job.status === 'running' && slot.status === 'filled' && wid && (
                                                                                    <button
                                                                                        onClick={() => handleMarkSlotDone(job._id, wid, slot._id?.toString(), slot.skill)}
                                                                                        className="text-[6px] px-1.5 py-0.5 bg-green-500 hover:bg-green-600 text-white rounded font-bold"
                                                                                    >
                                                                                        Done
                                                                                    </button>
                                                                                )}
                                                                                {['open', 'scheduled'].includes(job.status) && slot.status === 'filled' && wid && (
                                                                                    <button
                                                                                        onClick={() => setRemoveData({ job, slotId: slot._id?.toString(), workerId: wid, workerName: w?.name, skill: slot.skill })}
                                                                                        className="text-[6px] px-1.5 py-0.5 border border-red-200 text-red-400 rounded hover:bg-red-50 font-bold"
                                                                                    >
                                                                                        Remove
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Sub-Tasks Panel */}
                                                    <SubTasksPanel
                                                        job={job}
                                                        onViewProfile={setProfileWid}
                                                        onAlert={(type, subTaskId, workerId) => {
                                                            const status = type === 'subtask-accept' ? 'accepted' : 'rejected';
                                                            handleSubTaskRespond(job._id, subTaskId, workerId, status);
                                                        }}
                                                        onMarkDone={subTaskId => handleMarkSubTaskDone(job._id, subTaskId)}
                                                        onRate={sub => setRatingJob({ ...job, _ratingSubTask: sub })}
                                                    />

                                                    {['open', 'scheduled'].includes(job.status) && (
                                                        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-4">
                                                            <div className="flex items-center justify-between gap-2 mb-3">
                                                                <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-2">
                                                                    <Sparkles size={12} /> AI Smart Suggestions
                                                                </p>
                                                                <div className="flex items-center gap-2">
                                                                    <motion.button
                                                                        whileHover={{ scale: 1.02 }}
                                                                        whileTap={{ scale: 0.98 }}
                                                                        onClick={() => handleLoadSmartSuggestions(job._id)}
                                                                        disabled={suggestionsLoading || isInviting}
                                                                        className="text-xs px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 bg-white font-bold disabled:opacity-60"
                                                                    >
                                                                        {suggestionsLoading ? 'Loading...' : 'Load Top 3'}
                                                                    </motion.button>
                                                                    {suggestedWorkers.length > 0 && (
                                                                        <motion.button
                                                                            whileHover={{ scale: 1.02 }}
                                                                            whileTap={{ scale: 0.98 }}
                                                                            onClick={() => handleInviteWorkers(job._id, suggestedWorkers.map(w => w._id))}
                                                                            disabled={suggestionsLoading || isInviting}
                                                                            className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-bold disabled:opacity-60"
                                                                        >
                                                                            {isInviting ? 'Inviting...' : 'Invite Top 3'}
                                                                        </motion.button>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {suggestedWorkers.length === 0 ? (
                                                                <p className="text-xs text-indigo-500">Load suggestions to see top-rated nearby workers and invite instantly.</p>
                                                            ) : (
                                                                <div className="space-y-2">
                                                                    {suggestedWorkers.map(worker => (
                                                                        <div key={worker._id} className="flex items-center gap-3 bg-white border border-indigo-100 rounded-xl p-2.5">
                                                                            <motion.button
                                                                                whileHover={{ scale: 1.02 }}
                                                                                onClick={() => setProfileWid(worker._id)}
                                                                                className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                                                            >
                                                                                <img
                                                                                    src={getImageUrl(worker.photo)}
                                                                                    alt=""
                                                                                    className="w-8 h-8 rounded-full object-cover border border-indigo-100"
                                                                                    onError={e => { e.target.src = '/admin.png'; }}
                                                                                />
                                                                                <div className="min-w-0">
                                                                                    <p className="text-xs font-bold text-gray-800 truncate">{worker.name}</p>
                                                                                    <p className="text-[11px] text-indigo-600">
                                                                                        ⭐ {Number(worker.avgStars || 0).toFixed(1)} ({worker.ratingCount || 0}) · {worker.points || 0} pts
                                                                                        {worker.distanceKm !== null && worker.distanceKm !== undefined ? ` · ${worker.distanceKm} km` : ''}
                                                                                    </p>
                                                                                </div>
                                                                            </motion.button>
                                                                            <motion.button
                                                                                whileHover={{ scale: 1.02 }}
                                                                                whileTap={{ scale: 0.98 }}
                                                                                onClick={() => handleInviteWorkers(job._id, [worker._id])}
                                                                                disabled={isInviting}
                                                                                className="text-xs px-2.5 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50 font-bold disabled:opacity-60 flex items-center gap-1"
                                                                            >
                                                                                <UserPlus size={12} /> Invite
                                                                            </motion.button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Applicants */}
                                                    {['open', 'scheduled'].includes(job.status) && (
                                                        <div>
                                                            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                                <Users size={10} /> Applicants ({pending.length} pending)
                                                            </p>
                                                            {pending.length === 0 ? (
                                                                <p className="text-[8px] text-gray-400 text-center py-2">No pending applicants.</p>
                                                            ) : (
                                                                Object.entries(bySkill).map(([sk, apps]) => (
                                                                    <div key={sk} className="mb-2">
                                                                        <div className="flex items-center gap-1.5 mb-1">
                                                                            <span className="text-[8px] font-bold bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-full capitalize border border-purple-200">
                                                                                {sk}
                                                                            </span>
                                                                            {openBySkill[sk] ? (
                                                                                <span className="text-[7px] text-gray-400">{openBySkill[sk]} slot(s) open</span>
                                                                            ) : (
                                                                                <span className="text-[7px] text-red-400">All slots filled</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            {apps.map(app => {
                                                                                const wId = (app.workerId?._id || app.workerId)?.toString();
                                                                                return (
                                                                                    <div key={app._id} className={`flex items-center gap-1.5 rounded-lg p-1.5 ${!openBySkill[sk] ? 'bg-gray-50 opacity-70' : 'bg-gray-50 border border-gray-100'}`}>
                                                                                        <button
                                                                                            onClick={() => setProfileWid(wId)}
                                                                                            className="flex items-center gap-1 flex-1 min-w-0 text-left"
                                                                                        >
                                                                                            <img
                                                                                                src={getImageUrl(app.workerId?.photo)}
                                                                                                alt=""
                                                                                                className="w-5 h-5 rounded-full object-cover border border-gray-200 flex-shrink-0"
                                                                                                onError={e => { e.target.src = '/admin.png'; }}
                                                                                            />
                                                                                            <div className="min-w-0">
                                                                                                <p className="text-[7px] font-semibold text-gray-800 truncate">{app.workerId?.name || 'Worker'}</p>
                                                                                                <p className="text-[6px] text-gray-400 flex items-center gap-0.5">
                                                                                                    <Award size={6} /> {app.workerId?.points || 0} pts
                                                                                                </p>
                                                                                            </div>
                                                                                        </button>
                                                                                        <div className="flex gap-1">
                                                                                            <button
                                                                                                onClick={() => handleRespond(job._id, wId, 'accepted', sk)}
                                                                                                disabled={!openBySkill[sk]}
                                                                                                className={`text-[6px] px-1.5 py-0.5 rounded font-bold transition-all ${openBySkill[sk]
                                                                                                        ? 'bg-green-500 text-white'
                                                                                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                                                                    }`}
                                                                                            >
                                                                                                Accept
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => handleRespond(job._id, wId, 'rejected', sk)}
                                                                                                className="text-[6px] px-1.5 py-0.5 border border-red-200 text-red-500 rounded hover:bg-red-50 font-bold"
                                                                                            >
                                                                                                Reject
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Completion Flow */}
                                                    {job.status === 'running' && (
                                                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 space-y-2">
                                                            <p className="text-[9px] font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                                                                <CheckCircle size={10} /> Completion Steps
                                                            </p>
                                                            <div className={`flex items-center gap-2 p-2 rounded-lg border ${hasPhotos ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                                                                <span className="text-sm flex-shrink-0">{hasPhotos ? '✅' : '1️⃣'}</span>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className={`text-[8px] font-semibold ${hasPhotos ? 'text-green-700' : 'text-gray-700'}`}>Upload Photos</p>
                                                                    {hasPhotos && <p className="text-[7px] text-green-600">{job.completionPhotos.length} uploaded</p>}
                                                                </div>
                                                                {!hasPhotos && (
                                                                    <>
                                                                        <input
                                                                            ref={el => { photoRef.current[job._id] = el; }}
                                                                            type="file"
                                                                            multiple
                                                                            accept="image/*"
                                                                            className="hidden"
                                                                            onChange={e => handleUploadPhotos(job._id, e.target.files)}
                                                                        />
                                                                        <button
                                                                            onClick={() => photoRef.current[job._id]?.click()}
                                                                            disabled={uploadingPhotos[job._id]}
                                                                            className="text-[7px] px-1.5 py-0.5 bg-orange-500 text-white rounded font-bold disabled:opacity-60"
                                                                        >
                                                                            {uploadingPhotos[job._id] ? <Loader2 size={8} className="animate-spin" /> : <Camera size={8} />}
                                                                            Upload
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>

                                                            <div className={`flex items-start gap-2 p-2 rounded-lg border ${!hasPhotos ? 'opacity-50 pointer-events-none bg-white border-gray-100' : allRated ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                                                                <span className="text-sm flex-shrink-0 mt-0.5">{allRated ? '✅' : '2️⃣'}</span>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className={`text-[8px] font-semibold ${allRated ? 'text-green-700' : 'text-gray-700'}`}>
                                                                        Rate Each Worker <span className="text-red-500">*</span>
                                                                    </p>
                                                                    {!allRated && (
                                                                        <p className="text-[7px] text-gray-400 mt-0.5">{unratedSlots.length} worker(s) not rated</p>
                                                                    )}
                                                                </div>
                                                                {hasPhotos && !allRated && (
                                                                    <button
                                                                        onClick={() => setRatingJob(job)}
                                                                        className="text-[7px] px-1.5 py-0.5 bg-yellow-400 hover:bg-yellow-500 text-white rounded font-bold"
                                                                    >
                                                                        Rate
                                                                    </button>
                                                                )}
                                                            </div>

                                                            <div className={`flex items-center gap-2 p-2 rounded-lg border ${(!hasPhotos || !allRated) ? 'opacity-50 pointer-events-none bg-white border-gray-100' : 'bg-white border-orange-200'}`}>
                                                                <span className="text-sm flex-shrink-0">3️⃣</span>
                                                                <div className="flex-1">
                                                                    <p className="text-[8px] font-semibold text-gray-700">Mark Complete</p>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleMarkComplete(job._id)}
                                                                    disabled={!hasPhotos || !allRated}
                                                                    className="text-[7px] px-1.5 py-0.5 bg-green-600 hover:bg-green-700 text-white rounded font-bold disabled:opacity-40"
                                                                >
                                                                    Complete
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Actions */}
                                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                                        {job.status === 'scheduled' && <StartButton job={job} onStart={handleStartJob} />}

                                                        {['scheduled', 'running'].includes(job.status) && (job.assignedTo || []).length > 0 && (
                                                            <button
                                                                onClick={() => navigate(`/client/live-tracking/${job._id}`)}
                                                                className="flex items-center gap-1 px-2 py-1.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-bold text-[8px]"
                                                            >
                                                                <Navigation size={10} /> Track
                                                            </button>
                                                        )}

                                                        {['open', 'scheduled'].includes(job.status) && (
                                                            <button
                                                                onClick={() => setCancelModal(job)}
                                                                className="px-2 py-1.5 border-2 border-red-200 text-red-500 rounded-lg font-bold text-[8px] hover:bg-red-50"
                                                            >
                                                                ✕ Cancel
                                                            </button>
                                                        )}
                                                        {job.status === 'open' && (
                                                            <button
                                                                onClick={() => handleDelete(job._id)}
                                                                className="px-2 py-1.5 border-2 border-red-200 text-red-500 rounded-lg font-bold text-[8px] hover:bg-red-50"
                                                            >
                                                                🗑 Delete
                                                            </button>
                                                        )}
                                                    </div>

                                                    {job.status === 'running' && (
                                                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-2 py-1.5">
                                                            <p className="text-[7px] text-yellow-700 font-medium flex items-center gap-1">
                                                                <Truck size={8} /> Running: Mark done → Upload → Rate → Complete
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modals */}
            <AnimatePresence>
                {profileWid && <WorkerModal workerId={profileWid} onClose={() => setProfileWid(null)} onStar={handleStar} starredIds={starredIds} />}
                {ratingJob && <SlotRatingModal job={ratingJob} onClose={() => setRatingJob(null)} onSlotRated={handleSlotRated} />}
                {cancelModal && <CancelModal job={cancelModal} onClose={() => setCancelModal(null)} onCancelled={id => setJobs(p => p.map(j => j._id === id ? { ...j, status: 'cancelled_by_client' } : j))} />}
                {removeData && <RemoveModal {...removeData} onClose={() => setRemoveData(null)} onRemoved={(jobId, updatedJob) => setJobs(p => p.map(j => j._id === jobId ? updatedJob : j))} />}
                {repostData && <RepostModal job={repostData.job} slot={repostData.slot} onClose={() => setRepostData(null)} onReposted={(jobId, updatedJob) => setJobs(p => p.map(j => j._id === jobId ? updatedJob : j))} />}
            </AnimatePresence>
        </div>
    );
}