import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import * as api from '../../api';
import { getImageUrl } from '../../constants/config';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Briefcase, Calendar, Clock, IndianRupee, MapPin, Phone, 
    RefreshCw, Sparkles, User, CheckCircle, XCircle, AlertCircle,
    Clock3, DollarSign, Percent, Zap, Shield, Truck, 
    Wallet, CreditCard, Send, Eye, MessageCircle, Star,
    Award, TrendingUp, Crown, Diamond, Gift, Heart, ThumbsUp
} from 'lucide-react';

const OTP_TTL_MS = 5 * 60 * 1000;

const formatCountdown = (secondsLeft) => {
    const safe = Math.max(0, Number(secondsLeft) || 0);
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const getStatusBadge = (status) => {
    switch (status) {
        case 'accepted':
            return { label: 'Accepted', icon: CheckCircle, color: 'emerald', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' };
        case 'rejected':
            return { label: 'Rejected', icon: XCircle, color: 'red', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' };
        default:
            return { label: 'Requested', icon: Clock, color: 'amber', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' };
    }
};

export default function ClientHiredWorkers() {
    const [client, setClient] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [otpInputs, setOtpInputs] = useState({});
    const [callIntentJobId, setCallIntentJobId] = useState(null);
    const [nowMs, setNowMs] = useState(Date.now());

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

    useEffect(() => {
        const timer = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const sendStartOtp = async (jobId) => {
        try {
            const res = await api.sendDirectHireStartOtp(jobId);
            const expiryMs = res?.data?.otpExpiresAt ? new Date(res.data.otpExpiresAt).getTime() : (Date.now() + OTP_TTL_MS);
            onPaymentField(jobId, 'startOtpExpiryMs', expiryMs);
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
            onPaymentField(jobId, 'startOtpExpiryMs', 0);
            onPaymentField(jobId, 'startOtp', '');
            toast.success('Job started.');
            await loadTickets();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Unable to verify start OTP.');
        }
    };

    const sendCompletionOtp = async (jobId) => {
        try {
            const res = await api.sendDirectHireCompletionOtp(jobId);
            const expiryMs = res?.data?.otpExpiresAt ? new Date(res.data.otpExpiresAt).getTime() : (Date.now() + OTP_TTL_MS);
            onPaymentField(jobId, 'completionOtpExpiryMs', expiryMs);
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
            onPaymentField(jobId, 'completionOtpExpiryMs', 0);
            onPaymentField(jobId, 'completionOtp', '');
            toast.success('Job completed and payment confirmed.');
            await loadTickets();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Unable to verify completion OTP.');
        }
    };

    const handleLogCallIntent = async (jobId) => {
        try {
            setCallIntentJobId(jobId);
            await api.logDirectHireCallIntent(jobId);
            toast.success('Call intent logged.');
            await loadTickets();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Unable to log call intent.');
        } finally {
            setCallIntentJobId(null);
        }
    };

    const onPaymentField = (jobId, field, value) => {
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

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await loadTickets();
        } catch {
            toast.error('Unable to refresh hires.');
        } finally {
            setRefreshing(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 pb-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-8">
                
                {/* Hero Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-xl">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                    <Users size="24" className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black">Hired Workers</h1>
                                    <p className="text-white/90 text-sm mt-0.5">Track direct hire workers and manage OTP flow</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="bg-white/15 rounded-xl px-3 py-1.5 text-center">
                                    <p className="text-xl font-bold">{jobs.length}</p>
                                    <p className="text-[10px] text-white/80">Active Hires</p>
                                </div>
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleRefresh}
                                    disabled={refreshing}
                                    className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-xl text-sm font-semibold hover:bg-white/30 transition-all"
                                >
                                    <RefreshCw size="14" className={refreshing ? 'animate-spin' : ''} />
                                    Refresh
                                </motion.button>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Header Card */}
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 mb-6">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">Direct Hire Queue</h2>
                            <p className="text-sm text-gray-500 mt-0.5">Accepted/rejected status with complete invite details</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>Accepted</span>
                            <div className="w-2 h-2 rounded-full bg-amber-500 ml-2" />
                            <span>Requested</span>
                            <div className="w-2 h-2 rounded-full bg-red-500 ml-2" />
                            <span>Rejected</span>
                        </div>
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <Loader2 size="48" className="animate-spin text-orange-500 mx-auto mb-4" />
                            <p className="text-gray-500 font-medium">Loading hired workers...</p>
                        </div>
                    </div>
                ) : jobs.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center"
                    >
                        <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Users size="36" className="text-orange-400" />
                        </div>
                        <h3 className="font-bold text-gray-800 text-xl mb-2">No Direct Hires Yet</h3>
                        <p className="text-gray-400 text-sm max-w-md mx-auto">
                            Go to AI Advisor to hire workers directly. Accepted hires will appear here.
                        </p>
                    </motion.div>
                ) : (
                    <div className="space-y-5">
                        {jobs.map((job, idx) => {
                            const worker = job?.directHire?.workerId || {};
                            const dh = job?.directHire || {};
                            const status = String(job?.directHire?.requestStatus || 'requested');
                            const statusBadge = getStatusBadge(status);
                            const StatusIcon = statusBadge.icon;
                            const paymentStatus = String(job?.directHire?.paymentStatus || 'pending');
                            const isPaid = paymentStatus === 'paid';
                            const startOtp = otpInputs[job._id]?.startOtp || '';
                            const completionOtp = otpInputs[job._id]?.completionOtp || '';
                            const jobStatus = String(job.status || '').toLowerCase();
                            const isStarted = ['running', 'completed'].includes(jobStatus);
                            const isCompleted = jobStatus === 'completed';
                            const scheduledStartMs = (() => {
                                const directStart = job?.directHire?.expectedStartAt;
                                if (directStart) {
                                    const parsed = new Date(directStart).getTime();
                                    return Number.isFinite(parsed) ? parsed : 0;
                                }
                                if (job?.scheduledDate) {
                                    const base = new Date(job.scheduledDate);
                                    const [hh, mm] = String(job?.scheduledTime || '09:00').split(':').map(Number);
                                    base.setHours(Number.isFinite(hh) ? hh : 9, Number.isFinite(mm) ? mm : 0, 0, 0);
                                    const parsed = base.getTime();
                                    return Number.isFinite(parsed) ? parsed : 0;
                                }
                                return 0;
                            })();
                            const hasReachedStartTime = scheduledStartMs > 0 ? nowMs >= scheduledStartMs : false;
                            const showPaymentState = isPaid || isStarted || hasReachedStartTime;
                            const showPayReminder = status === 'accepted' && paymentStatus !== 'paid' && (isStarted || hasReachedStartTime);
                            const canStartOtp = status === 'accepted' && !isStarted;
                            const canCompletionOtp = status === 'accepted' && jobStatus === 'running' && isPaid;
                            const startExpiryMs = Number(otpInputs[job._id]?.startOtpExpiryMs || 0);
                            const completionExpiryMs = Number(otpInputs[job._id]?.completionOtpExpiryMs || 0);
                            const startSecondsLeft = startExpiryMs > nowMs ? Math.floor((startExpiryMs - nowMs) / 1000) : 0;
                            const completionSecondsLeft = completionExpiryMs > nowMs ? Math.floor((completionExpiryMs - nowMs) / 1000) : 0;
                            const canResendStart = startSecondsLeft <= 0;
                            const canResendCompletion = completionSecondsLeft <= 0;
                            const durationValue = Math.max(1, Number(dh.durationValue || 1));
                            const durationUnit = String(dh.durationUnit || '/day');
                            const demandMultiplier = Number(dh.appliedDemandMultiplier || 1);
                            const detectedTotalBeforeMultiplier = Math.max(0, Number(dh.fetchedBaseAmount || dh.fetchedAmount || 0));
                            const detectedUnitCost = durationValue > 0 ? Math.round(detectedTotalBeforeMultiplier / durationValue) : detectedTotalBeforeMultiplier;
                            const totalEstimatedCost = Math.max(1, Math.round(detectedUnitCost * durationValue * (Number.isFinite(demandMultiplier) && demandMultiplier > 0 ? demandMultiplier : 1)));

                            return (
                                <motion.div
                                    key={job._id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    whileHover={{ y: -2 }}
                                    className="bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-xl transition-all overflow-hidden"
                                >
                                    {/* Header */}
                                    <div className="p-5">
                                        <div className="flex items-start gap-4">
                                            <img
                                                src={getImageUrl(worker.photo)}
                                                alt={worker.name}
                                                className="w-14 h-14 rounded-xl object-cover border-2 border-orange-200 shadow-sm"
                                                onError={(e) => { e.currentTarget.src = '/admin.png'; }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                                    <div>
                                                        <h3 className="font-bold text-gray-800 text-base">{job.title}</h3>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <User size="12" className="text-gray-400" />
                                                            <p className="text-sm text-gray-500 truncate">{worker.name || 'Worker'}</p>
                                                        </div>
                                                    </div>
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}>
                                                        <StatusIcon size="10" /> {statusBadge.label}
                                                    </span>
                                                </div>
                                                
                                                {status === 'rejected' && job?.directHire?.requestRejectedReason && (
                                                    <div className="mt-2 p-2 bg-red-50 rounded-lg border border-red-100">
                                                        <p className="text-xs text-red-600">
                                                            <span className="font-semibold">Reason:</span> {job.directHire.requestRejectedReason}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Details Grid */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-3 text-sm">
                                                    <div className="flex items-center gap-1.5 text-gray-600">
                                                        <Calendar size="12" className="text-orange-400" />
                                                        <span>{formatDateTime(job)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-gray-600">
                                                        <Clock size="12" className="text-orange-400" />
                                                        <span>{durationValue} {durationUnit}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-gray-600">
                                                        <IndianRupee size="12" className="text-orange-400" />
                                                        <span>Rate: ₹{detectedUnitCost.toLocaleString('en-IN')}{durationUnit}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-gray-600">
                                                        <IndianRupee size="12" className="text-orange-400" />
                                                        <span>Total: ₹{totalEstimatedCost.toLocaleString('en-IN')}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-gray-600 col-span-1 sm:col-span-2">
                                                        <MapPin size="12" className="text-orange-400" />
                                                        <span className="truncate">{job?.location?.fullAddress || job?.location?.city || 'Location not set'}</span>
                                                    </div>
                                                    {showPaymentState && (
                                                        <div className="flex items-center gap-1.5 text-gray-600">
                                                            <Wallet size="12" className="text-orange-400" />
                                                            <span>Payment: <span className={`font-semibold ${isPaid ? 'text-emerald-600' : 'text-amber-600'}`}>{paymentStatus}</span></span>
                                                            {isPaid && <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Paid</span>}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Payment Reminder */}
                                                {showPayReminder && (
                                                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                                                        <p className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                                                            <AlertCircle size="12" /> Please pay the worker from the Job Manage section.
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Completion Status */}
                                                {isCompleted && (
                                                    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                                                        <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                                                            <CheckCircle size="12" /> Job completed successfully.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <a
                                            href={worker.mobile ? `tel:${worker.mobile}` : undefined}
                                            className="flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50 text-green-700 py-2.5 text-sm font-bold hover:bg-green-100 transition-all"
                                        >
                                            <Phone size="14" /> Call Worker
                                        </a>
                                        <button
                                            onClick={() => handleLogCallIntent(job._id)}
                                            disabled={callIntentJobId === job._id}
                                            className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 py-2.5 text-sm font-bold hover:bg-gray-100 transition-all disabled:opacity-60"
                                        >
                                            <Briefcase size="14" /> {callIntentJobId === job._id ? 'Logging...' : 'Log Call Intent'}
                                        </button>
                                    </div>

                                    {/* Start OTP Section */}
                                    {canStartOtp && (
                                        <div className="mx-5 mb-5 rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center">
                                                    <Zap size="12" className="text-orange-600" />
                                                </div>
                                                <p className="text-sm font-bold text-gray-800">Start Job OTP</p>
                                            </div>
                                            <p className="text-xs text-gray-600">Start the job with OTP. Payment can be completed later from Job Manage.</p>
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <button
                                                    onClick={() => sendStartOtp(job._id)}
                                                    disabled={!canResendStart}
                                                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-sm disabled:opacity-50 hover:shadow-md transition-all"
                                                >
                                                    {startExpiryMs > 0 ? (canResendStart ? 'Send Again' : `Send Again ${formatCountdown(startSecondsLeft)}`) : 'Send OTP'}
                                                </button>
                                                <input 
                                                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" 
                                                    placeholder="Enter start OTP" 
                                                    value={startOtp} 
                                                    onChange={(e) => onPaymentField(job._id, 'startOtp', e.target.value)} 
                                                />
                                                <button
                                                    onClick={() => verifyStartOtp(job._id)}
                                                    className="px-4 py-2 rounded-lg bg-gray-800 text-white font-bold text-sm hover:bg-gray-900 transition-all"
                                                >
                                                    Verify
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Payment Required Notice */}
                                    {status === 'accepted' && jobStatus === 'running' && !isPaid && (
                                        <div className="mx-5 mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
                                            <div className="flex items-center gap-2">
                                                <AlertCircle size="14" className="text-amber-600" />
                                                <p className="text-sm font-bold text-amber-800">Payment Required</p>
                                            </div>
                                            <p className="text-xs text-amber-700 mt-1">Complete payment first. Completion OTP will appear after payment is marked paid.</p>
                                        </div>
                                    )}

                                    {/* Completion OTP Section */}
                                    {canCompletionOtp && (
                                        <div className="mx-5 mb-5 rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                                                    <CheckCircle size="12" className="text-emerald-600" />
                                                </div>
                                                <p className="text-sm font-bold text-gray-800">Complete Job OTP</p>
                                            </div>
                                            <p className="text-xs text-gray-600">Payment is done. Generate OTP and verify to mark this job completed.</p>
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <button
                                                    onClick={() => sendCompletionOtp(job._id)}
                                                    disabled={!canResendCompletion}
                                                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm disabled:opacity-50 hover:shadow-md transition-all"
                                                >
                                                    {completionExpiryMs > 0 ? (canResendCompletion ? 'Send Again' : `Send Again ${formatCountdown(completionSecondsLeft)}`) : 'Send OTP'}
                                                </button>
                                                <input 
                                                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" 
                                                    placeholder="Enter completion OTP" 
                                                    value={completionOtp} 
                                                    onChange={(e) => onPaymentField(job._id, 'completionOtp', e.target.value)} 
                                                />
                                                <button
                                                    onClick={() => verifyCompletionOtp(job._id)}
                                                    className="px-4 py-2 rounded-lg bg-gray-800 text-white font-bold text-sm hover:bg-gray-900 transition-all"
                                                >
                                                    Verify
                                                </button>
                                            </div>
                                            <p className="text-xs text-gray-500">Payment status: <span className={`font-semibold ${isPaid ? 'text-emerald-600' : 'text-amber-600'}`}>{paymentStatus}</span></p>
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

const Loader2 = ({ size, className }) => (
    <svg className={`animate-spin ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);

const Users = ({ size, className }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);