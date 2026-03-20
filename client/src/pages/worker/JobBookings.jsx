// client/src/pages/worker/JobBookings.jsx
// CANCEL CHANGES:
//  - Cancel button ONLY shown when job.status === 'scheduled'
//  - Cancel button HIDDEN when job is 'running' (no grace window)
//  - Cancel button HIDDEN when < 30 min before scheduled start
//  - Shows time remaining until cancel is no longer allowed

import { useState, useEffect } from 'react';
import { getWorkerBookings, workerCancelJob, getImageUrl } from '../../api/index';
import toast from 'react-hot-toast';

// ── Helpers ───────────────────────────────────────────────────────────────────
const CANCEL_CUTOFF_MINS = 30;

const getCancelInfo = (job) => {
    // Running = never show cancel
    if (job.status === 'running') return { show: false, allowed: false, reason: 'running' };
    // Only scheduled
    if (job.status !== 'scheduled') return { show: false, allowed: false, reason: 'wrong_status' };
    // No time set = allow freely
    if (!job.scheduledDate || !job.scheduledTime) return { show: true, allowed: true };

    const [h, m]  = job.scheduledTime.split(':').map(Number);
    const sched   = new Date(job.scheduledDate);
    sched.setHours(h, m, 0, 0);
    const minsLeft = (sched.getTime() - Date.now()) / 60000;

    if (minsLeft <= 0) {
        // Job should have started already (auto-start handles this)
        return { show: false, allowed: false, reason: 'past_start' };
    }
    if (minsLeft <= CANCEL_CUTOFF_MINS) {
        // Within 30 min cutoff — show disabled with time info
        return {
            show: true,
            allowed: false,
            minsLeft: Math.max(0, Math.floor(minsLeft)),
            reason: 'too_close',
        };
    }
    return { show: true, allowed: true, minsLeft: Math.floor(minsLeft) };
};

const STATUS_COLORS = {
    open:               'bg-green-100 text-green-700',
    scheduled:          'bg-blue-100 text-blue-700',
    running:            'bg-yellow-100 text-yellow-800',
    completed:          'bg-emerald-100 text-emerald-700',
    cancelled_by_client:'bg-red-100 text-red-600',
    cancelled:          'bg-red-100 text-red-600',
};
const STATUS_LABELS = {
    open: 'Open', scheduled: 'Scheduled', running: 'Running',
    completed: 'Completed', cancelled_by_client: 'Cancelled', cancelled: 'Cancelled',
};

function SBadge({ s }) {
    return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_COLORS[s] || 'bg-gray-100 text-gray-500'}`}>{STATUS_LABELS[s] || s}</span>;
}

// ── Cancel Confirm Modal ──────────────────────────────────────────────────────
function CancelModal({ job, mySlot, onClose, onCancelled }) {
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');

    const handle = async () => {
        if (!reason.trim()) { setErr('Please provide a reason.'); return; }
        try {
            setLoading(true);
            await workerCancelJob(job._id, reason);
            toast.success('Assignment cancelled. 30 penalty points deducted.');
            onCancelled(job._id);
            onClose();
        } catch (e) {
            setErr(e?.response?.data?.message || 'Failed to cancel.');
        } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
            <div className="bg-white w-full sm:rounded-2xl sm:max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Cancel Assignment</h3>
                <p className="text-sm text-gray-500 mb-2">"{job.title}"</p>
                {mySlot && <p className="text-xs text-gray-400 mb-4 capitalize">Your role: <strong>{mySlot.skill}</strong></p>}

                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700">
                    ⚠️ Cancelling will deduct <strong>30 points</strong> from your account and re-open the slot for other workers.
                </div>

                {err && <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700 flex items-start justify-between"><p>{err}</p><button onClick={() => setErr('')} className="ml-2 font-bold">×</button></div>}

                <label className="block text-sm font-semibold text-gray-700 mb-2">Reason <span className="text-red-500">*</span></label>
                <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for cancellation…" className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-red-300 resize-none mb-5" />
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50">Keep Job</button>
                    <button onClick={handle} disabled={loading || !reason.trim()} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold disabled:opacity-60">
                        {loading ? 'Cancelling…' : 'Confirm Cancel'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function JobBookings() {
    const [jobs,        setJobs]       = useState([]);
    const [loading,     setLoading]    = useState(true);
    const [cancelData,  setCancelData] = useState(null); // { job, mySlot }
    const [expanded,    setExpanded]   = useState(null);
    const [activeSection, setActiveSection] = useState('open');

    // Live countdown refresh every 30s
    const [now, setNow] = useState(Date.now());
    useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

    const workerData = JSON.parse(localStorage.getItem('user') || '{}');
    const workerId = workerData._id;
    const workerSkills = (workerData.skills || [])
        .map(s => (typeof s === 'string' ? s : s?.name || ''))
        .map(s => s.toLowerCase().trim())
        .filter(Boolean);

    const loadBookings = async () => {
        try {
            const { data } = await getWorkerBookings();
            setJobs(Array.isArray(data) ? data : []);
        } catch {
            toast.error('Failed to load bookings.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBookings();
    }, []);

    const getBookingSection = (job) => {
        const mySlots = (job.mySlots || job.workerSlots || []).filter(s => {
            const sid = (s.assignedWorker?._id || s.assignedWorker)?.toString();
            return sid === workerId;
        });
        const myApps = (job.applicants || []).filter(a => (a.workerId?._id || a.workerId)?.toString() === workerId);
        const isAssignedToMe = mySlots.length > 0 || (job.assignedTo || []).some(id => (id?._id || id)?.toString() === workerId);

        if (job.status === 'cancelled_by_client' && isAssignedToMe) return 'cancelled';
        if (job.status === 'cancelled') return 'cancelled';
        if (job.status === 'completed' || (mySlots.length > 0 && mySlots.every(s => s.status === 'task_completed'))) return 'completed';
        if (job.status === 'running' || mySlots.some(s => ['filled', 'running'].includes(s.status))) return 'in_progress';
        if (job.status === 'scheduled' && mySlots.length > 0) return 'in_progress';
        if (job.status === 'scheduled' && myApps.some(a => a.status === 'pending')) return 'open';
        if (job.status === 'open' && myApps.some(a => a.status === 'pending')) return 'open';
        if (job.status === 'open') return 'open';
        return 'others';
    };

    const groupedJobs = jobs.reduce((acc, job) => {
        const section = getBookingSection(job);
        acc[section].push(job);
        return acc;
    }, {
        open: [],
        in_progress: [],
        completed: [],
        cancelled: [],
        others: [],
    }, []);

    const sectionMeta = [
        { key: 'open', title: 'Open', empty: 'No open jobs right now.' },
        { key: 'in_progress', title: 'In Progress', empty: 'No in-progress jobs right now.' },
        { key: 'completed', title: 'Completed', empty: 'No completed jobs yet.' },
        { key: 'cancelled', title: 'Cancelled', empty: 'No cancelled jobs.' },
        { key: 'others', title: 'Other Status', empty: 'No jobs in other statuses.' },
    ];

    const getJobSkillSet = (job) => {
        const fromSkills = Array.isArray(job.skills) ? job.skills : [];
        const fromSlots = (job.workerSlots || []).map(s => s.skill).filter(Boolean);
        const all = [...fromSkills, ...fromSlots, job.subTaskSkill].filter(Boolean);
        return [...new Set(all.map(s => String(s).toLowerCase().trim()))];
    };

    const isRelevantToWorkerSkill = (job) => {
        if (!workerSkills.length) return true;
        const myApps = (job.applicants || []).filter(a => (a.workerId?._id || a.workerId)?.toString() === workerId);
        if (myApps.length) return true;
        const skills = getJobSkillSet(job);
        return skills.some(sk => workerSkills.includes(sk));
    };

    useEffect(() => {
        const hasActive = (groupedJobs[activeSection] || []).length > 0;
        if (hasActive) return;
        const firstNonEmpty = sectionMeta.find(s => (groupedJobs[s.key] || []).length > 0);
        if (firstNonEmpty && firstNonEmpty.key !== activeSection) {
            setActiveSection(firstNonEmpty.key);
        }
    }, [jobs]);

    const handleCancelled = async () => {
        await loadBookings();
    };

    if (loading) return <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <div className="max-w-3xl mx-auto p-4 space-y-4 pb-20">
            <h1 className="text-2xl font-black text-gray-900">My Job Bookings</h1>

            {jobs.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                    <div className="text-5xl mb-3">📋</div>
                    <p className="font-bold text-base">No bookings yet</p>
                    <p className="text-sm mt-1 text-gray-300">Apply for available jobs to see them here</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="overflow-x-auto no-scrollbar">
                        <div className="flex items-center gap-2 min-w-max pb-1">
                            {sectionMeta.map(section => {
                                const count = (groupedJobs[section.key] || []).length;
                                const active = activeSection === section.key;
                                return (
                                    <button
                                        key={section.key}
                                        type="button"
                                        onClick={() => { setExpanded(null); setActiveSection(section.key); }}
                                        className={`px-3 py-2 rounded-xl text-sm font-bold border transition-colors whitespace-nowrap ${
                                            active
                                                ? 'bg-orange-500 text-white border-orange-500'
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-600'
                                        }`}
                                    >
                                        {section.title}
                                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {(() => {
                        const section = sectionMeta.find(s => s.key === activeSection) || sectionMeta[0];
                        const rawList = groupedJobs[section.key] || [];
                        const list = section.key === 'open'
                            ? rawList.filter(isRelevantToWorkerSkill)
                            : rawList;
                        if (list.length === 0) {
                            return (
                                <div className="text-sm text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                                    {section.key === 'open' ? 'No open posts match your skills right now.' : section.empty}
                                </div>
                            );
                        }

                        return list.map(job => {
                            const isOpenSection = activeSection === 'open';
                            const isExp = expanded === job._id;
                            // My slots (this worker's assignments)
                            const wid    = workerId;
                        const mySlots = (job.mySlots || job.workerSlots || []).filter(s => {
                            const sid = (s.assignedWorker?._id || s.assignedWorker)?.toString();
                            return sid === wid;
                        });
                        const myPrimary = mySlots[0];

                        // My application entries
                        const myApps = (job.applicants || []).filter(a => a.workerId?.toString() === wid || a.workerId?._id?.toString() === wid);

                        const cancelInfo = getCancelInfo(job);

                            return (
                            <div key={`${activeSection}-${job._id}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="flex items-start gap-3 p-5 cursor-pointer hover:bg-gray-50/40 transition-colors" onClick={() => setExpanded(isExp ? null : job._id)}>
                                    <img src={getImageUrl(job.postedBy?.photo)} alt="" className="w-10 h-10 rounded-full object-cover border border-gray-200 flex-shrink-0 mt-0.5" onError={e => { e.target.src = '/admin.png'; }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="font-bold text-gray-900 text-sm leading-snug">{job.title}</h3>
                                            <SBadge s={job.status} />
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5">{job.postedBy?.name}</p>

                                        {/* My roles */}
                                        {mySlots.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                {mySlots.map((s, i) => (
                                                    <span key={i} className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                                                        s.status === 'task_completed' ? 'bg-green-100 text-green-700' :
                                                        s.status === 'filled'         ? 'bg-blue-100 text-blue-700'  :
                                                        'bg-gray-100 text-gray-500'
                                                    }`}>
                                                        {s.skill} {s.status === 'task_completed' ? '✓' : ''}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-gray-400">
                                            <span className="font-bold text-green-600">₹{job.payment?.toLocaleString()}</span>
                                            {job.scheduledDate && <span>📅 {new Date(job.scheduledDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>}
                                            {job.scheduledTime && <span>🕐 {job.scheduledTime}</span>}
                                            {job.location?.city && <span>📍 {job.location.city}</span>}
                                        </div>
                                    </div>
                                    <span className="text-gray-300 flex-shrink-0">{isExp ? '▲' : '▼'}</span>
                                </div>

                                {isExp && (
                                    <div className="border-t border-gray-50 px-5 pb-5 pt-4 space-y-4">
                                        <p className="text-sm text-gray-600 leading-relaxed">{job.description}</p>

                                        {/* Full post details */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                                                <p className="text-xs text-gray-500">Scheduled Date</p>
                                                <p className="text-sm font-semibold text-gray-800">{job.scheduledDate ? new Date(job.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set'}</p>
                                            </div>
                                            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                                                <p className="text-xs text-gray-500">Scheduled Time</p>
                                                <p className="text-sm font-semibold text-gray-800">{job.scheduledTime || 'Not set'}</p>
                                            </div>
                                            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                                                <p className="text-xs text-gray-500">Duration</p>
                                                <p className="text-sm font-semibold text-gray-800">{job.duration || 'Not provided'}</p>
                                            </div>
                                            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                                                <p className="text-xs text-gray-500">Workers Required</p>
                                                <p className="text-sm font-semibold text-gray-800">{job.workersRequired || (job.workerSlots || []).length || 'Not provided'}</p>
                                            </div>
                                            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                                                <p className="text-xs text-gray-500">Budget</p>
                                                <p className="text-sm font-semibold text-gray-800">₹{job.payment?.toLocaleString() || '0'}</p>
                                            </div>
                                            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                                                <p className="text-xs text-gray-500">Negotiable</p>
                                                <p className="text-sm font-semibold text-gray-800">{job.negotiable ? 'Yes' : 'No'}</p>
                                            </div>
                                        </div>

                                        {Array.isArray(job.skills) && job.skills.length > 0 && (
                                            <div>
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Required Skills</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {job.skills.map((sk, i) => (
                                                        <span key={i} className="text-xs bg-green-50 border border-green-200 text-green-700 px-2.5 py-1 rounded-full capitalize">{sk}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {!!(job.workerSlots || []).length && (
                                            <div>
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">All Positions</p>
                                                <div className="space-y-2">
                                                    {(job.workerSlots || []).map((s, i) => (
                                                        <div key={i} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5">
                                                            <div>
                                                                <p className="text-sm font-semibold text-gray-800 capitalize">{s.skill}</p>
                                                                <p className="text-xs text-gray-500">~{s.hoursEstimated}h</p>
                                                            </div>
                                                            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 capitalize">{s.status}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* My slot details */}
                                        {mySlots.length > 0 && (
                                            <div>
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Your Assignments</p>
                                                <div className="space-y-2">
                                                    {mySlots.map((s, i) => (
                                                        <div key={i} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                                                            <div>
                                                                <p className="text-sm font-bold text-blue-800 capitalize">{s.skill}</p>
                                                                <p className="text-xs text-blue-500">~{s.hoursEstimated}h estimated</p>
                                                            </div>
                                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                                                s.status === 'task_completed' ? 'bg-green-100 text-green-700' :
                                                                s.status === 'filled'         ? 'bg-blue-100 text-blue-700'  :
                                                                'bg-gray-100 text-gray-500'
                                                            }`}>
                                                                {s.status === 'task_completed' ? '✓ Complete' : s.status === 'filled' ? 'In Progress' : s.status}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Pending applications */}
                                        {myApps.filter(a => a.status === 'pending').length > 0 && (
                                            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                                                <p className="text-xs font-bold text-amber-700 mb-1">Pending Applications</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {myApps.filter(a => a.status === 'pending').map((a, i) => (
                                                        <span key={i} className="text-xs bg-white border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full capitalize">{a.skill || 'general'}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Client info */}
                                        {job.postedBy && (
                                            <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-3">
                                                <img src={getImageUrl(job.postedBy.photo)} alt="" className="w-9 h-9 rounded-full object-cover" onError={e => { e.target.src = '/admin.png'; }} />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-800">{job.postedBy.name}</p>
                                                    {job.postedBy.mobile && <a href={`tel:${job.postedBy.mobile}`} className="text-xs text-blue-600">📞 {job.postedBy.mobile}</a>}
                                                </div>
                                            </div>
                                        )}

                                        {/* Location */}
                                        {job.location?.city && (
                                            <div className="bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-600">
                                                📍 {[job.location.locality, job.location.city, job.location.pincode].filter(Boolean).join(', ')}
                                                {job.location.fullAddress && <p className="text-xs text-gray-400 mt-0.5">{job.location.fullAddress}</p>}
                                            </div>
                                        )}

                                        {!!(job.qaAnswers || []).length && (
                                            <div>
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Client Q&A</p>
                                                <div className="space-y-2">
                                                    {(job.qaAnswers || []).map((qa, i) => (
                                                        <div key={i} className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                                                            <p className="text-xs font-semibold text-indigo-700">Q: {qa.question || 'Question'}</p>
                                                            <p className="text-sm text-indigo-900 mt-1">A: {qa.answer || '—'}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {!!(job.photos || []).length && (
                                            <div>
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Job Photos</p>
                                                <div className="grid grid-cols-4 gap-2">
                                                    {(job.photos || []).map((p, i) => <img key={i} src={getImageUrl(p)} alt="" className="w-full aspect-square object-cover rounded-lg" />)}
                                                </div>
                                            </div>
                                        )}

                                        {/* Completion photos */}
                                        {job.completionPhotos?.length > 0 && (
                                            <div>
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Completion Photos</p>
                                                <div className="grid grid-cols-4 gap-2">
                                                    {job.completionPhotos.map((p, i) => <img key={i} src={getImageUrl(p)} alt="" className="w-full aspect-square object-cover rounded-lg" />)}
                                                </div>
                                            </div>
                                        )}

                                        {/* Running: notice about what to expect */}
                                        {job.status === 'running' && (
                                            <div className="bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-3">
                                                <p className="text-xs font-bold text-yellow-700 mb-1">Job In Progress</p>
                                                <p className="text-xs text-yellow-600">Complete your assigned tasks. The client will mark your task as done when work is complete and provide a rating.</p>
                                            </div>
                                        )}

                                        {/* ── CANCEL BUTTON — only scheduled + > 30min ── */}
                                        {cancelInfo.show && (
                                            <div>
                                                {cancelInfo.allowed ? (
                                                    <button onClick={() => setCancelData({ job, mySlot: myPrimary })}
                                                        className="w-full py-3 border-2 border-red-200 text-red-500 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors">
                                                        Cancel Assignment
                                                    </button>
                                                ) : cancelInfo.reason === 'too_close' ? (
                                                    <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-center">
                                                        <p className="text-xs font-bold text-red-600">🔒 Cannot Cancel</p>
                                                        <p className="text-xs text-red-500 mt-0.5">
                                                            Cancellation window closed. Job starts in {cancelInfo.minsLeft} min.
                                                            (Must cancel more than {CANCEL_CUTOFF_MINS} minutes before start)
                                                        </p>
                                                    </div>
                                                ) : null}
                                            </div>
                                        )}

                                        {/* Running: no cancel at all */}
                                        {job.status === 'running' && (
                                            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-center">
                                                <p className="text-xs text-gray-500 font-medium">🔒 Job is running — cancellation not available</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            );
                        });
                    })()}
                </div>
            )}

            {cancelData && (
                <CancelModal
                    job={cancelData.job}
                    mySlot={cancelData.mySlot}
                    onClose={() => setCancelData(null)}
                    onCancelled={handleCancelled}
                />
            )}
        </div>
    );
}
