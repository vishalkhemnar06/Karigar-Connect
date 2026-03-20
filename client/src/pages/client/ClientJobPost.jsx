// client/src/pages/client/ClientJobPost.jsx
// CHANGES:
//  - Removed end time from schedule step
//  - 50-minute lead time validation for scheduled time
//  - Budget: per-individual-worker cost (Painter 1: ₹X, Painter 2: ₹X)
//  - Recalculate button when skills manually changed
//  - Work flow suggestion (sequential/parallel)
//  - No "per worker" generic line — show actual skill-based costs

import { useState, useEffect, useRef, useCallback } from 'react';
import { postJob, aiGenerateQuestions, aiGenerateEstimate } from '../../api/index';
import toast from 'react-hot-toast';

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
    { label: 'Describe',  icon: '📝' },
    { label: 'Questions', icon: '🤔' },
    { label: 'Budget',    icon: '💰' },
    { label: 'Schedule',  icon: '📅' },
    { label: 'Location',  icon: '📍' },
    { label: 'Photos',    icon: '📷' },
    { label: 'Preview',   icon: '✅' },
];

const detectShift = (t) => {
    if (!t) return '';
    const h = parseInt(t.split(':')[0], 10);
    if (h >= 6  && h < 12) return 'Morning Shift (6 AM – 12 PM)';
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

// ── Work flow suggestion engine ───────────────────────────────────────────────
const SKILL_ORDER = { mason: 1, plumber: 2, carpenter: 3, electrician: 4, tiler: 5, welder: 6, painter: 7, ac_technician: 8, cleaner: 9, handyman: 5, general: 5 };
const SEQUENTIAL_DEPS = {
    tiler:    ['plumber', 'mason'],
    painter:  ['mason', 'carpenter', 'electrician', 'tiler'],
    ac_technician: ['electrician'],
    cleaner:  ['painter', 'tiler'],
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
            const depsDone    = depsPresent.every(d => done.has(d));
            if (depsDone) phase.push(sk);
        }
        if (!phase.length) break; // prevent infinite loop

        const parallelGroup = phase.filter(sk => PARALLEL_CAPABLE.has(sk));
        const seqGroup      = phase.filter(sk => !PARALLEL_CAPABLE.has(sk));

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

// ── Sub-components ────────────────────────────────────────────────────────────
function StepBar({ current }) {
    return (
        <div className="flex items-center overflow-x-auto pb-2 mb-8 scrollbar-hide">
            {STEPS.map((s, i) => (
                <div key={i} className="flex items-center flex-shrink-0">
                    <div className="flex flex-col items-center">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                            i < current  ? 'bg-green-500 border-green-500 text-white' :
                            i === current ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-200' :
                            'bg-white border-gray-200 text-gray-400'
                        }`}>{i < current ? '✓' : s.icon}</div>
                        <span className={`text-[10px] mt-1 font-semibold ${i === current ? 'text-orange-600' : i < current ? 'text-green-500' : 'text-gray-300'}`}>{s.label}</span>
                    </div>
                    {i < STEPS.length - 1 && <div className={`h-0.5 w-5 sm:w-8 mx-0.5 mb-4 rounded flex-shrink-0 ${i < current ? 'bg-green-400' : 'bg-gray-200'}`} />}
                </div>
            ))}
        </div>
    );
}

function QWidget({ q, value, onChange }) {
    if (q.type === 'select') return (
        <div><label className="block text-sm font-semibold text-gray-700 mb-2">{q.question}</label>
        <div className="flex flex-wrap gap-2">{(q.options||[]).map(opt => (
            <button key={opt} type="button" onClick={() => onChange(q.id, opt)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${value === opt ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'}`}>{opt}</button>
        ))}</div></div>
    );
    return (
        <div><label className="block text-sm font-semibold text-gray-700 mb-2">{q.question}</label>
        <input type={q.type === 'number' ? 'number' : 'text'} min={0} value={value||''} onChange={e => onChange(q.id, e.target.value)} placeholder="Your answer…" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 transition-colors" /></div>
    );
}

// ── Enhanced Budget Table — per-individual-worker costs ───────────────────────
function BudgetTable({ breakdown, skillBlocks = [] }) {
    if (!breakdown?.breakdown?.length) return null;
    return (
        <div className="space-y-3">
            {breakdown.breakdown.map((b, bi) => {
                const count     = b.count || 1;
                const perWorker = count > 1 ? Math.round(b.subtotal / count) : b.subtotal;
                return (
                    <div key={bi} className="border border-gray-200 rounded-xl overflow-hidden">
                        {/* Skill header */}
                        <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b border-gray-100">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-800 text-sm capitalize">{b.skill}</span>
                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">{count} worker{count > 1 ? 's' : ''}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.complexity === 'heavy' ? 'bg-red-100 text-red-600' : b.complexity === 'normal' ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'}`}>{b.complexity}</span>
                            </div>
                            <span className="text-xs text-gray-400">{b.hours}h total · ₹{b.baseRate?.toLocaleString()}/day</span>
                        </div>

                        {/* Individual worker rows */}
                        {Array.from({ length: count }).map((_, wi) => (
                            <div key={wi} className="flex items-center justify-between px-4 py-2 border-b border-gray-50 last:border-0 bg-white">
                                <span className="text-sm text-gray-600 capitalize">{b.skill} Worker {wi + 1}</span>
                                <span className="text-sm font-semibold text-gray-800">₹{perWorker.toLocaleString()}</span>
                            </div>
                        ))}

                        {/* Skill subtotal */}
                        <div className="flex justify-between px-4 py-2.5 bg-orange-50">
                            <span className="text-sm font-bold text-gray-700 capitalize">{b.skill} total ({count} worker{count > 1 ? 's' : ''})</span>
                            <span className="font-bold text-orange-700">₹{b.subtotal?.toLocaleString()}</span>
                        </div>
                    </div>
                );
            })}

            {/* Urgency */}
            {breakdown.urgent && (
                <div className="flex justify-between px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-xl">
                    <span className="text-sm text-orange-600">Urgency surcharge (+{Math.round((breakdown.urgencyMult - 1) * 100)}%)</span>
                    <span className="font-semibold text-orange-600">+₹{(breakdown.totalEstimated - breakdown.subtotal)?.toLocaleString()}</span>
                </div>
            )}

            {/* Grand total */}
            <div className="flex justify-between px-4 py-3 bg-orange-500 rounded-xl">
                <span className="text-white font-black">Total Estimated</span>
                <span className="text-white font-black text-lg">₹{breakdown.totalEstimated?.toLocaleString()}</span>
            </div>
        </div>
    );
}

// ── Work flow display ─────────────────────────────────────────────────────────
function WorkFlowSuggestion({ skillBlocks }) {
    const phases = generateWorkFlow(skillBlocks || []);
    if (!phases.length || skillBlocks?.length <= 1) return null;
    return (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">📋 Suggested Work Flow</p>
            <div className="space-y-2.5">
                {phases.map((phase, i) => (
                    <div key={i} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{phase.step}</div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                {phase.skills.map((sk, si) => (
                                    <span key={si} className="text-xs bg-white border border-blue-200 text-blue-700 px-2.5 py-1 rounded-full font-semibold capitalize">{sk}</span>
                                ))}
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${phase.type === 'parallel' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {phase.type === 'parallel' ? '⟳ Parallel' : '→ Sequential'}
                                </span>
                            </div>
                            {phase.note && <p className="text-xs text-blue-500 mt-0.5">{phase.note}</p>}
                        </div>
                    </div>
                ))}
            </div>
            <p className="text-xs text-blue-400 mt-3">This is a suggestion based on typical work dependencies. Adjust as needed.</p>
        </div>
    );
}

// Leaflet map
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
            const icon = L.divIcon({ className: '', html: `<div style="width:24px;height:24px;background:#f97316;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3)"></div>`, iconSize: [24,24], iconAnchor: [12,24] });
            const marker = L.marker([il, ilng], { icon, draggable: true }).addTo(map);
            marker.on('dragend', () => { const p = marker.getLatLng(); onPick(p.lat, p.lng); });
            map.on('click', e => { marker.setLatLng(e.latlng); onPick(e.latlng.lat, e.latlng.lng); });
            mapRef.current = map; mRef.current = marker; setReady(true);
        });
        return () => { alive = false; };
    }, []);
    useEffect(() => { if (!ready || !mRef.current || !lat || !lng) return; mRef.current.setLatLng([lat, lng]); mapRef.current.setView([lat, lng], 15); }, [lat, lng, ready]);
    return (
        <div className="relative rounded-2xl overflow-hidden border-2 border-gray-200" style={{ height: 260 }}>
            <div ref={cRef} style={{ width: '100%', height: '100%' }} />
            {!ready && <div className="absolute inset-0 bg-gray-50 flex items-center justify-center z-10"><div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" /></div>}
        </div>
    );
}

function PRow({ label, value, vc = '' }) {
    if (!value && value !== 0) return null;
    return (
        <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
            <span className="text-xs text-gray-400 font-medium w-28 flex-shrink-0 pt-0.5">{label}</span>
            <span className={`text-sm text-gray-800 flex-1 leading-snug ${vc}`}>{value}</span>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function ClientJobPost() {
    const [step, setStep] = useState(0);

    // Step 0
    const [description, setDescription] = useState('');
    const [city,        setCity]        = useState('');
    const [urgent,      setUrgent]      = useState(false);
    const [loadingQ,    setLoadingQ]    = useState(false);

    // Step 1
    const [questions, setQuestions] = useState([]);
    const [answers,   setAnswers]   = useState({});
    const [loadingE,  setLoadingE]  = useState(false);

    // Step 2 — budget
    const [estimate,        setEstimate]       = useState(null);
    const [editableSkills,  setEditableSkills] = useState([]);
    const [newSkillInput,   setNewSkillInput]  = useState('');
    const [skillsChanged,   setSkillsChanged]  = useState(false);
    const [workerCountChanged, setWorkerCountChanged] = useState(false);
    const [recalcLoading,   setRecalcLoading]  = useState(false);
    const [title,           setTitle]          = useState('');
    const [duration,        setDuration]       = useState('');
    const [workersRequired, setWorkersRequired]= useState(1);
    const [customBudget,    setCustomBudget]   = useState('');
    const [negotiable,      setNegotiable]     = useState(false);
    const [minBudget,       setMinBudget]      = useState('');

    // Step 3 — schedule (NO end time)
    const [scheduledDate,   setScheduledDate]  = useState('');
    const [scheduledTime,   setScheduledTime]  = useState('');
    const [shift,           setShift]          = useState('');
    const [scheduleError,   setScheduleError]  = useState('');

    // Step 4 — location
    const [location,   setLocation]   = useState({ city: '', locality: '', pincode: '', fullAddress: '', lat: null, lng: null });
    const [geoLoading, setGeoLoading] = useState(false);
    const [geoError,   setGeoError]   = useState('');

    // Step 5 — photos
    const [photos, setPhotos] = useState([]);
    const photoRef = useRef();

    const [posting, setPosting] = useState(false);

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

    // Recalculate estimate after skill or worker count changes
    const handleRecalculate = async () => {
        try {
            setRecalcLoading(true);
            const answersText = {};
            questions.forEach(q => { if (answers[q.id]) answersText[q.question] = answers[q.id]; });
            // Build modified description with current skills
            const newDesc = `${description} (Required skills: ${editableSkills.join(', ')})`;
            // Pass workerCountOverride so backend respects the manually-set total
            const { data } = await aiGenerateEstimate({ workDescription: newDesc, answers: answersText, city, urgent, workerCountOverride: workersRequired });
            setEstimate(data);
            const total = data.budgetBreakdown?.totalEstimated || 0;
            setCustomBudget(String(total));
            setMinBudget(String(Math.round(total * 0.8)));
            // Only update workersRequired from AI if the user did NOT manually change it
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
                const msg = err.code === 1 ? 'Location access denied. Please enable permissions or enter manually.' : 'Could not get location. Enter manually.';
                setGeoError(msg);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    // Step transitions
    const go0to1 = async () => {
        if (!description.trim()) return toast.error('Please describe the work.');
        try {
            setLoadingQ(true);
            const { data } = await aiGenerateQuestions({ workDescription: description, city });
            setQuestions(data.questions || []); setStep(1);
        } catch { toast.error('Could not generate questions.'); setQuestions([]); setStep(1); }
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
        if (!title.trim())   return toast.error('Job title required.');
        if (!customBudget || Number(customBudget) < 0) return toast.error('Please set a valid budget.');
        if (negotiable && (!minBudget || Number(minBudget) >= Number(customBudget))) return toast.error('Minimum budget must be less than your offer.');
        setStep(3);
    };

    const WORK_START_MINS = 360; // 6:00 AM
    const WORK_END_MINS   = 1260; // 9:00 PM
    const toMins = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };

    const go3to4 = () => {
        setScheduleError('');
        if (!scheduledDate) return setScheduleError('Please select a date.');
        if (!scheduledTime) return setScheduleError('Please select a start time.');

        const selDate = new Date(scheduledDate + 'T00:00:00');
        const today   = new Date(); today.setHours(0, 0, 0, 0);
        if (selDate < today) return setScheduleError('Date cannot be in the past.');

        const startMins = toMins(scheduledTime);
        if (startMins < WORK_START_MINS || startMins > WORK_END_MINS)
            return setScheduleError('Work time must be between 6:00 AM and 9:00 PM.');

        // 50-minute lead time check
        const [h, m]    = scheduledTime.split(':').map(Number);
        const sched     = new Date(scheduledDate + 'T00:00:00');
        sched.setHours(h, m, 0, 0);
        const minsUntil = (sched.getTime() - Date.now()) / 60000;
        if (minsUntil < 50) {
            return setScheduleError(`Scheduled time must be at least 50 minutes from now. Current time: ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}. Please choose a later time.`);
        }

        setStep(4);
    };

    const go4to5 = () => { if (!location.city) return toast.error('Please enter your city.'); setStep(5); };

    const handlePost = async () => {
        if (!title.trim())  return toast.error('Title required.');
        if (!customBudget || Number(customBudget) <= 0) return toast.error('Budget required.');
        if (!location.city) return toast.error('City required.');
        if (!scheduledDate) return toast.error('Date required.');
        try {
            setPosting(true);
            const qaRecord = questions.map(q => ({ question: q.question, answer: answers[q.id] || '' })).filter(x => x.answer);
            const fd = new FormData();
            fd.append('title',               title.trim());
            fd.append('description',         description);
            fd.append('shortDescription',    description.slice(0, 150));
            fd.append('detailedDescription', description);
            fd.append('skills',              JSON.stringify(editableSkills));
            fd.append('payment',             String(ensureNonNeg(customBudget)));
            fd.append('negotiable',          String(negotiable));
            fd.append('minBudget',           negotiable ? String(ensureNonNeg(minBudget)) : '0');
            fd.append('duration',            duration);
            fd.append('workersRequired',     String(Math.max(1, ensureNonNeg(workersRequired, 1))));
            fd.append('location',            JSON.stringify(location));
            fd.append('scheduledDate',       scheduledDate);
            fd.append('scheduledTime',       scheduledTime);
            fd.append('shift',               shift);
            fd.append('urgent',              String(urgent));
            fd.append('qaAnswers',           JSON.stringify(qaRecord));
            if (estimate?.budgetBreakdown) fd.append('budgetBreakdown', JSON.stringify(estimate.budgetBreakdown));
            fd.append('totalEstimatedCost',  String(estimate?.budgetBreakdown?.totalEstimated || ensureNonNeg(customBudget)));
            photos.forEach(f => fd.append('photos', f));
            await postJob(fd);
            toast.success('Job posted! 🎉');
            // Reset
            setStep(0); setDescription(''); setCity(''); setUrgent(false);
            setQuestions([]); setAnswers({}); setEstimate(null); setEditableSkills([]); setSkillsChanged(false);
            setTitle(''); setDuration(''); setCustomBudget(''); setMinBudget(''); setNegotiable(false); setWorkersRequired(1);
            setScheduledDate(''); setScheduledTime(''); setShift('');
            setLocation({ city: '', locality: '', pincode: '', fullAddress: '', lat: null, lng: null });
            setPhotos([]);
        } catch (err) { toast.error(err?.response?.data?.message || 'Failed to post.'); }
        finally { setPosting(false); }
    };

    // ── RENDER ─────────────────────────────────────────────────────────────────
    return (
        <div className="max-w-2xl mx-auto px-4 py-6 pb-28">
            <div className="mb-6">
                <h1 className="text-2xl font-black text-gray-900">Post a New Job</h1>
                <p className="text-xs text-gray-400 mt-0.5">Step {step + 1} of {STEPS.length} — {STEPS[step].label}</p>
            </div>
            <StepBar current={step} />

            {/* STEP 0 — DESCRIBE */}
            {step === 0 && (
                <div className="space-y-5">
                    <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-sm text-orange-700">💡 Be specific — mention area size, rooms, current issues</div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Work Description <span className="text-red-500">*</span></label>
                        <textarea rows={6} value={description} onChange={e => setDescription(e.target.value)} placeholder="E.g., Complete bathroom renovation — replace floor tiles, fix leaking pipe, repaint walls in 2BHK Pune…" className="w-full border-2 border-gray-200 rounded-2xl p-4 text-sm focus:outline-none focus:border-orange-400 resize-none leading-relaxed transition-colors" />
                        <p className="text-xs text-gray-400 mt-1">{description.length} chars</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">City</label>
                            <input value={city} onChange={e => setCity(e.target.value)} placeholder="Pune, Mumbai…" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 transition-colors" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
                            <button type="button" onClick={() => setUrgent(u => !u)} className={`w-full py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${urgent ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-400 hover:border-orange-200'}`}>
                                {urgent ? '⚡ Urgent (+25%)' : '🕐 Normal'}
                            </button>
                        </div>
                    </div>
                    <button onClick={go0to1} disabled={loadingQ || !description.trim()} className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl transition-all disabled:opacity-60 shadow-lg flex items-center justify-center gap-2 text-base">
                        {loadingQ ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Analysing…</> : '✨ Get AI Questions →'}
                    </button>
                    <button onClick={() => { setQuestions([]); setEstimate(null); setEditableSkills([]); setStep(2); }} className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">Skip AI — enter manually</button>
                </div>
            )}

            {/* STEP 1 — QUESTIONS */}
            {step === 1 && (
                <div className="space-y-5">
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
                        <span className="text-2xl">🤔</span>
                        <div><p className="text-sm font-bold text-blue-800">Clarifying Questions</p><p className="text-xs text-blue-500 mt-0.5">Answers improve cost accuracy</p></div>
                    </div>
                    <div className="bg-gray-50 rounded-xl px-4 py-3">
                        <p className="text-xs text-gray-400 mb-0.5">Your request</p>
                        <p className="text-sm text-gray-700 line-clamp-2">{description}</p>
                        <div className="flex gap-2 mt-1.5">{city && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">📍 {city}</span>}{urgent && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">⚡ Urgent</span>}</div>
                    </div>
                    {questions.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No clarifications needed.</p> : <div className="space-y-4">{questions.map(q => <QWidget key={q.id} q={q} value={answers[q.id]} onChange={setAnswer} />)}</div>}
                    <div className="flex gap-3">
                        <button onClick={() => setStep(0)} className="px-5 py-3 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-semibold text-sm">← Back</button>
                        <button onClick={go1to2} disabled={loadingE} className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl disabled:opacity-60 flex items-center justify-center gap-2 text-sm">
                            {loadingE ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Calculating…</> : '💰 Get Cost Estimate →'}
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 2 — BUDGET + SKILLS + WORK FLOW */}
            {step === 2 && (
                <div className="space-y-5">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Job Title <span className="text-red-500">*</span></label>
                        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="E.g., Bathroom Renovation — Pune" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 transition-colors" />
                    </div>

                    {/* Skill editor */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-semibold text-gray-700">Skills Required</label>
                            {(skillsChanged || workerCountChanged) && (
                                <button onClick={handleRecalculate} disabled={recalcLoading}
                                    className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg font-bold transition-colors disabled:opacity-60 flex items-center gap-1">
                                    {recalcLoading ? <><span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Recalculating…</> : '⚡ Recalculate Cost'}
                                </button>
                            )}
                        </div>
                        {(skillsChanged || workerCountChanged) && !recalcLoading && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-3 text-xs text-amber-700 font-medium">
                                ⚡ {skillsChanged && workerCountChanged ? 'Skills & worker count' : skillsChanged ? 'Skills' : 'Worker count'} changed — click Recalculate to update cost estimate
                            </div>
                        )}
                        <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3">
                            <div className="flex flex-wrap gap-2 min-h-[36px]">
                                {editableSkills.length === 0 && <span className="text-xs text-gray-400 py-1">No skills added yet</span>}
                                {editableSkills.map((sk, i) => (
                                    <div key={i} className="flex items-center gap-1.5 bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full text-xs font-semibold">
                                        <span className="capitalize">{sk}</span>
                                        <button type="button" onClick={() => removeSkill(i)} className="text-orange-400 hover:text-red-500 font-bold text-sm leading-none">×</button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                                <input value={newSkillInput} onChange={e => setNewSkillInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }} placeholder="Add skill (e.g., carpenter)…" className="flex-1 border-2 border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400 transition-colors" />
                                <button type="button" onClick={addSkill} className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-colors">+ Add</button>
                            </div>
                        </div>
                    </div>

                    {/* Budget breakdown — per-individual-worker */}
                    {estimate?.budgetBreakdown?.breakdown?.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Cost Per Worker</p>
                                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium capitalize">📍 {estimate.budgetBreakdown.city}</span>
                                {estimate.budgetBreakdown.urgent && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">⚡ Urgent</span>}
                            </div>
                            <BudgetTable breakdown={estimate.budgetBreakdown} skillBlocks={estimate.skillBlocks} />
                        </div>
                    )}

                    {/* Work flow suggestion */}
                    {estimate?.skillBlocks && <WorkFlowSuggestion skillBlocks={estimate.skillBlocks} />}

                    {/* Duration + Workers */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Duration</label>
                            <input value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g., 2 days" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 transition-colors" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Workers Needed</label>
                            <input type="number" min={1} max={20} value={workersRequired} onChange={e => { const v = Number(e.target.value); if (v < 1) return; setWorkersRequired(v); setWorkerCountChanged(true); }} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 transition-colors" />
                        </div>
                    </div>

                    {/* Your offer */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Your Budget Offer (₹) <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xl">₹</span>
                            <input type="number" min={0} value={customBudget} onChange={e => { if (Number(e.target.value) < 0) return; setCustomBudget(e.target.value); }} className="w-full pl-9 pr-4 py-3 border-2 border-orange-300 focus:border-orange-500 rounded-xl text-2xl font-black focus:outline-none bg-white transition-colors text-gray-900" />
                        </div>
                        {estimate?.budgetBreakdown?.totalEstimated && <p className="text-xs text-gray-400 mt-1">AI suggested: ₹{estimate.budgetBreakdown.totalEstimated.toLocaleString()}</p>}
                    </div>

                    {/* Negotiable */}
                    <div className="border-2 border-gray-100 rounded-2xl p-4">
                        <div className="flex items-center justify-between">
                            <div><p className="font-bold text-gray-800 text-sm">Allow Negotiation</p><p className="text-xs text-gray-400">Workers can counter-offer</p></div>
                            <button type="button" onClick={() => setNegotiable(n => !n)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${negotiable ? 'bg-orange-500' : 'bg-gray-200'}`}>
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${negotiable ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        {negotiable && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Minimum Budget <span className="text-red-500">*</span></label>
                                <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                                <input type="number" min={0} value={minBudget} onChange={e => { if (Number(e.target.value) < 0) return; setMinBudget(e.target.value); }} placeholder="Min acceptable" className="w-full pl-8 border-2 border-gray-200 rounded-xl py-2.5 text-sm font-bold focus:outline-none focus:border-orange-400 transition-colors" /></div>
                            </div>
                        )}
                    </div>

                    {estimate?.recommendation && <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-700 flex gap-2"><span>💡</span><p>{estimate.recommendation}</p></div>}

                    <div className="flex gap-3">
                        <button onClick={() => setStep(questions.length > 0 ? 1 : 0)} className="px-5 py-3 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-semibold text-sm">← Back</button>
                        <button onClick={go2to3} className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm">Next: Schedule →</button>
                    </div>
                </div>
            )}

            {/* STEP 3 — SCHEDULE (no end time) */}
            {step === 3 && (
                <div className="space-y-5">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-600">⏰ Work must be scheduled at least 50 minutes from now, between 6:00 AM and 9:00 PM</div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Work Date <span className="text-red-500">*</span></label>
                        <input type="date" min={todayStr()} value={scheduledDate} onChange={e => { setScheduledDate(e.target.value); setScheduleError(''); }} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400 transition-colors" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Start Time <span className="text-red-500">*</span></label>
                        <input type="time" value={scheduledTime} onChange={e => { setScheduledTime(e.target.value); setScheduleError(''); }} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400 transition-colors" />
                    </div>

                    {scheduleError && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">⚠️ {scheduleError}</div>}

                    {shift && (
                        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center gap-3">
                            <span className="text-2xl">{shiftIcon(shift)}</span>
                            <div><p className="text-xs text-blue-400 font-medium">Shift Detected</p><p className="text-sm font-bold text-blue-800">{shift}</p></div>
                        </div>
                    )}

                    {/* Auto-start notice */}
                    <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                        <p className="text-xs text-green-700 font-medium">🚀 Auto-Start: Job will automatically start at the scheduled time. You can also start manually from the dashboard.</p>
                    </div>

                    {scheduledDate && scheduledTime && (
                        <div className="bg-gray-50 rounded-xl px-4 py-3">
                            <p className="text-sm font-bold text-gray-800">{new Date(scheduledDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            <p className="text-sm text-gray-500 mt-0.5">at {scheduledTime}{duration ? ` · ${duration}` : ''}</p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button onClick={() => setStep(2)} className="px-5 py-3 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-semibold text-sm">← Back</button>
                        <button onClick={go3to4} className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm">Next: Location →</button>
                    </div>
                </div>
            )}

            {/* STEP 4 — LOCATION */}
            {step === 4 && (
                <div className="space-y-5">
                    <button onClick={handleGeolocate} disabled={geoLoading} className="w-full py-3 border-2 border-orange-200 text-orange-600 rounded-xl hover:bg-orange-50 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all">
                        {geoLoading ? <><span className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" /> Detecting…</> : '📡 Use My Live Location'}
                    </button>
                    {geoError && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">⚠️ {geoError}</div>}
                    <MapPicker lat={location.lat} lng={location.lng} onPick={handleMapPick} />
                    <p className="text-xs text-gray-400 text-center">Tap map or drag marker</p>
                    {location.lat && location.lng && <div className="bg-gray-50 rounded-xl px-4 py-2.5 text-xs font-mono text-gray-600">📌 {location.lat.toFixed(5)}, {location.lng.toFixed(5)}</div>}
                    <div className="space-y-3">
                        <input value={location.fullAddress} onChange={e => setLocation(l => ({ ...l, fullAddress: e.target.value }))} placeholder="Full address / landmark…" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 transition-colors" />
                        <div className="grid grid-cols-3 gap-2">
                            <input value={location.locality} onChange={e => setLocation(l => ({ ...l, locality: e.target.value }))} placeholder="Area" className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 transition-colors" />
                            <input value={location.city}     onChange={e => setLocation(l => ({ ...l, city: e.target.value }))}     placeholder="City *" className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 transition-colors" />
                            <input value={location.pincode}  onChange={e => setLocation(l => ({ ...l, pincode: e.target.value }))}  placeholder="Pincode" className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 transition-colors" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div><label className="text-xs text-gray-400 block mb-1">Latitude</label><input type="number" step="any" value={location.lat || ''} onChange={e => setLocation(l => ({ ...l, lat: parseFloat(e.target.value) || null }))} placeholder="e.g., 18.52045" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:border-orange-400 transition-colors" /></div>
                            <div><label className="text-xs text-gray-400 block mb-1">Longitude</label><input type="number" step="any" value={location.lng || ''} onChange={e => setLocation(l => ({ ...l, lng: parseFloat(e.target.value) || null }))} placeholder="e.g., 73.85674" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:border-orange-400 transition-colors" /></div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setStep(3)} className="px-5 py-3 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-semibold text-sm">← Back</button>
                        <button onClick={go4to5} className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm">Next: Photos →</button>
                    </div>
                </div>
            )}

            {/* STEP 5 — PHOTOS */}
            {step === 5 && (
                <div className="space-y-5">
                    <input ref={photoRef} type="file" multiple accept="image/*" className="hidden" onChange={e => setPhotos(Array.from(e.target.files))} />
                    <div onClick={() => photoRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center cursor-pointer hover:border-orange-300 hover:bg-orange-50/20 transition-all">
                        {photos.length > 0 ? (
                            <><div className="flex flex-wrap gap-2 justify-center mb-3">{photos.map((f, i) => <img key={i} src={URL.createObjectURL(f)} alt="" className="w-24 h-24 object-cover rounded-xl shadow-sm" />)}</div>
                            <p className="text-sm font-semibold text-gray-500">{photos.length} photo{photos.length > 1 ? 's' : ''} · tap to change</p></>
                        ) : (
                            <><div className="text-5xl mb-3">🖼️</div><p className="text-sm font-bold text-gray-500">Tap to add photos</p><p className="text-xs text-gray-400 mt-1">Optional · JPG, PNG</p></>
                        )}
                    </div>
                    {photos.length > 0 && <button onClick={() => setPhotos([])} className="w-full text-xs text-red-400 hover:text-red-600 py-1 transition-colors">Remove all photos</button>}
                    <div className="flex gap-3">
                        <button onClick={() => setStep(4)} className="px-5 py-3 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-semibold text-sm">← Back</button>
                        <button onClick={() => setStep(6)} className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm">{photos.length > 0 ? `Preview (${photos.length} photos) →` : 'Skip → Preview'}</button>
                    </div>
                </div>
            )}

            {/* STEP 6 — PREVIEW */}
            {step === 6 && (
                <div className="space-y-5">
                    <div className="bg-white border-2 border-gray-100 rounded-2xl overflow-hidden">
                        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-4">
                            <h3 className="text-white font-black text-lg">{title || 'Untitled'}</h3>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {urgent && <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-bold">⚡ Urgent</span>}
                                {negotiable && <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-bold">🤝 Negotiable</span>}
                                {shift && <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-bold">{shiftIcon(shift)} {shift.split('(')[0].trim()}</span>}
                                <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-bold">👥 {workersRequired} workers</span>
                            </div>
                        </div>
                        <div className="px-5 py-4 divide-y divide-gray-50">
                            <PRow label="Description" value={description.slice(0, 200) + (description.length > 200 ? '…' : '')} />
                            <PRow label="Budget" value={`₹${Number(customBudget).toLocaleString()}${negotiable ? ` (Min ₹${Number(minBudget).toLocaleString()})` : ' · Fixed'}`} vc="text-green-600 font-bold text-base" />
                            <PRow label="Duration" value={duration} />
                            <PRow label="Date" value={scheduledDate ? new Date(scheduledDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''} />
                            <PRow label="Start Time" value={scheduledTime} />
                            <PRow label="Shift" value={shift} />
                            <PRow label="City" value={location.city} />
                            <PRow label="Address" value={[location.locality, location.city, location.pincode].filter(Boolean).join(', ')} />
                        </div>
                    </div>

                    {editableSkills.length > 0 && (
                        <div className="bg-white border-2 border-gray-100 rounded-2xl px-5 py-4">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Skills Required</p>
                            <div className="flex flex-wrap gap-2">{editableSkills.map((s, i) => <span key={i} className="text-xs bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full font-bold capitalize">{s}</span>)}</div>
                        </div>
                    )}

                    {estimate?.budgetBreakdown?.breakdown?.length > 0 && (
                        <div className="bg-white border-2 border-gray-100 rounded-2xl px-5 py-4">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Cost Breakdown</p>
                            <BudgetTable breakdown={estimate.budgetBreakdown} skillBlocks={estimate.skillBlocks} />
                        </div>
                    )}

                    {estimate?.skillBlocks && estimate.skillBlocks.length > 1 && (
                        <div className="bg-white border-2 border-gray-100 rounded-2xl px-5 py-4">
                            <WorkFlowSuggestion skillBlocks={estimate.skillBlocks} />
                        </div>
                    )}

                    {questions.filter(q => answers[q.id]).length > 0 && (
                        <div className="bg-white border-2 border-gray-100 rounded-2xl px-5 py-4">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Your Answers</p>
                            {questions.filter(q => answers[q.id]).map(q => (
                                <div key={q.id} className="flex items-start gap-3 py-1.5">
                                    <span className="text-xs text-gray-400 flex-1">{q.question}</span>
                                    <span className="text-xs font-bold text-gray-700 text-right max-w-[45%]">{answers[q.id]}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {photos.length > 0 && (
                        <div className="bg-white border-2 border-gray-100 rounded-2xl px-5 py-4">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{photos.length} Work Photo{photos.length > 1 ? 's' : ''}</p>
                            <div className="flex flex-wrap gap-2">{photos.map((f, i) => <img key={i} src={URL.createObjectURL(f)} alt="" className="w-20 h-20 object-cover rounded-xl shadow-sm" />)}</div>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button onClick={() => setStep(5)} className="px-5 py-3 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-semibold">← Back</button>
                        <button onClick={handlePost} disabled={posting} className="flex-1 py-4 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl transition-all disabled:opacity-60 shadow-lg flex items-center justify-center gap-2 text-base">
                            {posting ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Posting…</> : '🚀 Post Job Now'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
