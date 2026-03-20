// src/pages/worker/History.jsx
// FIXES:
//  1. Was an empty stub with a <p> tag and no data.
//  2. FIX: Now fetches actual completed job bookings and displays them as history.
//     Uses getWorkerBookings() and filters for completed + cancelled jobs.
//     Also shows ratings received via getMyFeedback().

import React, { useEffect, useState } from 'react';
import { getWorkerBookings, getMyFeedback } from '../../api';
import toast from 'react-hot-toast';

const STATUS_STYLES = {
    completed: 'bg-green-100 text-green-700',
    cancelled:  'bg-red-100 text-red-600',
    rejected:   'bg-gray-100 text-gray-500',
};

export default function History() {
    const [bookings, setBookings] = useState([]);
    const [feedback, setFeedback] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('jobs'); // 'jobs' | 'ratings'

    useEffect(() => {
        (async () => {
            try {
                const [bRes, fRes] = await Promise.all([
                    getWorkerBookings(),
                    getMyFeedback(),
                ]);
                const past = (bRes.data || []).filter(
                    (j) => ['completed', 'cancelled'].includes(j.status)
                );
                setBookings(past);
                setFeedback(fRes.data || []);
            } catch {
                toast.error('Failed to load history');
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
            <h1 className="text-2xl font-bold text-gray-800 mb-1">Work History</h1>
            <p className="text-gray-500 mb-6">Your completed and past jobs, plus ratings received from clients.</p>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-gray-200">
                <button
                    onClick={() => setTab('jobs')}
                    className={`pb-2 px-1 text-sm font-semibold border-b-2 transition-colors ${
                        tab === 'jobs'
                            ? 'border-orange-500 text-orange-600'
                            : 'border-transparent text-gray-500'
                    }`}
                >
                    📋 Past Jobs ({bookings.length})
                </button>
                <button
                    onClick={() => setTab('ratings')}
                    className={`pb-2 px-1 text-sm font-semibold border-b-2 transition-colors ${
                        tab === 'ratings'
                            ? 'border-orange-500 text-orange-600'
                            : 'border-transparent text-gray-500'
                    }`}
                >
                    ⭐ Ratings Received ({feedback.length})
                </button>
            </div>

            {/* Jobs Tab */}
            {tab === 'jobs' && (
                <>
                    {bookings.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                            <div className="text-5xl mb-3">📋</div>
                            <p className="text-gray-500">No past jobs yet.</p>
                            <p className="text-gray-400 text-sm mt-1">Completed and cancelled jobs will appear here.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {bookings.map((job) => (
                                <div key={job._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h2 className="font-bold text-gray-800">{job.title}</h2>
                                            <p className="text-gray-500 text-sm mt-0.5 line-clamp-2">{job.description}</p>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[job.status] || 'bg-gray-100 text-gray-500'}`}>
                                            {job.status}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                                        {job.payment > 0 && <span>💰 ₹{job.payment.toLocaleString()}</span>}
                                        {job.location?.city && <span>📍 {job.location.city}</span>}
                                        <span>👤 {job.postedBy?.name || 'Client'}</span>
                                        <span>📅 {new Date(job.updatedAt).toLocaleDateString('en-IN')}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Ratings Tab */}
            {tab === 'ratings' && (
                <>
                    {feedback.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                            <div className="text-5xl mb-3">⭐</div>
                            <p className="text-gray-500">No ratings yet.</p>
                            <p className="text-gray-400 text-sm mt-1">Ratings from clients will appear here after jobs are completed.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {feedback.map((item) => (
                                <div key={item._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <p className="font-semibold text-gray-800">{item.jobId?.title || 'Job'}</p>
                                            <p className="text-sm text-gray-500">by {item.client?.name || 'Client'}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-yellow-400">{'★'.repeat(item.stars)}{'☆'.repeat(5 - item.stars)}</span>
                                            <span className="text-sm font-semibold text-orange-600">+{item.points}pts</span>
                                        </div>
                                    </div>
                                    {item.message && (
                                        <p className="text-gray-600 text-sm italic">"{item.message}"</p>
                                    )}
                                    <p className="text-xs text-gray-400 mt-2">
                                        {new Date(item.createdAt).toLocaleDateString('en-IN')}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}