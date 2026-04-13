import { useEffect, useMemo, useState } from 'react';
import { getClientJobs, getImageUrl } from '../../api/index';
import { Calendar, Clock, MapPin, Users, Briefcase, IndianRupee, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { openWorkerProfilePreview } from '../../utils/workerProfilePreview';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const fmtINR = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n || 0));

const statusBadge = (status) => {
    if (status === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return 'bg-red-50 text-red-700 border-red-200';
};

export default function ClientHistory() {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [previewPhoto, setPreviewPhoto] = useState('');

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const { data } = await getClientJobs();
                if (!active) return;
                setJobs(Array.isArray(data) ? data : []);
            } catch {
                if (!active) return;
                toast.error('Failed to load history');
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, []);

    const historyJobs = useMemo(() => (
        jobs.filter((job) => ['completed', 'cancelled', 'cancelled_by_client'].includes(job.status) || job.archivedByClient)
    ), [jobs]);

    if (loading) {
        return <div className="max-w-6xl mx-auto px-4 py-10 text-sm text-gray-500">Loading history...</div>;
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-6 pb-24 space-y-4">
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-3xl p-6 text-white">
                <h1 className="text-3xl font-black">Job History</h1>
                <p className="text-sm text-orange-100 mt-1">Completed, cancelled and deleted jobs with assigned worker details</p>
            </div>

            {historyJobs.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-500">No history records found.</div>
            ) : (
                historyJobs.map((job) => {
                    const assignedWorkers = (job.workerSlots || []).filter((slot) => slot.assignedWorker).map((slot) => ({
                        skill: slot.skill,
                        worker: slot.assignedWorker,
                        slot,
                    }));

                    const submittedRatings = Array.isArray(job.submittedRatings) ? job.submittedRatings : [];

                    const getRatingsForSlot = (slot, workerId) => submittedRatings.filter((rating) => {
                        const sameWorker = String(rating?.worker?._id || rating?.worker || '') === String(workerId || '');
                        const sameSlot = slot?._id && rating?.slotId ? String(rating.slotId) === String(slot._id) : false;
                        const sameSkill = (rating?.skill || '').toLowerCase() === (slot?.skill || '').toLowerCase();
                        return sameWorker && (sameSlot || sameSkill);
                    });

                    const budgetText = job.negotiable
                        ? `${fmtINR(job.payment)} (Negotiable, Min ${fmtINR(job.minBudget)})`
                        : `${fmtINR(job.payment)} (Fixed)`;

                    const completedAt = job.actualEndTime
                        || (job.workerSlots || []).reduce((latest, slot) => {
                            const candidate = slot?.actualEndTime || slot?.completedAt;
                            if (!candidate) return latest;
                            if (!latest) return candidate;
                            return new Date(candidate) > new Date(latest) ? candidate : latest;
                        }, null);

                    return (
                        <div key={job._id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                            {job.photos?.length > 0 && (
                                <div className="px-4 pt-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {job.photos.slice(0, 4).map((p, i) => (
                                            <img key={i} src={getImageUrl(p)} alt="" className="w-full h-24 object-cover rounded-xl border border-gray-200" />
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-black text-gray-900">{job.title}</h2>
                                        <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                                            <span className="inline-flex items-center gap-1"><IndianRupee size={12} />{fmtINR(job.payment)}</span>
                                            <span className="inline-flex items-center gap-1"><MapPin size={12} />{job.location?.city || '—'}</span>
                                            <span className="inline-flex items-center gap-1"><Calendar size={12} />{fmtDate(job.scheduledDate)}</span>
                                            <span className="inline-flex items-center gap-1"><Clock size={12} />{job.scheduledTime || '—'}</span>
                                        </div>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full border text-xs font-bold ${statusBadge(job.status)}`}>
                                        {job.status === 'completed' ? 'Completed' : (job.archivedByClient ? 'Deleted' : 'Cancelled')}
                                    </span>
                                </div>

                                <p className="text-sm text-gray-600 mt-3 leading-relaxed">{job.description}</p>

                                {(job.completionPhotos || []).length > 0 && (
                                    <div className="mt-4">
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Job Completion Photos</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {job.completionPhotos.slice(0, 8).map((p, i) => (
                                                <img
                                                    key={`done-${i}`}
                                                    src={getImageUrl(p)}
                                                    alt="Completion"
                                                    className="w-full h-24 object-cover rounded-xl border border-gray-200 cursor-zoom-in"
                                                    onClick={() => setPreviewPhoto(getImageUrl(p))}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-3">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Full Job Details</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                        <p><span className="text-gray-500">Posted:</span> <span className="font-semibold text-gray-800">{fmtDateTime(job.createdAt)}</span></p>
                                        <p><span className="text-gray-500">Scheduled:</span> <span className="font-semibold text-gray-800">{fmtDate(job.scheduledDate)} {job.scheduledTime || ''}</span></p>
                                        <p><span className="text-gray-500">Completed/Closed:</span> <span className="font-semibold text-gray-800">{fmtDateTime(completedAt || job.updatedAt)}</span></p>
                                        <p><span className="text-gray-500">Duration:</span> <span className="font-semibold text-gray-800">{job.duration || '—'}</span></p>
                                        <p className="sm:col-span-2"><span className="text-gray-500">Budget:</span> <span className="font-semibold text-gray-800">{budgetText}</span></p>
                                        <p className="sm:col-span-2"><span className="text-gray-500">Skills:</span> <span className="font-semibold text-gray-800">{(job.skills || []).length ? job.skills.join(', ') : '—'}</span></p>
                                    </div>
                                </div>

                                {(job.qaAnswers || []).length > 0 && (
                                    <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-3">
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Questions & Answers</p>
                                        <div className="space-y-2">
                                            {job.qaAnswers.map((qa, idx) => (
                                                <div key={idx} className="text-sm">
                                                    <p className="text-gray-700 font-semibold">Q: {qa.question}</p>
                                                    <p className="text-gray-600">A: {qa.answer}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="mt-4">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 inline-flex items-center gap-1"><Users size={12} />Assigned Workers</p>
                                    {assignedWorkers.length === 0 ? (
                                        <p className="text-sm text-gray-500">No assigned workers.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {assignedWorkers.map(({ skill, worker, slot }, index) => {
                                                const workerRatings = getRatingsForSlot(slot, worker?._id);
                                                return (
                                                <div key={`${job._id}-${index}`} className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-2">
                                                        <img src={getImageUrl(worker?.photo)} alt="" className="w-9 h-9 rounded-full object-cover border border-white" />
                                                        <div>
                                                            <button
                                                                type="button"
                                                                className="text-sm font-bold text-gray-900 hover:text-orange-600 transition-colors"
                                                                onClick={() => openWorkerProfilePreview(worker?._id || worker?.karigarId)}
                                                            >
                                                                {worker?.name || 'Worker'}
                                                            </button>
                                                            <p className="text-xs text-orange-600 capitalize">{skill}</p>
                                                        </div>
                                                    </div>
                                                        <span className="text-xs text-gray-500">{worker?.mobile || 'No contact'}</span>
                                                    </div>
                                                    {workerRatings.length > 0 ? (
                                                        <div className="mt-2 pt-2 border-t border-orange-200 space-y-1">
                                                            {workerRatings.map((rating, rIdx) => (
                                                                <div key={`${job._id}-${index}-rating-${rIdx}`} className="text-xs text-gray-700">
                                                                    <p><span className="font-semibold">Rating:</span> {rating.stars}/5 stars · {rating.points} points · {fmtDateTime(rating.createdAt)}</p>
                                                                    {rating.message ? <p className="text-gray-600">Feedback: {rating.message}</p> : null}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="mt-2 pt-2 border-t border-orange-200 text-xs text-gray-500">No rating submitted for this worker slot.</p>
                                                    )}
                                                </div>
                                            )})}
                                        </div>
                                    )}
                                </div>

                                {job.status === 'completed' ? (
                                    <div className="mt-4 text-xs text-emerald-700 inline-flex items-center gap-1"><CheckCircle size={12} />Completed on {fmtDateTime(completedAt || job.updatedAt)}</div>
                                ) : (
                                    <div className="mt-4 text-xs text-red-700 inline-flex items-center gap-1"><XCircle size={12} />{job.cancellationReason || 'Cancelled/Deleted by client'}</div>
                                )}
                            </div>
                        </div>
                    );
                })
            )}

            {previewPhoto && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setPreviewPhoto('')}
                >
                    <button
                        type="button"
                        className="absolute top-4 right-4 bg-white text-gray-800 px-3 py-1 rounded-lg text-sm font-semibold"
                        onClick={() => setPreviewPhoto('')}
                    >
                        Close
                    </button>
                    <img
                        src={previewPhoto}
                        alt="Completion Preview"
                        className="max-w-full max-h-[90vh] rounded-xl shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}
