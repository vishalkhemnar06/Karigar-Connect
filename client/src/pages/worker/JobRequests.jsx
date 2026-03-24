// client/src/pages/worker/JobRequests.jsx
// MOBILE-FRIENDLY VERSION - All original functionality preserved
// Enhanced with: Better touch targets, responsive layouts, mobile-optimized interactions

import { useState, useEffect, useRef } from 'react';
import { getAvailableJobs, getJobDetails, applyForJob, applyForSubTask, getWorkerProfile, getImageUrl } from '../../api/index';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Briefcase, MapPin, Calendar, Clock, DollarSign, Users,
    Star, Shield, AlertCircle, CheckCircle, XCircle, Truck,
    Phone, Mail, ExternalLink, ChevronDown, ChevronUp,
    Navigation, Loader2, Award, TrendingUp, Zap, Gift, 
    Search, Filter, RefreshCw, Eye, Bookmark, Share2,
    Building, Sparkles, Crown, Target, Layers, Heart,
    MessageCircle, X
} from 'lucide-react';

// ── Skill normalisation helper ──────────────────────────────────────────────
const normSkill = (s) => {
    if (!s) return '';
    if (typeof s === 'string') return s.toLowerCase().trim();
    if (typeof s === 'object') return (s.name || s.skill || '').toLowerCase().trim();
    return String(s).toLowerCase().trim();
};

// ── Mini map (Leaflet lazy-loaded) ────────────────────────────────────────────
let _L = null;
const loadLeaflet = async () => {
    if (_L) return _L;
    try {
        const m = await import('leaflet'); _L = m.default || m;
        if (!document.getElementById('leaflet-css')) {
            const l = document.createElement('link');
            l.id = 'leaflet-css'; l.rel = 'stylesheet';
            l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(l);
        }
        return _L;
    } catch { return null; }
};

function MiniMap({ lat, lng }) {
    const ref = useRef(null);
    const mRef = useRef(null);
    useEffect(() => {
        if (!lat || !lng) return;
        let alive = true;
        loadLeaflet().then(L => {
            if (!L || !ref.current || mRef.current || !alive) return;
            const map = L.map(ref.current, { zoomControl: false, dragging: false, scrollWheelZoom: false })
                .setView([lat, lng], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(map);
            const icon = L.divIcon({
                className: '',
                html: `<div style="width:20px;height:20px;background:#f97316;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
                iconSize: [20, 20], iconAnchor: [10, 20],
            });
            L.marker([lat, lng], { icon }).addTo(map);
            mRef.current = map;
        });
        return () => { alive = false; };
    }, [lat, lng]);
    if (!lat || !lng) return null;
    return <div ref={ref} className="w-full rounded-xl overflow-hidden border border-gray-200 mt-2" style={{ height: 150 }} />;
}

// ── Skill Selection Modal (Mobile Optimized) ──────────────────────────────────
function SkillSelectModal({ job, workerSkills, onClose, onApply }) {
    const [selected, setSelected] = useState([]);
    const [applying, setApplying] = useState(false);
    const [alert, setAlert] = useState('');

    const options = [];
    const seen = new Set();
    (job.workerSlots || []).forEach(s => {
        if (s.status !== 'open') return;
        const skill = normSkill(s.skill);
        if (!skill || seen.has(skill)) return;
        seen.add(skill);
        const count = (job.openSlotSummary || {})[s.skill] || (job.openSlotSummary || {})[skill] || 1;
        const budgetBlock = (job.relevantBudgetBlocks || []).find(b => normSkill(b.skill) === skill);
        const isMatch = workerSkills.length > 0 && workerSkills.includes(skill);
        options.push({ skill, count, hoursEstimated: s.hoursEstimated, budgetBlock, isMatch });
    });

    if (options.length === 0 && job.openSlotSummary) {
        Object.entries(job.openSlotSummary).forEach(([sk, cnt]) => {
            const skill = normSkill(sk);
            const budgetBlock = (job.relevantBudgetBlocks || []).find(b => normSkill(b.skill) === skill);
            const isMatch = workerSkills.length > 0 && workerSkills.includes(skill);
            options.push({ skill, count: cnt, hoursEstimated: null, budgetBlock, isMatch });
        });
    }

    const toggle = (sk) => {
        setAlert('');
        setSelected(p => {
            if (p.includes(sk)) return p.filter(s => s !== sk);
            if (p.length >= 2) { setAlert('You can apply for a maximum of 2 positions per job.'); return p; }
            return [...p, sk];
        });
    };

    const handleApply = async () => {
        if (!selected.length) { setAlert('Please select at least one position.'); return; }
        try {
            setApplying(true);
            await onApply(selected);
            onClose();
        } catch (err) {
            setAlert(err?.response?.data?.message || 'Failed to apply.');
            setApplying(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-white w-full sm:rounded-3xl shadow-2xl sm:max-w-md rounded-t-3xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                            <Briefcase size={18} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg sm:text-xl font-black text-gray-900">Select Positions</h3>
                            <p className="text-xs text-gray-500 truncate max-w-[180px] sm:max-w-[200px]">{job?.title}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-all">
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                <p className="text-sm text-gray-500 mb-4">Select up to 2 positions to apply for</p>

                <AnimatePresence>
                    {alert && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-3 mb-4 text-sm text-amber-700 flex items-center gap-2"
                        >
                            <AlertCircle size={14} />
                            <span className="flex-1">{alert}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {options.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No open positions available for this job.</p>
                ) : (
                    <div className="space-y-3 mb-5 max-h-[50vh] overflow-y-auto custom-scrollbar">
                        {options.map(opt => {
                            const isSel = selected.includes(opt.skill);
                            const perW = opt.budgetBlock
                                ? Math.round(opt.budgetBlock.subtotal / (opt.budgetBlock.count || 1))
                                : null;
                            return (
                                <motion.button
                                    key={opt.skill}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => toggle(opt.skill)}
                                    className={`w-full flex items-start gap-3 p-3 sm:p-4 rounded-2xl border-2 text-left transition-all active:scale-98 ${
                                        isSel ? 'border-orange-400 bg-gradient-to-r from-orange-50 to-amber-50' : 'border-gray-200 bg-white hover:border-orange-200'
                                    }`}
                                >
                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                                        isSel ? 'bg-orange-500 border-orange-500' : 'border-gray-300'
                                    }`}>
                                        {isSel && <span className="text-white text-xs font-bold">✓</span>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-bold text-gray-800 capitalize text-sm">{opt.skill}</span>
                                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                                {opt.count} slot{opt.count > 1 ? 's' : ''}
                                            </span>
                                            {opt.isMatch && (
                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                                    <Star size={10} /> Your skill
                                                </span>
                                            )}
                                        </div>
                                        {opt.hoursEstimated && (
                                            <p className="text-xs text-gray-500 mt-1">~{opt.hoursEstimated}h estimated</p>
                                        )}
                                        {perW && (
                                            <p className="text-xs text-green-600 font-bold mt-1">₹{perW.toLocaleString()} earnings</p>
                                        )}
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                )}

                <div className="flex gap-3 mt-2 sticky bottom-0 bg-white pt-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-2xl font-semibold hover:bg-gray-50 transition-all active:scale-98"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={applying || !selected.length}
                        className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-2xl font-bold disabled:opacity-60 transition-all shadow-md active:scale-98"
                    >
                        {applying ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 size={16} className="animate-spin" />
                                Applying...
                            </span>
                        ) : (
                            `Apply (${selected.length})`
                        )}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ── Job Detail Modal (Mobile Optimized) ───────────────────────────────────────
function DetailModal({ jobId, workerSkills, isAvailable, onClose, onApplied }) {
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showSkillPicker, setShowSkillPicker] = useState(false);

    useEffect(() => {
        (async () => {
            try { const { data } = await getJobDetails(jobId); setJob(data); }
            catch { setError('Failed to load job details.'); }
            finally { setLoading(false); }
        })();
    }, [jobId]);

    const handleApplyWithSkills = async (selectedSkills) => {
        await applyForJob(jobId, selectedSkills);
        toast.success(`Applied for: ${selectedSkills.join(', ')}!`);
        if (onApplied) onApplied(jobId);
        setJob(j => j ? { ...j, hasApplied: true, myAppliedSkills: selectedSkills } : j);
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 text-center max-w-[280px]">
                    <Loader2 size={32} className="animate-spin text-orange-500 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">Loading job details...</p>
                </div>
            </div>
        );
    }

    if (error || !job) {
        return (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 text-center max-w-[280px]">
                    <AlertCircle size={48} className="text-red-500 mx-auto mb-3" />
                    <p className="text-gray-600 text-sm">{error || 'Job not found.'}</p>
                    <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-100 rounded-xl text-sm">Close</button>
                </div>
            </div>
        );
    }

    return (
        <>
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
                    {/* Header */}
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
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white flex-shrink-0 active:scale-95"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* Body with improved scrolling */}
                    <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5 custom-scrollbar">
                        {/* Client Info */}
                        {job.postedBy && (
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4">
                                <div className="flex items-start gap-3 sm:gap-4">
                                    <img
                                        src={getImageUrl(job.postedBy.photo)}
                                        alt={job.postedBy.name}
                                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover border-2 border-white shadow-md flex-shrink-0"
                                        onError={e => { e.target.src = '/admin.png'; }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-bold text-gray-900 text-base sm:text-lg truncate">{job.postedBy.name}</span>
                                            {job.postedBy.verificationStatus === 'approved' && (
                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 flex-shrink-0">
                                                    <CheckCircle size={10} /> Verified
                                                </span>
                                            )}
                                        </div>
                                        {job.postedBy.mobile && (
                                            <a href={`tel:${job.postedBy.mobile}`} className="text-sm text-blue-600 font-semibold mt-1 inline-flex items-center gap-1 break-all">
                                                <Phone size={12} /> {job.postedBy.mobile}
                                            </a>
                                        )}
                                        {job.clientStats && (
                                            <div className="flex gap-3 mt-3">
                                                <div className="bg-white rounded-xl px-3 py-1.5 text-center shadow-sm flex-1">
                                                    <div className="text-sm font-black text-blue-600">{job.clientStats.completedJobs}</div>
                                                    <div className="text-[9px] text-gray-500">Completed</div>
                                                </div>
                                                <div className="bg-white rounded-xl px-3 py-1.5 text-center shadow-sm flex-1">
                                                    <div className="text-sm font-black text-blue-600">{job.clientStats.totalJobsPosted}</div>
                                                    <div className="text-[9px] text-gray-500">Total Jobs</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Briefcase size={12} /> About the Job
                            </p>
                            <div className="bg-gray-50 rounded-2xl p-4">
                                <p className="text-sm text-gray-700 leading-relaxed break-words">{job.description || job.title}</p>
                            </div>
                        </div>

                        {/* Open Positions - Mobile optimized grid */}
                        {job.openSlotSummary && Object.keys(job.openSlotSummary).length > 0 && (
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Users size={12} /> Positions Available
                                </p>
                                <div className="space-y-2">
                                    {Object.entries(job.openSlotSummary).map(([sk, count]) => {
                                        const slotEx = (job.workerSlots || []).find(s => normSkill(s.skill) === normSkill(sk) && s.status === 'open');
                                        const bBlock = (job.relevantBudgetBlocks || []).find(b => normSkill(b.skill) === normSkill(sk));
                                        const perW = bBlock ? Math.round(bBlock.subtotal / (bBlock.count || 1)) : null;
                                        const isMatch = workerSkills.length > 0 && workerSkills.includes(normSkill(sk));
                                        return (
                                            <div key={sk} className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-3">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-bold text-orange-700 capitalize text-sm">{sk}</span>
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
                                                <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs">
                                                    {slotEx?.hoursEstimated && (
                                                        <span className="text-orange-600 flex items-center gap-1">
                                                            <Clock size={10} /> ~{slotEx.hoursEstimated}h
                                                        </span>
                                                    )}
                                                    {perW && (
                                                        <span className="text-green-600 font-bold flex items-center gap-1">
                                                            <DollarSign size={10} /> ₹{perW.toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Budget Breakdown - Mobile optimized */}
                        {(job.relevantBudgetBlocks || []).length > 0 && (
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <DollarSign size={12} /> Cost Details
                                </p>
                                <div className="border border-gray-200 rounded-2xl overflow-hidden">
                                    {job.relevantBudgetBlocks.map((b, i) => {
                                        const count = b.count || 1;
                                        const perW = Math.round(b.subtotal / count);
                                        return (
                                            <div key={i}>
                                                <div className="bg-gray-50 px-3 sm:px-4 py-2 border-b border-gray-100 flex flex-wrap justify-between items-center gap-2">
                                                    <span className="text-xs font-bold text-gray-700 capitalize">{b.skill}</span>
                                                    <span className="text-xs text-gray-400">{b.hours}h total · {count} worker{count > 1 ? 's' : ''}</span>
                                                </div>
                                                <div className="divide-y divide-gray-50">
                                                    {Array.from({ length: Math.min(count, 3) }).map((_, wi) => (
                                                        <div key={wi} className="flex justify-between px-3 sm:px-4 py-2 bg-white text-sm">
                                                            <span className="text-gray-600 capitalize text-xs sm:text-sm">{b.skill} Worker {count > 1 ? wi + 1 : ''}</span>
                                                            <span className="font-bold text-green-600">₹{perW.toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                    {count > 3 && (
                                                        <div className="px-3 sm:px-4 py-2 bg-gray-50 text-center text-xs text-gray-500">
                                                            +{count - 3} more workers
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex justify-between px-3 sm:px-4 py-2 bg-orange-50 text-sm font-bold">
                                                    <span className="capitalize text-gray-700">{b.skill} total</span>
                                                    <span className="text-orange-600">₹{b.subtotal?.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Schedule */}
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
                                    {job.duration && <p className="text-sm text-gray-500">⏱ {job.duration}</p>}
                                </div>
                            </div>
                        )}

                        {/* Location */}
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <MapPin size={12} /> Location
                            </p>
                            <div className="bg-gray-50 rounded-2xl p-3 space-y-1">
                                {job.location?.fullAddress && (
                                    <p className="text-sm text-gray-700 flex items-start gap-2 break-words">
                                        <Building size={14} className="flex-shrink-0 mt-0.5" />
                                        <span className="flex-1">{job.location.fullAddress}</span>
                                    </p>
                                )}
                                {job.location?.city && (
                                    <p className="text-sm text-gray-600 flex items-center gap-2 flex-wrap">
                                        <MapPin size={14} />
                                        {[job.location.locality, job.location.city, job.location.pincode].filter(Boolean).join(', ')}
                                    </p>
                                )}
                            </div>
                            {job.location?.lat && job.location?.lng && (
                                <MiniMap lat={job.location.lat} lng={job.location.lng} />
                            )}
                        </div>

                        {/* Q&A */}
                        {job.qaAnswers?.filter(q => q.answer).length > 0 && (
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <MessageCircle size={12} /> Client's Answers
                                </p>
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
                                    {job.qaAnswers.filter(q => q.answer).slice(0, 3).map((qa, i) => (
                                        <div key={i} className="p-3 sm:p-4 border-b border-amber-100 last:border-0">
                                            <p className="text-xs font-bold text-amber-700 mb-1 break-words">Q: {qa.question}</p>
                                            <p className="text-sm text-gray-800 break-words">A: {qa.answer}</p>
                                        </div>
                                    ))}
                                    {job.qaAnswers.filter(q => q.answer).length > 3 && (
                                        <div className="p-2 text-center text-xs text-gray-500">
                                            +{job.qaAnswers.filter(q => q.answer).length - 3} more answers
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Photos */}
                        {job.photos?.length > 0 && (
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Work Area Photos</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {job.photos.slice(0, 6).map((p, i) => (
                                        <img key={i} src={getImageUrl(p)} alt="" className="w-full aspect-square object-cover rounded-xl border border-gray-200" />
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="bg-gray-50 rounded-2xl px-3 sm:px-4 py-3 text-xs text-gray-500 flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-1"><Users size={12} /> {job.applicantCount || 0} applied</span>
                            <span className="flex items-center gap-1"><Briefcase size={12} /> {job.workersRequired} worker{job.workersRequired !== 1 ? 's' : ''} needed</span>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 sm:px-6 pb-4 sm:pb-5 pt-3 sm:pt-4 flex-shrink-0">
                        {job.hasApplied ? (
                            <div className="w-full text-center py-3 sm:py-3.5 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 rounded-2xl font-bold border border-green-200 text-sm">
                                ✓ Applied{job.myAppliedSkills?.length > 0 ? ` for: ${job.myAppliedSkills.slice(0, 2).join(', ')}${job.myAppliedSkills.length > 2 ? '...' : ''}` : ''}
                            </div>
                        ) : job.isAssigned ? (
                            <div className="w-full text-center py-3 sm:py-3.5 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 rounded-2xl font-bold border border-green-200 text-sm">
                                ✓ You're Assigned
                            </div>
                        ) : isAvailable ? (
                            <button
                                onClick={() => setShowSkillPicker(true)}
                                className="w-full py-3 sm:py-3.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-black rounded-2xl text-sm sm:text-base flex items-center justify-center gap-2 transition-all shadow-lg active:scale-98"
                            >
                                <Briefcase size={16} /> Select Position & Apply
                            </button>
                        ) : (
                            <div className="w-full text-center py-3 sm:py-3.5 bg-red-50 border border-red-200 text-red-600 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2">
                                <AlertCircle size={14} /> Turn ON availability to apply
                            </div>
                        )}
                    </div>

                    {showSkillPicker && (
                        <SkillSelectModal
                            job={job}
                            workerSkills={workerSkills}
                            onClose={() => setShowSkillPicker(false)}
                            onApply={handleApplyWithSkills}
                        />
                    )}
                </motion.div>
            </motion.div>
        </>
    );
}

// ── Sub-Task Card (Mobile Optimized) ───────────────────────────────────────────
function SubTaskCard({ job, isAvailable, applying, onApply }) {
    const earnings = (job.relevantBudgetBlocks || []).reduce((s, b) => s + (b.subtotal || 0), 0);
    const hours = job.workerSlots?.[0]?.hoursEstimated;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            className="bg-white rounded-2xl border-2 border-orange-200 shadow-md hover:shadow-xl transition-all overflow-hidden"
        >
            <div className="h-1 bg-gradient-to-r from-orange-400 to-red-500" />
            <div className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-[10px] bg-gradient-to-r from-orange-100 to-red-100 text-orange-700 px-2.5 py-1 rounded-full font-bold uppercase tracking-wide flex items-center gap-1">
                                <Zap size={10} /> Urgent Sub-task
                            </span>
                        </div>
                        <h3 className="font-bold text-gray-900 text-base sm:text-lg leading-snug capitalize break-words">{job.subTaskSkill} Task</h3>
                        <p className="text-xs text-gray-500 mt-1 truncate">{job.parentJobTitle || job.title}</p>
                    </div>
                    {earnings > 0 && (
                        <div className="text-right flex-shrink-0">
                            <div className="text-lg sm:text-xl font-black text-green-600">₹{earnings.toLocaleString()}</div>
                            <div className="text-[10px] text-gray-400">Your earnings</div>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 text-xs mb-3">
                    {job.scheduledTime && (
                        <span className="bg-blue-50 text-blue-600 px-2 sm:px-3 py-1 rounded-full font-semibold flex items-center gap-1 text-xs">
                            <Clock size={10} /> {job.scheduledTime}
                        </span>
                    )}
                    {hours && (
                        <span className="bg-gray-100 text-gray-600 px-2 sm:px-3 py-1 rounded-full text-xs">~{hours}h</span>
                    )}
                    {job.location?.city && (
                        <span className="bg-gray-100 text-gray-600 px-2 sm:px-3 py-1 rounded-full flex items-center gap-1 text-xs">
                            <MapPin size={10} /> {job.location.city}
                        </span>
                    )}
                    {job.scheduledDate && (
                        <span className="bg-gray-100 text-gray-600 px-2 sm:px-3 py-1 rounded-full flex items-center gap-1 text-xs">
                            <Calendar size={10} /> {new Date(job.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                    )}
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-gray-100">
                    {job.hasApplied ? (
                        <span className="text-xs px-3 sm:px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 text-green-600 rounded-xl font-bold border border-green-200">
                            Applied ✓
                        </span>
                    ) : job.isAssigned ? (
                        <span className="text-xs px-3 sm:px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 rounded-xl font-bold border border-green-200">
                            ✓ Assigned
                        </span>
                    ) : (
                        <button
                            onClick={() => isAvailable ? onApply(job) : toast.error('Turn ON availability to apply.')}
                            disabled={applying[job._id]}
                            className={`text-xs px-4 sm:px-5 py-2 rounded-xl font-bold disabled:opacity-60 transition-all active:scale-95 ${
                                isAvailable 
                                    ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-md' 
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                            {applying[job._id] ? <Loader2 size={12} className="animate-spin" /> : '⚡ Apply Now'}
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

// ── Main Component (Mobile Optimized) ─────────────────────────────────────────────
export default function JobRequests() {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterSkill, setFilterSkill] = useState('all');
    const [filterCity, setFilterCity] = useState('all');
    const [detailId, setDetailId] = useState(null);
    const [applyModal, setApplyModal] = useState(null);
    const [applying, setApplying] = useState({});
    const [isAvailable, setIsAvailable] = useState(true);
    const [showFilters, setShowFilters] = useState(false);

    const localUser = JSON.parse(localStorage.getItem('user') || '{}');
    const workerSkills = (localUser?.skills || []).map(normSkill).filter(Boolean);

    const loadJobs = async () => {
        try {
            setLoading(true);
            const [jobsRes, profileRes] = await Promise.all([
                getAvailableJobs(),
                getWorkerProfile(),
            ]);
            setJobs(Array.isArray(jobsRes.data) ? jobsRes.data : []);
            setIsAvailable(profileRes.data?.availability !== false);
        } catch {
            toast.error('Failed to load jobs.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadJobs(); }, []);

    const handleApplied = (jobId) =>
        setJobs(p => p.map(j => j._id === jobId ? { ...j, hasApplied: true } : j));

    const handleSubTaskApply = async (job) => {
        try {
            setApplying(p => ({ ...p, [job._id]: true }));
            const parentId = job.parentJobId?._id || job.parentJobId;
            await applyForSubTask(parentId, job._id);
            toast.success(`Applied for ${job.subTaskSkill || 'sub-task'}!`);
            setJobs(p => p.map(j => j._id === job._id ? { ...j, hasApplied: true } : j));
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to apply.');
        } finally {
            setApplying(p => ({ ...p, [job._id]: false }));
        }
    };

    const handleQuickApplySkills = async (job, selectedSkills) => {
        try {
            setApplying(p => ({ ...p, [job._id]: true }));
            await applyForJob(job._id, selectedSkills);
            toast.success(`Applied for: ${selectedSkills.join(', ')}!`);
            handleApplied(job._id);
            setApplyModal(null);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to apply.');
        } finally {
            setApplying(p => ({ ...p, [job._id]: false }));
        }
    };

    const allSkills = [...new Set(
        jobs.flatMap(j => [
            ...(j.relevantSkills || []).map(normSkill),
            ...(j.skills || []).map(normSkill),
            ...(j.workerSlots || []).map(s => normSkill(s.skill)),
            ...Object.keys(j.openSlotSummary || {}).map(normSkill),
        ]).filter(Boolean)
    )].slice(0, 30);

    const allCities = [...new Set(jobs.map(j => j.location?.city).filter(Boolean))].slice(0, 15);

    const filtered = jobs.filter(j => {
        if (search) {
            const q = search.toLowerCase();
            const ok = j.title?.toLowerCase().includes(q)
                || j.description?.toLowerCase().includes(q)
                || j.location?.city?.toLowerCase().includes(q)
                || Object.keys(j.openSlotSummary || {}).some(sk => sk.toLowerCase().includes(q))
                || (j.skills || []).some(s => normSkill(s).includes(q));
            if (!ok) return false;
        }
        if (filterSkill !== 'all') {
            const needle = normSkill(filterSkill);
            const jobSkills = [
                ...(j.relevantSkills || []).map(normSkill),
                ...(j.skills || []).map(normSkill),
                ...(j.workerSlots || []).map(s => normSkill(s.skill)),
                ...Object.keys(j.openSlotSummary || {}).map(normSkill),
            ];
            if (!jobSkills.includes(needle)) return false;
        }
        if (filterCity !== 'all' && j.location?.city !== filterCity) return false;
        return true;
    });

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 px-4">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full"
                />
                <p className="mt-4 text-gray-500 font-semibold text-sm">Loading available jobs...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/20 p-3 sm:p-4 md:p-8">
            <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 pb-20">
                {/* Header - Mobile Optimized */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white shadow-xl"
                >
                    <div className="flex items-center gap-2 sm:gap-3 mb-2">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center backdrop-blur-sm">
                            <Briefcase size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black">Available Jobs</h1>
                            <p className="text-white/90 text-xs sm:text-sm mt-0.5">Find your next opportunity</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                        <span className="flex items-center gap-1 bg-white/20 rounded-full px-2 sm:px-3 py-1 text-xs sm:text-sm">
                            <Briefcase size={10} /> {jobs.length} Total Jobs
                        </span>
                        <span className="flex items-center gap-1 bg-white/20 rounded-full px-2 sm:px-3 py-1 text-xs sm:text-sm">
                            <Sparkles size={10} /> {filtered.length} Showing
                        </span>
                        {workerSkills.length > 0 && (
                            <span className="flex items-center gap-1 bg-white/20 rounded-full px-2 sm:px-3 py-1 text-xs sm:text-sm">
                                <Star size={10} /> Skills: {workerSkills.slice(0, 2).join(', ')}{workerSkills.length > 2 ? '...' : ''}
                            </span>
                        )}
                    </div>
                </motion.div>

                {/* Availability Banner */}
                <AnimatePresence>
                    {!isAvailable && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-red-50 border-2 border-red-200 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-3"
                        >
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <AlertCircle size={16} className="text-red-500" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs sm:text-sm font-bold text-red-700">You are not available</p>
                                <p className="text-[10px] sm:text-xs text-red-500">Turn ON availability from the header to apply for jobs.</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Search & Filters */}
                <div className="space-y-3">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search jobs by title, skill, location..."
                            className="w-full pl-9 sm:pl-11 pr-3 sm:pr-4 border-2 border-gray-200 rounded-xl sm:rounded-2xl py-2.5 sm:py-3 text-sm focus:outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50 transition-all"
                        />
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-gray-200 rounded-xl text-xs sm:text-sm font-semibold text-gray-600 hover:border-orange-300 transition-all active:scale-95"
                        >
                            <Filter size={12} />
                            Filters
                            <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                        </button>
                        <button
                            onClick={loadJobs}
                            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-gray-200 rounded-xl text-xs sm:text-sm font-semibold text-gray-600 hover:border-orange-300 transition-all active:scale-95"
                        >
                            <RefreshCw size={12} />
                            Refresh
                        </button>
                    </div>

                    <AnimatePresence>
                        {showFilters && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                    <select
                                        value={filterSkill}
                                        onChange={e => setFilterSkill(e.target.value)}
                                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 bg-white"
                                    >
                                        <option value="all">All Skills</option>
                                        {allSkills.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                                    </select>
                                    <select
                                        value={filterCity}
                                        onChange={e => setFilterCity(e.target.value)}
                                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 bg-white"
                                    >
                                        <option value="all">All Cities</option>
                                        {allCities.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                {(search || filterSkill !== 'all' || filterCity !== 'all') && (
                                    <button
                                        onClick={() => { setSearch(''); setFilterSkill('all'); setFilterCity('all'); }}
                                        className="mt-2 text-xs text-orange-500 font-semibold hover:underline"
                                    >
                                        Clear all filters
                                    </button>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Job Cards */}
                {jobs.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-12 sm:py-20 bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100 mx-2 sm:mx-0"
                    >
                        <motion.div
                            animate={{ y: [0, -10, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="text-5xl sm:text-6xl mb-3 sm:mb-4"
                        >
                            📭
                        </motion.div>
                        <p className="font-bold text-gray-800 text-lg sm:text-xl mb-2">No jobs posted yet</p>
                        <p className="text-gray-400 text-xs sm:text-sm px-4">Check back later for new opportunities</p>
                    </motion.div>
                ) : filtered.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-12 sm:py-20 bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100 mx-2 sm:mx-0"
                    >
                        <Search size={40} className="text-gray-300 mx-auto mb-3" />
                        <p className="font-bold text-gray-800 text-lg sm:text-xl mb-2">No matches found</p>
                        <p className="text-gray-400 text-xs sm:text-sm mb-4">Try adjusting your filters</p>
                        <button
                            onClick={() => { setSearch(''); setFilterSkill('all'); setFilterCity('all'); }}
                            className="px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold hover:shadow-lg transition-all active:scale-95 text-sm"
                        >
                            Show All Jobs
                        </button>
                    </motion.div>
                ) : (
                    <div className="space-y-3 sm:space-y-4">
                        <AnimatePresence>
                            {filtered.map(job => (
                                job.isSubTask ? (
                                    <SubTaskCard
                                        key={job._id}
                                        job={job}
                                        isAvailable={isAvailable}
                                        applying={applying}
                                        onApply={handleSubTaskApply}
                                    />
                                ) : (
                                    <motion.div
                                        key={job._id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        whileHover={{ y: -2 }}
                                        className="bg-white rounded-2xl border-2 border-gray-100 shadow-md hover:shadow-xl transition-all cursor-pointer overflow-hidden"
                                        onClick={() => setDetailId(job._id)}
                                    >
                                        <div className={`h-1 ${job.urgent ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gray-100'}`} />

                                        <div className="p-4 sm:p-5">
                                            <div className="flex items-start gap-3 sm:gap-4">
                                                <img
                                                    src={getImageUrl(job.postedBy?.photo)}
                                                    alt=""
                                                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl object-cover border-2 border-orange-200 shadow-sm flex-shrink-0"
                                                    onError={e => { e.target.src = '/admin.png'; }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                                        <div>
                                                            <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-tight line-clamp-2">
                                                                {job.title}
                                                            </h3>
                                                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                                <span className="text-xs text-gray-500">{job.postedBy?.name}</span>
                                                                {job.postedBy?.verificationStatus === 'approved' && (
                                                                    <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full font-bold">✓</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-row sm:flex-col items-center gap-1 sm:items-end">
                                                            {job.urgent && (
                                                                <span className="text-xs bg-gradient-to-r from-orange-100 to-red-100 text-orange-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                                                    <Zap size={10} /> Urgent
                                                                </span>
                                                            )}
                                                            {job.negotiable && (
                                                                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">🤝 Nego</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <p className="text-sm text-gray-500 mt-3 line-clamp-2 leading-relaxed">
                                                {job.shortDescription || job.description}
                                            </p>

                                            {/* Open slots badges */}
                                            {job.openSlotSummary && Object.keys(job.openSlotSummary).length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3">
                                                    {Object.entries(job.openSlotSummary).slice(0, 3).map(([sk, cnt]) => {
                                                        const isMatch = workerSkills.length > 0 && workerSkills.includes(normSkill(sk));
                                                        return (
                                                            <span key={sk} className={`text-xs px-2 sm:px-3 py-1 rounded-full font-bold capitalize flex items-center gap-1 ${
                                                                isMatch ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-orange-100 text-orange-700 border border-orange-200'
                                                            }`}>
                                                                <Briefcase size={10} />
                                                                {sk} × {cnt}
                                                                {isMatch && <Star size={8} className="fill-green-600" />}
                                                            </span>
                                                        );
                                                    })}
                                                    {Object.keys(job.openSlotSummary).length > 3 && (
                                                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                                            +{Object.keys(job.openSlotSummary).length - 3} more
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Meta info */}
                                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-3 text-xs text-gray-400">
                                                {job.scheduledDate && (
                                                    <span className="flex items-center gap-1">
                                                        <Calendar size={10} />
                                                        {new Date(job.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                )}
                                                {job.location?.city && (
                                                    <span className="flex items-center gap-1">
                                                        <MapPin size={10} />
                                                        {job.location.city}
                                                    </span>
                                                )}
                                                {job.applicantCount > 0 && (
                                                    <span className="flex items-center gap-1">
                                                        <Users size={10} />
                                                        {job.applicantCount} applied
                                                    </span>
                                                )}
                                            </div>

                                            {/* Footer */}
                                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 gap-3">
                                                <div className="flex-shrink-0">
                                                    {(() => {
                                                        const total = (job.relevantBudgetBlocks || []).reduce(
                                                            (sum, b) => sum + Math.round(b.subtotal / (b.count || 1)), 0
                                                        );
                                                        return total > 0 ? (
                                                            <>
                                                                <div className="text-base sm:text-lg font-black text-green-600">₹{total.toLocaleString()}</div>
                                                                <div className="text-[8px] sm:text-[10px] text-gray-400">Your earning</div>
                                                            </>
                                                        ) : job.payment > 0 ? (
                                                            <>
                                                                <div className="text-base sm:text-lg font-black text-green-600">₹{job.payment.toLocaleString()}</div>
                                                                <div className="text-[8px] sm:text-[10px] text-gray-400">Budget</div>
                                                            </>
                                                        ) : (
                                                            <div className="text-xs text-gray-400">Tap for details</div>
                                                        );
                                                    })()}
                                                </div>

                                                <div className="flex gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => setDetailId(job._id)}
                                                        className="text-xs px-3 sm:px-4 py-1.5 sm:py-2 border-2 border-orange-200 text-orange-600 rounded-xl hover:bg-orange-50 font-bold transition-all active:scale-95"
                                                    >
                                                        <Eye size={12} className="inline mr-1" />
                                                        Details
                                                    </button>
                                                    {!job.hasApplied ? (
                                                        <button
                                                            onClick={() => isAvailable
                                                                ? setApplyModal(job)
                                                                : toast.error('Turn ON availability to apply.')}
                                                            disabled={applying[job._id]}
                                                            className={`text-xs px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-bold disabled:opacity-60 transition-all active:scale-95 ${
                                                                isAvailable
                                                                    ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-md'
                                                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                            }`}
                                                        >
                                                            {applying[job._id] ? <Loader2 size={12} className="animate-spin" /> : 'Apply'}
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-green-50 to-emerald-50 text-green-600 rounded-xl font-bold border border-green-200 whitespace-nowrap">
                                                            ✓ Applied
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Modals */}
            <AnimatePresence>
                {detailId && (
                    <DetailModal
                        jobId={detailId}
                        workerSkills={workerSkills}
                        isAvailable={isAvailable}
                        onClose={() => setDetailId(null)}
                        onApplied={handleApplied}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {applyModal && (
                    <SkillSelectModal
                        job={applyModal}
                        workerSkills={workerSkills}
                        onClose={() => setApplyModal(null)}
                        onApply={(skills) => handleQuickApplySkills(applyModal, skills)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}