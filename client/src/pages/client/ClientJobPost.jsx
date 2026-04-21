// client/src/pages/client/ClientJobPost.jsx
// CHANGES:
//  - Removed end time from schedule step
//  - 50-minute lead time validation for scheduled time
//  - Budget: per-individual-worker cost (Painter 1: ₹X, Painter 2: ₹X)
//  - Recalculate button when skills manually changed
//  - Work flow suggestion (sequential/parallel)
//  - No "per worker" generic line — show actual skill-based costs

import { useState, useEffect, useRef, useCallback } from 'react';
import { postJob, aiGenerateQuestions, aiGenerateEstimate, getRateTableCities } from '../../api/index';
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
    { label: 'Describe' },
    { label: 'Questions' },
    { label: 'Budget' },
    { label: 'Location' },
    { label: 'Photos' },
    { label: 'Preview' },
];

const detectShift = (t) => {
    if (!t) return '';
    const h = parseInt(t.split(':')[0], 10);
    if (h >= 6  && h < 12) return 'Morning Shift (6 AM – 12 PM)';
    if (h >= 12 && h < 17) return 'Afternoon Shift (12 PM – 5 PM)';
    if (h >= 17 && h < 21) return 'Evening Shift (5 PM – 9 PM)';
    return '';
};

const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const ensureNonNeg = (v, fb = 0) => { const n = Number(v); return isNaN(n) || n < 0 ? fb : n; };
const formatCurrency = (amount) => {
    const value = Number(amount);
    if (!Number.isFinite(value)) return '';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(value);
};
const MIN_AI_DESC_CHARS = 10;
const OTHER_CITY_OPTION = '__OTHER_CITY__';
const OTHER_SKILL_OPTION = '__OTHER_SKILL__';
const AVAILABLE_SKILLS = [
    'plumber', 'electrician', 'carpenter', 'painter', 'tiler', 'mason',
    'welder', 'ac_technician', 'pest_control', 'cleaner', 'handyman', 'gardener',
    'waterproofing', 'deep_cleaning', 'other',
];
const RATE_INPUT_MODES = ['day', 'visit', 'hour'];
const MANUAL_RATE_VARIANCE = 0.3;
const HOURS_PER_DAY = 8;
const SMALL_JOB_HOUR_THRESHOLD = 3;
const WORK_START_MINS = 360; // 6:00 AM
const WORK_END_MINS = 1260; // 9:00 PM
const MAX_JOB_PHOTOS = 3;
const JOB_POST_DRAFT_KEY = 'client_job_post_draft_v1';
const EMPTY_JOB_LOCATION = {
    city: '',
    locality: '',
    state: '',
    pincode: '',
    fullAddress: '',
    buildingName: '',
    unitNumber: '',
    floorNumber: '',
    lat: null,
    lng: null,
};

const toMins = (t) => {
    if (!t) return null;
    const [h, m] = String(t).split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
};

const deriveDurationPartsFromBudget = (budgetBreakdown = {}) => {
    const aiDays = Math.max(0, Number(budgetBreakdown?.durationDays) || 0);
    const maxHoursFromSkills = Array.isArray(budgetBreakdown?.breakdown)
        ? budgetBreakdown.breakdown.reduce((max, block) => Math.max(max, Number(block?.hours) || 0), 0)
        : 0;
    const totalHours = Math.max(0, Number(budgetBreakdown?.totalHours) || maxHoursFromSkills);
    const days = aiDays > 0 ? aiDays : (totalHours > 0 ? Math.max(1, Math.ceil(totalHours / 8)) : 0);
    const hours = totalHours > 0 ? Math.round(totalHours) : (days > 0 ? days * 8 : 0);
    return { days, hours };
};

const getDurationLabel = (days, hours) => {
    const safeDays = Math.max(0, Number(days) || 0);
    const safeHours = Math.max(0, Number(hours) || 0);
    if (!safeDays && !safeHours) return '';
    const dayText = `${safeDays} day${safeDays === 1 ? '' : 's'}`;
    const hourText = `${safeHours} hour${safeHours === 1 ? '' : 's'}`;
    return `${dayText}, ${hourText}`;
};

const getAllowedRateModesForDuration = (days, hours) => {
    const safeDays = Math.max(1, Number(days) || 1);
    const safeHours = Math.max(1, Number(hours) || 1);
    if (safeHours < SMALL_JOB_HOUR_THRESHOLD) return ['hour', 'visit', 'day'];
    if (safeDays === 1 && safeHours <= HOURS_PER_DAY) return ['visit', 'day'];
    return ['day'];
};

const getPreferredRateModeForDuration = (days, hours) => {
    const allowedModes = getAllowedRateModesForDuration(days, hours);
    return allowedModes[0] || 'day';
};

const sanitizeGeneratedQuestionText = (raw = '') => {
    let q = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!q) return '';

    if (/which\s+type\s+of\s+electrical\s+work/i.test(q) && /(sq\s*ft|sqft|square\s*feet)/i.test(q)) {
        return 'What type of electrical work is needed in the bathroom? (e.g., wiring, switchboard, lights, exhaust fan, geyser point)';
    }

    if (/type\s+of/i.test(q) && /(sq\s*ft|sqft|square\s*feet)/i.test(q)) {
        q = q.replace(/in\s*(the\s*)?(bathroom\s*)?\(?\s*(sq\s*ft|sqft|square\s*feet)\s*\)?/ig, '');
    }

    q = q.replace(/\s+\?/g, '?').trim();
    if (!/[?.!]$/.test(q)) q = `${q}?`;
    return q;
};

const normalizeGeneratedQuestions = (list = []) => {
    const seen = new Set();
    const normalized = [];

    for (const item of Array.isArray(list) ? list : []) {
        const question = sanitizeGeneratedQuestionText(item?.question);
        if (!question) continue;

        const dedupeKey = question.toLowerCase();
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        let type = ['select', 'number', 'text', 'multi_select'].includes(item?.type) ? item.type : 'text';
        const multiSelect = type === 'multi_select' || Boolean(item?.multiSelect);
        if (type === 'multi_select') type = 'select';
        if (/type\s+of/i.test(question) && /(sq\s*ft|sqft|square\s*feet)/i.test(String(item?.question || ''))) {
            type = 'text';
        }

        const options = Array.isArray(item?.options)
            ? Array.from(new Set(item.options.map((opt) => String(opt || '').trim()).filter(Boolean)))
            : [];

        normalized.push({
            id: item?.id || `q_${normalized.length + 1}`,
            question,
            type,
            options,
            multiSelect,
            allowNotSure: Boolean(item?.allowNotSure),
            required: Boolean(item?.required),
        });

        if (normalized.length >= 12) break;
    }

    return normalized;
};

const buildSkillWorkerCountMap = (estimateData = {}) => {
    const map = {};
    const bySkillBlocks = Array.isArray(estimateData?.skillBlocks) ? estimateData.skillBlocks : [];
    const byBreakdown = Array.isArray(estimateData?.budgetBreakdown?.breakdown) ? estimateData.budgetBreakdown.breakdown : [];

    bySkillBlocks.forEach((block) => {
        const key = String(block?.skill || '').trim().toLowerCase();
        if (!key) return;
        const count = Math.max(1, Number(block?.count) || 1);
        map[key] = count;
    });

    byBreakdown.forEach((block) => {
        const key = String(block?.skill || '').trim().toLowerCase();
        if (!key) return;
        const count = Math.max(1, Number(block?.count) || 1);
        if (!map[key]) map[key] = count;
    });

    return map;
};

const mergeSkillWorkerCounts = (skills = [], currentMap = {}, fallbackMap = {}) => {
    const next = {};
    (Array.isArray(skills) ? skills : []).forEach((skill) => {
        const key = String(skill || '').trim().toLowerCase();
        if (!key) return;
        const current = Math.max(1, Number(currentMap?.[key]) || 0);
        const fallback = Math.max(1, Number(fallbackMap?.[key]) || 0);
        next[key] = current || fallback || 1;
    });
    return next;
};

const getTotalWorkersFromMap = (counts = {}) => Object.values(counts).reduce((sum, n) => sum + Math.max(1, Number(n) || 1), 0);

const inferDurationFromBudget = (bd) => {
    const days = Math.max(0, Number(bd?.durationDays) || 0);
    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    const maxHours = Array.isArray(bd?.breakdown)
        ? bd.breakdown.reduce((m, b) => Math.max(m, Number(b?.hours) || 0), 0)
        : 0;
    if (maxHours > 0) {
        const computedDays = Math.max(1, Math.ceil(maxHours / 8));
        return `${computedDays} day${computedDays > 1 ? 's' : ''}`;
    }
    return '';
};

const buildThreeLineTitleDraft = ({
    skills = [],
    workersRequired = 1,
    city = '',
    budget = '',
    duration = '',
    description = '',
}) => {
    const skillText = skills.length ? skills.slice(0, 3).join(', ') : 'general work';
    const line1 = `Need ${workersRequired} worker${workersRequired > 1 ? 's' : ''} for ${skillText}${city ? ` in ${city}` : ''}.`;
    const line2 = description
        ? `Work requirements: ${description.trim().slice(0, 120)}${description.trim().length > 120 ? '...' : ''}`
        : 'Work requirements will be shared after discussion.';
    const line3 = `Budget: ${Number(budget || 0) > 0 ? `₹${Number(budget).toLocaleString('en-IN')}` : 'to be discussed'}${duration ? `, Duration: ${duration}` : ''}.`;
    return `${line1}\n${line2}\n${line3}`;
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
});

const dataUrlToFile = async (dataUrl, fallbackName = 'photo.jpg', fallbackType = 'image/jpeg') => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const fileType = blob.type || fallbackType;
    return new File([blob], fallbackName, { type: fileType });
};

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
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                            i < current  ? 'bg-green-500 border-green-500 text-white' :
                            i === current ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-200' :
                            'bg-white border-gray-200 text-gray-400'
                        }`}>{i < current ? 'Done' : i + 1}</div>
                        <span className={`text-xs mt-1 font-semibold ${i === current ? 'text-orange-600' : i < current ? 'text-green-500' : 'text-gray-400'}`}>{s.label}</span>
                    </div>
                    {i < STEPS.length - 1 && <div className={`h-0.5 w-5 sm:w-8 mx-0.5 mb-4 rounded flex-shrink-0 ${i < current ? 'bg-green-400' : 'bg-gray-200'}`} />}
                </div>
            ))}
        </div>
    );
}

function QWidget({ q, value, onChange }) {
    const isNAOption = (opt = '') => {
        const v = String(opt || '').trim().toLowerCase();
        return v === 'n/a' || v === 'not sure';
    };

    if (q.type === 'select') {
        const selected = Array.isArray(value) ? value : (value ? [value] : []);
        const handleSelect = (opt) => {
            if (!q.multiSelect) {
                onChange(q.id, opt);
                return;
            }
            if (isNAOption(opt)) {
                onChange(q.id, [opt]);
                return;
            }
            const base = selected.filter((item) => !isNAOption(item));
            const exists = base.includes(opt);
            const next = exists ? base.filter((item) => item !== opt) : [...base, opt];
            onChange(q.id, next);
        };

        return (
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{q.question} {q.required ? <span className="text-red-500">*</span> : null}</label>
                <div className="flex flex-wrap gap-2">{(q.options || []).map((opt) => {
                    const active = q.multiSelect ? selected.includes(opt) : value === opt;
                    return (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => handleSelect(opt)}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${active ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'}`}
                        >
                            {opt}
                        </button>
                    );
                })}</div>
            </div>
        );
    }

    if (q.type === 'number') {
        const activeSpecial = (q.options || []).find((opt) => String(value || '') === opt) || '';
        return (
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{q.question} {q.required ? <span className="text-red-500">*</span> : null}</label>
                <input
                    type="number"
                    min={0}
                    value={activeSpecial ? '' : (value || '')}
                    onChange={(e) => onChange(q.id, e.target.value)}
                    placeholder="Your answer..."
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 transition-colors"
                />
                {(q.allowNotSure || (q.options || []).length > 0) && (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {(q.options || []).map((opt) => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => onChange(q.id, opt)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${String(value || '') === opt ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'}`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div><label className="block text-sm font-semibold text-gray-700 mb-2">{q.question} {q.required ? <span className="text-red-500">*</span> : null}</label>
        <input type={q.type === 'number' ? 'number' : 'text'} min={0} value={value||''} onChange={e => onChange(q.id, e.target.value)} placeholder="Your answer..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 transition-colors" /></div>
    );
}

// ── Enhanced Budget Table — per-individual-worker costs ───────────────────────
function BudgetTable({
    breakdown,
    skillBlocks = [],
    negotiable = false,
    showRecalculate = false,
    onRecalculate,
    recalcLoading = false,
}) {
    if (!breakdown?.breakdown?.length) return null;
    return (
        <div className="space-y-3">
            {breakdown.breakdown.map((b, bi) => {
                const count     = b.count || 1;
                const perWorker = count > 1 ? Math.round(b.subtotal / count) : b.subtotal;
                const ratePerHour = Number(b.ratePerHour) || 0;
                const ratePerDay = Number(b.ratePerDay) || (ratePerHour ? ratePerHour * 8 : 0);
                const ratePerHourBase = Number(b.sourceRatePerHourBase) || Number(b.ratePerHourBase) || (Number(b.sourceRatePerDayBase) > 0 ? Math.round(Number(b.sourceRatePerDayBase) / 8) : 0);
                const ratePerDayBase = Number(b.sourceRatePerDayBase) || Number(b.ratePerDayBase) || 0;
                const ratePerVisit = Number(b.ratePerVisit) || Number(b.perWorkerCost) || perWorker;
                const perWorkerBase = Number(b.sourceRatePerVisitBase) || Number(b.perWorkerCostBase) || ratePerVisit;
                const demandMultiplier = Number(b.appliedDemandMultiplier) || 1;
                const multiplierImpact = Math.max(0, ratePerVisit - perWorkerBase);
                const rateInputMode = String(b.rateInputMode || 'day').toLowerCase();
                const priceSource = b.priceSource || 'base_rate';
                return (
                    <div key={bi} className="border border-gray-200 rounded-xl overflow-hidden">
                        {/* Skill header */}
                        <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b border-gray-100">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-800 text-sm capitalize">{b.skill}</span>
                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">{count} worker{count > 1 ? 's' : ''}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.complexity === 'heavy' ? 'bg-red-100 text-red-600' : b.complexity === 'normal' ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'}`}>{b.complexity}</span>
                                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold uppercase">{String(priceSource).replace(/_/g, ' ')}</span>
                                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold uppercase">{rateInputMode} basis</span>
                            </div>
                            <span className="text-xs text-gray-400">{b.hours}h per worker</span>
                        </div>

                        <div className="px-4 py-2 bg-white border-b border-gray-50 text-xs text-gray-600 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                            <span>Derived hourly equivalent: <strong className="text-gray-800">{ratePerHour > 0 ? `${ratePerHour.toLocaleString()}/hr` : '—'}</strong></span>
                            <span>
                                Day: <strong className="text-gray-800">{ratePerDay > 0 ? `${ratePerDay.toLocaleString()}/day` : '—'}</strong>
                                {demandMultiplier > 1 && ratePerDayBase > 0 && (
                                    <em className="ml-1 text-[11px] text-blue-700 not-italic">(base {ratePerDayBase.toLocaleString()}/day × {demandMultiplier.toFixed(2)})</em>
                                )}
                            </span>
                            <span>Visit: <strong className="text-gray-800">{ratePerVisit > 0 ? `${ratePerVisit.toLocaleString()}/visit` : '—'}</strong></span>
                        </div>
                        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-600 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                            <span className="text-gray-500 italic">Detected base hourly: <strong className="text-gray-700">{ratePerHourBase > 0 ? `${ratePerHourBase.toLocaleString()}/hr` : '—'}</strong></span>
                            <span className="text-gray-500 italic">
                                Detected base day: <strong className="text-gray-700">{ratePerDayBase > 0 ? `${ratePerDayBase.toLocaleString()}/day` : '—'}</strong>
                            </span>
                            <span className="text-gray-500 italic">
                                Detected base visit: <strong className="text-gray-700">{Number(b.sourceRatePerVisitBase) > 0 ? `${Number(b.sourceRatePerVisitBase).toLocaleString()}/visit` : perWorkerBase > 0 ? `${perWorkerBase.toLocaleString()}/visit` : '—'}</strong>
                            </span>
                        </div>
                        {demandMultiplier > 1 && multiplierImpact > 0 && (
                            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-800">
                                Multiplier effect per worker: {perWorkerBase.toLocaleString()} to {ratePerVisit.toLocaleString()} (+{multiplierImpact.toLocaleString()})
                            </div>
                        )}

                        {/* Individual worker rows */}
                        {Array.from({ length: count }).map((_, wi) => (
                            <div key={wi} className="flex items-center justify-between px-4 py-2 border-b border-gray-50 last:border-0 bg-white">
                                <span className="text-sm text-gray-600 capitalize">{b.skill} Worker {wi + 1}</span>
                                <span className="text-sm font-semibold text-gray-800">{perWorker.toLocaleString()}</span>
                            </div>
                        ))}

                        {/* Skill subtotal */}
                        <div className="flex justify-between px-4 py-2.5 bg-orange-50">
                            <span className="text-sm font-bold text-gray-700 capitalize">{b.skill} total ({count} worker{count > 1 ? 's' : ''})</span>
                            <span className="font-bold text-orange-700">{b.subtotal?.toLocaleString()}</span>
                        </div>
                    </div>
                );
            })}

            {/* Urgency */}
            {breakdown.urgent && (
                <div className="flex justify-between px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-xl">
                    <span className="text-sm text-orange-600">Urgency surcharge (+{Math.round((breakdown.urgencyMult - 1) * 100)}%)</span>
                    <span className="font-semibold text-orange-600">+{(breakdown.totalEstimated - breakdown.subtotal)?.toLocaleString()}</span>
                </div>
            )}

            {/* Grand total */}
            <div className="flex justify-between px-4 py-3 bg-orange-500 rounded-xl">
                <span className="text-white font-black">Total Estimated</span>
                <span className="text-white font-black text-lg">{breakdown.totalEstimated?.toLocaleString()}</span>
            </div>

            {showRecalculate && (
                <button
                    type="button"
                    onClick={onRecalculate}
                    disabled={recalcLoading}
                    className="w-full text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-1"
                >
                    {recalcLoading ? <><span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Recalculating...</> : 'Recalculate Cost'}
                </button>
            )}

        </div>
    );
}

// ── Work flow display ─────────────────────────────────────────────────────────
function WorkFlowSuggestion({ skillBlocks }) {
    const phases = generateWorkFlow(skillBlocks || []);
    if (!phases.length || skillBlocks?.length <= 1) return null;
    return (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">Suggested Work Flow</p>
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
                                    {phase.type === 'parallel' ? 'Parallel' : 'Sequential'}
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
    const [cityOptions, setCityOptions] = useState([]);
    const [isTopCityOther, setIsTopCityOther] = useState(false);

    // Step 0
    const [description, setDescription] = useState('');
    const [city,        setCity]        = useState('');
    const [urgent,      setUrgent]      = useState(false);
    const [loadingQ,    setLoadingQ]    = useState(false);

    // Step 1
    const [questions, setQuestions] = useState([]);
    const [questionSourceKey, setQuestionSourceKey] = useState('');
    const [answers,   setAnswers]   = useState({});
    const [loadingE,  setLoadingE]  = useState(false);

    // Step 2 — budget
    const [estimate,        setEstimate]       = useState(null);
    const [editableSkills,  setEditableSkills] = useState([]);
    const [newSkillInput,   setNewSkillInput]  = useState('');
    const [selectedSkillOption, setSelectedSkillOption] = useState('');
    const [skillsChanged,   setSkillsChanged]  = useState(false);
    const [workerCountChanged, setWorkerCountChanged] = useState(false);
    const [recalcLoading,   setRecalcLoading]  = useState(false);
    const [title,           setTitle]          = useState('');
    const [titleDraft,      setTitleDraft]     = useState('');
    const titleAutoManagedRef = useRef(true);
    const [durationDays,    setDurationDays]   = useState(0);
    const [durationHours,   setDurationHours]  = useState(0);
    const [durationDaysDraft, setDurationDaysDraft] = useState('');
    const [durationHoursDraft, setDurationHoursDraft] = useState('');
    const [workersRequired, setWorkersRequired]= useState(1);
    const [skillWorkerCounts, setSkillWorkerCounts] = useState({});
    const [skillWorkerCountDrafts, setSkillWorkerCountDrafts] = useState({});
    const [skillRateAnchors, setSkillRateAnchors] = useState({});
    const [skillRateOverrides, setSkillRateOverrides] = useState({});
    const [skillRateDrafts, setSkillRateDrafts] = useState({});
    const [skillRateModes, setSkillRateModes] = useState({});
    const [skillDurationHours, setSkillDurationHours] = useState({});
    const [skillDurationDays, setSkillDurationDays] = useState({});
    const [skillDurationHoursDrafts, setSkillDurationHoursDrafts] = useState({});
    const [skillDurationDaysDrafts, setSkillDurationDaysDrafts] = useState({});
    const [skillDurationDraftSource, setSkillDurationDraftSource] = useState({});
    const [skillNegotiationDrafts, setSkillNegotiationDrafts] = useState({});
    const [skillNegotiationWarnings, setSkillNegotiationWarnings] = useState({});
    const [lockedDemandMultiplier, setLockedDemandMultiplier] = useState(null);
    const [removedSkills, setRemovedSkills] = useState([]);
    const [durationChanged, setDurationChanged] = useState(false);
    const [durationDraftSource, setDurationDraftSource] = useState('');
    const [customBudget,    setCustomBudget]   = useState('');
    const [negotiable,      setNegotiable]     = useState(false);
    const [minBudget,       setMinBudget]      = useState('');

    // Schedule fields (shown in Describe)
    const [scheduledDate,   setScheduledDate]  = useState('');
    const [scheduledTime,   setScheduledTime]  = useState('');
    const [shift,           setShift]          = useState('');
    const [scheduleError,   setScheduleError]  = useState('');

    // Step 4 — location
    const [location,   setLocation]   = useState(EMPTY_JOB_LOCATION);
    const [geoLoading, setGeoLoading] = useState(false);
    const [geoError,   setGeoError]   = useState('');

    // Step 5 — photos
    const [photoDrafts, setPhotoDrafts] = useState([]);
    const photoRef = useRef();
    const [clientConfirmedDetails, setClientConfirmedDetails] = useState(false);
    const [previewImageUrl, setPreviewImageUrl] = useState('');
    const draftPersistWarnedRef = useRef(false);

    const [posting, setPosting] = useState(false);

    const isKnownTopCity = cityOptions.some((opt) => opt.label === city);
    const topCitySelectValue = (isTopCityOther || (city && !isKnownTopCity)) ? OTHER_CITY_OPTION : (city || '');

    const normalizeText = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9\s,]/g, ' ').replace(/\s+/g, ' ').trim();

    const getLocalityTokens = () => {
        const raw = String(resolvedLocality || '');
        return raw
            .split(',')
            .map((part) => normalizeText(part))
            .filter((part) => part.length > 1);
    };

    const validateAddressAgainstDescribe = (addressText) => {
        const normalizedAddress = normalizeText(addressText);
        const cityToken = normalizeText(city);
        const localityTokens = getLocalityTokens();

        const hasCity = cityToken ? normalizedAddress.includes(cityToken) : false;
        const hasLocality = localityTokens.length ? localityTokens.some((token) => normalizedAddress.includes(token)) : false;

        if (hasCity && hasLocality) {
            return { valid: true, message: '' };
        }

        const missing = [];
        if (!hasCity) missing.push('city');
        if (!hasLocality) missing.push('locality');
        return {
            valid: false,
            message: `Full address must include ${missing.join(' and ')} from Describe section.`,
        };
    };

    const setAnswer = (id, val) => setAnswers(p => ({ ...p, [id]: val }));
    useEffect(() => { if (scheduledTime) setShift(detectShift(scheduledTime)); }, [scheduledTime]);
    useEffect(() => {
        setLocation((l) => ({ ...l, city: city || '', locality: l.locality || '' }));
    }, [city]);
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const { data } = await getRateTableCities();
                if (!active) return;
                setCityOptions(Array.isArray(data?.cities) ? data.cities : []);
            } catch {
                if (!active) return;
                setCityOptions([]);
            }
        })();
        return () => { active = false; };
    }, []);

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(JOB_POST_DRAFT_KEY);
            if (!raw) return;
            const draft = JSON.parse(raw);
            if (!draft || typeof draft !== 'object') return;

            setStep(Math.max(0, Math.min(STEPS.length - 1, Number(draft.step) || 0)));
            setDescription(String(draft.description || ''));
            setCity(String(draft.city || ''));
            setUrgent(Boolean(draft.urgent));
            setQuestions(Array.isArray(draft.questions) ? draft.questions : []);
            setQuestionSourceKey(String(draft.questionSourceKey || ''));
            setAnswers(draft.answers && typeof draft.answers === 'object' ? draft.answers : {});
            setEstimate(draft.estimate && typeof draft.estimate === 'object' ? draft.estimate : null);
            setEditableSkills(Array.isArray(draft.editableSkills) ? draft.editableSkills : []);
            setNewSkillInput(String(draft.newSkillInput || ''));
            setSelectedSkillOption(String(draft.selectedSkillOption || ''));
            setSkillsChanged(Boolean(draft.skillsChanged));
            setWorkerCountChanged(Boolean(draft.workerCountChanged));
            setTitle(String(draft.title || ''));
            setTitleDraft(String(draft.titleDraft || ''));
            setDurationDays(Math.max(0, Number(draft.durationDays) || 0));
            setDurationHours(Math.max(0, Number(draft.durationHours) || 0));
            setDurationDaysDraft(String(draft.durationDaysDraft || ''));
            setDurationHoursDraft(String(draft.durationHoursDraft || ''));
            setWorkersRequired(Math.max(1, Number(draft.workersRequired) || 1));
            setSkillWorkerCounts(draft.skillWorkerCounts && typeof draft.skillWorkerCounts === 'object' ? draft.skillWorkerCounts : {});
            setSkillWorkerCountDrafts(draft.skillWorkerCountDrafts && typeof draft.skillWorkerCountDrafts === 'object' ? draft.skillWorkerCountDrafts : {});
            setSkillRateAnchors(draft.skillRateAnchors && typeof draft.skillRateAnchors === 'object' ? draft.skillRateAnchors : {});
            setSkillRateOverrides(draft.skillRateOverrides && typeof draft.skillRateOverrides === 'object' ? draft.skillRateOverrides : {});
            setSkillRateDrafts(draft.skillRateDrafts && typeof draft.skillRateDrafts === 'object' ? draft.skillRateDrafts : {});
            setSkillRateModes(draft.skillRateModes && typeof draft.skillRateModes === 'object' ? draft.skillRateModes : {});
            setSkillDurationHours(draft.skillDurationHours && typeof draft.skillDurationHours === 'object' ? draft.skillDurationHours : {});
            setSkillDurationDays(draft.skillDurationDays && typeof draft.skillDurationDays === 'object' ? draft.skillDurationDays : {});
            setSkillDurationHoursDrafts(draft.skillDurationHoursDrafts && typeof draft.skillDurationHoursDrafts === 'object' ? draft.skillDurationHoursDrafts : {});
            setSkillDurationDaysDrafts(draft.skillDurationDaysDrafts && typeof draft.skillDurationDaysDrafts === 'object' ? draft.skillDurationDaysDrafts : {});
            setSkillDurationDraftSource(draft.skillDurationDraftSource && typeof draft.skillDurationDraftSource === 'object' ? draft.skillDurationDraftSource : {});
            setSkillNegotiationDrafts(draft.skillNegotiationDrafts && typeof draft.skillNegotiationDrafts === 'object' ? draft.skillNegotiationDrafts : {});
            setSkillNegotiationWarnings(draft.skillNegotiationWarnings && typeof draft.skillNegotiationWarnings === 'object' ? draft.skillNegotiationWarnings : {});
            setLockedDemandMultiplier(draft.lockedDemandMultiplier ?? null);
            setRemovedSkills(Array.isArray(draft.removedSkills) ? draft.removedSkills : []);
            setDurationChanged(Boolean(draft.durationChanged));
            setDurationDraftSource(String(draft.durationDraftSource || ''));
            setCustomBudget(String(draft.customBudget || ''));
            setNegotiable(Boolean(draft.negotiable));
            setMinBudget(String(draft.minBudget || ''));
            setScheduledDate(String(draft.scheduledDate || ''));
            setScheduledTime(String(draft.scheduledTime || ''));
            setShift(String(draft.shift || ''));
            setScheduleError(String(draft.scheduleError || ''));
            setLocation(draft.location && typeof draft.location === 'object'
                ? {
                    city: String(draft.location.city || ''),
                    locality: String(draft.location.locality || ''),
                    state: String(draft.location.state || ''),
                    pincode: String(draft.location.pincode || ''),
                    fullAddress: String(draft.location.fullAddress || ''),
                    buildingName: String(draft.location.buildingName || ''),
                    unitNumber: String(draft.location.unitNumber || ''),
                    floorNumber: String(draft.location.floorNumber || ''),
                    lat: Number.isFinite(Number(draft.location.lat)) ? Number(draft.location.lat) : null,
                    lng: Number.isFinite(Number(draft.location.lng)) ? Number(draft.location.lng) : null,
                }
                : EMPTY_JOB_LOCATION,
            );

            const restoredPhotoDrafts = Array.isArray(draft.photoDrafts)
                ? draft.photoDrafts
                    .filter((item) => item && typeof item === 'object' && String(item.dataUrl || '').startsWith('data:image/'))
                    .slice(0, MAX_JOB_PHOTOS)
                    .map((item) => ({
                        name: String(item.name || 'work-photo.jpg'),
                        type: String(item.type || 'image/jpeg'),
                        size: Math.max(0, Number(item.size) || 0),
                        dataUrl: String(item.dataUrl || ''),
                    }))
                : [];
            setPhotoDrafts(restoredPhotoDrafts);

            setClientConfirmedDetails(Boolean(draft.clientConfirmedDetails));
            setIsTopCityOther(Boolean(draft.isTopCityOther));
        } catch {
            // Ignore malformed drafts.
        }
    }, []);

    useEffect(() => {
        const draftPayload = {
            step,
            description,
            city,
            urgent,
            questions,
            questionSourceKey,
            answers,
            estimate,
            editableSkills,
            newSkillInput,
            selectedSkillOption,
            skillsChanged,
            workerCountChanged,
            title,
            titleDraft,
            durationDays,
            durationHours,
            durationDaysDraft,
            durationHoursDraft,
            workersRequired,
            skillWorkerCounts,
            skillWorkerCountDrafts,
            skillRateAnchors,
            skillRateOverrides,
            skillRateDrafts,
            skillRateModes,
            skillDurationHours,
            skillDurationDays,
            skillDurationHoursDrafts,
            skillDurationDaysDrafts,
            skillDurationDraftSource,
            skillNegotiationDrafts,
            skillNegotiationWarnings,
            lockedDemandMultiplier,
            removedSkills,
            durationChanged,
            durationDraftSource,
            customBudget,
            negotiable,
            minBudget,
            scheduledDate,
            scheduledTime,
            shift,
            scheduleError,
            location,
            photoDrafts,
            clientConfirmedDetails,
            isTopCityOther,
        };

        try {
            sessionStorage.setItem(JOB_POST_DRAFT_KEY, JSON.stringify(draftPayload));
            draftPersistWarnedRef.current = false;
        } catch {
            if (!draftPersistWarnedRef.current) {
                toast.error('Draft storage is full. Some data may not persist on refresh.');
                draftPersistWarnedRef.current = true;
            }
        }
    }, [
        step, description, city, urgent, questions, questionSourceKey, answers, estimate,
        editableSkills, newSkillInput, selectedSkillOption, skillsChanged, workerCountChanged,
        title, titleDraft, durationDays, durationHours, durationDaysDraft, durationHoursDraft,
        workersRequired, skillWorkerCounts, skillWorkerCountDrafts, skillRateAnchors,
        skillRateOverrides, skillRateDrafts, skillRateModes, skillDurationHours,
        skillDurationDays, skillDurationHoursDrafts, skillDurationDaysDrafts,
        skillDurationDraftSource, skillNegotiationDrafts, skillNegotiationWarnings,
        lockedDemandMultiplier, removedSkills, durationChanged, durationDraftSource,
        customBudget, negotiable, minBudget, scheduledDate, scheduledTime, shift,
        scheduleError, location, photoDrafts, clientConfirmedDetails, isTopCityOther,
    ]);

    const getDurationValue = () => getDurationLabel(durationDays, durationHours);
    const resolvedLocality = String(location?.locality || '').trim();

    const parsePositiveIntegerOr = (rawValue, fallback = 1) => {
        const parsed = Number(String(rawValue ?? '').trim());
        if (!Number.isFinite(parsed)) return Math.max(1, Number(fallback) || 1);
        return Math.max(1, Math.round(parsed));
    };

    const parseWorkerCountOr = (rawValue, fallback = 1) => {
        const parsed = parsePositiveIntegerOr(rawValue, fallback);
        return Math.min(6, parsed);
    };

    const getSkillDurationHoursValue = (skill, fallback = 1) => {
        const key = String(skill || '').trim().toLowerCase();
        if (!key) return Math.max(1, Number(fallback) || 1);
        const draftHours = Number(skillDurationHoursDrafts?.[key]);
        if (Number.isFinite(draftHours) && draftHours > 0) return Math.round(draftHours);
        const committedHours = Number(skillDurationHours?.[key]);
        if (Number.isFinite(committedHours) && committedHours > 0) return Math.round(committedHours);
        const item = getSkillBreakdownItem(key);
        const itemHours = Number(item?.hours);
        if (Number.isFinite(itemHours) && itemHours > 0) return Math.round(itemHours);
        return Math.max(1, Number(fallback) || 1);
    };

    const getSkillDurationDaysValue = (skill, fallback = 1) => {
        const key = String(skill || '').trim().toLowerCase();
        if (!key) return Math.max(1, Number(fallback) || 1);
        const draftDays = Number(skillDurationDaysDrafts?.[key]);
        if (Number.isFinite(draftDays) && draftDays > 0) return Math.round(draftDays);
        const committedDays = Number(skillDurationDays?.[key]);
        if (Number.isFinite(committedDays) && committedDays > 0) return Math.round(committedDays);
        const fallbackHours = getSkillDurationHoursValue(key, fallback);
        return Math.max(1, Math.ceil(fallbackHours / HOURS_PER_DAY));
    };

    const resolveSkillDurationHoursMap = () => {
        const resolved = {};
        editableSkills.forEach((skill) => {
            const key = String(skill || '').trim().toLowerCase();
            if (!key) return;
            const fallback = Number(skillDurationHours?.[key]) || Number(getSkillBreakdownItem(key)?.hours) || durationHours || 1;
            const source = String(skillDurationDraftSource?.[key] || '').toLowerCase();
            if (source === 'days') {
                const draftDays = parsePositiveIntegerOr(skillDurationDaysDrafts?.[key], Math.ceil(fallback / HOURS_PER_DAY));
                resolved[key] = Math.max(1, draftDays * HOURS_PER_DAY);
                return;
            }
            if (source === 'hours') {
                resolved[key] = parsePositiveIntegerOr(skillDurationHoursDrafts?.[key], fallback);
                return;
            }

            const draftHoursRaw = String(skillDurationHoursDrafts?.[key] ?? '').trim();
            const draftDaysRaw = String(skillDurationDaysDrafts?.[key] ?? '').trim();
            if (draftHoursRaw) {
                resolved[key] = parsePositiveIntegerOr(draftHoursRaw, fallback);
                return;
            }
            if (draftDaysRaw) {
                const draftDays = parsePositiveIntegerOr(draftDaysRaw, Math.ceil(fallback / HOURS_PER_DAY));
                resolved[key] = Math.max(1, draftDays * HOURS_PER_DAY);
                return;
            }

            resolved[key] = parsePositiveIntegerOr(skillDurationHours?.[key], fallback);
        });
        return resolved;
    };

    const getMinimumGlobalHoursFromSkills = (resolvedSkillHoursMap = null) => {
        const skillHoursMap = resolvedSkillHoursMap || resolveSkillDurationHoursMap();
        const totalSkillHours = Object.values(skillHoursMap || {}).reduce((sum, val) => sum + Math.max(1, Number(val) || 1), 0);
        return Math.max(1, totalSkillHours || 1);
    };

    const getAdjustedGlobalDurationFromSkills = (resolvedSkillHoursMap, fallbackDays, fallbackHours) => {
        const safeFallbackHours = parsePositiveIntegerOr(fallbackHours, durationHours || 1);
        const values = Object.values(resolvedSkillHoursMap || {}).map((val) => Math.max(1, Number(val) || 1));
        if (!values.length) {
            return {
                days: Math.max(1, Math.ceil(safeFallbackHours / HOURS_PER_DAY)),
                hours: safeFallbackHours,
            };
        }
        const totalSkillHours = values.reduce((sum, val) => sum + val, 0);
        // Global duration is auto-driven by skill-wise durations and must satisfy minimum restrictions.
        const adjustedHours = Math.max(1, totalSkillHours);
        return {
            days: Math.max(1, Math.ceil(adjustedHours / HOURS_PER_DAY)),
            hours: adjustedHours,
        };
    };

    const normalizeRateMode = (rawMode, fallback = 'day') => {
        const mode = String(rawMode || '').trim().toLowerCase();
        return RATE_INPUT_MODES.includes(mode) ? mode : fallback;
    };

    const getSkillRateAnchor = (skill, mode = 'day') => {
        const key = String(skill || '').trim().toLowerCase();
        const item = getSkillBreakdownItem(key);
        const anchor = skillRateAnchors?.[key] || {};
        const normalizedMode = normalizeRateMode(mode, 'day');
        
        if (normalizedMode === 'visit') {
            return Math.max(0,
                Number(anchor?.visit) ||
                Number(item?.sourceRatePerVisitBase) ||
                Number(item?.ratePerVisitBase) ||
                Number(item?.perWorkerCostBase) ||
                Number(item?.ratePerVisit) ||
                0,
            );
        }
        
        if (normalizedMode === 'hour') {
            const hourAnchor = Number(anchor?.hour) || Number(item?.sourceRatePerHourBase) || 0;
            if (hourAnchor > 0) return hourAnchor;
            const dayAnchor = Number(anchor?.day) || Number(item?.sourceRatePerDayBase) || Number(item?.ratePerDayBase) || Number(item?.ratePerDay) || 0;
            return dayAnchor > 0 ? Math.round(dayAnchor / HOURS_PER_DAY) : 0;
        }
        
        return Math.max(0,
            Number(anchor?.day) ||
            Number(item?.sourceRatePerDayBase) ||
            Number(item?.ratePerDayBase) ||
            Number(item?.ratePerDay) ||
            0,
        );
    };

    const clampManualSkillRate = (skill, mode, value) => {
        const normalizedMode = normalizeRateMode(mode, 'day');
        const anchor = getSkillRateAnchor(skill, normalizedMode);
        const numericValue = Math.max(0, Number(value) || 0);
        if (!(anchor > 0) || numericValue <= 0) return numericValue;
        const min = Math.round(anchor * (1 - MANUAL_RATE_VARIANCE));
        const max = Math.round(anchor * (1 + MANUAL_RATE_VARIANCE));
        return Math.min(Math.max(numericValue, min), max);
    };

    const getSkillBreakdownItem = (skill) => {
        const key = String(skill || '').trim().toLowerCase();
        const rows = Array.isArray(estimate?.budgetBreakdown?.breakdown) ? estimate.budgetBreakdown.breakdown : [];
        return rows.find((row) => String(row?.skill || '').trim().toLowerCase() === key) || null;
    };

    const getSkillNegotiationRange = (skill) => {
        const item = getSkillBreakdownItem(skill);
        if (!item) return { min: 0, max: 0 };
        const subtotal = Math.max(0, Number(item?.subtotal) || 0);
        const range = item?.negotiationRange || {};
        const min = Math.max(0, Number(range?.min) || Math.round(subtotal * 0.88));
        const max = Math.max(min, Number(range?.max) || Math.round(subtotal * 1.08));
        return { min, max };
    };

    const getSkillNegotiationWarning = (min, max) => `Please enter a value within ${formatCurrency(min)} - ${formatCurrency(max)}. It should not be 0 or outside the range.`;

    const sanitizeSkillNegotiationValue = (rawValue) => String(rawValue ?? '').replace(/[^0-9]/g, '');

    const validateSkillNegotiationDraft = (skill, rawValue) => {
        const key = String(skill || '').trim().toLowerCase();
        if (!key) return true;
        const { min, max } = getSkillNegotiationRange(key);
        const cleaned = sanitizeSkillNegotiationValue(rawValue ?? skillNegotiationDrafts?.[key] ?? '');
        const numeric = cleaned === '' ? NaN : Number(cleaned);
        if (!cleaned || !Number.isFinite(numeric) || numeric <= 0 || numeric < min || numeric > max) {
            setSkillNegotiationWarnings((prev) => ({ ...prev, [key]: getSkillNegotiationWarning(min, max) }));
            return false;
        }

        setSkillNegotiationDrafts((prev) => ({ ...prev, [key]: String(Math.round(numeric)) }));
        setSkillNegotiationWarnings((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
        return true;
    };

    const validateAllSkillNegotiationDrafts = () => {
        const nextWarnings = {};
        let isValid = true;

        (Array.isArray(estimate?.budgetBreakdown?.breakdown) ? estimate.budgetBreakdown.breakdown : []).forEach((item) => {
            const key = String(item?.skill || '').trim().toLowerCase();
            if (!key) return;
            const { min, max } = getSkillNegotiationRange(key);
            const cleaned = sanitizeSkillNegotiationValue(skillNegotiationDrafts?.[key] ?? '');
            const numeric = cleaned === '' ? NaN : Number(cleaned);
            if (!cleaned || !Number.isFinite(numeric) || numeric <= 0 || numeric < min || numeric > max) {
                nextWarnings[key] = getSkillNegotiationWarning(min, max);
                isValid = false;
            }
        });

        setSkillNegotiationWarnings(nextWarnings);
        return isValid;
    };

    const handleSkillNegotiationChange = (skill, rawValue) => {
        const key = String(skill || '').trim().toLowerCase();
        if (!key) return;
        const cleaned = sanitizeSkillNegotiationValue(rawValue);
        setSkillNegotiationDrafts((prev) => ({ ...prev, [key]: cleaned }));
        if (cleaned === '') return;
        const { min, max } = getSkillNegotiationRange(key);
        const numeric = Number(cleaned);
        if (!Number.isFinite(numeric) || numeric <= 0 || numeric < min || numeric > max) return;
        setSkillNegotiationWarnings((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const toggleNegotiation = () => {
        setNegotiable((prev) => {
            const next = !prev;
            const total = Number(estimate?.budgetBreakdown?.totalEstimated) || 0;
            setCustomBudget(String(total));
            setMinBudget(String(Math.round(total * 0.8)));
            if (!next) setSkillNegotiationWarnings({});
            return next;
        });
    };

    const getRateBaseForMode = (skill, mode = 'day') => {
        const normalizedMode = normalizeRateMode(mode, 'day');
        return getSkillRateAnchor(skill, normalizedMode);
    };

    const convertRateFromModeToMode = (skill, fromMode, toMode, fromRate) => {
        const normalizedFromMode = normalizeRateMode(fromMode, 'day');
        const normalizedToMode = normalizeRateMode(toMode, 'day');
        if (normalizedFromMode === normalizedToMode) return fromRate;
        
        const rate = Math.max(0, Number(fromRate) || 0);
        if (rate <= 0) return getRateBaseForMode(skill, normalizedToMode);
        
        if (normalizedFromMode === 'day' && normalizedToMode === 'hour') {
            return Math.round(rate / HOURS_PER_DAY);
        }
        if (normalizedFromMode === 'hour' && normalizedToMode === 'day') {
            return Math.round(rate * HOURS_PER_DAY);
        }
        return getRateBaseForMode(skill, normalizedToMode);
    };

    const commitDurationDrafts = () => {
        let nextDays = parsePositiveIntegerOr(durationDaysDraft, durationDays || 1);
        let nextHours = parsePositiveIntegerOr(durationHoursDraft, durationHours || 1);
        if (nextDays === 0) {
            toast.error('Duration days cannot be 0. Minimum is 1 day.');
            nextDays = durationDays || 1;
        }
        if (nextHours === 0) {
            toast.error('Duration hours cannot be 0. Minimum is 1 hour.');
            nextHours = durationHours || 1;
        }
        let syncedHours = durationDraftSource === 'hours'
            ? Math.max(1, nextHours)
            : Math.max(1, nextDays * HOURS_PER_DAY);

        const minimumGlobalHours = getMinimumGlobalHoursFromSkills();
        if (syncedHours < minimumGlobalHours) {
            syncedHours = minimumGlobalHours;
            toast.error(`Global duration must be at least total skill duration (${minimumGlobalHours} hours).`);
        }

        const syncedDays = Math.max(1, Math.ceil(syncedHours / HOURS_PER_DAY));
        setDurationDays(syncedDays);
        setDurationHours(syncedHours);
        setDurationDaysDraft(String(syncedDays));
        setDurationHoursDraft(String(syncedHours));
        setDurationDraftSource('');
    };

    const validateScheduleFields = (showToast = false) => {
        setScheduleError('');

        if (!scheduledDate) {
            const msg = 'Please select a work date.';
            setScheduleError(msg);
            if (showToast) toast.error(msg);
            return false;
        }

        if (!scheduledTime) {
            const msg = 'Please select a start time.';
            setScheduleError(msg);
            if (showToast) toast.error(msg);
            return false;
        }

        const selDate = new Date(`${scheduledDate}T00:00:00`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selDate < today) {
            const msg = 'Date cannot be in the past.';
            setScheduleError(msg);
            if (showToast) toast.error(msg);
            return false;
        }

        const startMins = toMins(scheduledTime);
        if (startMins === null || startMins < WORK_START_MINS || startMins > WORK_END_MINS) {
            const msg = 'Work time must be between 6:00 AM and 9:00 PM.';
            setScheduleError(msg);
            if (showToast) toast.error(msg);
            return false;
        }

        const [h, m] = scheduledTime.split(':').map(Number);
        const sched = new Date(`${scheduledDate}T00:00:00`);
        sched.setHours(h, m, 0, 0);
        const minsUntil = (sched.getTime() - Date.now()) / 60000;
        if (minsUntil < 50) {
            const msg = `Scheduled time must be at least 50 minutes from now. Current time: ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}. Please choose a later time.`;
            setScheduleError(msg);
            if (showToast) toast.error(msg);
            return false;
        }

        return true;
    };

    const buildQuestionSourceKey = () => JSON.stringify({
        description: String(description || '').trim().toLowerCase(),
        city: String(city || '').trim().toLowerCase(),
        locality: String(resolvedLocality || '').trim().toLowerCase(),
        urgent: Boolean(urgent),
        scheduledDate: String(scheduledDate || '').trim(),
        scheduledTime: String(scheduledTime || '').trim(),
    });

    const applyEstimateData = (data, { preserveManualSkillCounts = false } = {}) => {
        setEstimate(data);
        if (!(Number(lockedDemandMultiplier) > 0)) {
            const firstMultiplier = Number(data?.demandFactor) || Number(data?.demandMultipliers?.finalMultiplier) || 0;
            if (firstMultiplier > 0) setLockedDemandMultiplier(firstMultiplier);
        }

        const durationParts = deriveDurationPartsFromBudget(data?.budgetBreakdown || {});

        const aiSkills = (data?.skillBlocks || []).map((b) => String(b?.skill || '').trim().toLowerCase()).filter(Boolean);
        setEditableSkills(aiSkills);
        setRemovedSkills([]);

        const aiCountMap = buildSkillWorkerCountMap(data);
        const nextCountMap = preserveManualSkillCounts
            ? mergeSkillWorkerCounts(aiSkills, skillWorkerCounts, aiCountMap)
            : mergeSkillWorkerCounts(aiSkills, aiCountMap, {});

        setSkillWorkerCounts(nextCountMap);
        setSkillWorkerCountDrafts(Object.fromEntries(Object.entries(nextCountMap).map(([k, v]) => [k, String(Math.max(1, Number(v) || 1))])));
        setWorkersRequired(getTotalWorkersFromMap(nextCountMap) || Math.max(1, Number(data?.budgetBreakdown?.totalWorkers) || 1));

        const nextAnchors = {};
        const nextRates = {};
        const nextModes = {};
        const nextSkillHours = {};
        const nextSkillDays = {};
        const nextNegotiationDrafts = {};
        (Array.isArray(data?.budgetBreakdown?.breakdown) ? data.budgetBreakdown.breakdown : []).forEach((item) => {
            const key = String(item?.skill || '').trim().toLowerCase();
            if (!key) return;
            const aiSkillHours = Math.max(1, Number(item?.hours) || 1);
            const aiSkillDays = Math.max(1, Math.ceil(aiSkillHours / HOURS_PER_DAY));
            const persistedSkillHours = preserveManualSkillCounts
                ? parsePositiveIntegerOr(skillDurationHoursDrafts?.[key], skillDurationHours?.[key] || aiSkillHours)
                : aiSkillHours;
            const persistedSkillDays = Math.max(1, Math.ceil(persistedSkillHours / HOURS_PER_DAY));
            nextSkillHours[key] = persistedSkillHours;
            nextSkillDays[key] = persistedSkillDays;
            const allowedRateModesForSkill = getAllowedRateModesForDuration(persistedSkillDays, persistedSkillHours);
            const preferredRateModeForSkill = getPreferredRateModeForDuration(persistedSkillDays, persistedSkillHours);
            const sourceDay = Math.max(0,
                Number(item?.sourceRatePerDayBase) ||
                Number(item?.ratePerDayBase) ||
                Number(item?.ratePerDay) ||
                0,
            );
            const sourceHour = Math.max(0, Number(item?.sourceRatePerHourBase) || 0);
            const sourceVisit = Math.max(0,
                Number(item?.sourceRatePerVisitBase) ||
                Number(item?.ratePerVisitBase) ||
                Number(item?.perWorkerCostBase) ||
                Number(item?.ratePerVisit) ||
                0,
            );
            const itemMode = normalizeRateMode(item?.rateInputMode, preferredRateModeForSkill);
            const mode = allowedRateModesForSkill.includes(itemMode) ? itemMode : preferredRateModeForSkill;
            nextAnchors[key] = {
                day: sourceDay,
                hour: sourceHour,
                visit: sourceVisit,
            };
            nextModes[key] = mode;
            const defaultRate = mode === 'visit' ? sourceVisit : mode === 'hour' ? sourceHour : sourceDay;
            const manualRate = preserveManualSkillCounts ? skillRateOverrides?.[key] : null;
            const nextRate = clampManualSkillRate(key, mode, manualRate > 0 ? manualRate : defaultRate);
            nextRates[key] = nextRate;

            const subtotal = Math.max(0, Number(item?.subtotal) || 0);
            const range = item?.negotiationRange || {};
            const rangeMin = Math.max(0, Number(range?.min) || Math.round(subtotal * 0.88));
            const rangeMax = Math.max(rangeMin, Number(range?.max) || Math.round(subtotal * 1.08));
            const midpoint = Math.round(subtotal || ((rangeMin + rangeMax) / 2));
            nextNegotiationDrafts[key] = String(Math.max(rangeMin, Math.min(rangeMax, midpoint)));
        });
        setSkillRateAnchors((prev) => {
            const next = preserveManualSkillCounts ? { ...prev } : {};
            Object.entries(nextAnchors).forEach(([skill, anchors]) => {
                const existing = next[skill] || {};
                next[skill] = {
                    day: Number(existing.day) > 0 ? existing.day : anchors.day,
                    hour: Number(existing.hour) > 0 ? existing.hour : anchors.hour,
                    visit: Number(existing.visit) > 0 ? existing.visit : anchors.visit,
                };
            });
            return next;
        });
        const mergedModes = { ...nextModes };
        if (preserveManualSkillCounts) {
            Object.keys(skillRateModes || {}).forEach((skill) => {
                if (!mergedModes[skill]) return;
                const skillHours = nextSkillHours?.[skill] || 1;
                const skillDays = nextSkillDays?.[skill] || 1;
                const allowedRateModesForSkill = getAllowedRateModesForDuration(skillDays, skillHours);
                const preferred = normalizeRateMode(skillRateModes[skill], mergedModes[skill]);
                mergedModes[skill] = allowedRateModesForSkill.includes(preferred) ? preferred : mergedModes[skill];
            });
        }
        const mergedRates = { ...nextRates };
        if (preserveManualSkillCounts) {
            Object.keys(skillRateOverrides || {}).forEach((skill) => {
                if (mergedRates[skill] === undefined) return;
                const skillHours = nextSkillHours?.[skill] || 1;
                const skillDays = nextSkillDays?.[skill] || 1;
                const preferredRateModeForSkill = getPreferredRateModeForDuration(skillDays, skillHours);
                const mode = normalizeRateMode(mergedModes[skill], preferredRateModeForSkill);
                const manual = Math.max(0, Number(skillRateOverrides[skill]) || 0);
                if (manual > 0) mergedRates[skill] = clampManualSkillRate(skill, mode, manual);
            });
        }
        setSkillRateModes(mergedModes);
        setSkillRateOverrides(mergedRates);
        setSkillRateDrafts(Object.fromEntries(Object.entries(mergedRates).map(([k, v]) => [k, String(Math.max(0, Number(v) || 0))])));
        setSkillDurationHours(nextSkillHours);
        setSkillDurationDays(nextSkillDays);
        setSkillDurationHoursDrafts(Object.fromEntries(Object.entries(nextSkillHours).map(([k, v]) => [k, String(Math.max(1, Number(v) || 1))])));
        setSkillDurationDaysDrafts(Object.fromEntries(Object.entries(nextSkillDays).map(([k, v]) => [k, String(Math.max(1, Number(v) || 1))])));
        setSkillDurationDraftSource({});
        setSkillNegotiationDrafts(nextNegotiationDrafts);
        setSkillNegotiationWarnings({});

        const total = data?.budgetBreakdown?.totalEstimated || 0;
        setCustomBudget(String(total));
        setMinBudget(String(Math.round(total * 0.8)));
        setDurationDays(durationParts.days);
        setDurationHours(durationParts.hours);
        setDurationDaysDraft(String(Math.max(1, Number(durationParts.days) || 1)));
        setDurationHoursDraft(String(Math.max(1, Number(durationParts.hours) || 1)));
        setDurationChanged(false);
        setDurationDraftSource('');

        const nextAutoTitle = String(data?.jobTitle || description.slice(0, 60).trim() || '').trim();
        if (titleAutoManagedRef.current || !title.trim()) {
            setTitle(nextAutoTitle);
            titleAutoManagedRef.current = true;
        }
        setTitleDraft(buildThreeLineTitleDraft({
            skills: aiSkills,
            workersRequired: getTotalWorkersFromMap(nextCountMap) || 1,
            city,
            budget: total,
            duration: getDurationLabel(durationParts.days, durationParts.hours),
            description,
        }));
    };

    const removeSkill = (idx) => {
        setEditableSkills((prev) => {
            const removed = prev[idx];
            const next = prev.filter((_, i) => i !== idx);
            if (removed) {
                setRemovedSkills((old) => [...new Set([...old, String(removed).toLowerCase()])]);
            }
            setSkillWorkerCounts((prevCounts) => {
                const updated = mergeSkillWorkerCounts(next, {}, prevCounts);
                setWorkersRequired(getTotalWorkersFromMap(updated));
                return updated;
            });
            setSkillWorkerCountDrafts((prevDrafts) => {
                const updated = { ...prevDrafts };
                if (removed) delete updated[String(removed).toLowerCase()];
                return updated;
            });
            setSkillRateOverrides((prevRates) => {
                const updated = { ...prevRates };
                if (removed) delete updated[String(removed).toLowerCase()];
                return updated;
            });
            setSkillRateDrafts((prevRates) => {
                const updated = { ...prevRates };
                if (removed) delete updated[String(removed).toLowerCase()];
                return updated;
            });
            setSkillRateModes((prevModes) => {
                const updated = { ...prevModes };
                if (removed) delete updated[String(removed).toLowerCase()];
                return updated;
            });
            setSkillDurationHours((prevHours) => {
                const updated = { ...prevHours };
                if (removed) delete updated[String(removed).toLowerCase()];
                return updated;
            });
            setSkillDurationDays((prevDays) => {
                const updated = { ...prevDays };
                if (removed) delete updated[String(removed).toLowerCase()];
                return updated;
            });
            setSkillDurationHoursDrafts((prevHours) => {
                const updated = { ...prevHours };
                if (removed) delete updated[String(removed).toLowerCase()];
                return updated;
            });
            setSkillDurationDaysDrafts((prevDays) => {
                const updated = { ...prevDays };
                if (removed) delete updated[String(removed).toLowerCase()];
                return updated;
            });
            setSkillDurationDraftSource((prevSource) => {
                const updated = { ...prevSource };
                if (removed) delete updated[String(removed).toLowerCase()];
                return updated;
            });
            return next;
        });
        setSkillsChanged(true);
    };
    const addSkill = () => {
        const sk = newSkillInput.trim().toLowerCase();
        if (!sk) return toast.error('Enter a skill name.');
        if (editableSkills.includes(sk)) return toast.error('Already added.');
        const preferredMode = getPreferredRateModeForDuration(durationDays || 1, durationHours || 1);
        setEditableSkills(s => [...s, sk]);
        setRemovedSkills((old) => old.filter((item) => item !== sk));
        setSkillWorkerCounts((prev) => {
            const next = { ...prev, [sk]: Math.max(1, Number(prev?.[sk]) || 1) };
            setWorkersRequired(getTotalWorkersFromMap(next));
            return next;
        });
        setSkillWorkerCountDrafts((prev) => ({ ...prev, [sk]: String(Math.max(1, Number(skillWorkerCounts?.[sk]) || 1)) }));
        setSkillRateOverrides((prev) => ({ ...prev, [sk]: Math.max(0, Number(prev?.[sk]) || 0) }));
        setSkillRateDrafts((prev) => ({ ...prev, [sk]: String(Math.max(0, Number(skillRateOverrides?.[sk]) || 0)) }));
        setSkillRateModes((prev) => ({ ...prev, [sk]: normalizeRateMode(prev?.[sk], preferredMode) }));
        const fallbackHours = Math.max(1, Number(durationHours) || HOURS_PER_DAY);
        const fallbackDays = Math.max(1, Math.ceil(fallbackHours / HOURS_PER_DAY));
        setSkillDurationHours((prev) => ({ ...prev, [sk]: Math.max(1, Number(prev?.[sk]) || fallbackHours) }));
        setSkillDurationDays((prev) => ({ ...prev, [sk]: Math.max(1, Number(prev?.[sk]) || fallbackDays) }));
        setSkillDurationHoursDrafts((prev) => ({ ...prev, [sk]: String(Math.max(1, Number(skillDurationHours?.[sk]) || fallbackHours)) }));
        setSkillDurationDaysDrafts((prev) => ({ ...prev, [sk]: String(Math.max(1, Number(skillDurationDays?.[sk]) || fallbackDays)) }));
        setSkillDurationDraftSource((prev) => ({ ...prev, [sk]: '' }));
        setNewSkillInput('');
        setSelectedSkillOption('');
        setSkillsChanged(true);
    };

    const handleSkillRateModeChange = (skill, mode) => {
        const key = String(skill || '').trim().toLowerCase();
        if (!key) return;
        const skillHours = getSkillDurationHoursValue(key, durationHours || 1);
        const skillDays = Math.max(1, Math.ceil(skillHours / HOURS_PER_DAY));
        const allowedModes = getAllowedRateModesForDuration(skillDays, skillHours);
        const requestedMode = normalizeRateMode(mode, allowedModes[0] || 'day');
        const nextMode = allowedModes.includes(requestedMode) ? requestedMode : (allowedModes[0] || 'day');
        const currentRate = skillRateOverrides?.[key] || getRateBaseForMode(key, skillRateModes?.[key] || 'day');
        const convertedRate = convertRateFromModeToMode(key, skillRateModes?.[key] || 'day', nextMode, currentRate);
        const nextRate = clampManualSkillRate(key, nextMode, convertedRate);
        setSkillRateModes((prev) => ({ ...prev, [key]: nextMode }));
        setSkillRateOverrides((prev) => ({ ...prev, [key]: nextRate }));
        setSkillRateDrafts((prev) => ({ ...prev, [key]: String(nextRate) }));
        setSkillsChanged(true);
    };

    const handleSkillDurationDraftChange = (skill, field, value) => {
        const key = String(skill || '').trim().toLowerCase();
        if (!key) return;
        const raw = String(value ?? '').trim();
        if (!/^\d*$/.test(raw)) return;

        if (field === 'hours') {
            setSkillDurationHoursDrafts((prev) => ({ ...prev, [key]: raw }));
        } else {
            setSkillDurationDaysDrafts((prev) => ({ ...prev, [key]: raw }));
        }
        setSkillDurationDraftSource((prev) => ({ ...prev, [key]: field }));

        if (raw) {
            const previewSkillHours = resolveSkillDurationHoursMap();
            if (field === 'hours') {
                previewSkillHours[key] = parsePositiveIntegerOr(raw, getSkillDurationHoursValue(key, 1));
            } else {
                const previewDays = parsePositiveIntegerOr(raw, getSkillDurationDaysValue(key, 1));
                previewSkillHours[key] = Math.max(1, previewDays * HOURS_PER_DAY);
            }
            const adjustedGlobal = getAdjustedGlobalDurationFromSkills(previewSkillHours, durationDaysDraft, durationHoursDraft);
            setDurationHours(adjustedGlobal.hours);
            setDurationDays(adjustedGlobal.days);
            setDurationHoursDraft(String(adjustedGlobal.hours));
            setDurationDaysDraft(String(adjustedGlobal.days));
        }

        setDurationChanged(true);
    };

    const commitSkillDurationDrafts = (skill) => {
        const key = String(skill || '').trim().toLowerCase();
        if (!key) return;

        let nextHours = parsePositiveIntegerOr(skillDurationHoursDrafts?.[key], skillDurationHours?.[key] || 1);
        let nextDays = parsePositiveIntegerOr(skillDurationDaysDrafts?.[key], skillDurationDays?.[key] || Math.ceil(nextHours / HOURS_PER_DAY));
        const source = skillDurationDraftSource?.[key] || 'hours';

        if (source === 'days') {
            nextHours = Math.max(1, nextDays * HOURS_PER_DAY);
        } else {
            nextDays = Math.max(1, Math.ceil(nextHours / HOURS_PER_DAY));
        }

        const resolvedHours = resolveSkillDurationHoursMap();
        resolvedHours[key] = nextHours;
        const adjustedGlobal = getAdjustedGlobalDurationFromSkills(resolvedHours, durationDaysDraft, durationHoursDraft);
        setDurationHours(adjustedGlobal.hours);
        setDurationDays(adjustedGlobal.days);
        setDurationHoursDraft(String(adjustedGlobal.hours));
        setDurationDaysDraft(String(adjustedGlobal.days));

        setSkillDurationHours((prev) => ({ ...prev, [key]: nextHours }));
        setSkillDurationDays((prev) => ({ ...prev, [key]: nextDays }));
        setSkillDurationHoursDrafts((prev) => ({ ...prev, [key]: String(nextHours) }));
        setSkillDurationDaysDrafts((prev) => ({ ...prev, [key]: String(nextDays) }));
        setSkillDurationDraftSource((prev) => ({ ...prev, [key]: '' }));

        const allowedModes = getAllowedRateModesForDuration(nextDays, nextHours);
        const preferredMode = getPreferredRateModeForDuration(nextDays, nextHours);
        const currentMode = normalizeRateMode(skillRateModes?.[key], preferredMode);
        if (!allowedModes.includes(currentMode)) {
            const fallbackRate = clampManualSkillRate(key, preferredMode, getRateBaseForMode(key, preferredMode));
            setSkillRateModes((prev) => ({ ...prev, [key]: preferredMode }));
            setSkillRateOverrides((prev) => ({ ...prev, [key]: fallbackRate }));
            setSkillRateDrafts((prev) => ({ ...prev, [key]: String(fallbackRate) }));
        }
    };

    const handleSkillRateChange = (skill, value) => {
        const key = String(skill || '').trim().toLowerCase();
        if (!key) return;
        if (!/^\d*$/.test(String(value))) return;
        setSkillRateDrafts((prev) => ({ ...prev, [key]: String(value) }));
        setWorkerCountChanged(true);
    };

    const commitSkillRate = (skill) => {
        const key = String(skill || '').trim().toLowerCase();
        if (!key) return;
        const draftValue = skillRateDrafts?.[key];
        const strValue = String(draftValue ?? '').trim();
        const prevValue = skillRateOverrides?.[key] || 0;
        
        // If empty, revert to previous value
        if (!strValue) {
            if (prevValue === 0) {
                toast.error('Rate is required. Please enter a valid rate.');
            }
            setSkillRateOverrides((prev) => ({ ...prev, [key]: prevValue }));
            setSkillRateDrafts((prev) => ({ ...prev, [key]: String(prevValue) }));
            return;
        }
        
        const numVal = Math.max(0, Number(strValue) || 0);
        if (numVal === 0) {
            toast.error('Rate cannot be 0. Please enter a valid rate.');
            setSkillRateOverrides((prev) => ({ ...prev, [key]: prevValue }));
            setSkillRateDrafts((prev) => ({ ...prev, [key]: String(prevValue) }));
            return;
        }
        
        // Clamp to allowed range and warn if adjusted
        const nextRate = clampManualSkillRate(key, skillRateModes?.[key], numVal);
        if (nextRate !== numVal) {
            toast.error(`⚠️ Rate adjusted to allowed range: ₹${nextRate}`);
        }
        setSkillRateOverrides((prev) => ({ ...prev, [key]: nextRate }));
        setSkillRateDrafts((prev) => ({ ...prev, [key]: String(nextRate) }));
    };

    const handleSkillWorkerCountChange = (skill, value) => {
        const key = String(skill || '').trim().toLowerCase();
        if (!key) return;
        if (!/^\d*$/.test(String(value))) return;
        setSkillWorkerCountDrafts((prev) => ({ ...prev, [key]: String(value) }));
        setWorkerCountChanged(true);
    };

    const commitSkillWorkerCount = (skill) => {
        const key = String(skill || '').trim().toLowerCase();
        if (!key) return;
        const draftValue = skillWorkerCountDrafts?.[key];
        const nextCount = parseWorkerCountOr(draftValue, skillWorkerCounts?.[key] || 1);
        setSkillWorkerCounts((prev) => {
            const next = { ...prev, [key]: nextCount };
            setWorkersRequired(getTotalWorkersFromMap(next));
            return next;
        });
        setSkillWorkerCountDrafts((prev) => ({ ...prev, [key]: String(nextCount) }));
    };

    const resolveSkillWorkerCountMap = () => {
        const resolved = {};
        editableSkills.forEach((skill) => {
            const key = String(skill || '').trim().toLowerCase();
            if (!key) return;
            resolved[key] = parseWorkerCountOr(skillWorkerCountDrafts?.[key], skillWorkerCounts?.[key] || 1);
        });
        return resolved;
    };

    const resolveSkillRateMap = () => {
        const resolved = {};
        editableSkills.forEach((skill) => {
            const key = String(skill || '').trim().toLowerCase();
            if (!key) return;
            const resolvedHours = parsePositiveIntegerOr(skillDurationHoursDrafts?.[key], skillDurationHours?.[key] || 1);
            const resolvedDays = Math.max(1, Math.ceil(resolvedHours / HOURS_PER_DAY));
            const allowedModes = getAllowedRateModesForDuration(resolvedDays, resolvedHours);
            const fallbackMode = getPreferredRateModeForDuration(resolvedDays, resolvedHours);
            const selectedMode = normalizeRateMode(skillRateModes?.[key], fallbackMode);
            const effectiveMode = allowedModes.includes(selectedMode) ? selectedMode : fallbackMode;
            const draftValue = skillRateDrafts?.[key];
            const committedValue = skillRateOverrides?.[key];
            const nextRate = Math.max(0, Number(String(draftValue ?? committedValue ?? '').trim()) || 0);
            resolved[key] = clampManualSkillRate(key, effectiveMode, nextRate);
        });
        return resolved;
    };

    const resolveSkillRateModeMap = () => {
        const resolved = {};
        editableSkills.forEach((skill) => {
            const key = String(skill || '').trim().toLowerCase();
            if (!key) return;
            const resolvedHours = parsePositiveIntegerOr(skillDurationHoursDrafts?.[key], skillDurationHours?.[key] || 1);
            const resolvedDays = Math.max(1, Math.ceil(resolvedHours / HOURS_PER_DAY));
            const allowedModes = getAllowedRateModesForDuration(resolvedDays, resolvedHours);
            const fallbackMode = getPreferredRateModeForDuration(resolvedDays, resolvedHours);
            const requestedMode = normalizeRateMode(skillRateModes?.[key], fallbackMode);
            resolved[key] = allowedModes.includes(requestedMode) ? requestedMode : fallbackMode;
        });
        return resolved;
    };

    // Recalculate estimate after skill or worker count changes
    const handleRecalculate = async () => {
        try {
            setRecalcLoading(true);
            const answersText = {};
            questions.forEach(q => { if (answers[q.id]) answersText[q.question] = answers[q.id]; });
            // Build modified description with current skills
            const newDesc = `${description} (Required skills: ${editableSkills.join(', ')})`;
            const nextDays = parsePositiveIntegerOr(durationDaysDraft, durationDays || 1);
            const nextHours = parsePositiveIntegerOr(durationHoursDraft, durationHours || 1);
            const resolvedWorkerCounts = resolveSkillWorkerCountMap();
            const resolvedSkillDurations = resolveSkillDurationHoursMap();
            const resolvedRates = resolveSkillRateMap();
            const resolvedRateModes = resolveSkillRateModeMap();
            const resolvedWorkersRequired = getTotalWorkersFromMap(resolvedWorkerCounts) || Math.max(1, Number(workersRequired) || 1);
            const adjustedGlobalDuration = getAdjustedGlobalDurationFromSkills(resolvedSkillDurations, nextDays, nextHours);

            setDurationDays(adjustedGlobalDuration.days);
            setDurationHours(adjustedGlobalDuration.hours);
            setDurationDaysDraft(String(adjustedGlobalDuration.days));
            setDurationHoursDraft(String(adjustedGlobalDuration.hours));
            setSkillWorkerCounts(resolvedWorkerCounts);
            setSkillWorkerCountDrafts(Object.fromEntries(Object.entries(resolvedWorkerCounts).map(([k, v]) => [k, String(v)])));
            setSkillRateOverrides(resolvedRates);
            setSkillRateDrafts(Object.fromEntries(Object.entries(resolvedRates).map(([k, v]) => [k, String(v)])));
            setSkillRateModes(resolvedRateModes);
            setSkillDurationHours(resolvedSkillDurations);
            setSkillDurationDays(Object.fromEntries(Object.entries(resolvedSkillDurations).map(([k, v]) => [k, Math.max(1, Math.ceil(Number(v) / HOURS_PER_DAY))])));
            setSkillDurationHoursDrafts(Object.fromEntries(Object.entries(resolvedSkillDurations).map(([k, v]) => [k, String(v)])));
            setSkillDurationDaysDrafts(Object.fromEntries(Object.entries(resolvedSkillDurations).map(([k, v]) => [k, String(Math.max(1, Math.ceil(Number(v) / HOURS_PER_DAY)))])));
            setWorkersRequired(resolvedWorkersRequired);

            const { data } = await aiGenerateEstimate({
                workDescription: newDesc,
                answers: answersText,
                city,
                locality: resolvedLocality,
                urgent,
                jobDate: scheduledDate,
                jobStartTime: scheduledTime,
                breakdownMode: 'labour_only',
                includeMaterialCost: false,
                includeEquipmentCost: false,
                includeTravelCost: false,
                workerCountOverride: resolvedWorkersRequired,
                selectedSkills: editableSkills,
                removedSkills,
                strictSkillMode: true,
                skillWorkerCountOverrides: resolvedWorkerCounts,
                skillRateOverrides: resolvedRates,
                skillRateOverrideModes: resolvedRateModes,
                skillDurationOverrides: resolvedSkillDurations,
                durationDaysOverride: adjustedGlobalDuration.days,
                durationHoursOverride: adjustedGlobalDuration.hours,
                lockedDemandMultiplier: Number(lockedDemandMultiplier) || undefined,
            });
            applyEstimateData(data, { preserveManualSkillCounts: true });
            // Restore manually-set duration (applyEstimateData may have overwritten it)
            setDurationDays(adjustedGlobalDuration.days);
            setDurationHours(adjustedGlobalDuration.hours);
            setDurationDaysDraft(String(adjustedGlobalDuration.days));
            setDurationHoursDraft(String(adjustedGlobalDuration.hours));
            setSkillsChanged(false);
            setWorkerCountChanged(false);
            setDurationChanged(false);
            toast.success('Cost estimate recalculated!');
        } catch {
            toast.error('Recalculation failed.');
        } finally { setRecalcLoading(false); }
    };

    const reverseGeocode = useCallback(async (lat, lng) => {
        try {
            const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: { 'Accept-Language': 'en' } });
            const g = await r.json();
            const a = g.address || {};
            const area = a.suburb || a.neighbourhood || a.village || a.hamlet || a.quarter || '';
            const talukha = a.county || a.state_district || '';
            const stateName = a.state || '';
            const countryName = a.country || '';
            const pincode = a.postcode || '';
            const fetchedCity = a.city || a.town || a.county || '';
            const fullAddress = [area, talukha, fetchedCity, stateName, countryName, pincode].filter(Boolean).join(', ');
            const validation = validateAddressAgainstDescribe(fullAddress);

            setLocation((prev) => ({
                ...prev,
                lat,
                lng,
                city: city || prev.city,
                locality: prev.locality,
                state: stateName,
                pincode,
                fullAddress,
            }));

            if (!validation.valid) {
                setGeoError(validation.message);
                toast.error(validation.message);
                return;
            }

            setGeoError('');
            toast.success('Location detected!');
        } catch {
            setLocation((l) => ({ ...l, lat, lng }));
            toast.success('Coordinates set. Please fetch full address again.');
        }
    }, [city, resolvedLocality]);

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
        if (!city.trim()) return toast.error('City is required for accurate budget calculation.');
        if (!resolvedLocality) return toast.error('Locality is required for locality-based dynamic pricing.');
        if (!validateScheduleFields(true)) return;
        if (description.trim().length < MIN_AI_DESC_CHARS) {
            return toast.error(`Please enter at least ${MIN_AI_DESC_CHARS} characters to generate AI questions.`);
        }

        const currentSourceKey = buildQuestionSourceKey();

        if (questionSourceKey === currentSourceKey) {
            setStep(1);
            return;
        }

        try {
            setLoadingQ(true);
            const { data } = await aiGenerateQuestions({ workDescription: description, city, locality: resolvedLocality });
            setQuestions(normalizeGeneratedQuestions(data?.questions || []));
            setQuestionSourceKey(currentSourceKey);
            setStep(1);
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Could not generate questions.');
            setQuestions([]);
            setQuestionSourceKey('');
            setStep(1);
        }
        finally { setLoadingQ(false); }
    };

    const go1to2 = async () => {
        try {
            if (!city.trim()) return toast.error('City is required for accurate budget calculation.');
            if (!resolvedLocality) return toast.error('Locality is required for locality-based dynamic pricing.');
            if (!validateScheduleFields(true)) return;
            const unansweredRequired = questions.filter((q) => {
                if (!q.required) return false;
                const value = answers[q.id];
                if (Array.isArray(value)) return value.length === 0;
                return !String(value || '').trim();
            });
            if (unansweredRequired.length) {
                return toast.error('Please answer the required condition questions before calculating the estimate.');
            }
            setLoadingE(true);
            const at = {};
            questions.forEach((q) => {
                const value = answers[q.id];
                if (Array.isArray(value) && value.length > 0) {
                    at[q.question] = value;
                } else if (!Array.isArray(value) && String(value || '').trim()) {
                    at[q.question] = value;
                }
            });
            const { data } = await aiGenerateEstimate({
                workDescription: description,
                answers: at,
                city,
                locality: resolvedLocality,
                urgent,
                jobDate: scheduledDate,
                jobStartTime: scheduledTime,
                breakdownMode: 'labour_only',
                includeMaterialCost: false,
                includeEquipmentCost: false,
                includeTravelCost: false,
            });
            applyEstimateData(data);
            setSkillsChanged(false);
            setWorkerCountChanged(false);
            setStep(2);
        } catch { toast.error('Estimate failed. Fill manually.'); setEditableSkills([]); setStep(2); }
        finally { setLoadingE(false); }
    };

    const go2to3 = () => {
        commitDurationDrafts();
        const resolvedDays = parsePositiveIntegerOr(durationDaysDraft, durationDays || 1);
        const resolvedHours = parsePositiveIntegerOr(durationHoursDraft, durationHours || 1);
        if (!title.trim())   return toast.error('Job title required.');
        if (!editableSkills.length) return toast.error('At least one skill is required for budget calculation.');
        if (skillsChanged || workerCountChanged || durationChanged) {
            return toast.error('Please click Recalculate Cost after changing skills, counts, rates, or duration.');
        }
        if (!workersRequired || Number(workersRequired) < 1) return toast.error('Workers needed must be at least 1.');
        if (resolvedDays < 1 || resolvedHours < 1) {
            return toast.error('Duration (days and hours) is required.');
        }
        if (!customBudget || Number(customBudget) < 0) return toast.error('Please set a valid budget.');
        if (negotiable && (!minBudget || Number(minBudget) >= Number(customBudget))) return toast.error('Minimum budget must be less than your offer.');
        if (negotiable && !validateAllSkillNegotiationDrafts()) return toast.error('Please fix the negotiation values before continuing.');
        if (!validateScheduleFields(true)) return;
        setStep(3);
    };

    const go3to4 = () => {
        if (!String(city || '').trim()) return toast.error('Please enter your city in Describe section.');
        if (!String(resolvedLocality || '').trim()) return toast.error('Please enter your locality in Describe section.');
        if (!String(location.state || '').trim()) return toast.error('Please fetch live location to detect state.');
        if (!String(location.pincode || '').trim()) return toast.error('Please fetch live location to detect pincode.');
        if (!String(location.buildingName || '').trim()) return toast.error('Please enter Building/Home name.');
        if (!String(location.unitNumber || '').trim()) return toast.error('Please enter Flat/Home number.');
        if (!(Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng)))) return toast.error('Please fetch live location to capture latitude and longitude.');
        const validation = validateAddressAgainstDescribe(location.fullAddress || '');
        if (!validation.valid) {
            setGeoError(validation.message);
            return toast.error(validation.message);
        }
        setGeoError('');
        setStep(4);
    };

    const handlePost = async () => {
        commitDurationDrafts();
        const resolvedDays = parsePositiveIntegerOr(durationDaysDraft, durationDays || 1);
        const resolvedHours = parsePositiveIntegerOr(durationHoursDraft, durationHours || 1);
        if (!title.trim())  return toast.error('Title required.');
        if (!description.trim()) return toast.error('Description required.');
        if (!editableSkills.length) return toast.error('At least one skill is required.');
        if (skillsChanged || workerCountChanged || durationChanged) {
            return toast.error('Please recalculate labour cost after changing skills, counts, rates, or duration.');
        }
        if (resolvedDays < 1 || resolvedHours < 1) {
            return toast.error('Duration (days and hours) is required.');
        }
        if (!workersRequired || Number(workersRequired) < 1) return toast.error('Workers needed must be at least 1.');
        if (!customBudget || Number(customBudget) <= 0) return toast.error('Budget required.');
        if (negotiable && !validateAllSkillNegotiationDrafts()) return toast.error('Please fix the negotiation values before posting.');
        if (!String(city || '').trim()) return toast.error('City required.');
        if (!String(resolvedLocality || '').trim()) return toast.error('Locality required.');
        if (!String(location.state || '').trim()) return toast.error('State is required. Please fetch live location.');
        if (!String(location.pincode || '').trim()) return toast.error('Pincode is required. Please fetch live location.');
        if (!String(location.buildingName || '').trim()) return toast.error('Building/Home name is required.');
        if (!String(location.unitNumber || '').trim()) return toast.error('Flat/Home number is required.');
        if (!(Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng)))) return toast.error('Latitude and longitude are required. Please fetch live location.');
        if (!clientConfirmedDetails) return toast.error('Please confirm that job details and location are correct before posting.');
        const validation = validateAddressAgainstDescribe(location.fullAddress || '');
        if (!validation.valid) {
            setGeoError(validation.message);
            return toast.error(validation.message);
        }
        setGeoError('');
        if (!validateScheduleFields(true)) return;
        try {
            setPosting(true);
            const qaRecord = questions
                .map((q) => ({ question: q.question, answer: answers[q.id] || '' }))
                .filter((x) => Array.isArray(x.answer) ? x.answer.length > 0 : String(x.answer || '').trim());
            const fd = new FormData();
            const durationLabel = getDurationValue();
            fd.append('title',               title.trim());
            fd.append('description',         description);
            fd.append('shortDescription',    description.slice(0, 150));
            fd.append('detailedDescription', description);
            fd.append('skills',              JSON.stringify(editableSkills));
            fd.append('payment',             String(ensureNonNeg(customBudget)));
            fd.append('negotiable',          String(negotiable));
            fd.append('minBudget',           negotiable ? String(ensureNonNeg(minBudget)) : '0');
            fd.append('duration',            durationLabel);
            fd.append('workersRequired',     String(Math.max(1, ensureNonNeg(workersRequired, 1))));
            fd.append('location',            JSON.stringify(location));
            fd.append('scheduledDate',       scheduledDate);
            fd.append('scheduledTime',       scheduledTime);
            fd.append('shift',               shift);
            fd.append('urgent',              String(urgent));
            fd.append('qaAnswers',           JSON.stringify(qaRecord));
            if (estimate?.budgetBreakdown) {
                const enrichedBreakdown = {
                    ...estimate.budgetBreakdown,
                    breakdown: (estimate.budgetBreakdown.breakdown || []).map((item) => {
                        const skillKey = String(item?.skill || '').trim().toLowerCase();
                        const negotiatedAmount = skillKey && skillNegotiationDrafts?.[skillKey] ? Number(skillNegotiationDrafts[skillKey]) : null;
                        return negotiatedAmount ? { ...item, negotiationAmount: negotiatedAmount } : item;
                    }),
                };
                fd.append('budgetBreakdown', JSON.stringify(enrichedBreakdown));
            }
            fd.append('totalEstimatedCost',  String(estimate?.budgetBreakdown?.totalEstimated || ensureNonNeg(customBudget)));
            const draftPhotos = Array.isArray(photoDrafts) ? photoDrafts : [];
            if (draftPhotos.length) {
                const reconstructed = await Promise.all(
                    draftPhotos.map((item, idx) => dataUrlToFile(item.dataUrl, item.name || `work-photo-${idx + 1}.jpg`, item.type || 'image/jpeg')),
                );
                reconstructed.forEach((file) => fd.append('photos', file));
            }
            await postJob(fd);
            toast.success('Job posted successfully.');
            // Reset
            setStep(0); setDescription(''); setCity(''); setUrgent(false); setIsTopCityOther(false);
            setQuestions([]); setQuestionSourceKey(''); setAnswers({}); setEstimate(null); setEditableSkills([]); setSkillsChanged(false); setWorkerCountChanged(false); setDurationChanged(false);
            setTitle(''); setDurationDays(0); setDurationHours(0); setCustomBudget(''); setMinBudget(''); setNegotiable(false); setWorkersRequired(1);
            setDurationDaysDraft(''); setDurationHoursDraft('');
            setSkillWorkerCounts({}); setSkillWorkerCountDrafts({}); setSkillRateAnchors({}); setSkillRateOverrides({}); setSkillRateDrafts({}); setSkillRateModes({});
            setSkillDurationHours({}); setSkillDurationDays({}); setSkillDurationHoursDrafts({}); setSkillDurationDaysDrafts({}); setSkillDurationDraftSource({});
            setSkillNegotiationDrafts({});
            setSkillNegotiationWarnings({});
            setRemovedSkills([]); setSelectedSkillOption(''); setNewSkillInput('');
            setLockedDemandMultiplier(null);
            setDurationDraftSource('');
            setScheduledDate(''); setScheduledTime(''); setShift('');
            setLocation(EMPTY_JOB_LOCATION);
            setPhotoDrafts([]);
            setClientConfirmedDetails(false);
            setPreviewImageUrl('');
            sessionStorage.removeItem(JOB_POST_DRAFT_KEY);
        } catch (err) { toast.error(err?.response?.data?.message || 'Failed to post.'); }
        finally { setPosting(false); }
    };

    const handlePhotoSelection = async (fileList) => {
        const selected = Array.from(fileList || []);
        if (!selected.length) return;

        const file = selected[0];
        const totalAfterAdd = photoDrafts.length + 1;
        if (totalAfterAdd > MAX_JOB_PHOTOS) {
            toast.error(`You can upload maximum ${MAX_JOB_PHOTOS} photos.`);
            if (photoRef.current) photoRef.current.value = '';
            return;
        }

        try {
            const dataUrl = await readFileAsDataUrl(file);
            const nextDraft = {
                name: file.name || `work-photo-${totalAfterAdd}.jpg`,
                type: file.type || 'image/jpeg',
                size: Number(file.size) || 0,
                dataUrl,
            };
            setPhotoDrafts((prev) => [...prev, nextDraft]);
        } catch {
            toast.error('Unable to read selected image. Please try another file.');
        } finally {
            if (photoRef.current) photoRef.current.value = '';
        }
    };

    const removePhotoAt = (index) => {
        setPhotoDrafts((prev) => prev.filter((_, i) => i !== index));
    };

    const clearAllPhotos = () => {
        setPhotoDrafts([]);
        setPreviewImageUrl('');
        if (photoRef.current) photoRef.current.value = '';
    };

    // ── RENDER ─────────────────────────────────────────────────────────────────
    return (
        <div className="max-w-5xl mx-auto px-4 py-6 pb-28">
            <div className="mb-6 bg-gradient-to-r from-orange-500 to-amber-500 rounded-3xl px-6 py-6 shadow-lg">
                <h1 className="text-3xl sm:text-4xl font-black text-white">Post Job</h1>
                <p className="text-sm text-orange-100 mt-1">Create and publish a professional job listing</p>
                <p className="text-sm text-orange-50 mt-2">Step {step + 1} of {STEPS.length}: {STEPS[step].label}</p>
            </div>
            <StepBar current={step} />

            {/* STEP 0 — DESCRIBE */}
            {step === 0 && (
                <div className="space-y-5">
                    <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-base text-orange-700">Be specific. Mention area size, rooms, and current issues.</div>
                    <div>
                        <label className="block text-base font-semibold text-gray-700 mb-2">Work Description <span className="text-red-500">*</span></label>
                        <textarea rows={6} value={description} onChange={e => setDescription(e.target.value)} placeholder="Example: Complete bathroom renovation, replace floor tiles, fix leaking pipe, repaint walls in 2BHK Pune" className="w-full border-2 border-gray-200 rounded-2xl p-4 text-base focus:outline-none focus:border-orange-400 resize-none leading-relaxed transition-colors" />
                        <p className="text-xs text-gray-400 mt-1">{description.length} chars</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-base font-semibold text-gray-700 mb-2">City <span className="text-red-500">*</span></label>
                                <select value={topCitySelectValue} onChange={e => {
                                    const value = e.target.value;
                                    if (value === OTHER_CITY_OPTION) {
                                        setIsTopCityOther(true);
                                        if (isKnownTopCity) setCity('');
                                        return;
                                    }
                                    setIsTopCityOther(false);
                                    setCity(value);
                                }} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-400 transition-colors bg-white">
                                    <option value="">Select city</option>
                                    {cityOptions.map((c) => <option key={c.key} value={c.label}>{c.label}</option>)}
                                    <option value={OTHER_CITY_OPTION}>Other (Enter Manually)</option>
                                </select>
                                {topCitySelectValue === OTHER_CITY_OPTION && (
                                    <input
                                        value={city}
                                        onChange={e => setCity(e.target.value)}
                                        placeholder="Enter city name"
                                        className="w-full mt-2 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-base focus:outline-none focus:border-orange-400 transition-colors"
                                    />
                                )}
                        </div>
                        <div>
                            <label className="block text-base font-semibold text-gray-700 mb-2">Locality <span className="text-red-500">*</span></label>
                            <input
                                value={location.locality}
                                onChange={e => setLocation(l => ({ ...l, locality: e.target.value }))}
                                placeholder="Enter your locality"
                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-400 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-base font-semibold text-gray-700 mb-2">Priority</label>
                            <button type="button" onClick={() => setUrgent(u => !u)} className={`w-full py-3 rounded-xl text-base font-bold border-2 transition-all ${urgent ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-500 hover:border-orange-200'}`}>
                                {urgent ? 'Urgent' : 'Normal'}
                            </button>
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-700">Work must be scheduled at least 50 minutes from now, between 6:00 AM and 9:00 PM.</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-base font-semibold text-gray-700 mb-2">Work Date <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                min={todayStr()}
                                value={scheduledDate}
                                onChange={e => { setScheduledDate(e.target.value); setScheduleError(''); }}
                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-400 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-base font-semibold text-gray-700 mb-2">Start Time <span className="text-red-500">*</span></label>
                            <input
                                type="time"
                                min="06:00"
                                max="21:00"
                                value={scheduledTime}
                                onChange={e => { setScheduledTime(e.target.value); setScheduleError(''); }}
                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-400 transition-colors"
                            />
                        </div>
                    </div>

                    {shift && (
                        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                            <div><p className="text-xs text-blue-500 font-medium">Shift</p><p className="text-base font-bold text-blue-800">{shift}</p></div>
                        </div>
                    )}

                    {scheduleError && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{scheduleError}</div>}

                    <button onClick={go0to1} disabled={loadingQ || !description.trim() || description.trim().length < MIN_AI_DESC_CHARS || !city.trim() || !resolvedLocality || !scheduledDate || !scheduledTime} className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl transition-all disabled:opacity-60 shadow-lg flex items-center justify-center gap-2 text-base">
                        {loadingQ ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Analysing...</> : 'Generate AI Questions'}
                    </button>
                    <p className="text-xs text-gray-400 text-center">Minimum {MIN_AI_DESC_CHARS} characters required to generate AI questions</p>
                </div>
            )}

            {/* STEP 1 — QUESTIONS */}
            {step === 1 && (
                <div className="space-y-5">
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                        <div><p className="text-base font-bold text-blue-800">Clarifying Questions</p><p className="text-sm text-blue-600 mt-0.5">Answers improve cost accuracy</p></div>
                    </div>
                    <div className="bg-gray-50 rounded-xl px-4 py-3">
                        <p className="text-xs text-gray-400 mb-0.5">Your request</p>
                        <p className="text-sm text-gray-700 line-clamp-2">{description}</p>
                        <div className="flex gap-2 mt-1.5">{city && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{city}</span>}{resolvedLocality && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{resolvedLocality}</span>}{urgent && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Urgent</span>}</div>
                    </div>
                    {questions.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No clarifications needed.</p> : <div className="space-y-4">{questions.map(q => <QWidget key={q.id} q={q} value={answers[q.id]} onChange={setAnswer} />)}</div>}
                    <div className="flex gap-3">
                        <button onClick={() => setStep(0)} className="px-5 py-3 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-semibold text-sm">Back</button>
                        <button onClick={go1to2} disabled={loadingE} className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl disabled:opacity-60 flex items-center justify-center gap-2 text-sm">
                            {loadingE ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Calculating...</> : 'Get Cost Estimate'}
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 2 — BUDGET + SKILLS + WORK FLOW */}
            {step === 2 && (
                <div className="space-y-5">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Job Title Summary <span className="text-red-500">*</span></label>
                        <textarea rows={3} value={title} onChange={e => { titleAutoManagedRef.current = false; setTitle(e.target.value); }} placeholder="Line 1: Worker requirement\nLine 2: Key requirements\nLine 3: Budget and timeline" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 transition-colors resize-none" />
                        {titleDraft && (
                            <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
                                <p className="text-xs text-gray-500 mb-1">AI draft (3 lines)</p>
                                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">{titleDraft}</pre>
                                <button type="button" onClick={() => { titleAutoManagedRef.current = true; setTitle(titleDraft); }} className="mt-2 text-xs text-orange-600 font-semibold hover:text-orange-700">Use this title summary</button>
                            </div>
                        )}
                    </div>

                    {/* Skill editor */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-semibold text-gray-700">Skills Required</label>
                        </div>
                        {(skillsChanged || workerCountChanged || durationChanged) && !recalcLoading && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-3 text-xs text-amber-700 font-medium">
                                Budget inputs changed. Click Recalculate to update the estimate.
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
                            <div className="flex flex-col sm:flex-row gap-2 mt-3 pt-3 border-t border-gray-200">
                                <select
                                    value={selectedSkillOption}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setSelectedSkillOption(value);
                                        if (value && value !== OTHER_SKILL_OPTION) {
                                            setNewSkillInput(value);
                                        } else if (value === OTHER_SKILL_OPTION) {
                                            setNewSkillInput('');
                                        }
                                    }}
                                    className="flex-1 border-2 border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400 transition-colors bg-white"
                                >
                                    <option value="">Select skill</option>
                                    {AVAILABLE_SKILLS.filter((skill) => skill !== 'other').map((skill) => (
                                        <option key={skill} value={skill}>{skill.replace(/_/g, ' ')}</option>
                                    ))}
                                    <option value={OTHER_SKILL_OPTION}>Other</option>
                                </select>
                                {(selectedSkillOption === OTHER_SKILL_OPTION || !selectedSkillOption) && (
                                    <input
                                        value={newSkillInput}
                                        onChange={e => setNewSkillInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                                        placeholder="Add custom skill"
                                        className="flex-1 border-2 border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400 transition-colors"
                                    />
                                )}
                                <button type="button" onClick={addSkill} className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-colors">Add</button>
                            </div>
                        </div>
                    </div>

                    {/* Budget breakdown — per-individual-worker */}
                    {estimate?.budgetBreakdown?.breakdown?.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Labour Cost Per Worker</p>
                                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium capitalize">{estimate.budgetBreakdown.city}</span>
                                {estimate.budgetBreakdown.urgent && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">Urgent</span>}
                            </div>
                            {(estimate?.demandFactor > 1 || estimate?.festivalName || estimate?.demandMultipliers?.dayType) && (
                                <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs text-blue-800">
                                    <p>
                                        Pricing context: {estimate?.demandMultipliers?.dayType || 'weekday'}
                                        {estimate?.festivalName ? `, ${estimate.festivalName}` : ''}
                                        {estimate?.demandFactor > 1 ? `, multiplier x${Number(estimate.demandFactor).toFixed(2)} applied per worker` : ''}
                                    </p>
                                    {Number(estimate?.budgetBreakdown?.multiplierImpactTotal) > 0 && (
                                        <p className="mt-1">
                                            Effect on total: {formatCurrency(estimate?.budgetBreakdown?.subtotalBase || 0)} to {formatCurrency(estimate?.budgetBreakdown?.totalEstimated || 0)} (increase {formatCurrency(estimate?.budgetBreakdown?.multiplierImpactTotal || 0)}).
                                        </p>
                                    )}
                                </div>
                            )}
                            <BudgetTable
                                breakdown={estimate.budgetBreakdown}
                                skillBlocks={estimate.skillBlocks}
                                negotiable={negotiable}
                                skillNegotiationDrafts={skillNegotiationDrafts}
                                onNegotiationChange={handleSkillNegotiationChange}
                                showRecalculate={skillsChanged || workerCountChanged || durationChanged}
                                onRecalculate={handleRecalculate}
                                recalcLoading={recalcLoading}
                            />
                        </div>
                    )}

                    <div className="bg-white border-2 border-gray-100 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-700">Skill-wise Workers and Rate Control</p>
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-bold">Total: {workersRequired} workers</span>
                        </div>
                        <p className="text-xs text-gray-500">Set workers, per-skill duration, cost basis, and custom rate. Costing now uses each skill duration, not global duration.</p>
                        {editableSkills.length === 0 ? (
                            <p className="text-xs text-gray-500">Add skills to set required workers per skill.</p>
                        ) : (
                            <div className="space-y-2">
                                <div className="hidden sm:grid sm:grid-cols-6 gap-3 items-center px-1">
                                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Skill</p>
                                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Worker Count</p>
                                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Day</p>
                                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Hour</p>
                                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Cost Basis</p>
                                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Custom Rate</p>
                                </div>
                                {editableSkills.map((skill) => (
                                    <div key={`wc-${skill}`} className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-center">
                                        <label className="text-sm text-gray-700 capitalize">{skill}</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={6}
                                            value={skillWorkerCountDrafts?.[skill] ?? String(Math.max(1, Number(skillWorkerCounts?.[skill]) || 1))}
                                            onChange={(e) => handleSkillWorkerCountChange(skill, e.target.value)}
                                            onBlur={() => commitSkillWorkerCount(skill)}
                                            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition-colors"
                                            placeholder="Worker count (max 6)"
                                        />
                                        <input
                                            type="number"
                                            min={1}
                                            value={skillDurationDaysDrafts?.[skill] ?? String(getSkillDurationDaysValue(skill, 1))}
                                            onChange={(e) => handleSkillDurationDraftChange(skill, 'days', e.target.value)}
                                            onBlur={() => commitSkillDurationDrafts(skill)}
                                            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition-colors"
                                            placeholder="Skill days"
                                        />
                                        <input
                                            type="number"
                                            min={1}
                                            value={skillDurationHoursDrafts?.[skill] ?? String(getSkillDurationHoursValue(skill, 1))}
                                            onChange={(e) => handleSkillDurationDraftChange(skill, 'hours', e.target.value)}
                                            onBlur={() => commitSkillDurationDrafts(skill)}
                                            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition-colors"
                                            placeholder="Skill hours"
                                        />
                                        {(() => {
                                            const skillHours = getSkillDurationHoursValue(skill, durationHours || 1);
                                            const skillDays = Math.max(1, Math.ceil(skillHours / HOURS_PER_DAY));
                                            const allowedModes = getAllowedRateModesForDuration(skillDays, skillHours);
                                            const activeMode = normalizeRateMode(skillRateModes?.[skill], allowedModes[0] || 'day');
                                            return (
                                                <select
                                                    value={activeMode}
                                                    onChange={(e) => handleSkillRateModeChange(skill, e.target.value)}
                                                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition-colors bg-white"
                                                >
                                                    {allowedModes.includes('hour') && <option value="hour">Using /hour</option>}
                                                    {allowedModes.includes('day') && <option value="day">Using /day</option>}
                                                    {allowedModes.includes('visit') && <option value="visit">Using /visit</option>}
                                                </select>
                                            );
                                        })()}
                                        <input
                                            type="number"
                                            min={(() => {
                                                const activeMode = normalizeRateMode(skillRateModes?.[skill], 'day');
                                                const anchor = getRateBaseForMode(skill, activeMode);
                                                return anchor > 0 ? Math.max(0, Math.round(anchor * (1 - MANUAL_RATE_VARIANCE))) : 0;
                                            })()}
                                            max={(() => {
                                                const activeMode = normalizeRateMode(skillRateModes?.[skill], 'day');
                                                const anchor = getRateBaseForMode(skill, activeMode);
                                                return anchor > 0 ? Math.round(anchor * (1 + MANUAL_RATE_VARIANCE)) : undefined;
                                            })()}
                                            value={skillRateDrafts?.[skill] ?? String(Math.max(0, Number(skillRateOverrides?.[skill]) || 0))}
                                            onChange={(e) => handleSkillRateChange(skill, e.target.value)}
                                            onBlur={() => commitSkillRate(skill)}
                                            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition-colors"
                                            placeholder={`Custom rate/${normalizeRateMode(skillRateModes?.[skill], 'day')} (INR)`}
                                        />
                                        {(() => {
                                            const activeMode = normalizeRateMode(skillRateModes?.[skill], 'day');
                                            const anchor = getRateBaseForMode(skill, activeMode);
                                            const draftVal = Number(String(skillRateDrafts?.[skill] ?? '').trim());
                                            const minRate = anchor > 0 ? Math.max(0, Math.round(anchor * (1 - MANUAL_RATE_VARIANCE))) : 0;
                                            const maxRate = anchor > 0 ? Math.round(anchor * (1 + MANUAL_RATE_VARIANCE)) : anchor;
                                            const isOutOfRange = anchor > 0 && draftVal > 0 && (draftVal < minRate || draftVal > maxRate);
                                            return (
                                                <div className="mt-1.5 space-y-1 sm:col-span-6">
                                                    <p className="text-[11px] text-gray-500">
                                                        <strong>Skill duration:</strong> {getSkillDurationDaysValue(skill, 1)} day(s), {getSkillDurationHoursValue(skill, 1)} hour(s)
                                                    </p>
                                                    <p className="text-[11px] text-gray-500">
                                                        <strong>Allowed range:</strong> ₹{minRate.toLocaleString()} – ₹{maxRate.toLocaleString()} /{activeMode}
                                                    </p>
                                                    {isOutOfRange && (
                                                        <p className="text-[11px] text-red-600 font-semibold">
                                                            ⚠️ Out of range! You can only change within ±30% of the detected ₹{anchor.toLocaleString()}/{activeMode}.
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Duration (Days)</label>
                            <input
                                type="number"
                                min={Math.max(1, Math.ceil(getMinimumGlobalHoursFromSkills() / HOURS_PER_DAY))}
                                value={durationDaysDraft}
                                onChange={e => {
                                    const val = String(e.target.value).trim();
                                    if (!/^\d*$/.test(val)) return;
                                    const numVal = Number(val);
                                    if (numVal === 0 && val !== '') {
                                        toast.error('Duration days cannot be 0. Minimum is 1 day.');
                                        return;
                                    }
                                    setDurationDaysDraft(val);
                                    setDurationDraftSource('days');
                                    setDurationChanged(true);
                                }}
                                onBlur={commitDurationDrafts}
                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Duration (Hours)</label>
                            <input
                                type="number"
                                min={getMinimumGlobalHoursFromSkills()}
                                value={durationHoursDraft}
                                onChange={e => {
                                    const val = String(e.target.value).trim();
                                    if (!/^\d*$/.test(val)) return;
                                    const numVal = Number(val);
                                    if (numVal === 0 && val !== '') {
                                        toast.error('Duration hours cannot be 0. Minimum is 1 hour.');
                                        return;
                                    }
                                    setDurationHoursDraft(val);
                                    setDurationDraftSource('hours');
                                    setDurationChanged(true);
                                }}
                                onBlur={commitDurationDrafts}
                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 transition-colors"
                            />
                        </div>
                    </div>
                    <p className="text-xs text-amber-700">
                        Global duration cannot be less than total skill duration: {getMinimumGlobalHoursFromSkills()} hour(s) ({Math.max(1, Math.ceil(getMinimumGlobalHoursFromSkills() / HOURS_PER_DAY))} day(s)).
                    </p>
                    <p className="text-xs text-gray-500">Current duration: {getDurationValue() || 'Not set'}</p>

                    {/* Negotiable */}
                    <div className="border-2 border-gray-100 rounded-2xl p-4 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="font-bold text-gray-800 text-sm">Allow Negotiation</p>
                                <p className="text-xs text-gray-400">Enable to edit per-skill worker costs within range</p>
                            </div>
                            <button type="button" onClick={toggleNegotiation} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${negotiable ? 'bg-orange-500' : 'bg-gray-200'}`}>
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${negotiable ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {negotiable && (
                            <div className="rounded-xl border border-orange-100 bg-orange-50 p-4 space-y-3">
                                <div>
                                    <p className="text-xs font-bold text-orange-700 uppercase tracking-wider">Negotiation per Skill</p>
                                    <p className="text-sm text-gray-600">Shown only when enabled. Each input edits the per-worker cost for that skill.</p>
                                </div>
                                <div className="space-y-2">
                                    {(estimate?.budgetBreakdown?.breakdown || []).map((b) => {
                                        const key = String(b.skill || '').toLowerCase();
                                        const perWorker = Number(b.ratePerVisit) || Number(b.perWorkerCost) || Math.round((Number(b.subtotal) || 0) / Math.max(1, Number(b.count) || 1));
                                        const range = b.negotiationRange || { min: Math.round(perWorker * 0.88), max: Math.round(perWorker * 1.08) };
                                        const min = Math.max(0, Number(range.min) || 0);
                                        const max = Math.max(min, Number(range.max) || 0);
                                        const current = skillNegotiationDrafts?.[key] ?? String(perWorker);
                                        return (
                                            <div key={`neg-${key}`} className="flex items-center justify-between gap-3 rounded-lg bg-white border border-orange-100 px-3 py-2">
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-800 capitalize">{b.skill}</p>
                                                    <p className="text-xs text-gray-500">Range: {formatCurrency(min)} - {formatCurrency(max)} / worker</p>
                                                </div>
                                                <div className="text-right">
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        pattern="[0-9]*"
                                                        value={current}
                                                        onChange={(e) => handleSkillNegotiationChange(b.skill, e.target.value)}
                                                        onBlur={() => validateSkillNegotiationDraft(b.skill)}
                                                        className="w-32 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition-colors"
                                                    />
                                                    {skillNegotiationWarnings?.[key] && (
                                                        <p className="mt-1 max-w-32 text-[11px] leading-snug text-red-600">{skillNegotiationWarnings[key]}</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="pt-2 border-t border-orange-100 text-xs text-gray-500">
                                    Total Estimated remains fixed. Adjust only the per-skill worker cost above.
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => setStep(questions.length > 0 ? 1 : 0)} className="px-5 py-3 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-semibold text-sm">Back</button>
                        <button onClick={go2to3} className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm">Next: Location</button>
                    </div>
                </div>
            )}

            {/* STEP 3 — LOCATION */}
            {step === 3 && (
                <div className="space-y-5">
                    <button onClick={handleGeolocate} disabled={geoLoading} className="w-full py-3 border-2 border-orange-200 text-orange-600 rounded-xl hover:bg-orange-50 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all">
                        {geoLoading ? <><span className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" /> Detecting...</> : 'Use My Live Location'}
                    </button>
                    {geoError && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">{geoError}</div>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                            <p className="text-xs text-gray-500 mb-1">City (from Describe)</p>
                            <p className="text-sm font-semibold text-gray-800">{city || '-'}</p>
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                            <p className="text-xs text-gray-500 mb-1">Locality (from Describe)</p>
                            <p className="text-sm font-semibold text-gray-800">{resolvedLocality || '-'}</p>
                        </div>
                    </div>
                    <MapPicker lat={location.lat} lng={location.lng} onPick={handleMapPick} />
                    <p className="text-xs text-gray-400 text-center">Tap map or drag marker</p>
                    {Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng)) && (
                        <div className="bg-gray-50 rounded-xl px-4 py-2.5 text-xs font-mono text-gray-600">{Number(location.lat).toFixed(5)}, {Number(location.lng).toFixed(5)}</div>
                    )}
                    <div className="space-y-3">
                        <input
                            value={location.fullAddress}
                            onChange={(e) => {
                                const nextAddress = e.target.value;
                                setLocation((l) => ({ ...l, fullAddress: nextAddress }));
                                const validation = validateAddressAgainstDescribe(nextAddress);
                                setGeoError(validation.valid ? '' : validation.message);
                            }}
                            placeholder="Locality, Talukha, City, State, Country, Pincode"
                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 transition-colors"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                                value={location.buildingName || ''}
                                onChange={(e) => setLocation((l) => ({ ...l, buildingName: e.target.value }))}
                                placeholder="Building / Home Name *"
                                className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 transition-colors"
                            />
                            <input
                                value={location.unitNumber || ''}
                                onChange={(e) => setLocation((l) => ({ ...l, unitNumber: e.target.value }))}
                                placeholder="Flat / Home Number *"
                                className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 transition-colors"
                            />
                        </div>
                        <input
                            value={location.floorNumber || ''}
                            onChange={(e) => setLocation((l) => ({ ...l, floorNumber: e.target.value }))}
                            placeholder="Floor Number (optional)"
                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 transition-colors"
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <input value={location.state || ''} readOnly placeholder="State" className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-700" />
                            <input value={location.pincode || ''} readOnly placeholder="Pincode" className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-700" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div><label className="text-xs text-gray-400 block mb-1">Latitude</label><input type="text" value={location.lat || ''} readOnly placeholder="e.g., 18.52045" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono bg-gray-50 text-gray-700" /></div>
                            <div><label className="text-xs text-gray-400 block mb-1">Longitude</label><input type="text" value={location.lng || ''} readOnly placeholder="e.g., 73.85674" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono bg-gray-50 text-gray-700" /></div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setStep(2)} className="px-5 py-3 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-semibold text-sm">Back</button>
                        <button onClick={go3to4} className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm">Next: Photos</button>
                    </div>
                </div>
            )}

            {/* STEP 4 — PHOTOS */}
            {step === 4 && (
                <div className="space-y-5">
                    <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={e => handlePhotoSelection(e.target.files)} />
                    <div onClick={() => photoRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center cursor-pointer hover:border-orange-300 hover:bg-orange-50/20 transition-all">
                        {photoDrafts.length > 0 ? (
                            <><div className="flex flex-wrap gap-2 justify-center mb-3">{photoDrafts.map((img, i) => <img key={i} src={img.dataUrl} alt="" className="w-24 h-24 object-cover rounded-xl shadow-sm" />)}</div>
                            <p className="text-sm font-semibold text-gray-500">{photoDrafts.length}/{MAX_JOB_PHOTOS} photos uploaded · tap to add one more</p></>
                        ) : (
                            <><p className="text-base font-bold text-gray-600">Tap to add first photo</p><p className="text-sm text-gray-500 mt-1">Optional · JPG, PNG · Add one by one</p></>
                        )}
                    </div>
                    <p className="text-xs text-gray-500">Uploaded: {photoDrafts.length}/{MAX_JOB_PHOTOS} · Maximum {MAX_JOB_PHOTOS} photos allowed.</p>
                    {photoDrafts.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {photoDrafts.map((img, i) => (
                                <div key={`photo-item-${i}`} className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
                                    <button type="button" onClick={() => setPreviewImageUrl(img.dataUrl)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                                        <img src={img.dataUrl} alt={`Work photo ${i + 1}`} className="w-10 h-10 rounded-lg object-cover" />
                                        <span className="text-xs text-gray-600 truncate">{img.name || `Photo ${i + 1}`}</span>
                                    </button>
                                    <button type="button" onClick={() => removePhotoAt(i)} className="text-xs text-red-500 hover:text-red-700 font-semibold">Remove</button>
                                </div>
                            ))}
                        </div>
                    )}
                    {photoDrafts.length > 0 && <button onClick={clearAllPhotos} className="w-full text-xs text-red-400 hover:text-red-600 py-1 transition-colors">Remove all photos</button>}
                    <div className="flex gap-3">
                        <button onClick={() => setStep(3)} className="px-5 py-3 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-semibold text-sm">Back</button>
                        <button onClick={() => setStep(5)} className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm">{photoDrafts.length > 0 ? `Preview (${photoDrafts.length} photos)` : 'Skip to Preview'}</button>
                    </div>
                </div>
            )}

            {/* STEP 5 — PREVIEW */}
            {step === 5 && (
                <div className="space-y-5">
                    <div className="bg-white border-2 border-gray-100 rounded-2xl overflow-hidden">
                        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-4">
                            <h3 className="text-white font-black text-lg">{title || 'Untitled'}</h3>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {urgent && <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-bold">Urgent</span>}
                                {negotiable && <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-bold">Negotiable</span>}
                                {shift && <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-bold">{shift.split('(')[0].trim()}</span>}
                                <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-bold">{workersRequired} workers</span>
                            </div>
                        </div>
                        <div className="px-5 py-4 divide-y divide-gray-50">
                            <PRow label="Description" value={description.slice(0, 200) + (description.length > 200 ? '...' : '')} />
                            <PRow label="Budget" value={`${Number(customBudget).toLocaleString()}${negotiable ? ` (Min ${Number(minBudget).toLocaleString()})` : ' · Fixed'}`} vc="text-green-600 font-bold text-base" />
                            <PRow label="Duration" value={getDurationValue()} />
                            <PRow label="Date" value={scheduledDate ? new Date(scheduledDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''} />
                            <PRow label="Start Time" value={scheduledTime} />
                            <PRow label="Shift" value={shift} />
                            <PRow label="City" value={location.city} />
                            <PRow label="Address" value={[location.locality, location.city, location.pincode].filter(Boolean).join(', ')} />
                            <PRow label="Building / Home" value={location.buildingName} />
                            <PRow label="Flat / Home No." value={location.unitNumber} />
                            <PRow label="Floor" value={location.floorNumber || '-'} />
                        </div>
                    </div>

                    {editableSkills.length > 0 && (
                        <div className="bg-white border-2 border-gray-100 rounded-2xl px-5 py-4">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Skills Required</p>
                            <div className="flex flex-wrap gap-2">{editableSkills.map((s, i) => <span key={i} className="text-xs bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full font-bold capitalize">{s}</span>)}</div>
                        </div>
                    )}

                    {editableSkills.length > 0 && (
                        <div className="bg-white border-2 border-gray-100 rounded-2xl px-5 py-4">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Worker Count by Skill</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {editableSkills.map((skill) => (
                                    <div key={`pv-${skill}`} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                                        <span className="text-sm text-gray-700 capitalize">{skill}</span>
                                        <span className="text-sm font-bold text-gray-900">{Math.max(1, Number(skillWorkerCounts?.[skill]) || 1)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {estimate?.budgetBreakdown?.breakdown?.length > 0 && (
                        <div className="bg-white border-2 border-gray-100 rounded-2xl px-5 py-4">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Cost Breakdown</p>
                            <BudgetTable
                                breakdown={estimate.budgetBreakdown}
                                skillBlocks={estimate.skillBlocks}
                                negotiable={negotiable}
                                skillNegotiationDrafts={skillNegotiationDrafts}
                                onNegotiationChange={handleSkillNegotiationChange}
                            />
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

                    {photoDrafts.length > 0 && (
                        <div className="bg-white border-2 border-gray-100 rounded-2xl px-5 py-4">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{photoDrafts.length} Work Photo{photoDrafts.length > 1 ? 's' : ''}</p>
                            <div className="flex flex-wrap gap-2">{photoDrafts.map((img, i) => (
                                <button type="button" key={i} onClick={() => setPreviewImageUrl(img.dataUrl)} className="focus:outline-none">
                                    <img src={img.dataUrl} alt={`Work photo ${i + 1}`} className="w-20 h-20 object-cover rounded-xl shadow-sm hover:opacity-90 transition-opacity" />
                                </button>
                            ))}</div>
                            <p className="text-xs text-gray-500 mt-2">Tap any photo to open it on this page.</p>
                        </div>
                    )}

                    <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={clientConfirmedDetails}
                                onChange={(e) => setClientConfirmedDetails(e.target.checked)}
                                className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                            />
                            <span className="text-sm text-amber-800 font-medium">
                                I confirm that the provided job details and location are correct.
                            </span>
                        </label>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => setStep(4)} className="px-5 py-3 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-semibold">Back</button>
                        <button onClick={handlePost} disabled={posting || !clientConfirmedDetails} className="flex-1 py-4 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl transition-all disabled:opacity-60 shadow-lg flex items-center justify-center gap-2 text-base">
                            {posting ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Posting...</> : 'Post Job Now'}
                        </button>
                    </div>
                </div>
            )}

            {previewImageUrl && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPreviewImageUrl('')}>
                    <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => setPreviewImageUrl('')} className="absolute -top-10 right-0 text-white font-bold text-sm">Close</button>
                        <img src={previewImageUrl} alt="Preview" className="w-full max-h-[80vh] object-contain rounded-xl bg-black" />
                    </div>
                </div>
            )}
        </div>
    );
}
