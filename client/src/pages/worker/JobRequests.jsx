import { useState, useEffect, useRef } from 'react';
import {
    getAvailableJobs,
    getJobDetails,
    applyForJob,
    applyForSubTask,
    getWorkerProfile,
    getWorkerBookings,
    getImageUrl,
    getSemanticJobsForWorker,
    recordSemanticFeedback,
} from '../../api/index';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Briefcase, MapPin, Calendar, Clock, IndianRupee, Users,
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

const asPercent = (value) => Math.round(Math.max(0, Math.min(1, Number(value || 0))) * 100);

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
    return 'text-red-600';
};

const isCommuteApplyBlocked = (commute) => {
    if (!commute?.available) return true;
    if (Number(commute.distanceKm || 0) > 20) return true;
    if (commute.canReachBeforeStart === false) return true;
    return false;
};

const formatPaymentMethod = (method) => {
    switch (method) {
        case 'cash': return 'Cash';
        case 'upi_qr': return 'Online UPI / QR';
        case 'bank_transfer': return 'Direct Bank Account';
        default: return 'Flexible (Any)';
    }
};

const formatHoursAsDuration = (hoursValue) => {
    const totalHours = Math.max(0, Number(hoursValue) || 0);
    if (!totalHours) return 'N/A';

    if (totalHours < 1) {
        const minutes = Math.round(totalHours * 60);
        return `${minutes} min`;
    }

    const wholeHours = Math.floor(totalHours);
    const minutes = Math.round((totalHours - wholeHours) * 60);
    if (!minutes) return `${wholeHours} hr`;
    return `${wholeHours} hr ${minutes} min`;
};

const getQuoteBlock = (job = {}, skill = '') => {
    const normalizedSkill = normSkill(skill);
    const fromBlocks = Array.isArray(job?.relevantBudgetBlocks) ? job.relevantBudgetBlocks : [];
    return fromBlocks.find((entry) => normSkill(entry?.skill) === normalizedSkill)
        || (Array.isArray(job?.budgetBreakdown?.breakdown)
            ? job.budgetBreakdown.breakdown.find((entry) => normSkill(entry?.skill) === normalizedSkill)
            : null)
        || null;
};

const getQuoteBasisInfo = (job = {}, skill = '') => {
    const normalizedSkill = normSkill(skill);
    const slot = (job.workerSlots || []).find((entry) => normSkill(entry?.skill) === normalizedSkill) || null;
    const budgetBlock = getQuoteBlock(job, normalizedSkill);
    const hours = Number(slot?.hoursEstimated || budgetBlock?.hours || 0) || 8;
    const durationText = formatHoursAsDuration(hours);
    const durationTextLower = durationText.toLowerCase();
    const lowerDuration = String(job?.duration || '').toLowerCase();

    const normalizedMode = String(budgetBlock?.rateInputMode || '').toLowerCase();
    let basisKey = normalizedMode;
    let basisLabel = normalizedMode === 'hour' ? 'per hour' : normalizedMode === 'visit' ? 'per visit' : normalizedMode === 'day' ? 'per day' : '';
    let units = 1;

    if (!basisKey) {
        if (Number(budgetBlock?.sourceRatePerHourBase) > 0 || Number(budgetBlock?.ratePerHourBase) > 0 || Number(budgetBlock?.ratePerHour) > 0) {
            basisKey = 'hour';
            basisLabel = 'per hour';
        } else if (Number(budgetBlock?.sourceRatePerVisitBase) > 0 || Number(budgetBlock?.ratePerVisitBase) > 0 || Number(budgetBlock?.ratePerVisit) > 0 || Number(budgetBlock?.perWorkerCost) > 0) {
            basisKey = 'visit';
            basisLabel = 'per visit';
        } else if (Number(budgetBlock?.sourceRatePerDayBase) > 0 || Number(budgetBlock?.ratePerDayBase) > 0 || Number(budgetBlock?.ratePerDay) > 0) {
            basisKey = 'day';
            basisLabel = 'per day';
        }
    }

    if (!basisKey) {
        if (Number(budgetBlock?.sourceRatePerHourBase) > 0 || Number(budgetBlock?.ratePerHourBase) > 0 || Number(budgetBlock?.ratePerHour) > 0) {
            basisKey = 'hour';
            basisLabel = 'per hour';
        } else if (lowerDuration.includes('visit')) {
            basisKey = 'visit';
            basisLabel = 'per visit';
        } else if (hours <= 12 || lowerDuration.includes('hour') || durationTextLower.includes('hr') || durationTextLower.includes('hour')) {
            basisKey = 'hour';
            basisLabel = 'per hour';
        } else {
            basisKey = 'day';
            basisLabel = 'per day';
        }
    }

    if (basisKey === 'visit') {
        units = 1;
    } else if (basisKey === 'hour') {
        units = Math.max(1, Math.round(hours * 100) / 100);
    } else if (basisKey === 'day') {
        units = Math.max(1, Math.ceil(hours / 8));
    }

    const suggestedTotal = Number(budgetBlock?.subtotal || 0) > 0
        ? Math.round(Number(budgetBlock.subtotal || 0) / Math.max(1, Number(budgetBlock.count || 1)))
        : 0;

    return {
        basisKey,
        basisLabel,
        units,
        durationText,
        suggestedTotal,
    };
};

const formatQuoteAmount = (value) => {
    const num = Number(value || 0);
    if (!Number.isFinite(num) || num <= 0) return '—';
    return `₹${num.toLocaleString('en-IN')}`;
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

const parseScheduledDateTime = (scheduledDate, scheduledTime) => {
    if (!scheduledDate) return null;
    const dt = new Date(scheduledDate);
    if (Number.isNaN(dt.getTime())) return null;

    let hours = 9;
    let minutes = 0;
    const raw = String(scheduledTime || '').trim();
    if (raw) {
        const m = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
        if (m) {
            const h = Number(m[1]);
            const mm = Number(m[2] || '0');
            const meridiem = String(m[3] || '').toLowerCase();
            if (Number.isFinite(h) && Number.isFinite(mm)) {
                hours = h;
                minutes = mm;
                if (meridiem === 'pm' && hours < 12) hours += 12;
                if (meridiem === 'am' && hours === 12) hours = 0;
            }
        }
    }

    dt.setHours(hours, minutes, 0, 0);
    return dt.getTime();
};

const formatDurationHMS = (totalSeconds) => {
    const safe = Math.max(0, Number(totalSeconds) || 0);
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = safe % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatDateTime = (ms) => {
    if (!Number.isFinite(ms)) return 'N/A';
    try {
        return new Date(ms).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return 'N/A';
    }
};

const getActiveTaskBlockFromBookings = (bookings = [], workerId = '') => {
    const wid = String(workerId || '');
    if (!wid || !Array.isArray(bookings)) return null;

    const activeStatuses = new Set(['filled', 'scheduled', 'running']);
    const candidates = [];
    const now = Date.now();
    const travelBufferHours = 2;

    bookings.forEach((job) => {
        const allSlots = Array.isArray(job?.mySlots) && job.mySlots.length
            ? job.mySlots
            : (job?.workerSlots || []).filter((slot) => {
                const assignedId = slot?.assignedWorker?._id?.toString() || slot?.assignedWorker?.toString() || '';
                return assignedId === wid;
            });

        allSlots.forEach((slot) => {
            if (!activeStatuses.has(String(slot?.status || '').toLowerCase())) return;

            const durationHours = Math.max(0, Number(slot?.hoursEstimated || 0));
            const startMs =
                (slot?.actualStartTime ? new Date(slot.actualStartTime).getTime() : null)
                || (job?.actualStartTime ? new Date(job.actualStartTime).getTime() : null)
                || parseScheduledDateTime(job?.scheduledDate, job?.scheduledTime)
                || (job?.createdAt ? new Date(job.createdAt).getTime() : null);

            const endMs = Number.isFinite(startMs) && durationHours > 0
                ? startMs + (durationHours + travelBufferHours) * 60 * 60 * 1000
                : null;

            const blocksNow = String(slot?.status || '').toLowerCase() === 'running'
                || (Number.isFinite(startMs) && Number.isFinite(endMs) && now >= startMs && now < endMs);
            if (!blocksNow) return;

            candidates.push({
                jobId: job?._id,
                jobTitle: job?.title || 'Current task',
                skill: slot?.skill || 'assigned skill',
                slotStatus: slot?.status || 'filled',
                durationHours,
                startMs,
                endMs,
            });
        });
    });

    if (!candidates.length) return null;

    candidates.sort((a, b) => {
        const aEnd = Number.isFinite(a.endMs) ? a.endMs : Number.MAX_SAFE_INTEGER;
        const bEnd = Number.isFinite(b.endMs) ? b.endMs : Number.MAX_SAFE_INTEGER;
        return aEnd - bEnd;
    });

    return candidates[0];
};

const normalizeSemanticJobMatch = (row = {}) => ({
    jobId: row.jobId,
    score: Number(row.score || 0),
    semanticScore: Number(row.semanticScore || 0),
    matchPercent: asPercent(row.score || 0),
    semanticPercent: asPercent(row.semanticScore || 0),
    matchedSkills: Array.isArray(row.matchedSkills) ? row.matchedSkills : [],
    reasons: Array.isArray(row.reasons) ? row.reasons : [],
    distanceKm: row.distanceKm ?? null,
});

const getJobSkillSet = (job = {}) => {
    const all = [
        ...(job.relevantSkills || []),
        ...(job.skills || []),
        ...((job.workerSlots || []).map((slot) => slot?.skill)),
        ...Object.keys(job.openSlotSummary || {}),
    ].map(normSkill).filter(Boolean);
    return [...new Set(all)];
};

const getOpenSkillList = (job = {}) =>
    Object.keys(job.openSlotSummary || {}).map(normSkill).filter(Boolean);

const getAppliedSkillList = (job = {}) =>
    (job.myAppliedSkills || []).map(normSkill).filter(Boolean);

const getRemainingOpenSkills = (job = {}) => {
    const openSkills = getOpenSkillList(job);
    const applied = new Set(getAppliedSkillList(job));
    return openSkills.filter((skill) => !applied.has(skill));
};

const isFullyAppliedForOpenSlots = (job = {}) => {
    const openSkills = getOpenSkillList(job);
    if (!openSkills.length) return !!job.hasApplied;
    return getRemainingOpenSkills(job).length === 0;
};

const getSkillOverlapStats = (job = {}, workerSkills = []) => {
    const workerSet = new Set((workerSkills || []).map(normSkill).filter(Boolean));
    const jobSkills = getJobSkillSet(job);
    if (!jobSkills.length || !workerSet.size) {
        return { overlapSkills: [], overlapCount: 0, overlapRatio: 0 };
    }

    const overlapSkills = jobSkills.filter((skill) => workerSet.has(skill));
    return {
        overlapSkills,
        overlapCount: overlapSkills.length,
        overlapRatio: overlapSkills.length / Math.max(1, jobSkills.length),
    };
};

const isHighMatchJob = (job = {}) => {
    const semanticPercent = Number(job.semanticMatch?.semanticPercent || 0);
    const finalPercent = Number(job.semanticMatch?.matchPercent || 0);
    const overlapCount = Number(job.skillOverlapCount || 0);
    const overlapRatio = Number(job.skillOverlapRatio || 0);

    if (finalPercent >= 60 || semanticPercent >= 65) return true;
    if (overlapCount >= 2) return true;
    if (overlapCount >= 1 && (semanticPercent >= 40 || finalPercent >= 45 || !job.semanticMatch)) return true;
    if (overlapRatio >= 0.5 && semanticPercent >= 35) return true;
    return false;
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
    const [quoteRates, setQuoteRates] = useState({});
    const [applying, setApplying] = useState(false);
    const [alert, setAlert] = useState('');

    const options = [];
    const seen = new Set();
    const appliedSet = new Set((job?.myAppliedSkills || []).map(normSkill).filter(Boolean));
    (job.workerSlots || []).forEach(s => {
        if (s.status !== 'open') return;
        const skill = normSkill(s.skill);
        if (appliedSet.has(skill)) return;
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
            if (appliedSet.has(skill)) return;
            const budgetBlock = (job.relevantBudgetBlocks || []).find(b => normSkill(b.skill) === skill);
            const isMatch = workerSkills.length > 0 && workerSkills.includes(skill);
            options.push({ skill, count: cnt, hoursEstimated: null, budgetBlock, isMatch });
        });
    }

    const toggle = (sk) => {
        setAlert('');
        setSelected(p => {
            if (p.includes(sk)) {
                const next = p.filter(s => s !== sk);
                setQuoteRates((prev) => {
                    const copy = { ...prev };
                    delete copy[sk];
                    return copy;
                });
                return next;
            }
            if (p.length >= 2) { setAlert('You can apply for a maximum of 2 positions per job.'); return p; }
            return [...p, sk];
        });
    };

    const handleApply = async () => {
        if (!selected.length) { setAlert('Please select at least one position.'); return; }
        const quotedApplications = selected
            .map((skill) => {
                const quoteInfo = getQuoteBasisInfo(job, skill);
                const rate = Number(quoteRates[skill] || 0);
                if (!Number.isFinite(rate) || rate <= 0) return null;
                const amount = Math.max(0, Math.round(rate * quoteInfo.units));
                return {
                    skill,
                    amount,
                    quoteRate: rate,
                    quoteQuantity: quoteInfo.units,
                    quoteBasis: quoteInfo.basisKey,
                };
            })
            .filter(Boolean);
        try {
            setApplying(true);
            await onApply(selected, quotedApplications);
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
                            const quoteInfo = getQuoteBasisInfo(job, opt.skill);
                            const suggestedRate = quoteInfo.units > 0 && quoteInfo.suggestedTotal > 0
                                ? Math.max(1, Math.round(quoteInfo.suggestedTotal / quoteInfo.units))
                                : '';
                            const currentRate = quoteRates[opt.skill] || '';
                            const rateValue = currentRate || suggestedRate || '';
                            const totalQuote = rateValue ? Math.max(1, Math.round(Number(rateValue) * quoteInfo.units)) : 0;
                            return (
                                <motion.div
                                    key={opt.skill}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => toggle(opt.skill)}
                                    className={`w-full flex items-start gap-3 p-3 sm:p-4 rounded-2xl border-2 text-left transition-all active:scale-98 cursor-pointer ${
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
                                        <p className="text-xs text-gray-500 mt-1">Quote basis: {quoteInfo.basisLabel} · {quoteInfo.durationText}</p>
                                        {rateValue ? (
                                            <p className="text-xs text-green-600 font-bold mt-1">Quoted total: {formatQuoteAmount(totalQuote)}</p>
                                        ) : (
                                            <p className="text-xs text-gray-400 mt-1">Optional rate, final quote is hidden until you enter it</p>
                                        )}
                                        {isSel && (
                                            <div className="mt-3 space-y-2">
                                                <div onClick={(e) => e.stopPropagation()}>
                                                    <label className="block text-[11px] font-bold text-gray-600 mb-1">Your rate {quoteInfo.basisLabel}</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        step="1"
                                                        value={quoteRates[opt.skill] || ''}
                                                        onChange={(e) => setQuoteRates((prev) => ({ ...prev, [opt.skill]: e.target.value }))}
                                                        placeholder={suggestedRate ? String(suggestedRate) : 'Optional'}
                                                        className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                                                    />
                                                </div>
                                                <p className="text-[11px] text-gray-500">Total quote: {rateValue ? formatQuoteAmount(totalQuote) : 'Not quoted'}</p>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
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
function DetailModal({ jobId, workerSkills, isAvailable, semanticMatch, onClose, onApplied }) {
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showSkillPicker, setShowSkillPicker] = useState(false);
    const [previewPhoto, setPreviewPhoto] = useState('');

    useEffect(() => {
        (async () => {
            try { const { data } = await getJobDetails(jobId); setJob(data); }
            catch { setError('Failed to load job details.'); }
            finally { setLoading(false); }
        })();
    }, [jobId]);

    const handleApplyWithSkills = async (selectedSkills, quotedApplications = []) => {
        await applyForJob(jobId, selectedSkills, { quotedApplications });
        toast.success(`Applied for: ${selectedSkills.join(', ')}!`);
        if (onApplied) onApplied(jobId, selectedSkills);
        setJob((prev) => {
            if (!prev) return prev;
            const merged = [...new Set([...(prev.myAppliedSkills || []), ...selectedSkills].map(normSkill))];
            return { ...prev, hasApplied: true, myAppliedSkills: merged };
        });
    };

    const handleApplySubTask = async () => {
        const parentId = job.parentJobId?._id || job.parentJobId;
        if (!parentId || !job?._id) {
            toast.error('Parent sub-task mapping is missing.');
            return;
        }
        await applyForSubTask(parentId, job._id);
        toast.success(`Applied for ${job.subTaskSkill || 'sub-task'}!`);
        if (onApplied) onApplied(job._id, [normSkill(job.subTaskSkill || 'general')]);
        setJob((prev) => prev ? {
            ...prev,
            hasApplied: true,
            myAppliedSkills: [normSkill(prev.subTaskSkill || 'general')],
        } : prev);
    };

    const remainingOpenSkills = getRemainingOpenSkills(job || {});
    const applyBlocked = isCommuteApplyBlocked(job?.commute);
    const quoteBasisInfo = getQuoteBasisInfo(job || {}, job?.subTaskSkill || (job?.skills || [])[0] || (job?.workerSlots || [])[0]?.skill || 'general');

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
                                    {job.invitedForMe && (
                                        <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-bold">
                                            Direct Invite
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
                        {semanticMatch && (
                            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-xs font-black text-indigo-700 uppercase tracking-wider flex items-center gap-2">
                                        <Sparkles size={12} /> Semantic Match
                                    </p>
                                    <span className="text-xs font-black text-indigo-700 bg-white border border-indigo-100 px-2.5 py-1 rounded-full">
                                        {semanticMatch.matchPercent}%
                                    </span>
                                </div>
                                <p className="text-[11px] text-indigo-500 mt-1">Semantic similarity: {semanticMatch.semanticPercent}%</p>
                                {semanticMatch.matchedSkills?.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {semanticMatch.matchedSkills.slice(0, 5).map((skill) => (
                                            <span key={`detail-skill-${skill}`} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 capitalize">
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {semanticMatch.reasons?.length > 0 && (
                                    <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                                        {semanticMatch.reasons.slice(0, 2).join(' • ')}
                                    </p>
                                )}
                            </div>
                        )}

                        <div className={`rounded-2xl border p-3 ${job?.commute?.available ? 'border-gray-200 bg-gray-50' : 'border-red-200 bg-red-50'}`}>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Travel Distance & ETA</p>
                            <p className={`text-sm font-semibold ${getCommuteToneClass(job?.commute)}`}>{formatCommuteText(job?.commute)}</p>
                            {job?.commute?.isLocationStale && <p className="text-[11px] text-amber-700 mt-1">Live location is stale. Update Daily Dashboard for better ETA.</p>}
                            {applyBlocked && <p className="text-[11px] text-red-600 mt-1">Apply allowed only within 20 km and if ETA reaches before job start.</p>}
                        </div>

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

                        {/* Description + right-side photos */}
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
                                                            <IndianRupee size={10} /> {perW.toLocaleString()}
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
                                    <IndianRupee size={12} /> Cost Details
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

                        {/* Payment method + negotiation terms */}
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <IndianRupee size={12} /> Payment Terms
                            </p>
                            <div className="bg-gray-50 rounded-2xl p-3 space-y-1.5">
                                <p className="text-sm text-gray-700 break-words">
                                    <span className="font-semibold">Method:</span> {formatPaymentMethod(job.paymentMethod)}
                                </p>
                                <p className="text-sm text-gray-700 break-words">
                                    <span className="font-semibold">Quote basis:</span> {quoteBasisInfo.basisLabel} · {quoteBasisInfo.durationText}
                                </p>
                            </div>
                        </div>

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
                                {job.location?.buildingName && (
                                    <p className="text-sm text-gray-700 break-words">
                                        <span className="font-semibold">Building/Home:</span> {job.location.buildingName}
                                    </p>
                                )}
                                {job.location?.unitNumber && (
                                    <p className="text-sm text-gray-700 break-words">
                                        <span className="font-semibold">Flat/Home No.:</span> {job.location.unitNumber}
                                    </p>
                                )}
                                {job.location?.floorNumber && (
                                    <p className="text-sm text-gray-700 break-words">
                                        <span className="font-semibold">Floor:</span> {job.location.floorNumber}
                                    </p>
                                )}
                            </div>
                            {Number.isFinite(Number(job.location?.lat)) && Number.isFinite(Number(job.location?.lng)) && (
                                <>
                                    <MiniMap lat={job.location.lat} lng={job.location.lng} />
                                    <button
                                        type="button"
                                        onClick={() => openGoogleMapsDirections({ lat: job.location.lat, lng: job.location.lng })}
                                        className="mt-2 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-semibold text-sm hover:bg-blue-100 transition-all"
                                    >
                                        <Navigation size={14} /> View Location In Google Maps
                                    </button>
                                </>
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

                        <div className="bg-gray-50 rounded-2xl px-3 sm:px-4 py-3 text-xs text-gray-500 flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-1"><Users size={12} /> {job.applicantCount || 0} applied</span>
                            <span className="flex items-center gap-1"><Briefcase size={12} /> {job.workersRequired} worker{job.workersRequired !== 1 ? 's' : ''} needed</span>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 sm:px-6 pb-4 sm:pb-5 pt-3 sm:pt-4 flex-shrink-0">
                        {job.isSubTask ? (
                            job.hasApplied ? (
                                <div className="w-full text-center py-3 sm:py-3.5 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 rounded-2xl font-bold border border-green-200 text-sm">
                                    ✓ Applied for this sub-task
                                </div>
                            ) : job.isAssigned ? (
                                <div className="w-full text-center py-3 sm:py-3.5 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 rounded-2xl font-bold border border-green-200 text-sm">
                                    ✓ You're Assigned
                                </div>
                            ) : isAvailable && !applyBlocked ? (
                                <button
                                    onClick={handleApplySubTask}
                                    className="w-full py-3 sm:py-3.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-black rounded-2xl text-sm sm:text-base flex items-center justify-center gap-2 transition-all shadow-lg active:scale-98"
                                >
                                    <Briefcase size={16} /> Apply For This Sub-task
                                </button>
                            ) : (
                                <div className="w-full text-center py-3 sm:py-3.5 bg-red-50 border border-red-200 text-red-600 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2">
                                    <AlertCircle size={14} /> {applyBlocked ? 'Distance/time rule blocked this application' : 'Turn ON availability to apply'}
                                </div>
                            )
                        ) : remainingOpenSkills.length === 0 && (job.myAppliedSkills || []).length > 0 ? (
                            <div className="w-full text-center py-3 sm:py-3.5 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 rounded-2xl font-bold border border-green-200 text-sm">
                                ✓ Applied{job.myAppliedSkills?.length > 0 ? ` for: ${job.myAppliedSkills.slice(0, 2).join(', ')}${job.myAppliedSkills.length > 2 ? '...' : ''}` : ''}
                            </div>
                        ) : job.isAssigned ? (
                            <div className="w-full text-center py-3 sm:py-3.5 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 rounded-2xl font-bold border border-green-200 text-sm">
                                ✓ You're Assigned
                            </div>
                        ) : isAvailable && !applyBlocked ? (
                            <button
                                onClick={() => setShowSkillPicker(true)}
                                className="w-full py-3 sm:py-3.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-black rounded-2xl text-sm sm:text-base flex items-center justify-center gap-2 transition-all shadow-lg active:scale-98"
                            >
                                <Briefcase size={16} /> Select Position & Apply
                            </button>
                        ) : (
                            <div className="w-full text-center py-3 sm:py-3.5 bg-red-50 border border-red-200 text-red-600 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2">
                                <AlertCircle size={14} /> {applyBlocked ? 'Distance/time rule blocked this application' : 'Turn ON availability to apply'}
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
        </>
    );
}

// ── Sub-Task Card (Mobile Optimized) ───────────────────────────────────────────
function SubTaskCard({ job, isAvailable, applying, onApply, onViewDetails }) {
    const earnings = (job.relevantBudgetBlocks || []).reduce((s, b) => s + (b.subtotal || 0), 0);
    const hours = job.workerSlots?.[0]?.hoursEstimated;
    const applyBlocked = isCommuteApplyBlocked(job?.commute);

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

                <p className={`text-xs mb-3 font-semibold ${getCommuteToneClass(job?.commute)}`}>
                    {formatCommuteText(job?.commute)}
                    {job?.commute?.isLocationStale ? ' • stale location' : ''}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 gap-2">
                    <button
                        type="button"
                        onClick={() => onViewDetails?.(job)}
                        className="text-xs px-3 sm:px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl font-semibold transition-all active:scale-95"
                    >
                        View Details
                    </button>
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
                            onClick={() => isAvailable && !applyBlocked ? onApply(job) : toast.error(applyBlocked ? 'You cannot apply due to distance/time constraint.' : 'Turn ON availability to apply.')}
                            disabled={applying[job._id] || applyBlocked}
                            className={`text-xs px-4 sm:px-5 py-2 rounded-xl font-bold disabled:opacity-60 transition-all active:scale-95 ${
                                isAvailable && !applyBlocked
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
    const [semanticMatchesByJob, setSemanticMatchesByJob] = useState({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterSkill, setFilterSkill] = useState('all');
    const [filterCity, setFilterCity] = useState('all');
    const [highMatchOnly, setHighMatchOnly] = useState(false);
    const [detailId, setDetailId] = useState(null);
    const [applyModal, setApplyModal] = useState(null);
    const [applying, setApplying] = useState({});
    const [isAvailable, setIsAvailable] = useState(true);
    const [activeTaskBlock, setActiveTaskBlock] = useState(null);
    const [countdownNow, setCountdownNow] = useState(Date.now());
    const [showFilters, setShowFilters] = useState(false);

    const localUser = JSON.parse(localStorage.getItem('user') || '{}');
    const workerId = localUser?._id || localUser?.id || null;
    const workerSkills = (localUser?.skills || []).map(normSkill).filter(Boolean);

    const handleOpenDetails = async (job) => {
        setDetailId(job?._id || null);
        if (!workerId || !job?._id || !semanticMatchesByJob[job._id]) return;
        try {
            await recordSemanticFeedback({ jobId: job._id, workerId, event: 'viewed', source: 'worker_ui' });
        } catch (err) {
            console.debug('Failed to record semantic feedback:', err);
        }
    };

    const loadJobs = async () => {
        try {
            setLoading(true);
            const [jobsRes, profileRes, bookingsRes] = await Promise.all([
                getAvailableJobs(),
                getWorkerProfile(),
                getWorkerBookings(),
            ]);

            const semanticRes = await getSemanticJobsForWorker({ topK: 100, minScore: 0.15 }).catch(() => ({ data: { matches: [] } }));
            const semanticMap = (semanticRes?.data?.matches || []).reduce((acc, row) => {
                const item = normalizeSemanticJobMatch(row);
                if (item.jobId) acc[item.jobId] = item;
                return acc;
            }, {});

            setSemanticMatchesByJob(semanticMap);
            setJobs(Array.isArray(jobsRes.data) ? jobsRes.data : []);
            setIsAvailable(profileRes.data?.availability !== false);
            setActiveTaskBlock(getActiveTaskBlockFromBookings(bookingsRes?.data || [], workerId));
        } catch {
            toast.error('Failed to load jobs.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadJobs(); }, []);

    useEffect(() => {
        if (!activeTaskBlock) return undefined;
        const timer = setInterval(() => setCountdownNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [activeTaskBlock]);

    const remainingSeconds = Number.isFinite(activeTaskBlock?.endMs)
        ? Math.max(0, Math.floor((activeTaskBlock.endMs - countdownNow) / 1000))
        : null;

    const handleApplied = (jobId, selectedSkills = []) =>
        setJobs((prev) => prev.map((j) => {
            if (j._id !== jobId) return j;
            const mergedSkills = [...new Set([...(j.myAppliedSkills || []), ...selectedSkills].map(normSkill))];
            return { ...j, hasApplied: true, myAppliedSkills: mergedSkills };
        }));

    const handleSubTaskApply = async (job) => {
        try {
            setApplying(p => ({ ...p, [job._id]: true }));
            const parentId = job.parentJobId?._id || job.parentJobId;
            await applyForSubTask(parentId, job._id);
            toast.success(`Applied for ${job.subTaskSkill || 'sub-task'}!`);
            setJobs(p => p.map(j => j._id === job._id ? { ...j, hasApplied: true, myAppliedSkills: [normSkill(job.subTaskSkill || 'general')] } : j));
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to apply.');
        } finally {
            setApplying(p => ({ ...p, [job._id]: false }));
        }
    };

    const handleQuickApplySkills = async (job, selectedSkills, quotedApplications = []) => {
        try {
            setApplying(p => ({ ...p, [job._id]: true }));
            await applyForJob(job._id, selectedSkills, { quotedApplications });
            toast.success(`Applied for: ${selectedSkills.join(', ')}!`);
            handleApplied(job._id, selectedSkills);
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

    const mergedJobs = jobs.map((job) => {
        const semanticMatch = semanticMatchesByJob[job._id] || null;
        const overlap = getSkillOverlapStats(job, workerSkills);
        const merged = {
            ...job,
            semanticMatch,
            matchedSkillsFallback: overlap.overlapSkills,
            skillOverlapCount: overlap.overlapCount,
            skillOverlapRatio: overlap.overlapRatio,
        };
        return {
            ...merged,
            isHighMatch: isHighMatchJob(merged),
        };
    });

    const filtered = mergedJobs.filter(j => {
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
        if (highMatchOnly && !j.isHighMatch) return false;
        return true;
    });

    const rankedFiltered = [...filtered].sort((a, b) => {
        const aRank = (a.semanticMatch?.score || 0) + (a.skillOverlapCount || 0) * 0.08 + (a.isHighMatch ? 0.15 : 0);
        const bRank = (b.semanticMatch?.score || 0) + (b.skillOverlapCount || 0) * 0.08 + (b.isHighMatch ? 0.15 : 0);
        return bRank - aRank;
    });

    const requestJobs = rankedFiltered.filter((j) => {
        const hasAnyHistory = !!j.hasApplicationHistory || !!j.hasApplied || getAppliedSkillList(j).length > 0;
        if (hasAnyHistory) return false;
        return !isFullyAppliedForOpenSlots(j);
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
            <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 pb-20">
                {/* Header - Mobile Optimized */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    data-guide-id="worker-page-job-requests"
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
                            <Sparkles size={10} /> {requestJobs.length} New Applications
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
                    {activeTaskBlock && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-amber-50 border-2 border-amber-200 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-3"
                        >
                            <div className="flex items-start gap-2 sm:gap-3">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <Clock size={16} className="text-amber-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs sm:text-sm font-bold text-amber-800">
                                        Apply is blocked until client marks your task Done
                                    </p>
                                    <p className="text-[10px] sm:text-xs text-amber-700 mt-0.5 truncate">
                                        Active task: {activeTaskBlock.skill} in {activeTaskBlock.jobTitle}
                                    </p>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-3">
                                        <span className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-lg text-xs font-black tracking-wide">
                                            {remainingSeconds === null ? 'Countdown: --:--:--' : `Countdown: ${formatDurationHMS(remainingSeconds)}`}
                                        </span>
                                        <span className="text-[10px] sm:text-xs text-amber-700">
                                            Duration: {Math.max(0, Number(activeTaskBlock.durationHours || 0))}h
                                        </span>
                                        <span className="text-[10px] sm:text-xs text-amber-700">
                                            Expected end: {formatDateTime(activeTaskBlock.endMs)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
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
                        <button
                            onClick={() => setHighMatchOnly(v => !v)}
                            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 border-2 rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-95 ${
                                highMatchOnly
                                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                    : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                            }`}
                        >
                            <Sparkles size={12} />
                            High Match
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
                                        onClick={() => { setSearch(''); setFilterSkill('all'); setFilterCity('all'); setHighMatchOnly(false); }}
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
                ) : requestJobs.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-12 sm:py-20 bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100 mx-2 sm:mx-0"
                    >
                        <Search size={40} className="text-gray-300 mx-auto mb-3" />
                        <p className="font-bold text-gray-800 text-lg sm:text-xl mb-2">No new applications found</p>
                        <p className="text-gray-400 text-xs sm:text-sm mb-4">Try adjusting your filters</p>
                        <button
                            onClick={() => { setSearch(''); setFilterSkill('all'); setFilterCity('all'); }}
                            className="px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold hover:shadow-lg transition-all active:scale-95 text-sm"
                        >
                            Show All Jobs
                        </button>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        <AnimatePresence>
                            {requestJobs.map(job => (
                                job.isSubTask ? (
                                    <SubTaskCard
                                        key={job._id}
                                        job={job}
                                        isAvailable={isAvailable}
                                        applying={applying}
                                        onApply={handleSubTaskApply}
                                        onViewDetails={handleOpenDetails}
                                    />
                                ) : (
                                    <motion.div
                                        key={job._id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        whileHover={{ y: -2 }}
                                        className="bg-white rounded-2xl border-2 border-gray-100 shadow-md hover:shadow-xl transition-all cursor-pointer overflow-hidden h-full min-h-[460px] flex flex-col"
                                        onClick={() => handleOpenDetails(job)}
                                    >
                                        {job.photos?.[0] && (
                                            <div className="relative h-36 border-b border-gray-100 overflow-hidden">
                                                <img
                                                    src={getImageUrl(job.photos[0])}
                                                    alt={job.title}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                    }}
                                                />
                                            <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                                                {job.urgent && (
                                                    <span className="text-xs bg-gradient-to-r from-orange-100 to-red-100 text-orange-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                                        <Zap size={10} /> Urgent
                                                    </span>
                                                )}
                                                {job.invitedForMe && (
                                                    <span className="text-xs bg-gradient-to-r from-indigo-100 to-blue-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                                                        Direct Invite
                                                    </span>
                                                )}
                                            </div>
                                            {job.negotiable && (
                                                <span className="absolute top-3 right-3 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">🤝 Nego</span>
                                            )}
                                            </div>
                                        )}

                                        <div className="p-4 sm:p-5 flex-1 flex flex-col">
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
                                                            {job.invitedForMe && (
                                                                <span className="text-xs bg-gradient-to-r from-indigo-100 to-blue-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                                                                    Direct Invite
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <p className="text-sm text-gray-500 mt-3 line-clamp-2 leading-relaxed">
                                                {job.shortDescription || job.description}
                                            </p>

                                            {job.semanticMatch ? (
                                                <div className="mt-3 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-2.5 space-y-1.5">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="text-[11px] font-black text-indigo-700 flex items-center gap-1">
                                                            <Sparkles size={11} /> Semantic Match
                                                        </p>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] font-black text-indigo-700 bg-white border border-indigo-100 px-2 py-0.5 rounded-full">
                                                                {job.semanticMatch.matchPercent}%
                                                            </span>
                                                            <span className="text-[10px] text-indigo-500">
                                                                Sim {job.semanticMatch.semanticPercent}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {job.semanticMatch.matchedSkills?.length > 0 && (
                                                        <div className="flex flex-wrap gap-1">
                                                            {job.semanticMatch.matchedSkills.slice(0, 3).map((skill) => (
                                                                <span key={`${job._id}-ms-${skill}`} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 capitalize">
                                                                    {skill}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {job.semanticMatch.reasons?.length > 0 && (
                                                        <p className="text-[10px] text-gray-500 line-clamp-1">
                                                            {job.semanticMatch.reasons[0]}
                                                        </p>
                                                    )}
                                                </div>
                                            ) : job.skillOverlapCount > 0 ? (
                                                <div className="mt-3 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-100 rounded-xl p-2.5 space-y-1.5">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="text-[11px] font-black text-emerald-700 flex items-center gap-1">
                                                            <Sparkles size={11} /> Skill Match
                                                        </p>
                                                        <span className="text-[10px] font-black text-emerald-700 bg-white border border-emerald-100 px-2 py-0.5 rounded-full">
                                                            {job.skillOverlapCount} skill(s)
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {(job.matchedSkillsFallback || []).slice(0, 3).map((skill) => (
                                                            <span key={`${job._id}-smf-${skill}`} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 capitalize">
                                                                {skill}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : null}

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
                                                {job.scheduledTime && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={10} />
                                                        {job.scheduledTime}
                                                    </span>
                                                )}
                                                {(job.location?.locality || job.location?.city) && (
                                                    <span className="flex items-center gap-1 truncate">
                                                        <MapPin size={10} />
                                                        {[job.location?.locality, job.location?.city].filter(Boolean).join(', ')}
                                                    </span>
                                                )}
                                                {job.applicantCount > 0 && (
                                                    <span className="flex items-center gap-1">
                                                        <Users size={10} />
                                                        {job.applicantCount} applied
                                                    </span>
                                                )}
                                            </div>

                                            <p className={`mt-2 text-xs font-semibold ${getCommuteToneClass(job?.commute)}`}>
                                                {formatCommuteText(job?.commute)}
                                                {job?.commute?.isLocationStale ? ' • stale location' : ''}
                                            </p>

                                            {/* Footer */}
                                            <div className="mt-auto pt-2 border-t border-gray-100 space-y-1.5">
                                                <div>
                                                    {(() => {
                                                        const blocks = (job.relevantBudgetBlocks || []).slice(0, 2);
                                                        if (!blocks.length) return <div className="text-xs text-gray-400">Tap for skill-wise cost</div>;
                                                        return (
                                                            <div className="space-y-1">
                                                                {blocks.map((b, i) => {
                                                                    const perWorker = Math.round(Number(b.subtotal || 0) / Math.max(1, Number(b.count || 1)));
                                                                    const nego = Number(b.negotiationAmount || 0);
                                                                    return (
                                                                        <div key={`${job._id}-cost-${i}`} className="text-[11px]">
                                                                            <span className="font-bold text-green-700 capitalize">{b.skill}:</span>{' '}
                                                                            <span className="font-black text-green-600">₹{perWorker.toLocaleString()}</span>
                                                                            {job.negotiable && nego > 0 && (
                                                                                <span className="text-orange-600"> · Nego ₹{nego.toLocaleString()}</span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        );
                                                    })()}
                                                    <div className="mt-1 text-[10px] text-gray-500">
                                                        {formatPaymentMethod(job.paymentMethod)}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-3 gap-2" onClick={e => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => Number.isFinite(Number(job.location?.lat)) && Number.isFinite(Number(job.location?.lng))
                                                            ? openGoogleMapsDirections({ lat: job.location.lat, lng: job.location.lng })
                                                            : toast.error('Location not available')}
                                                        className="text-xs px-2 py-2 border-2 border-blue-200 text-blue-600 rounded-xl hover:bg-blue-50 font-bold transition-all active:scale-95"
                                                    >
                                                        <Navigation size={12} className="inline mr-1" />
                                                        Maps
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenDetails(job)}
                                                        className="text-xs px-2 py-2 border-2 border-orange-200 text-orange-600 rounded-xl hover:bg-orange-50 font-bold transition-all active:scale-95"
                                                    >
                                                        <Eye size={12} className="inline mr-1" />
                                                        Details
                                                    </button>
                                                    {!isFullyAppliedForOpenSlots(job) ? (
                                                        <button
                                                            onClick={() => isAvailable
                                                                ? handleOpenDetails(job)
                                                                : toast.error('Turn ON availability to apply.')}
                                                            disabled={applying[job._id] || isCommuteApplyBlocked(job?.commute)}
                                                            className={`text-xs px-2 py-2 rounded-xl font-bold disabled:opacity-60 transition-all active:scale-95 ${
                                                                isAvailable && !isCommuteApplyBlocked(job?.commute)
                                                                    ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-md'
                                                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                            }`}
                                                        >
                                                            {applying[job._id] ? <Loader2 size={12} className="animate-spin" /> : 'Apply'}
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs px-2 py-2 bg-gradient-to-r from-green-50 to-emerald-50 text-green-600 rounded-xl font-bold border border-green-200 whitespace-nowrap text-center">
                                                            ✓ Already Applied
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
                        semanticMatch={semanticMatchesByJob[detailId] || null}
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
                        onApply={(skills, quotedApplications) => handleQuickApplySkills(applyModal, skills, quotedApplications)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}