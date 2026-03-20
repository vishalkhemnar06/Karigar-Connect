// src/pages/worker/CompletedGroupJobs.jsx
// FIXES:
//  1. Was calling api.getCompletedGroupJobs() which doesn't exist.
//     FIX: Uses getWorkerBookings() and filters for completed group jobs.

import React, { useEffect, useState } from 'react';
import { getWorkerBookings } from '../../api';
import toast from 'react-hot-toast';

export default function CompletedGroupJobs() {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await getWorkerBookings();
                const completed = (data || []).filter(
                    (j) => j.groupId && j.status === 'completed'
                );
                setJobs(completed);
            } catch {
                toast.error('Failed to load completed group jobs');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading) return (
        <div className="p-6 flex justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
        </div>
    );

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Completed Group Jobs</h1>
            <p className="text-gray-500 mb-6">Group jobs that have been successfully completed.</p>

            {jobs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                    <div className="text-5xl mb-3">✅</div>
                    <p className="text-gray-500">No completed group jobs yet.</p>
                    <p className="text-gray-400 text-sm mt-1">Completed group jobs will be shown here.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {jobs.map((job) => (
                        <div key={job._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h2 className="font-bold text-gray-800 text-lg">{job.title}</h2>
                                    <p className="text-gray-500 text-sm mt-1 line-clamp-2">{job.description}</p>
                                </div>
                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                    ✅ Completed
                                </span>
                            </div>

                            <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                                {job.payment > 0 && <span>💰 ₹{job.payment.toLocaleString()}</span>}
                                {job.duration    && <span>🕒 {job.duration}</span>}
                                {job.location?.city && <span>📍 {job.location.city}</span>}
                                <span>👤 {job.postedBy?.name || 'Client'}</span>
                                <span>📅 {new Date(job.updatedAt).toLocaleDateString('en-IN')}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}