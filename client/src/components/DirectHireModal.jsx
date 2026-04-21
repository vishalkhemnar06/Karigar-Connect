import { useState, useMemo, useEffect } from 'react';
import toast from 'react-hot-toast';
import * as api from '../api';
import { getImageUrl } from '../constants/config';
import { Briefcase, Send, ShieldCheck, X } from 'lucide-react';

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

const getPricingReasonMessage = (pricingMeta) => {
    if (!pricingMeta) return '';
    const multipliers = pricingMeta.multipliers || {};
    const dayType = multipliers.dayType || 'weekday';
    console.log('getPricingReasonMessage called with:', { dayType, multipliers });
    
    let reasons = [];
    
    // Check festival first
    if (multipliers.festivalName && multipliers.festivalName.toLowerCase() !== 'none') {
        reasons.push(`${multipliers.festivalName}`);
    }
    
    // Check holiday
    if (dayType === 'holiday') {
        reasons.push('Indian Public Holiday');
    }
    
    // Check weekend
    if (dayType === 'weekend') {
        reasons.push('Weekend');
    }
    
    // Check if there's any multiplier applied beyond base (even if we can't identify the specific reason)
    const multiplier = Number(multipliers.finalMultiplier || 1);
    if (multiplier > 1.01 && reasons.length === 0) {
        reasons.push('High demand');
    }
    
    const reasonText = reasons.join(', ');
    console.log('Determined reasons:', reasonText);
    
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

    const selectedWorkerIsSmartphone = useMemo(() => isSmartphoneWorker(worker), [worker]);
    const fallbackWorkerSkills = useMemo(() => extractSkillNames(worker?.skills), [worker]);
    const skillOptions = workerSkills.length ? workerSkills : fallbackWorkerSkills;
    const fetchedAmountNum = Number(form.fetchedAmount || 0);
    const expectedAmountNum = Number(form.expectedAmount || 0);
    const minAllowed = fetchedAmountNum > 0 ? Math.max(1, Math.round(fetchedAmountNum * 0.8)) : 0;
    const maxAllowed = fetchedAmountNum > 0 ? Math.max(minAllowed, Math.round(fetchedAmountNum * 1.3)) : 0;
    const isExpectedOutOfRange = fetchedAmountNum > 0 && expectedAmountNum > 0 && (expectedAmountNum < minAllowed || expectedAmountNum > maxAllowed);

    useEffect(() => {
        if (isOpen && worker && client) {
            setForm(prefillForm(worker, client));
            setPricingMeta(null);
            setWorkerSkills([]);
        }
    }, [isOpen, worker, client]);

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
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const updateLocationField = (key, value) => {
        setForm((prev) => ({
            ...prev,
            location: {
                ...prev.location,
                [key]: value,
            },
        }));
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
            console.log('Pricing data received:', pricing);
            setPricingMeta({
                ...pricing,
                unitRate: pricing.baseAmount,
                totalEstimate: pricing.suggestedAmount,
            });
            setForm((prev) => ({
                ...prev,
                fetchedAmount: String(pricing.suggestedAmount),
                expectedAmount: String(pricing.suggestedAmount),
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
            toast.success('Direct hire request sent.');
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 overflow-auto">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full my-4">
                <form onSubmit={submitDirectHire} className="space-y-3 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-orange-700 font-black text-lg">
                            <Briefcase size={20} /> Create Direct Hire
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1 hover:bg-gray-100 rounded-full"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {worker ? (
                        <div className="rounded-2xl border border-orange-100 bg-orange-50 p-3">
                            <div className="flex items-center gap-3">
                                <img
                                    src={getImageUrl(worker.photo)}
                                    alt={worker.name}
                                    className="w-12 h-12 rounded-xl object-cover border border-orange-200"
                                    onError={(e) => { e.currentTarget.src = '/admin.png'; }}
                                />
                                <div className="min-w-0">
                                    <p className="font-black text-gray-900 truncate">{worker.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{worker.karigarId || worker._id}</p>
                                    <div className={`mt-1 inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${selectedWorkerIsSmartphone ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'}`}>
                                        <ShieldCheck size={12} /> {selectedWorkerIsSmartphone ? 'Smartphone worker' : 'Non-smartphone worker'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <select
                            className="w-full rounded-xl border border-gray-200 px-3 py-2"
                            value={form.skill}
                            onChange={(e) => updateField('skill', e.target.value)}
                            disabled={loadingWorkerSkills || skillOptions.length === 0}
                        >
                            <option value="">
                                {loadingWorkerSkills ? 'Loading skills...' : 'Select worker skill'}
                            </option>
                            {skillOptions.map((skill) => (
                                <option key={skill} value={skill}>{skill}</option>
                            ))}
                        </select>
                        <select className="w-full rounded-xl border border-gray-200 px-3 py-2" value={form.durationUnit} onChange={(e) => updateField('durationUnit', e.target.value)}>
                            <option value="/day">Per Day</option>
                            <option value="/hour">Per Hour</option>
                            <option value="/visit">Per Visit</option>
                        </select>
                        <input type="number" min="1" className="w-full rounded-xl border border-gray-200 px-3 py-2" placeholder="Duration" value={form.durationValue} onChange={(e) => updateField('durationValue', e.target.value)} />
                        <input type="date" className="w-full rounded-xl border border-gray-200 px-3 py-2" value={form.scheduledDate} onChange={(e) => updateField('scheduledDate', e.target.value)} />
                        <input type="time" className="w-full rounded-xl border border-gray-200 px-3 py-2" value={form.scheduledTime} onChange={(e) => updateField('scheduledTime', e.target.value)} />
                        <input className="w-full rounded-xl border border-gray-200 px-3 py-2" placeholder="City" value={form.location.city} onChange={(e) => updateLocationField('city', e.target.value)} />
                    </div>
                    {isOpen && !loadingWorkerSkills && skillOptions.length === 0 && (
                        <p className="text-xs text-red-600">No registered skills found for this worker profile.</p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input className="w-full rounded-xl border border-gray-200 px-3 py-2" placeholder="Locality" value={form.location.locality} onChange={(e) => updateLocationField('locality', e.target.value)} />
                        <input className="w-full rounded-xl border border-gray-200 px-3 py-2" placeholder="State" value={form.location.state} onChange={(e) => updateLocationField('state', e.target.value)} />
                        <input className="w-full rounded-xl border border-gray-200 px-3 py-2" placeholder="Pincode" value={form.location.pincode} onChange={(e) => updateLocationField('pincode', e.target.value)} />
                        <select className="w-full rounded-xl border border-gray-200 px-3 py-2" value={form.paymentMode} onChange={(e) => updateField('paymentMode', e.target.value)}>
                            <option value="cash">Cash</option>
                            <option value="upi">UPI</option>
                            <option value="bank_transfer">Bank Transfer</option>
                            <option value="online">Online</option>
                        </select>
                        <input className="w-full rounded-xl border border-gray-200 px-3 py-2 sm:col-span-2" placeholder="Full address" value={form.location.fullAddress} onChange={(e) => updateLocationField('fullAddress', e.target.value)} />
                    </div>

                    <input className="w-full rounded-xl border border-gray-200 px-3 py-2" placeholder="JD in one line" value={form.oneLineJD} onChange={(e) => updateField('oneLineJD', e.target.value)} />

                    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 space-y-3">
                        <button
                            type="button"
                            onClick={fetchSuggestedAmount}
                            disabled={fetchingAmount || !selectedWorkerIsSmartphone}
                            className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black py-2 disabled:opacity-60"
                        >
                            {fetchingAmount ? 'Fetching Amount...' : 'Get Amount'}
                        </button>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="rounded-xl border border-gray-200 bg-gray-100 px-3 py-2">
                                <div className="text-xs text-gray-600">Unit Rate</div>
                                <div className="text-sm font-semibold text-gray-800">
                                    ₹{pricingMeta?.unitRate ? Number(pricingMeta.unitRate).toLocaleString('en-IN') : '-'}{form.durationUnit}
                                </div>
                            </div>
                            <div className="rounded-xl border border-gray-200 bg-gray-100 px-3 py-2">
                                <div className="text-xs text-gray-600">Total Estimated</div>
                                <div className="text-sm font-semibold text-gray-800">
                                    ₹{pricingMeta?.totalEstimate ? Number(pricingMeta.totalEstimate).toLocaleString('en-IN') : '-'}
                                </div>
                            </div>
                        </div>

                        <input
                            type="number"
                            min="1"
                            className="rounded-xl border border-gray-200 px-3 py-2 bg-gray-50"
                            placeholder="Enter your amount"
                            value={form.expectedAmount}
                            disabled={!form.fetchedAmount}
                            onChange={(e) => updateField('expectedAmount', e.target.value)}
                        />
                        {fetchedAmountNum > 0 && (
                            <p className="text-xs text-amber-700 font-semibold">
                                Allowed edit range: ₹{minAllowed.toLocaleString('en-IN')} to ₹{maxAllowed.toLocaleString('en-IN')} (−20% / +30%).
                            </p>
                        )}
                        {isExpectedOutOfRange && (
                            <p className="text-xs text-red-600 font-semibold">
                                Warning: amount is outside allowed range.
                            </p>
                        )}
                        {pricingMeta && getPricingReasonMessage(pricingMeta) && (
                            <p className="text-xs text-amber-700 font-semibold bg-amber-100 rounded-lg px-2 py-2">
                                {getPricingReasonMessage(pricingMeta)}
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={submitting || !worker || !selectedWorkerIsSmartphone || !form.fetchedAmount}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 text-white font-black py-3 disabled:opacity-50"
                    >
                        <Send size={16} /> {submitting ? 'Sending...' : 'Send Direct Hire'}
                    </button>
                </form>
            </div>
        </div>
    );
}
