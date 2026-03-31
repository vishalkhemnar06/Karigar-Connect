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
import { useNavigate } from 'react-router-dom';
import {
    getClientJobs, deleteClientJob, cancelJob, updateJobStatus,
    uploadCompletionPhotos, startJob,
    removeAssignedWorker, completeWorkerTask, respondToApplicant,
    getJobSmartSuggestions, getSemanticWorkersForJob, inviteWorkersToJob,
    submitRating, toggleStarWorker, getWorkerFullProfile, getImageUrl,
    repostMissingSkill, dismissMissingSkill, respondToSubTaskApplicant,
    completeSubTask, initClientLocation, recordSemanticFeedback,
} from '../../api/index';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Briefcase, MapPin, Calendar, Clock, DollarSign, Users,
    Star, AlertCircle, CheckCircle, XCircle, Truck,
    Phone, Mail, ChevronDown, ChevronUp,
    Navigation, Loader2, Award, Zap,
    RefreshCw, Bookmark, Sparkles, Layers,
    Camera, UserCheck, UserX, FileText,
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
    const [info, setInfo] = useState({ canStart: true, remaining: '00:00' });
    useEffect(() => {
        if (!job?.scheduledDate || !job?.scheduledTime || job.status !== 'scheduled') {
            setInfo({ canStart: true, remaining: '00:00' });
            return;
        }
        const update = () => {
            const [h, m] = job.scheduledTime.split(':').map(Number);
            const dt = new Date(job.scheduledDate);
            dt.setHours(h, m, 0, 0);
            const minsLeft = Math.max(0, (dt.getTime() - Date.now()) / 60000);
            setInfo({
                canStart: minsLeft <= 0,
                remaining: `${pad2(Math.floor(minsLeft / 60))}:${pad2(Math.floor(minsLeft % 60))}`,
            });
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
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
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
const JobCard = ({
    job, isExpanded, alert, suggestions, loadingSuggestions, invitingWorkers,
    starredWorkers, onToggle, onSelectWorker, onRatingJob, onCancelJob,
    onRemoveWorker, onRepostData, onClearAlert, handlers, navigate,
}) => {
    const startInfo = useStartCountdown(job);

    const totalSlots      = (job.workerSlots||[]).length;
    const openSlots       = (job.workerSlots||[]).filter(s=>s.status==='open').length;
    const filledSlots     = (job.workerSlots||[]).filter(s=>s.status==='filled').length;
    const doneSlots       = (job.workerSlots||[]).filter(s=>s.status==='task_completed').length;
    const pendingApps     = (job.applicants||[]).filter(a=>a.status==='pending');
    const subTaskCount    = (job.subTasks||[]).filter(s=>s.status!=='cancelled').length;
    const assignedSlots   = (job.workerSlots||[]).filter(s=>s.assignedWorker && !['open','cancelled','not_required','reposted'].includes(s.status));
    const subTaskSlots    = (job.subTasks||[]).filter(s=>s.assignedWorker && s.status!=='cancelled');
    const unratedSlots    = [...assignedSlots.filter(s=>!s.ratingSubmitted), ...subTaskSlots.filter(s=>!s.ratingSubmitted)];
    const jobSuggestions  = suggestions[job._id] || [];
    const isLoadSugg      = loadingSuggestions[job._id];
    const isInviting      = invitingWorkers[job._id];
    const invitable       = jobSuggestions.filter(w=>!handlers.getLifecycle(job,w._id));
    const statusCfg       = getStatusCfg(job.status);
    const StatusIcon      = statusCfg.Icon;

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all">
            {/* Card header — always visible */}
            <div className="p-4 sm:p-5 cursor-pointer hover:bg-orange-50/30 transition-colors"
                onClick={() => onToggle(isExpanded ? null : job._id)}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <h3 className="font-black text-gray-900 text-sm sm:text-base leading-snug">{job.title}</h3>
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border} flex items-center gap-1`}>
                                <StatusIcon size={10}/>{statusCfg.label}
                            </span>
                            {job.urgent && <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-bold">⚡ Urgent</span>}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                            <span className="flex items-center gap-1"><DollarSign size={11}/>{fmtINR(job.payment)}</span>
                            {job.location?.city && <span className="flex items-center gap-1"><MapPin size={11}/>{job.location.city}</span>}
                            {job.scheduledDate && <span className="flex items-center gap-1"><Calendar size={11}/>{fmtDate(job.scheduledDate)}{job.scheduledTime && ` · ${job.scheduledTime}`}</span>}
                        </div>

                        {totalSlots > 0 && (
                            <div className="flex items-center gap-2.5 mt-2 flex-wrap">
                                {openSlots   > 0 && <span className="text-[11px] text-amber-600 flex items-center gap-1 font-medium"><Zap size={9}/>{openSlots} open</span>}
                                {filledSlots > 0 && <span className="text-[11px] text-blue-600  flex items-center gap-1 font-medium"><UserCheck size={9}/>{filledSlots} assigned</span>}
                                {doneSlots   > 0 && <span className="text-[11px] text-green-600 flex items-center gap-1 font-medium"><CheckCircle size={9}/>{doneSlots} done</span>}
                                {pendingApps.length > 0 && <span className="text-[11px] text-orange-600 flex items-center gap-1 font-medium"><Users size={9}/>{pendingApps.length} pending</span>}
                                {unratedSlots.length > 0 && <span className="text-[11px] text-purple-600 flex items-center gap-1 font-medium"><Star size={9}/>{unratedSlots.length} to rate</span>}
                                {subTaskCount > 0 && <span className="text-[11px] text-indigo-600 flex items-center gap-1 font-medium"><Layers size={9}/>{subTaskCount} sub-tasks</span>}
                            </div>
                        )}
                    </div>
                    <div className="text-gray-300 flex-shrink-0">
                        {isExpanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                    </div>
                </div>
            </div>

            {/* Expanded content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}}
                        transition={{duration:0.22}}
                        className="border-t border-gray-100"
                    >
                        <div className="p-4 sm:p-5 space-y-4">
                            {/* Inline alert */}
                            {alert && <InlineAlert msg={alert.message} type={alert.type} onDismiss={()=>onClearAlert(job._id)}/>}

                            {/* Description */}
                            <p className="text-sm text-gray-600 leading-relaxed">{job.description}</p>

                            {/* Cancellation reason */}
                            {isCancelled(job.status) && job.cancellationReason && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-3.5">
                                    <p className="text-xs font-bold text-red-700 flex items-center gap-1 mb-1"><XCircle size={12}/>Cancellation Reason</p>
                                    <p className="text-sm text-red-600">{job.cancellationReason}</p>
                                </div>
                            )}

                            {/* Pre-start unfilled slots alert */}
                            {job.status === 'scheduled' && openSlots > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                    <p className="text-xs font-bold text-amber-800 mb-3">⚠️ Unfilled Positions — Job Starting Soon</p>
                                    <div className="space-y-2">
                                        {(job.workerSlots||[]).filter(s=>s.status==='open').map(slot=>(
                                            <div key={slot._id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-100">
                                                <span className="text-sm font-semibold capitalize text-gray-700">{slot.skill}</span>
                                                <div className="flex gap-2">
                                                    <button onClick={()=>onRepostData({job,slot})}
                                                        className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all">Repost</button>
                                                    <button onClick={()=>handlers.dismissSkill(job._id,slot._id,slot.skill)}
                                                        className="px-3 py-1 border-2 border-gray-200 text-gray-500 hover:bg-gray-50 rounded-lg text-xs font-semibold transition-all">Skip</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Worker Slots */}
                            {(job.workerSlots||[]).length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                        <Users size={11}/> Worker Slots ({doneSlots}/{totalSlots} complete)
                                    </p>
                                    <div className="space-y-2">
                                        {job.workerSlots.map((slot,i)=>{
                                            const sc     = getSlotCfg(slot.status);
                                            const SlotIc = sc.Icon;
                                            const w      = slot.assignedWorker;
                                            const wId    = (w?._id||w)?.toString();
                                            return (
                                                <div key={slot._id||i} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className="min-w-[68px]">
                                                            <p className="text-sm font-bold capitalize text-gray-800">{slot.skill}</p>
                                                            <p className="text-[10px] text-gray-400">{slot.hoursEstimated}h est.</p>
                                                        </div>
                                                        {w ? (
                                                            <button onClick={()=>onSelectWorker(wId)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                                                                <img src={getImageUrl(w?.photo)} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm" onError={e=>{e.target.src='/admin.png';}}/>
                                                                <span className="text-sm font-semibold text-gray-800 truncate max-w-[100px]">{w?.name}</span>
                                                            </button>
                                                        ) : (
                                                            <span className="text-xs text-gray-400 italic">
                                                                {slot.status==='not_required'?'Not required':slot.status==='reposted'?'Sub-task created':'Unfilled'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sc.bg} ${sc.color} flex items-center gap-1`}>
                                                            <SlotIc size={9}/>{sc.label}
                                                        </span>
                                                        {slot.ratingSubmitted && <span className="text-[10px] text-yellow-600 font-bold">⭐</span>}
                                                        {job.status==='running' && slot.status==='filled' && wId && (
                                                            <button onClick={()=>handlers.markSlotDone(job._id,wId,slot._id,slot.skill)}
                                                                className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg text-[10px] font-bold transition-all">Done</button>
                                                        )}
                                                        {['open','scheduled'].includes(job.status) && slot.status==='filled' && wId && (
                                                            <button onClick={()=>onRemoveWorker({job,slotId:slot._id,workerId:wId,workerName:w?.name,skill:slot.skill})}
                                                                className="px-2 py-1 border border-red-200 text-red-500 hover:bg-red-50 rounded-lg text-[10px] font-semibold transition-all">Remove</button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Pending Applicants */}
                            {pendingApps.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                        <Users size={11}/> Pending Applicants ({pendingApps.length})
                                    </p>
                                    <div className="space-y-2">
                                        {pendingApps.slice(0,5).map((app,i)=>{
                                            const w = app.workerId;
                                            return (
                                                <div key={i} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                                                    <button onClick={()=>onSelectWorker((w?._id||w)?.toString())} className="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-opacity">
                                                        <img src={getImageUrl(w?.photo)} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm" onError={e=>{e.target.src='/admin.png';}}/>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-bold text-gray-800 truncate">{w?.name||'Worker'}</p>
                                                            <p className="text-[10px] text-blue-600 capitalize">{app.skill||'general'}</p>
                                                        </div>
                                                    </button>
                                                    <div className="flex gap-1.5 flex-shrink-0">
                                                        <button onClick={()=>handlers.respondApplicant(job._id,(w?._id||w)?.toString(),'accepted',app.skill)}
                                                            className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-bold transition-all">Accept</button>
                                                        <button onClick={()=>handlers.respondApplicant(job._id,(w?._id||w)?.toString(),'rejected',app.skill)}
                                                            className="px-3 py-1.5 border border-red-200 text-red-500 hover:bg-red-50 rounded-lg text-xs font-bold transition-all">Reject</button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Smart Suggestions */}
                            {['open','scheduled'].includes(job.status) && (
                                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-sm font-black text-indigo-700 flex items-center gap-1.5"><Sparkles size={13}/> Smart Suggestions</p>
                                        <div className="flex gap-2">
                                            <button onClick={()=>handlers.loadSuggestions(job._id)} disabled={isLoadSugg||isInviting}
                                                className="px-3 py-1.5 text-xs bg-white border border-indigo-200 text-indigo-600 rounded-lg font-bold hover:bg-indigo-50 disabled:opacity-50 transition-all">
                                                {isLoadSugg?'Finding…':'Find Matches'}
                                            </button>
                                            {jobSuggestions.length>0 && (
                                                <button onClick={()=>handlers.inviteWorkers(job._id,invitable.map(w=>w._id))} disabled={isInviting||invitable.length===0}
                                                    className="px-3 py-1.5 text-xs bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-bold disabled:opacity-50 transition-all">
                                                    {isInviting?'Inviting…':`Invite (${invitable.length})`}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {jobSuggestions.length===0 ? (
                                        <p className="text-xs text-indigo-500">Click "Find Matches" to discover workers who match your job requirements.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {jobSuggestions.slice(0,3).map(w=>{
                                                const ls = handlers.getLifecycle(job,w._id);
                                                return (
                                                    <div key={w._id} className="bg-white border border-indigo-100 rounded-xl p-3 flex items-center gap-3">
                                                        <img src={getImageUrl(w.photo)} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0 border-2 border-white shadow-sm" onError={e=>{e.target.src='/admin.png';}}/>
                                                        <div className="flex-1 min-w-0">
                                                            <button onClick={()=>onSelectWorker(w._id)} className="font-bold text-gray-900 text-sm hover:text-indigo-600 transition-colors">{w.name}</button>
                                                            <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                                                                <span className="flex items-center gap-0.5"><Star size={9}/>{(w.avgStars||0).toFixed(1)}</span>
                                                                <span className="flex items-center gap-0.5"><Award size={9}/>{w.points} pts</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex-shrink-0 text-right">
                                                            <p className="text-sm font-black text-indigo-600">{w.matchPercent}%</p>
                                                            {!ls ? (
                                                                <button onClick={()=>handlers.inviteWorkers(job._id,[w._id])} disabled={isInviting}
                                                                    className="text-[10px] px-2 py-0.5 bg-indigo-500 text-white rounded-lg font-bold mt-0.5 disabled:opacity-50">Invite</button>
                                                            ) : (
                                                                <p className="text-[10px] text-gray-400 mt-0.5 capitalize">{ls}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Rate workers button */}
                            {['running','completed'].includes(job.status) && unratedSlots.length > 0 && (
                                <button onClick={()=>onRatingJob(job)}
                                    className="w-full py-3 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-white font-black rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95">
                                    <Star size={16}/> Rate Workers ({unratedSlots.length} remaining)
                                </button>
                            )}

                            {/* Completion photos upload */}
                            {job.status === 'running' && (
                                <div>
                                    <label className="flex items-center gap-2 cursor-pointer py-2.5 px-4 border-2 border-dashed border-orange-200 rounded-xl hover:border-orange-400 hover:bg-orange-50 transition-all">
                                        <Camera size={16} className="text-orange-400"/>
                                        <span className="text-sm text-orange-600 font-semibold">Upload Completion Photos</span>
                                        <input type="file" multiple accept="image/*" className="hidden"
                                            onChange={e=>handlers.uploadPhotos(job._id,e.target.files)}/>
                                    </label>
                                </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex flex-wrap gap-2 pt-1">
                                {job.status === 'scheduled' && (
                                    <button onClick={()=>handlers.startJob(job._id)} disabled={!startInfo.canStart}
                                        className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95 ${startInfo.canStart?'bg-blue-500 hover:bg-blue-600 text-white shadow-sm':'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                                        <Truck size={13}/>{startInfo.canStart?'Start Job':`Starts in ${startInfo.remaining}`}
                                    </button>
                                )}
                                {['scheduled','running'].includes(job.status) && (job.assignedTo||[]).length>0 && (
                                    <button onClick={()=>navigate(`/client/live-tracking/${job._id}`)}
                                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95">
                                        <Navigation size={13}/> Track Workers
                                    </button>
                                )}
                                {['open','scheduled'].includes(job.status) && (
                                    <button onClick={()=>onCancelJob(job)}
                                        className="px-4 py-2 border-2 border-red-200 text-red-500 hover:bg-red-50 rounded-xl text-sm font-bold transition-all active:scale-95">
                                        Cancel Job
                                    </button>
                                )}
                                {job.status === 'open' && (
                                    <button onClick={()=>handlers.deleteJob(job._id)}
                                        className="px-4 py-2 border-2 border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl text-sm font-bold transition-all active:scale-95">
                                        Delete
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
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
    const navigate = useNavigate();

    const [jobs,           setJobs]          = useState([]);
    const [loading,        setLoading]       = useState(true);
    const [activeTab,      setActiveTab]     = useState('open');
    const [expandedId,     setExpandedId]    = useState(null);
    const [starredWorkers, setStarred]       = useState([]);
    const [alerts,         setAlerts]        = useState({});
    const [selectedWorker, setSelectedWorker]= useState(null);
    const [ratingJob,      setRatingJob]     = useState(null);
    const [cancelJob_,     setCancelJob]     = useState(null);
    const [removeWorker,   setRemoveWorker]  = useState(null);
    const [repostData,     setRepostData]    = useState(null);
    const [suggestions,    setSuggestions]   = useState({});
    const [loadingSugg,    setLoadingSugg]   = useState({});
    const [inviting,       setInviting]      = useState({});

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
    const setAlert   = (jId, msg, type='error') => setAlerts(p=>({...p,[jId]:{message:msg,type}}));
    const clearAlert = (jId) => setAlerts(p=>{ const n={...p}; delete n[jId]; return n; });

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleStarWorker = async (wId) => {
        try {
            const { data } = await toggleStarWorker(wId);
            setStarred(data.starredWorkers?.map(id=>id?.toString())||[]);
        } catch { toast.error('Unable to update favourite'); }
    };

    const handleRespondApplicant = async (jId, wId, status, skill) => {
        try {
            const { data } = await respondToApplicant(jId, { workerId:wId, status, skill });
            setJobs(p=>p.map(j=>j._id===jId?data.job:j));
            if (status==='accepted') {
                setAlert(jId, `Worker accepted for ${skill}!`, 'success');
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(pos=>{
                        initClientLocation(jId, pos.coords.latitude, pos.coords.longitude).catch(()=>null);
                    });
                }
            }
        } catch (e) { setAlert(jId, e?.response?.data?.message||'Failed.', e?.response?.status===409?'warning':'error'); }
    };

    const handleMarkSlotDone = async (jId, wId, slotId, skill) => {
        if (!window.confirm(`Mark "${skill}" as complete?`)) return;
        try {
            const { data } = await completeWorkerTask(jId, wId, slotId);
            setJobs(p=>p.map(j=>j._id===jId?data.job:j));
            setAlert(jId, `${skill} completed!`, 'success');
        } catch (e) { setAlert(jId, e?.response?.data?.message||'Failed.', 'error'); }
    };

    const handleStartJob = async (jId) => {
        try {
            const { data } = await startJob(jId);
            setJobs(p=>p.map(j=>j._id===jId?data.job:j));
            setAlert(jId, 'Job started! Workers notified.', 'success');
        } catch (e) { setAlert(jId, e?.response?.data?.message||'Failed.', 'error'); }
    };

    const handleDeleteJob = async (jId) => {
        if (!window.confirm('Delete this job permanently?')) return;
        try {
            await deleteClientJob(jId);
            setJobs(p=>p.filter(j=>j._id!==jId));
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
                    name:         w.name||r.name||'',
                    photo:        w.photo||r.photo||'',
                    points:       Number(w.points||r.points||0),
                    avgStars:     Number(w.avgStars||r.avgStars||0),
                    matchPercent: toPercent(r.score||r.semanticScore||0),
                };
            });
            setSuggestions(p=>({...p,[jId]:norm}));
        } catch (e) { setAlert(jId, e?.response?.data?.message||'Failed.', 'error'); }
        finally { setLoadingSugg(p=>({...p,[jId]:false})); }
    };

    const handleInviteWorkers = async (jId, wIds) => {
        if (!wIds.length) return;
        try {
            setInviting(p=>({...p,[jId]:true}));
            const { data } = await inviteWorkersToJob(jId, wIds);
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
                        <div className="flex gap-3">
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
                    <div className="space-y-4">
                        {filtered.map(job => (
                            <JobCard
                                key={job._id}
                                job={job}
                                isExpanded={expandedId === job._id}
                                alert={alerts[job._id]}
                                suggestions={suggestions}
                                loadingSuggestions={loadingSugg}
                                invitingWorkers={inviting}
                                starredWorkers={starredWorkers}
                                onToggle={setExpandedId}
                                onSelectWorker={setSelectedWorker}
                                onRatingJob={setRatingJob}
                                onCancelJob={setCancelJob}
                                onRemoveWorker={setRemoveWorker}
                                onRepostData={setRepostData}
                                onClearAlert={clearAlert}
                                handlers={{
                                    respondApplicant: handleRespondApplicant,
                                    markSlotDone:     handleMarkSlotDone,
                                    startJob:         handleStartJob,
                                    deleteJob:        handleDeleteJob,
                                    dismissSkill:     handleDismissSkill,
                                    uploadPhotos:     handleUploadPhotos,
                                    loadSuggestions:  handleLoadSuggestions,
                                    inviteWorkers:    handleInviteWorkers,
                                    getLifecycle,
                                }}
                                navigate={navigate}
                            />
                        ))}
                    </div>
                )}

            </div>{/* ← closes max-w-4xl */}

            {/* ── MODALS ── */}
            <AnimatePresence>
                {selectedWorker && (
                    <WorkerProfileModal key="wp"
                        workerId={selectedWorker}
                        onClose={()=>setSelectedWorker(null)}
                        onStar={handleStarWorker}
                        starredIds={starredWorkers}
                    />
                )}
                {ratingJob && (
                    <RatingModal key="rate"
                        job={ratingJob}
                        onClose={()=>setRatingJob(null)}
                        onRated={jId=>setJobs(p=>p.map(j=>j._id===jId?{...j}:j))}
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
                {repostData && (
                    <RepostModal key="repost"
                        job={repostData.job}
                        slot={repostData.slot}
                        onClose={()=>setRepostData(null)}
                        onRepost={(jId,updatedJob)=>setJobs(p=>p.map(j=>j._id===jId?updatedJob:j))}
                    />
                )}
            </AnimatePresence>

        </div>/* ← closes min-h-screen */
    );
}
