// client/src/pages/client/ClientJobManage.jsx
// ENHANCED UI VERSION - All original functionality preserved
// Enhanced with: Modern gradients, animations, better visual hierarchy, micro-interactions

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getClientJobs, deleteClientJob, cancelJob, updateJobStatus,
    uploadCompletionPhotos, startJob, toggleJobApplications,
    removeAssignedWorker, completeWorkerTask, respondToApplicant,
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
    Settings, UserCheck, UserX, Clock as ClockIcon
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────────
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
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${STATUS_C[status] || 'bg-gray-100 text-gray-500'}`}>
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
            className={`${styles[type]} rounded-2xl px-4 py-3 text-sm flex items-start justify-between gap-3 border`}
        >
            <p className="leading-relaxed flex items-center gap-2">
                {type === 'error' && <AlertCircle size={14} />}
                {type === 'success' && <CheckCircle size={14} />}
                {type === 'warning' && <AlertCircle size={14} />}
                {type === 'info' && <MessageCircle size={14} />}
                {msg}
            </p>
            {onDismiss && (
                <button onClick={onDismiss} className="flex-shrink-0 opacity-50 hover:opacity-100 font-bold text-lg leading-none">×</button>
            )}
        </motion.div>
    );
}

// ── Countdown hook with animation ─────────────────────────────────────────────
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
            const totalMins = h * 60 + m;
            const currentMins = (new Date().getHours() * 60 + new Date().getMinutes());
            const progress = Math.min(100, Math.max(0, (currentMins / totalMins) * 100));
            setInfo({
                canStart: ms <= 0,
                remaining: `${pad2(Math.floor(tm / 60))}:${pad2(tm % 60)}`,
                progress: ms <= 0 ? 100 : progress
            });
        };
        update();
        const t = setInterval(update, 1000);
        return () => clearInterval(t);
    }, [job._id, job.status, job.scheduledTime, job.scheduledDate]);
    return info;
}

// ── Worker Profile Modal (Enhanced) ───────────────────────────────────────────
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
                initial={{ scale: 0.9, y: 50, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: 50, opacity: 0 }}
                className="bg-white w-full sm:rounded-3xl shadow-2xl sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl"
                onClick={e => e.stopPropagation()}
            >
                {load ? (
                    <div className="flex items-center justify-center h-48">
                        <Loader2 size={32} className="animate-spin text-orange-500" />
                    </div>
                ) : !w ? null : (
                    <>
                        <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-red-500 px-6 pt-6 pb-5 z-10">
                            <div className="flex items-center gap-4">
                                <img
                                    src={getImageUrl(w.photo)}
                                    alt={w.name}
                                    className="w-16 h-16 rounded-2xl object-cover border-3 border-white shadow-lg"
                                    onError={e => { e.target.src = '/admin.png'; }}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h2 className="font-black text-white text-xl">{w.name}</h2>
                                        {w.verificationStatus === 'approved' && (
                                            <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                                <CheckCircle size={10} /> Verified
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-white/80 text-xs mt-1 font-mono">{w.karigarId} · 📞 {w.mobile || 'N/A'}</p>
                                    <div className="flex items-center gap-3 mt-2 text-xs text-white/90">
                                        <span className="flex items-center gap-1">⭐ {w.avgStars?.toFixed(1) || '—'}</span>
                                        <span className="flex items-center gap-1">💼 {w.completedJobs || 0}</span>
                                        <span className="flex items-center gap-1">🏆 {w.points || 0} pts</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => onStar(workerId)}
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${starred ? 'bg-yellow-400 text-white shadow-lg' : 'bg-white/20 text-white/80 hover:bg-white/30'
                                            }`}
                                    >
                                        {starred ? '★' : '☆'}
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={onClose}
                                        className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"
                                    >
                                        ✕
                                    </motion.button>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-5 space-y-5">
                            {w.skills?.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <Zap size={12} /> Skills
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {w.skills.map((s, i) => (
                                            <span key={i} className="text-xs bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 px-3 py-1.5 rounded-full font-semibold capitalize border border-purple-200">
                                                {s?.name || s}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {w.ratings?.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <Star size={12} /> Recent Reviews
                                    </p>
                                    <div className="space-y-2">
                                        {w.ratings.slice(0, 4).map((r, i) => (
                                            <div key={i} className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-3 border border-gray-100">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <img
                                                        src={getImageUrl(r.client?.photo)}
                                                        alt=""
                                                        className="w-6 h-6 rounded-full object-cover"
                                                        onError={e => { e.target.src = '/admin.png'; }}
                                                    />
                                                    <span className="text-xs font-semibold text-gray-700">{r.client?.name}</span>
                                                    <div className="flex text-yellow-400 text-xs">
                                                        {'★'.repeat(r.stars || 0)}
                                                        {'☆'.repeat(5 - (r.stars || 0))}
                                                    </div>
                                                    {r.skill && <span className="text-xs text-gray-400 capitalize">{r.skill}</span>}
                                                </div>
                                                {r.message && <p className="text-xs text-gray-500 line-clamp-2">{r.message}</p>}
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

// ── Repost Missing Skill Modal (Enhanced) ─────────────────────────────────────
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
                initial={{ scale: 0.9, y: 50, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: 50, opacity: 0 }}
                className="bg-white w-full sm:rounded-3xl shadow-2xl sm:max-w-md rounded-t-3xl p-6"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                        <Briefcase size={20} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-gray-900">Repost Missing Skill</h3>
                        <p className="text-xs text-gray-500">Create a sub-task for unfilled position</p>
                    </div>
                </div>

                <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-4 mb-5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-orange-700 capitalize text-lg">{slot.skill}</span>
                        {perWorker && (
                            <span className="text-lg font-black text-green-600">₹{perWorker.toLocaleString()}</span>
                        )}
                    </div>
                    <div className="text-xs text-orange-600 space-y-1">
                        <p>~{slot.hoursEstimated}h estimated work</p>
                        <p>Same location, description, and budget as the original job.</p>
                        <p>A new start time allows workers to apply specifically for this task.</p>
                    </div>
                </div>

                <AnimatePresence>
                    {alert && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mb-4"
                        >
                            <Alert msg={alert} type="error" onDismiss={() => setAlert('')} />
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="space-y-4 mb-5">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            New Start Date <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            min={todayStr()}
                            value={newDate}
                            onChange={e => setNewDate(e.target.value)}
                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400 transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            New Start Time <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="time"
                            value={newTime}
                            onChange={e => setNewTime(e.target.value)}
                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400 transition-all"
                        />
                        <p className="text-xs text-gray-400 mt-1">Must be 6:00 AM – 9:00 PM and at least 30 min from now</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onClose}
                        className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-2xl font-semibold hover:bg-gray-50 transition-all"
                    >
                        Cancel
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handle}
                        disabled={loading || !newTime}
                        className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-2xl font-bold disabled:opacity-60 transition-all shadow-md"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : `Repost ${slot.skill} Sub-task`}
                    </motion.button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ── Slot Rating Modal (Enhanced) ──────────────────────────────────────────────
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
            >
                <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle size={32} className="text-green-500" />
                    </div>
                    <h3 className="font-black text-gray-900 text-xl mb-2">All Workers Rated!</h3>
                    <p className="text-gray-500 text-sm mb-4">Great job managing your team</p>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onClose}
                        className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold"
                    >
                        Done
                    </motion.button>
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
            onSlotRated(job._id, slot._id?.toString(), wid, slot._source);
            toast.success(`${slot.skill} rating submitted!`);
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
        >
            <motion.div
                initial={{ scale: 0.9, y: 50, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: 50, opacity: 0 }}
                className="bg-white w-full sm:rounded-3xl sm:max-w-md shadow-2xl rounded-t-3xl overflow-hidden"
            >
                <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-black text-white">Rate Worker</h3>
                            <p className="text-white/80 text-xs">Rate each worker individually for their assigned task</p>
                        </div>
                        <span className="text-xs bg-white/20 text-white px-3 py-1 rounded-full font-bold">
                            {idx + 1} of {unratedSlots.length}
                        </span>
                    </div>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {unratedSlots.length > 1 && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Select Worker to Rate</label>
                            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                {unratedSlots.map((s, i) => {
                                    const w2 = s.assignedWorker;
                                    return (
                                        <motion.button
                                            key={s._id?.toString() || i}
                                            whileHover={{ scale: 1.01 }}
                                            onClick={() => { setIdx(i); setStars(5); setPoints(50); setMsg(''); setAlert({ m: '', t: 'error' }); }}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${i === idx ? 'border-orange-400 bg-gradient-to-r from-orange-50 to-amber-50' : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <img
                                                src={getImageUrl(w2?.photo)}
                                                alt=""
                                                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                                                onError={e => { e.target.src = '/admin.png'; }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-gray-800 truncate">{w2?.name || 'Worker'}</p>
                                                <p className="text-xs text-gray-400 capitalize">{s.skill} · {s.hoursEstimated}h{s._source === 'subtask' ? ' (sub-task)' : ''}</p>
                                            </div>
                                            {i === idx && (
                                                <span className="text-orange-500 text-sm font-bold flex-shrink-0">← Rating</span>
                                            )}
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-3">
                        <img
                            src={getImageUrl(worker?.photo)}
                            alt={worker?.name}
                            className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-orange-200"
                            onError={e => { e.target.src = '/admin.png'; }}
                        />
                        <div>
                            <p className="font-bold text-gray-800 text-base">{worker?.name || 'Worker'}</p>
                            <p className="text-xs text-orange-600 capitalize font-semibold">
                                {slot.skill} · {slot.hoursEstimated}h{slot._source === 'subtask' ? ' (sub-task)' : ''}
                            </p>
                        </div>
                    </div>

                    <AnimatePresence>
                        {alert.m && (
                            <Alert msg={alert.m} type={alert.t} onDismiss={() => setAlert({ m: '', t: 'error' })} />
                        )}
                    </AnimatePresence>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Rating <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map(s => (
                                <motion.button
                                    key={s}
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => setStars(s)}
                                    className={`text-4xl transition-all ${s <= stars ? 'text-yellow-400 drop-shadow-md' : 'text-gray-200'
                                        }`}
                                >
                                    ★
                                </motion.button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Points: <span className="text-orange-600 font-black">{points}</span>
                            <span className="text-xs text-gray-400 font-normal ml-1">(20–100)</span>
                        </label>
                        <input
                            type="range"
                            min={20}
                            max={100}
                            value={points}
                            onChange={e => setPoints(Number(e.target.value))}
                            className="w-full accent-orange-500"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>⚡ Basic</span>
                            <span>⭐ Good</span>
                            <span>🏆 Excellent</span>
                            <span>👑 Outstanding</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Feedback <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        <textarea
                            rows={2}
                            value={msg}
                            onChange={e => setMsg(e.target.value)}
                            placeholder="Share your feedback about their work..."
                            className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400 resize-none"
                        />
                    </div>
                </div>

                <div className="px-6 pb-6 flex gap-3">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onClose}
                        className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-2xl font-semibold text-sm hover:bg-gray-50"
                    >
                        Cancel
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSubmit}
                        disabled={sub}
                        className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-2xl font-bold disabled:opacity-60 text-sm shadow-md"
                    >
                        {sub ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 size={16} className="animate-spin" />
                                Submitting...
                            </span>
                        ) : idx < unratedSlots.length - 1 ? (
                            'Submit & Next →'
                        ) : (
                            'Submit Rating'
                        )}
                    </motion.button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ── Remove/Cancel Modals (Enhanced) ────────────────────────────────────────────
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
            <div className="bg-white w-full sm:rounded-3xl sm:max-w-md rounded-t-3xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center">
                        <UserX size={24} className="text-red-500" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-gray-900">Remove Worker</h3>
                        <p className="text-sm text-gray-500">
                            Remove <strong>{workerName}</strong> from <strong className="capitalize">{skill}</strong>
                        </p>
                    </div>
                </div>

                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-3 mb-4">
                    <p className="text-sm text-amber-700 flex items-center gap-2">
                        <AlertCircle size={14} /> Worker notified. Slot reopens for other workers.
                    </p>
                </div>

                <AnimatePresence>
                    {alert && <Alert msg={alert} type="error" onDismiss={() => setAlert('')} />}
                </AnimatePresence>

                <label className="block text-sm font-bold text-gray-700 mb-2">
                    Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                    rows={3}
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Please explain why you're removing this worker..."
                    className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-red-300 resize-none mb-5"
                />
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-2xl font-semibold hover:bg-gray-50">
                        Cancel
                    </button>
                    <button onClick={handle} disabled={loading || !reason.trim()}
                        className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold disabled:opacity-60">
                        {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Remove Worker'}
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
            <div className="bg-white w-full sm:rounded-3xl sm:max-w-md rounded-t-3xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center">
                        <XCircle size={24} className="text-red-500" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-gray-900">Cancel Job</h3>
                        <p className="text-sm text-gray-500 truncate max-w-[200px]">"{job.title}"</p>
                    </div>
                </div>

                {job.assignedTo?.length > 0 && (
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-3 mb-4">
                        <p className="text-sm text-amber-700 flex items-center gap-2">
                            <AlertCircle size={14} /> {job.assignedTo.length} worker(s) will be notified.
                        </p>
                    </div>
                )}

                <AnimatePresence>
                    {alert && <Alert msg={alert} type="error" onDismiss={() => setAlert('')} />}
                </AnimatePresence>

                <label className="block text-sm font-bold text-gray-700 mb-2">
                    Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                    rows={3}
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Please explain why you're cancelling this job..."
                    className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-red-300 resize-none mb-5"
                />
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-2xl font-semibold hover:bg-gray-50">
                        Keep Job
                    </button>
                    <button onClick={handle} disabled={loading || !reason.trim()}
                        className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold disabled:opacity-60">
                        {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Confirm Cancel'}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

// ── Pre-Start Alert Panel (Enhanced) ──────────────────────────────────────────
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
            className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 rounded-2xl p-4 space-y-3"
        >
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <AlertCircle size={20} className="text-red-500" />
                </div>
                <div>
                    <p className="font-bold text-red-800">Unfilled Positions — Job Starts Soon!</p>
                    <p className="text-xs text-red-600 mt-0.5">
                        Job starts in ~{Math.max(1, Math.floor(minsLeft))} min. The following skills have no worker assigned:
                    </p>
                </div>
            </div>
            <div className="space-y-2">
                {unfilledSlots.map(slot => (
                    <div key={slot._id?.toString()} className="bg-white border border-red-100 rounded-xl p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800 capitalize text-sm">{slot.skill}</span>
                            <span className="text-xs text-gray-400">~{slot.hoursEstimated}h</span>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => onRepost(slot)}
                                className="text-xs px-3 py-1.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg font-bold transition-all"
                            >
                                📤 Repost
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => onDismiss(slot._id?.toString(), slot.skill)}
                                className="text-xs px-3 py-1.5 border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50 font-bold transition-all"
                            >
                                ✕ Not Needed
                            </motion.button>
                        </div>
                    </div>
                ))}
            </div>
            <p className="text-xs text-red-500">
                <strong>Repost</strong> — creates a sub-task with a new start time so workers can still apply.<br />
                <strong>Not Needed</strong> — mark this skill as not required and proceed without it.
            </p>
        </motion.div>
    );
}

// ── Sub-Tasks Panel (Enhanced) ─────────────────────────────────────────────────
function SubTasksPanel({ job, onViewProfile, onAlert, onMarkDone, onRate }) {
    const subTasks = (job.subTasks || []).filter(s => s.status !== 'cancelled');
    if (!subTasks.length) return null;

    return (
        <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Layers size={12} /> Sub-tasks ({subTasks.filter(s => s.status === 'task_completed').length}/{subTasks.length} done)
            </p>
            <div className="space-y-2">
                {subTasks.map((sub, si) => {
                    const w = sub.assignedWorker;
                    const wid = (w?._id || w)?.toString();
                    const pendingApps = sub.applicants?.filter(a => a.status === 'pending') || [];

                    return (
                        <div key={sub._id?.toString() || si} className="border border-purple-200 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-2.5 bg-purple-100 border-b border-purple-200">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-purple-700 capitalize">{sub.skill}</span>
                                    <span className="text-[10px] text-purple-500">~{sub.hoursEstimated}h</span>
                                    {sub.scheduledTime && (
                                        <span className="text-[10px] text-purple-500 flex items-center gap-1">
                                            <Clock size={8} /> {sub.scheduledTime}
                                        </span>
                                    )}
                                    {sub.scheduledDate && (
                                        <span className="text-[10px] text-purple-400">
                                            {new Date(sub.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        </span>
                                    )}
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SLOT_SC[sub.status] || 'bg-gray-100 text-gray-400'}`}>
                                    {sub.status === 'open' ? 'Open' : sub.status === 'scheduled' ? 'Scheduled' : sub.status === 'running' ? 'Running' : sub.status === 'task_completed' ? '✓ Done' : sub.status}
                                </span>
                            </div>
                            <div className="px-4 py-2 space-y-2">
                                {w && (
                                    <div className="flex items-center gap-2">
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            onClick={() => onViewProfile(wid)}
                                            className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 text-left"
                                        >
                                            <img
                                                src={getImageUrl(w?.photo)}
                                                alt=""
                                                className="w-8 h-8 rounded-full object-cover border border-gray-200 flex-shrink-0"
                                                onError={e => { e.target.src = '/admin.png'; }}
                                            />
                                            <span className="text-xs font-semibold text-gray-700 truncate">{w?.name || 'Worker'}</span>
                                        </motion.button>
                                        <div className="flex gap-1 flex-shrink-0">
                                            {['running', 'scheduled'].includes(sub.status) && !sub.ratingSubmitted && job.completionPhotos?.length > 0 && (
                                                <motion.button
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    onClick={() => onRate(sub)}
                                                    className="text-[10px] px-2 py-1 bg-yellow-400 hover:bg-yellow-500 text-white rounded font-bold transition-all"
                                                >
                                                    Rate
                                                </motion.button>
                                            )}
                                            {['running', 'scheduled'].includes(sub.status) && sub.ratingSubmitted && (
                                                <motion.button
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    onClick={() => onMarkDone(sub._id?.toString())}
                                                    className="text-[10px] px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded font-bold transition-all"
                                                >
                                                    Mark Done
                                                </motion.button>
                                            )}
                                            {sub.ratingSubmitted && (
                                                <span className="text-[10px] bg-yellow-100 text-yellow-600 px-1.5 py-0.5 rounded font-bold">⭐</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {!w && sub.status === 'open' && (
                                    <p className="text-xs text-gray-400 italic">Waiting for worker applications…</p>
                                )}
                                {pendingApps.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                                            {pendingApps.length} applicant{pendingApps.length > 1 ? 's' : ''}
                                        </p>
                                        {pendingApps.map(app => {
                                            const appWid = (app.workerId?._id || app.workerId)?.toString();
                                            return (
                                                <div key={app._id} className="flex items-center gap-2 mb-1.5">
                                                    <motion.button
                                                        whileHover={{ scale: 1.02 }}
                                                        onClick={() => onViewProfile(appWid)}
                                                        className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 text-left"
                                                    >
                                                        <img
                                                            src={getImageUrl(app.workerId?.photo)}
                                                            alt=""
                                                            className="w-7 h-7 rounded-full object-cover border border-gray-200 flex-shrink-0"
                                                            onError={e => { e.target.src = '/admin.png'; }}
                                                        />
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-semibold text-gray-700 truncate">{app.workerId?.name || 'Worker'}</p>
                                                            <p className="text-[10px] text-gray-400">🏆 {app.workerId?.points || 0} pts</p>
                                                        </div>
                                                    </motion.button>
                                                    <div className="flex gap-1 flex-shrink-0">
                                                        <motion.button
                                                            whileHover={{ scale: 1.02 }}
                                                            whileTap={{ scale: 0.98 }}
                                                            onClick={() => onAlert('subtask-accept', sub._id?.toString(), appWid)}
                                                            className="text-[10px] px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded font-bold transition-all"
                                                        >
                                                            Accept
                                                        </motion.button>
                                                        <motion.button
                                                            whileHover={{ scale: 1.02 }}
                                                            whileTap={{ scale: 0.98 }}
                                                            onClick={() => onAlert('subtask-reject', sub._id?.toString(), appWid)}
                                                            className="text-[10px] px-2 py-1 border border-red-200 text-red-400 rounded hover:bg-red-50 font-bold transition-all"
                                                        >
                                                            Reject
                                                        </motion.button>
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

// ── Job Card Header (Enhanced) ─────────────────────────────────────────────────
function JobCardHeader({ job, isExpanded, onExpand, openSlots, filledSlots, doneSlots, totalSlots, pending, unratedSlots }) {
    const startInfo = useStartCountdown(job);
    const subTaskCount = (job.subTasks || []).filter(s => !['cancelled'].includes(s.status)).length;

    return (
        <div
            className="flex items-start gap-3 p-5 cursor-pointer hover:bg-gradient-to-r hover:from-gray-50 hover:to-orange-50/30 transition-all"
            onClick={onExpand}
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-gray-900 text-base leading-snug line-clamp-1">{job.title}</h3>
                    <SBadge status={job.status} />
                </div>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap text-sm">
                    <span className="font-black text-green-600 text-lg">₹{job.payment?.toLocaleString()}</span>
                    {job.location?.city && (
                        <span className="text-gray-400 text-xs flex items-center gap-1">
                            <MapPin size={10} /> {job.location.city}
                        </span>
                    )}
                    {job.scheduledDate && (
                        <span className="text-gray-400 text-xs flex items-center gap-1">
                            <Calendar size={10} />
                            {new Date(job.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            {job.scheduledTime && ` ${job.scheduledTime}`}
                        </span>
                    )}
                </div>

                {totalSlots > 0 && (
                    <div className="flex items-center gap-3 mt-2 flex-wrap text-xs">
                        {openSlots > 0 && (
                            <span className="text-gray-500 flex items-center gap-1">
                                <Zap size={10} /> {openSlots} open
                            </span>
                        )}
                        {filledSlots > 0 && (
                            <span className="text-blue-600 flex items-center gap-1">
                                <UserCheck size={10} /> {filledSlots} assigned
                            </span>
                        )}
                        {doneSlots > 0 && (
                            <span className="text-green-600 flex items-center gap-1">
                                <CheckCircle size={10} /> {doneSlots} done
                            </span>
                        )}
                        {pending.length > 0 && (
                            <span className="text-orange-500 flex items-center gap-1">
                                <Users size={10} /> {pending.length} pending
                            </span>
                        )}
                        {job.status === 'running' && unratedSlots.length > 0 && (
                            <span className="text-purple-500 flex items-center gap-1">
                                <Star size={10} /> {unratedSlots.length} to rate
                            </span>
                        )}
                        {job.status === 'scheduled' && !startInfo.canStart && (
                            <span className="text-blue-500 font-mono flex items-center gap-1">
                                <ClockIcon size={10} /> {startInfo.remaining}
                            </span>
                        )}
                        {job.status === 'scheduled' && (job.workerSlots || []).some(s => s.status === 'open') && !startInfo.canStart && startInfo.remaining !== '00:00:00' && (
                            <span className="text-red-500 font-bold text-[10px] bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <AlertCircle size={10} /> Unfilled slots
                            </span>
                        )}
                    </div>
                )}

                {subTaskCount > 0 && (
                    <span className="text-[10px] text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded-full mt-1 inline-flex items-center gap-1">
                        <Layers size={10} /> {subTaskCount} sub-task(s)
                    </span>
                )}
            </div>
            <div className="flex-shrink-0 text-gray-400 mt-1">
                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
        </div>
    );
}

// ── Start Button (Enhanced) ────────────────────────────────────────────────────
function StartButton({ job, onStart }) {
    const startInfo = useStartCountdown(job);
    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onStart(job._id)}
            disabled={!startInfo.canStart}
            className={`flex-1 min-w-[140px] py-2.5 rounded-xl font-bold text-sm transition-all ${startInfo.canStart
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
        >
            {startInfo.canStart ? (
                <span className="flex items-center justify-center gap-2">
                    <Truck size={14} /> Start Job
                </span>
            ) : (
                <span className="flex items-center justify-center gap-2">
                    <ClockIcon size={14} /> {startInfo.remaining}
                </span>
            )}
        </motion.button>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
const TABS = ['open', 'scheduled', 'running', 'completed', 'cancelled', 'favourites'];
const TLABELS = { open: 'Open', scheduled: 'Scheduled', running: 'Running', completed: 'Completed', cancelled: 'Cancelled', favourites: '⭐ Favourites' };

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
                setAlert(jobId, `Worker accepted as ${skill}! Slot assigned.`, 'success');
            }
        } catch (err) {
            setAlert(jobId, err?.response?.data?.message || 'Failed.', err?.response?.status === 409 ? 'warning' : 'error');
        }
    };

    const handleSubTaskRespond = async (jobId, subTaskId, workerId, status) => {
        try {
            const { data } = await respondToSubTaskApplicant(jobId, { subTaskId, workerId, status });
            setJobs(p => p.map(j => j._id === jobId ? data.job : j));
            if (status === 'accepted') setAlert(jobId, 'Sub-task applicant accepted! They have been notified.', 'success');
        } catch (err) {
            setAlert(jobId, err?.response?.data?.message || 'Failed.', err?.response?.status === 409 ? 'warning' : 'error');
        }
    };

    const handleMarkSlotDone = async (jobId, workerId, slotId, skill) => {
        if (!window.confirm(`Mark ${skill} task complete? The worker will be freed.`)) return;
        try {
            const { data } = await completeWorkerTask(jobId, workerId, slotId);
            setJobs(p => p.map(j => j._id === jobId ? data.job : j));
            setAlert(jobId, `${skill} task done. Worker is free.`, 'success');
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
        if (!window.confirm(`Mark "${skillName}" as not required? This slot will be closed.`)) return;
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
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full"
                />
                <p className="mt-4 text-gray-500 font-semibold">Loading your jobs...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/20 p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-5 pb-20">
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
                            <h1 className="text-3xl font-black">Manage Jobs</h1>
                            <p className="text-white/90 text-sm mt-1">Track and manage your posted jobs</p>
                        </div>
                    </div>
                    <div className="flex gap-3 mt-3">
                        <span className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1 text-sm">
                            <Briefcase size={12} /> {jobs.length} Total Jobs
                        </span>
                        <span className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1 text-sm">
                            <TrendingUp size={12} /> {jobs.filter(j => j.status === 'running').length} In Progress
                        </span>
                    </div>
                </motion.div>

                {/* Tabs */}
                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                    {TABS.map(t => (
                        <motion.button
                            key={t}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setTab(t)}
                            className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${tab === t
                                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                                    : 'bg-white text-gray-600 border-2 border-gray-200 hover:border-orange-300'
                                }`}
                        >
                            {TLABELS[t]}
                            {tabCount(t) > 0 && (
                                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab === t ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                    {tabCount(t)}
                                </span>
                            )}
                        </motion.button>
                    ))}
                </div>

                {/* Favourites Tab */}
                {tab === 'favourites' && (
                    <div>
                        {starredIds.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-16 bg-white rounded-3xl shadow-xl border border-gray-100"
                            >
                                <div className="text-6xl mb-4">⭐</div>
                                <p className="font-bold text-gray-800 text-xl mb-2">No favourite workers</p>
                                <p className="text-gray-400 text-sm">Star workers you like to easily find them later</p>
                            </motion.div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {starredIds.map(wid => (
                                    <motion.div
                                        key={wid}
                                        whileHover={{ scale: 1.02 }}
                                        onClick={() => setProfileWid(wid)}
                                        className="bg-white border-2 border-gray-100 rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:border-orange-200 hover:shadow-md transition-all"
                                    >
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-orange-100 to-amber-100 flex items-center justify-center text-2xl">
                                            👷
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-gray-700">Starred Worker</p>
                                            <p className="text-xs text-gray-400">Tap to view profile</p>
                                        </div>
                                        <button
                                            onClick={e => { e.stopPropagation(); handleStar(wid); }}
                                            className="text-yellow-400 text-xl hover:scale-110 transition-transform"
                                        >
                                            ★
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Job Cards */}
                {tab !== 'favourites' && (
                    <>
                        {tabJobs.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-16 bg-white rounded-3xl shadow-xl border border-gray-100"
                            >
                                <div className="text-6xl mb-4">📋</div>
                                <p className="font-bold text-gray-800 text-xl mb-2">No {tab} jobs</p>
                                <p className="text-gray-400 text-sm">Jobs you post will appear here</p>
                            </motion.div>
                        ) : (
                            <div className="space-y-4">
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

                                    return (
                                        <motion.div
                                            key={job._id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -20 }}
                                            className="bg-white rounded-2xl border-2 border-gray-100 shadow-md hover:shadow-xl transition-all overflow-hidden"
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
                                                <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4">
                                                    <AnimatePresence>
                                                        {cAlert?.msg && (
                                                            <Alert msg={cAlert.msg} type={cAlert.type} onDismiss={() => clearAlert(job._id)} />
                                                        )}
                                                    </AnimatePresence>

                                                    <p className="text-sm text-gray-600 leading-relaxed">{job.description}</p>

                                                    {isCancelled(job.status) && job.cancellationReason && (
                                                        <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-2xl p-3">
                                                            <p className="text-xs font-bold text-red-700 flex items-center gap-2">
                                                                <XCircle size={12} /> Cancelled
                                                                {job.cancelledAt && ` on ${new Date(job.cancelledAt).toLocaleDateString('en-IN')}`}
                                                            </p>
                                                            <p className="text-xs text-red-600 mt-1">Reason: {job.cancellationReason}</p>
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
                                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                                <Users size={12} /> Worker Slots ({doneSlots}/{totalSlots} complete)
                                                            </p>
                                                            <div className="space-y-2">
                                                                {job.workerSlots.map((slot, si) => {
                                                                    const w = slot.assignedWorker;
                                                                    const wid = (w?._id || w)?.toString();
                                                                    return (
                                                                        <div key={slot._id?.toString() || si} className="flex items-center gap-2 bg-gray-50 rounded-xl p-3 border border-gray-100">
                                                                            <div className="flex-shrink-0 w-[80px]">
                                                                                <span className="text-xs font-bold text-gray-700 capitalize block">{slot.skill}</span>
                                                                                <span className="text-[10px] text-gray-400">{slot.hoursEstimated}h est.</span>
                                                                            </div>
                                                                            {w ? (
                                                                                <motion.button
                                                                                    whileHover={{ scale: 1.02 }}
                                                                                    onClick={() => setProfileWid(wid)}
                                                                                    className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 text-left"
                                                                                >
                                                                                    <img
                                                                                        src={getImageUrl(w?.photo)}
                                                                                        alt=""
                                                                                        className="w-8 h-8 rounded-full object-cover border border-gray-200 flex-shrink-0"
                                                                                        onError={e => { e.target.src = '/admin.png'; }}
                                                                                    />
                                                                                    <div className="min-w-0">
                                                                                        <span className="text-xs font-semibold text-gray-800 truncate block">{w?.name || 'Worker'}</span>
                                                                                        {w?.mobile && <span className="text-[10px] text-gray-400">📞 {w.mobile}</span>}
                                                                                    </div>
                                                                                </motion.button>
                                                                            ) : (
                                                                                <span className="flex-1 text-xs text-gray-400 italic">
                                                                                    {slot.status === 'not_required' ? 'Not required' : slot.status === 'reposted' ? '→ Sub-task created' : 'No worker assigned'}
                                                                                </span>
                                                                            )}
                                                                            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SLOT_SC[slot.status] || 'bg-gray-100 text-gray-400'}`}>
                                                                                    {slot.status === 'open' ? 'Open' : slot.status === 'filled' ? 'Assigned' : slot.status === 'task_completed' ? '✓ Done' : slot.status === 'not_required' ? 'Not Needed' : slot.status === 'reposted' ? 'Reposted' : 'Cancelled'}
                                                                                </span>
                                                                                {slot.ratingSubmitted && (
                                                                                    <span className="text-[10px] bg-yellow-100 text-yellow-600 px-1.5 py-0.5 rounded-full font-bold">⭐</span>
                                                                                )}
                                                                                {job.status === 'running' && slot.status === 'filled' && wid && (
                                                                                    <motion.button
                                                                                        whileHover={{ scale: 1.02 }}
                                                                                        whileTap={{ scale: 0.98 }}
                                                                                        onClick={() => handleMarkSlotDone(job._id, wid, slot._id?.toString(), slot.skill)}
                                                                                        className="text-[10px] px-2.5 py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition-all"
                                                                                    >
                                                                                        Mark Done
                                                                                    </motion.button>
                                                                                )}
                                                                                {['open', 'scheduled'].includes(job.status) && slot.status === 'filled' && wid && (
                                                                                    <motion.button
                                                                                        whileHover={{ scale: 1.02 }}
                                                                                        whileTap={{ scale: 0.98 }}
                                                                                        onClick={() => setRemoveData({ job, slotId: slot._id?.toString(), workerId: wid, workerName: w?.name, skill: slot.skill })}
                                                                                        className="text-[10px] px-2 py-1 border border-red-200 text-red-400 rounded-lg hover:bg-red-50 font-bold transition-all"
                                                                                    >
                                                                                        Remove
                                                                                    </motion.button>
                                                                                )}
                                                                                {job.status === 'completed' && wid && (
                                                                                    <motion.button
                                                                                        whileHover={{ scale: 1.02 }}
                                                                                        whileTap={{ scale: 0.98 }}
                                                                                        onClick={() => handleStar(wid)}
                                                                                        className={`text-[10px] px-2 py-1 rounded-lg font-bold border ${starredIds.includes(wid)
                                                                                                ? 'bg-yellow-50 border-yellow-200 text-yellow-600'
                                                                                                : 'border-gray-200 text-gray-400 hover:border-yellow-200'
                                                                                            }`}
                                                                                    >
                                                                                        {starredIds.includes(wid) ? '★' : '☆'}
                                                                                    </motion.button>
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

                                                    {/* Applicants */}
                                                    {['open', 'scheduled'].includes(job.status) && (
                                                        <div>
                                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                                <Users size={12} /> Applicants ({pending.length} pending)
                                                            </p>
                                                            {pending.length === 0 ? (
                                                                <p className="text-xs text-gray-400 text-center py-3">No pending applicants.</p>
                                                            ) : (
                                                                Object.entries(bySkill).map(([sk, apps]) => (
                                                                    <div key={sk} className="mb-4">
                                                                        <div className="flex items-center gap-2 mb-2">
                                                                            <span className="text-xs font-bold bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 px-2.5 py-1 rounded-full capitalize border border-purple-200">
                                                                                {sk}
                                                                            </span>
                                                                            {openBySkill[sk] ? (
                                                                                <span className="text-xs text-gray-400">{openBySkill[sk]} slot{openBySkill[sk] > 1 ? 's' : ''} open</span>
                                                                            ) : (
                                                                                <span className="text-xs text-red-400 font-medium">All slots filled</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            {apps.map(app => {
                                                                                const wId = (app.workerId?._id || app.workerId)?.toString();
                                                                                return (
                                                                                    <div key={app._id} className={`flex items-center gap-3 rounded-xl p-3 ${!openBySkill[sk] ? 'bg-gray-50 opacity-70' : 'bg-gradient-to-r from-gray-50 to-white border border-gray-100'
                                                                                        }`}>
                                                                                        <motion.button
                                                                                            whileHover={{ scale: 1.02 }}
                                                                                            onClick={() => setProfileWid(wId)}
                                                                                            className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 text-left"
                                                                                        >
                                                                                            <img
                                                                                                src={getImageUrl(app.workerId?.photo)}
                                                                                                alt=""
                                                                                                className="w-9 h-9 rounded-full object-cover border border-gray-200 flex-shrink-0"
                                                                                                onError={e => { e.target.src = '/admin.png'; }}
                                                                                            />
                                                                                            <div className="min-w-0">
                                                                                                <p className="text-sm font-bold text-gray-800 truncate">{app.workerId?.name || 'Worker'}</p>
                                                                                                <p className="text-xs text-gray-400 flex items-center gap-1">
                                                                                                    <Award size={10} /> {app.workerId?.points || 0} pts · {sk}
                                                                                                </p>
                                                                                            </div>
                                                                                        </motion.button>
                                                                                        <div className="flex gap-1.5 flex-shrink-0">
                                                                                            <motion.button
                                                                                                whileHover={{ scale: 1.02 }}
                                                                                                whileTap={{ scale: 0.98 }}
                                                                                                onClick={() => handleRespond(job._id, wId, 'accepted', sk)}
                                                                                                disabled={!openBySkill[sk]}
                                                                                                className={`text-xs px-2.5 py-1.5 rounded-lg font-bold transition-all ${openBySkill[sk]
                                                                                                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-sm'
                                                                                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                                                                    }`}
                                                                                            >
                                                                                                Accept
                                                                                            </motion.button>
                                                                                            <motion.button
                                                                                                whileHover={{ scale: 1.02 }}
                                                                                                whileTap={{ scale: 0.98 }}
                                                                                                onClick={() => handleRespond(job._id, wId, 'rejected', sk)}
                                                                                                className="text-xs px-2.5 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 font-bold transition-all"
                                                                                            >
                                                                                                Reject
                                                                                            </motion.button>
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
                                                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-2xl p-4 space-y-3">
                                                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-2">
                                                                <CheckCircle size={12} /> Completion Steps
                                                            </p>
                                                            <div className={`flex items-center gap-3 p-3 rounded-xl border ${hasPhotos ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' : 'bg-white border-gray-200'
                                                                }`}>
                                                                <span className="text-lg flex-shrink-0">{hasPhotos ? '✅' : '1️⃣'}</span>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className={`text-sm font-semibold ${hasPhotos ? 'text-green-700' : 'text-gray-700'}`}>Upload Completion Photos</p>
                                                                    {hasPhotos ? (
                                                                        <p className="text-xs text-green-600">{job.completionPhotos.length} photo(s) uploaded</p>
                                                                    ) : (
                                                                        <p className="text-xs text-gray-400">Required before rating</p>
                                                                    )}
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
                                                                        <motion.button
                                                                            whileHover={{ scale: 1.02 }}
                                                                            whileTap={{ scale: 0.98 }}
                                                                            onClick={() => photoRef.current[job._id]?.click()}
                                                                            disabled={uploadingPhotos[job._id]}
                                                                            className="text-xs px-3 py-1.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg font-bold flex-shrink-0 disabled:opacity-60 transition-all"
                                                                        >
                                                                            {uploadingPhotos[job._id] ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} className="inline mr-1" />}
                                                                            {uploadingPhotos[job._id] ? 'Uploading…' : 'Upload'}
                                                                        </motion.button>
                                                                    </>
                                                                )}
                                                            </div>

                                                            <div className={`flex items-start gap-3 p-3 rounded-xl border ${!hasPhotos ? 'opacity-50 pointer-events-none bg-white border-gray-100' : allRated ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' : 'bg-white border-gray-200'
                                                                }`}>
                                                                <span className="text-lg flex-shrink-0 mt-0.5">{allRated ? '✅' : '2️⃣'}</span>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className={`text-sm font-semibold ${allRated ? 'text-green-700' : 'text-gray-700'}`}>
                                                                        Rate Each Worker <span className="text-red-500">*</span>
                                                                    </p>
                                                                    <div className="mt-2 space-y-1.5">
                                                                        {[...assignedSlots, ...subTaskSlots].map((slot, i) => (
                                                                            <div key={slot._id?.toString() || i} className="flex items-center gap-2">
                                                                                <img
                                                                                    src={getImageUrl(slot.assignedWorker?.photo)}
                                                                                    alt=""
                                                                                    className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                                                                                    onError={e => { e.target.src = '/admin.png'; }}
                                                                                />
                                                                                <span className="text-xs text-gray-600 flex-1 capitalize">
                                                                                    {slot.assignedWorker?.name || 'Worker'} — {slot.skill}
                                                                                    {(job.subTasks || []).some(s => s._id?.toString() === slot._id?.toString()) && (
                                                                                        <span className="text-[10px] text-purple-400 ml-1">(sub-task)</span>
                                                                                    )}
                                                                                </span>
                                                                                {slot.ratingSubmitted ? (
                                                                                    <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-bold flex-shrink-0">⭐ Rated</span>
                                                                                ) : (
                                                                                    <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-medium flex-shrink-0">Not rated</span>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    {!allRated && (
                                                                        <p className="text-xs text-gray-400 mt-1.5">{unratedSlots.length} worker(s) not yet rated</p>
                                                                    )}
                                                                </div>
                                                                {hasPhotos && !allRated && (
                                                                    <motion.button
                                                                        whileHover={{ scale: 1.02 }}
                                                                        whileTap={{ scale: 0.98 }}
                                                                        onClick={() => setRatingJob(job)}
                                                                        className="text-xs px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-white rounded-lg font-bold flex-shrink-0 mt-0.5 transition-all"
                                                                    >
                                                                        Rate Workers
                                                                    </motion.button>
                                                                )}
                                                            </div>

                                                            <div className={`flex items-center gap-3 p-3 rounded-xl border ${(!hasPhotos || !allRated) ? 'opacity-50 pointer-events-none bg-white border-gray-100' : 'bg-white border-orange-200'
                                                                }`}>
                                                                <span className="text-lg flex-shrink-0">3️⃣</span>
                                                                <div className="flex-1">
                                                                    <p className="text-sm font-semibold text-gray-700">Mark Job Complete</p>
                                                                    {(!hasPhotos || !allRated) && (
                                                                        <p className="text-xs text-gray-400">
                                                                            {!hasPhotos ? 'Upload photos first' : 'Rate all workers first'}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <motion.button
                                                                    whileHover={{ scale: 1.02 }}
                                                                    whileTap={{ scale: 0.98 }}
                                                                    onClick={() => handleMarkComplete(job._id)}
                                                                    disabled={!hasPhotos || !allRated}
                                                                    className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                                                >
                                                                    Complete
                                                                </motion.button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Actions */}
                                                    <div className="flex flex-wrap gap-2 pt-2">
                                                        {job.status === 'scheduled' && <StartButton job={job} onStart={handleStartJob} />}

                                                        {/* Live Location Tracking button */}
                                                        {['scheduled', 'running'].includes(job.status) && (job.assignedTo || []).length > 0 && (
                                                            <motion.button
                                                                whileHover={{ scale: 1.02 }}
                                                                whileTap={{ scale: 0.98 }}
                                                                onClick={() => navigate(`/client/live-tracking/${job._id}`)}
                                                                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-bold text-sm transition-all shadow-sm"
                                                            >
                                                                <Navigation size={14} /> See Live Location
                                                            </motion.button>
                                                        )}

                                                        {['open', 'scheduled'].includes(job.status) && (
                                                            <motion.button
                                                                whileHover={{ scale: 1.02 }}
                                                                whileTap={{ scale: 0.98 }}
                                                                onClick={() => setCancelModal(job)}
                                                                className="px-4 py-2.5 border-2 border-red-200 text-red-500 rounded-xl font-bold text-sm hover:bg-red-50 transition-all"
                                                            >
                                                                ✕ Cancel
                                                            </motion.button>
                                                        )}
                                                        {job.status === 'open' && (
                                                            <motion.button
                                                                whileHover={{ scale: 1.02 }}
                                                                whileTap={{ scale: 0.98 }}
                                                                onClick={() => handleDelete(job._id)}
                                                                className="px-4 py-2.5 border-2 border-red-200 text-red-500 rounded-xl font-bold text-sm hover:bg-red-50 transition-all"
                                                            >
                                                                🗑 Delete
                                                            </motion.button>
                                                        )}
                                                    </div>

                                                    {job.status === 'running' && (
                                                        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl px-4 py-2.5">
                                                            <p className="text-xs text-yellow-700 font-medium flex items-center gap-2">
                                                                <Truck size={12} /> Running: Mark each worker done → Upload photos → Rate workers → Mark complete
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </motion.div>
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