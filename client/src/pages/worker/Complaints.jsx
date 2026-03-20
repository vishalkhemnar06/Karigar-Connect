import React, { useState, useEffect } from 'react';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle, Clock, MessageSquare } from 'lucide-react';

// FIXES in this file:
//   1. Replaced undefined CSS classes: `input-style`, `label-style`, `btn-primary`
//      with proper Tailwind classes (form was completely unstyled before)

const CATEGORIES = ['Platform', 'Client', 'Data', 'Other'];

const statusConfig = {
    submitted: { label: 'Submitted', class: 'bg-yellow-100 text-yellow-800', icon: Clock },
    'in-review': { label: 'In Review', class: 'bg-blue-100 text-blue-800', icon: Clock },
    resolved: { label: 'Resolved', class: 'bg-green-100 text-green-800', icon: CheckCircle },
};

const Complaints = () => {
    const [complaints, setComplaints] = useState([]);
    const [newComplaint, setNewComplaint] = useState({ category: 'Platform', description: '' });
    const [submitting, setSubmitting] = useState(false);

    const fetchComplaints = async () => {
        try {
            const { data } = await api.getMyComplaints();
            setComplaints(data);
        } catch {
            toast.error('Failed to fetch complaints.');
        }
    };

    useEffect(() => { fetchComplaints(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newComplaint.description.trim()) {
            toast.error('Please describe your issue');
            return;
        }
        setSubmitting(true);
        const toastId = toast.loading('Submitting complaint...');
        try {
            await api.fileComplaint(newComplaint);
            toast.success('Complaint submitted successfully.', { id: toastId });
            setNewComplaint({ category: 'Platform', description: '' });
            fetchComplaints();
        } catch {
            toast.error('Failed to submit complaint.', { id: toastId });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">File a Complaint</h1>
                <p className="text-gray-500 text-sm mt-1">Report an issue with the platform, a client, or your data</p>
            </div>

            {/* Submit Form */}
            <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        {/* FIX: was `label-style` class which doesn't exist */}
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Complaint Category
                        </label>
                        {/* FIX: was `input-style` class which doesn't exist */}
                        <select
                            value={newComplaint.category}
                            onChange={e => setNewComplaint({ ...newComplaint, category: e.target.value })}
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                        >
                            {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Describe Your Issue <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={newComplaint.description}
                            onChange={e => setNewComplaint({ ...newComplaint, description: e.target.value })}
                            rows={4}
                            required
                            placeholder="Please describe the issue in detail..."
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                        />
                    </div>

                    {/* FIX: was `btn-primary` class which doesn't exist */}
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-orange-500 text-white font-semibold py-3 rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                        {submitting ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        ) : (
                            <><AlertTriangle size={16} /> Submit Complaint</>
                        )}
                    </button>
                </form>
            </div>

            {/* History */}
            <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4">Complaint History</h2>
                {complaints.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-orange-100 shadow-sm">
                        <MessageSquare className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No complaints filed yet</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-orange-100 shadow-sm divide-y divide-gray-100">
                        {complaints.map(c => {
                            const config = statusConfig[c.status] || statusConfig.submitted;
                            const StatusIcon = config.icon;
                            return (
                                <div key={c._id} className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold text-gray-800 text-sm">{c.category}</span>
                                                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${config.class}`}>
                                                    <StatusIcon size={10} />
                                                    {config.label}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600 leading-relaxed">{c.description}</p>
                                            {c.adminResponse && (
                                                <div className="mt-2 p-3 bg-orange-50 rounded-xl border border-orange-100">
                                                    <p className="text-xs font-semibold text-orange-700 mb-1">Admin Response:</p>
                                                    <p className="text-sm text-orange-800">{c.adminResponse}</p>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                                            {new Date(c.createdAt).toLocaleDateString('en-IN')}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Complaints;