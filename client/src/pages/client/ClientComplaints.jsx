// src/pages/client/ClientComplaints.jsx
// Client-facing complaint management page — file complaints against workers

import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../../api';
import {
    AlertTriangle, Search, ChevronRight, X, CheckCircle,
    Clock, ShieldAlert, User, Phone, Briefcase, Star,
    FileText, Send, Loader2, MapPin, AlertCircle, RefreshCw,
    MessageSquare
} from 'lucide-react';

// ── Status badge helper ──────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const map = {
        submitted:    { cls: 'bg-yellow-100 text-yellow-800 border-yellow-200',   label: 'Submitted' },
        'in-review':  { cls: 'bg-blue-100 text-blue-800 border-blue-200',         label: 'In Review' },
        'action-taken':{ cls: 'bg-orange-100 text-orange-800 border-orange-200',  label: 'Action Taken' },
        resolved:     { cls: 'bg-green-100 text-green-800 border-green-200',      label: 'Resolved' },
        dismissed:    { cls: 'bg-gray-100 text-gray-600 border-gray-200',         label: 'Dismissed' },
    };
    const { cls, label } = map[status] || map.submitted;
    return (
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border inline-flex items-center gap-1 ${cls}`}>
            {label}
        </span>
    );
};

// ── Category options ─────────────────────────────────────────────────────────
const CATEGORIES = [
    'Poor Quality Work',
    'Unprofessional Behavior',
    'Did Not Show Up',
    'Damaged Property',
    'Overcharged / Fraud',
    'Harassment',
    'Other',
];

// ── Worker Preview Card ──────────────────────────────────────────────────────
const WorkerCard = ({ worker, onSelect, selected }) => {
    const skills = Array.isArray(worker.skills)
        ? worker.skills.map(s => (typeof s === 'object' ? s.name : s)).join(', ')
        : '—';

    return (
        <div
            onClick={onSelect}
            className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
                selected
                    ? 'border-orange-500 bg-orange-50 shadow-lg shadow-orange-100'
                    : 'border-gray-100 bg-white hover:border-orange-200 hover:shadow-md'
            }`}
        >
            <div className="relative flex-shrink-0">
                <img
                    src={worker.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.name)}&background=f97316&color=fff`}
                    alt={worker.name}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-orange-100"
                    onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.name)}&background=f97316&color=fff`; }}
                />
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                    worker.verificationStatus === 'approved' ? 'bg-green-400' : 'bg-gray-300'
                }`} />
            </div>

            <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 truncate">{worker.name}</p>
                <p className="text-xs text-orange-600 font-mono font-semibold">{worker.karigarId}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{skills || 'No skills listed'}</p>
            </div>

            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Phone size={10} />
                    <span>{worker.mobile}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    worker.verificationStatus === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                }`}>{worker.overallExperience || 'Worker'}</span>
                {selected && (
                    <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                        <CheckCircle size={12} className="text-white" />
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Success Popup ────────────────────────────────────────────────────────────
const SuccessPopup = ({ onClose }) => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-green-200">
                <CheckCircle size={40} className="text-white" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">Complaint Submitted!</h3>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
                We have received your complaint and will review it carefully.
                <br /><br />
                <strong className="text-orange-600">Action will be taken within 24 hours.</strong>
                <br /><br />
                You can track the status in your complaints history below.
            </p>
            <button
                onClick={onClose}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 rounded-2xl font-bold shadow-lg shadow-orange-200 hover:shadow-orange-300 active:scale-95 transition-all"
            >
                Got It, Thanks!
            </button>
        </div>
    </div>
);

// ── Main Page ────────────────────────────────────────────────────────────────
export default function ClientComplaints() {
    // Search state
    const [searchQuery, setSearchQuery]     = useState('');
    const [searchResult, setSearchResult]   = useState(null);
    const [searchError, setSearchError]     = useState('');
    const [searching, setSearching]         = useState(false);
    const [selectedWorker, setSelectedWorker] = useState(null);

    // Form state
    const [category, setCategory]     = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError]   = useState('');

    // Popups
    const [showSuccess, setShowSuccess] = useState(false);

    // Past complaints
    const [complaints, setComplaints]   = useState([]);
    const [loadingPast, setLoadingPast] = useState(true);
    const [activeTab, setActiveTab]     = useState('new'); // 'new' | 'history'

    // Fetch past complaints
    const fetchComplaints = useCallback(async () => {
        setLoadingPast(true);
        try {
            const { data } = await api.getClientComplaints();
            setComplaints(data.complaints || []);
        } catch { /* silent */ } finally { setLoadingPast(false); }
    }, []);

    useEffect(() => { fetchComplaints(); }, [fetchComplaints]);

    // ── Search handler ──────────────────────────────────────────────────────
    const handleSearch = async () => {
        if (!searchQuery.trim() || searchQuery.trim().length < 3) {
            setSearchError('Please enter at least 3 characters.');
            return;
        }
        setSearching(true);
        setSearchError('');
        setSearchResult(null);
        setSelectedWorker(null);

        try {
            const { data } = await api.searchWorkerForComplaint(searchQuery.trim());
            setSearchResult(data.worker);
        } catch (err) {
            setSearchError(err.response?.data?.message || 'Worker not found.');
        } finally {
            setSearching(false);
        }
    };

    // ── Submit complaint ────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!selectedWorker) { setFormError('Please select a worker first.'); return; }
        if (!category)       { setFormError('Please choose a complaint category.'); return; }
        if (description.trim().length < 20) { setFormError('Please write at least 20 characters describing the issue.'); return; }

        setSubmitting(true);
        setFormError('');
        try {
            await api.fileClientComplaint({
                workerId:    selectedWorker._id,
                category,
                description: description.trim(),
            });
            // Reset form
            setSearchQuery('');
            setSearchResult(null);
            setSelectedWorker(null);
            setCategory('');
            setDescription('');
            setShowSuccess(true);
            fetchComplaints();
        } catch (err) {
            setFormError(err.response?.data?.message || 'Failed to submit complaint. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/40 via-white to-orange-50/20 p-4 md:p-8">
            {showSuccess && <SuccessPopup onClose={() => setShowSuccess(false)} />}

            <div className="max-w-3xl mx-auto">
                {/* Page Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-200">
                            <AlertTriangle size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900">File a Complaint</h1>
                            <p className="text-sm text-gray-500">Report issues with workers you have hired</p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-gray-100 rounded-2xl p-1 mb-8 gap-1">
                    {[
                        { id: 'new',     label: 'New Complaint', icon: MessageSquare },
                        { id: 'history', label: `My Complaints${complaints.length ? ` (${complaints.length})` : ''}`, icon: FileText },
                    ].map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                activeTab === id
                                    ? 'bg-white text-orange-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Icon size={15} />
                            {label}
                        </button>
                    ))}
                </div>

                {/* ── NEW COMPLAINT TAB ── */}
                {activeTab === 'new' && (
                    <div className="space-y-6">

                        {/* Step 1: Search Worker */}
                        <div className="bg-white rounded-3xl border border-orange-100 shadow-sm p-6">
                            <div className="flex items-center gap-2 mb-5">
                                <div className="w-7 h-7 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-black">1</div>
                                <h2 className="font-bold text-gray-800">Find the Worker</h2>
                            </div>

                            <p className="text-sm text-gray-500 mb-4">
                                Enter the worker's <strong>Karigar ID</strong> or <strong>mobile number</strong> to find their profile.
                            </p>

                            <div className="flex gap-3">
                                <div className="flex-1 relative">
                                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => { setSearchQuery(e.target.value); setSearchError(''); }}
                                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                        placeholder="Enter Karigar ID or mobile number..."
                                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-100 rounded-2xl text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-50 outline-none transition-all"
                                    />
                                </div>
                                <button
                                    onClick={handleSearch}
                                    disabled={searching}
                                    className="px-5 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-orange-200 hover:shadow-orange-300 active:scale-95 transition-all disabled:opacity-60 flex items-center gap-2"
                                >
                                    {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                                    Search
                                </button>
                            </div>

                            {searchError && (
                                <div className="mt-3 flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-xl px-4 py-2.5 border border-red-100">
                                    <AlertCircle size={14} />
                                    {searchError}
                                </div>
                            )}

                            {searchResult && (
                                <div className="mt-4">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Search Result</p>
                                    <WorkerCard
                                        worker={searchResult}
                                        selected={selectedWorker?._id === searchResult._id}
                                        onSelect={() => setSelectedWorker(
                                            selectedWorker?._id === searchResult._id ? null : searchResult
                                        )}
                                    />
                                    {selectedWorker?._id === searchResult._id && (
                                        <p className="text-xs text-orange-600 font-semibold mt-2 flex items-center gap-1">
                                            <CheckCircle size={12} />
                                            Worker selected — fill in your complaint below
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Step 2: Complaint Details */}
                        <div className={`bg-white rounded-3xl border shadow-sm p-6 transition-all ${
                            selectedWorker ? 'border-orange-100 opacity-100' : 'border-gray-100 opacity-50 pointer-events-none'
                        }`}>
                            <div className="flex items-center gap-2 mb-5">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                                    selectedWorker ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-400'
                                }`}>2</div>
                                <h2 className="font-bold text-gray-800">Describe the Issue</h2>
                            </div>

                            {/* Category */}
                            <div className="mb-5">
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Complaint Category <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {CATEGORIES.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setCategory(cat)}
                                            className={`text-left px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                                                category === cat
                                                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                                                    : 'border-gray-100 text-gray-600 hover:border-orange-200 hover:bg-orange-50/50'
                                            }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Description */}
                            <div className="mb-5">
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Detailed Description <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={description}
                                    onChange={e => { setDescription(e.target.value); setFormError(''); }}
                                    placeholder="Describe what happened in detail — what work was done, what went wrong, any evidence you have..."
                                    rows={5}
                                    className="w-full border-2 border-gray-100 rounded-2xl p-4 text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-50 outline-none transition-all resize-none"
                                />
                                <div className="flex justify-between items-center mt-1">
                                    <span className="text-xs text-gray-400">Minimum 20 characters</span>
                                    <span className={`text-xs font-mono ${description.length < 20 ? 'text-red-400' : 'text-green-500'}`}>
                                        {description.length} / 2000
                                    </span>
                                </div>
                            </div>

                            {formError && (
                                <div className="mb-4 flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-xl px-4 py-2.5 border border-red-100">
                                    <AlertCircle size={14} />
                                    {formError}
                                </div>
                            )}

                            <button
                                onClick={handleSubmit}
                                disabled={submitting || !selectedWorker}
                                className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 rounded-2xl font-black text-base shadow-lg shadow-orange-200 hover:shadow-orange-300 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Submitting Complaint...
                                    </>
                                ) : (
                                    <>
                                        <Send size={18} />
                                        Submit Complaint
                                    </>
                                )}
                            </button>

                            <p className="text-xs text-gray-400 text-center mt-3">
                                🔒 Your complaint is confidential. We will take action within 24 hours.
                            </p>
                        </div>
                    </div>
                )}

                {/* ── HISTORY TAB ── */}
                {activeTab === 'history' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                                {complaints.length} Complaint{complaints.length !== 1 ? 's' : ''}
                            </p>
                            <button
                                onClick={fetchComplaints}
                                disabled={loadingPast}
                                className="p-2 text-gray-400 hover:text-orange-500 transition-colors"
                            >
                                <RefreshCw size={16} className={loadingPast ? 'animate-spin' : ''} />
                            </button>
                        </div>

                        {loadingPast ? (
                            <div className="flex justify-center py-16">
                                <Loader2 size={28} className="animate-spin text-orange-400" />
                            </div>
                        ) : complaints.length === 0 ? (
                            <div className="text-center py-16 text-gray-400">
                                <ShieldAlert size={48} className="mx-auto mb-3 opacity-30" />
                                <p className="font-medium">No complaints filed yet</p>
                                <p className="text-sm mt-1">Complaints you file will appear here</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {complaints.map(c => (
                                    <div key={c._id} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                                        {/* Header */}
                                        <div className="flex items-start justify-between gap-3 mb-4">
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={c.againstWorker?.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.againstWorker?.name || 'W')}&background=f97316&color=fff`}
                                                    alt={c.againstWorker?.name}
                                                    className="w-11 h-11 rounded-2xl object-cover border-2 border-orange-100"
                                                    onError={e => { e.target.src = `https://ui-avatars.com/api/?name=W&background=f97316&color=fff`; }}
                                                />
                                                <div>
                                                    <p className="font-bold text-gray-900 text-sm">{c.againstWorker?.name || 'Unknown Worker'}</p>
                                                    <p className="text-xs text-orange-600 font-mono">{c.againstWorker?.karigarId}</p>
                                                </div>
                                            </div>
                                            <StatusBadge status={c.status} />
                                        </div>

                                        {/* Category & Description */}
                                        <div className="bg-orange-50/50 rounded-2xl p-3 mb-3 border border-orange-100/50">
                                            <p className="text-xs font-black text-orange-600 uppercase tracking-wider mb-1">{c.category}</p>
                                            <p className="text-sm text-gray-700 line-clamp-3">{c.description}</p>
                                        </div>

                                        {/* Admin Notes (if any) */}
                                        {c.adminNotes && (
                                            <div className="bg-blue-50 rounded-2xl p-3 border border-blue-100">
                                                <p className="text-xs font-bold text-blue-700 mb-1">Admin Response</p>
                                                <p className="text-sm text-blue-800">{c.adminNotes}</p>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                                            <span className="text-xs text-gray-400">
                                                Filed {new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                            {c.adminAction && (
                                                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                                                    c.adminAction === 'blocked'  ? 'bg-red-100 text-red-700' :
                                                    c.adminAction === 'warned'   ? 'bg-yellow-100 text-yellow-700' :
                                                    c.adminAction === 'cleared'  ? 'bg-green-100 text-green-700' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                    Action: {c.adminAction}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}