// client/src/pages/client/ClientJobPost.jsx
// FULLY RESPONSIVE VERSION - Mobile-first design, touch-optimized

import { useState, useEffect, useRef, useCallback } from 'react';
import { postJob, aiGenerateQuestions, aiGenerateEstimate } from '../../api/index';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, MapPin, Calendar, Clock,
  DollarSign, Users, Briefcase, AlertCircle, CheckCircle,
  Plus, X, Edit, Camera, Upload, Loader2, Sparkles,
  TrendingUp, Target, Zap, Award, Eye, EyeOff, Home,
    ChevronDown, ChevronUp, RefreshCw, Rocket
} from 'lucide-react';

// ── Leaflet ───────────────────────────────────────────────────────────────────
let _leaflet = null;
const loadLeaflet = async () => {
    if (_leaflet) return _leaflet;
    try {
        const mod = await import('leaflet'); _leaflet = mod.default || mod;
        if (!document.getElementById('leaflet-css')) {
            const l = document.createElement('link'); l.id = 'leaflet-css'; l.rel = 'stylesheet';
            l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(l);
        }
        return _leaflet;
    } catch { return null; }
};

// ── Constants ─────────────────────────────────────────────────────────────────
const STEPS = [
    { label: 'Describe', icon: '📝' },
    { label: 'Questions', icon: '🤔' },
    { label: 'Budget', icon: '💰' },
    { label: 'Schedule', icon: '📅' },
    { label: 'Location', icon: '📍' },
    { label: 'Photos', icon: '📷' },
    { label: 'Preview', icon: '✅' },
];

const detectShift = (t) => {
    if (!t) return '';
    const h = parseInt(t.split(':')[0], 10);
    if (h >= 6 && h < 12) return 'Morning Shift (6 AM – 12 PM)';
    if (h >= 12 && h < 17) return 'Afternoon Shift (12 PM – 5 PM)';
    if (h >= 17 && h < 21) return 'Evening Shift (5 PM – 9 PM)';
    return '';
};

const shiftIcon = (s = '') =>
    s.includes('Morning') ? '🌅' : s.includes('Afternoon') ? '☀️' : s.includes('Evening') ? '🌆' : '';

const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const ensureNonNeg = (v, fb = 0) => { const n = Number(v); return isNaN(n) || n < 0 ? fb : n; };

const PAYMENT_METHODS = [
    { value: 'cash', label: 'Cash' },
    { value: 'upi_qr', label: 'Online UPI / QR' },
    { value: 'bank_transfer', label: 'Direct Bank Account' },
    { value: 'flexible', label: 'Flexible (Any)' },
];

const paymentMethodLabel = (method) => {
    const found = PAYMENT_METHODS.find((item) => item.value === method);
    return found?.label || 'Flexible (Any)';
};

const normalizeQuestions = (rawQuestions = []) => {
    if (!Array.isArray(rawQuestions)) return [];

    return rawQuestions
        .map((item, index) => {
            if (!item) return null;

            if (typeof item === 'string') {
                const text = item.trim();
                if (!text) return null;
                return { id: `q_${index + 1}`, question: text, type: 'text' };
            }

            if (typeof item !== 'object') return null;

            const questionText = typeof item.question === 'string' ? item.question.trim() : '';
            if (!questionText) return null;

            const safeType = item.type === 'number' || item.type === 'select' ? item.type : 'text';
            const safeOptions = safeType === 'select' && Array.isArray(item.options)
                ? item.options.filter(opt => typeof opt === 'string' && opt.trim())
                : [];

            return {
                id: String(item.id || `q_${index + 1}`),
                question: questionText,
                type: safeType,
                options: safeOptions,
            };
        })
        .filter(Boolean);
};

// ── Work flow suggestion engine ───────────────────────────────────────────────
const SKILL_ORDER = { mason: 1, plumber: 2, carpenter: 3, electrician: 4, tiler: 5, welder: 6, painter: 7, ac_technician: 8, cleaner: 9, handyman: 5, general: 5 };
const SEQUENTIAL_DEPS = {
    tiler: ['plumber', 'mason'],
    painter: ['mason', 'carpenter', 'electrician', 'tiler'],
    ac_technician: ['electrician'],
    cleaner: ['painter', 'tiler'],
};
const PARALLEL_CAPABLE = new Set(['painter', 'cleaner', 'handyman', 'general']);

const generateWorkFlow = (skillBlocks = []) => {
    if (!skillBlocks.length) return [];
    const skills = skillBlocks.map(b => b.skill).filter(Boolean);
    if (skills.length === 1) return [{ step: 1, skills: [skills[0]], type: 'sequential', note: 'Single skill required' }];

    const sorted = [...skills].sort((a, b) => (SKILL_ORDER[a] || 5) - (SKILL_ORDER[b] || 5));
    const phases = [];
    let step = 1;
    const done = new Set();

    while (done.size < sorted.length) {
        const phase = [];
        for (const sk of sorted) {
            if (done.has(sk)) continue;
            const deps = SEQUENTIAL_DEPS[sk] || [];
            const depsPresent = deps.filter(d => skills.includes(d));
            const depsDone = depsPresent.every(d => done.has(d));
            if (depsDone) phase.push(sk);
        }
        if (!phase.length) break;

        const parallelGroup = phase.filter(sk => PARALLEL_CAPABLE.has(sk));
        const seqGroup = phase.filter(sk => !PARALLEL_CAPABLE.has(sk));

        if (seqGroup.length) {
            phases.push({ step, skills: seqGroup, type: 'sequential', note: seqGroup.length > 1 ? 'Can work simultaneously' : '' });
            step++;
        }
        if (parallelGroup.length) {
            const block = skillBlocks.find(b => b.skill === parallelGroup[0]);
            phases.push({ step, skills: parallelGroup, type: 'parallel', note: `Multiple workers can work in parallel${block?.count > 1 ? ` (${block.count} workers)` : ''}` });
            step++;
        }
        phase.forEach(sk => done.add(sk));
    }
    return phases;
};

// ── Sub-components (Mobile Optimized) ────────────────────────────────────────────
function StepBar({ current }) {
    return (
        <div className="flex items-center overflow-x-auto pb-3 mb-6 scrollbar-hide gap-1">
            {STEPS.map((s, i) => (
                <div key={i} className="flex items-center flex-shrink-0">
                    <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold border-2 transition-all ${
                            i < current ? 'bg-green-500 border-green-500 text-white' :
                            i === current ? 'bg-orange-500 border-orange-500 text-white shadow-md' :
                            'bg-white border-gray-200 text-gray-400'
                        }`}>
                            {i < current ? <CheckCircle size={14} /> : s.icon}
                        </div>
                        <span className={`text-[8px] sm:text-[10px] mt-1 font-semibold whitespace-nowrap ${
                            i === current ? 'text-orange-600' : i < current ? 'text-green-500' : 'text-gray-300'
                        }`}>
                            {s.label}
                        </span>
                    </div>
                    {i < STEPS.length - 1 && (
                        <div className={`h-0.5 w-4 sm:w-6 mx-0.5 mb-5 rounded flex-shrink-0 ${
                            i < current ? 'bg-green-400' : 'bg-gray-200'
                        }`} />
                    )}
                </div>
            ))}
        </div>
    );
}

function QWidget({ q, value, onChange }) {
    if (q.type === 'select') return (
        <div className="space-y-2">
            <label className="block text-xs sm:text-sm font-semibold text-gray-700">{q.question}</label>
            <div className="flex flex-wrap gap-2">
                {(q.options||[]).map(opt => (
                    <button
                        key={opt}
                        type="button"
                        onClick={() => onChange(q.id, opt)}
                        className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border-2 transition-all active:scale-95 ${
                            value === opt ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'
                        }`}
                    >
                        {opt}
                    </button>
                ))}
            </div>
        </div>
    );
    return (
        <div className="space-y-2">
            <label className="block text-xs sm:text-sm font-semibold text-gray-700">{q.question}</label>
            <input
                type={q.type === 'number' ? 'number' : 'text'}
                min={0}
                value={value || ''}
                onChange={e => onChange(q.id, e.target.value)}
                placeholder="Your answer…"
                className="w-full border-2 border-gray-200 rounded-xl px-3 sm:px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 transition-colors"
            />
        </div>
    );
}

// ── Enhanced Budget Table (Mobile Optimized) ───────────────────────────────────────
function BudgetTable({ breakdown, skillBlocks = [] }) {
    if (!breakdown?.breakdown?.length) return null;
    const [expandedSkills, setExpandedSkills] = useState({});
    
    return (
        <div className="space-y-3">
            {breakdown.breakdown.map((b, bi) => {
                const count = b.count || 1;
                const perWorker = count > 1 ? Math.round(b.subtotal / count) : b.subtotal;
                const isExpanded = expandedSkills[b.skill] || false;
                
                return (
                    <div key={bi} className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-gray-800 text-sm capitalize">{b.skill}</span>
                                <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                                    {count} worker{count > 1 ? 's' : ''}
                                </span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                    b.complexity === 'heavy' ? 'bg-red-100 text-red-600' :
                                    b.complexity === 'normal' ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'
                                }`}>
                                    {b.complexity}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400">{b.hours}h total</span>
                                {count > 2 && (
                                    <button
                                        onClick={() => setExpandedSkills(prev => ({ ...prev, [b.skill]: !prev[b.skill] }))}
                                        className="text-gray-400 hover:text-orange-500"
                                    >
                                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>
                                )}
                            </div>
                        </div>

                        <AnimatePresence>
                            {(isExpanded || count <= 2) && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                >
                                    {Array.from({ length: Math.min(count, isExpanded ? count : 2) }).map((_, wi) => (
                                        <div key={wi} className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-gray-50 last:border-0 bg-white">
                                            <span className="text-xs sm:text-sm text-gray-600 capitalize">
                                                {b.skill} Worker {count > 1 ? wi + 1 : ''}
                                            </span>
                                            <span className="text-xs sm:text-sm font-semibold text-gray-800">₹{perWorker.toLocaleString()}</span>
                                        </div>
                                    ))}
                                    {!isExpanded && count > 2 && (
                                        <div className="px-3 sm:px-4 py-2 bg-gray-50 text-center text-[10px] text-gray-500">
                                            +{count - 2} more workers
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="flex justify-between px-3 sm:px-4 py-2.5 bg-orange-50">
                            <span className="text-xs sm:text-sm font-bold text-gray-700 capitalize">
                                {b.skill} total ({count} worker{count > 1 ? 's' : ''})
                            </span>
                            <span className="font-bold text-orange-700 text-sm">₹{b.subtotal?.toLocaleString()}</span>
                        </div>
                    </div>
                );
            })}

            {breakdown.urgent && (
                <div className="flex justify-between px-3 sm:px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-xl">
                    <span className="text-xs sm:text-sm text-orange-600">Urgency surcharge (+{Math.round((breakdown.urgencyMult - 1) * 100)}%)</span>
                    <span className="font-semibold text-orange-600 text-sm">+₹{(breakdown.totalEstimated - breakdown.subtotal)?.toLocaleString()}</span>
                </div>
            )}

            <div className="flex justify-between px-3 sm:px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl">
                <span className="text-white font-bold text-sm">Total Estimated</span>
                <span className="text-white font-bold text-base sm:text-lg">₹{breakdown.totalEstimated?.toLocaleString()}</span>
            </div>
        </div>
    );
}

// ── Work flow display (Mobile Optimized) ─────────────────────────────────────────
function WorkFlowSuggestion({ skillBlocks }) {
    const phases = generateWorkFlow(skillBlocks || []);
    if (!phases.length || skillBlocks?.length <= 1) return null;
    return (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">📋 Suggested Work Flow</p>
            <div className="space-y-2.5">
                {phases.map((phase, i) => (
                    <div key={i} className="flex items-start gap-2 sm:gap-3">
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-orange-500 text-white text-[10px] sm:text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                            {phase.step}
                        </div>
                        <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                {phase.skills.map((sk, si) => (
                                    <span key={si} className="text-[10px] sm:text-xs bg-white border border-blue-200 text-blue-700 px-2 sm:px-2.5 py-0.5 rounded-full font-semibold capitalize">
                                        {sk}
                                    </span>
                                ))}
                                <span className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-medium ${
                                    phase.type === 'parallel' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                    {phase.type === 'parallel' ? '⟳ Parallel' : '→ Sequential'}
                                </span>
                            </div>
                            {phase.note && <p className="text-[10px] text-blue-500 mt-0.5">{phase.note}</p>}
                        </div>
                    </div>
                ))}
            </div>
            <p className="text-[9px] sm:text-xs text-blue-400 mt-3">Suggestion based on work dependencies. Adjust as needed.</p>
        </div>
    );
}

// Leaflet map (Mobile Optimized)
function MapPicker({ lat, lng, onPick }) {
    const cRef = useRef(null); const mapRef = useRef(null); const mRef = useRef(null);
    const [ready, setReady] = useState(false);
    useEffect(() => {
        let alive = true;
        loadLeaflet().then(L => {
            if (!L || !cRef.current || mapRef.current || !alive) return;
            const il = lat || 18.5204, ilng = lng || 73.8567;
            const map = L.map(cRef.current).setView([il, ilng], 14);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
            const icon = L.divIcon({
                className: '',
                html: `<div style="width:20px;height:20px;background:#f97316;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3)"></div>`,
                iconSize: [20, 20], iconAnchor: [10, 20]
            });
            const marker = L.marker([il, ilng], { icon, draggable: true }).addTo(map);
            marker.on('dragend', () => { const p = marker.getLatLng(); onPick(p.lat, p.lng); });
            map.on('click', e => { marker.setLatLng(e.latlng); onPick(e.latlng.lat, e.latlng.lng); });
            mapRef.current = map; mRef.current = marker; setReady(true);
        });
        return () => { alive = false; };
    }, []);
    useEffect(() => {
        if (!ready || !mRef.current || !lat || !lng) return;
        mRef.current.setLatLng([lat, lng]);
        mapRef.current.setView([lat, lng], 15);
    }, [lat, lng, ready]);
    return (
        <div className="relative rounded-xl overflow-hidden border-2 border-gray-200" style={{ height: 200, minHeight: 200 }}>
            <div ref={cRef} className="w-full h-full" />
            {!ready && (
                <div className="absolute inset-0 bg-gray-50 flex items-center justify-center z-10">
                    <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                </div>
            )}
        </div>
    );
}

function PRow({ label, value, vc = '' }) {
    if (!value && value !== 0) return null;
    return (
        <div className="flex flex-wrap items-start gap-2 py-2 border-b border-gray-50 last:border-0">
            <span className="text-[10px] sm:text-xs text-gray-400 font-medium w-24 sm:w-28 flex-shrink-0">{label}</span>
            <span className={`text-xs sm:text-sm text-gray-800 flex-1 break-words ${vc}`}>{value}</span>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ClientJobPost() {
    const [step, setStep] = useState(0);
    const [description, setDescription] = useState('');
    const [city, setCity] = useState('');
    const [urgent, setUrgent] = useState(false);
    const [loadingQ, setLoadingQ] = useState(false);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [loadingE, setLoadingE] = useState(false);
    const [estimate, setEstimate] = useState(null);
    const [editableSkills, setEditableSkills] = useState([]);
    const [newSkillInput, setNewSkillInput] = useState('');
    const [skillsChanged, setSkillsChanged] = useState(false);
    const [workerCountChanged, setWorkerCountChanged] = useState(false);
    const [recalcLoading, setRecalcLoading] = useState(false);
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [experienceRequired, setExperienceRequired] = useState('');
    const [duration, setDuration] = useState('');
    const [workersRequired, setWorkersRequired] = useState(1);
    const [customBudget, setCustomBudget] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('flexible');
    const [negotiable, setNegotiable] = useState(false);
    const [minBudget, setMinBudget] = useState('');
    const [scheduledDate, setScheduledDate] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [shift, setShift] = useState('');
    const [scheduleError, setScheduleError] = useState('');
    const [location, setLocation] = useState({ city: '', locality: '', pincode: '', fullAddress: '', lat: null, lng: null });
    const [geoLoading, setGeoLoading] = useState(false);
    const [geoError, setGeoError] = useState('');
    const [photos, setPhotos] = useState([]);
    const photoRef = useRef();
    const [posting, setPosting] = useState(false);
    const [showCostBreakdown, setShowCostBreakdown] = useState(true);
    const [showWorkFlow, setShowWorkFlow] = useState(true);

    const setAnswer = (id, val) => setAnswers(p => ({ ...p, [id]: val }));
    useEffect(() => { if (scheduledTime) setShift(detectShift(scheduledTime)); }, [scheduledTime]);
    useEffect(() => { if (city && !location.city) setLocation(l => ({ ...l, city })); }, [city]);

    const removeSkill = (idx) => {
        setEditableSkills(s => s.filter((_, i) => i !== idx));
        setSkillsChanged(true);
    };
    const addSkill = () => {
        const sk = newSkillInput.trim().toLowerCase();
        if (!sk) return toast.error('Enter a skill name.');
        if (editableSkills.includes(sk)) return toast.error('Already added.');
        setEditableSkills(s => [...s, sk]);
        setNewSkillInput('');
        setSkillsChanged(true);
    };

    const handleRecalculate = async () => {
        try {
            setRecalcLoading(true);
            const answersText = {};
            questions.forEach(q => { if (answers[q.id]) answersText[q.question] = answers[q.id]; });
            const newDesc = `${description} (Required skills: ${editableSkills.join(', ')})`;
            const { data } = await aiGenerateEstimate({ workDescription: newDesc, answers: answersText, city, urgent, workerCountOverride: workersRequired });
            setEstimate(data);
            const total = data.budgetBreakdown?.totalEstimated || 0;
            setCustomBudget(String(total));
            setMinBudget(String(Math.round(total * 0.8)));
            if (!workerCountChanged && data.budgetBreakdown?.totalWorkers) setWorkersRequired(data.budgetBreakdown.totalWorkers);
            setSkillsChanged(false);
            setWorkerCountChanged(false);
            toast.success('Cost estimate recalculated!');
        } catch {
            toast.error('Recalculation failed.');
        } finally { setRecalcLoading(false); }
    };

    const reverseGeocode = useCallback(async (lat, lng) => {
        try {
            const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: { 'Accept-Language': 'en' } });
            const g = await r.json(); const a = g.address || {};
            setLocation({ lat, lng, locality: a.suburb || a.neighbourhood || '', city: a.city || a.town || a.county || city || '', pincode: a.postcode || '', fullAddress: g.display_name || '' });
            toast.success('Location detected!');
        } catch { setLocation(l => ({ ...l, lat, lng })); toast.success('Coordinates set. Fill address manually.'); }
    }, [city]);

    const handleMapPick = useCallback((lat, lng) => { reverseGeocode(lat, lng); }, [reverseGeocode]);

    const handleGeolocate = () => {
        setGeoError('');
        if (!navigator.geolocation) { setGeoError('Geolocation not supported.'); return; }
        setGeoLoading(true);
        navigator.geolocation.getCurrentPosition(
            pos => { reverseGeocode(pos.coords.latitude, pos.coords.longitude).finally(() => setGeoLoading(false)); },
            err => {
                setGeoLoading(false);
                const msg = err.code === 1 ? 'Location access denied.' : 'Could not get location.';
                setGeoError(msg);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const go0to1 = async () => {
        if (!description.trim()) return toast.error('Please describe the work.');
        try {
            setLoadingQ(true);
            const { data } = await aiGenerateQuestions({ workDescription: description, city });
            setQuestions(normalizeQuestions(data?.questions));
            setStep(1);
        } catch {
            toast.error('Could not generate questions.');
            setQuestions([]);
            setStep(1);
        }
        finally { setLoadingQ(false); }
    };

    const go1to2 = async () => {
        try {
            setLoadingE(true);
            const at = {}; questions.forEach(q => { if (answers[q.id]) at[q.question] = answers[q.id]; });
            const { data } = await aiGenerateEstimate({ workDescription: description, answers: at, city, urgent });
            setEstimate(data);
            const aiSkills = (data.skillBlocks || []).map(b => b.skill).filter(Boolean);
            setEditableSkills(aiSkills);
            setSkillsChanged(false);
            setWorkerCountChanged(false);
            const total = data.budgetBreakdown?.totalEstimated || 0;
            setCustomBudget(String(total)); setMinBudget(String(Math.round(total * 0.8)));
            if (!title) setTitle(data.jobTitle || description.slice(0, 60).trim());
            if (!duration && data.durationDays) setDuration(`${data.durationDays} day${data.durationDays > 1 ? 's' : ''}`);
            if (data.budgetBreakdown?.totalWorkers) setWorkersRequired(data.budgetBreakdown.totalWorkers);
            setStep(2);
        } catch { toast.error('Estimate failed. Fill manually.'); setEditableSkills([]); setStep(2); }
        finally { setLoadingE(false); }
    };

    const go2to3 = () => {
        if (!title.trim()) return toast.error('Job title required.');
        if (!customBudget || Number(customBudget) < 0) return toast.error('Please set a valid budget.');
        if (negotiable && (!minBudget || Number(minBudget) >= Number(customBudget))) {
            return toast.error('Minimum budget must be less than your offer.');
        }
        setStep(3);
    };

    const WORK_START_MINS = 360;
    const WORK_END_MINS = 1260;
    const toMins = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };

    const go3to4 = () => {
        setScheduleError('');
        if (!scheduledDate) return setScheduleError('Please select a date.');
        if (!scheduledTime) return setScheduleError('Please select a start time.');

        const selDate = new Date(scheduledDate + 'T00:00:00');
        const today = new Date(); today.setHours(0, 0, 0, 0);
        if (selDate < today) return setScheduleError('Date cannot be in the past.');

        const startMins = toMins(scheduledTime);
        if (startMins < WORK_START_MINS || startMins > WORK_END_MINS) {
            return setScheduleError('Work time must be between 6:00 AM and 9:00 PM.');
        }

        const [h, m] = scheduledTime.split(':').map(Number);
        const sched = new Date(scheduledDate + 'T00:00:00');
        sched.setHours(h, m, 0, 0);
        const minsUntil = (sched.getTime() - Date.now()) / 60000;
        if (minsUntil < 50) {
            return setScheduleError(`Scheduled time must be at least 50 minutes from now. Please choose a later time.`);
        }

        setStep(4);
    };

    const go4to5 = () => { if (!location.city) return toast.error('Please enter your city.'); setStep(5); };

    const handlePost = async () => {
        if (!title.trim()) return toast.error('Title required.');
        if (!customBudget || Number(customBudget) <= 0) return toast.error('Budget required.');
        if (!location.city) return toast.error('City required.');
        if (!scheduledDate) return toast.error('Date required.');
        try {
            setPosting(true);
            const qaRecord = questions.map(q => ({ question: q.question, answer: answers[q.id] || '' })).filter(x => x.answer);
            const fd = new FormData();
            fd.append('title', title.trim());
            fd.append('category', category);
            fd.append('experienceRequired', experienceRequired);
            fd.append('description', description);
            fd.append('shortDescription', description.slice(0, 150));
            fd.append('detailedDescription', description);
            fd.append('skills', JSON.stringify(editableSkills));
            fd.append('payment', String(ensureNonNeg(customBudget)));
            fd.append('paymentMethod', paymentMethod);
            fd.append('negotiable', String(negotiable));
            fd.append('minBudget', negotiable ? String(ensureNonNeg(minBudget)) : '0');
            fd.append('duration', duration);
            fd.append('workersRequired', String(Math.max(1, ensureNonNeg(workersRequired, 1))));
            fd.append('location', JSON.stringify(location));
            fd.append('scheduledDate', scheduledDate);
            fd.append('scheduledTime', scheduledTime);
            fd.append('shift', shift);
            fd.append('urgent', String(urgent));
            fd.append('qaAnswers', JSON.stringify(qaRecord));
            if (estimate?.budgetBreakdown) fd.append('budgetBreakdown', JSON.stringify(estimate.budgetBreakdown));
            fd.append('totalEstimatedCost', String(estimate?.budgetBreakdown?.totalEstimated || ensureNonNeg(customBudget)));
            photos.forEach(f => fd.append('photos', f));
            await postJob(fd);
            toast.success('Job posted! 🎉');
            // Reset
            setStep(0); setDescription(''); setCity(''); setUrgent(false);
            setQuestions([]); setAnswers({}); setEstimate(null); setEditableSkills([]);
            setTitle(''); setDuration(''); setCustomBudget(''); setMinBudget('');
            setCategory(''); setExperienceRequired('');
            setPaymentMethod('flexible');
            setNegotiable(false); setWorkersRequired(1);
            setScheduledDate(''); setScheduledTime(''); setShift('');
            setLocation({ city: '', locality: '', pincode: '', fullAddress: '', lat: null, lng: null });
            setPhotos([]);
        } catch (err) { toast.error(err?.response?.data?.message || 'Failed to post.'); }
        finally { setPosting(false); }
    };

    // ── RENDER ─────────────────────────────────────────────────────────────────
    return (
        <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-28">
            <div className="mb-4 sm:mb-6">
                <h1 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                    Post a New Job
                </h1>
                <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">
                    Step {step + 1} of {STEPS.length} — {STEPS[step].label}
                </p>
            </div>
            <StepBar current={step} />

            {/* STEP 0 — DESCRIBE */}
            {step === 0 && (
                <div className="space-y-4 sm:space-y-5">
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 sm:p-4 text-xs sm:text-sm text-orange-700">
                        💡 Be specific — mention area size, rooms, current issues
                    </div>
                    <div>
                        <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                            Work Description <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            rows={5}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="E.g., Complete bathroom renovation — replace floor tiles, fix leaking pipe, repaint walls..."
                            className="w-full border-2 border-gray-200 rounded-xl p-3 sm:p-4 text-sm focus:outline-none focus:border-orange-400 resize-none transition-colors"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">{description.length} chars</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">City</label>
                            <input
                                value={city}
                                onChange={e => setCity(e.target.value)}
                                placeholder="Pune, Mumbai…"
                                className="w-full border-2 border-gray-200 rounded-xl px-3 sm:px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Priority</label>
                            <button
                                type="button"
                                onClick={() => setUrgent(u => !u)}
                                className={`w-full py-2.5 rounded-xl text-sm font-bold border-2 transition-all active:scale-95 ${
                                    urgent ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-400 hover:border-orange-200'
                                }`}
                            >
                                {urgent ? '⚡ Urgent (+25%)' : '🕐 Normal'}
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={go0to1}
                        disabled={loadingQ || !description.trim()}
                        className="w-full py-3 sm:py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl transition-all disabled:opacity-60 shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base active:scale-95"
                    >
                        {loadingQ ? (
                            <><Loader2 size={16} className="animate-spin" /> Analysing…</>
                        ) : (
                            <><Sparkles size={16} /> Get AI Questions →</>
                        )}
                    </button>
                    <button
                        onClick={() => { setQuestions([]); setEstimate(null); setEditableSkills([]); setStep(2); }}
                        className="w-full py-2 text-[10px] sm:text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        Skip AI — enter manually
                    </button>
                </div>
            )}

            {/* STEP 1 — QUESTIONS */}
            {step === 1 && (
                <div className="space-y-4 sm:space-y-5">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 sm:p-4 flex gap-2 sm:gap-3">
                        <span className="text-xl">🤔</span>
                        <div>
                            <p className="text-xs sm:text-sm font-bold text-blue-800">Clarifying Questions</p>
                            <p className="text-[10px] sm:text-xs text-blue-500 mt-0.5">Answers improve cost accuracy</p>
                        </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3">
                        <p className="text-[10px] text-gray-400 mb-0.5">Your request</p>
                        <p className="text-xs sm:text-sm text-gray-700 line-clamp-2">{description}</p>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                            {city && <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">📍 {city}</span>}
                            {urgent && <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">⚡ Urgent</span>}
                        </div>
                    </div>
                    {questions.length === 0 ? (
                        <p className="text-xs sm:text-sm text-gray-400 text-center py-4">No clarifications needed.</p>
                    ) : (
                        <div className="space-y-4">{questions.map(q => <QWidget key={q.id} q={q} value={answers[q.id]} onChange={setAnswer} />)}</div>
                    )}
                    <div className="flex gap-3">
                        <button
                            onClick={() => setStep(0)}
                            className="px-4 sm:px-5 py-2.5 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-semibold text-xs sm:text-sm active:scale-95"
                        >
                            ← Back
                        </button>
                        <button
                            onClick={go1to2}
                            disabled={loadingE}
                            className="flex-1 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl disabled:opacity-60 flex items-center justify-center gap-2 text-xs sm:text-sm active:scale-95"
                        >
                            {loadingE ? (
                                <><Loader2 size={14} className="animate-spin" /> Calculating…</>
                            ) : (
                                <><DollarSign size={14} /> Get Cost Estimate →</>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 2 — BUDGET + SKILLS + WORK FLOW */}
            {step === 2 && (
                <div className="space-y-4 sm:space-y-5">
                    <div>
                        <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Job Title <span className="text-red-500">*</span></label>
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="E.g., Bathroom Renovation — Pune"
                            className="w-full border-2 border-gray-200 rounded-xl px-3 sm:px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Job Category</label>
                            <select
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                                className="w-full border-2 border-gray-200 rounded-xl px-3 sm:px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 bg-white"
                            >
                                <option value="">Select category</option>
                                <option value="home_renovation">Home Renovation</option>
                                <option value="repair_maintenance">Repair & Maintenance</option>
                                <option value="electrical">Electrical Work</option>
                                <option value="plumbing">Plumbing</option>
                                <option value="painting">Painting</option>
                                <option value="cleaning">Cleaning</option>
                                <option value="furniture">Furniture Work</option>
                                <option value="construction">Construction</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Experience Needed</label>
                            <select
                                value={experienceRequired}
                                onChange={e => setExperienceRequired(e.target.value)}
                                className="w-full border-2 border-gray-200 rounded-xl px-3 sm:px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 bg-white"
                            >
                                <option value="">Not specified</option>
                                <option value="0-1 years">0-1 years</option>
                                <option value="1-3 years">1-3 years</option>
                                <option value="3-5 years">3-5 years</option>
                                <option value="5+ years">5+ years</option>
                            </select>
                        </div>
                    </div>

                    {/* Skill editor */}
                    <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <label className="text-xs sm:text-sm font-semibold text-gray-700">Skills Required</label>
                            {(skillsChanged || workerCountChanged) && (
                                <button
                                    onClick={handleRecalculate}
                                    disabled={recalcLoading}
                                    className="text-[10px] sm:text-xs bg-orange-500 hover:bg-orange-600 text-white px-2 sm:px-3 py-1.5 rounded-lg font-bold transition-colors disabled:opacity-60 flex items-center gap-1 active:scale-95"
                                >
                                    {recalcLoading ? (
                                        <><Loader2 size={10} className="animate-spin" /> Recalc…</>
                                    ) : (
                                        <><RefreshCw size={10} /> Recalculate</>
                                    )}
                                </button>
                            )}
                        </div>
                        {(skillsChanged || workerCountChanged) && !recalcLoading && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl px-2 sm:px-3 py-2 mb-3 text-[10px] text-amber-700 font-medium">
                                ⚡ Skills or worker count changed — click Recalculate
                            </div>
                        )}
                        <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-2 sm:p-3">
                            <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                                {editableSkills.length === 0 && <span className="text-[10px] text-gray-400 py-1">No skills added yet</span>}
                                {editableSkills.map((sk, i) => (
                                    <div key={i} className="flex items-center gap-1 bg-orange-100 text-orange-700 px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold">
                                        <span className="capitalize">{sk}</span>
                                        <button type="button" onClick={() => removeSkill(i)} className="text-orange-400 hover:text-red-500 font-bold text-xs leading-none">×</button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2 mt-2 pt-2 border-t border-gray-200">
                                <input
                                    value={newSkillInput}
                                    onChange={e => setNewSkillInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                                    placeholder="Add skill (e.g., carpenter)…"
                                    className="flex-1 border-2 border-gray-200 rounded-lg px-2 sm:px-3 py-1.5 text-xs focus:outline-none focus:border-orange-400"
                                />
                                <button
                                    type="button"
                                    onClick={addSkill}
                                    className="px-2 sm:px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[10px] sm:text-xs font-bold transition-colors active:scale-95"
                                >
                                    + Add
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Budget breakdown toggle */}
                    {estimate?.budgetBreakdown?.breakdown?.length > 0 && (
                        <div>
                            <button
                                onClick={() => setShowCostBreakdown(!showCostBreakdown)}
                                className="w-full flex items-center justify-between py-2 text-left"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Cost Breakdown</span>
                                    {estimate.budgetBreakdown.urgent && <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">⚡ Urgent</span>}
                                </div>
                                {showCostBreakdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            <AnimatePresence>
                                {showCostBreakdown && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <BudgetTable breakdown={estimate.budgetBreakdown} skillBlocks={estimate.skillBlocks} />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    {/* Work flow suggestion toggle */}
                    {estimate?.skillBlocks && estimate.skillBlocks.length > 1 && (
                        <div>
                            <button
                                onClick={() => setShowWorkFlow(!showWorkFlow)}
                                className="w-full flex items-center justify-between py-2 text-left"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Work Flow</span>
                                </div>
                                {showWorkFlow ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            <AnimatePresence>
                                {showWorkFlow && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <WorkFlowSuggestion skillBlocks={estimate.skillBlocks} />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    {/* Duration + Workers */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Duration</label>
                            <input
                                value={duration}
                                onChange={e => setDuration(e.target.value)}
                                placeholder="e.g., 2 days"
                                className="w-full border-2 border-gray-200 rounded-xl px-3 sm:px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Workers Needed</label>
                            <input
                                type="number"
                                min={1}
                                max={20}
                                value={workersRequired}
                                onChange={e => { const v = Number(e.target.value); if (v < 1) return; setWorkersRequired(v); setWorkerCountChanged(true); }}
                                className="w-full border-2 border-gray-200 rounded-xl px-3 sm:px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                            />
                        </div>
                    </div>

                    {/* Your offer */}
                    <div>
                        <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Your Budget Offer (₹) <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm sm:text-base">₹</span>
                            <input
                                type="number"
                                min={0}
                                value={customBudget}
                                onChange={e => { if (Number(e.target.value) < 0) return; setCustomBudget(e.target.value); }}
                                className="w-full pl-7 sm:pl-9 pr-3 sm:pr-4 py-2.5 sm:py-3 border-2 border-orange-300 focus:border-orange-500 rounded-xl text-base sm:text-xl font-black focus:outline-none bg-white transition-colors"
                            />
                        </div>
                        {estimate?.budgetBreakdown?.totalEstimated && (
                            <p className="text-[10px] text-gray-400 mt-1">AI suggested: ₹{estimate.budgetBreakdown.totalEstimated.toLocaleString()}</p>
                        )}
                    </div>

                    {/* Negotiable */}
                    <div className="border-2 border-gray-100 rounded-xl p-3 sm:p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-gray-800 text-xs sm:text-sm">Allow Negotiation</p>
                                <p className="text-[10px] text-gray-400">Workers can counter-offer</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setNegotiable(n => !n)}
                                className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center rounded-full transition-colors ${negotiable ? 'bg-orange-500' : 'bg-gray-200'}`}
                            >
                                <span className={`inline-block h-3 w-3 sm:h-4 sm:w-4 transform rounded-full bg-white shadow transition-transform ${negotiable ? 'translate-x-5 sm:translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        <AnimatePresence>
                            {negotiable && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-3 pt-3 border-t border-gray-100"
                                >
                                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Minimum Budget <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                                        <input
                                            type="number"
                                            min={0}
                                            value={minBudget}
                                            onChange={e => { if (Number(e.target.value) < 0) return; setMinBudget(e.target.value); }}
                                            placeholder="Min acceptable"
                                            className="w-full pl-7 border-2 border-gray-200 rounded-xl py-2 text-xs sm:text-sm font-bold focus:outline-none focus:border-orange-400"
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Payment method */}
                    <div>
                        <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Payment Method</label>
                        <select
                            value={paymentMethod}
                            onChange={e => setPaymentMethod(e.target.value)}
                            className="w-full border-2 border-gray-200 rounded-xl px-3 sm:px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 bg-white"
                        >
                            {PAYMENT_METHODS.map((method) => (
                                <option key={method.value} value={method.value}>{method.label}</option>
                            ))}
                        </select>
                    </div>

                    {estimate?.recommendation && (
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs sm:text-sm text-amber-700 flex gap-2">
                            <span>💡</span>
                            <p>{estimate.recommendation}</p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={() => setStep(questions.length > 0 ? 1 : 0)}
                            className="px-4 sm:px-5 py-2.5 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-semibold text-xs sm:text-sm active:scale-95"
                        >
                            ← Back
                        </button>
                        <button
                            onClick={go2to3}
                            className="flex-1 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl text-xs sm:text-sm active:scale-95"
                        >
                            Next: Schedule →
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 3 — SCHEDULE */}
            {step === 3 && (
                <div className="space-y-4 sm:space-y-5">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-[10px] sm:text-xs text-blue-600">
                        ⏰ Work must be scheduled at least 50 minutes from now, between 6:00 AM and 9:00 PM
                    </div>
                    <div>
                        <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Work Date <span className="text-red-500">*</span></label>
                        <input
                            type="date"
                            min={todayStr()}
                            value={scheduledDate}
                            onChange={e => { setScheduledDate(e.target.value); setScheduleError(''); }}
                            className="w-full border-2 border-gray-200 rounded-xl px-3 sm:px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                        />
                    </div>
                    <div>
                        <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Start Time <span className="text-red-500">*</span></label>
                        <input
                            type="time"
                            value={scheduledTime}
                            onChange={e => { setScheduledTime(e.target.value); setScheduleError(''); }}
                            className="w-full border-2 border-gray-200 rounded-xl px-3 sm:px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                        />
                    </div>

                    {scheduleError && (
                        <div className="bg-red-50 border border-red-200 rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm text-red-600 flex gap-2">
                            <AlertCircle size={14} /> {scheduleError}
                        </div>
                    )}

                    {shift && (
                        <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3">
                            <span className="text-xl">{shiftIcon(shift)}</span>
                            <div>
                                <p className="text-[10px] text-blue-400 font-medium">Shift Detected</p>
                                <p className="text-xs sm:text-sm font-bold text-blue-800">{shift}</p>
                            </div>
                        </div>
                    )}

                    <div className="bg-green-50 border border-green-100 rounded-xl px-3 sm:px-4 py-2.5">
                        <p className="text-[10px] text-green-700 font-medium">🚀 Auto-Start: Job will automatically start at the scheduled time.</p>
                    </div>

                    {scheduledDate && scheduledTime && (
                        <div className="bg-gray-50 rounded-xl px-3 sm:px-4 py-2.5">
                            <p className="text-xs sm:text-sm font-bold text-gray-800">
                                {new Date(scheduledDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                                at {scheduledTime}{duration ? ` · ${duration}` : ''}
                            </p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={() => setStep(2)}
                            className="px-4 sm:px-5 py-2.5 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-semibold text-xs sm:text-sm active:scale-95"
                        >
                            ← Back
                        </button>
                        <button
                            onClick={go3to4}
                            className="flex-1 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl text-xs sm:text-sm active:scale-95"
                        >
                            Next: Location →
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 4 — LOCATION */}
            {step === 4 && (
                <div className="space-y-4 sm:space-y-5">
                    <button
                        onClick={handleGeolocate}
                        disabled={geoLoading}
                        className="w-full py-2.5 border-2 border-orange-200 text-orange-600 rounded-xl hover:bg-orange-50 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all active:scale-95"
                    >
                        {geoLoading ? (
                            <><Loader2 size={14} className="animate-spin" /> Detecting…</>
                        ) : (
                            <><MapPin size={14} /> Use My Live Location</>
                        )}
                    </button>
                    {geoError && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-xs text-red-600">⚠️ {geoError}</div>
                    )}
                    <MapPicker lat={location.lat} lng={location.lng} onPick={handleMapPick} />
                    <p className="text-[10px] text-gray-400 text-center">Tap map or drag marker</p>
                    {location.lat && location.lng && (
                        <div className="bg-gray-50 rounded-xl px-3 py-2 text-[10px] font-mono text-gray-600 break-all">
                            📌 {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                        </div>
                    )}
                    <div className="space-y-3">
                        <input
                            value={location.fullAddress}
                            onChange={e => setLocation(l => ({ ...l, fullAddress: e.target.value }))}
                            placeholder="Full address / landmark…"
                            className="w-full border-2 border-gray-200 rounded-xl px-3 sm:px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                value={location.locality}
                                onChange={e => setLocation(l => ({ ...l, locality: e.target.value }))}
                                placeholder="Area"
                                className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                            />
                            <input
                                value={location.city}
                                onChange={e => setLocation(l => ({ ...l, city: e.target.value }))}
                                placeholder="City *"
                                className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                            />
                            <input
                                value={location.pincode}
                                onChange={e => setLocation(l => ({ ...l, pincode: e.target.value }))}
                                placeholder="Pincode"
                                className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                            />
                            <div className="col-span-2 grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] text-gray-400 block mb-1">Latitude</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={location.lat || ''}
                                        onChange={e => setLocation(l => ({ ...l, lat: parseFloat(e.target.value) || null }))}
                                        placeholder="18.52045"
                                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-orange-400"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-400 block mb-1">Longitude</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={location.lng || ''}
                                        onChange={e => setLocation(l => ({ ...l, lng: parseFloat(e.target.value) || null }))}
                                        placeholder="73.85674"
                                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-orange-400"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setStep(3)}
                            className="px-4 sm:px-5 py-2.5 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-semibold text-xs sm:text-sm active:scale-95"
                        >
                            ← Back
                        </button>
                        <button
                            onClick={go4to5}
                            className="flex-1 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl text-xs sm:text-sm active:scale-95"
                        >
                            Next: Photos →
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 5 — PHOTOS */}
            {step === 5 && (
                <div className="space-y-4 sm:space-y-5">
                    <input ref={photoRef} type="file" multiple accept="image/*" className="hidden" onChange={e => setPhotos(Array.from(e.target.files))} />
                    <div
                        onClick={() => photoRef.current?.click()}
                        className="border-2 border-dashed border-gray-200 rounded-xl p-6 sm:p-8 text-center cursor-pointer hover:border-orange-300 hover:bg-orange-50/20 transition-all"
                    >
                        {photos.length > 0 ? (
                            <>
                                <div className="flex flex-wrap gap-2 justify-center mb-3">
                                    {photos.slice(0, 4).map((f, i) => (
                                        <img key={i} src={URL.createObjectURL(f)} alt="" className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg shadow-sm" />
                                    ))}
                                    {photos.length > 4 && (
                                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500">
                                            +{photos.length - 4}
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs sm:text-sm font-semibold text-gray-500">{photos.length} photo{photos.length > 1 ? 's' : ''} · tap to change</p>
                            </>
                        ) : (
                            <>
                                <div className="text-4xl mb-2">🖼️</div>
                                <p className="text-xs sm:text-sm font-bold text-gray-500">Tap to add photos</p>
                                <p className="text-[10px] text-gray-400 mt-1">Optional · JPG, PNG</p>
                            </>
                        )}
                    </div>
                    {photos.length > 0 && (
                        <button
                            onClick={() => setPhotos([])}
                            className="w-full text-[10px] text-red-400 hover:text-red-600 py-1 transition-colors"
                        >
                            Remove all photos
                        </button>
                    )}
                    <div className="flex gap-3">
                        <button
                            onClick={() => setStep(4)}
                            className="px-4 sm:px-5 py-2.5 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-semibold text-xs sm:text-sm active:scale-95"
                        >
                            ← Back
                        </button>
                        <button
                            onClick={() => setStep(6)}
                            className="flex-1 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl text-xs sm:text-sm active:scale-95"
                        >
                            {photos.length > 0 ? `Preview (${photos.length} photos) →` : 'Skip → Preview'}
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 6 — PREVIEW */}
            {step === 6 && (
                <div className="space-y-4 sm:space-y-5">
                    <div className="bg-white border-2 border-gray-100 rounded-xl overflow-hidden">
                        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-4 sm:px-5 py-3 sm:py-4">
                            <h3 className="text-white font-black text-base sm:text-lg">{title || 'Untitled'}</h3>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {urgent && <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">⚡ Urgent</span>}
                                {negotiable && <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">🤝 Negotiable</span>}
                                {shift && <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">{shiftIcon(shift)} {shift.split('(')[0].trim()}</span>}
                                <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">👥 {workersRequired} workers</span>
                            </div>
                        </div>
                        <div className="px-4 sm:px-5 py-3 sm:py-4 divide-y divide-gray-50">
                            <PRow label="Description" value={description.slice(0, 150) + (description.length > 150 ? '…' : '')} />
                            <PRow label="Category" value={category || 'Not specified'} />
                            <PRow label="Experience" value={experienceRequired || 'Not specified'} />
                            <PRow label="Budget" value={`₹${Number(customBudget).toLocaleString()}${negotiable ? ` (Min ₹${Number(minBudget).toLocaleString()})` : ' · Fixed'}`} vc="text-green-600 font-bold" />
                            <PRow label="Payment Method" value={paymentMethodLabel(paymentMethod)} />
                            <PRow label="Duration" value={duration} />
                            <PRow label="Date" value={scheduledDate ? new Date(scheduledDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''} />
                            <PRow label="Start Time" value={scheduledTime} />
                            <PRow label="Shift" value={shift} />
                            <PRow label="City" value={location.city} />
                            <PRow label="Address" value={[location.locality, location.city, location.pincode].filter(Boolean).join(', ')} />
                        </div>
                    </div>

                    {editableSkills.length > 0 && (
                        <div className="bg-white border-2 border-gray-100 rounded-xl px-4 sm:px-5 py-3 sm:py-4">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Skills Required</p>
                            <div className="flex flex-wrap gap-1.5">
                                {editableSkills.map((s, i) => (
                                    <span key={i} className="text-[10px] bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-bold capitalize">{s}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {estimate?.budgetBreakdown?.breakdown?.length > 0 && (
                        <div className="bg-white border-2 border-gray-100 rounded-xl px-4 sm:px-5 py-3 sm:py-4">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Cost Breakdown</p>
                            <BudgetTable breakdown={estimate.budgetBreakdown} skillBlocks={estimate.skillBlocks} />
                        </div>
                    )}

                    {estimate?.skillBlocks && estimate.skillBlocks.length > 1 && (
                        <div className="bg-white border-2 border-gray-100 rounded-xl px-4 sm:px-5 py-3 sm:py-4">
                            <WorkFlowSuggestion skillBlocks={estimate.skillBlocks} />
                        </div>
                    )}

                    {questions.filter(q => answers[q.id]).length > 0 && (
                        <div className="bg-white border-2 border-gray-100 rounded-xl px-4 sm:px-5 py-3 sm:py-4">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Your Answers</p>
                            <div className="space-y-2">
                                {questions.filter(q => answers[q.id]).slice(0, 3).map(q => (
                                    <div key={q.id} className="flex flex-wrap items-start gap-2">
                                        <span className="text-[10px] text-gray-400 flex-1">{q.question}</span>
                                        <span className="text-[10px] font-bold text-gray-700 break-words max-w-[50%]">{answers[q.id]}</span>
                                    </div>
                                ))}
                                {questions.filter(q => answers[q.id]).length > 3 && (
                                    <p className="text-[9px] text-gray-400 text-center">+{questions.filter(q => answers[q.id]).length - 3} more</p>
                                )}
                            </div>
                        </div>
                    )}

                    {photos.length > 0 && (
                        <div className="bg-white border-2 border-gray-100 rounded-xl px-4 sm:px-5 py-3 sm:py-4">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">{photos.length} Work Photo{photos.length > 1 ? 's' : ''}</p>
                            <div className="flex flex-wrap gap-2">
                                {photos.slice(0, 4).map((f, i) => (
                                    <img key={i} src={URL.createObjectURL(f)} alt="" className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg shadow-sm" />
                                ))}
                                {photos.length > 4 && (
                                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500">
                                        +{photos.length - 4}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={() => setStep(5)}
                            className="px-4 sm:px-5 py-2.5 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-semibold text-xs sm:text-sm active:scale-95"
                        >
                            ← Back
                        </button>
                        <button
                            onClick={handlePost}
                            disabled={posting}
                            className="flex-1 py-3 sm:py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black rounded-xl transition-all disabled:opacity-60 shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base active:scale-95"
                        >
                            {posting ? (
                                <><Loader2 size={16} className="animate-spin" /> Posting…</>
                            ) : (
                                <><Rocket size={16} /> Post Job Now</>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

