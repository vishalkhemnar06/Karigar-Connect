// client/src/pages/worker/DirectInvites.jsx  
// Direct employment invites from clients

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MapPin, Clock, IndianRupee, Phone,
    CheckCircle, XCircle, RefreshCw,
    Sparkles, Calendar, Briefcase, Zap, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getImageUrl, getDirectInvites, getWorkerDirectHires, acceptDirectInvite, rejectDirectInvite } from '../../api/index';

export default function DirectInvites() {
    const [invites, setInvites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedInvite, setSelectedInvite] = useState(null);
    const [responding, setResponding] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    const [filter, setFilter] = useState('all'); // 'all', 'pending', 'viewed'
    const [directHires, setDirectHires] = useState([]);
    const [directHireLoading, setDirectHireLoading] = useState(false);

    useEffect(() => {
        loadInvites();
    }, []);

    useEffect(() => {
        if (filter !== 'direct-hired' || directHires.length) return;
        loadDirectHires();
    }, [filter]);

    useEffect(() => {
        setShowDetails(false);
    }, [selectedInvite?.jobId]);

    const formatLocation = (location = {}) => {
        const fullAddress = String(location?.fullAddress || '').trim();
        if (fullAddress) return fullAddress;
        const parts = [location?.locality, location?.city, location?.state, location?.pincode]
            .map((part) => String(part || '').trim())
            .filter(Boolean);
        return parts.join(', ') || 'Not specified';
    };

    const formatCommute = (commute) => {
        if (!commute) return 'Distance unavailable';
        if (!commute.available) return 'Location unavailable';
        const distance = commute.distanceText || `${Number(commute.distanceKm || 0).toFixed(1)} km`;
        const eta = commute.etaText ? `ETA ${commute.etaText}` : '';
        return [distance, eta].filter(Boolean).join(' • ');
    };

    const commuteTone = (commute) => {
        if (!commute?.available) return 'text-gray-500';
        if (commute.distanceColor === 'green') return 'text-emerald-700';
        if (commute.distanceColor === 'yellow') return 'text-amber-700';
        return 'text-red-600';
    };

    const loadInvites = async () => {
        try {
            setLoading(true);
            const { data } = await getDirectInvites();
            setInvites(data.invites || []);
        } catch (err) {
            console.error('Failed to load invites:', err);
            toast.error('Failed to load direct invites');
        } finally {
            setLoading(false);
        }
    };

    const loadDirectHires = async () => {
        try {
            setDirectHireLoading(true);
            const { data } = await getWorkerDirectHires();
            setDirectHires(data.jobs || []);
        } catch (err) {
            console.error('Failed to load direct hires:', err);
            toast.error('Failed to load direct hired jobs');
        } finally {
            setDirectHireLoading(false);
        }
    };

    const handleAccept = async (jobId) => {
        try {
            setResponding(jobId);
            const { data } = await acceptDirectInvite(jobId);
            toast.success(data.message || 'Invite accepted!');
            setInvites(invites.filter(i => i.jobId !== jobId));
            setSelectedInvite(null);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to accept invite');
        } finally {
            setResponding(null);
        }
    };

    const handleReject = async (jobId) => {
        try {
            setResponding(jobId);
            const { data } = await rejectDirectInvite(jobId);
            toast.success(data.message || 'Invite rejected');
            setInvites(invites.filter(i => i.jobId !== jobId));
            setSelectedInvite(null);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to reject invite');
        } finally {
            setResponding(null);
        }
    };

    const filtered = invites.filter(i => {
        if (filter === 'pending') return !i.hasApplied;
        if (filter === 'viewed') return i.hasApplied;
        return true;
    });
    const isDirectHiredTab = filter === 'direct-hired';

    const pendingCount = invites.filter(i => !i.hasApplied).length;
    const appliedCount = invites.filter(i => i.hasApplied).length;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full"
                />
                <p className="mt-4 text-gray-500 font-semibold text-sm">Loading direct invites...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/20 pb-20">
            <div className="max-w-5xl mx-auto px-4 pt-4 md:pt-8 space-y-4" style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.13rem' }}>
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    data-guide-id="worker-page-direct-invites"
                    className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-4 text-white shadow-xl"
                >
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                            <Sparkles size={20} className="text-white" />
                        </div>
                        <div className="flex-1">
                            <h1 className="text-xl font-black">Direct Invites</h1>
                            <p className="text-white/90 text-xs mt-0.5">Jobs where clients invited you directly</p>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-2 flex-wrap">
                        <span className="flex items-center gap-1 bg-white/20 rounded-full px-2.5 py-1 text-xs">
                            <Briefcase size={10} /> {invites.length} total
                        </span>
                        <span className="flex items-center gap-1 bg-white/20 rounded-full px-2.5 py-1 text-xs">
                            <Zap size={10} /> {pendingCount} pending
                        </span>
                    </div>
                </motion.div>

                {/* Filters */}
                <div className="overflow-x-auto no-scrollbar -mx-4 px-4">
                    <div className="flex items-center gap-1.5 min-w-max pb-1">
                        {['all', 'pending', 'viewed', 'direct-hired'].map((f) => (
                            <motion.button
                                key={f}
                                whileTap={{ scale: 0.96 }}
                                onClick={() => setFilter(f)}
                                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap touch-manipulation ${
                                    filter === f
                                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg'
                                        : 'bg-white text-gray-600 border-2 border-gray-200 hover:border-orange-300'
                                }`}
                            >
                                {f === 'all' && `All (${invites.length})`}
                                {f === 'pending' && `Pending (${pendingCount})`}
                                {f === 'viewed' && `Applied (${appliedCount})`}
                                {f === 'direct-hired' && `Direct Hired (${directHires.length})`}
                            </motion.button>
                        ))}
                        <motion.button
                            whileTap={{ scale: 0.96 }}
                            onClick={isDirectHiredTab ? loadDirectHires : loadInvites}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white text-gray-600 border-2 border-gray-200 hover:border-orange-300 transition-all"
                        >
                            <RefreshCw size={12} /> Refresh
                        </motion.button>
                    </div>
                </div>

                {/* Main Content */}
                {isDirectHiredTab ? (
                    directHireLoading ? (
                        <div className="text-center py-12 bg-white rounded-2xl shadow-xl border border-gray-100 text-gray-500">Loading direct hired jobs...</div>
                    ) : directHires.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-2xl shadow-xl border border-gray-100">
                            <p className="font-bold text-gray-800 text-lg mb-1">No direct hired jobs yet</p>
                            <p className="text-gray-400 text-xs px-4">Accepted direct hire jobs will appear here.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {directHires.map((job) => (
                                <div key={job._id} className="bg-white rounded-2xl border-2 border-gray-100 shadow-sm p-4">
                                    <div className="flex items-start gap-3">
                                        <img
                                            src={getImageUrl(job.postedBy?.photo)}
                                            alt=""
                                            className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                                            onError={e => { e.target.src = '/admin.png'; }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-black text-gray-900 truncate text-sm sm:text-base">{job.title}</h3>
                                            <p className="text-xs text-gray-500">{job.postedBy?.name}</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 text-[11px] text-gray-600">
                                                <div className="flex items-center gap-1"><Calendar size={11} /> {job.scheduledDate ? new Date(job.scheduledDate).toLocaleDateString() : 'Date not set'}</div>
                                                <div className="flex items-center gap-1"><Clock size={11} /> {job.scheduledTime || 'Time not set'}</div>
                                                <div className="flex items-center gap-1"><IndianRupee size={11} /> {Number(job.directHire?.expectedAmount || 0).toLocaleString()}</div>
                                            </div>
                                        </div>
                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold border border-emerald-200">{job.directHire?.requestStatus || 'direct'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : filtered.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-12 bg-white rounded-2xl shadow-xl border border-gray-100"
                    >
                        <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity }} className="text-5xl mb-3">📨</motion.div>
                        <p className="font-bold text-gray-800 text-lg mb-1">
                            {filter === 'pending' ? 'No pending invites' : 'No invites yet'}
                        </p>
                        <p className="text-gray-400 text-xs px-4">Check back soon for new opportunities.</p>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Invite Cards */}
                        <div className="lg:col-span-2 space-y-3">
                            <AnimatePresence>
                                {filtered.map((invite) => (
                                    <motion.button
                                        key={invite.jobId}
                                        onClick={() => setSelectedInvite(invite)}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="w-full text-left bg-white rounded-2xl border-2 border-gray-100 hover:border-orange-300 shadow-sm hover:shadow-md transition-all p-4"
                                    >
                                        <div className="flex items-start gap-3 mb-2">
                                            <img
                                                src={getImageUrl(invite.postedBy?.photo)}
                                                alt=""
                                                className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                                                onError={e => { e.target.src = '/admin.png'; }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-black text-gray-900 truncate text-sm sm:text-base">{invite.title}</h3>
                                                <p className="text-xs text-gray-500">{invite.postedBy?.name}</p>
                                            </div>
                                            {invite.hasApplied && (
                                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold flex items-center gap-1 border border-emerald-200">
                                                    <CheckCircle size={10} /> Applied
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-xs text-gray-600 mb-2 line-clamp-2">{invite.description}</p>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                                            <div className="flex items-center gap-1 text-[11px] text-gray-600">
                                                <IndianRupee size={11} /> {invite.invitedSkillCost ? Number(invite.invitedSkillCost).toLocaleString() : 'Cost not set'}
                                            </div>
                                            <div className="flex items-center gap-1 text-[11px] text-gray-600">
                                                <Clock size={11} /> {invite.invitedDuration || 'Duration not set'}
                                            </div>
                                            <div className="flex items-center gap-1 text-[11px] text-gray-600">
                                                <Calendar size={11} /> {invite.scheduledDate ? new Date(invite.scheduledDate).toLocaleDateString() : 'Date not set'}
                                            </div>
                                            <div className="flex items-center gap-1 text-[11px] text-gray-600">
                                                <Clock size={11} /> {invite.scheduledTime || 'Time not set'}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-lg text-[10px] font-semibold border border-purple-100 capitalize">
                                                {invite.invitedSkill || 'Selected skill'}
                                            </span>
                                            {invite.invitedNegotiationAmount ? (
                                                <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded-lg text-[10px] font-semibold border border-orange-100">
                                                    Negotiable: ₹{Number(invite.invitedNegotiationAmount).toLocaleString()}
                                                </span>
                                            ) : null}
                                        </div>

                                        <p className={`text-[11px] mt-2 font-semibold ${commuteTone(invite?.commute)}`}>
                                            {formatCommute(invite?.commute)}
                                            {invite?.commute?.isLocationStale ? ' • stale location' : ''}
                                        </p>

                                        {invite.urgent && (
                                            <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-lg text-[10px] font-bold border border-orange-200">
                                                Urgent
                                            </div>
                                        )}
                                    </motion.button>
                                ))}
                            </AnimatePresence>
                        </div>

                        {/* Detail Panel */}
                        {selectedInvite && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="lg:col-span-1 bg-white rounded-2xl border-2 border-orange-200 p-4 sticky top-4 shadow-sm h-fit"
                            >
                                <button
                                    onClick={() => setSelectedInvite(null)}
                                    className="sm:hidden mb-3 text-gray-500 hover:text-gray-700 text-xs font-semibold"
                                >
                                    Close
                                </button>

                                <h3 className="text-base font-black text-gray-900 mb-3">{selectedInvite.title}</h3>

                                {/* Client Info */}
                                <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-3 mb-3 border border-orange-100">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">From</p>
                                    <div className="flex items-center gap-2 mb-2">
                                        <img
                                            src={getImageUrl(selectedInvite.postedBy?.photo)}
                                            alt=""
                                            className="w-10 h-10 rounded-full object-cover border-2 border-white"
                                            onError={e => { e.target.src = '/admin.png'; }}
                                        />
                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-800 text-sm truncate">{selectedInvite.postedBy?.name}</p>
                                            <p className="text-[11px] text-gray-500 truncate">{selectedInvite.postedBy?.karigarId}</p>
                                        </div>
                                    </div>
                                    {selectedInvite.postedBy?.mobile && (
                                        <div className="flex items-center gap-1.5 text-xs text-gray-700">
                                            <Phone size={12} />
                                            <a href={`tel:${selectedInvite.postedBy.mobile}`} className="hover:text-orange-600">
                                                {selectedInvite.postedBy.mobile}
                                            </a>
                                        </div>
                                    )}
                                </div>

                                {/* Job Details */}
                                <div className="space-y-2 mb-4">
                                    <div className="flex items-start gap-2">
                                        <MapPin size={13} className="text-gray-500 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-[11px] text-gray-500">Location</p>
                                            <p className="text-xs font-semibold text-gray-800">{formatLocation(selectedInvite.location)}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-2">
                                        <Clock size={13} className="text-gray-500 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-[11px] text-gray-500">Travel Distance & ETA</p>
                                            <p className={`text-xs font-semibold ${commuteTone(selectedInvite?.commute)}`}>{formatCommute(selectedInvite?.commute)}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-2">
                                        <IndianRupee size={13} className="text-gray-500 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-[11px] text-gray-500">Skill Cost</p>
                                            <p className="text-xs font-semibold text-gray-800">{selectedInvite.invitedSkillCost ? Number(selectedInvite.invitedSkillCost).toLocaleString() : 'Not specified'}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-2">
                                        <Clock size={13} className="text-gray-500 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-[11px] text-gray-500">Skill Duration</p>
                                            <p className="text-xs font-semibold text-gray-800">{selectedInvite.invitedDuration || 'Not specified'}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-2">
                                        <Calendar size={13} className="text-gray-500 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-[11px] text-gray-500">Date & Time</p>
                                            <p className="text-xs font-semibold text-gray-800">
                                                {selectedInvite.scheduledDate ? new Date(selectedInvite.scheduledDate).toLocaleDateString() : 'Date not set'}
                                                {selectedInvite.scheduledTime ? ` · ${selectedInvite.scheduledTime}` : ''}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[11px] text-gray-500 mb-1.5">Invited Skill</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-lg text-[10px] font-semibold border border-purple-100 capitalize">
                                                {selectedInvite.invitedSkill || 'Not specified'}
                                            </span>
                                            {selectedInvite.invitedNegotiationAmount ? (
                                                <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded-lg text-[10px] font-semibold border border-orange-100">
                                                    Negotiable: ₹{Number(selectedInvite.invitedNegotiationAmount).toLocaleString()}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>

                                {/* Description */}
                                <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                                    <p className="text-[11px] text-gray-600 font-semibold mb-1">About this job</p>
                                    <p className="text-xs text-gray-700 leading-relaxed">{selectedInvite.description}</p>
                                </div>

                                {/* Actions */}
                                {!selectedInvite.hasApplied ? (
                                    <div className="space-y-2">
                                        <button
                                            onClick={() => setShowDetails(true)}
                                            className="w-full px-4 py-2.5 bg-white text-indigo-700 border border-indigo-200 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                                        >
                                            <FileText size={15} />
                                            View Details
                                        </button>
                                        <button
                                            onClick={() => handleAccept(selectedInvite.jobId)}
                                            disabled={responding === selectedInvite.jobId}
                                            className="w-full px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle size={15} />
                                            {responding === selectedInvite.jobId ? 'Accepting...' : 'Accept Invite'}
                                        </button>
                                        <button
                                            onClick={() => handleReject(selectedInvite.jobId)}
                                            disabled={responding === selectedInvite.jobId}
                                            className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2 border border-gray-200"
                                        >
                                            <XCircle size={15} />
                                            Decline
                                        </button>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                                        <CheckCircle className="inline mb-1 text-emerald-600" size={18} />
                                        <p className="text-xs font-semibold text-emerald-700">You have already applied for this job</p>
                                    </div>
                                )}

                                {showDetails && (
                                    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
                                        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[88vh] overflow-y-auto">
                                            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                                                <h4 className="text-lg font-black text-gray-900">Job Details</h4>
                                                <button onClick={() => setShowDetails(false)} className="text-gray-500 hover:text-gray-700 text-sm font-semibold">Close</button>
                                            </div>
                                            <div className="p-5 space-y-4">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div className="rounded-xl border border-gray-200 p-3">
                                                        <p className="text-[11px] text-gray-500">Title</p>
                                                        <p className="text-sm font-bold text-gray-900">{selectedInvite.title}</p>
                                                    </div>
                                                    <div className="rounded-xl border border-gray-200 p-3">
                                                        <p className="text-[11px] text-gray-500">Category</p>
                                                        <p className="text-sm font-semibold text-gray-800">{selectedInvite.category || '—'}</p>
                                                    </div>
                                                    <div className="rounded-xl border border-gray-200 p-3">
                                                        <p className="text-[11px] text-gray-500">Date & Time</p>
                                                        <p className="text-sm font-semibold text-gray-800">
                                                            {selectedInvite.scheduledDate ? new Date(selectedInvite.scheduledDate).toLocaleDateString() : 'Date not set'}
                                                            {selectedInvite.scheduledTime ? ` · ${selectedInvite.scheduledTime}` : ''}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-xl border border-gray-200 p-3">
                                                        <p className="text-[11px] text-gray-500">Your Invited Skill</p>
                                                        <p className="text-sm font-semibold text-gray-800 capitalize">{selectedInvite.invitedSkill || '—'}</p>
                                                    </div>
                                                    <div className="rounded-xl border border-gray-200 p-3">
                                                        <p className="text-[11px] text-gray-500">Skill Cost</p>
                                                        <p className="text-sm font-semibold text-gray-800">{selectedInvite.invitedSkillCost ? `₹${Number(selectedInvite.invitedSkillCost).toLocaleString()}` : '—'}</p>
                                                    </div>
                                                    <div className="rounded-xl border border-gray-200 p-3">
                                                        <p className="text-[11px] text-gray-500">Skill Duration</p>
                                                        <p className="text-sm font-semibold text-gray-800">{selectedInvite.invitedDuration || '—'}</p>
                                                    </div>
                                                </div>

                                                {selectedInvite.invitedNegotiationAmount ? (
                                                    <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                                                        <p className="text-[11px] text-orange-700 font-bold">Negotiable Amount</p>
                                                        <p className="text-sm font-semibold text-orange-800">₹{Number(selectedInvite.invitedNegotiationAmount).toLocaleString()}</p>
                                                    </div>
                                                ) : null}

                                                <div className="rounded-xl border border-gray-200 p-3">
                                                    <p className="text-[11px] text-gray-500 mb-1">Location</p>
                                                    <p className="text-sm font-semibold text-gray-800">{formatLocation(selectedInvite.location)}</p>
                                                </div>

                                                <div className="rounded-xl border border-gray-200 p-3">
                                                    <p className="text-[11px] text-gray-500 mb-1">Distance & ETA</p>
                                                    <p className={`text-sm font-semibold ${commuteTone(selectedInvite?.commute)}`}>{formatCommute(selectedInvite?.commute)}</p>
                                                </div>

                                                <div className="rounded-xl border border-gray-200 p-3">
                                                    <p className="text-[11px] text-gray-500 mb-1">About this job</p>
                                                    <p className="text-sm text-gray-700 leading-relaxed">{selectedInvite.detailedDescription || selectedInvite.description || 'No additional details provided.'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
