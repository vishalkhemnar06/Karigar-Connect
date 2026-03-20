// src/pages/worker/ActiveGroupJobs.jsx
// FIXES:
//  1. Was calling api.getActiveGroupJobs() which doesn't exist.
//     FIX: Uses getWorkerBookings() and filters for running group jobs.
//  2. Added proper loading, empty state, and full job card UI.

import React, { useEffect, useState } from 'react';
import { getWorkerBookings, respondToGroupJob } from '../../api';
import toast from 'react-hot-toast';

export default function ActiveGroupJobs() {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchJobs = async () => {
        try {
            setLoading(true);
            const { data } = await getWorkerBookings();
            // Filter: jobs with groupId that are running or proposal
            const groupJobs = (data || []).filter(
                (j) => j.groupId && (j.status === 'running' || j.status === 'proposal')
            );
            setJobs(groupJobs);
        } catch {
            toast.error('Failed to load group jobs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchJobs(); }, []);

    const handleRespond = async (jobId, status) => {
        try {
            await respondToGroupJob({ jobId, status });
            toast.success(`Job ${status === 'accepted' ? 'accepted' : 'declined'}`);
            fetchJobs();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to respond');
        }
    };

    if (loading) return (
        <div className="p-6 flex justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
        </div>
    );

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Active Group Jobs</h1>
            <p className="text-gray-500 mb-6">Jobs assigned to your group that are currently in progress or awaiting your response.</p>

            {jobs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                    <div className="text-5xl mb-3">🔨</div>
                    <p className="text-gray-500">No active group jobs right now.</p>
                    <p className="text-gray-400 text-sm mt-1">When a client hires your group, jobs will appear here.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {jobs.map((job) => (
                        <div key={job._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h2 className="font-bold text-gray-800 text-lg">{job.title}</h2>
                                    <p className="text-gray-500 text-sm mt-1">{job.description}</p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                    job.status === 'running'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                    {job.status === 'running' ? '🟢 Active' : '⏳ Proposal'}
                                </span>
                            </div>

                            <div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-4">
                                {job.payment > 0 && <span>💰 ₹{job.payment.toLocaleString()}</span>}
                                {job.duration    && <span>🕒 {job.duration}</span>}
                                {job.location?.city && <span>📍 {job.location.city}</span>}
                                <span>👤 {job.postedBy?.name || 'Client'}</span>
                            </div>

                            {job.status === 'proposal' && (
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleRespond(job._id, 'accepted')}
                                        className="flex-1 bg-green-500 text-white py-2 rounded-xl font-medium hover:bg-green-600 transition-colors"
                                    >
                                        ✅ Accept
                                    </button>
                                    <button
                                        onClick={() => handleRespond(job._id, 'rejected')}
                                        className="flex-1 bg-red-100 text-red-600 py-2 rounded-xl font-medium hover:bg-red-200 transition-colors"
                                    >
                                        ✕ Decline
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}