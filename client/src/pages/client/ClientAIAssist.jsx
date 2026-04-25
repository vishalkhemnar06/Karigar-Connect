// client/src/pages/client/ClientAIAssist.jsx
// Professional AI Advisor with Complete Report - Orange Theme

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    aiGenerateQuestions, getAIAdvisorReport,
    saveAIAnalysis, getClientAIHistory, getAIHistoryItem,
    updateAIHistoryItem, deleteAIHistoryItem, clearClientAIHistory,
    getClientProfile, toggleStarWorker, getImageUrl, getRateTableCities,
} from '../../api/index';
import { openWorkerProfilePreview } from '../../utils/workerProfilePreview';
import DirectHireModal from '../../components/DirectHireModal';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
    IndianRupee, Clock, MapPin, Briefcase, User, Users,
    AlertCircle, CheckCircle, FileText, Image, Camera,
    Settings, TrendingUp, Award, Calendar, Download, Save,
    Trash2, Edit2, Plus, X, Loader2, Sparkles, Target,
    Layers, HardHat, Palette, Wrench, Truck, PenTool,
    Heart, Phone, Star
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Utilities
// ─────────────────────────────────────────────────────────────────────────────

const PHASES = ['describe', 'questions', 'budget', 'preferences', 'image', 'loading', 'report'];
const PHASE_LABELS = {
    describe: 'Project Details',
    questions: 'Requirements',
    budget: 'Budget',
    preferences: 'Preferences',
    image: 'Visual Reference',
    loading: 'Analysis',
    report: 'Report'
};

const REPORT_TAB_OPTIONS = [
    { id: 'warnings', label: 'Important Warnings' },
    { id: 'costEstimate', label: 'Cost Estimate (Detailed)' },
    { id: 'priceReasoning', label: 'Price Reasoning' },
    { id: 'costSavingSuggestions', label: 'Cost Saving Suggestions' },
    { id: 'scenarioRange', label: 'Best / Expected / Worst' },
    { id: 'localMarketInsight', label: 'Local Market Insight' },
    { id: 'negotiationRange', label: 'Negotiation Range' },
    { id: 'workPlan', label: 'Work Plan' },
    { id: 'timeEstimate', label: 'Time Estimate' },
    { id: 'expectedOutcome', label: 'Expected Outcome' },
    { id: 'designRecommendations', label: 'Design Recommendations' },
    { id: 'addNote', label: 'Add Note' },
];

const getFirstAvailableReportTab = (report) => {
    if (!report) return 'costEstimate';
    if (report.warnings?.length) return 'warnings';
    if (report.priceReasoning?.length) return 'priceReasoning';
    if (report.costSavingSuggestions?.length) return 'costSavingSuggestions';
    if (report.bestCaseTotal || report.expectedTotal || report.worstCaseTotal) return 'scenarioRange';
    if (report.localMarketInsight) return 'localMarketInsight';
    if (report.negotiationRange) return 'negotiationRange';
    if (report.workPlan?.length) return 'workPlan';
    if (report.timeEstimate) return 'timeEstimate';
    if (report.expectedOutcome?.length) return 'expectedOutcome';
    if (report.colourAndStyleAdvice || report.designSuggestions?.length > 0 || report.improvementIdeas?.length > 0) return 'designRecommendations';
    return 'costEstimate';
};

const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '—';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
};

const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
};

const formatDateWithDay = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
};

const formatTimeLabel = (value = '') => {
    if (!value) return '';
    const [h, m] = String(value).split(':').map((v) => Number(v));
    if (Number.isNaN(h) || Number.isNaN(m)) return String(value);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
};

const parseTimeToMinutes = (value = '') => {
    const [h, m] = String(value).split(':').map((v) => Number(v));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
};

const getDayPeriodLabel = (value = '') => {
    const minutes = parseTimeToMinutes(value);
    if (minutes === null) return '';

    if (minutes < 12 * 60) return 'Morning';
    if (minutes < 17 * 60) return 'Afternoon';
    return 'Evening';
};

const isValidJobStartTime = (value = '') => {
    const minutes = parseTimeToMinutes(value);
    if (minutes === null) return false;

    const minMinutes = 7 * 60;   // 07:00 AM
    const maxMinutes = 19 * 60;  // 07:00 PM
    return minutes >= minMinutes && minutes <= maxMinutes;
};

const TIME_HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const TIME_MINUTE_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'));

const formatTimeSelection = (value = '') => {
    const [hourPart, minutePart] = String(value || '').split(':');
    const hour = Number(hourPart);
    const minute = Number(minutePart);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
        return { hour: '09', minute: '00', period: 'AM' };
    }

    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return {
        hour: String(hour12).padStart(2, '0'),
        minute: String(minute).padStart(2, '0'),
        period,
    };
};

const buildTimeFromSelection = (hour, minute, period) => {
    const safeHour = Number(hour);
    const safeMinute = Number(minute);
    if (!Number.isFinite(safeHour) || !Number.isFinite(safeMinute)) return '';

    let normalizedHour = safeHour % 12;
    if (String(period).toUpperCase() === 'PM') normalizedHour += 12;
    if (String(period).toUpperCase() === 'AM' && safeHour === 12) normalizedHour = 0;
    return `${String(normalizedHour).padStart(2, '0')}:${String(safeMinute).padStart(2, '0')}`;
};

const openWorkerMap = (worker = {}) => {
    const lat = Number(worker.latitude);
    const lng = Number(worker.longitude);

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
        window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank', 'noopener,noreferrer');
        return;
    }

    const query = [worker.locality, worker.city].filter(Boolean).join(', ');
    if (query) {
        window.open(`https://www.google.com/maps?q=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
        return;
    }

    toast.error('Live location is not available for this worker.');
};

const sanitizeNumber = (value) => {
    if (value === '') return '';
    const sanitized = String(value).replace(/[^\d.]/g, '');
    const parts = sanitized.split('.');
    return parts.length > 1 ? `${parts[0]}.${parts.slice(1).join('')}` : sanitized;
};

const MIN_AI_DESCRIPTION_CHARS = 10;
const OTHER_CITY_OPTION = '__OTHER_CITY__';
const AI_ADVISOR_DRAFT_KEY = 'client_ai_advisor_draft_v1';

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
});

const dataUrlToFile = async (dataUrl, fallbackName = 'reference-image.jpg', fallbackType = 'image/jpeg') => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const fileType = blob.type || fallbackType;
    return new File([blob], fallbackName, { type: fileType });
};

const SUPPORTED_UI_LANGUAGES = new Set(['en', 'hi', 'mr']);

const getPreferredUiLanguage = () => {
    const match = document.cookie.match(/(?:^|;\s*)googtrans=\/en\/([a-z]{2})/i);
    const lang = (match?.[1] || 'en').toLowerCase();
    return SUPPORTED_UI_LANGUAGES.has(lang) ? lang : 'en';
};

const normalizeQuestionList = (items = [], prefix = 'q') => {
    const list = Array.isArray(items) ? items : [];
    return list
        .filter((item) => item && typeof item === 'object')
        .map((item, index) => {
            const rawId = item.id ? String(item.id).trim() : `${prefix}${index + 1}`;
            const id = rawId || `${prefix}${index + 1}`;
            const type = ['select', 'number', 'text', 'color'].includes(item.type) ? item.type : 'text';
            const options = Array.isArray(item.options)
                ? item.options.map((opt) => String(opt || '').trim()).filter(Boolean)
                : [];
            const normalizedOptions = type === 'select'
                ? Array.from(new Set([...options, 'N/A']))
                : options;
            return {
                id,
                question: String(item.question || '').trim(),
                type,
                options: normalizedOptions,
                required: !!item.required,
                multiSelect: type === 'select' ? item.multiSelect === true : false,
            };
        })
        .filter((item) => item.question);
};

const hasValidAnswer = (value) => {
    if (Array.isArray(value)) {
        return value.some((entry) => String(entry || '').trim());
    }
    return !!String(value || '').trim();
};

const normalizeQuestionLookupKey = (value = '') => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildQuestionContextKey = ({ description = '', city = '', locality = '' }) => [description, city, locality]
    .map((v) => String(v || '').trim().toLowerCase())
    .join('||');

const buildAnswerByIdFromQuestionText = (questionSet = [], answerTextMap = {}) => {
    const map = {};
    const source = answerTextMap && typeof answerTextMap === 'object' ? answerTextMap : {};
    (Array.isArray(questionSet) ? questionSet : []).forEach((q) => {
        const key = q?.question;
        if (!key || source[key] === undefined) return;
        map[q.id] = source[key];
    });
    return map;
};

const buildQuestionSetFromAnswerTextMap = (answerTextMap = {}, prefix = 'q') => {
    const entries = Object.entries(answerTextMap || {}).filter(([q, a]) => String(q || '').trim() && hasValidAnswer(a));
    return entries.map(([question], idx) => ({
        id: `${prefix}${idx + 1}`,
        question: String(question).trim(),
        type: 'text',
        options: [],
        required: true,
        multiSelect: false,
    }));
};

const remapAnswersByQuestionText = ({ oldQuestions = [], oldAnswersById = {}, newQuestions = [] }) => {
    const sourceMap = new Map();
    (Array.isArray(oldQuestions) ? oldQuestions : []).forEach((q) => {
        const key = normalizeQuestionLookupKey(q?.question);
        if (!key) return;
        const value = oldAnswersById?.[q.id];
        if (!hasValidAnswer(value)) return;
        sourceMap.set(key, value);
    });

    const remapped = {};
    (Array.isArray(newQuestions) ? newQuestions : []).forEach((q) => {
        const key = normalizeQuestionLookupKey(q?.question);
        if (!key || !sourceMap.has(key)) return;
        remapped[q.id] = sourceMap.get(key);
    });
    return remapped;
};

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

const PhaseIndicator = ({ currentPhase }) => {
    const currentIndex = PHASES.indexOf(currentPhase);
    const visiblePhases = PHASES.slice(0, 6);

    return (
        <div className="mb-8 rounded-2xl border border-orange-100 bg-gradient-to-r from-orange-50 via-white to-amber-50 p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between">
                {visiblePhases.map((phase, index) => (
                    <div key={phase} className="flex-1 relative">
                        <div className="flex flex-col items-center">
                            <div className={`
                                w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold
                                transition-all duration-300 border
                                ${index < currentIndex 
                                    ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-200' 
                                    : index === currentIndex 
                                        ? 'bg-orange-500 text-white ring-4 ring-orange-100 border-orange-500' 
                                        : 'bg-white text-gray-400 border-gray-200'
                                }
                            `}>
                                {index < currentIndex ? (
                                    <CheckCircle size={14} />
                                ) : (
                                    <span>{index + 1}</span>
                                )}
                            </div>
                            <span className={`
                                text-[11px] mt-2 font-semibold text-center
                                ${index <= currentIndex ? 'text-gray-800' : 'text-gray-400'}
                            `}>
                                {PHASE_LABELS[phase]}
                            </span>
                        </div>
                        {index < visiblePhases.length - 1 && (
                            <div className={`
                                absolute top-4 left-1/2 w-full h-0.5 -translate-y-1/2
                                ${index < currentIndex ? 'bg-orange-400' : 'bg-orange-100'}
                            `} />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const QuestionField = ({ question, value, onChange }) => {
    if (question.type === 'select') {
        const selected = Array.isArray(value) ? value : value ? [value] : [];

        const toggleOption = (option) => {
            if (question.multiSelect) {
                if (option === 'N/A') {
                    onChange(question.id, ['N/A']);
                    return;
                }

                const withoutNA = selected.filter((entry) => entry !== 'N/A');
                const isSelected = withoutNA.includes(option);
                const next = isSelected
                    ? withoutNA.filter((entry) => entry !== option)
                    : [...withoutNA, option];
                onChange(question.id, next);
                return;
            }

            onChange(question.id, option);
        };

        return (
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                    {question.question} {question.required ? <span className="text-red-500">*</span> : null}
                </label>
                <div className="flex flex-wrap gap-2">
                    {question.options.map((option, idx) => (
                        <button
                            key={`${question.id}-${idx}-${option}`}
                            type="button"
                            onClick={() => toggleOption(option)}
                            className={`
                                px-4 py-2 rounded-lg text-sm font-medium transition-all
                                ${selected.includes(option)
                                    ? 'bg-orange-500 text-white shadow-sm'
                                    : 'bg-gray-50 text-gray-700 border border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                                }
                            `}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
                {question.question} {question.required ? <span className="text-red-500">*</span> : null}
            </label>
            {question.type === 'number' ? (
                <input
                    type="number"
                    min={0}
                    value={value || ''}
                    onChange={(e) => onChange(question.id, sanitizeNumber(e.target.value))}
                    placeholder="Enter a number..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                />
            ) : (
                <input
                    type="text"
                    value={value || ''}
                    onChange={(e) => onChange(question.id, e.target.value)}
                    placeholder="Your answer..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                />
            )}
        </div>
    );
};

const ReportSection = ({ title, icon: Icon, children, defaultOpen = true, badge }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="bg-white/95 border border-orange-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-orange-50/60 transition-colors"
            >
                <div className="flex items-center gap-3">
                    {Icon && <Icon size={20} className="text-orange-500" />}
                    <span className="font-semibold text-gray-900 tracking-tight">{title}</span>
                    {badge && (
                        <span className="px-2.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full font-semibold">
                            {badge}
                        </span>
                    )}
                </div>
                {isOpen ? <ChevronUp size={18} className="text-orange-400" /> : <ChevronDown size={18} className="text-orange-400" />}
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-orange-100"
                    >
                        <div className="px-5 py-4 bg-gradient-to-b from-orange-50/50 to-white">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const CostBreakdownTable = ({
    breakdown,
    materialsBreakdown = [],
    equipmentBreakdown = [],
    requiredMaterialsBreakdown = [],
    optionalMaterialsBreakdown = [],
    requiredEquipmentBreakdown = [],
    optionalEquipmentBreakdown = [],
    workerTravelCost = 0,
    labourTotalOverride,
    clientBudget,
    grandTotal,
}) => {
    if (!breakdown?.breakdown?.length) return null;

    const derivedLabourTotal = breakdown.breakdown.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
    const labourTotal = Number.isFinite(Number(labourTotalOverride)) && Number(labourTotalOverride) > 0
        ? Number(labourTotalOverride)
        : derivedLabourTotal;
    const materialsTotal = materialsBreakdown.reduce((sum, item) => sum + (Number(item.estimatedCost) || 0), 0);
    const equipmentTotal = equipmentBreakdown.reduce((sum, item) => sum + (Number(item.estimatedCost) || 0), 0);
    const requiredMaterialsTotal = requiredMaterialsBreakdown.reduce((sum, item) => sum + (Number(item.estimatedCost) || 0), 0);
    const optionalMaterialsTotal = optionalMaterialsBreakdown.reduce((sum, item) => sum + (Number(item.estimatedCost) || 0), 0);
    const requiredEquipmentTotal = requiredEquipmentBreakdown.reduce((sum, item) => sum + (Number(item.estimatedCost) || 0), 0);
    const optionalEquipmentTotal = optionalEquipmentBreakdown.reduce((sum, item) => sum + (Number(item.estimatedCost) || 0), 0);
    const travelTotal = Number(workerTravelCost) || 0;
    const combinedTotal = Number(grandTotal) || labourTotal + materialsTotal + equipmentTotal + travelTotal;

    return (
        <div className="space-y-4">
            <div className="rounded-2xl border border-orange-100 bg-white overflow-hidden">
                <div className="px-4 py-3 bg-orange-50 border-b border-orange-100">
                    <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                        <IndianRupee size={16} className="text-orange-500" />
                        Combined Cost Estimate
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">Labour, materials and equipment shown together, with one final total.</p>
                </div>

                <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="rounded-xl bg-orange-50 border border-orange-100 p-3">
                            <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider">Labour</p>
                            <p className="text-lg font-black text-gray-900">{formatCurrency(labourTotal)}</p>
                        </div>
                        <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Materials</p>
                            <p className="text-lg font-black text-gray-900">{formatCurrency(materialsTotal)}</p>
                            <p className="text-[11px] text-gray-500 mt-1">
                                Required {formatCurrency(requiredMaterialsTotal)} + Optional {formatCurrency(optionalMaterialsTotal)}
                            </p>
                        </div>
                        <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Equipment</p>
                            <p className="text-lg font-black text-gray-900">{formatCurrency(equipmentTotal)}</p>
                            <p className="text-[11px] text-gray-500 mt-1">
                                Required {formatCurrency(requiredEquipmentTotal)} + Optional {formatCurrency(optionalEquipmentTotal)}
                            </p>
                        </div>
                        <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
                            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Travel</p>
                            <p className="text-lg font-black text-gray-900">{formatCurrency(travelTotal)}</p>
                            <p className="text-[11px] text-gray-500 mt-1">Worker travel cost</p>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <HardHat size={16} className="text-orange-500" />
                            Labour Breakdown
                        </h4>
                        <div className="space-y-2">
                            {breakdown.breakdown.map((item, index) => (
                                <div key={index} className="flex items-center justify-between py-2 border-b border-orange-100">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-900 capitalize">{item.skill}</span>
                                            <span className="text-xs text-gray-500">{item.count} worker{item.count > 1 ? 's' : ''}</span>
                                            {item.priceSource ? (
                                                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold uppercase">
                                                    {String(item.priceSource).replace(/_/g, ' ')}
                                                </span>
                                            ) : null}
                                        </div>
                                        <div className="flex items-center gap-3 mt-0.5">
                                            <span className="text-xs text-gray-400">{item.hours} hours</span>
                                            <span className="text-xs text-gray-400 capitalize">{item.complexity} complexity</span>
                                            <span className="text-xs text-gray-400">
                                                ₹{Number(item.ratePerHour || 0).toLocaleString()}/hr
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                ₹{Number(item.ratePerDay || 0).toLocaleString()}/day
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                ₹{Number(item.ratePerVisit || item.perWorkerCost || 0).toLocaleString()}/visit
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm font-semibold text-gray-900">{formatCurrency(item.subtotal)}</span>
                                        {item.count > 1 && (
                                            <p className="text-xs text-gray-400">₹{Math.round(item.subtotal / item.count)}/worker</p>
                                        )}
                                        {Number(item.confidence || 0) > 0 ? (
                                            <p className="text-[10px] text-gray-400">conf {Math.round(Number(item.confidence) * 100)}%</p>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {breakdown?.pricingModels && (
                        <div className="rounded-xl border border-orange-100 bg-orange-50 p-3">
                            <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider mb-2">
                                Labour Estimation Modes
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                <div className="bg-white rounded-lg border border-orange-100 p-2">
                                    <p className="text-gray-500">Per Hour Model</p>
                                    <p className="text-sm font-bold text-gray-900">{formatCurrency(breakdown.pricingModels.hourly || 0)}</p>
                                </div>
                                <div className="bg-white rounded-lg border border-orange-100 p-2">
                                    <p className="text-gray-500">Per Day Model</p>
                                    <p className="text-sm font-bold text-gray-900">{formatCurrency(breakdown.pricingModels.daily || 0)}</p>
                                </div>
                                <div className="bg-white rounded-lg border border-orange-100 p-2">
                                    <p className="text-gray-500">Per Visit Model</p>
                                    <p className="text-sm font-bold text-gray-900">{formatCurrency(breakdown.pricingModels.visit || 0)}</p>
                                </div>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-2">
                                Multi-skill coordination factor: {Number(breakdown.pricingModels.coordinationFactor || 1).toFixed(2)}
                                {Number(breakdown.pricingModels.handoffOverhead || 0) > 0 ? `, handoff overhead: ${formatCurrency(breakdown.pricingModels.handoffOverhead)}` : ''}
                            </p>
                        </div>
                    )}

                    {materialsBreakdown?.length > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <Palette size={16} className="text-orange-500" />
                                Material Breakdown
                            </h4>
                            <div className="space-y-2">
                                {materialsBreakdown.map((item, index) => (
                                    <div key={index} className="flex items-center justify-between py-2 border-b border-orange-100">
                                        <div>
                                            <span className="text-sm font-medium text-gray-900 capitalize">{item.item}</span>
                                            {item.optional ? (
                                                <span className="ml-2 text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full uppercase font-semibold">
                                                    Optional
                                                </span>
                                            ) : (
                                                <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase font-semibold">
                                                    Required
                                                </span>
                                            )}
                                            {item.quantity && <p className="text-xs text-gray-500 mt-0.5">{item.quantity}</p>}
                                            {item.note && <p className="text-xs text-orange-600 mt-0.5">{item.note}</p>}
                                        </div>
                                        <span className="text-sm font-semibold text-gray-900">{formatCurrency(item.estimatedCost)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {equipmentBreakdown?.length > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <Wrench size={16} className="text-orange-500" />
                                Equipment & Tools
                            </h4>
                            <div className="space-y-2">
                                {equipmentBreakdown.map((item, index) => (
                                    <div key={index} className="flex items-center justify-between py-2 border-b border-orange-100">
                                        <div>
                                            <span className="text-sm font-medium text-gray-900 capitalize">{item.item}</span>
                                            {item.optional ? (
                                                <span className="ml-2 text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full uppercase font-semibold">
                                                    Optional
                                                </span>
                                            ) : (
                                                <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase font-semibold">
                                                    Required
                                                </span>
                                            )}
                                            {item.quantity && <p className="text-xs text-gray-500 mt-0.5">{item.quantity}</p>}
                                        </div>
                                        <span className="text-sm font-semibold text-gray-900">{formatCurrency(item.estimatedCost)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {breakdown.additionalCosts?.length > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <Truck size={16} className="text-orange-500" />
                                Additional Costs
                            </h4>
                            <div className="space-y-2">
                                {breakdown.additionalCosts.map((item, index) => (
                                    <div key={index} className="flex items-center justify-between py-2 border-b border-orange-100">
                                        <span className="text-sm font-medium text-gray-900 capitalize">{item.description || item.item}</span>
                                        <span className="text-sm font-semibold text-gray-900">{formatCurrency(item.cost)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between items-center px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl">
                        <span className="text-white font-black">Total Estimated Cost</span>
                        <span className="text-white font-black text-lg">{formatCurrency(combinedTotal)}</span>
                    </div>

                    {clientBudget ? (
                        <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>Client budget</span>
                            <span>{formatCurrency(clientBudget)}</span>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

const WorkPlanTimeline = ({
    plan,
    timeEstimate,
    jobDate,
    jobStartTime,
    jobEndDate,
    jobEndTime,
    festivalName,
    demandMultipliers,
    demandFactor,
}) => {
    if (!plan?.length) return null;

    const scheduleDays = Array.isArray(timeEstimate?.schedule?.days) ? timeEstimate.schedule.days : [];
    const phaseHoursTotal = Array.isArray(timeEstimate?.phases)
        ? timeEstimate.phases.reduce((sum, phase) => sum + (Number(phase?.hours) || 0), 0)
        : 0;
    const displayTotalHours = phaseHoursTotal > 0
        ? phaseHoursTotal
        : (Number(timeEstimate?.totalHours) || 0);
    const breakHours = Number(timeEstimate?.totalBreakHours) || Number(timeEstimate?.schedule?.totalBreakHours) || 0;
    const calendarHours = Number(timeEstimate?.totalCalendarHours) || Number(timeEstimate?.schedule?.totalCalendarHours) || (displayTotalHours + breakHours);

    return (
        <div className="space-y-4">
            {/* Timeline Overview */}
            {displayTotalHours > 0 && (
                <div className="bg-orange-50 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                        <span className="text-sm font-medium text-gray-700">Scheduled Timeline</span>
                        <span className="text-sm font-bold text-orange-600">
                            {displayTotalHours}h work + {breakHours}h breaks = {calendarHours}h total span
                        </span>
                    </div>
                    {jobDate && (
                        <div className="text-xs text-gray-600 mb-2">
                            Start: {formatDateWithDay(jobDate)} {jobStartTime ? `at ${formatTimeLabel(jobStartTime)}` : ''}
                            {jobEndDate && jobEndTime ? ` | Ends: ${formatDateWithDay(jobEndDate)} at ${formatTimeLabel(jobEndTime)}` : ''}
                        </div>
                    )}
                    {timeEstimate?.scheduling?.workWindow ? (
                        <div className="text-xs text-gray-600 mb-2">
                            Work window: {timeEstimate.scheduling.workWindow}
                            {timeEstimate?.scheduling?.nextDayStartTime ? ` | Next day restart: ${formatTimeLabel(timeEstimate.scheduling.nextDayStartTime)}` : ''}
                            {timeEstimate?.scheduling?.workHoursPerDay ? ` | Productive cap: ${timeEstimate.scheduling.workHoursPerDay}h/day` : ''}
                        </div>
                    ) : null}
                    {(festivalName || demandFactor > 1) && (
                        <div className="flex flex-wrap gap-2 mb-2">
                            {festivalName ? (
                                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                                    Festival: {festivalName}
                                </span>
                            ) : null}
                            {demandFactor > 1 ? (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                    Demand multiplier applied: x{Number(demandFactor || 1).toFixed(2)}
                                </span>
                            ) : null}
                            {demandMultipliers?.dayType ? (
                                <span className="text-xs bg-white text-gray-700 px-2 py-1 rounded-full border border-orange-200 capitalize">
                                    {demandMultipliers.dayType} / {demandMultipliers.timePeriod || 'morning'}
                                </span>
                            ) : null}
                        </div>
                    )}
                    <div className="h-2 bg-orange-200 rounded-full overflow-hidden">
                        {timeEstimate.phases?.map((phase, idx) => {
                            const percentage = ((Number(phase?.hours) || 0) / displayTotalHours) * 100;
                            return (
                                <div
                                    key={idx}
                                    className="h-full bg-orange-500 float-left"
                                    style={{ width: `${percentage}%` }}
                                    title={`${phase.phase}: ${phase.hours}h`}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            {scheduleDays.length > 0 && (
                <div className="space-y-3">
                    {scheduleDays.map((day, dayIdx) => (
                        <div key={`${day.date}-${dayIdx}`} className="border border-orange-100 rounded-lg p-3 bg-white">
                            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                                <div className="text-sm font-semibold text-gray-900">
                                    Day {dayIdx + 1}: {day.dayName}, {formatDate(day.date)}
                                </div>
                                <div className="text-xs text-gray-600">
                                    Work: {Number(day.productiveHours || 0).toFixed(1)}h | Breaks: {Number(day.breakHours || 0).toFixed(1)}h | Span: {day.startTimeLabel} - {day.endTimeLabel}
                                </div>
                            </div>
                            <div className="space-y-2">
                                {(day.entries || []).map((entry, idx) => (
                                    <div
                                        key={`${day.date}-${idx}-${entry.title}`}
                                        className={`rounded-md px-3 py-2 border ${entry.type === 'break' ? 'bg-gray-50 border-gray-200' : 'bg-orange-50 border-orange-200'}`}
                                    >
                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                            <div className="text-sm font-medium text-gray-900">
                                                {entry.type === 'break' ? 'Break' : 'Task'}: {entry.title}
                                            </div>
                                            <div className="text-xs text-gray-700">
                                                {entry.startTimeLabel} - {entry.endTimeLabel} ({entry.durationHours}h)
                                            </div>
                                        </div>
                                        {entry.description ? (
                                            <p className="text-xs text-gray-600 mt-1">{entry.description}</p>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Detailed Steps */}
            <div className="relative">
                {plan.map((step, index) => (
                    <div key={index} className="relative pl-8 pb-6 last:pb-0">
                        {/* Timeline connector */}
                        {index < plan.length - 1 && (
                            <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-orange-200" />
                        )}
                        {/* Step number */}
                        <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold">
                            {step.step || index + 1}
                        </div>
                        {/* Step content */}
                        <div>
                            <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                                <h4 className="font-semibold text-gray-900">{step.title}</h4>
                                {step.estimatedTime && (
                                    <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                                        {step.estimatedTime}
                                    </span>
                                )}
                            </div>
                            {step.description && (
                                <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                            )}
                            {step.subtasks?.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {step.subtasks.map((task, idx) => (
                                        <div key={idx} className="flex items-start gap-2 text-xs text-gray-500">
                                            <span className="text-orange-400">•</span>
                                            <span>{task}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {step.scheduleWindows?.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {step.scheduleWindows.map((window, idx) => (
                                        <div key={`${step.step}-w-${idx}`} className="text-xs text-gray-500 bg-orange-50 border border-orange-100 rounded px-2 py-1">
                                            {window.dayName}, {formatDate(window.date)}: {window.startTimeLabel} - {window.endTimeLabel} ({window.durationHours}h)
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const MaterialSpecification = ({ materials }) => {
    if (!materials?.length) return null;

    return (
        <div className="space-y-3">
            {materials.map((material, index) => (
                <div key={index} className="border border-orange-100 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{material.item}</h4>
                            <div className="flex flex-wrap gap-3 mt-1">
                                {material.quantity && (
                                    <span className="text-xs text-gray-500">Quantity: {material.quantity}</span>
                                )}
                                {material.specifications && (
                                    <span className="text-xs text-gray-500">Specs: {material.specifications}</span>
                                )}
                                {material.brand && (
                                    <span className="text-xs text-gray-500">Brand: {material.brand}</span>
                                )}
                            </div>
                            {material.note && (
                                <p className="text-xs text-orange-600 mt-2">{material.note}</p>
                            )}
                        </div>
                        <div className="text-right">
                            <span className="text-sm font-semibold text-gray-900">
                                {formatCurrency(material.estimatedCost)}
                            </span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const DesignRecommendations = ({ colourAdvice, designSuggestions, improvementIdeas }) => {
    return (
        <div className="space-y-4">
            {/* Colour & Style */}
            {colourAdvice && (
                <div className="bg-orange-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Palette size={18} className="text-orange-500" />
                        <h4 className="font-semibold text-gray-900">Colour & Style Recommendations</h4>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{colourAdvice}</p>
                </div>
            )}

            {/* Design Suggestions */}
            {designSuggestions?.length > 0 && (
                <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <PenTool size={16} className="text-orange-500" />
                        Design Suggestions
                    </h4>
                    <div className="space-y-2">
                        {designSuggestions.map((suggestion, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                                <CheckCircle size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
                                <span>{suggestion}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Improvement Ideas */}
            {improvementIdeas?.length > 0 && (
                <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <TrendingUp size={16} className="text-orange-500" />
                        Optional Upgrades
                    </h4>
                    <div className="space-y-2">
                        {improvementIdeas.map((idea, idx) => (
                            <div key={idx} className="border border-orange-100 rounded-lg p-3 bg-white">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">{idea.idea}</p>
                                        {idea.benefit && (
                                            <p className="text-xs text-gray-600 mt-1">{idea.benefit}</p>
                                        )}
                                    </div>
                                    {idea.estimatedExtraCost > 0 && (
                                        <span className="text-sm font-semibold text-orange-600 ml-3">
                                            +{formatCurrency(idea.estimatedExtraCost)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const VisualPreview = ({ description, imageUrl }) => {
    if (!description) return null;

    return (
        <div className="space-y-4">
            {imageUrl && (
                <div className="rounded-lg overflow-hidden border border-orange-200">
                    <img src={imageUrl} alt="After completion preview" className="w-full" />
                </div>
            )}
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                    <Target size={18} className="text-orange-500" />
                    <h4 className="font-semibold text-gray-900">After Completion Preview</h4>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{description}</p>
            </div>
        </div>
    );
};

const QualityAssurance = ({ assurance }) => {
    if (!assurance) return null;

    return (
        <div className="space-y-3">
            {assurance.warranty && (
                <div className="flex items-start gap-2">
                    <CheckCircle size={16} className="text-green-500 mt-0.5" />
                    <div>
                        <span className="text-sm font-medium text-gray-900">Warranty</span>
                        <p className="text-sm text-gray-600">{assurance.warranty}</p>
                    </div>
                </div>
            )}
            {assurance.qualityCheck && (
                <div className="flex items-start gap-2">
                    <CheckCircle size={16} className="text-green-500 mt-0.5" />
                    <div>
                        <span className="text-sm font-medium text-gray-900">Quality Assurance</span>
                        <p className="text-sm text-gray-600">{assurance.qualityCheck}</p>
                    </div>
                </div>
            )}
            {assurance.materialSource && (
                <div className="flex items-start gap-2">
                    <CheckCircle size={16} className="text-green-500 mt-0.5" />
                    <div>
                        <span className="text-sm font-medium text-gray-900">Material Sourcing</span>
                        <p className="text-sm text-gray-600">{assurance.materialSource}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

const WorkerRecommendationCard = ({ worker, projectSkills = [], isStarred, isTogglingFavorite, onToggleFavorite, onHireDirect }) => {
    const matchedSkills = Array.isArray(worker?.matchedSkills) && worker.matchedSkills.length
        ? worker.matchedSkills
        : (Array.isArray(worker?.skills) ? worker.skills.filter((skill) =>
            projectSkills.map((s) => String(s || '').toLowerCase()).includes(String(skill || '').toLowerCase())
        ) : []);

    return (
        <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-start gap-3">
                <img
                    src={getImageUrl(worker.photo)}
                    alt={worker.name}
                    className="w-14 h-14 rounded-xl object-cover border border-orange-200"
                    onError={(e) => { e.currentTarget.src = '/admin.png'; }}
                />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{worker.name}</p>
                    <p className="text-[11px] text-gray-500 truncate">{worker.karigarId || 'Karigar'}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-amber-600">
                        <Star size={12} />
                        <span>{Number(worker.rating || 0).toFixed(1)} ({worker.ratingCount || 0})</span>
                    </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${worker.availability === false ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}`}>
                    {worker.availability === false ? 'Busy' : 'Available'}
                </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
                {(matchedSkills.length ? matchedSkills : (worker.skills || []).slice(0, 4)).map((skill, idx) => (
                    <span key={`${skill}-${idx}`} className="text-[11px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-100 capitalize">
                        {skill}
                    </span>
                ))}
            </div>

            <div className="mt-3 text-[11px] text-gray-600 space-y-1">
                <p className="truncate">{worker.locality ? `${worker.locality}, ` : ''}{worker.city || 'Location not available'}</p>
                {Array.isArray(worker.matchReasons) && worker.matchReasons.length > 0 && (
                    <p className="text-orange-600 truncate">Match: {worker.matchReasons.join(' • ')}</p>
                )}
            </div>

            <div className={`mt-3 grid gap-2 ${/smart|android|iphone|ios/.test(String(worker.phoneType || '').toLowerCase()) ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <a
                    href={worker.mobile ? `tel:${worker.mobile}` : undefined}
                    onClick={(e) => {
                        if (!worker.mobile) {
                            e.preventDefault();
                            toast.error('Phone number not available.');
                        }
                    }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-green-500 hover:bg-green-600 text-white py-2 text-xs font-bold"
                >
                    <Phone size={12} /> Contact
                </a>
                <button
                    type="button"
                    onClick={() => openWorkerMap(worker)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-orange-200 text-orange-700 py-2 text-xs font-bold hover:bg-orange-50"
                >
                    <MapPin size={12} /> Live Location
                </button>
                {/smart|android|iphone|ios/.test(String(worker.phoneType || '').toLowerCase()) && (
                    <button
                        type="button"
                        onClick={() => onHireDirect?.(worker)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white py-2 text-xs font-bold"
                    >
                        <Briefcase size={12} /> Hire Directly
                    </button>
                )}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={() => openWorkerProfilePreview(worker?._id || worker?.id || worker?.karigarId)}
                    className="inline-flex items-center justify-center rounded-xl bg-orange-500 hover:bg-orange-600 text-white py-2 text-xs font-bold"
                >
                    View Profile
                </button>
                <button
                    type="button"
                    disabled={isTogglingFavorite}
                    onClick={() => onToggleFavorite(worker)}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold border ${isStarred ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'} disabled:opacity-60`}
                >
                    <Heart size={12} className={isStarred ? 'fill-red-500 text-red-500' : ''} />
                    {isStarred ? 'Favorited' : 'Add Favorite'}
                </button>
            </div>
        </div>
    );
};

const WorkerRecommendations = ({ workers, projectSkills, starredWorkerIds, favoriteUpdatingId, onToggleFavorite, onHireDirect }) => {
    if (!workers?.length) return null;

    return (
        <div className="space-y-3">
            {workers.map((worker, idx) => {
                const workerId = String(worker?._id || worker?.id || worker?.karigarId || idx);
                const isStarred = starredWorkerIds.has(workerId);
                return (
                    <WorkerRecommendationCard
                        key={workerId}
                        worker={worker}
                        projectSkills={projectSkills}
                        isStarred={isStarred}
                        isTogglingFavorite={favoriteUpdatingId === workerId}
                        onToggleFavorite={onToggleFavorite}
                        onHireDirect={onHireDirect}
                    />
                );
            })}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ClientAIAssist() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('advisor');
    const [phase, setPhase] = useState('describe');
    const [isLoading, setIsLoading] = useState({ questions: false, report: false });
    
    // Direct Hire Modal
    const [isDirectHireModalOpen, setIsDirectHireModalOpen] = useState(false);
    const [directHireSelectedWorker, setDirectHireSelectedWorker] = useState(null);
    const [directHireClientData, setDirectHireClientData] = useState(null);
    
    // Form data
    const [description, setDescription] = useState('');
    const [city, setCity] = useState('');
    const [locality, setLocality] = useState('');
    const [urgent, setUrgent] = useState(false);
    const [clientBudget, setClientBudget] = useState('');
    const [includeTravelCost, setIncludeTravelCost] = useState(false);
    const [breakdownMode, setBreakdownMode] = useState('full_project');
    const [includeMaterialCost, setIncludeMaterialCost] = useState(true);
    const [includeEquipmentCost, setIncludeEquipmentCost] = useState(true);
    const [ownedMaterials, setOwnedMaterials] = useState('');
    const [ownedEquipment, setOwnedEquipment] = useState('');
    const [jobDate, setJobDate] = useState('');
    const [jobStartTime, setJobStartTime] = useState('09:00');
    const [questions, setQuestions] = useState([]);
    const [preferenceQuestions, setPreferenceQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [preferences, setPreferences] = useState({});
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [imageDraft, setImageDraft] = useState(null);
    const [report, setReport] = useState(null);
    const [savedId, setSavedId] = useState(null);
    const [historyItems, setHistoryItems] = useState([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [clearAllHistoryConfirmOpen, setClearAllHistoryConfirmOpen] = useState(false);
    const [isClearingAllHistory, setIsClearingAllHistory] = useState(false);
    const [deleteHistoryTarget, setDeleteHistoryTarget] = useState(null);
    const [editHistoryTarget, setEditHistoryTarget] = useState(null);
    const [editHistoryTitle, setEditHistoryTitle] = useState('');
    const [noteEditorOpen, setNoteEditorOpen] = useState(false);
    const [noteDraft, setNoteDraft] = useState('');
    const [starredWorkerIds, setStarredWorkerIds] = useState(() => new Set());
    const [favoriteUpdatingId, setFavoriteUpdatingId] = useState('');
    const [cityOptions, setCityOptions] = useState([]);
    const [isOtherCityMode, setIsOtherCityMode] = useState(false);
    const [questionContextKey, setQuestionContextKey] = useState('');
    const [selectedReportTab, setSelectedReportTab] = useState('costEstimate');

    const handleHireDirect = useCallback((worker) => {
        setDirectHireSelectedWorker(worker);
        setIsDirectHireModalOpen(true);
    }, []);

    const isKnownCity = cityOptions.some((opt) => opt.label === city);
    const citySelectValue = (isOtherCityMode || (city && !isKnownCity)) ? OTHER_CITY_OPTION : (city || '');
    
    const imageInputRef = useRef(null);
    const draftPersistWarnedRef = useRef(false);
    const startTimeValid = isValidJobStartTime(jobStartTime);
    const selectedTimeLabel = jobStartTime ? formatTimeLabel(jobStartTime) : '';
    const selectedPeriodLabel = jobStartTime ? getDayPeriodLabel(jobStartTime) : '';

    const applyBreakdownMode = useCallback((mode) => {
        setBreakdownMode(mode);
        if (mode === 'labour_only') {
            setIncludeMaterialCost(false);
            setIncludeEquipmentCost(false);
        } else if (mode === 'labour_plus_material') {
            setIncludeMaterialCost(true);
            setIncludeEquipmentCost(false);
        } else {
            setIncludeMaterialCost(true);
            setIncludeEquipmentCost(true);
        }
    }, []);

    useEffect(() => {
        if (includeMaterialCost && includeEquipmentCost) {
            setBreakdownMode('full_project');
        } else if (includeMaterialCost && !includeEquipmentCost) {
            setBreakdownMode('labour_plus_material');
        } else {
            setBreakdownMode('labour_only');
        }
    }, [includeMaterialCost, includeEquipmentCost]);

    // Load history
    const loadHistory = useCallback(async () => {
        setIsHistoryLoading(true);
        try {
            const { data } = await getClientAIHistory();
            setHistoryItems(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to load history:', error);
        } finally {
            setIsHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'history') {
            loadHistory();
        }
    }, [activeTab, loadHistory]);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const { data } = await getClientProfile();
                if (!active) return;
                const ids = Array.isArray(data?.starredWorkers)
                    ? data.starredWorkers.map((id) => String(id))
                    : [];
                setStarredWorkerIds(new Set(ids));
                setDirectHireClientData(data);
            } catch {
                if (!active) return;
                setStarredWorkerIds(new Set());
            }
        })();
        return () => { active = false; };
    }, []);

    useEffect(() => {
        if (phase === 'report' && report) {
            setSelectedReportTab(getFirstAvailableReportTab(report));
        }
    }, [phase, report]);

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
        let cancelled = false;

        const restoreDraft = async () => {
            try {
                const rawDraft = sessionStorage.getItem(AI_ADVISOR_DRAFT_KEY);
                if (!rawDraft) return;
                const draft = JSON.parse(rawDraft);
                if (!draft || typeof draft !== 'object') return;

                setActiveTab(draft.activeTab === 'history' ? 'history' : 'advisor');
                setPhase(PHASES.includes(draft.phase) ? draft.phase : 'describe');
                setDescription(String(draft.description || ''));
                setCity(String(draft.city || ''));
                setLocality(String(draft.locality || ''));
                setUrgent(Boolean(draft.urgent));
                setClientBudget(String(draft.clientBudget || ''));
                setIncludeTravelCost(Boolean(draft.includeTravelCost));
                applyBreakdownMode(String(draft.breakdownMode || 'full_project'));
                setIncludeMaterialCost(draft.includeMaterialCost !== false);
                setIncludeEquipmentCost(draft.includeEquipmentCost !== false);
                setOwnedMaterials(String(draft.ownedMaterials || ''));
                setOwnedEquipment(String(draft.ownedEquipment || ''));
                setJobDate(String(draft.jobDate || ''));
                setJobStartTime(String(draft.jobStartTime || '09:00'));
                setQuestions(Array.isArray(draft.questions) ? draft.questions : []);
                setPreferenceQuestions(Array.isArray(draft.preferenceQuestions) ? draft.preferenceQuestions : []);
                setAnswers(draft.answers && typeof draft.answers === 'object' ? draft.answers : {});
                setPreferences(draft.preferences && typeof draft.preferences === 'object' ? draft.preferences : {});
                setQuestionContextKey(String(draft.questionContextKey || ''));
                setReport(draft.report && typeof draft.report === 'object' ? draft.report : null);
                setSavedId(draft.savedId ? String(draft.savedId) : null);
                setIsOtherCityMode(Boolean(draft.isOtherCityMode));

                const allowedTabs = new Set(['all', ...REPORT_TAB_OPTIONS.map((tab) => tab.id)]);
                const restoredTab = String(draft.selectedReportTab || 'costEstimate');
                setSelectedReportTab(allowedTabs.has(restoredTab) ? restoredTab : 'costEstimate');

                const restoredImageDraft = draft.imageDraft && typeof draft.imageDraft === 'object'
                    ? {
                        name: String(draft.imageDraft.name || 'reference-image.jpg'),
                        type: String(draft.imageDraft.type || 'image/jpeg'),
                        size: Math.max(0, Number(draft.imageDraft.size) || 0),
                        dataUrl: String(draft.imageDraft.dataUrl || ''),
                    }
                    : null;

                if (restoredImageDraft?.dataUrl?.startsWith('data:image/')) {
                    setImageDraft(restoredImageDraft);
                    setImagePreview(restoredImageDraft.dataUrl);
                    try {
                        const restoredFile = await dataUrlToFile(
                            restoredImageDraft.dataUrl,
                            restoredImageDraft.name,
                            restoredImageDraft.type,
                        );
                        if (!cancelled) setImageFile(restoredFile);
                    } catch {
                        if (!cancelled) setImageFile(null);
                    }
                } else {
                    setImageDraft(null);
                    setImageFile(null);
                    setImagePreview(null);
                }
            } catch {
                // Ignore malformed draft payload.
            }
        };

        restoreDraft();
        return () => { cancelled = true; };
    }, [applyBreakdownMode]);

    useEffect(() => {
        const draftPayload = {
            activeTab,
            phase,
            description,
            city,
            locality,
            urgent,
            clientBudget,
            includeTravelCost,
            breakdownMode,
            includeMaterialCost,
            includeEquipmentCost,
            ownedMaterials,
            ownedEquipment,
            jobDate,
            jobStartTime,
            questions,
            preferenceQuestions,
            answers,
            preferences,
            imageDraft,
            report,
            savedId,
            isOtherCityMode,
            questionContextKey,
            selectedReportTab,
        };

        try {
            sessionStorage.setItem(AI_ADVISOR_DRAFT_KEY, JSON.stringify(draftPayload));
            draftPersistWarnedRef.current = false;
        } catch {
            if (!draftPersistWarnedRef.current) {
                toast.error('Session draft is full. Some AI Advisor fields may not persist on refresh.');
                draftPersistWarnedRef.current = true;
            }
        }
    }, [
        activeTab,
        phase,
        description,
        city,
        locality,
        urgent,
        clientBudget,
        includeTravelCost,
        breakdownMode,
        includeMaterialCost,
        includeEquipmentCost,
        ownedMaterials,
        ownedEquipment,
        jobDate,
        jobStartTime,
        questions,
        preferenceQuestions,
        answers,
        preferences,
        imageDraft,
        report,
        savedId,
        isOtherCityMode,
        questionContextKey,
        selectedReportTab,
    ]);

    const handleAnswerChange = (id, value) => {
        setAnswers(prev => ({ ...prev, [id]: value }));
    };

    const handlePreferenceChange = (id, value) => {
        setPreferences(prev => ({ ...prev, [id]: value }));
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const dataUrl = await readFileAsDataUrl(file);
                setImageFile(file);
                setImagePreview(dataUrl);
                setImageDraft({
                    name: file.name || 'reference-image.jpg',
                    type: file.type || 'image/jpeg',
                    size: Number(file.size) || 0,
                    dataUrl,
                });
            } catch {
                toast.error('Unable to read image. Please try another file.');
            }
        }
    };

    const handleGenerateQuestions = async () => {
        if (!description.trim()) {
            toast.error('Please describe your project');
            return;
        }
        if (!city.trim()) {
            toast.error('City is required for accurate budget estimation');
            return;
        }
        if (description.trim().length < MIN_AI_DESCRIPTION_CHARS) {
            toast.error(`Please enter at least ${MIN_AI_DESCRIPTION_CHARS} characters before generating questions`);
            return;
        }
        if (!startTimeValid) {
            toast.error('Start time must be between 7:00 AM and 7:00 PM.');
            return;
        }

        const currentContextKey = buildQuestionContextKey({ description, city, locality });
        if (questions.length > 0 && currentContextKey === questionContextKey) {
            setPhase('questions');
            return;
        }

        const previousQuestions = questions;
        const previousPreferenceQuestions = preferenceQuestions;
        const previousAnswers = answers;
        const previousPreferences = preferences;

        setIsLoading(prev => ({ ...prev, questions: true }));
        try {
            const { data } = await aiGenerateQuestions({
                workDescription: description,
                city: city,
                locality: locality,
                preferredLanguage: getPreferredUiLanguage(),
            });
            const nextQuestions = normalizeQuestionList(data.questions, 'q');
            const nextPreferenceQuestions = normalizeQuestionList(data.opinionQuestions, 'op');
            setQuestions(nextQuestions);
            setPreferenceQuestions(nextPreferenceQuestions);
            setAnswers(remapAnswersByQuestionText({
                oldQuestions: previousQuestions,
                oldAnswersById: previousAnswers,
                newQuestions: nextQuestions,
            }));
            setPreferences(remapAnswersByQuestionText({
                oldQuestions: previousPreferenceQuestions,
                oldAnswersById: previousPreferences,
                newQuestions: nextPreferenceQuestions,
            }));
            setQuestionContextKey(currentContextKey);
            setPhase('questions');
        } catch (error) {
            console.error('Failed to generate questions:', error);
            toast.error(error?.response?.data?.message || 'Unable to generate questions. You can proceed without them.');
            setPhase('budget');
        } finally {
            setIsLoading(prev => ({ ...prev, questions: false }));
        }
    };

    const handleGenerateReport = async () => {
        if (!description.trim()) {
            toast.error('Project description is required');
            setPhase('describe');
            return;
        }
        if (!city.trim()) {
            toast.error('City is required for accurate budget estimation');
            setPhase('describe');
            return;
        }
        if (!startTimeValid) {
            toast.error('Start time must be between 7:00 AM and 7:00 PM.');
            setPhase('describe');
            return;
        }

        const unansweredRequired = questions.filter((q) => q.required && !hasValidAnswer(answers[q.id]));
        if (unansweredRequired.length > 0) {
            toast.error('Please answer the required condition questions before generating the report');
            setPhase('questions');
            return;
        }
        setIsLoading(prev => ({ ...prev, report: true }));
        setPhase('loading');

        try {
            const answersMap = {};
            questions.forEach(q => {
                if (!hasValidAnswer(answers[q.id])) return;
                answersMap[q.question] = Array.isArray(answers[q.id])
                    ? answers[q.id].join(', ')
                    : answers[q.id];
            });

            const preferencesMap = {};
            preferenceQuestions.forEach(q => {
                if (!hasValidAnswer(preferences[q.id])) return;
                preferencesMap[q.question] = Array.isArray(preferences[q.id])
                    ? preferences[q.id].join(', ')
                    : preferences[q.id];
            });

            const formData = new FormData();
            formData.append('workDescription', description);
            formData.append('answers', JSON.stringify(answersMap));
            formData.append('opinions', JSON.stringify(preferencesMap));
            formData.append('city', city);
            formData.append('locality', locality);
            formData.append('urgent', String(urgent));
            formData.append('breakdownMode', breakdownMode);
            formData.append('includeMaterialCost', String(includeMaterialCost));
            formData.append('includeEquipmentCost', String(includeEquipmentCost));
            formData.append('includeTravelCost', String(includeTravelCost));
            formData.append('ownedMaterials', ownedMaterials);
            formData.append('ownedEquipment', ownedEquipment);
            formData.append('jobDate', jobDate);
            formData.append('jobStartTime', jobStartTime);
            formData.append('preferredLanguage', getPreferredUiLanguage());
            if (clientBudget && Number(clientBudget) > 0) {
                formData.append('clientBudget', clientBudget);
            }
            let uploadImage = imageFile;
            if (!uploadImage && imageDraft?.dataUrl) {
                uploadImage = await dataUrlToFile(
                    imageDraft.dataUrl,
                    imageDraft.name || 'reference-image.jpg',
                    imageDraft.type || 'image/jpeg',
                );
                setImageFile(uploadImage);
            }
            if (uploadImage) {
                formData.append('workImage', uploadImage);
            }

            const { data } = await getAIAdvisorReport(formData);
            setReport(data);

            // Auto-save to history
            try {
                const { data: saved } = await saveAIAnalysis({
                    workDescription: description,
                    city,
                    locality,
                    urgent,
                    clientBudget: clientBudget ? Number(clientBudget) : undefined,
                    answers: answersMap,
                    opinions: preferencesMap,
                    answersById: answers,
                    preferencesById: preferences,
                    questionSet: questions,
                    preferenceQuestionSet: preferenceQuestions,
                    includeTravelCost,
                    jobDate,
                    jobStartTime,
                    report: data,
                });
                setSavedId(saved._id);
            } catch (error) {
                console.warn('Auto-save failed:', error);
            }

            setPhase('report');
        } catch (error) {
            console.error('Report generation failed:', error);
            toast.error(error?.response?.data?.message || 'Analysis failed. Please try again.');
            setPhase('image');
        } finally {
            setIsLoading(prev => ({ ...prev, report: false }));
        }
    };

    const handleSaveNote = async (notes) => {
        if (!savedId) return false;
        try {
            await updateAIHistoryItem(savedId, { notes });
            setHistoryItems(prev => prev.map(item =>
                item._id === savedId ? { ...item, notes } : item
            ));
            return true;
        } catch (error) {
            console.error('Failed to save note:', error);
            return false;
        }
    };

    const handleLoadHistory = async (id) => {
        try {
            const { data } = await getAIHistoryItem(id);
            setReport(data.report);
            setSavedId(data._id);
            setDescription(data.workDescription || '');
            setCity(data.city || '');
            setLocality(data.locality || data.report?.locality || '');
            setUrgent(!!data.urgent);
            setClientBudget(data.clientBudget ? String(data.clientBudget) : '');
            setIncludeTravelCost(!!data.report?.includeTravelCost);
            setJobDate(data.jobDate || '');
            setJobStartTime(data.jobStartTime || '09:00');
            applyBreakdownMode(data.report?.breakdownMode || (data.report?.includeMaterialCost && data.report?.includeEquipmentCost ? 'full_project' : data.report?.includeMaterialCost ? 'labour_plus_material' : 'labour_only'));
            setOwnedMaterials(Array.isArray(data.report?.ownedMaterials) ? data.report.ownedMaterials.join(', ') : '');
            setOwnedEquipment(Array.isArray(data.report?.ownedEquipment) ? data.report.ownedEquipment.join(', ') : '');
            let restoredQuestions = normalizeQuestionList(data.questionSet, 'q');
            let restoredPreferenceQuestions = normalizeQuestionList(data.preferenceQuestionSet, 'op');

            if (!restoredQuestions.length && data.answers && typeof data.answers === 'object') {
                restoredQuestions = buildQuestionSetFromAnswerTextMap(data.answers, 'q');
            }
            if (!restoredPreferenceQuestions.length && data.opinions && typeof data.opinions === 'object') {
                restoredPreferenceQuestions = buildQuestionSetFromAnswerTextMap(data.opinions, 'op');
            }

            setQuestions(restoredQuestions);
            setPreferenceQuestions(restoredPreferenceQuestions);

            const restoredAnswersById = data.answersById && typeof data.answersById === 'object'
                ? Object.fromEntries(Object.entries(data.answersById).filter(([id]) => restoredQuestions.some((q) => q.id === id)))
                : buildAnswerByIdFromQuestionText(restoredQuestions, data.answers || {});
            const restoredPreferencesById = data.preferencesById && typeof data.preferencesById === 'object'
                ? Object.fromEntries(Object.entries(data.preferencesById).filter(([id]) => restoredPreferenceQuestions.some((q) => q.id === id)))
                : buildAnswerByIdFromQuestionText(restoredPreferenceQuestions, data.opinions || {});

            setAnswers(restoredAnswersById);
            setPreferences(restoredPreferencesById);
            setImageFile(null);
            setImagePreview(null);
            setImageDraft(null);
            setQuestionContextKey(buildQuestionContextKey({
                description: data.workDescription || '',
                city: data.city || '',
                locality: data.locality || data.report?.locality || '',
            }));
            setPhase('report');
            setActiveTab('advisor');
            toast.success('Analysis loaded');
        } catch (error) {
            console.error('Failed to load history:', error);
            toast.error('Unable to load analysis');
        }
    };

    const handleEditHistory = async (id, title) => {
        try {
            await updateAIHistoryItem(id, { title });
            setHistoryItems(prev => prev.map(item =>
                item._id === id ? { ...item, title } : item
            ));
            if (savedId === id) {
                setReport(prev => prev ? { ...prev, title } : prev);
            }
            toast.success('Title updated');
        } catch (error) {
            console.error('Failed to update title:', error);
            toast.error('Unable to update title');
        }
    };

    const handleDeleteHistory = async (id) => {
        try {
            await deleteAIHistoryItem(id);
            setHistoryItems(prev => prev.filter(item => item._id !== id));
            if (savedId === id) {
                setSavedId(null);
            }
            if (report?._id === id) {
                setReport(null);
            }
            toast.success('Analysis deleted');
        } catch (error) {
            console.error('Failed to delete:', error);
            toast.error('Unable to delete');
        }
    };

    const handleClearAllHistory = async () => {
        if (isClearingAllHistory) return;

        try {
            setIsClearingAllHistory(true);
            await clearClientAIHistory();
            setHistoryItems([]);
            setSavedId(null);
            setReport(null);
            setClearAllHistoryConfirmOpen(false);
            toast.success('All analyses cleared');
        } catch (error) {
            console.error('Failed to clear history:', error);
            toast.error('Unable to clear history');
        } finally {
            setIsClearingAllHistory(false);
        }
    };

    const handleReset = () => {
        setPhase('describe');
        setDescription('');
        setCity('');
        setLocality('');
        setIsOtherCityMode(false);
        setUrgent(false);
        setClientBudget('');
        setIncludeTravelCost(false);
        setJobDate('');
        setJobStartTime('09:00');
        applyBreakdownMode('full_project');
        setOwnedMaterials('');
        setOwnedEquipment('');
        setQuestions([]);
        setPreferenceQuestions([]);
        setAnswers({});
        setPreferences({});
        setQuestionContextKey('');
        setImageFile(null);
        setImagePreview(null);
        setImageDraft(null);
        setReport(null);
        setSavedId(null);
        sessionStorage.removeItem(AI_ADVISOR_DRAFT_KEY);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handlePrint = () => {
        const previousTab = selectedReportTab;
        let restored = false;

        const restoreSelection = () => {
            if (restored) return;
            restored = true;
            setSelectedReportTab(previousTab);
            window.removeEventListener('afterprint', restoreSelection);
        };

        setSelectedReportTab('all');
        window.addEventListener('afterprint', restoreSelection);

        window.setTimeout(() => {
            window.print();
            window.setTimeout(restoreSelection, 1500);
        }, 80);
    };

    const handleReAnalyze = () => {
        setActiveTab('advisor');
        setPhase(questions.length > 0 ? 'questions' : 'describe');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleToggleFavoriteWorker = async (worker) => {
        const workerId = String(worker?._id || worker?.id || worker?.karigarId || '');
        if (!workerId) {
            toast.error('Worker id is missing.');
            return;
        }

        setFavoriteUpdatingId(workerId);
        try {
            await toggleStarWorker(workerId);
            setStarredWorkerIds((prev) => {
                const next = new Set(prev);
                if (next.has(workerId)) {
                    next.delete(workerId);
                    toast.success('Removed from favorites');
                } else {
                    next.add(workerId);
                    toast.success('Added to favorites');
                }
                return next;
            });
        } catch (error) {
            console.error('Failed to toggle favorite worker:', error);
            toast.error('Unable to update favorites');
        } finally {
            setFavoriteUpdatingId('');
        }
    };

    const doesTabHaveContent = (tabId, currentReport = report) => {
        if (!currentReport) return false;

        switch (tabId) {
        case 'warnings':
            return !!currentReport.warnings?.length;
        case 'costEstimate':
            return true;
        case 'priceReasoning':
            return !!currentReport.priceReasoning?.length;
        case 'costSavingSuggestions':
            return !!currentReport.costSavingSuggestions?.length;
        case 'scenarioRange':
            return !!(currentReport.bestCaseTotal || currentReport.expectedTotal || currentReport.worstCaseTotal);
        case 'localMarketInsight':
            return !!currentReport.localMarketInsight;
        case 'negotiationRange':
            return !!currentReport.negotiationRange;
        case 'workPlan':
            return !!currentReport.workPlan?.length;
        case 'timeEstimate':
            return !!currentReport.timeEstimate;
        case 'expectedOutcome':
            return !!currentReport.expectedOutcome?.length;
        case 'designRecommendations':
            return !!(currentReport.colourAndStyleAdvice || currentReport.designSuggestions?.length > 0 || currentReport.improvementIdeas?.length > 0);
        case 'addNote':
            return true;
        default:
            return false;
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="client-ai-pro min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(251,146,60,0.18),_transparent_42%),radial-gradient(circle_at_bottom_left,_rgba(245,158,11,0.14),_transparent_38%),linear-gradient(120deg,_#fff7ed_0%,_#ffffff_45%,_#fffbeb_100%)]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
                {/* Header */}
                <div className="relative overflow-hidden rounded-3xl shadow-xl border border-orange-200/70 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 p-6 sm:p-8 mb-8 text-white">
                    <div className="absolute -top-20 -right-20 h-52 w-52 rounded-full bg-white/20 blur-2xl" aria-hidden="true" />
                    <div className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-amber-200/30 blur-3xl" aria-hidden="true" />
                    <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-[0.2em] font-semibold text-white/80">Client AI Workspace</p>
                            <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-1" data-guide-id="client-page-ai-assist">AI Advisor</h1>
                            <p className="text-orange-50/95 mt-2 max-w-xl">Get a polished project estimate with clear timelines, cost reasoning, and worker recommendations in one place.</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <span className="text-xs bg-white/20 border border-white/30 rounded-full px-3 py-1">Cost intelligence</span>
                                <span className="text-xs bg-white/20 border border-white/30 rounded-full px-3 py-1">Timeline forecast</span>
                                <span className="text-xs bg-white/20 border border-white/30 rounded-full px-3 py-1">Verified workers</span>
                            </div>
                        </div>
                        <div className="inline-flex rounded-2xl bg-white/15 border border-white/25 p-1.5 backdrop-blur-md">
                            <button
                                onClick={() => {
                                    handleReset();
                                    setActiveTab('advisor');
                                }}
                                className={`
                                    px-4 py-2 rounded-xl font-semibold transition-all text-sm
                                    ${activeTab === 'advisor'
                                        ? 'bg-white text-orange-700 shadow-md'
                                        : 'text-white hover:bg-white/15'
                                    }
                                `}
                            >
                                New Analysis
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`
                                    px-4 py-2 rounded-xl font-semibold transition-all text-sm
                                    ${activeTab === 'history'
                                        ? 'bg-white text-orange-700 shadow-md'
                                        : 'text-white hover:bg-white/15'
                                    }
                                `}
                            >
                                History
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2">
                        {activeTab === 'advisor' ? (
                            <div key={`advisor-${phase}`} className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-xl border border-orange-100 p-6 sm:p-7" translate="yes">
                                {phase !== 'report' && phase !== 'loading' && (
                                    <PhaseIndicator currentPhase={phase} />
                                )}

                                {/* Describe Phase */}
                                {phase === 'describe' && (
                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Project Description <span className="text-red-500">*</span>
                                            </label>
                                            <textarea
                                                rows={6}
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                placeholder="Describe your project in detail. Include dimensions, materials, and any specific requirements..."
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all resize-none"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                                {description.length} characters
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                Minimum {MIN_AI_DESCRIPTION_CHARS} characters required for AI question generation
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    City <span className="text-red-500">*</span>
                                                </label>
                                                <select
                                                    value={citySelectValue}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        if (value === OTHER_CITY_OPTION) {
                                                            setIsOtherCityMode(true);
                                                            if (isKnownCity) setCity('');
                                                            return;
                                                        }
                                                        setIsOtherCityMode(false);
                                                        setCity(value);
                                                    }}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-white"
                                                >
                                                    <option value="">Select city</option>
                                                    {cityOptions.map((cityOpt) => (
                                                        <option key={cityOpt.key} value={cityOpt.label}>{cityOpt.label}</option>
                                                    ))}
                                                    <option value={OTHER_CITY_OPTION}>Other (Enter Manually)</option>
                                                </select>
                                                {citySelectValue === OTHER_CITY_OPTION && (
                                                    <input
                                                        type="text"
                                                        value={city}
                                                        onChange={(e) => setCity(e.target.value)}
                                                        placeholder="Enter city name"
                                                        className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                                                    />
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Locality <span className="text-gray-400">(Optional)</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={locality}
                                                    onChange={(e) => setLocality(e.target.value)}
                                                    placeholder="Enter locality"
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">Used for better local material estimation.</p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Priority
                                                </label>
                                                <button
                                                    onClick={() => setUrgent(!urgent)}
                                                    className={`
                                                        w-full px-4 py-2 rounded-lg font-medium border transition-all
                                                        ${urgent
                                                            ? 'bg-orange-50 border-orange-300 text-orange-700'
                                                            : 'bg-white border-gray-300 text-gray-700 hover:border-orange-300'
                                                        }
                                                    `}
                                                >
                                                    {urgent ? 'Urgent Priority' : 'Standard Timeline'}
                                                </button>
                                            </div>

                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Job Date <span className="text-gray-400">(Optional)</span>
                                                </label>
                                                <input
                                                    type="date"
                                                    value={jobDate}
                                                    onChange={(e) => setJobDate(e.target.value)}
                                                    min={new Date().toISOString().split('T')[0]}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Start Time <span className="text-gray-400">(Optional)</span>
                                                </label>
                                                {(() => {
                                                    const { hour, minute, period } = formatTimeSelection(jobStartTime);
                                                    return (
                                                        <div className="grid grid-cols-3 gap-2">
                                                            <select
                                                                value={hour}
                                                                onChange={(e) => setJobStartTime(buildTimeFromSelection(e.target.value, minute, period))}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-white"
                                                            >
                                                                {TIME_HOUR_OPTIONS.map((option) => (
                                                                    <option key={option} value={option}>{option}</option>
                                                                ))}
                                                            </select>
                                                            <select
                                                                value={minute}
                                                                onChange={(e) => setJobStartTime(buildTimeFromSelection(hour, e.target.value, period))}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-white"
                                                            >
                                                                {TIME_MINUTE_OPTIONS.map((option) => (
                                                                    <option key={option} value={option}>{option}</option>
                                                                ))}
                                                            </select>
                                                            <select
                                                                value={period}
                                                                onChange={(e) => setJobStartTime(buildTimeFromSelection(hour, minute, e.target.value))}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-white"
                                                            >
                                                                <option value="AM">AM</option>
                                                                <option value="PM">PM</option>
                                                            </select>
                                                        </div>
                                                    );
                                                })()}
                                                {jobStartTime ? (
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Selected: {selectedTimeLabel} ({selectedPeriodLabel})
                                                    </p>
                                                ) : null}
                                                {!startTimeValid ? (
                                                    <p className="text-xs text-red-600 mt-1">
                                                        Choose a time between 7:00 AM and 7:00 PM.
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleGenerateQuestions}
                                            disabled={isLoading.questions || !description.trim() || !city.trim() || description.trim().length < MIN_AI_DESCRIPTION_CHARS || !startTimeValid}
                                            className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            <Sparkles size={18} className={isLoading.questions ? 'animate-pulse' : ''} />
                                            Continue
                                        </button>
                                    </div>
                                )}

                                {/* Questions Phase */}
                                {phase === 'questions' && (
                                    <div className="space-y-6">
                                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                            <p className="text-sm text-orange-800">
                                                Please answer these questions to help us provide a more accurate analysis.
                                            </p>
                                        </div>

                                        {questions.length === 0 ? (
                                            <p className="text-center text-gray-500 py-8">No additional questions needed.</p>
                                        ) : (
                                            <div className="space-y-4">
                                                {questions.map((q, idx) => (
                                                    <QuestionField
                                                        key={`${q.id}-${idx}`}
                                                        question={q}
                                                        value={answers[q.id]}
                                                        onChange={handleAnswerChange}
                                                    />
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setPhase('describe')}
                                                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                                            >
                                                Back
                                            </button>
                                            <button
                                                onClick={() => setPhase('budget')}
                                                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg"
                                            >
                                                Continue
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Budget Phase */}
                                {phase === 'budget' && (
                                    <div className="space-y-6">
                                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                            <p className="text-sm text-orange-800">
                                                Provide your estimated budget to get personalized advice.
                                            </p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Estimated Budget <span className="text-gray-400">(Optional)</span>
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={clientBudget}
                                                    onChange={(e) => setClientBudget(sanitizeNumber(e.target.value))}
                                                    placeholder="Enter your budget"
                                                    className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                                                />
                                            </div>
                                            <div className="flex gap-2 mt-3">
                                                {[5000, 10000, 20000, 50000, 100000].map(amount => (
                                                    <button
                                                        key={amount}
                                                        onClick={() => setClientBudget(String(amount))}
                                                        className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors"
                                                    >
                                                        ₹{amount.toLocaleString()}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="rounded-lg border border-gray-200 p-3 bg-orange-50/40">
                                            <label className="flex items-start gap-3 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={includeTravelCost}
                                                    onChange={(e) => setIncludeTravelCost(e.target.checked)}
                                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                                                />
                                                <div>
                                                    <p className="text-sm font-medium text-gray-800">Add worker travel cost</p>
                                                </div>
                                            </label>
                                        </div>

                                        <div className="bg-white border border-orange-100 rounded-xl p-4 space-y-4">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-800 mb-2">Cost Breakdown Type</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                    {[
                                                        { key: 'labour_only', label: 'Labour only' },
                                                        { key: 'labour_plus_material', label: 'Labour + material' },
                                                        { key: 'full_project', label: 'Full project' },
                                                    ].map((option) => (
                                                        <button
                                                            key={option.key}
                                                            type="button"
                                                            onClick={() => applyBreakdownMode(option.key)}
                                                            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${breakdownMode === option.key ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-700 hover:border-orange-300'}`}
                                                        >
                                                            {option.label}
                                                        </button>
                                                    ))}
                                                </div>
                                                <p className="text-xs text-gray-500 mt-2">This only changes what is included in the quote. Owned items you list below will still be excluded.</p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Materials you already have
                                                    </label>
                                                    <textarea
                                                        value={ownedMaterials}
                                                        onChange={(e) => setOwnedMaterials(e.target.value)}
                                                        rows={3}
                                                        placeholder="e.g. paint, primer, putty"
                                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all resize-none"
                                                    />
                                                    <p className="text-xs text-gray-500 mt-1">Comma-separated list. Items here will be excluded from material cost.</p>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Equipment you already have
                                                    </label>
                                                    <textarea
                                                        value={ownedEquipment}
                                                        onChange={(e) => setOwnedEquipment(e.target.value)}
                                                        rows={3}
                                                        placeholder="e.g. roller set, brushes, drop cloth"
                                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all resize-none"
                                                    />
                                                    <p className="text-xs text-gray-500 mt-1">Comma-separated list. Items here will be excluded from equipment cost.</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setPhase('questions')}
                                                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                                            >
                                                Back
                                            </button>
                                            <button
                                                onClick={() => setPhase(preferenceQuestions.length > 0 ? 'preferences' : 'image')}
                                                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg"
                                            >
                                                Continue
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Preferences Phase */}
                                {phase === 'preferences' && (
                                    <div className="space-y-6">
                                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                            <p className="text-sm text-orange-800">
                                                Share your preferences for better design and material recommendations.
                                            </p>
                                        </div>

                                        <div className="space-y-4">
                                            {preferenceQuestions.map((q, idx) => (
                                                <QuestionField
                                                    key={`${q.id}-${idx}`}
                                                    question={q}
                                                    value={preferences[q.id]}
                                                    onChange={handlePreferenceChange}
                                                />
                                            ))}
                                        </div>

                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setPhase('budget')}
                                                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                                            >
                                                Back
                                            </button>
                                            <button
                                                onClick={() => setPhase('image')}
                                                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg"
                                            >
                                                Continue
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Image Phase */}
                                {phase === 'image' && (
                                    <div className="space-y-6">
                                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                            <p className="text-sm text-orange-800">
                                                Upload photos of the work area for visual analysis (optional).
                                            </p>
                                        </div>

                                        <input
                                            ref={imageInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleImageUpload}
                                        />

                                        {imagePreview ? (
                                            <div className="relative">
                                                <img
                                                    src={imagePreview}
                                                    alt="Work area"
                                                    className="w-full rounded-lg object-cover max-h-64 border border-orange-200"
                                                />
                                                <button
                                                    onClick={() => {
                                                        setImageFile(null);
                                                        setImagePreview(null);
                                                        setImageDraft(null);
                                                    }}
                                                    className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100"
                                                >
                                                    <X size={16} className="text-gray-500" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => imageInputRef.current?.click()}
                                                className="w-full py-12 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-400 hover:bg-orange-50 transition-all"
                                            >
                                                <Camera size={32} className="mx-auto text-gray-400 mb-2" />
                                                <p className="text-sm text-gray-500">Click to upload a photo</p>
                                                <p className="text-xs text-gray-400 mt-1">JPG, PNG - Max 10MB</p>
                                            </button>
                                        )}

                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setPhase(preferenceQuestions.length > 0 ? 'preferences' : 'budget')}
                                                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                                            >
                                                Back
                                            </button>
                                            <button
                                                onClick={handleGenerateReport}
                                                disabled={isLoading.report}
                                                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                <Loader2 size={18} className={isLoading.report ? 'animate-spin' : 'opacity-0'} />
                                                Generate Analysis
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Loading Phase */}
                                {phase === 'loading' && (
                                    <div className="py-16 text-center">
                                        <div className="relative w-16 h-16 mx-auto">
                                            <div className="absolute inset-0 border-4 border-orange-100 rounded-full"></div>
                                            <div className="absolute inset-0 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                        <h3 className="text-lg font-semibold text-gray-900 mt-6">
                                            Analyzing your project
                                        </h3>
                                        <p className="text-orange-600 mt-2">
                                            This may take a few moments
                                        </p>
                                    </div>
                                )}

                                {/* Report Phase - Complete with all sections */}
                                {phase === 'report' && report && (
                                    <div className="space-y-4" id="advisor-report">
                                        {/* Report Header */}
                                        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white">
                                            <p className="text-xs font-medium opacity-80 mb-2">AI ANALYSIS REPORT</p>
                                            <h2 className="text-xl font-bold">{report.jobTitle || 'Project Analysis'}</h2>
                                            {report.problemSummary && (
                                                <p className="text-sm opacity-90 mt-2">{report.problemSummary}</p>
                                            )}
                                            <div className="flex flex-wrap items-center gap-3 mt-4">
                                                {report.durationDays && (
                                                    <span className="text-xs bg-white/20 px-3 py-1 rounded-full">
                                                        {report.durationDays} day{report.durationDays > 1 ? 's' : ''}
                                                    </span>
                                                )}
                                                {report.skillBlocks?.slice(0, 4).map((skill, idx) => (
                                                    <span key={idx} className="text-xs bg-white/20 px-3 py-1 rounded-full capitalize">
                                                        {skill.skill}
                                                    </span>
                                                ))}
                                                {report.confidence?.score && (
                                                    <span className="text-xs bg-white/20 px-3 py-1 rounded-full">
                                                        Confidence: {report.confidence.score}%
                                                    </span>
                                                )}
                                                {report.labourConfidence && (
                                                    <span className="text-xs bg-white/20 px-3 py-1 rounded-full">
                                                        Labour confidence: {report.labourConfidence}%
                                                    </span>
                                                )}
                                                {report.breakdownMode && (
                                                    <span className="text-xs bg-white/20 px-3 py-1 rounded-full capitalize">
                                                        {report.breakdownMode.replace(/_/g, ' ')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                                            <label className="block text-xs font-semibold text-orange-700 uppercase tracking-wider mb-2">
                                                Report Sections
                                            </label>
                                            <select
                                                value={selectedReportTab === 'all' ? getFirstAvailableReportTab(report) : selectedReportTab}
                                                onChange={(e) => setSelectedReportTab(e.target.value)}
                                                className="w-full px-4 py-2.5 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-white text-gray-800"
                                            >
                                                {REPORT_TAB_OPTIONS.map((tab) => (
                                                    <option key={tab.id} value={tab.id}>{tab.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Warnings Section */}
                                        {(selectedReportTab === 'all' || selectedReportTab === 'warnings') && report.warnings?.length > 0 && (
                                            <ReportSection title="Important Warnings" icon={AlertCircle} defaultOpen>
                                                <div className="space-y-2">
                                                    {report.warnings.map((warning, idx) => (
                                                        <div key={idx} className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
                                                            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                                                            <span>{warning}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ReportSection>
                                        )}

                                        {/* Cost Estimate Section */}
                                        {(selectedReportTab === 'all' || selectedReportTab === 'costEstimate') && (
                                        <ReportSection title="Cost Estimate" icon={IndianRupee} defaultOpen badge="Detailed">
                                            {(report.demandFactor > 1 || report.festivalName || report.jobDate) && (
                                                <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
                                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                                        <p className="text-sm font-semibold text-gray-900">Demand Pricing Context</p>
                                                        {report.demandFactor > 1 ? (
                                                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                                                Multiplier applied: x{Number(report.demandFactor || 1).toFixed(2)}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <div className="text-xs text-gray-700 mt-2 space-y-1">
                                                        {report.jobDate ? (
                                                            <p>
                                                                Job window: {formatDateWithDay(report.jobDate)} {report.jobStartTime ? `at ${formatTimeLabel(report.jobStartTime)}` : ''}
                                                                {report.jobEndDate && report.jobEndTime ? ` -> ${formatDateWithDay(report.jobEndDate)} at ${formatTimeLabel(report.jobEndTime)}` : ''}
                                                            </p>
                                                        ) : null}
                                                        {report.festivalName ? <p>Festival impact: {report.festivalName}</p> : null}
                                                        {report.labourTotalUnadjusted && report.labourTotal ? (
                                                            <p>
                                                                Labour before multiplier: {formatCurrency(report.labourTotalUnadjusted)} | After multiplier: {formatCurrency(report.labourTotal)}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            )}
                                            <CostBreakdownTable 
                                                breakdown={report.budgetBreakdown} 
                                                materialsBreakdown={report.materialsBreakdown}
                                                equipmentBreakdown={report.equipmentBreakdown}
                                                requiredMaterialsBreakdown={report.requiredMaterialsBreakdown || []}
                                                optionalMaterialsBreakdown={report.optionalMaterialsBreakdown || []}
                                                requiredEquipmentBreakdown={report.requiredEquipmentBreakdown || []}
                                                optionalEquipmentBreakdown={report.optionalEquipmentBreakdown || []}
                                                workerTravelCost={report.workerTravelCost || 0}
                                                labourTotalOverride={report.labourTotal}
                                                clientBudget={report.clientBudget}
                                                grandTotal={report.grandTotal}
                                            />
                                        </ReportSection>
                                        )}

                                        {/* Price Reasoning */}
                                        {(selectedReportTab === 'all' || selectedReportTab === 'priceReasoning') && report.priceReasoning?.length > 0 && (
                                            <ReportSection title="Price Reasoning" icon={Settings} defaultOpen badge={`${report.priceReasoning.length} reasons`}>
                                                <div className="space-y-2">
                                                    {report.priceReasoning.map((reason, idx) => (
                                                        <div key={idx} className="flex items-start gap-2 bg-orange-50/60 border border-orange-100 rounded-lg p-3">
                                                            <CheckCircle size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
                                                            <span className="text-sm text-gray-700">{reason}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ReportSection>
                                        )}

                                        {/* Cost Saving Suggestions */}
                                        {(selectedReportTab === 'all' || selectedReportTab === 'costSavingSuggestions') && report.costSavingSuggestions?.length > 0 && (
                                            <ReportSection title="Cost Saving Suggestions" icon={Award} defaultOpen badge={`${report.costSavingSuggestions.length} tips`}>
                                                <div className="space-y-2">
                                                    {report.costSavingSuggestions.map((tip, idx) => (
                                                        <div key={idx} className="flex items-start gap-2 bg-green-50/60 border border-green-100 rounded-lg p-3">
                                                            <Sparkles size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                                                            <span className="text-sm text-gray-700">{tip}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ReportSection>
                                        )}

                                        {/* Best / Expected / Worst */}
                                        {(selectedReportTab === 'all' || selectedReportTab === 'scenarioRange') && (report.bestCaseTotal || report.expectedTotal || report.worstCaseTotal) && (
                                            <ReportSection title="Best / Expected / Worst" icon={TrendingUp} defaultOpen>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    <div className="rounded-xl border border-green-100 bg-green-50 p-4">
                                                        <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">Best Case</p>
                                                        <p className="text-lg font-black text-gray-900">{formatCurrency(report.bestCaseTotal)}</p>
                                                        <p className="text-xs text-gray-500 mt-1">{report?.scenarioNarratives?.best || 'Most efficient execution conditions for this specific job.'}</p>
                                                    </div>
                                                    <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
                                                        <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider">Expected</p>
                                                        <p className="text-lg font-black text-gray-900">{formatCurrency(report.expectedTotal)}</p>
                                                        <p className="text-xs text-gray-500 mt-1">{report?.scenarioNarratives?.expected || 'Most likely quote based on your stated scope and market conditions.'}</p>
                                                    </div>
                                                    <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                                                        <p className="text-xs font-semibold text-red-700 uppercase tracking-wider">Worst Case</p>
                                                        <p className="text-lg font-black text-gray-900">{formatCurrency(report.worstCaseTotal)}</p>
                                                        <p className="text-xs text-gray-500 mt-1">{report?.scenarioNarratives?.worst || 'Higher-cost scenario if hidden issues appear during execution.'}</p>
                                                    </div>
                                                </div>
                                            </ReportSection>
                                        )}

                                        {/* Local Market Insight */}
                                        {(selectedReportTab === 'all' || selectedReportTab === 'localMarketInsight') && report.localMarketInsight && (
                                            <ReportSection title="Local Market Insight" icon={TrendingUp} defaultOpen>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                                                        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">City</p>
                                                        <p className="text-base font-bold text-gray-900">{report.localMarketInsight.city || report.city || 'Local market'}</p>
                                                    </div>
                                                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                                                        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Average labour</p>
                                                        <p className="text-base font-bold text-gray-900">{formatCurrency(report.localMarketInsight.avgDailyRate)}</p>
                                                    </div>
                                                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                                                        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Demand / availability</p>
                                                        <p className="text-base font-bold text-gray-900">{report.localMarketInsight.demandLevel || 'Normal'} demand, {report.localMarketInsight.availability || 'Moderate'} availability</p>
                                                    </div>
                                                </div>
                                            </ReportSection>
                                        )}

                                        {/* Negotiation Range */}
                                        {(selectedReportTab === 'all' || selectedReportTab === 'negotiationRange') && report.negotiationRange && (
                                            <ReportSection title="Negotiation Range" icon={IndianRupee} defaultOpen>
                                                <div className="rounded-xl border border-orange-100 bg-orange-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-semibold text-gray-800">Suggested negotiation range</p>
                                                        <p className="text-xs text-gray-500 mt-1">Useful for Indian market bargaining and budget comparison.</p>
                                                    </div>
                                                    <p className="text-xl font-black text-gray-900">
                                                        {formatCurrency(report.negotiationRange.min)} - {formatCurrency(report.negotiationRange.max)}
                                                    </p>
                                                </div>
                                            </ReportSection>
                                        )}

                                        {/* Work Plan Section */}
                                        {(selectedReportTab === 'all' || selectedReportTab === 'workPlan') && report.workPlan?.length > 0 && (
                                            <ReportSection title="Work Plan" icon={TrendingUp} defaultOpen badge={`${report.workPlan.length} steps`}>
                                                <WorkPlanTimeline
                                                    plan={report.workPlan}
                                                    timeEstimate={report.timeEstimate}
                                                    jobDate={report.jobDate}
                                                    jobStartTime={report.jobStartTime}
                                                    jobEndDate={report.jobEndDate}
                                                    jobEndTime={report.jobEndTime}
                                                    festivalName={report.festivalName}
                                                    demandMultipliers={report.demandMultipliers}
                                                    demandFactor={report.demandFactor}
                                                />
                                            </ReportSection>
                                        )}

                                        {/* Time Estimate Section */}
                                        {(selectedReportTab === 'all' || selectedReportTab === 'timeEstimate') && report.timeEstimate && (
                                            <ReportSection title="Time Estimate" icon={Clock} defaultOpen>
                                                {(() => {
                                                    const phaseHoursTotal = Array.isArray(report.timeEstimate?.phases)
                                                        ? report.timeEstimate.phases.reduce((sum, phase) => sum + (Number(phase?.hours) || 0), 0)
                                                        : 0;
                                                    const displayTotalHours = phaseHoursTotal > 0
                                                        ? phaseHoursTotal
                                                        : (Number(report.timeEstimate?.totalHours) || 0);
                                                    return (
                                                <div className="space-y-3">
                                                    {report.timeEstimate?.schedule?.days?.length > 0 && (
                                                        <div className="rounded-lg border border-orange-100 bg-orange-50 p-3">
                                                            <p className="text-sm font-semibold text-gray-800">Calendar-based estimate</p>
                                                            <p className="text-xs text-gray-600 mt-1">
                                                                {report.timeEstimate.schedule.days.length} day(s), {Number(report.timeEstimate.totalHours || 0).toFixed(1)} productive hours, {Number(report.timeEstimate.totalBreakHours || 0).toFixed(1)} break hours.
                                                            </p>
                                                        </div>
                                                    )}
                                                    {report.timeEstimate.phases?.map((phase, idx) => (
                                                        <div key={idx}>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-sm font-medium text-gray-700">{phase.phase}</span>
                                                                <span className="text-sm text-orange-600">{phase.hours} hours</span>
                                                            </div>
                                                            <div className="h-2 bg-orange-100 rounded-full overflow-hidden">
                                                                <div className="h-full bg-orange-500 rounded-full" style={{ width: `${displayTotalHours > 0 ? ((Number(phase?.hours) || 0) / displayTotalHours) * 100 : 0}%` }} />
                                                            </div>
                                                            {phase.description && (
                                                                <p className="text-xs text-gray-500 mt-1">{phase.description}</p>
                                                            )}
                                                        </div>
                                                    ))}
                                                    <div className="mt-3 pt-3 border-t border-orange-100">
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-semibold text-gray-900">Total Estimated Time</span>
                                                            <span className="font-bold text-orange-600">{displayTotalHours} hours</span>
                                                        </div>
                                                        {report.durationDays && (
                                                            <p className="text-sm text-gray-600 mt-1">
                                                                ≈ {report.durationDays} day{report.durationDays > 1 ? 's' : ''} of work
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                    );
                                                })()}
                                            </ReportSection>
                                        )}

                                        {/* Expected Outcome Section */}
                                        {(selectedReportTab === 'all' || selectedReportTab === 'expectedOutcome') && report.expectedOutcome?.length > 0 && (
                                            <ReportSection title="Expected Outcome" icon={Target} defaultOpen>
                                                <div className="space-y-2">
                                                    {report.expectedOutcome.map((outcome, idx) => (
                                                        <div key={idx} className="flex items-start gap-2">
                                                            <CheckCircle size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
                                                            <span className="text-sm text-gray-700">{outcome}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ReportSection>
                                        )}

                                        {/* Material Specifications section removed - already shown in Cost Breakdown */}

                                        {/* Design Recommendations */}
                                        {(selectedReportTab === 'all' || selectedReportTab === 'designRecommendations') && (report.colourAndStyleAdvice || report.designSuggestions?.length > 0 || report.improvementIdeas?.length > 0) && (
                                            <ReportSection title="Design Recommendations" icon={Palette} defaultOpen>
                                                <DesignRecommendations 
                                                    colourAdvice={report.colourAndStyleAdvice}
                                                    designSuggestions={report.designSuggestions}
                                                    improvementIdeas={report.improvementIdeas}
                                                />
                                            </ReportSection>
                                        )}

                                        {/* Quality Assurance */}
                                        {selectedReportTab === 'all' && report.qualityAssurance && (
                                            <ReportSection title="Quality Assurance" icon={CheckCircle} defaultOpen>
                                                <QualityAssurance assurance={report.qualityAssurance} />
                                            </ReportSection>
                                        )}

                                        {/* Notes Section */}
                                        {(selectedReportTab === 'all' || selectedReportTab === 'addNote') && (
                                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                                    <Edit2 size={14} className="text-orange-500" />
                                                    My Notes
                                                </label>
                                                <button
                                                    onClick={() => {
                                                        setNoteDraft(report._notes || '');
                                                        setNoteEditorOpen(true);
                                                    }}
                                                    className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                                                >
                                                    Edit
                                                </button>
                                            </div>
                                            <p className="text-sm text-gray-600 min-h-[60px]">
                                                {report._notes || 'No notes added yet. Click Edit to add your thoughts.'}
                                            </p>
                                        </div>
                                        )}

                                        {selectedReportTab !== 'all' && !doesTabHaveContent(selectedReportTab, report) && (
                                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
                                                {REPORT_TAB_OPTIONS.find((tab) => tab.id === selectedReportTab)?.label || 'This section'} is not available in this report yet.
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        <div className="flex gap-3 pt-4">
                                            <button
                                                onClick={handleReAnalyze}
                                                className="flex-1 py-2.5 border border-orange-300 text-orange-600 rounded-xl hover:bg-orange-50 font-semibold flex items-center justify-center gap-2 transition-all hover:shadow-sm"
                                            >
                                                <Sparkles size={18} />
                                                Re-analysis
                                            </button>
                                            <button
                                                onClick={handleReset}
                                                className="flex-1 py-2.5 border border-orange-300 text-orange-600 rounded-xl hover:bg-orange-50 font-semibold transition-all hover:shadow-sm"
                                            >
                                                New Analysis
                                            </button>
                                            <button
                                                onClick={handlePrint}
                                                className="flex-1 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-md shadow-orange-200"
                                            >
                                                <Download size={18} />
                                                Export Report
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            // History Tab
                            <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-xl border border-orange-100 p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-lg font-semibold text-gray-900">Analysis History</h2>
                                    {historyItems.length > 0 && (
                                        <button
                                            onClick={() => setClearAllHistoryConfirmOpen(true)}
                                            className="text-sm text-red-600 hover:text-red-700"
                                        >
                                            Clear All
                                        </button>
                                    )}
                                </div>

                                {isHistoryLoading ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 size={32} className="animate-spin text-orange-400" />
                                    </div>
                                ) : historyItems.length === 0 ? (
                                    <div className="text-center py-12">
                                        <FileText size={48} className="mx-auto text-gray-300 mb-3" />
                                        <p className="text-gray-500">No saved analyses yet</p>
                                        <p className="text-sm text-gray-400 mt-1">Your reports will appear here</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {historyItems.map(item => (
                                            <div
                                                key={item._id}
                                                onClick={() => handleLoadHistory(item._id)}
                                                className={`
                                                    group bg-white border rounded-2xl p-4 cursor-pointer transition-all
                                                    ${savedId === item._id ? 'border-orange-400 bg-orange-50 shadow-sm shadow-orange-100' : 'border-gray-200 hover:border-orange-200 hover:bg-orange-50/30 hover:shadow-sm'}
                                                `}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-semibold text-gray-900 truncate group-hover:text-orange-700 transition-colors">
                                                            {item.title || item.report?.jobTitle || 'Untitled Analysis'}
                                                        </h4>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            {item.city && (
                                                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                                                    <MapPin size={10} />
                                                                    {item.city}
                                                                </span>
                                                            )}
                                                            {item.clientBudget > 0 && (
                                                                <span className="text-xs text-gray-500">
                                                                    Budget: {formatCurrency(item.clientBudget)}
                                                                </span>
                                                            )}
                                                            <span className="text-xs text-gray-400">
                                                                {formatDate(item.createdAt)}
                                                            </span>
                                                        </div>
                                                        {item.notes && (
                                                            <p className="text-xs text-gray-400 mt-2 line-clamp-1">
                                                                {item.notes}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => {
                                                                setEditHistoryTarget(item);
                                                                setEditHistoryTitle(item.title || item.report?.jobTitle || '');
                                                            }}
                                                            className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteHistoryTarget(item)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Sidebar - Tips / Worker Recommendations */}
                    {activeTab === 'advisor' && phase !== 'report' && phase !== 'loading' && (
                        <div className="lg:col-span-1">
                            <div className="bg-white/95 rounded-3xl shadow-lg border border-orange-100 p-6 sticky top-8">
                                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <Sparkles size={18} className="text-orange-500" />
                                    Tips for Better Results
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex gap-3">
                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-semibold">1</div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">Be Specific</p>
                                            <p className="text-xs text-gray-500">Include dimensions, materials, and current issues</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-semibold">2</div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">Add Photos</p>
                                            <p className="text-xs text-gray-500">Visual references help identify potential issues</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-semibold">3</div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">Set Realistic Budget</p>
                                            <p className="text-xs text-gray-500">Helps provide accurate cost advice</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-semibold">4</div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">Share Preferences</p>
                                            <p className="text-xs text-gray-500">Colour, style, material choices improve recommendations</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'advisor' && phase === 'report' && report && (
                        <div className="lg:col-span-1">
                            <div className="bg-white/95 rounded-3xl shadow-lg border border-orange-100 p-4 sticky top-8">
                                <div className="mb-3">
                                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                        <Users size={18} className="text-orange-500" />
                                        Recommended Workers
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Matched by skills, location, ratings and current availability.
                                    </p>
                                </div>

                                {report.topWorkers?.length > 0 ? (
                                    <div className="max-h-[75vh] overflow-y-auto pr-1">
                                        <WorkerRecommendations
                                            workers={report.topWorkers}
                                            projectSkills={report.skillBlocks?.map((s) => s.skill)}
                                            starredWorkerIds={starredWorkerIds}
                                            favoriteUpdatingId={favoriteUpdatingId}
                                            onToggleFavorite={handleToggleFavoriteWorker}
                                            onHireDirect={handleHireDirect}
                                        />
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                                        No worker recommendation available for this report.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {clearAllHistoryConfirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
                        onClick={() => {
                            if (!isClearingAllHistory) setClearAllHistoryConfirmOpen(false);
                        }}
                    />
                    <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-orange-100">
                        <h3 className="text-lg font-bold text-gray-900">Delete all analyses?</h3>
                        <p className="mt-2 text-sm text-gray-600">
                            This will permanently remove all saved analyses from your history. This action cannot be undone.
                        </p>

                        <div className="mt-6 flex gap-3 justify-end">
                            <button
                                type="button"
                                onClick={() => setClearAllHistoryConfirmOpen(false)}
                                disabled={isClearingAllHistory}
                                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleClearAllHistory}
                                disabled={isClearingAllHistory}
                                className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 font-medium disabled:opacity-60 flex items-center gap-2"
                            >
                                {isClearingAllHistory && <Loader2 size={14} className="animate-spin" />}
                                {isClearingAllHistory ? 'Deleting...' : 'Delete All'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {deleteHistoryTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
                        onClick={() => setDeleteHistoryTarget(null)}
                    />
                    <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-orange-100">
                        <h3 className="text-lg font-bold text-gray-900">Delete this analysis?</h3>
                        <p className="mt-2 text-sm text-gray-600">
                            This will permanently remove {deleteHistoryTarget.title || deleteHistoryTarget.report?.jobTitle || 'this analysis'} from your history.
                        </p>

                        <div className="mt-6 flex gap-3 justify-end">
                            <button
                                type="button"
                                onClick={() => setDeleteHistoryTarget(null)}
                                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    const targetId = deleteHistoryTarget?._id;
                                    setDeleteHistoryTarget(null);
                                    if (targetId) {
                                        await handleDeleteHistory(targetId);
                                    }
                                }}
                                className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 font-medium"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editHistoryTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
                        onClick={() => setEditHistoryTarget(null)}
                    />
                    <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-orange-100">
                        <h3 className="text-lg font-bold text-gray-900">Edit title</h3>
                        <p className="mt-2 text-sm text-gray-600">
                            Update the saved title for {editHistoryTarget.report?.jobTitle || 'this analysis'}.
                        </p>

                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                            <input
                                type="text"
                                value={editHistoryTitle}
                                onChange={(e) => setEditHistoryTitle(e.target.value)}
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                                placeholder="Enter title"
                            />
                        </div>

                        <div className="mt-6 flex gap-3 justify-end">
                            <button
                                type="button"
                                onClick={() => setEditHistoryTarget(null)}
                                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    const targetId = editHistoryTarget?._id;
                                    const nextTitle = editHistoryTitle.trim();
                                    if (!nextTitle) {
                                        toast.error('Title cannot be empty');
                                        return;
                                    }
                                    setEditHistoryTarget(null);
                                    await handleEditHistory(targetId, nextTitle);
                                }}
                                className="px-4 py-2 rounded-xl bg-orange-600 text-white hover:bg-orange-700 font-medium"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {noteEditorOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
                        onClick={() => setNoteEditorOpen(false)}
                    />
                    <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-orange-100">
                        <h3 className="text-lg font-bold text-gray-900">Edit Notes</h3>
                        <p className="mt-2 text-sm text-gray-600">
                            Save personal notes for this analysis.
                        </p>

                        <div className="mt-4">
                            <textarea
                                rows={6}
                                value={noteDraft}
                                onChange={(e) => setNoteDraft(e.target.value)}
                                placeholder="Add your notes here..."
                                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 resize-none"
                            />
                        </div>

                        <div className="mt-6 flex gap-3 justify-end">
                            <button
                                type="button"
                                onClick={() => setNoteEditorOpen(false)}
                                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    const saved = await handleSaveNote(noteDraft);
                                    setReport(prev => ({ ...prev, _notes: noteDraft }));
                                    setNoteEditorOpen(false);
                                    if (saved) {
                                        toast.success('Notes saved');
                                    } else {
                                        toast.error('Unable to save note to history right now');
                                    }
                                }}
                                className="px-4 py-2 rounded-xl bg-orange-600 text-white hover:bg-orange-700 font-medium"
                            >
                                Save Notes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Print styles */}
            <style>{`
                .client-ai-pro {
                    font-family: Poppins, "Nunito Sans", "Segoe UI", sans-serif;
                }

                @media print {
                    .print\\:hidden {
                        display: none !important;
                    }
                    body {
                        background: white;
                    }
                    .bg-orange-50, .bg-orange-100 {
                        background-color: #fef3c7 !important;
                    }
                }
            `}</style>

            <DirectHireModal
                isOpen={isDirectHireModalOpen}
                worker={directHireSelectedWorker}
                client={directHireClientData}
                onClose={() => setIsDirectHireModalOpen(false)}
                onSuccess={() => {
                    // Handle any post-success actions if needed
                }}
            />
        </div>
    );
}