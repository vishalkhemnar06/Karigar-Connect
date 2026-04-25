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
    MessageCircle, X, Wallet, Home, Route, FileText,
    UserCircle, Verified, ThumbsUp, Clock3, CalendarDays
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
    if (!commute?.available) return 'text-gray-400';
    if (commute.distanceColor === 'green') return 'text-emerald-600';
    if (commute.distanceColor === 'yellow') return 'text-amber-600';
    return 'text-rose-600';
};

const isCommuteApplyBlocked = (commute) => {
    if (!commute?.available) return true;
    if (Number(commute.distanceKm || 0) > 20) return true;
    if (commute.canReachBeforeStart === false) return true;
    return false;
};

const formatPaymentMethod = (method) => {
    switch (method) {
        case 'cash': return 'Cash on Completion';
        case 'upi_qr': return 'UPI / QR Code';
        case 'bank_transfer': return 'Bank Transfer';
        default: return 'Flexible Payment';
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

// ── Skill Selection Modal (Premium Design) ──────────────────────────────────
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
                className="bg-white w-full sm:rounded-2xl shadow-xl sm:max-w-md rounded-t-2xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-md">
                        <Briefcase size="20" className="text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900">Select Positions</h3>
                        <p className="text-xs text-gray-500 truncate">{job?.title}</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
                        <X size="18" className="text-gray-400" />
                    </button>
                </div>

                <p className="text-sm text-gray-500 mb-4">Select up to 2 positions to apply for</p>

                <AnimatePresence>
                    {alert && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-700 flex items-center gap-2"
                        >
                            <AlertCircle size="14" />
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
                                    className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                                        isSel ? 'border-orange-400 bg-gradient-to-r from-orange-50 to-amber-50' : 'border-gray-200 bg-white hover:border-orange-200'
                                    }`}
                                >
                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                                        isSel ? 'bg-orange-500 border-orange-500' : 'border-gray-300'
                                    }`}>
                                        {isSel && <span className="text-white text-xs font-bold">✓</span>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <span className="font-bold text-gray-800 capitalize text-sm">{opt.skill}</span>
                                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                                {opt.count} slot{opt.count > 1 ? 's' : ''}
                                            </span>
                                            {opt.isMatch && (
                                                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                                                    <Star size="10" /> Your skill
                                                </span>
                                            )}
                                        </div>
                                        {opt.hoursEstimated && (
                                            <p className="text-xs text-gray-500">~{opt.hoursEstimated}h estimated</p>
                                        )}
                                        <p className="text-xs text-gray-500 mt-1">Quote basis: {quoteInfo.basisLabel} · {quoteInfo.durationText}</p>
                                        {isSel && (
                                            <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                                                <label className="block text-[11px] font-bold text-gray-600 mb-1">Your rate {quoteInfo.basisLabel}</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    step="1"
                                                    value={quoteRates[opt.skill] || ''}
                                                    onChange={(e) => setQuoteRates((prev) => ({ ...prev, [opt.skill]: e.target.value }))}
                                                    placeholder={suggestedRate ? String(suggestedRate) : 'Optional'}
                                                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}

                <div className="flex gap-3 mt-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-all active:scale-98"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={applying || !selected.length}
                        className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold disabled:opacity-60 transition-all shadow-md active:scale-98"
                    >
                        {applying ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 size="16" className="animate-spin" />
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

// ── Job Detail Modal (Premium Design) ───────────────────────────────────────
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
                <div className="bg-white rounded-2xl p-6 text-center max-w-[280px] shadow-xl">
                    <Loader2 size="32" className="animate-spin text-orange-500 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">Loading job details...</p>
                </div>
            </div>
        );
    }

    if (error || !job) {
        return (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 text-center max-w-[280px] shadow-xl">
                    <AlertCircle size="48" className="text-red-500 mx-auto mb-3" />
                    <p className="text-gray-600 text-sm">{error || 'Job not found.'}</p>
                    <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-100 rounded-xl text-sm font-semibold">Close</button>
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
                    className="bg-white w-full sm:rounded-2xl shadow-xl sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
                    onClick={e => e.stopPropagation()}
                >
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
                                    {job.invitedForMe && (
                                        <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-bold">
                                            Direct Invite
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
                    <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5 custom-scrollbar">
                        {/* Semantic Match */}
                        {semanticMatch && (
                            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                    <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-2">
                                        <Sparkles size="12" /> AI Match Score
                                    </p>
                                    <span className="text-sm font-bold text-indigo-700 bg-white px-3 py-1 rounded-full shadow-sm">
                                        {semanticMatch.matchPercent}% Match
                                    </span>
                                </div>
                                <div className="w-full bg-indigo-200 rounded-full h-1.5 mb-2">
                                    <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${semanticMatch.matchPercent}%` }} />
                                </div>
                                {semanticMatch.matchedSkills?.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {semanticMatch.matchedSkills.slice(0, 5).map((skill) => (
                                            <span key={`detail-skill-${skill}`} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 capitalize">
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Travel Info */}
                        <div className={`rounded-xl border p-4 ${job?.commute?.available ? 'border-gray-200 bg-gray-50' : 'border-red-200 bg-red-50'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <Route size="14" className={getCommuteToneClass(job?.commute)} />
                                <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Travel Information</p>
                            </div>
                            <p className={`text-sm font-semibold ${getCommuteToneClass(job?.commute)}`}>{formatCommuteText(job?.commute)}</p>
                            {applyBlocked && <p className="text-[11px] text-red-600 mt-2">Apply allowed only within 20 km and if you can reach before job start.</p>}
                        </div>

                        {/* Client Info */}
                        {job.postedBy && (
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                                <div className="flex items-center gap-4">
                                    <img
                                        src={getImageUrl(job.postedBy.photo)}
                                        alt={job.postedBy.name}
                                        className="w-14 h-14 rounded-xl object-cover border-2 border-white shadow-md"
                                        onError={e => { e.target.src = '/admin.png'; }}
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <UserCircle size="16" className="text-blue-600" />
                                            <span className="font-bold text-gray-800">{job.postedBy.name}</span>
                                            {job.postedBy.verificationStatus === 'approved' && (
                                                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                                                    <Verified size="10" /> Verified
                                                </span>
                                            )}
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
                                    <h3 className="font-bold text-gray-800">Open Positions</h3>
                                </div>
                                <div className="space-y-2">
                                    {Object.entries(job.openSlotSummary).map(([sk, count]) => {
                                        const isMatch = workerSkills.length > 0 && workerSkills.includes(normSkill(sk));
                                        return (
                                            <div key={sk} className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-3 border border-orange-100">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-orange-700 capitalize">{sk}</span>
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
                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                                    <span className="text-sm text-gray-600">Quote Basis</span>
                                    <span className="text-sm font-semibold text-gray-800">{quoteBasisInfo.basisLabel} · {quoteBasisInfo.durationText}</span>
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
                                    {job.duration && (
                                        <div className="flex items-center gap-3 text-sm text-gray-600">
                                            <Clock3 size="14" className="text-gray-400" />
                                            <span>{job.duration}</span>
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
                                </div>
                                {Number.isFinite(Number(job.location?.lat)) && Number.isFinite(Number(job.location?.lng)) && (
                                    <>
                                        <MiniMap lat={job.location.lat} lng={job.location.lng} />
                                        <button
                                            type="button"
                                            onClick={() => openGoogleMapsDirections({ lat: job.location.lat, lng: job.location.lng })}
                                            className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-xl font-semibold text-sm hover:bg-blue-100 transition-all"
                                        >
                                            <Navigation size="14" /> Get Directions
                                        </button>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Q&A */}
                        {job.qaAnswers?.filter(q => q.answer).length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <MessageCircle size="16" className="text-orange-500" />
                                    <h3 className="font-bold text-gray-800">Client Requirements</h3>
                                </div>
                                <div className="space-y-2">
                                    {job.qaAnswers.filter(q => q.answer).slice(0, 3).map((qa, i) => (
                                        <div key={i} className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                                            <p className="text-xs font-bold text-amber-700 mb-1">Q: {qa.question}</p>
                                            <p className="text-sm text-gray-700">A: {qa.answer}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Stats */}
                        <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-500 flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-1"><Users size="12" /> {job.applicantCount || 0} applied</span>
                            <span className="flex items-center gap-1"><Briefcase size="12" /> {job.workersRequired} worker{job.workersRequired !== 1 ? 's' : ''} needed</span>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-gray-100 px-6 py-4 flex-shrink-0 bg-white">
                        {job.isSubTask ? (
                            job.hasApplied ? (
                                <div className="w-full text-center py-3 bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 rounded-xl font-bold border border-emerald-200 text-sm">
                                    ✓ Applied for this sub-task
                                </div>
                            ) : job.isAssigned ? (
                                <div className="w-full text-center py-3 bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 rounded-xl font-bold border border-emerald-200 text-sm">
                                    ✓ You're Assigned
                                </div>
                            ) : isAvailable && !applyBlocked ? (
                                <button
                                    onClick={handleApplySubTask}
                                    className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-98"
                                >
                                    <Briefcase size="16" /> Apply For This Sub-task
                                </button>
                            ) : (
                                <div className="w-full text-center py-3 bg-red-50 border border-red-200 text-red-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                                    <AlertCircle size="14" /> {applyBlocked ? 'Distance/time rule blocked this application' : 'Turn ON availability to apply'}
                                </div>
                            )
                        ) : remainingOpenSkills.length === 0 && (job.myAppliedSkills || []).length > 0 ? (
                            <div className="w-full text-center py-3 bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 rounded-xl font-bold border border-emerald-200 text-sm">
                                ✓ Applied{job.myAppliedSkills?.length > 0 ? ` for ${job.myAppliedSkills.slice(0, 2).join(', ')}${job.myAppliedSkills.length > 2 ? '...' : ''}` : ''}
                            </div>
                        ) : job.isAssigned ? (
                            <div className="w-full text-center py-3 bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 rounded-xl font-bold border border-emerald-200 text-sm">
                                ✓ You're Assigned
                            </div>
                        ) : isAvailable && !applyBlocked ? (
                            <button
                                onClick={() => setShowSkillPicker(true)}
                                className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-98"
                            >
                                <Briefcase size="16" /> Select Position & Apply
                            </button>
                        ) : (
                            <div className="w-full text-center py-3 bg-red-50 border border-red-200 text-red-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                                <AlertCircle size="14" /> {applyBlocked ? 'Distance/time rule blocked this application' : 'Turn ON availability to apply'}
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

            {/* Photo Preview Modal */}
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
        </>
    );
}

// ── Sub-Task Card (Premium Design) ───────────────────────────────────────────
function SubTaskCard({ job, isAvailable, applying, onApply, onViewDetails }) {
    const earnings = (job.relevantBudgetBlocks || []).reduce((s, b) => s + (b.subtotal || 0), 0);
    const hours = job.workerSlots?.[0]?.hoursEstimated;
    const applyBlocked = isCommuteApplyBlocked(job?.commute);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            className="bg-white rounded-xl border border-amber-200 shadow-md hover:shadow-xl transition-all overflow-hidden"
        >
            <div className="h-1.5 bg-gradient-to-r from-amber-400 to-orange-500" />
            <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] bg-gradient-to-r from-amber-100 to-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide flex items-center gap-1">
                                <Zap size="10" /> Urgent Sub-task
                            </span>
                        </div>
                        <h3 className="font-bold text-gray-800 text-base capitalize">{job.subTaskSkill} Task</h3>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{job.parentJobTitle || job.title}</p>
                    </div>
                    {earnings > 0 && (
                        <div className="text-right">
                            <div className="text-lg font-bold text-emerald-600">₹{earnings.toLocaleString()}</div>
                            <div className="text-[10px] text-gray-400">Earnings</div>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 text-xs mb-3">
                    {job.scheduledTime && (
                        <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-semibold flex items-center gap-1 text-xs">
                            <Clock size="10" /> {job.scheduledTime}
                        </span>
                    )}
                    {hours && (
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">~{hours}h</span>
                    )}
                    {job.location?.city && (
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full flex items-center gap-1 text-xs">
                            <MapPin size="10" /> {job.location.city}
                        </span>
                    )}
                    {job.scheduledDate && (
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full flex items-center gap-1 text-xs">
                            <Calendar size="10" /> {new Date(job.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                    )}
                </div>

                <p className={`text-xs font-medium mb-3 flex items-center gap-1 ${getCommuteToneClass(job?.commute)}`}>
                    <Route size="12" /> {formatCommuteText(job?.commute)}
                </p>

                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={() => onViewDetails?.(job)}
                        className="flex-1 text-xs px-3 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg font-semibold transition-all"
                    >
                        <Eye size="12" className="inline mr-1" /> Details
                    </button>
                    {job.hasApplied ? (
                        <span className="flex-1 text-center text-xs px-3 py-2 bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-600 rounded-lg font-semibold border border-emerald-200">
                            Applied ✓
                        </span>
                    ) : job.isAssigned ? (
                        <span className="flex-1 text-center text-xs px-3 py-2 bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-600 rounded-lg font-semibold border border-emerald-200">
                            Assigned ✓
                        </span>
                    ) : (
                        <button
                            onClick={() => isAvailable && !applyBlocked ? onApply(job) : toast.error(applyBlocked ? 'Cannot apply due to distance/time constraint.' : 'Turn ON availability to apply.')}
                            disabled={applying[job._id] || applyBlocked}
                            className={`flex-1 text-xs px-3 py-2 rounded-lg font-semibold transition-all disabled:opacity-60 ${
                                isAvailable && !applyBlocked
                                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md hover:shadow-lg' 
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                            {applying[job._id] ? <Loader2 size="12" className="animate-spin mx-auto" /> : 'Apply Now'}
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
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
            <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 size="48" className="animate-spin text-orange-500 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">Loading available jobs...</p>
                </div>
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
                    className="mb-6"
                >
                    <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-xl">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                    <Briefcase size="24" className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black">Available Jobs</h1>
                                    <p className="text-white/90 text-sm mt-0.5">Find your next opportunity</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="bg-white/15 rounded-xl px-4 py-2 text-center">
                                    <p className="text-2xl font-bold">{jobs.length}</p>
                                    <p className="text-xs text-white/80">Total Jobs</p>
                                </div>
                                <div className="bg-white/15 rounded-xl px-4 py-2 text-center">
                                    <p className="text-2xl font-bold">{requestJobs.length}</p>
                                    <p className="text-xs text-white/80">Open Applications</p>
                                </div>
                                {workerSkills.length > 0 && (
                                    <div className="bg-white/15 rounded-xl px-4 py-2 text-center hidden md:block">
                                        <p className="text-sm font-semibold">Skills</p>
                                        <p className="text-xs">{workerSkills.slice(0, 2).join(', ')}{workerSkills.length > 2 ? '...' : ''}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Availability Banner */}
                <AnimatePresence>
                    {activeTaskBlock && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4"
                        >
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Clock size="18" className="text-amber-600" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                        <p className="text-sm font-bold text-amber-800">Active Task in Progress</p>
                                        <span className="px-2 py-0.5 bg-amber-200 text-amber-800 rounded text-xs font-bold">
                                            {remainingSeconds !== null ? formatDurationHMS(remainingSeconds) : 'Timing TBD'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-amber-700">
                                        {activeTaskBlock.skill} in {activeTaskBlock.jobTitle}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                    {!isAvailable && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3"
                        >
                            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <AlertCircle size="18" className="text-red-500" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-red-700">You are not available for work</p>
                                <p className="text-xs text-red-600">Turn ON availability from the header to apply for jobs.</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Search & Filters Section */}
                <div className="mb-5 space-y-3">
                    <div className="relative">
                        <Search size="18" className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search jobs by title, skill, location..."
                            className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all bg-white"
                        />
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:border-orange-300 hover:text-orange-600 transition-all bg-white"
                        >
                            <Filter size="14" />
                            Filters
                            <ChevronDown size="14" className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                        </button>
                        <button
                            onClick={loadJobs}
                            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:border-orange-300 transition-all bg-white"
                        >
                            <RefreshCw size="14" />
                            Refresh
                        </button>
                        <button
                            onClick={() => setHighMatchOnly(v => !v)}
                            className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-semibold transition-all ${
                                highMatchOnly
                                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-300'
                            }`}
                        >
                            <Sparkles size="14" />
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
                                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                    <select
                                        value={filterSkill}
                                        onChange={e => setFilterSkill(e.target.value)}
                                        className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 bg-white"
                                    >
                                        <option value="all">All Skills</option>
                                        {allSkills.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                                    </select>
                                    <select
                                        value={filterCity}
                                        onChange={e => setFilterCity(e.target.value)}
                                        className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 bg-white"
                                    >
                                        <option value="all">All Cities</option>
                                        {allCities.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                {(search || filterSkill !== 'all' || filterCity !== 'all' || highMatchOnly) && (
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

                {/* Results Count */}
                {requestJobs.length > 0 && (
                    <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm text-gray-500">
                            Showing <span className="font-bold text-orange-600">{requestJobs.length}</span> available job{requestJobs.length !== 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-gray-400">Sorted by relevance</p>
                    </div>
                )}

                {/* Job Cards Grid */}
                {jobs.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center"
                    >
                        <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Briefcase size="36" className="text-orange-400" />
                        </div>
                        <h3 className="font-bold text-gray-800 text-xl mb-2">No Jobs Available</h3>
                        <p className="text-gray-400 text-sm">Check back later for new opportunities</p>
                    </motion.div>
                ) : requestJobs.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center"
                    >
                        <Search size="48" className="text-gray-300 mx-auto mb-3" />
                        <h3 className="font-bold text-gray-800 text-xl mb-2">No Matching Jobs Found</h3>
                        <p className="text-gray-400 text-sm mb-5">Try adjusting your filters to see more opportunities</p>
                        <button
                            onClick={() => { setSearch(''); setFilterSkill('all'); setFilterCity('all'); setHighMatchOnly(false); }}
                            className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                        >
                            Show All Jobs
                        </button>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
                                        exit={{ opacity: 0, scale: 0.96 }}
                                        whileHover={{ y: -4 }}
                                        transition={{ duration: 0.2 }}
                                        className="group bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-xl transition-all cursor-pointer overflow-hidden"
                                        onClick={() => handleOpenDetails(job)}
                                    >
                                        {/* Card Image Header */}
                                        <div className="relative h-36 overflow-hidden bg-gradient-to-br from-orange-100 to-amber-100">
                                            {job.photos?.[0] ? (
                                                <img
                                                    src={getImageUrl(job.photos[0])}
                                                    alt={job.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                        e.target.parentElement?.classList.add('flex', 'items-center', 'justify-center');
                                                        e.target.parentElement.innerHTML = '<Briefcase size="36" class="text-orange-300" />';
                                                    }}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Briefcase size="36" className="text-orange-300" />
                                                </div>
                                            )}
                                            
                                            {/* Badges Overlay */}
                                            <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                                                {job.urgent && (
                                                    <span className="text-xs bg-gradient-to-r from-orange-500 to-red-500 text-white px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-sm">
                                                        <Zap size="10" /> Urgent
                                                    </span>
                                                )}
                                                {job.invitedForMe && (
                                                    <span className="text-xs bg-gradient-to-r from-indigo-500 to-blue-500 text-white px-2 py-0.5 rounded-full font-bold shadow-sm">
                                                        Direct Invite
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {/* Match Score Badge */}
                                            {job.semanticMatch && (
                                                <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-full px-2 py-1 shadow-md">
                                                    <span className="text-xs font-bold text-indigo-600">{job.semanticMatch.matchPercent}% Match</span>
                                                </div>
                                            )}
                                            
                                            {job.negotiable && (
                                                <span className="absolute bottom-3 right-3 text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold shadow-sm">
                                                    🤝 Negotiable
                                                </span>
                                            )}
                                        </div>

                                        {/* Card Content */}
                                        <div className="p-4">
                                            {/* Client & Title */}
                                            <div className="flex items-start gap-3 mb-3">
                                                <img
                                                    src={getImageUrl(job.postedBy?.photo)}
                                                    alt=""
                                                    className="w-10 h-10 rounded-lg object-cover border-2 border-orange-200 shadow-sm flex-shrink-0"
                                                    onError={e => { e.target.src = '/admin.png'; }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-bold text-gray-800 text-sm leading-tight line-clamp-2">
                                                        {job.title}
                                                    </h3>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-xs text-gray-500 truncate">{job.postedBy?.name}</span>
                                                        {job.postedBy?.verificationStatus === 'approved' && (
                                                            <Verified size="12" className="text-emerald-500" />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Description */}
                                            <p className="text-xs text-gray-500 line-clamp-2 mb-3 leading-relaxed">
                                                {job.shortDescription || job.description}
                                            </p>

                                            {/* Skill Match Indicator */}
                                            {job.semanticMatch ? (
                                                <div className="mb-3 p-2.5 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border border-indigo-100">
                                                    <div className="flex items-center justify-between gap-2 mb-1">
                                                        <div className="flex items-center gap-1">
                                                            <Sparkles size="12" className="text-indigo-500" />
                                                            <span className="text-[10px] font-bold text-indigo-700">AI Match</span>
                                                        </div>
                                                        <div className="w-full max-w-[100px] bg-indigo-200 rounded-full h-1">
                                                            <div className="bg-indigo-600 h-1 rounded-full" style={{ width: `${job.semanticMatch.matchPercent}%` }} />
                                                        </div>
                                                    </div>
                                                    {job.semanticMatch.matchedSkills?.length > 0 && (
                                                        <div className="flex flex-wrap gap-1">
                                                            {job.semanticMatch.matchedSkills.slice(0, 2).map((skill) => (
                                                                <span key={skill} className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 capitalize">
                                                                    {skill}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : job.skillOverlapCount > 0 ? (
                                                <div className="mb-3 p-2.5 bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg border border-emerald-100">
                                                    <div className="flex items-center gap-1 mb-1">
                                                        <Star size="12" className="text-emerald-500" />
                                                        <span className="text-[10px] font-bold text-emerald-700">Skills Match</span>
                                                        <span className="text-[10px] font-bold text-emerald-600 ml-auto">{job.skillOverlapCount} skill(s)</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {(job.matchedSkillsFallback || []).slice(0, 3).map((skill) => (
                                                            <span key={skill} className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 capitalize">
                                                                {skill}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : null}

                                            {/* Open Positions */}
                                            {job.openSlotSummary && Object.keys(job.openSlotSummary).length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mb-3">
                                                    {Object.entries(job.openSlotSummary).slice(0, 3).map(([sk, cnt]) => {
                                                        const isMatch = workerSkills.length > 0 && workerSkills.includes(normSkill(sk));
                                                        return (
                                                            <span key={sk} className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize flex items-center gap-1 ${
                                                                isMatch ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-orange-100 text-orange-700 border border-orange-200'
                                                            }`}>
                                                                {sk} × {cnt}
                                                                {isMatch && <Star size="8" className="fill-emerald-600" />}
                                                            </span>
                                                        );
                                                    })}
                                                    {Object.keys(job.openSlotSummary).length > 3 && (
                                                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                                            +{Object.keys(job.openSlotSummary).length - 3}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Meta Info */}
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 mb-2">
                                                {job.scheduledDate && (
                                                    <span className="flex items-center gap-1">
                                                        <Calendar size="10" />
                                                        {new Date(job.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                )}
                                                {job.scheduledTime && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock size="10" />
                                                        {job.scheduledTime}
                                                    </span>
                                                )}
                                                {(job.location?.locality || job.location?.city) && (
                                                    <span className="flex items-center gap-1 truncate">
                                                        <MapPin size="10" />
                                                        {[job.location?.locality, job.location?.city].filter(Boolean).join(', ')}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Commute */}
                                            <div className={`text-xs font-medium mb-3 flex items-center gap-1 ${getCommuteToneClass(job?.commute)}`}>
                                                <Route size="10" />
                                                <span className="truncate">{formatCommuteText(job?.commute)}</span>
                                            </div>

                                            {/* Payment Info */}
                                            <div className="mb-3 p-2 bg-gray-50 rounded-lg">
                                                {(() => {
                                                    const blocks = (job.relevantBudgetBlocks || []).slice(0, 2);
                                                    if (!blocks.length) return <div className="text-xs text-gray-400">Tap for payment details</div>;
                                                    return (
                                                        <div className="space-y-1">
                                                            {blocks.map((b, i) => {
                                                                const perWorker = Math.round(Number(b.subtotal || 0) / Math.max(1, Number(b.count || 1)));
                                                                return (
                                                                    <div key={i} className="flex items-center justify-between text-xs">
                                                                        <span className="font-semibold capitalize text-gray-700">{b.skill}</span>
                                                                        <span className="font-bold text-emerald-600">₹{perWorker.toLocaleString()}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="grid grid-cols-3 gap-2" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => Number.isFinite(Number(job.location?.lat)) && Number.isFinite(Number(job.location?.lng))
                                                        ? openGoogleMapsDirections({ lat: job.location.lat, lng: job.location.lng })
                                                        : toast.error('Location not available')}
                                                    className="text-xs px-2 py-2 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 font-semibold transition-all"
                                                >
                                                    <Navigation size="12" className="inline mr-1" />
                                                    Map
                                                </button>
                                                <button
                                                    onClick={() => handleOpenDetails(job)}
                                                    className="text-xs px-2 py-2 border border-orange-200 text-orange-600 rounded-lg hover:bg-orange-50 font-semibold transition-all"
                                                >
                                                    <Eye size="12" className="inline mr-1" />
                                                    Details
                                                </button>
                                                {!isFullyAppliedForOpenSlots(job) ? (
                                                    <button
                                                        onClick={() => isAvailable && !isCommuteApplyBlocked(job?.commute)
                                                            ? handleOpenDetails(job)
                                                            : toast.error(isCommuteApplyBlocked(job?.commute) ? 'Cannot apply due to distance/time constraint.' : 'Turn ON availability to apply.')}
                                                        disabled={applying[job._id] || isCommuteApplyBlocked(job?.commute)}
                                                        className={`text-xs px-2 py-2 rounded-lg font-semibold transition-all ${
                                                            isAvailable && !isCommuteApplyBlocked(job?.commute)
                                                                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md hover:shadow-lg'
                                                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                        }`}
                                                    >
                                                        {applying[job._id] ? <Loader2 size="12" className="animate-spin mx-auto" /> : 'Apply'}
                                                    </button>
                                                ) : (
                                                    <span className="text-xs px-2 py-2 bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-600 rounded-lg font-semibold border border-emerald-200 text-center">
                                                        ✓ Applied
                                                    </span>
                                                )}
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
                               