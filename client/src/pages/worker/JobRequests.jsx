// client/src/pages/worker/JobRequests.jsx
// CHANGES:
//  - Skill selection modal before applying (max 2 skills)
//  - Detail modal shows ONLY worker's relevant skill costs
//  - "Applied for: painter, plumber" shown on applied cards

import { useState, useEffect, useRef } from 'react';
import { getAvailableJobs, getJobDetails, applyForJob, applyForSubTask, getWorkerProfile, getImageUrl } from '../../api/index';
import toast from 'react-hot-toast';

// ── Mini map ──────────────────────────────────────────────────────────────────
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
    const ref = useRef(null); const mRef = useRef(null);
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

// ─────────────────────────────────────────────────────────────────────────────
// SKILL SELECTION MODAL — worker picks positions to apply for (max 2)
// ─────────────────────────────────────────────────────────────────────────────
function SkillSelectModal({ job, workerSkills, onClose, onApply }) {
    const [selected, setSelected] = useState([]);
    const [applying, setApplying] = useState(false);
    const [alert,    setAlert]    = useState('');

    // Build available options from open slots matching worker skills
    const options = [];
    const seen    = new Set();
    (job.workerSlots || []).forEach(s => {
        if (s.status !== 'open') return;
        if (seen.has(s.skill))  return;
        if (workerSkills.length > 0 &&
            !workerSkills.includes(s.skill) &&
            s.skill !== 'general' && s.skill !== 'handyman') return;
        seen.add(s.skill);
        const count      = (job.openSlotSummary || {})[s.skill] || 1;
        const budgetBlock = (job.relevantBudgetBlocks || []).find(b => b.skill === s.skill);
        options.push({ skill: s.skill, count, hoursEstimated: s.hoursEstimated, budgetBlock });
    });

    const toggle = (sk) => {
        setAlert('');
        setSelected(p => {
            if (p.includes(sk)) return p.filter(s => s !== sk);
            if (p.length >= 2)  { setAlert('You can apply for a maximum of 2 positions per job.'); return p; }
            return [...p, sk];
        });
    };

    const handleApply = async () => {
        if (!selected.length) { setAlert('Please select at least one position.'); return; }
        try {
            setApplying(true);
            await onApply(selected);
            onClose();
        } catch (err) {
            setAlert(err?.response?.data?.message || 'Failed to apply.');
            setApplying(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
            <div className="bg-white w-full sm:rounded-2xl shadow-2xl sm:max-w-md p-6" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Select Positions to Apply</h3>
                <p className="text-sm text-gray-500 mb-4">"{job.title}" — select up to 2 positions</p>

                {alert && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-700">{alert}</div>
                )}

                {options.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No matching open positions for your skills.</p>
                ) : (
                    <div className="space-y-3 mb-5">
                        {options.map(opt => {
                            const isSel  = selected.includes(opt.skill);
                            const perW   = opt.budgetBlock
                                ? Math.round(opt.budgetBlock.subtotal / (opt.budgetBlock.count || 1))
                                : null;
                            return (
                                <button key={opt.skill} type="button" onClick={() => toggle(opt.skill)}
                                    className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                                        isSel ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white hover:border-orange-200'
                                    }`}>
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                                        isSel ? 'bg-orange-500 border-orange-500' : 'border-gray-300'
                                    }`}>
                                        {isSel && <span className="text-white text-xs font-bold">✓</span>}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-gray-800 capitalize text-sm">{opt.skill}</span>
                                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                                {opt.count} slot{opt.count > 1 ? 's' : ''} open
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5">~{opt.hoursEstimated}h estimated work</p>
                                        {perW && (
                                            <p className="text-xs text-green-600 font-semibold mt-0.5">
                                                Your earnings: ₹{perW.toLocaleString()}
                                            </p>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                <div className="flex gap-3">
                    <button onClick={onClose}
                        className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleApply} disabled={applying || !selected.length}
                        className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold disabled:opacity-60 transition-colors">
                        {applying
                            ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Submitting…</span>
                            : `Apply (${selected.length})`}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// JOB DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────────────
function DetailModal({ jobId, workerSkills, isAvailable, onClose, onApplied }) {
    const [job,      setJob]      = useState(null);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState('');
    const [showSkillPicker, setShowSkillPicker] = useState(false);

    useEffect(() => {
        (async () => {
            try   { const { data } = await getJobDetails(jobId); setJob(data); }
            catch { setError('Failed to load job details.'); }
            finally { setLoading(false); }
        })();
    }, [jobId]);

    const handleApplyWithSkills = async (selectedSkills) => {
        await applyForJob(jobId, selectedSkills);
        toast.success(`Applied for: ${selectedSkills.join(', ')}!`);
        if (onApplied) onApplied(jobId);
        setJob(j => j ? { ...j, hasApplied: true, myAppliedSkills: selectedSkills } : j);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
            <div className="bg-white w-full sm:rounded-2xl shadow-2xl sm:max-w-2xl max-h-[95vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}>

                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : !job ? (
                    <div className="p-6 text-center text-gray-400">
                        <p>{error || 'Job not found.'}</p>
                        <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-100 rounded-xl text-sm">Close</button>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="sticky top-0 bg-white z-10 flex-shrink-0">
                            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 pt-5 pb-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-white font-black text-xl leading-tight">{job.title}</h2>
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {job.urgent     && <span className="text-xs bg-white/25 text-white px-2.5 py-1 rounded-full font-bold">⚡ Urgent</span>}
                                            {job.negotiable && <span className="text-xs bg-white/25 text-white px-2.5 py-1 rounded-full font-bold">🤝 Negotiable</span>}
                                            {job.shift      && <span className="text-xs bg-white/25 text-white px-2.5 py-1 rounded-full font-bold">{job.shift.split('(')[0].trim()}</span>}
                                        </div>
                                    </div>
                                    <button onClick={onClose}
                                        className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white flex-shrink-0">✕</button>
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5">

                            {/* Client Info */}
                            {job.postedBy && (
                                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-4">
                                    <img src={getImageUrl(job.postedBy.photo)} alt={job.postedBy.name}
                                        className="w-12 h-12 rounded-full object-cover border-2 border-white shadow flex-shrink-0"
                                        onError={e => { e.target.src = '/admin.png'; }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-gray-900">{job.postedBy.name}</span>
                                            {job.postedBy.verificationStatus === 'approved' && (
                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">✓ Verified</span>
                                            )}
                                        </div>
                                        {job.postedBy.mobile && (
                                            <a href={`tel:${job.postedBy.mobile}`} className="text-sm text-blue-600 font-semibold mt-1 block">
                                                📞 {job.postedBy.mobile}
                                            </a>
                                        )}
                                        {job.clientStats && (
                                            <div className="flex gap-3 mt-2 flex-wrap">
                                                <div className="bg-white rounded-lg px-2.5 py-1.5 text-center shadow-sm border border-blue-100">
                                                    <div className="text-sm font-black text-blue-700">{job.clientStats.completedJobs}</div>
                                                    <div className="text-[9px] text-gray-400 uppercase font-semibold">Completed</div>
                                                </div>
                                                <div className="bg-white rounded-lg px-2.5 py-1.5 text-center shadow-sm border border-blue-100">
                                                    <div className="text-sm font-black text-blue-700">{job.clientStats.totalJobsPosted}</div>
                                                    <div className="text-[9px] text-gray-400 uppercase font-semibold">Total Posted</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Description */}
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">About the Job</p>
                                <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
                                    <p className="text-sm font-semibold text-gray-800 leading-relaxed">{job.title}</p>
                                    {job.description && job.description.toLowerCase().trim() !== job.title.toLowerCase().trim() && (
                                        <p className="text-sm text-gray-500 leading-relaxed">{job.description}</p>
                                    )}
                                </div>
                            </div>

                            {/* Open positions for this worker */}
                            {job.openSlotSummary && Object.keys(job.openSlotSummary).length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                        Positions Available for You
                                    </p>
                                    <div className="space-y-2">
                                        {Object.entries(job.openSlotSummary).map(([sk, count]) => {
                                            const slotEx = (job.workerSlots || []).find(s => s.skill === sk && s.status === 'open');
                                            const bBlock = (job.relevantBudgetBlocks || []).find(b => b.skill === sk);
                                            const perW   = bBlock ? Math.round(bBlock.subtotal / (bBlock.count || 1)) : null;
                                            return (
                                                <div key={sk} className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-bold text-orange-700 capitalize text-sm">{sk}</span>
                                                        <span className="text-xs bg-orange-500 text-white px-2.5 py-1 rounded-full font-bold">{count} position{count > 1 ? 's' : ''}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4 mt-1.5 text-xs">
                                                        {slotEx && <span className="text-orange-500">~{slotEx.hoursEstimated}h per worker</span>}
                                                        {perW   && <span className="text-green-600 font-semibold">Your earnings: ₹{perW.toLocaleString()}</span>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Worker-relevant budget ONLY */}
                            {(job.relevantBudgetBlocks || []).length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                        Your Skill — Cost Details
                                    </p>
                                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                                        {job.relevantBudgetBlocks.map((b, i) => {
                                            const count = b.count || 1;
                                            const perW  = Math.round(b.subtotal / count);
                                            return (
                                                <div key={i}>
                                                    {/* Skill header */}
                                                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex justify-between items-center">
                                                        <span className="text-xs font-bold text-gray-700 capitalize">{b.skill}</span>
                                                        <span className="text-xs text-gray-400">{b.hours}h total · {count} worker{count > 1 ? 's' : ''}</span>
                                                    </div>
                                                    {/* Per-worker rows */}
                                                    {Array.from({ length: count }).map((_, wi) => (
                                                        <div key={wi} className="flex justify-between px-4 py-2.5 border-b border-gray-50 last:border-0 bg-white text-sm">
                                                            <span className="text-gray-600 capitalize">{b.skill} Worker {count > 1 ? wi + 1 : ''}</span>
                                                            <span className="font-bold text-green-700">₹{perW.toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                    <div className="flex justify-between px-4 py-2 bg-orange-50 text-sm font-bold">
                                                        <span className="capitalize text-gray-700">{b.skill} total</span>
                                                        <span className="text-orange-700">₹{b.subtotal?.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1.5">
                                        💡 Only costs for your matching skills are shown.
                                    </p>
                                </div>
                            )}

                            {/* Schedule */}
                            {(job.scheduledDate || job.scheduledTime) && (
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Schedule</p>
                                    <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                                        {job.scheduledDate && (
                                            <p className="text-sm text-gray-700">
                                                📅 {new Date(job.scheduledDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                            </p>
                                        )}
                                        {job.scheduledTime && <p className="text-sm text-gray-700">🕐 {job.scheduledTime}</p>}
                                        {job.shift         && <p className="text-sm text-gray-600">{job.shift}</p>}
                                        {job.duration      && <p className="text-sm text-gray-500">⏱ {job.duration}</p>}
                                    </div>
                                </div>
                            )}

                            {/* Location */}
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Location</p>
                                <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                                    {job.location?.fullAddress && <p className="text-sm text-gray-700">🏠 {job.location.fullAddress}</p>}
                                    {job.location?.city && (
                                        <p className="text-sm text-gray-600">
                                            📍 {[job.location.locality, job.location.city, job.location.pincode].filter(Boolean).join(', ')}
                                        </p>
                                    )}
                                </div>
                                {job.location?.lat && job.location?.lng && (
                                    <MiniMap lat={job.location.lat} lng={job.location.lng} />
                                )}
                            </div>

                            {/* Q&A */}
                            {job.qaAnswers?.filter(q => q.answer).length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Client's Answers</p>
                                    <div className="bg-amber-50 border border-amber-100 rounded-xl overflow-hidden">
                                        {job.qaAnswers.filter(q => q.answer).map((qa, i) => (
                                            <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-amber-100 last:border-0">
                                                <span className="text-amber-400 flex-shrink-0 text-sm mt-0.5">Q</span>
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-0.5">{qa.question}</p>
                                                    <p className="text-sm font-semibold text-gray-800">{qa.answer}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Work photos */}
                            {job.photos?.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Work Area Photos</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {job.photos.map((p, i) => (
                                            <img key={i} src={getImageUrl(p)} alt="" className="w-full aspect-square object-cover rounded-xl border border-gray-100" />
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-500">
                                👥 {job.applicantCount || 0} applied · {job.workersRequired} total worker{job.workersRequired !== 1 ? 's' : ''} needed
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 pb-5 pt-4 flex-shrink-0">
                            {job.hasApplied ? (
                                <div className="w-full text-center py-3 bg-gray-100 text-gray-500 rounded-xl font-bold">
                                    ✓ Applied{job.myAppliedSkills?.length > 0 ? ` for: ${job.myAppliedSkills.join(', ')}` : ''}
                                </div>
                            ) : job.isAssigned ? (
                                <div className="w-full text-center py-3 bg-green-100 text-green-700 rounded-xl font-bold">
                                    ✓ You're Assigned
                                </div>
                            ) : (
                                isAvailable ? (
                                    <button onClick={() => setShowSkillPicker(true)}
                                        className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl text-base flex items-center justify-center gap-2 transition-colors">
                                        📋 Select Position & Apply
                                    </button>
                                ) : (
                                    <div className="w-full text-center py-3 bg-red-50 border border-red-200 text-red-600 rounded-xl font-bold text-sm">
                                        🔴 Turn ON availability to apply
                                    </div>
                                )
                            )}
                        </div>

                        {/* Skill picker overlay */}
                        {showSkillPicker && (
                            <SkillSelectModal
                                job={job}
                                workerSkills={workerSkills}
                                onClose={() => setShowSkillPicker(false)}
                                onApply={handleApplyWithSkills}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-TASK CARD — standalone card for reposted missing-skill sub-tasks
// ─────────────────────────────────────────────────────────────────────────────
function SubTaskCard({ job, isAvailable, applying, onApply }) {
    const earnings = (job.relevantBudgetBlocks || []).reduce((s, b) => s + (b.subtotal || 0), 0);
    const hours    = job.workerSlots?.[0]?.hoursEstimated;
    return (
        <div className="bg-white rounded-2xl border-2 border-orange-200 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-orange-400 to-amber-400" />
            <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">⚡ Urgent Sub-task</span>
                        </div>
                        <h3 className="font-bold text-gray-900 leading-snug capitalize">
                            {job.subTaskSkill} Task
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{job.parentJobTitle || job.title}</p>
                    </div>
                    {earnings > 0 && (
                        <div className="text-right flex-shrink-0">
                            <div className="text-base font-black text-green-600">₹{earnings.toLocaleString()}</div>
                            <div className="text-[10px] text-gray-400">Your earnings</div>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                    {job.scheduledTime && (
                        <span className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-semibold">🕐 {job.scheduledTime}</span>
                    )}
                    {hours && (
                        <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">~{hours}h</span>
                    )}
                    {job.location?.city && (
                        <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">📍 {job.location.city}</span>
                    )}
                    {job.scheduledDate && (
                        <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                            📅 {new Date(job.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                    )}
                </div>

                <div className="flex items-center justify-end mt-4 pt-3 border-t border-gray-50">
                    {job.hasApplied ? (
                        <span className="text-xs px-4 py-2 bg-green-100 text-green-600 rounded-xl font-bold">Applied ✓</span>
                    ) : job.isAssigned ? (
                        <span className="text-xs px-4 py-2 bg-green-100 text-green-700 rounded-xl font-bold">✓ Assigned</span>
                    ) : (
                        <button
                            onClick={() => isAvailable ? onApply(job) : toast.error('Turn ON availability to apply.')}
                            disabled={applying[job._id]}
                            className={`text-xs px-4 py-2 rounded-xl font-bold disabled:opacity-60 transition-colors ${
                                isAvailable
                                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}>
                            {applying[job._id] ? '…' : '⚡ Apply Now'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN — Job listing
// ─────────────────────────────────────────────────────────────────────────────
export default function JobRequests() {
    const [jobs,        setJobs]        = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [search,      setSearch]      = useState('');
    const [filterSkill, setFilterSkill] = useState('all');
    const [filterCity,  setFilterCity]  = useState('all');
    const [detailId,    setDetailId]    = useState(null);
    const [applyModal,  setApplyModal]  = useState(null); // job for quick apply
    const [applying,    setApplying]    = useState({});
    const [isAvailable, setIsAvailable] = useState(true);

    // Get worker skills from localStorage user
    const localUser    = JSON.parse(localStorage.getItem('user') || '{}');
    const workerSkills = (localUser?.skills || [])
        .map(s => (typeof s === 'string' ? s : s?.name || '').toLowerCase().trim())
        .filter(Boolean);

    const loadJobs = async () => {
        try {
            setLoading(true);
            const [jobsRes, profileRes] = await Promise.all([getAvailableJobs(), getWorkerProfile()]);
            setJobs(Array.isArray(jobsRes.data) ? jobsRes.data : []);
            setIsAvailable(profileRes.data?.availability !== false);
        } catch { toast.error('Failed to load jobs.'); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadJobs(); }, []);

    const handleApplied = (jobId) =>
        setJobs(p => p.map(j => j._id === jobId ? { ...j, hasApplied: true } : j));

    // Sub-task direct apply
    const handleSubTaskApply = async (job) => {
        try {
            setApplying(p => ({ ...p, [job._id]: true }));
            const parentId = job.parentJobId?._id || job.parentJobId;
            await applyForSubTask(parentId, job._id);
            toast.success(`Applied for ${job.subTaskSkill || 'sub-task'}!`);
            setJobs(p => p.map(j => j._id === job._id ? { ...j, hasApplied: true } : j));
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to apply.');
        } finally {
            setApplying(p => ({ ...p, [job._id]: false }));
        }
    };

    // Quick apply — opens skill picker
    const handleQuickApplySkills = async (job, selectedSkills) => {
        try {
            setApplying(p => ({ ...p, [job._id]: true }));
            await applyForJob(job._id, selectedSkills);
            toast.success(`Applied for: ${selectedSkills.join(', ')}!`);
            handleApplied(job._id);
            setApplyModal(null);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to apply.');
        } finally {
            setApplying(p => ({ ...p, [job._id]: false }));
        }
    };

    // Filters
    const allSkills = [...new Set(jobs.flatMap(j => j.relevantSkills || j.skills || []))].filter(Boolean).slice(0, 15);
    const allCities = [...new Set(jobs.map(j => j.location?.city).filter(Boolean))].slice(0, 10);

    const filtered = jobs.filter(j => {
        const s          = search.toLowerCase();
        const matchSearch = !s || j.title.toLowerCase().includes(s) || j.description.toLowerCase().includes(s) || j.location?.city?.toLowerCase().includes(s);
        const matchSkill  = filterSkill === 'all' || (j.relevantSkills || j.skills || []).includes(filterSkill);
        const matchCity   = filterCity  === 'all' || j.location?.city === filterCity;
        return matchSearch && matchSkill && matchCity;
    });

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto p-4 space-y-4 pb-20">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-gray-900">Available Jobs</h1>
                    <p className="text-xs text-gray-400 mt-0.5">{filtered.length} matching your skills</p>
                </div>
                <button onClick={loadJobs}
                    className="text-xs text-orange-500 border border-orange-200 px-3 py-1.5 rounded-lg hover:bg-orange-50 font-semibold transition-colors">
                    🔄 Refresh
                </button>
            </div>

            {/* Availability banner */}
            {!isAvailable && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className="text-lg">🔴</span>
                    <div>
                        <p className="text-sm font-bold text-red-700">You are not available</p>
                        <p className="text-xs text-red-500">Turn ON availability from the header to apply for jobs.</p>
                    </div>
                </div>
            )}

            {/* Search + filters */}
            <div className="space-y-2">
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="🔍 Search jobs, skills, city…"
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 transition-colors"
                />
                <div className="flex gap-2">
                    <select value={filterSkill} onChange={e => setFilterSkill(e.target.value)}
                        className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400 bg-white transition-colors">
                        <option value="all">All Skills</option>
                        {allSkills.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                    </select>
                    <select value={filterCity} onChange={e => setFilterCity(e.target.value)}
                        className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400 bg-white transition-colors">
                        <option value="all">All Cities</option>
                        {allCities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            {/* Job cards */}
            {filtered.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                    <div className="text-5xl mb-3">🔍</div>
                    <p className="font-bold text-base">No jobs match your skills</p>
                    <p className="text-sm mt-1 text-gray-300">Try adjusting filters or check back later</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(job => (
                        job.isSubTask ? (
                            <SubTaskCard
                                key={job._id}
                                job={job}
                                isAvailable={isAvailable}
                                applying={applying}
                                onApply={handleSubTaskApply}
                            />
                        ) : (
                        <div key={job._id}
                            className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden"
                            onClick={() => setDetailId(job._id)}>

                            {/* Urgency accent */}
                            <div className={`h-1 ${job.urgent ? 'bg-orange-500' : 'bg-gray-100'}`} />

                            <div className="p-5">
                                {/* Top row */}
                                <div className="flex items-start gap-3">
                                    <img src={getImageUrl(job.postedBy?.photo)} alt=""
                                        className="w-10 h-10 rounded-full object-cover border border-gray-200 flex-shrink-0"
                                        onError={e => { e.target.src = '/admin.png'; }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-gray-900 leading-snug truncate">{job.title}</h3>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-xs text-gray-400">{job.postedBy?.name}</span>
                                                    {job.postedBy?.verificationStatus === 'approved' && (
                                                        <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded font-bold">✓</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                {job.urgent     && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">⚡ Urgent</span>}
                                                {job.negotiable && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-semibold">🤝 Nego</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Description */}
                                <p className="text-sm text-gray-500 mt-3 line-clamp-2 leading-relaxed">
                                    {job.shortDescription || job.description}
                                </p>

                                {/* Open slots relevant to this worker */}
                                {job.openSlotSummary && Object.keys(job.openSlotSummary).length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-3">
                                        {Object.entries(job.openSlotSummary).map(([sk, cnt]) => (
                                            <span key={sk} className="text-xs bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-bold capitalize">
                                                {sk} × {cnt}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Applied skills */}
                                {job.hasApplied && job.myAppliedSkills?.length > 0 && (
                                    <div className="flex items-center gap-1.5 mt-2">
                                        <span className="text-xs text-green-600 font-medium">✓ Applied for:</span>
                                        {job.myAppliedSkills.map(sk => (
                                            <span key={sk} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium capitalize">{sk}</span>
                                        ))}
                                    </div>
                                )}

                                {/* Meta row */}
                                <div className="flex items-center gap-3 mt-3 flex-wrap text-xs text-gray-400">
                                    {job.scheduledDate && <span>📅 {new Date(job.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                                    {job.shift         && <span>{job.shift.split('(')[0].trim()}</span>}
                                    {job.location?.city && <span>📍 {job.location.city}</span>}
                                    {job.duration      && <span>⏱ {job.duration}</span>}
                                    {job.applicantCount > 0 && <span>👤 {job.applicantCount} applied</span>}
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
                                    <div>
                                        {(() => {
                                            const totalEarnings = (job.relevantBudgetBlocks || []).reduce((sum, b) =>
                                                sum + Math.round(b.subtotal / (b.count || 1)), 0);
                                            return totalEarnings > 0 ? (
                                                <>
                                                    <div className="text-base font-black text-green-600">₹{totalEarnings.toLocaleString()}</div>
                                                    <div className="text-xs text-gray-400">Your total earnings</div>
                                                </>
                                            ) : (
                                                <div className="text-xs text-gray-400">Tap Details for pay info</div>
                                            );
                                        })()}
                                    </div>

                                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => setDetailId(job._id)}
                                            className="text-xs px-3 py-2 border-2 border-orange-200 text-orange-600 rounded-xl hover:bg-orange-50 font-bold transition-colors">
                                            Details
                                        </button>
                                        {!job.hasApplied ? (
                                            <button
                                                onClick={() => isAvailable ? setApplyModal(job) : toast.error('Turn ON availability to apply.')}
                                                disabled={applying[job._id]}
                                                className={`text-xs px-3 py-2 rounded-xl font-bold disabled:opacity-60 transition-colors ${
                                                    isAvailable
                                                        ? 'bg-orange-500 hover:bg-orange-600 text-white'
                                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                }`}>
                                                {applying[job._id] ? '…' : 'Apply'}
                                            </button>
                                        ) : (
                                            <span className="text-xs px-3 py-2 bg-green-100 text-green-600 rounded-xl font-bold">
                                                Applied ✓
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        )
                    ))}
                </div>
            )}

            {/* Detail modal */}
            {detailId && (
                <DetailModal
                    jobId={detailId}
                    workerSkills={workerSkills}
                    isAvailable={isAvailable}
                    onClose={() => setDetailId(null)}
                    onApplied={handleApplied}
                />
            )}

            {/* Quick apply skill picker */}
            {applyModal && (
                <SkillSelectModal
                    job={applyModal}
                    workerSkills={workerSkills}
                    onClose={() => setApplyModal(null)}
                    onApply={(skills) => handleQuickApplySkills(applyModal, skills)}
                />
            )}
        </div>
    );
}
