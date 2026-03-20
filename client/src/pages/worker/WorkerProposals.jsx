// src/pages/worker/WorkerProposals.jsx
// FIXES:
//  1. Was calling api.getWorkerProposals() which doesn't exist.
//  2. Was calling api.respondToProposal() which doesn't exist.
//     FIX: Uses getWorkerBookings() filtered for 'proposal' status + respondToGroupJob()

import React, { useEffect, useState } from 'react';
import { getWorkerBookings, respondToGroupJob } from '../../api';
import toast from 'react-hot-toast';

export default function WorkerProposals() {
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [responding, setResponding] = useState(null);

    const fetchProposals = async () => {
        try {
            setLoading(true);
            const { data } = await getWorkerBookings();
            const pending = (data || []).filter((j) => j.status === 'proposal');
            setProposals(pending);
        } catch {
            toast.error('Failed to load proposals');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProposals(); }, []);

    const handleRespond = async (jobId, status) => {
        setResponding(jobId + status);
        try {
            await respondToGroupJob({ jobId, status });
            toast.success(status === 'accepted' ? '✅ Job accepted!' : 'Job declined');
            fetchProposals();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to respond');
        } finally {
            setResponding(null);
        }
    };

    if (loading) return (
        <div className="p-6 flex justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
        </div>
    );

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Group Job Proposals</h1>
            <p className="text-gray-500 mb-6">
                Clients have proposed jobs for your group. Accept to start working, or decline if unavailable.
            </p>

            {proposals.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                    <div className="text-5xl mb-3">📨</div>
                    <p className="text-gray-500">No pending proposals.</p>
                    <p className="text-gray-400 text-sm mt-1">When a client sends a job proposal to your group, it will appear here.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {proposals.map((job) => (
                        <div key={job._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <div className="mb-3">
                                <div className="flex items-start justify-between">
                                    <h2 className="font-bold text-gray-800 text-lg">{job.title}</h2>
                                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                                        ⏳ Proposal
                                    </span>
                                </div>
                                <p className="text-gray-500 text-sm mt-1">{job.description}</p>
                            </div>

                            <div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-4">
                                {job.payment > 0 && (
                                    <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-lg">
                                        💰 ₹{job.payment.toLocaleString()}
                                    </span>
                                )}
                                {job.duration && (
                                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg">
                                        🕒 {job.duration}
                                    </span>
                                )}
                                {job.location?.city && (
                                    <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded-lg">
                                        📍 {job.location.city}{job.location.locality ? `, ${job.location.locality}` : ''}
                                    </span>
                                )}
                                <span className="bg-gray-50 text-gray-600 px-2 py-0.5 rounded-lg">
                                    👤 {job.postedBy?.name || 'Client'}
                                </span>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleRespond(job._id, 'accepted')}
                                    disabled={!!responding}
                                    className="flex-1 bg-green-500 text-white py-2.5 rounded-xl font-semibold hover:bg-green-600 transition-colors disabled:opacity-50"
                                >
                                    {responding === job._id + 'accepted' ? '...' : '✅ Accept Job'}
                                </button>
                                <button
                                    onClick={() => handleRespond(job._id, 'rejected')}
                                    disabled={!!responding}
                                    className="flex-1 bg-red-50 text-red-600 py-2.5 rounded-xl font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
                                >
                                    {responding === job._id + 'rejected' ? '...' : '✕ Decline'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}