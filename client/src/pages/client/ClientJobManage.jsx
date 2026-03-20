// client/src/pages/client/ClientJobManage.jsx
// ADDS ON TOP OF PREVIOUS VERSION:
//  1. Pre-start alert banner (shown when unfilled slots + < 30 min to start)
//     — Three options per unfilled skill: Repost | Dismiss | Wait
//  2. Repost modal: shows skill info + client enters new start time
//  3. Sub-task management section: shows open sub-tasks, accept/reject applicants
//  4. Sub-task "Mark Done" + rating in completion flow

import { useState, useEffect, useRef } from 'react';
import {
    getClientJobs, deleteClientJob, cancelJob, updateJobStatus,
    uploadCompletionPhotos, startJob, toggleJobApplications,
    removeAssignedWorker, completeWorkerTask, respondToApplicant,
    submitRating, toggleStarWorker, getWorkerFullProfile, getImageUrl,
    repostMissingSkill, dismissMissingSkill, respondToSubTaskApplicant,
    completeSubTask,
} from '../../api/index';
import toast from 'react-hot-toast';

// ── Helpers ────────────────────────────────────────────────────────────────────
const isCancelled = s => ['cancelled_by_client','cancelled'].includes(s);
const SLOT_SC = { open:'bg-gray-100 text-gray-500', filled:'bg-blue-100 text-blue-700', task_completed:'bg-green-100 text-green-700', cancelled:'bg-red-100 text-red-400', not_required:'bg-gray-100 text-gray-400', reposted:'bg-purple-100 text-purple-600' };
const STATUS_C = { open:'bg-green-100 text-green-700', scheduled:'bg-blue-100 text-blue-700', running:'bg-yellow-100 text-yellow-800', completed:'bg-emerald-100 text-emerald-700', cancelled_by_client:'bg-red-100 text-red-600', cancelled:'bg-red-100 text-red-600' };
const STATUS_L = { open:'Open', scheduled:'Scheduled', running:'Running', completed:'Completed', cancelled_by_client:'Cancelled', cancelled:'Cancelled' };

function SBadge({ status }) {
    return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_C[status]||'bg-gray-100 text-gray-500'}`}>{STATUS_L[status]||status}</span>;
}
function Alert({ msg, type='error', onDismiss }) {
    if (!msg) return null;
    const s = { error:'bg-red-50 border border-red-200 text-red-700', success:'bg-green-50 border border-green-200 text-green-700', info:'bg-blue-50 border border-blue-100 text-blue-700', warning:'bg-amber-50 border border-amber-200 text-amber-700' };
    return <div className={`${s[type]} rounded-xl px-4 py-3 text-sm flex items-start justify-between gap-3`}><p className="leading-relaxed">{msg}</p>{onDismiss && <button onClick={onDismiss} className="flex-shrink-0 opacity-50 hover:opacity-100 font-bold text-lg">×</button>}</div>;
}

// ── Countdown hook ─────────────────────────────────────────────────────────────
const pad2 = n => String(Math.max(0,n)).padStart(2,'0');
function useStartCountdown(job) {
    const [info, setInfo] = useState({ canStart:true, remaining:'00:00:00' });
    useEffect(() => {
        if (!job.scheduledDate||!job.scheduledTime||job.status!=='scheduled') { setInfo({ canStart:true, remaining:'00:00:00' }); return; }
        const update = () => {
            const [h,m] = job.scheduledTime.split(':').map(Number);
            const sched = new Date(job.scheduledDate); sched.setHours(h,m,0,0);
            const ms    = sched.getTime()-Date.now();
            const tm    = Math.max(0,Math.floor(ms/60000));
            setInfo({ canStart: ms<=0, remaining: `${pad2(Math.floor(tm/60))}:${pad2(tm%60)}`, scheduledAt: sched });
        };
        update();
        const t = setInterval(update, 1000);
        return () => clearInterval(t);
    }, [job._id, job.status, job.scheduledTime, job.scheduledDate]);
    return info;
}

// ── Worker Profile Modal ───────────────────────────────────────────────────────
function WorkerModal({ workerId, onClose, onStar, starredIds=[] }) {
    const [w, setW] = useState(null); const [load, setLoad] = useState(true);
    useEffect(() => { (async()=>{ try { const { data } = await getWorkerFullProfile(workerId); setW(data); } catch {} finally { setLoad(false); } })(); }, [workerId]);
    const starred = starredIds.includes(workerId?.toString());
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
            <div className="bg-white w-full sm:rounded-2xl shadow-2xl sm:max-w-lg max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
                {load ? <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"/></div>
                : !w ? null : (<>
                    <div className="sticky top-0 bg-white px-5 pt-5 pb-4 border-b border-gray-100 flex items-center gap-4 z-10">
                        <img src={getImageUrl(w.photo)} alt={w.name} className="w-14 h-14 rounded-full object-cover border-2 border-gray-200" onError={e=>{e.target.src='/admin.png'}}/>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap"><h2 className="font-bold text-gray-900 text-lg">{w.name}</h2>{w.verificationStatus==='approved'&&<span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">✓ Verified</span>}</div>
                            <p className="text-xs text-gray-400 mt-0.5">{w.karigarId} · 📞 {w.mobile||'N/A'}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500"><span>⭐ {w.avgStars?.toFixed(1)||'—'}</span><span>💼 {w.completedJobs||0}</span><span>🏆 {w.points||0} pts</span></div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={()=>onStar(workerId)} className={`w-9 h-9 rounded-full flex items-center justify-center text-lg ${starred?'bg-yellow-100 text-yellow-500':'bg-gray-100 text-gray-400 hover:text-yellow-500'}`}>{starred?'★':'☆'}</button>
                            <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500">✕</button>
                        </div>
                    </div>
                    <div className="px-5 py-5 space-y-4">
                        {w.skills?.length>0&&(<div><p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Skills</p><div className="flex flex-wrap gap-2">{w.skills.map((s,i)=><span key={i} className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-medium capitalize">{s?.name||s}</span>)}</div></div>)}
                        {w.ratings?.length>0&&(<div><p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Reviews</p><div className="space-y-2">{w.ratings.slice(0,4).map((r,i)=><div key={i} className="bg-gray-50 rounded-xl p-3"><div className="flex items-center gap-2 mb-1"><img src={getImageUrl(r.client?.photo)} alt="" className="w-6 h-6 rounded-full object-cover" onError={e=>{e.target.src='/admin.png'}}/><span className="text-xs font-semibold text-gray-700">{r.client?.name}</span><span className="text-xs text-yellow-500">{'★'.repeat(r.stars||0)}</span>{r.skill&&<span className="text-xs text-gray-400 capitalize">{r.skill}</span>}</div>{r.message&&<p className="text-xs text-gray-500 line-clamp-2">{r.message}</p>}</div>)}</div></div>)}
                    </div>
                </>)}
            </div>
        </div>
    );
}

// ── Repost Missing Skill Modal ─────────────────────────────────────────────────
function RepostModal({ job, slot, onClose, onReposted }) {
    const todayStr = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
    const [newDate, setNewDate] = useState(todayStr());
    const [newTime, setNewTime] = useState('');
    const [loading, setLoading] = useState(false);
    const [alert,   setAlert]   = useState('');

    const budgetBlock = job.budgetBreakdown?.breakdown?.find(b => b.skill === slot.skill);
    const perWorker   = budgetBlock ? Math.round(budgetBlock.subtotal / (budgetBlock.count||1)) : null;

    const handle = async () => {
        if (!newTime) { setAlert('Please select a new start time.'); return; }
        const [h,m] = newTime.split(':').map(Number);
        const sched = new Date(newDate); sched.setHours(h,m,0,0);
        if ((sched.getTime()-Date.now())/60000 < 30) { setAlert('New start time must be at least 30 minutes from now.'); return; }
        const mins = h*60+m;
        if (mins < 360 || mins > 1260) { setAlert('Time must be between 6:00 AM and 9:00 PM.'); return; }
        try {
            setLoading(true);
            const { data } = await repostMissingSkill(job._id, slot._id?.toString(), newDate, newTime);
            toast.success(`${slot.skill} sub-task created!`);
            onReposted(job._id, data.job);
            onClose();
        } catch (err) {
            setAlert(err?.response?.data?.message || 'Failed to repost.');
        } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
            <div className="bg-white w-full sm:rounded-2xl shadow-2xl sm:max-w-md p-6" onClick={e=>e.stopPropagation()}>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Repost Missing Skill</h3>
                <p className="text-sm text-gray-500 mb-5">Create a sub-task for the unfilled <strong className="capitalize text-orange-600">{slot.skill}</strong> position.</p>

                {/* Skill info */}
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mb-5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-orange-700 capitalize text-base">{slot.skill}</span>
                        {perWorker && <span className="text-sm font-bold text-green-600">₹{perWorker.toLocaleString()}</span>}
                    </div>
                    <div className="text-xs text-orange-500 space-y-0.5">
                        <p>~{slot.hoursEstimated}h estimated work</p>
                        <p>Same location, description, and budget as the original job.</p>
                        <p>A new start time allows workers to apply specifically for this task.</p>
                    </div>
                </div>

                {alert && <div className="mb-4"><Alert msg={alert} type="error" onDismiss={() => setAlert('')}/></div>}

                <div className="space-y-4 mb-5">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">New Start Date <span className="text-red-500">*</span></label>
                        <input type="date" min={todayStr()} value={newDate} onChange={e=>setNewDate(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400 transition-colors" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">New Start Time <span className="text-red-500">*</span></label>
                        <input type="time" value={newTime} onChange={e=>setNewTime(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400 transition-colors" />
                        <p className="text-xs text-gray-400 mt-1">Must be 6:00 AM – 9:00 PM and at least 30 min from now</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50">Cancel</button>
                    <button onClick={handle} disabled={loading||!newTime} className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold disabled:opacity-60 transition-colors">
                        {loading ? 'Creating…' : `Repost ${slot.skill} Sub-task`}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Slot Rating Modal ──────────────────────────────────────────────────────────
function SlotRatingModal({ job, onClose, onSlotRated }) {
    // Includes sub-task slots too
    const unratedSlots = [
        ...(job.workerSlots||[]).filter(s=>s.assignedWorker&&!s.ratingSubmitted&&!['open','cancelled','not_required','reposted'].includes(s.status)).map(s=>({...s, _source:'slot'})),
        ...(job.subTasks||[]).filter(s=>s.assignedWorker&&!s.ratingSubmitted&&!['cancelled'].includes(s.status)).map(s=>({...s, _source:'subtask'})),
    ];

    const [idx, setIdx] = useState(0);
    const [stars, setStars] = useState(5); const [points, setPoints] = useState(50); const [msg, setMsg] = useState('');
    const [sub, setSub]     = useState(false);
    const [alert, setAlert] = useState({ m:'', t:'error' });

    if (unratedSlots.length === 0) {
        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center">
                    <div className="text-4xl mb-3">✅</div>
                    <h3 className="font-bold text-gray-900 mb-2">All Workers Rated</h3>
                    <button onClick={onClose} className="w-full py-3 bg-green-500 text-white rounded-xl font-bold mt-4">Done</button>
                </div>
            </div>
        );
    }

    const slot   = unratedSlots[idx];
    const worker = slot.assignedWorker;
    const wid    = (worker?._id||worker)?.toString();

    const handleSubmit = async () => {
        setAlert({ m:'', t:'error' });
        try {
            setSub(true);
            const payload = { workerId: wid, slotId: slot._source==='slot' ? slot._id : undefined, subTaskId: slot._source==='subtask' ? slot._id : undefined, skill: slot.skill, stars, points, message: msg };
            await submitRating(job._id, payload);
            onSlotRated(job._id, slot._id?.toString(), wid, slot._source);
            toast.success(`${slot.skill} rating submitted!`);
            if (idx < unratedSlots.length-1) { setIdx(i=>i+1); setStars(5); setPoints(50); setMsg(''); }
            else onClose();
        } catch (err) {
            const m = err?.response?.data?.message||'Failed.';
            if (err?.response?.status===409) { onSlotRated(job._id, slot._id?.toString(), wid, slot._source); if (idx<unratedSlots.length-1) setIdx(i=>i+1); else onClose(); }
            else setAlert({ m, t:'error' });
        } finally { setSub(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:rounded-2xl sm:max-w-md shadow-2xl">
                <div className="px-6 pt-6 pb-4 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="text-lg font-bold text-gray-900">Rate Worker</h3>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">{idx+1} of {unratedSlots.length}</span>
                    </div>
                    <p className="text-xs text-gray-400">Rate each worker individually for their assigned task</p>
                </div>
                <div className="px-6 py-5 space-y-4">
                    {unratedSlots.length > 1 && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Select Worker to Rate</label>
                            <div className="space-y-2">
                                {unratedSlots.map((s,i)=>{
                                    const w2=s.assignedWorker;
                                    return (
                                        <button key={s._id?.toString()||i} type="button" onClick={()=>{setIdx(i);setStars(5);setPoints(50);setMsg('');setAlert({m:'',t:'error'});}}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${i===idx?'border-orange-400 bg-orange-50':'border-gray-200 hover:border-gray-300'}`}>
                                            <img src={getImageUrl(w2?.photo)} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" onError={e=>{e.target.src='/admin.png'}}/>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-gray-800 truncate">{w2?.name||'Worker'}</p>
                                                <p className="text-xs text-gray-400 capitalize">{s.skill} · {s.hoursEstimated}h{s._source==='subtask'?' (sub-task)':''}</p>
                                            </div>
                                            {i===idx&&<span className="text-orange-500 text-sm font-bold flex-shrink-0">Rating →</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-3 bg-orange-50 border border-orange-100 rounded-xl p-3">
                        <img src={getImageUrl(worker?.photo)} alt={worker?.name} className="w-11 h-11 rounded-full object-cover flex-shrink-0" onError={e=>{e.target.src='/admin.png'}}/>
                        <div>
                            <p className="font-bold text-gray-800">{worker?.name||'Worker'}</p>
                            <p className="text-xs text-orange-600 capitalize font-medium">{slot.skill} · {slot.hoursEstimated}h{slot._source==='subtask'?' (sub-task)':''}</p>
                        </div>
                    </div>
                    {alert.m&&<Alert msg={alert.m} type={alert.t} onDismiss={()=>setAlert({m:'',t:'error'})}/>}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Rating <span className="text-red-500">*</span></label>
                        <div className="flex gap-2">{[1,2,3,4,5].map(s=><button key={s} onClick={()=>setStars(s)} className={`text-3xl transition-all ${s<=stars?'text-yellow-400':'text-gray-200'}`}>★</button>)}</div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Points: <span className="text-orange-600 font-bold">{points}</span> <span className="text-xs text-gray-400 font-normal">(20–100)</span></label>
                        <input type="range" min={20} max={100} value={points} onChange={e=>setPoints(Number(e.target.value))} className="w-full accent-orange-500"/>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Feedback <span className="text-gray-400 font-normal">(optional)</span></label>
                        <textarea rows={2} value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Great work…" className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400 resize-none"/>
                    </div>
                </div>
                <div className="px-6 pb-6 flex gap-3">
                    <button onClick={onClose} className="px-5 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50">Cancel</button>
                    <button onClick={handleSubmit} disabled={sub} className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold disabled:opacity-60 text-sm">
                        {sub?'Submitting…': idx<unratedSlots.length-1 ?'Submit & Next →':'Submit Rating'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Remove/Cancel Modals ───────────────────────────────────────────────────────
function RemoveModal({ job, slotId, workerId, workerName, skill, onClose, onRemoved }) {
    const [reason, setReason]=useState(''); const [loading, setLoading]=useState(false); const [alert, setAlert]=useState('');
    const handle = async()=>{ if(!reason.trim()){setAlert('Reason required.');return;} try{setLoading(true);const{data}=await removeAssignedWorker(job._id,workerId,reason,slotId);onRemoved(job._id,data.job);onClose();}catch(err){setAlert(err?.response?.data?.message||'Failed.');}finally{setLoading(false);}};
    return(<div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"><div className="bg-white w-full sm:rounded-2xl sm:max-w-md p-6 shadow-2xl" onClick={e=>e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Remove Worker</h3><p className="text-sm text-gray-500 mb-4">Remove <strong>{workerName}</strong> from <strong className="capitalize">{skill}</strong>?</p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4"><p className="text-sm text-amber-700">⚠️ Worker notified. Slot reopens.</p></div>
        {alert&&<div className="mb-4"><Alert msg={alert} type="error" onDismiss={()=>setAlert('')}/></div>}
        <label className="block text-sm font-semibold text-gray-700 mb-2">Reason <span className="text-red-500">*</span></label>
        <textarea rows={3} value={reason} onChange={e=>setReason(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-red-300 resize-none mb-5"/>
        <div className="flex gap-3"><button onClick={onClose} className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50">Cancel</button><button onClick={handle} disabled={loading||!reason.trim()} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold disabled:opacity-60">{loading?'Removing…':'Remove'}</button></div>
    </div></div>);
}

function CancelModal({ job, onClose, onCancelled }) {
    const [reason,setReason]=useState('');const [loading,setLoading]=useState(false);const [alert,setAlert]=useState('');
    const handle=async()=>{if(!reason.trim()){setAlert('Reason required.');return;}try{setLoading(true);await cancelJob(job._id,reason);onCancelled(job._id);onClose();}catch(err){setAlert(err?.response?.data?.message||'Failed.');}finally{setLoading(false);}};
    return(<div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"><div className="bg-white w-full sm:rounded-2xl sm:max-w-md p-6 shadow-2xl" onClick={e=>e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Cancel Job</h3><p className="text-sm text-gray-500 mb-4">"{job.title}"</p>
        {job.assignedTo?.length>0&&<div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4"><p className="text-sm text-amber-700">⚠️ {job.assignedTo.length} worker(s) notified.</p></div>}
        {alert&&<div className="mb-4"><Alert msg={alert} type="error" onDismiss={()=>setAlert('')}/></div>}
        <label className="block text-sm font-semibold text-gray-700 mb-2">Reason <span className="text-red-500">*</span></label>
        <textarea rows={3} value={reason} onChange={e=>setReason(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-red-300 resize-none mb-5"/>
        <div className="flex gap-3"><button onClick={onClose} className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50">Keep Job</button><button onClick={handle} disabled={loading||!reason.trim()} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold disabled:opacity-60">{loading?'Cancelling…':'Confirm'}</button></div>
    </div></div>);
}

// ─────────────────────────────────────────────────────────────────────────────
// PRE-START ALERT PANEL
// Shown when: job is 'scheduled', < 30 min to start, and unfilled slots exist
// ─────────────────────────────────────────────────────────────────────────────
function PreStartAlert({ job, onRepost, onDismiss }) {
    const unfilledSlots = (job.workerSlots||[]).filter(s => s.status === 'open');
    if (!unfilledSlots.length) return null;

    if (!job.scheduledDate || !job.scheduledTime) return null;
    const [h,m] = job.scheduledTime.split(':').map(Number);
    const sched = new Date(job.scheduledDate); sched.setHours(h,m,0,0);
    const minsLeft = (sched.getTime()-Date.now())/60000;
    if (minsLeft > 30 || minsLeft <= 0) return null;

    return (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">⚠️</span>
                <div>
                    <p className="font-bold text-red-800">Unfilled Positions — Job Starts Soon!</p>
                    <p className="text-xs text-red-600 mt-0.5">Job starts in ~{Math.max(1,Math.floor(minsLeft))} min. The following skills have no worker assigned:</p>
                </div>
            </div>

            <div className="space-y-2">
                {unfilledSlots.map(slot => (
                    <div key={slot._id?.toString()} className="bg-white border border-red-100 rounded-xl p-3 flex items-center justify-between gap-3">
                        <div>
                            <span className="font-bold text-gray-800 capitalize text-sm">{slot.skill}</span>
                            <span className="text-xs text-gray-400 ml-2">~{slot.hoursEstimated}h</span>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                            <button onClick={() => onRepost(slot)} className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold transition-colors">
                                📤 Repost
                            </button>
                            <button onClick={() => onDismiss(slot._id?.toString(), slot.skill)} className="text-xs px-3 py-1.5 border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50 font-bold transition-colors">
                                ✕ Not Needed
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <p className="text-xs text-red-500">
                <strong>Repost</strong> — creates a sub-task with a new start time so workers can still apply. <br/>
                <strong>Not Needed</strong> — mark this skill as not required and proceed without it.
            </p>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-TASKS PANEL — shown in expanded job card
// ─────────────────────────────────────────────────────────────────────────────
function SubTasksPanel({ job, onViewProfile, onAlert, onMarkDone, onRate }) {
    const subTasks = (job.subTasks||[]).filter(s => s.status !== 'cancelled');
    if (!subTasks.length) return null;

    return (
        <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Sub-tasks ({subTasks.filter(s=>s.status==='task_completed').length}/{subTasks.length} done)
            </p>
            <div className="space-y-2">
                {subTasks.map((sub, si) => {
                    const w   = sub.assignedWorker;
                    const wid = (w?._id||w)?.toString();
                    const pendingApps = sub.applicants?.filter(a=>a.status==='pending') || [];

                    return (
                        <div key={sub._id?.toString()||si} className="border border-purple-100 rounded-xl bg-purple-50/30 overflow-hidden">
                            {/* Sub-task header */}
                            <div className="flex items-center justify-between px-3 py-2.5 bg-purple-50 border-b border-purple-100">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-purple-700 capitalize">{sub.skill}</span>
                                    <span className="text-[10px] text-purple-400">~{sub.hoursEstimated}h</span>
                                    {sub.scheduledTime && <span className="text-[10px] text-purple-500">🕐 {sub.scheduledTime}</span>}
                                    {sub.scheduledDate  && <span className="text-[10px] text-purple-400">{new Date(sub.scheduledDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>}
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SLOT_SC[sub.status]||'bg-gray-100 text-gray-400'}`}>
                                    {sub.status === 'open' ? 'Open' : sub.status === 'scheduled' ? 'Scheduled' : sub.status === 'running' ? 'Running' : sub.status === 'task_completed' ? '✓ Done' : sub.status}
                                </span>
                            </div>

                            <div className="px-3 py-2 space-y-2">
                                {/* Assigned worker */}
                                {w && (
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => onViewProfile(wid)} className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 text-left">
                                            <img src={getImageUrl(w?.photo)} alt="" className="w-7 h-7 rounded-full object-cover border border-gray-200 flex-shrink-0" onError={e=>{e.target.src='/admin.png'}}/>
                                            <span className="text-xs font-semibold text-gray-700 truncate">{w?.name||'Worker'}</span>
                                        </button>
                                        <div className="flex gap-1 flex-shrink-0">
                                            {/* Rate then mark done */}
                                            {['running','scheduled'].includes(sub.status) && !sub.ratingSubmitted && job.completionPhotos?.length > 0 && (
                                                <button onClick={() => onRate(sub)} className="text-[10px] px-2 py-1 bg-yellow-400 hover:bg-yellow-500 text-white rounded font-bold">Rate</button>
                                            )}
                                            {['running','scheduled'].includes(sub.status) && sub.ratingSubmitted && (
                                                <button onClick={() => onMarkDone(sub._id?.toString())} className="text-[10px] px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded font-bold">Mark Done</button>
                                            )}
                                            {sub.ratingSubmitted && <span className="text-[10px] bg-yellow-100 text-yellow-600 px-1.5 py-0.5 rounded font-bold">⭐</span>}
                                        </div>
                                    </div>
                                )}

                                {!w && sub.status === 'open' && (
                                    <p className="text-xs text-gray-400 italic">Waiting for worker applications…</p>
                                )}

                                {/* Pending applicants for this sub-task */}
                                {pendingApps.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{pendingApps.length} applicant{pendingApps.length>1?'s':''}</p>
                                        {pendingApps.map(app => {
                                            const appWid = (app.workerId?._id||app.workerId)?.toString();
                                            return (
                                                <div key={app._id} className="flex items-center gap-2 mb-1.5">
                                                    <button onClick={() => onViewProfile(appWid)} className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 text-left">
                                                        <img src={getImageUrl(app.workerId?.photo)} alt="" className="w-7 h-7 rounded-full object-cover border border-gray-200 flex-shrink-0" onError={e=>{e.target.src='/admin.png'}}/>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-semibold text-gray-700 truncate">{app.workerId?.name||'Worker'}</p>
                                                            <p className="text-[10px] text-gray-400">🏆 {app.workerId?.points||0} pts</p>
                                                        </div>
                                                    </button>
                                                    <div className="flex gap-1 flex-shrink-0">
                                                        <button onClick={() => onAlert('subtask-accept', sub._id?.toString(), appWid)} className="text-[10px] px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded font-bold">Accept</button>
                                                        <button onClick={() => onAlert('subtask-reject', sub._id?.toString(), appWid)} className="text-[10px] px-2 py-1 border border-red-200 text-red-400 rounded hover:bg-red-50 font-bold">Reject</button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
const TABS    = ['open','scheduled','running','completed','cancelled','favourites'];
const TLABELS = { open:'Open', scheduled:'Scheduled', running:'Running', completed:'Completed', cancelled:'Cancelled', favourites:'⭐ Favourites' };

export default function ClientJobManage() {
    const [jobs,        setJobs]       = useState([]);
    const [loading,     setLoading]    = useState(true);
    const [tab,         setTab]        = useState('open');
    const [expanded,    setExpanded]   = useState(null);
    const [starredIds,  setStarredIds] = useState([]);
    const [cardAlerts,  setCardAlerts] = useState({});
    const [profileWid,  setProfileWid] = useState(null);
    const [ratingJob,   setRatingJob]  = useState(null);
    const [cancelModal, setCancelModal]= useState(null);
    const [removeData,  setRemoveData] = useState(null);
    const [repostData,  setRepostData] = useState(null); // { job, slot }
    const [uploadingPhotos, setUploadingPhotos] = useState({});
    const photoRef = useRef({});

    const setAlert   = (id, msg, type='error') => setCardAlerts(p=>({...p, [id]: { msg, type }}));
    const clearAlert = id => setCardAlerts(p=>{ const n={...p}; delete n[id]; return n; });

    const fetchJobs = async () => {
        try {
            setLoading(true);
            const { data } = await getClientJobs();
            setJobs(Array.isArray(data) ? data : []);
            const u = JSON.parse(localStorage.getItem('user')||'{}');
            setStarredIds(u.starredWorkers?.map(id=>id?.toString())||[]);
        } catch {} finally { setLoading(false); }
    };

    useEffect(() => { fetchJobs(); }, []);
    useEffect(() => { const t = setInterval(fetchJobs, 60000); return () => clearInterval(t); }, []);

    const tabJobs  = jobs.filter(j => { if(tab==='cancelled')return isCancelled(j.status); if(tab==='favourites')return false; return j.status===tab; });
    const tabCount = t => { if(t==='cancelled')return jobs.filter(j=>isCancelled(j.status)).length; if(t==='favourites')return starredIds.length; return jobs.filter(j=>j.status===t).length; };

    const handleStar = async wId => { try { const { data } = await toggleStarWorker(wId); setStarredIds(data.starredWorkers?.map(id=>id?.toString())||[]); } catch {} };

    const handleRespond = async (jobId, workerId, status, skill) => {
        if (!workerId||!status) return;
        try {
            const { data } = await respondToApplicant(jobId, { workerId, status, skill });
            setJobs(p=>p.map(j=>j._id===jobId?data.job:j));
            if (status==='accepted') setAlert(jobId, `Worker accepted as ${skill}! Slot assigned.`, 'success');
        } catch (err) { setAlert(jobId, err?.response?.data?.message||'Failed.', err?.response?.status===409?'warning':'error'); }
    };

    const handleSubTaskRespond = async (jobId, subTaskId, workerId, status) => {
        try {
            const { data } = await respondToSubTaskApplicant(jobId, { subTaskId, workerId, status });
            setJobs(p=>p.map(j=>j._id===jobId?data.job:j));
            if (status==='accepted') setAlert(jobId, 'Sub-task applicant accepted! They have been notified.', 'success');
        } catch (err) { setAlert(jobId, err?.response?.data?.message||'Failed.', err?.response?.status===409?'warning':'error'); }
    };

    const handleMarkSlotDone = async (jobId, workerId, slotId, skill) => {
        if (!window.confirm(`Mark ${skill} task complete? The worker will be freed.`)) return;
        try {
            const { data } = await completeWorkerTask(jobId, workerId, slotId);
            setJobs(p=>p.map(j=>j._id===jobId?data.job:j));
            setAlert(jobId, `${skill} task done. Worker is free.`, 'success');
        } catch (err) { setAlert(jobId, err?.response?.data?.message||'Failed.'); }
    };

    const handleMarkSubTaskDone = async (jobId, subTaskId) => {
        if (!window.confirm('Mark this sub-task complete?')) return;
        try {
            const { data } = await completeSubTask(jobId, subTaskId);
            setJobs(p=>p.map(j=>j._id===jobId?data.job:j));
            setAlert(jobId, 'Sub-task marked complete.', 'success');
        } catch (err) { setAlert(jobId, err?.response?.data?.message||'Failed.'); }
    };

    const handleStartJob = async jobId => {
        try {
            const { data } = await startJob(jobId);
            setJobs(p=>p.map(j=>j._id===jobId?data.job:j));
            setAlert(jobId, 'Job started! Workers notified.', 'success');
        } catch (err) { setAlert(jobId, err?.response?.data?.message||'Cannot start yet.'); }
    };

    const handleMarkComplete = async jobId => {
        try {
            const { data } = await updateJobStatus(jobId, 'completed');
            setJobs(p=>p.map(j=>j._id===jobId?data.job:j));
            setAlert(jobId, 'Job complete!', 'success');
        } catch (err) { setAlert(jobId, err?.response?.data?.message||'Failed.'); }
    };

    const handleUploadPhotos = async (jobId, files) => {
        try {
            setUploadingPhotos(p=>({...p,[jobId]:true}));
            const fd = new FormData(); Array.from(files).forEach(f=>fd.append('photos',f));
            const { data } = await uploadCompletionPhotos(jobId, fd);
            setJobs(p=>p.map(j=>j._id===jobId?{...j,completionPhotos:data.completionPhotos}:j));
            setAlert(jobId, `${files.length} photo(s) uploaded. Now rate each worker.`, 'success');
        } catch (err) { setAlert(jobId, err?.response?.data?.message||'Upload failed.'); }
        finally { setUploadingPhotos(p=>({...p,[jobId]:false})); }
    };

    const handleDelete = async id => {
        if (!window.confirm('Delete permanently?')) return;
        try { await deleteClientJob(id); setJobs(p=>p.filter(j=>j._id!==id)); }
        catch (err) { setAlert(id, err?.response?.data?.message||'Failed.'); }
    };

    // Dismiss a missing skill slot
    const handleDismissSkill = async (jobId, slotId, skillName) => {
        if (!window.confirm(`Mark "${skillName}" as not required? This slot will be closed.`)) return;
        try {
            const { data } = await dismissMissingSkill(jobId, slotId);
            setJobs(p=>p.map(j=>j._id===jobId?data.job:j));
            setAlert(jobId, `${skillName} marked as not required.`, 'success');
        } catch (err) { setAlert(jobId, err?.response?.data?.message||'Failed.'); }
    };

    const handleSlotRated = (jobId, slotId, workerId, source) => {
        setJobs(p=>p.map(j=>{
            if (j._id!==jobId) return j;
            if (source==='subtask') {
                const subs = (j.subTasks||[]).map(s=>s._id?.toString()===slotId?{...s,ratingSubmitted:true}:s);
                return {...j, subTasks: subs};
            }
            const slots = (j.workerSlots||[]).map(s=>s._id?.toString()===slotId?{...s,ratingSubmitted:true}:s);
            return {...j, workerSlots: slots};
        }));
    };

    if (loading) return <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"/></div>;

    return (
        <div className="max-w-4xl mx-auto p-4 pb-20 space-y-4">
            <h1 className="text-2xl font-black text-gray-900">Manage Jobs</h1>

            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                {TABS.map(t=>(
                    <button key={t} onClick={()=>setTab(t)} className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${tab===t?'bg-orange-500 text-white':'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        {TLABELS[t]}{tabCount(t)>0&&<span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab===t?'bg-white/25 text-white':'bg-gray-200 text-gray-500'}`}>{tabCount(t)}</span>}
                    </button>
                ))}
            </div>

            {/* Favourites */}
            {tab==='favourites' && (
                <div>{starredIds.length===0
                    ?<div className="text-center py-16 text-gray-400"><div className="text-5xl mb-3">⭐</div><p className="font-semibold">No favourite workers</p></div>
                    :<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{starredIds.map(wid=>(<div key={wid} onClick={()=>setProfileWid(wid)} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow"><div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl">👷</div><div className="flex-1"><p className="text-sm font-semibold text-gray-700">Starred Worker</p><p className="text-xs text-gray-400">Tap to view profile</p></div><button onClick={e=>{e.stopPropagation();handleStar(wid);}} className="text-yellow-400 text-xl">★</button></div>))}</div>
                }</div>
            )}

            {/* Job cards */}
            {tab!=='favourites' && (
                <>{tabJobs.length===0
                    ?<div className="text-center py-16 text-gray-400"><div className="text-5xl mb-3">📋</div><p className="font-semibold">No {tab} jobs</p></div>
                    :<div className="space-y-3">{tabJobs.map(job=>{
                        const isExp        = expanded===job._id;
                        const cAlert       = cardAlerts[job._id];
                        const hasPhotos    = job.completionPhotos?.length>0;
                        const startInfo    = { canStart: true }; // useStartCountdown is inside JobCard

                        const assignedSlots = (job.workerSlots||[]).filter(s=>s.assignedWorker&&!['open','cancelled','not_required','reposted'].includes(s.status));
                        const subTaskSlots  = (job.subTasks||[]).filter(s=>s.assignedWorker&&!['cancelled'].includes(s.status));
                        const unratedSlots  = [...assignedSlots.filter(s=>!s.ratingSubmitted), ...subTaskSlots.filter(s=>!s.ratingSubmitted)];
                        const allRated      = (assignedSlots.length+subTaskSlots.length)>0 && unratedSlots.length===0;

                        const totalSlots  = (job.workerSlots||[]).length;
                        const openSlots   = (job.workerSlots||[]).filter(s=>s.status==='open').length;
                        const filledSlots = (job.workerSlots||[]).filter(s=>s.status==='filled').length;
                        const doneSlots   = (job.workerSlots||[]).filter(s=>s.status==='task_completed').length;
                        const pending     = (job.applicants||[]).filter(a=>a.status==='pending');
                        const bySkill     = {}; pending.forEach(a=>{const sk=a.skill||'general';if(!bySkill[sk])bySkill[sk]=[];bySkill[sk].push(a);});
                        const openBySkill = {}; (job.workerSlots||[]).filter(s=>s.status==='open').forEach(s=>{openBySkill[s.skill]=(openBySkill[s.skill]||0)+1;});

                        return(
                            <div key={job._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                <JobCardHeader job={job} isExpanded={isExp} onExpand={()=>setExpanded(isExp?null:job._id)} openSlots={openSlots} filledSlots={filledSlots} doneSlots={doneSlots} totalSlots={totalSlots} pending={pending} unratedSlots={unratedSlots} />

                                {isExp&&(
                                    <div className="border-t border-gray-50 px-5 pb-5 pt-4 space-y-4">
                                        {cAlert?.msg&&<Alert msg={cAlert.msg} type={cAlert.type} onDismiss={()=>clearAlert(job._id)}/>}
                                        <p className="text-sm text-gray-600 leading-relaxed">{job.description}</p>

                                        {isCancelled(job.status)&&job.cancellationReason&&(
                                            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                                                <p className="text-xs font-bold text-red-700">Cancelled{job.cancelledAt?` on ${new Date(job.cancelledAt).toLocaleDateString('en-IN')}`:''}</p>
                                                <p className="text-xs text-red-600 mt-1">Reason: {job.cancellationReason}</p>
                                            </div>
                                        )}

                                        {/* ── PRE-START ALERT ── */}
                                        <PreStartAlert
                                            job={job}
                                            onRepost={slot => setRepostData({ job, slot })}
                                            onDismiss={(slotId, skill) => handleDismissSkill(job._id, slotId, skill)}
                                        />

                                        {/* ── WORKER SLOTS ── */}
                                        {(job.workerSlots||[]).length>0&&(
                                            <div>
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Worker Slots ({doneSlots}/{totalSlots} complete)</p>
                                                <div className="space-y-2">
                                                    {job.workerSlots.map((slot,si)=>{
                                                        const w   = slot.assignedWorker;
                                                        const wid = (w?._id||w)?.toString();
                                                        return(
                                                            <div key={slot._id?.toString()||si} className="flex items-center gap-2 bg-gray-50 rounded-xl p-3 border border-gray-100">
                                                                <div className="flex-shrink-0 w-[72px]">
                                                                    <span className="text-xs font-bold text-gray-700 capitalize block">{slot.skill}</span>
                                                                    <span className="text-[10px] text-gray-400">{slot.hoursEstimated}h est.</span>
                                                                </div>
                                                                {w ? (
                                                                    <button onClick={()=>setProfileWid(wid)} className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 text-left">
                                                                        <img src={getImageUrl(w?.photo)} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-200 flex-shrink-0" onError={e=>{e.target.src='/admin.png'}}/>
                                                                        <div className="min-w-0"><span className="text-xs font-semibold text-gray-800 truncate block">{w?.name||'Worker'}</span>{w?.mobile&&<span className="text-[10px] text-gray-400">📞 {w.mobile}</span>}</div>
                                                                    </button>
                                                                ) : (
                                                                    <span className="flex-1 text-xs text-gray-400 italic">
                                                                        {slot.status==='not_required'?'Not required':slot.status==='reposted'?'→ Sub-task created':'No worker assigned'}
                                                                    </span>
                                                                )}
                                                                <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SLOT_SC[slot.status]||'bg-gray-100 text-gray-400'}`}>
                                                                        {slot.status==='open'?'Open':slot.status==='filled'?'Assigned':slot.status==='task_completed'?'✓ Done':slot.status==='not_required'?'Not Needed':slot.status==='reposted'?'Reposted':'Cancelled'}
                                                                    </span>
                                                                    {slot.ratingSubmitted&&<span className="text-[10px] bg-yellow-100 text-yellow-600 px-1.5 py-0.5 rounded-full font-bold">⭐</span>}
                                                                    {job.status==='running'&&slot.status==='filled'&&wid&&(
                                                                        <button onClick={()=>handleMarkSlotDone(job._id,wid,slot._id?.toString(),slot.skill)} className="text-[10px] px-2.5 py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition-colors">Mark Done</button>
                                                                    )}
                                                                    {['open','scheduled'].includes(job.status)&&slot.status==='filled'&&wid&&(
                                                                        <button onClick={()=>setRemoveData({job,slotId:slot._id?.toString(),workerId:wid,workerName:w?.name,skill:slot.skill})} className="text-[10px] px-2 py-1 border border-red-200 text-red-400 rounded-lg hover:bg-red-50 font-bold transition-colors">Remove</button>
                                                                    )}
                                                                    {job.status==='completed'&&wid&&(
                                                                        <button onClick={()=>handleStar(wid)} className={`text-[10px] px-2 py-1 rounded-lg font-bold border ${starredIds.includes(wid)?'bg-yellow-50 border-yellow-200 text-yellow-600':'border-gray-200 text-gray-400 hover:border-yellow-200'}`}>{starredIds.includes(wid)?'★':'☆'}</button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* ── SUB-TASKS PANEL ── */}
                                        <SubTasksPanel
                                            job={job}
                                            onViewProfile={setProfileWid}
                                            onAlert={(type, subTaskId, workerId) => {
                                                const status = type === 'subtask-accept' ? 'accepted' : 'rejected';
                                                handleSubTaskRespond(job._id, subTaskId, workerId, status);
                                            }}
                                            onMarkDone={subTaskId => handleMarkSubTaskDone(job._id, subTaskId)}
                                            onRate={sub => setRatingJob({ ...job, _ratingSubTask: sub })}
                                        />

                                        {/* ── APPLICANTS ── */}
                                        {['open','scheduled'].includes(job.status)&&(
                                            <div>
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Applicants ({pending.length} pending)</p>
                                                {pending.length===0?<p className="text-xs text-gray-400 text-center py-3">No pending applicants.</p>:(
                                                    Object.entries(bySkill).map(([sk,apps])=>(
                                                        <div key={sk} className="mb-4">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="text-xs font-bold bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full capitalize">{sk}</span>
                                                                {openBySkill[sk]?<span className="text-xs text-gray-400">{openBySkill[sk]} slot{openBySkill[sk]>1?'s':''} open</span>:<span className="text-xs text-red-400 font-medium">All slots filled</span>}
                                                            </div>
                                                            <div className="space-y-2">
                                                                {apps.map(app=>{
                                                                    const wId=(app.workerId?._id||app.workerId)?.toString();
                                                                    return(
                                                                        <div key={app._id} className={`flex items-center gap-3 rounded-xl p-3 ${!openBySkill[sk]?'bg-gray-50 opacity-70':'bg-gray-50'}`}>
                                                                            <button onClick={()=>setProfileWid(wId)} className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 text-left">
                                                                                <img src={getImageUrl(app.workerId?.photo)} alt="" className="w-9 h-9 rounded-full object-cover border border-gray-200 flex-shrink-0" onError={e=>{e.target.src='/admin.png'}}/>
                                                                                <div className="min-w-0"><p className="text-sm font-bold text-gray-800 truncate">{app.workerId?.name||'Worker'}</p><p className="text-xs text-gray-400">🏆 {app.workerId?.points||0} pts · {sk}</p></div>
                                                                            </button>
                                                                            <div className="flex gap-1.5 flex-shrink-0">
                                                                                <button onClick={()=>handleRespond(job._id,wId,'accepted',sk)} disabled={!openBySkill[sk]} className="text-xs px-2.5 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Accept</button>
                                                                                <button onClick={()=>handleRespond(job._id,wId,'rejected',sk)} className="text-xs px-2.5 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 font-bold transition-colors">Reject</button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}

                                        {/* ── COMPLETION FLOW ── */}
                                        {job.status==='running'&&(
                                            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
                                                <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Completion Steps</p>
                                                <div className={`flex items-center gap-3 p-3 rounded-xl border ${hasPhotos?'bg-green-50 border-green-200':'bg-white border-gray-200'}`}>
                                                    <span className="text-lg flex-shrink-0">{hasPhotos?'✅':'1️⃣'}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-sm font-semibold ${hasPhotos?'text-green-700':'text-gray-700'}`}>Upload Completion Photos</p>
                                                        {hasPhotos?<p className="text-xs text-green-600">{job.completionPhotos.length} photo(s) uploaded</p>:<p className="text-xs text-gray-400">Required before rating</p>}
                                                    </div>
                                                    {!hasPhotos&&(<>
                                                        <input ref={el=>{photoRef.current[job._id]=el;}} type="file" multiple accept="image/*" className="hidden" onChange={e=>handleUploadPhotos(job._id,e.target.files)}/>
                                                        <button onClick={()=>photoRef.current[job._id]?.click()} disabled={uploadingPhotos[job._id]} className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold flex-shrink-0 disabled:opacity-60 transition-colors">{uploadingPhotos[job._id]?'Uploading…':'+ Upload'}</button>
                                                    </>)}
                                                </div>
                                                <div className={`flex items-start gap-3 p-3 rounded-xl border ${!hasPhotos?'opacity-50 pointer-events-none bg-white border-gray-100':allRated?'bg-green-50 border-green-200':'bg-white border-gray-200'}`}>
                                                    <span className="text-lg flex-shrink-0 mt-0.5">{allRated?'✅':'2️⃣'}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-sm font-semibold ${allRated?'text-green-700':'text-gray-700'}`}>Rate Each Worker <span className="text-red-500">*</span></p>
                                                        <div className="mt-2 space-y-1.5">
                                                            {[...assignedSlots,...subTaskSlots].map((slot,i)=>{
                                                                const w=(slot.assignedWorker?._id||slot.assignedWorker);
                                                                return(
                                                                    <div key={slot._id?.toString()||i} className="flex items-center gap-2">
                                                                        <img src={getImageUrl(slot.assignedWorker?.photo)} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" onError={e=>{e.target.src='/admin.png'}}/>
                                                                        <span className="text-xs text-gray-600 flex-1 capitalize">{slot.assignedWorker?.name||'Worker'} — {slot.skill}{(job.subTasks||[]).some(s=>s._id?.toString()===slot._id?.toString())?<span className="text-[10px] text-purple-400 ml-1">(sub-task)</span>:null}</span>
                                                                        {slot.ratingSubmitted?<span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-bold flex-shrink-0">⭐ Rated</span>:<span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-medium flex-shrink-0">Not rated</span>}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        {!allRated&&<p className="text-xs text-gray-400 mt-1.5">{unratedSlots.length} worker(s) not yet rated</p>}
                                                    </div>
                                                    {hasPhotos&&!allRated&&<button onClick={()=>setRatingJob(job)} className="text-xs px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-white rounded-lg font-bold flex-shrink-0 mt-0.5 transition-colors">Rate Workers</button>}
                                                </div>
                                                <div className={`flex items-center gap-3 p-3 rounded-xl border ${(!hasPhotos||!allRated)?'opacity-50 pointer-events-none bg-white border-gray-100':'bg-white border-orange-200'}`}>
                                                    <span className="text-lg flex-shrink-0">3️⃣</span>
                                                    <div className="flex-1"><p className="text-sm font-semibold text-gray-700">Mark Job Complete</p>{(!hasPhotos||!allRated)&&<p className="text-xs text-gray-400">{!hasPhotos?'Upload photos first':'Rate all workers first'}</p>}</div>
                                                    <button onClick={()=>handleMarkComplete(job._id)} disabled={!hasPhotos||!allRated} className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Complete</button>
                                                </div>
                                            </div>
                                        )}

                                        {/* ── ACTIONS ── */}
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            {job.status==='scheduled'&&<StartButton job={job} onStart={handleStartJob}/>}
                                            {['open','scheduled'].includes(job.status)&&<button onClick={()=>setCancelModal(job)} className="px-4 py-2.5 border-2 border-red-200 text-red-500 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors">✕ Cancel</button>}
                                            {job.status==='open'&&<button onClick={()=>handleDelete(job._id)} className="px-4 py-2.5 border-2 border-red-200 text-red-500 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors">🗑 Delete</button>}
                                        </div>
                                        {job.status==='running'&&<div className="bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-2.5"><p className="text-xs text-yellow-700 font-medium">🔒 Running: Mark each worker done → Upload photos → Rate workers → Mark complete</p></div>}
                                    </div>
                                )}
                            </div>
                        );
                    })}</div>
                }</>
            )}

            {/* Modals */}
            {profileWid  && <WorkerModal workerId={profileWid} onClose={()=>setProfileWid(null)} onStar={handleStar} starredIds={starredIds}/>}
            {ratingJob   && <SlotRatingModal job={ratingJob} onClose={()=>setRatingJob(null)} onSlotRated={handleSlotRated}/>}
            {cancelModal && <CancelModal job={cancelModal} onClose={()=>setCancelModal(null)} onCancelled={id=>setJobs(p=>p.map(j=>j._id===id?{...j,status:'cancelled_by_client'}:j))}/>}
            {removeData  && <RemoveModal {...removeData} onClose={()=>setRemoveData(null)} onRemoved={(jobId,updatedJob)=>setJobs(p=>p.map(j=>j._id===jobId?updatedJob:j))}/>}
            {repostData  && <RepostModal job={repostData.job} slot={repostData.slot} onClose={()=>setRepostData(null)} onReposted={(jobId,updatedJob)=>setJobs(p=>p.map(j=>j._id===jobId?updatedJob:j))}/>}
        </div>
    );
}

// ── Small extracted components ─────────────────────────────────────────────────
function JobCardHeader({ job, isExpanded, onExpand, openSlots, filledSlots, doneSlots, totalSlots, pending, unratedSlots }) {
    const startInfo = useStartCountdown(job);
    return (
        <div className="flex items-start gap-3 p-5 cursor-pointer hover:bg-gray-50/40 transition-colors" onClick={onExpand}>
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-gray-900 text-base leading-snug truncate">{job.title}</h3>
                    <SBadge status={job.status}/>
                </div>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap text-sm">
                    <span className="font-bold text-green-600">₹{job.payment?.toLocaleString()}</span>
                    {job.location?.city&&<span className="text-gray-400 text-xs">📍 {job.location.city}</span>}
                    {job.scheduledDate&&<span className="text-gray-400 text-xs">📅 {new Date(job.scheduledDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}{job.scheduledTime&&` ${job.scheduledTime}`}</span>}
                </div>
                {totalSlots>0&&(
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
                        {openSlots>0&&<span className="text-gray-400">{openSlots} open</span>}
                        {filledSlots>0&&<span className="text-blue-500">● {filledSlots} assigned</span>}
                        {doneSlots>0&&<span className="text-green-500">✓ {doneSlots} done</span>}
                        {pending.length>0&&<span className="text-orange-500">👥 {pending.length} pending</span>}
                        {job.status==='running'&&unratedSlots.length>0&&<span className="text-purple-500">⭐ {unratedSlots.length} to rate</span>}
                        {job.status==='scheduled'&&!startInfo.canStart&&<span className="text-blue-400 font-mono">⏰ {startInfo.remaining}</span>}
                        {/* Pre-start alert indicator */}
                        {job.status==='scheduled'&&(job.workerSlots||[]).some(s=>s.status==='open')&&!startInfo.canStart&&startInfo.remaining!=='00:00:00'&&(
                            <span className="text-red-500 font-bold text-[10px] bg-red-50 px-2 py-0.5 rounded-full">⚠️ Unfilled slots</span>
                        )}
                    </div>
                )}
                {(job.subTasks||[]).filter(s=>!['cancelled'].includes(s.status)).length>0&&(
                    <span className="text-[10px] text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded-full mt-1 inline-block">
                        📤 {(job.subTasks||[]).filter(s=>!['cancelled'].includes(s.status)).length} sub-task(s)
                    </span>
                )}
            </div>
            <span className="text-gray-300 flex-shrink-0 mt-1">{isExpanded?'▲':'▼'}</span>
        </div>
    );
}

function StartButton({ job, onStart }) {
    const startInfo = useStartCountdown(job);
    return (
        <button onClick={() => onStart(job._id)} disabled={!startInfo.canStart}
            className={`flex-1 min-w-[140px] py-2.5 rounded-xl font-bold text-sm transition-colors ${startInfo.canStart?'bg-blue-600 hover:bg-blue-700 text-white':'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
            {startInfo.canStart ? '🚀 Start Job' : `⏰ ${startInfo.remaining}`}
        </button>
    );
}
