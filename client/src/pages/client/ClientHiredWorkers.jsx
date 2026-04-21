import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import * as api from '../../api';
import { getImageUrl } from '../../constants/config';
import { Briefcase, Calendar, Clock, IndianRupee, MapPin, Phone, Sparkles } from 'lucide-react';

export default function ClientHiredWorkers() {
    const [client, setClient] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [otpInputs, setOtpInputs] = useState({});

    const loadTickets = async () => {
        const refreshed = await api.getClientDirectHireTickets();
        setJobs(Array.isArray(refreshed?.data?.jobs) ? refreshed.data.jobs : []);
    };

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const [profileRes, jobsRes] = await Promise.all([
                    api.getClientProfile(),
                    api.getClientDirectHireTickets(),
                ]);
                const profile = profileRes?.data || null;
                setClient(profile);
                setJobs(Array.isArray(jobsRes?.data?.jobs) ? jobsRes.data.jobs : []);
            } catch (error) {
                toast.error(error?.response?.data?.message || 'Unable to load hired workers.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const sendStartOtp = async (jobId) => {
        try {
            await api.sendDirectHireStartOtp(jobId);
            toast.success('Start OTP sent to worker.');
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Unable to send start OTP.');
        }
    };

    const verifyStartOtp = async (jobId) => {
        const otp = String(otpInputs[jobId]?.startOtp || '').trim();
        if (!otp) return toast.error('Enter start OTP.');
        try {
            await api.verifyDirectHireStartOtp(jobId, { otp });
            toast.success('Job started.');
            await loadTickets();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Unable to verify start OTP.');
        }
    };

    const sendCompletionOtp = async (jobId) => {
        const paidAmount = Number(otpInputs[jobId]?.finalPaidAmount || 0);
        if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
            return toast.error('Enter a valid paid amount (> 0) before sending OTP.');
        }
        try {
            await api.sendDirectHireCompletionOtp(jobId, {
                finalPaidPrice: paidAmount,
                paymentMode: otpInputs[jobId]?.paymentMode || 'cash',
            });
            toast.success('Completion OTP sent to worker.');
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Unable to send completion OTP.');
        }
    };

    const verifyCompletionOtp = async (jobId) => {
        const otp = String(otpInputs[jobId]?.completionOtp || '').trim();
        if (!otp) return toast.error('Enter completion OTP.');
        try {
            await api.verifyDirectHireCompletionOtp(jobId, { otp });
            toast.success('Job completed and payment confirmed.');
            await loadTickets();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Unable to verify completion OTP.');
        }
    };

    const onPaymentField = (jobId, field, value) => {
        if (field === 'finalPaidAmount' && Number(value) < 0) return;
        setOtpInputs((prev) => ({
            ...prev,
            [jobId]: {
                ...(prev[jobId] || {}),
                [field]: value,
            },
        }));
    };

    const formatDateTime = (job) => {
        const date = job?.directHire?.expectedStartAt || job?.scheduledDate;
        if (!date) return 'Not scheduled';
        const dateText = new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const timeText = job?.scheduledTime || new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        return `${dateText} • ${timeText}`;
    };

    return (
        <div className="max-w-6xl mx-auto px-4 py-6 pb-24 space-y-6">
            <div className="bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 text-white rounded-3xl p-6 shadow-xl">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <div className="flex items-center gap-2 text-orange-100 text-sm font-semibold uppercase tracking-[0.2em]">
                            <Sparkles size={14} /> Direct Hire
                        </div>
                        <h1 className="text-3xl font-black mt-2">Hired Workers Queue</h1>
                        <p className="text-orange-50 mt-2 max-w-2xl">
                            View all direct hire invites with acceptance status, OTP flow, and payment details.
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="bg-white rounded-3xl border border-orange-100 shadow-sm p-5 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black text-gray-900">Direct Hire Queue</h2>
                        <p className="text-sm text-gray-500">Accepted/rejected status with complete invite details.</p>
                    </div>
                    <button
                        type="button"
                        onClick={async () => {
                            setLoading(true);
                            try {
                                await loadTickets();
                            } catch {
                                toast.error('Unable to refresh hires.');
                            } finally {
                                setLoading(false);
                            }
                        }}
                        className="px-4 py-2 rounded-xl border border-orange-200 text-orange-700 font-bold hover:bg-orange-50"
                    >
                        Refresh
                    </button>
                </div>

                {loading ? (
                    <div className="bg-white rounded-3xl border border-gray-100 p-6 text-gray-500">Loading direct hire queue...</div>
                ) : jobs.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-gray-100 p-6 text-gray-500">No direct hire jobs yet. Go to AI Advisor to hire workers directly.</div>
                ) : (
                    <div className="space-y-4">
                        {jobs.map((job) => {
                            const worker = job?.directHire?.workerId || {};
                            const dh = job?.directHire || {};
                            const status = String(job?.directHire?.requestStatus || 'requested');
                            const paymentStatus = String(job?.directHire?.paymentStatus || 'pending');
                            const startOtp = otpInputs[job._id]?.startOtp || '';
                            const completionOtp = otpInputs[job._id]?.completionOtp || '';
                            const canStartOtp = status === 'accepted';
                            const canCompletionOtp = status === 'accepted' && String(job.status || '') === 'running';
                            const defaultPaid = Number(job?.directHire?.expectedAmount || 0);
                            const durationValue = Math.max(1, Number(dh.durationValue || 1));
                            const durationUnit = String(dh.durationUnit || '/day');
                            const demandMultiplier = Number(dh.appliedDemandMultiplier || 1);
                            const detectedTotalBeforeMultiplier = Math.max(0, Number(dh.fetchedBaseAmount || dh.fetchedAmount || 0));
                            const detectedUnitCost = durationValue > 0
                                ? Math.round(detectedTotalBeforeMultiplier / durationValue)
                                : detectedTotalBeforeMultiplier;
                            const totalEstimatedCost = Math.max(
                                1,
                                Math.round(detectedUnitCost * durationValue * (Number.isFinite(demandMultiplier) && demandMultiplier > 0 ? demandMultiplier : 1))
                            );

                            return (
                                <div key={job._id} className="bg-white rounded-2xl border border-orange-100 shadow-sm p-4 space-y-3">
                                    <div className="flex items-start gap-3">
                                        <img
                                            src={getImageUrl(worker.photo)}
                                            alt={worker.name}
                                            className="w-12 h-12 rounded-xl object-cover border border-orange-100"
                                            onError={(e) => { e.currentTarget.src = '/admin.png'; }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                                <div>
                                                    <p className="font-black text-gray-900">{job.title}</p>
                                                    <p className="text-sm text-gray-500 truncate">{worker.name || 'Worker'}</p>
                                                </div>
                                                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${status === 'accepted' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                                    {status}
                                                </span>
                                            </div>
                                            {status === 'rejected' && job?.directHire?.requestRejectedReason && (
                                                <p className="text-xs text-red-600 mt-1">Reason: {job.directHire.requestRejectedReason}</p>
                                            )}
                                            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-1.5 text-sm text-gray-600">
                                                <div className="flex items-center gap-2"><Calendar size={14} className="text-orange-500" /> {formatDateTime(job)}</div>
                                                <div className="flex items-center gap-2"><Clock size={14} className="text-orange-500" /> {durationValue} {durationUnit}</div>
                                                <div className="flex items-center gap-2"><IndianRupee size={14} className="text-orange-500" /> Detected: ₹{detectedUnitCost.toLocaleString('en-IN')}{durationUnit}</div>
                                                <div className="flex items-center gap-2"><IndianRupee size={14} className="text-orange-500" /> Total est.: ₹{totalEstimatedCost.toLocaleString('en-IN')}</div>
                                                <div className="flex items-center gap-2"><MapPin size={14} className="text-orange-500" /> {job?.location?.fullAddress || job?.location?.city || 'Location not set'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <a href={worker.mobile ? `tel:${worker.mobile}` : undefined} className="inline-flex items-center justify-center gap-2 rounded-xl border border-green-200 text-green-700 font-bold py-2">
                                            <Phone size={14} /> Call Worker
                                        </a>
                                        <button
                                            type="button"
                                            onClick={() => api.logDirectHireCallIntent(job._id).catch(() => {})}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 text-gray-700 font-bold py-2"
                                        >
                                            <Briefcase size={14} /> Log Call Intent
                                        </button>
                                    </div>

                                    {canStartOtp && (
                                        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                                            <p className="text-sm font-black text-gray-800">Start Job OTP</p>
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <button type="button" onClick={() => sendStartOtp(job._id)} className="px-4 py-2 rounded-xl bg-orange-600 text-white font-bold">Send OTP</button>
                                                <input className="flex-1 rounded-xl border border-gray-200 px-3 py-2" placeholder="Enter start OTP" value={startOtp} onChange={(e) => onPaymentField(job._id, 'startOtp', e.target.value)} />
                                                <button type="button" onClick={() => verifyStartOtp(job._id)} className="px-4 py-2 rounded-xl bg-gray-900 text-white font-bold">Verify</button>
                                            </div>
                                        </div>
                                    )}

                                    {canCompletionOtp && (
                                        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                                            <p className="text-sm font-black text-gray-800">Pay Worker + Complete OTP</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    className="rounded-xl border border-gray-200 px-3 py-2"
                                                    placeholder="Final paid amount"
                                                    value={otpInputs[job._id]?.finalPaidAmount ?? defaultPaid}
                                                    onChange={(e) => onPaymentField(job._id, 'finalPaidAmount', e.target.value)}
                                                />
                                                <select
                                                    className="rounded-xl border border-gray-200 px-3 py-2"
                                                    value={otpInputs[job._id]?.paymentMode || job?.directHire?.paymentMode || 'cash'}
                                                    onChange={(e) => onPaymentField(job._id, 'paymentMode', e.target.value)}
                                                >
                                                    <option value="cash">Cash</option>
                                                    <option value="upi">UPI</option>
                                                    <option value="bank_transfer">Bank Transfer</option>
                                                    <option value="online">Online</option>
                                                </select>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <button type="button" onClick={() => sendCompletionOtp(job._id)} className="px-4 py-2 rounded-xl bg-amber-500 text-white font-bold">Send OTP</button>
                                                <input className="flex-1 rounded-xl border border-gray-200 px-3 py-2" placeholder="Enter completion OTP" value={completionOtp} onChange={(e) => onPaymentField(job._id, 'completionOtp', e.target.value)} />
                                                <button type="button" onClick={() => verifyCompletionOtp(job._id)} className="px-4 py-2 rounded-xl bg-gray-900 text-white font-bold">Verify</button>
                                            </div>
                                            <p className="text-xs text-gray-500">Payment status: {paymentStatus}</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
