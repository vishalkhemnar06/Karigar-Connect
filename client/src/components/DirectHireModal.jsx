import { useState, useMemo, useEffect } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import * as api from '../api';
import { getImageUrl } from '../constants/config';
import { 
  Briefcase, Send, ShieldCheck, X, Calendar, Clock, 
  MapPin, IndianRupee, User, Phone, Mail, Award,
  Star, TrendingUp, Zap, Gift, Heart, ThumbsUp,
  CheckCircle, AlertCircle, Loader2, DollarSign,
  Building2, Home, CreditCard, Smartphone, Users
} from 'lucide-react';

const isSmartphoneWorker = (worker) => /smart|android|iphone|ios/.test(String(worker?.phoneType || '').toLowerCase());

const extractSkillNames = (skills = []) => {
    const names = Array.isArray(skills)
        ? skills
            .map((s) => (typeof s === 'string' ? s : s?.name))
            .map((name) => String(name || '').trim())
            .filter(Boolean)
        : [];
    return Array.from(new Set(names));
};

const defaultForm = {
    skill: '',
    scheduledDate: '',
    scheduledTime: '09:00',
    durationValue: 1,
    durationUnit: '/day',
    fetchedAmount: '',
    expectedAmount: '',
    paymentMode: 'cash',
    oneLineJD: '',
    location: {
        city: '',
        locality: '',
        state: '',
        pincode: '',
        fullAddress: '',
    },
};

const timeOptions = {
    hours: Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')),
    minutes: ['00', '15', '30', '45'],
    periods: ['AM', 'PM'],
};

const parseTimeParts = (time24) => {
    if (!time24) return { hour: '09', minute: '00', period: 'AM' };
    const [hourStr = '09', minuteStr = '00'] = String(time24).split(':');
    const hourNum = Number(hourStr);
    const minuteNum = Number(minuteStr || '0');
    const period = hourNum >= 12 ? 'PM' : 'AM';
    const displayHour = hourNum % 12 === 0 ? 12 : hourNum % 12;
    return {
        hour: String(displayHour).padStart(2, '0'),
        minute: String(Number.isFinite(minuteNum) ? minuteNum : 0).padStart(2, '0'),
        period,
    };
};

const buildTime24FromParts = ({ hour, minute, period }) => {
    let hourNum = Number(hour);
    const minuteNum = Number(minute);
    if (period === 'PM' && hourNum < 12) hourNum += 12;
    if (period === 'AM' && hourNum === 12) hourNum = 0;
    return `${String(hourNum).padStart(2, '0')}:${String(minuteNum).padStart(2, '0')}`;
};

const getPricingReasonMessage = (pricingMeta) => {
    if (!pricingMeta) return '';
    const multipliers = pricingMeta.multipliers || {};
    const dayType = multipliers.dayType || 'weekday';
    
    let reasons = [];
    
    const festivalName = String(multipliers.festivalName || '').trim();
    if (festivalName && festivalName.toLowerCase() !== 'none') {
        reasons.push(festivalName);
    }
    
    if (dayType === 'holiday') {
        reasons.push('Indian Public Holiday');
    }
    
    if (dayType === 'weekend') {
        reasons.push('Weekend');
    }
    
    const multiplier = Number(multipliers.finalMultiplier || 1);
    if (multiplier > 1.01 && reasons.length === 0) {
        reasons.push('High demand');
    }
    
    const reasonText = reasons.join(', ');
    if (!reasonText) return '';
    return `Due to ${reasonText}, cost is higher. You can select another date to reduce cost.`;
};

const prefillForm = (worker = null, client = null) => ({
    ...defaultForm,
    skill: '',
    location: {
        city: '',
        locality: '',
        state: client?.address?.state || client?.state || '',
        pincode: client?.address?.pincode || client?.pincode || '',
        fullAddress: client?.address?.fullAddress || client?.fullAddress || '',
    },
});

export default function DirectHireModal({ isOpen, worker, client, onClose, onSuccess }) {
    const [form, setForm] = useState(() => prefillForm(worker, client));
    const [pricingMeta, setPricingMeta] = useState(null);
    const [fetchingAmount, setFetchingAmount] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [workerSkills, setWorkerSkills] = useState([]);
    const [loadingWorkerSkills, setLoadingWorkerSkills] = useState(false);
    const [timeParts, setTimeParts] = useState(parseTimeParts(defaultForm.scheduledTime));

    const selectedWorkerIsSmartphone = useMemo(() => isSmartphoneWorker(worker), [worker]);
    const fallbackWorkerSkills = useMemo(() => extractSkillNames(worker?.skills), [worker]);
    const skillOptions = workerSkills.length ? workerSkills : fallbackWorkerSkills;
    const fetchedAmountNum = Number(form.fetchedAmount || 0);
    const expectedAmountNum = Number(form.expectedAmount || 0);
    const durationValueNum = Math.max(1, Number(form.durationValue) || 1);
    const minAllowed = fetchedAmountNum > 0 ? Math.max(1, Math.round(fetchedAmountNum * 0.7)) : 0;
    const maxAllowed = fetchedAmountNum > 0 ? Math.max(minAllowed, Math.round(fetchedAmountNum * 1.3)) : 0;
    const isExpectedOutOfRange = fetchedAmountNum > 0 && expectedAmountNum > 0 && (expectedAmountNum < minAllowed || expectedAmountNum > maxAllowed);
    const displayUnitRate = Number(pricingMeta?.unitRate || 0);
    const displayTotalEstimate = displayUnitRate > 0 ? Math.round(displayUnitRate * durationValueNum) : 0;

    useEffect(() => {
        if (isOpen && worker && client) {
            setForm(prefillForm(worker, client));
            setPricingMeta(null);
            setWorkerSkills([]);
            setTimeParts(parseTimeParts(defaultForm.scheduledTime));
        }
    }, [isOpen, worker, client]);

    useEffect(() => {
        setTimeParts(parseTimeParts(form.scheduledTime));
    }, [form.scheduledTime]);

    useEffect(() => {
        let active = true;
        if (!isOpen || !worker?._id) return () => { active = false; };

        (async () => {
            try {
                setLoadingWorkerSkills(true);
                const { data } = await api.getWorkerFullProfile(worker._id);
                if (!active) return;
                const skillsFromProfile = extractSkillNames(data?.skills);
                const resolvedSkills = skillsFromProfile.length ? skillsFromProfile : fallbackWorkerSkills;
                setWorkerSkills(resolvedSkills);
                setForm((prev) => ({
                    ...prev,
                    skill: resolvedSkills.includes(prev.skill) ? prev.skill : (resolvedSkills[0] || ''),
                }));
            } catch {
                if (!active) return;
                setWorkerSkills(fallbackWorkerSkills);
                setForm((prev) => ({
                    ...prev,
                    skill: fallbackWorkerSkills.includes(prev.skill) ? prev.skill : (fallbackWorkerSkills[0] || ''),
                }));
            } finally {
                if (active) setLoadingWorkerSkills(false);
            }
        })();

        return () => { active = false; };
    }, [isOpen, worker?._id, fallbackWorkerSkills]);

    const updateField = (key, value) => {
        if ((key === 'durationValue' || key === 'expectedAmount') && Number(value) < 0) return;
        const pricingSensitiveKeys = new Set(['skill', 'scheduledDate', 'scheduledTime', 'durationValue', 'durationUnit']);
        setForm((prev) => {
            const next = { ...prev, [key]: value };
            if (pricingSensitiveKeys.has(key) && prev.fetchedAmount) {
                next.fetchedAmount = '';
                next.expectedAmount = '';
            }
            return next;
        });
        if (pricingSensitiveKeys.has(key)) {
            setPricingMeta(null);
        }
    };

    const updateLocationField = (key, value) => {
        setForm((prev) => ({
            ...prev,
            fetchedAmount: '',
            expectedAmount: '',
            location: {
                ...prev.location,
                [key]: value,
            },
        }));
        setPricingMeta(null);
    };

    const updateScheduledTime = (nextTimeParts) => {
        const normalized = buildTime24FromParts(nextTimeParts);
        setTimeParts(nextTimeParts);
        updateField('scheduledTime', normalized);
    };

    const fetchSuggestedAmount = async () => {
        if (!worker?._id) return toast.error('Worker not selected.');
        if (!selectedWorkerIsSmartphone) return toast.error('Direct hire is only for smartphone workers.');
        if (!form.skill.trim()) return toast.error('Skill is required.');
        if (!form.scheduledDate || !form.scheduledTime) return toast.error('Date and time are required.');
        if (!form.location.city || !form.location.state || !form.location.pincode || !form.location.fullAddress) {
            return toast.error('City, state, pincode, and full address are required.');
        }

        try {
            setFetchingAmount(true);
            const { data } = await api.getDirectHireSuggestedAmount({
                skill: form.skill,
                location: form.location,
                scheduledDate: form.scheduledDate,
                scheduledTime: form.scheduledTime,
                durationValue: form.durationValue,
                durationUnit: form.durationUnit,
            });
            const pricing = data?.pricing || null;
            if (!pricing?.suggestedAmount) {
                toast.error('Could not fetch suggested amount.');
                return;
            }
            const durationNum = Math.max(1, Number(form.durationValue) || 1);
            const suggestedAmount = Number(pricing.suggestedAmount || 0);
            setPricingMeta({
                ...pricing,
                unitRate: durationNum > 0 ? (suggestedAmount / durationNum) : suggestedAmount,
                totalEstimate: suggestedAmount,
            });
            setForm((prev) => ({
                ...prev,
                fetchedAmount: String(suggestedAmount),
                expectedAmount: String(suggestedAmount),
            }));
            toast.success('Suggested amount fetched. You can edit within selected limit.');
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Unable to fetch suggested amount.');
        } finally {
            setFetchingAmount(false);
        }
    };

    const submitDirectHire = async (event) => {
        event.preventDefault();
        if (!worker?._id) return toast.error('Worker not selected.');
        if (!selectedWorkerIsSmartphone) return toast.error('Direct hire is only for smartphone workers.');
        if (!pricingMeta || Number(form.fetchedAmount) <= 0) return toast.error('Please click Get Amount before sending invite.');
        if (Number(form.expectedAmount) <= 0) return toast.error('Amount must be greater than 0.');
        if (Number(form.expectedAmount) < minAllowed || Number(form.expectedAmount) > maxAllowed) {
            return toast.error(`Amount out of allowed range. Use ₹${minAllowed} to ₹${maxAllowed}.`);
        }

        try {
            setSubmitting(true);
            await api.createDirectHireTicket({
                workerId: worker._id,
                skill: form.skill,
                location: form.location,
                scheduledDate: form.scheduledDate,
                scheduledTime: form.scheduledTime,
                durationValue: form.durationValue,
                durationUnit: form.durationUnit,
                fetchedAmount: Number(form.fetchedAmount),
                expectedAmount: Number(form.expectedAmount),
                paymentMode: form.paymentMode,
                oneLineJD: form.oneLineJD,
            });
            toast.success('Direct hire request sent successfully!');
            setForm(prefillForm(worker, client));
            setPricingMeta(null);
            onSuccess?.();
            onClose();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Unable to create direct hire.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-auto"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, y: 20, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.95, y: 20, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full my-4 overflow-hidden"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header - Compact */}
                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                                    <Briefcase size="18" className="text-white" />
                                </div>
                                <div>
                                    <h2 className="text-white font-bold text-base">Direct Hire Worker</h2>
                                    <p className="text-orange-100 text-[10px] mt-0.5">Create a direct hiring request</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-1.5 hover:bg-white/20 rounded-lg transition-all"
                            >
                                <X size="18" className="text-white" />
                            </button>
                        </div>
                    </div>

                    <form onSubmit={submitDirectHire} className="p-4 space-y-3">
                        {/* Worker Card - Compact */}
                        {worker && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-2.5 border border-orange-200"
                            >
                                <div className="flex items-center gap-3">
                                    <img
                                        src={getImageUrl(worker.photo)}
                                        alt={worker.name}
                                        className="w-10 h-10 rounded-lg object-cover border border-orange-200"
                                        onError={(e) => { e.currentTarget.src = '/admin.png'; }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <p className="font-bold text-gray-800 text-sm truncate">{worker.name}</p>
                                            {worker.verificationStatus === 'approved' && (
                                                <CheckCircle size="12" className="text-emerald-500" />
                                            )}
                                        </div>
                                        <p className="text-[10px] text-gray-500 font-mono truncate">{worker.karigarId || worker._id}</p>
                                    </div>
                                    <div className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                        selectedWorkerIsSmartphone 
                                            ? 'bg-emerald-100 text-emerald-700' 
                                            : 'bg-red-100 text-red-700'
                                    }`}>
                                        <Smartphone size="10" />
                                        {selectedWorkerIsSmartphone ? 'Smartphone' : 'Basic Phone'}
                                    </div>
                                    {worker.avgStars > 0 && (
                                        <div className="flex items-center gap-1">
                                            <div className="flex gap-0.5">
                                                {[1,2,3,4,5].map(star => (
                                                    <Star key={star} size="10" className={star <= worker.avgStars ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
                                                ))}
                                            </div>
                                            <span className="text-[9px] text-gray-500">({worker.completedJobs || 0})</span>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* Two Column Layout for Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Left Column */}
                            <div className="space-y-3">
                                {/* Job Details */}
                                <div>
                                    <h3 className="text-[11px] font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                                        <Briefcase size="12" className="text-orange-500" />
                                        Job Details
                                    </h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                                                Skill <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-orange-400 focus:ring-1 focus:ring-orange-100 outline-none"
                                                value={form.skill}
                                                onChange={(e) => updateField('skill', e.target.value)}
                                                disabled={loadingWorkerSkills || skillOptions.length === 0}
                                            >
                                                <option value="">
                                                    {loadingWorkerSkills ? 'Loading...' : 'Select skill'}
                                                </option>
                                                {skillOptions.map((skill) => (
                                                    <option key={skill} value={skill}>{skill}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                                                Duration
                                            </label>
                                            <div className="flex gap-1">
                                                <input 
                                                    type="number" 
                                                    min="1" 
                                                    className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-orange-400 focus:ring-1 focus:ring-orange-100 outline-none" 
                                                    value={form.durationValue} 
                                                    onChange={(e) => updateField('durationValue', e.target.value)} 
                                                />
                                                <select 
                                                    className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-orange-400 focus:ring-1 focus:ring-orange-100 outline-none bg-white" 
                                                    value={form.durationUnit} 
                                                    onChange={(e) => updateField('durationUnit', e.target.value)}
                                                >
                                                    <option value="/day">Per Day</option>
                                                    <option value="/hour">Per Hour</option>
                                                    <option value="/visit">Per Visit</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                                                Date <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <Calendar size="11" className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                                <input 
                                                    type="date" 
                                                    className="w-full rounded-lg border border-gray-200 pl-7 pr-2 py-1.5 text-xs focus:border-orange-400 focus:ring-1 focus:ring-orange-100 outline-none" 
                                                    value={form.scheduledDate} 
                                                    onChange={(e) => updateField('scheduledDate', e.target.value)} 
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                                                Time <span className="text-red-500">*</span>
                                            </label>
                                            <div className="flex gap-1">
                                                <select
                                                    className="w-full rounded-lg border border-gray-200 px-1 py-1.5 text-xs focus:border-orange-400 focus:ring-1 focus:ring-orange-100 outline-none bg-white"
                                                    value={timeParts.hour}
                                                    onChange={(e) => updateScheduledTime({ ...timeParts, hour: e.target.value })}
                                                >
                                                    {timeOptions.hours.map((hour) => (
                                                        <option key={hour} value={hour}>{hour}</option>
                                                    ))}
                                                </select>
                                                <select
                                                    className="w-full rounded-lg border border-gray-200 px-1 py-1.5 text-xs focus:border-orange-400 focus:ring-1 focus:ring-orange-100 outline-none bg-white"
                                                    value={timeParts.minute}
                                                    onChange={(e) => updateScheduledTime({ ...timeParts, minute: e.target.value })}
                                                >
                                                    {timeOptions.minutes.map((minute) => (
                                                        <option key={minute} value={minute}>{minute}</option>
                                                    ))}
                                                </select>
                                                <select
                                                    className="w-full rounded-lg border border-gray-200 px-1 py-1.5 text-xs focus:border-orange-400 focus:ring-1 focus:ring-orange-100 outline-none bg-white"
                                                    value={timeParts.period}
                                                    onChange={(e) => updateScheduledTime({ ...timeParts, period: e.target.value })}
                                                >
                                                    {timeOptions.periods.map((period) => (
                                                        <option key={period} value={period}>{period}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                                                Payment Mode
                                            </label>
                                            <select 
                                                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-orange-400 focus:ring-1 focus:ring-orange-100 outline-none bg-white" 
                                                value={form.paymentMode} 
                                                onChange={(e) => updateField('paymentMode', e.target.value)}
                                            >
                                                <option value="cash">💵 Cash</option>
                                                <option value="upi">📱 UPI</option>
                                                <option value="bank_transfer">🏦 Bank Transfer</option>
                                                <option value="online">💳 Online</option>
                                            </select>
                                        </div>

                                        <div className="col-span-2">
                                            <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                                                Job Description
                                            </label>
                                            <input 
                                                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-orange-400 focus:ring-1 focus:ring-orange-100 outline-none" 
                                                placeholder="Brief job description..." 
                                                value={form.oneLineJD} 
                                                onChange={(e) => updateField('oneLineJD', e.target.value)} 
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column */}
                            <div className="space-y-3">
                                {/* Location Details - Compact */}
                                <div>
                                    <h3 className="text-[11px] font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                                        <MapPin size="12" className="text-orange-500" />
                                        Location
                                    </h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input 
                                            className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-orange-400 focus:ring-1 focus:ring-orange-100 outline-none" 
                                            placeholder="City" 
                                            value={form.location.city} 
                                            onChange={(e) => updateLocationField('city', e.target.value)} 
                                        />
                                        <input 
                                            className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-orange-400 focus:ring-1 focus:ring-orange-100 outline-none" 
                                            placeholder="Locality" 
                                            value={form.location.locality} 
                                            onChange={(e) => updateLocationField('locality', e.target.value)} 
                                        />
                                        <input 
                                            className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-orange-400 focus:ring-1 focus:ring-orange-100 outline-none" 
                                            placeholder="State" 
                                            value={form.location.state} 
                                            onChange={(e) => updateLocationField('state', e.target.value)} 
                                        />
                                        <input 
                                            className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-orange-400 focus:ring-1 focus:ring-orange-100 outline-none" 
                                            placeholder="Pincode" 
                                            value={form.location.pincode} 
                                            onChange={(e) => updateLocationField('pincode', e.target.value)} 
                                        />
                                        <input 
                                            className="col-span-2 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-orange-400 focus:ring-1 focus:ring-orange-100 outline-none" 
                                            placeholder="Full Address" 
                                            value={form.location.fullAddress} 
                                            onChange={(e) => updateLocationField('fullAddress', e.target.value)} 
                                        />
                                    </div>
                                </div>

                                {/* Pricing Section - Compact */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-[11px] font-bold text-amber-800 flex items-center gap-1.5">
                                            <IndianRupee size="12" /> Pricing
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={fetchSuggestedAmount}
                                            disabled={fetchingAmount || !selectedWorkerIsSmartphone}
                                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold hover:shadow-md transition-all disabled:opacity-50"
                                        >
                                            {fetchingAmount ? (
                                                <Loader2 size="10" className="animate-spin" />
                                            ) : (
                                                <Zap size="10" />
                                            )}
                                            Get Amount
                                        </button>
                                    </div>

                                    {displayUnitRate > 0 && (
                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                            <div className="bg-amber-50 rounded-lg p-1.5 text-center">
                                                <p className="text-[8px] text-gray-500 font-semibold">Unit Rate</p>
                                                <p className="text-xs font-bold text-amber-700">
                                                    ₹{displayUnitRate.toLocaleString()}
                                                    <span className="text-[9px]">{form.durationUnit}</span>
                                                </p>
                                            </div>
                                            <div className="bg-amber-50 rounded-lg p-1.5 text-center">
                                                <p className="text-[8px] text-gray-500 font-semibold">Total</p>
                                                <p className="text-xs font-bold text-amber-700">
                                                    ₹{displayTotalEstimate > 0 ? displayTotalEstimate.toLocaleString() : '-'}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-[9px] font-semibold text-amber-800 mb-0.5">
                                            Your Offer <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <IndianRupee size="11" className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="number"
                                                min="1"
                                                className="w-full rounded-lg border border-gray-200 pl-7 pr-2 py-1.5 text-xs bg-white focus:border-orange-400 focus:ring-1 focus:ring-orange-100 outline-none"
                                                placeholder="Enter amount"
                                                value={form.expectedAmount}
                                                disabled={!form.fetchedAmount}
                                                onChange={(e) => updateField('expectedAmount', e.target.value)}
                                            />
                                        </div>
                                        {fetchedAmountNum > 0 && (
                                            <p className="text-[9px] text-amber-700 mt-1 flex items-center gap-0.5">
                                                <AlertCircle size="8" />
                                                Range: ₹{minAllowed.toLocaleString()} - ₹{maxAllowed.toLocaleString()}
                                            </p>
                                        )}
                                        {isExpectedOutOfRange && (
                                            <p className="text-[9px] text-red-600 mt-0.5 flex items-center gap-0.5">
                                                <AlertCircle size="8" /> Amount out of range!
                                            </p>
                                        )}
                                    </div>

                                    {pricingMeta && getPricingReasonMessage(pricingMeta) && (
                                        <div className="bg-amber-50 rounded-lg p-1.5 mt-2 border border-amber-200">
                                            <p className="text-[9px] text-amber-700 flex items-start gap-1">
                                                <AlertCircle size="8" className="flex-shrink-0 mt-0.5" />
                                                {getPricingReasonMessage(pricingMeta)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Submit Button - Compact */}
                        <motion.button
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={submitting || !worker || !selectedWorkerIsSmartphone || !form.fetchedAmount}
                            className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-2 text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 size="14" className="animate-spin" />
                                    Sending Request...
                                </>
                            ) : (
                                <>
                                    <Send size="14" />
                                    Send Direct Hire Request
                                </>
                            )}
                        </motion.button>
                    </form>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}