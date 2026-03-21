// client/src/pages/admin/AdminWorkerComplaints.jsx
// CHANGES:
//  1. Plain language throughout
//  2. Admin sees only ONE action: Reply (send a message). No priority/status complexity on the surface.
//     Status updates only via a minimal dropdown (Mark as Resolved / Close)
//  3. Worker profile card shown prominently at top of detail view
//  4. ALL details (type, category, description, against whom, date, messages) shown clearly
//  5. List cards also show full description preview + worker name/photo

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';
import {
    AlertTriangle, CheckCircle, Clock, MessageSquare,
    Search, Send, RefreshCw, X, HelpCircle,
    User, AlertCircle, Loader2, ArrowLeft, Filter,
    Phone, Shield, ChevronDown,
} from 'lucide-react';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    submitted:   { label: 'Waiting',     bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
    'in-review': { label: 'In Progress', bg: 'bg-blue-100',   text: 'text-blue-800',   icon: Clock },
    resolved:    { label: 'Resolved',    bg: 'bg-green-100',  text: 'text-green-800',  icon: CheckCircle },
    closed:      { label: 'Closed',      bg: 'bg-gray-100',   text: 'text-gray-600',   icon: X },
};

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.submitted;
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
            <Icon size={10} />{cfg.label}
        </span>
    );
}

function TypeChip({ type }) {
    return type === 'support'
        ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700"><HelpCircle size={9} /> Help Request</span>
        : <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700"><AlertTriangle size={9} /> Complaint</span>;
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ message }) {
    const isAdmin = message.sender === 'admin';
    return (
        <div className={`flex ${isAdmin ? 'justify-end' : 'justify-start'} mb-3`}>
            <div className="max-w-[82%]">
                <p className={`text-[10px] font-semibold mb-1 flex items-center gap-1 ${isAdmin ? 'justify-end text-orange-500' : 'text-gray-400'}`}>
                    {isAdmin
                        ? <><Shield size={9} className="text-orange-500" /> You (Admin)</>
                        : <><User size={9} /> {message.senderName || 'Worker'}</>}
                </p>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    isAdmin
                        ? 'bg-orange-500 text-white rounded-tr-sm'
                        : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
                }`}>
                    {message.text}
                </div>
                <p className={`text-[10px] text-gray-400 mt-1 ${isAdmin ? 'text-right mr-1' : 'ml-1'}`}>
                    {new Date(message.sentAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {!isAdmin && !message.read && <span className="ml-1 text-blue-400 font-bold">• Unread</span>}
                </p>
            </div>
        </div>
    );
}

// ── Worker Profile Card ───────────────────────────────────────────────────────
function WorkerProfileCard({ worker, againstUserName }) {
    if (!worker) return null;
    return (
        <div className="bg-white border border-orange-100 rounded-xl p-4 flex items-start gap-4 shadow-sm">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-orange-200">
                {worker.photo
                    ? <img src={worker.photo.startsWith('http') ? worker.photo : `http://localhost:5000/${worker.photo}`}
                           alt={worker.name}
                           className="w-full h-full object-cover"
                           onError={e => { e.target.style.display = 'none'; }}
                      />
                    : <User size={22} className="text-orange-500" />
                }
            </div>
            <div className="flex-1 min-w-0 space-y-0.5">
                <p className="font-black text-gray-900 text-base leading-tight">{worker.name}</p>
                <p className="text-xs text-orange-600 font-semibold font-mono">{worker.karigarId}</p>
                {worker.mobile && (
                    <a href={`tel:${worker.mobile}`} className="text-xs text-blue-600 flex items-center gap-1 font-medium hover:underline">
                        <Phone size={10} /> {worker.mobile}
                    </a>
                )}
                {againstUserName && (
                    <p className="text-xs text-red-600 font-semibold mt-1">
                        ⚠️ Complaint against: {againstUserName}
                    </p>
                )}
            </div>
        </div>
    );
}

// ── Complaint Detail Summary ──────────────────────────────────────────────────
function ComplaintDetailSummary({ complaint }) {
    return (
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">What the worker sent</p>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase mb-0.5">Type</p>
                    <TypeChip type={complaint.type} />
                </div>
                <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase mb-0.5">Category</p>
                    <p className="font-semibold text-gray-800">{complaint.category}</p>
                </div>
                <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase mb-0.5">Status</p>
                    <StatusBadge status={complaint.status} />
                </div>
                <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase mb-0.5">Date Sent</p>
                    <p className="text-xs text-gray-700">
                        {new Date(complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
            </div>

            {complaint.againstUserName && (
                <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-400 font-semibold uppercase mb-0.5">Complaint Against</p>
                    <p className="text-sm font-bold text-red-700">{complaint.againstUserName}</p>
                </div>
            )}

            <div>
                <p className="text-[10px] text-gray-400 font-semibold uppercase mb-1">Full Description</p>
                <p className="text-sm text-gray-800 leading-relaxed bg-white rounded-lg px-3 py-2.5 border border-orange-100">
                    {complaint.description}
                </p>
            </div>
        </div>
    );
}

// ── Complaint Detail Panel ────────────────────────────────────────────────────
function ComplaintDetail({ complaintId, onBack, onUpdate }) {
    const [complaint,   setComplaint]   = useState(null);
    const [loading,     setLoading]     = useState(true);
    const [reply,       setReply]       = useState('');
    const [sending,     setSending]     = useState(false);
    const [statusOpen,  setStatusOpen]  = useState(false);
    const [actioning,   setActioning]   = useState(false);
    const bottomRef = useRef(null);

    const load = useCallback(async () => {
        try {
            const { data } = await api.getAdminComplaintById(complaintId);
            setComplaint(data);
        } catch { toast.error('Could not load this item.'); }
        finally { setLoading(false); }
    }, [complaintId]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [complaint?.messages?.length]);

    const handleReply = async () => {
        if (!reply.trim()) return;
        setSending(true);
        try {
            const { data } = await api.adminReplyToComplaint(complaintId, { text: reply.trim() });
            setComplaint(data.complaint);
            setReply('');
            if (onUpdate) onUpdate(data.complaint);
            toast.success('Reply sent.');
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not send reply.');
        } finally { setSending(false); }
    };

    const handleStatusChange = async (action) => {
        setActioning(true);
        setStatusOpen(false);
        try {
            const { data } = await api.takeAdminActionOnComplaint(complaintId, { action });
            setComplaint(data.complaint);
            if (onUpdate) onUpdate(data.complaint);
            toast.success(action === 'resolved' ? 'Marked as resolved.' : 'Marked as closed.');
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Action failed.');
        } finally { setActioning(false); }
    };

    const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); } };

    if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-orange-500" size={28} /></div>;
    if (!complaint) return (
        <div className="text-center py-20 text-gray-400">
            <AlertCircle size={32} className="mx-auto mb-2" />
            <p>Not found.</p>
            <button onClick={onBack} className="mt-4 text-orange-500 text-sm underline">Go back</button>
        </div>
    );

    const isOpen   = ['submitted', 'in-review'].includes(complaint.status);
    const isClosed = ['resolved', 'closed'].includes(complaint.status);

    return (
        <div className="flex flex-col" style={{ minHeight: '80vh' }}>
            {/* Header */}
            <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
                <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
                    <ArrowLeft size={18} className="text-gray-600" />
                </button>
                <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                    <TypeChip type={complaint.type} />
                    <StatusBadge status={complaint.status} />
                    <span className="text-xs text-gray-400 font-medium capitalize">{complaint.category}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Status change — simple dropdown, only when open */}
                    {isOpen && (
                        <div className="relative">
                            <button
                                onClick={() => setStatusOpen(s => !s)}
                                disabled={actioning}
                                className="flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-colors disabled:opacity-60"
                            >
                                {actioning ? <Loader2 size={12} className="animate-spin" /> : 'Mark as'}
                                <ChevronDown size={12} />
                            </button>
                            {statusOpen && (
                                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden min-w-[140px]">
                                    <button
                                        onClick={() => handleStatusChange('resolved')}
                                        className="w-full text-left px-4 py-2.5 text-sm text-green-700 hover:bg-green-50 font-semibold flex items-center gap-2"
                                    >
                                        <CheckCircle size={14} /> Resolved
                                    </button>
                                    <button
                                        onClick={() => handleStatusChange('closed')}
                                        className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 font-semibold flex items-center gap-2"
                                    >
                                        <X size={14} /> Close
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    <button onClick={load} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        <RefreshCw size={14} className="text-gray-400" />
                    </button>
                </div>
            </div>

            {/* Worker profile */}
            <div className="px-4 pt-4 pb-2">
                <WorkerProfileCard worker={complaint.filedBy} againstUserName={complaint.againstUserName} />
            </div>

            {/* Full complaint details */}
            <div className="px-4 pb-3">
                <ComplaintDetailSummary complaint={complaint} />
            </div>

            {/* Message thread */}
            <div className="flex-1 overflow-y-auto px-4 py-3 bg-gray-50">
                <p className="text-xs text-center text-gray-400 mb-4 font-semibold">— Messages —</p>
                {complaint.messages.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-6">No messages yet.</p>
                ) : (
                    complaint.messages.map((m, i) => <MessageBubble key={m._id || i} message={m} />)
                )}
                <div ref={bottomRef} />
            </div>

            {/* Reply box */}
            <div className="px-4 py-3 bg-white border-t border-gray-100 flex items-end gap-2">
                <textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={2}
                    placeholder={isClosed ? 'This issue is closed.' : 'Write your reply to the worker…'}
                    disabled={isClosed}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none disabled:bg-gray-50 disabled:text-gray-400"
                />
                <button
                    onClick={handleReply}
                    disabled={sending || !reply.trim() || isClosed}
                    className="p-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl disabled:opacity-50 transition-colors flex-shrink-0"
                >
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
            </div>
        </div>
    );
}

// ── List Card ─────────────────────────────────────────────────────────────────
function ComplaintCard({ complaint, onClick }) {
    const unread   = complaint.adminUnread || 0;
    const lastMsg  = complaint.messages?.[complaint.messages.length - 1];
    const preview  = lastMsg?.text?.slice(0, 60) + (lastMsg?.text?.length > 60 ? '…' : '');
    const from     = lastMsg?.sender === 'admin' ? 'You' : complaint.filedBy?.name || 'Worker';
    const worker   = complaint.filedBy;

    return (
        <div
            onClick={onClick}
            className={`bg-white rounded-2xl border p-4 cursor-pointer hover:shadow-md transition-all group ${
                unread > 0 ? 'border-orange-300 bg-orange-50/20' : 'border-gray-100 hover:border-orange-200'
            }`}
        >
            <div className="flex items-start gap-3">
                {/* Worker avatar */}
                <div className="w-11 h-11 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 overflow-hidden border border-orange-200 font-bold text-orange-600">
                    {worker?.photo
                        ? <img src={worker.photo.startsWith('http') ? worker.photo : `http://localhost:5000/${worker.photo}`}
                               alt={worker.name}
                               className="w-full h-full object-cover"
                               onError={e => { e.target.style.display = 'none'; }}
                          />
                        : (worker?.name?.[0]?.toUpperCase() || 'W')
                    }
                </div>

                <div className="flex-1 min-w-0">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-gray-900">{worker?.name || 'Worker'}</p>
                                {worker?.mobile && <span className="text-[10px] text-gray-400">{worker.mobile}</span>}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <TypeChip type={complaint.type} />
                                <StatusBadge status={complaint.status} />
                                {unread > 0 && (
                                    <span className="bg-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                                        {unread} unread
                                    </span>
                                )}
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-400 flex-shrink-0">
                            {new Date(complaint.updatedAt || complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                    </div>

                    {/* Category + against */}
                    <p className="text-xs font-semibold text-gray-700">
                        {complaint.category}
                        {complaint.againstUserName && <span className="text-red-500 font-normal ml-1">— vs {complaint.againstUserName}</span>}
                    </p>

                    {/* Description preview */}
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{complaint.description}</p>

                    {/* Last message */}
                    {preview && (
                        <p className="text-[10px] text-gray-400 mt-1 border-t border-gray-50 pt-1">
                            <span className="font-medium">{from}:</span> {preview}
                        </p>
                    )}

                    {/* Footer */}
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                        <span className="flex items-center gap-1"><MessageSquare size={9} />{complaint.messages?.length || 0} messages</span>
                        <span>{new Date(complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const AdminWorkerComplaints = () => {
    const navigate = useNavigate();
    const [complaints,    setComplaints]    = useState([]);
    const [stats,         setStats]         = useState(null);
    const [loading,       setLoading]       = useState(true);
    const [detailId,      setDetailId]      = useState(null);
    const [typeFilter,    setTypeFilter]    = useState('all');
    const [statusFilter,  setStatusFilter]  = useState('all');
    const [search,        setSearch]        = useState('');
    const [showFilters,   setShowFilters]   = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (typeFilter   !== 'all') params.type   = typeFilter;
            if (statusFilter !== 'all') params.status = statusFilter;
            if (search)                 params.search  = search;

            const [listRes, statsRes] = await Promise.allSettled([
                api.getAdminComplaints(params),
                api.getAdminComplaintStats(),
            ]);
            if (listRes.status  === 'fulfilled') setComplaints(listRes.value.data?.complaints || listRes.value.data || []);
            if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
        } catch { toast.error('Could not load.'); }
        finally { setLoading(false); }
    }, [typeFilter, statusFilter, search]);

    useEffect(() => { loadData(); }, [loadData]);

    if (detailId) {
        return (
            <div className="max-w-3xl mx-auto">
                <ComplaintDetail
                    complaintId={detailId}
                    onBack={() => { setDetailId(null); loadData(); }}
                    onUpdate={(updated) => setComplaints(prev => prev.map(c => c._id === updated._id ? updated : c))}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">

            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Worker Complaints & Help Requests</h1>
                    <p className="text-gray-500 text-sm mt-0.5">See what workers have sent and reply to them</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => navigate('/admin/dashboard')}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                        <ArrowLeft size={14} /> Dashboard
                    </button>
                    <button onClick={loadData} className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:text-orange-500 hover:border-orange-200 transition-colors">
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: 'Total Received', value: stats.total,                    color: 'text-gray-800',   bg: 'bg-white' },
                        { label: 'Waiting',         value: stats.byStatus?.submitted || 0, color: 'text-yellow-700', bg: 'bg-yellow-50' },
                        { label: 'Unread Messages', value: stats.adminUnread || 0,         color: 'text-orange-700', bg: 'bg-orange-50' },
                        { label: 'Resolved',        value: stats.byStatus?.resolved || 0,  color: 'text-green-700',  bg: 'bg-green-50' },
                    ].map(s => (
                        <div key={s.label} className={`${s.bg} border border-gray-100 rounded-2xl p-4 text-center shadow-sm`}>
                            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                            <p className="text-xs text-gray-500 font-semibold mt-0.5">{s.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Search + Filter */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 shadow-sm">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by worker name or description…"
                            className="w-full pl-9 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(f => !f)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${
                            showFilters || typeFilter !== 'all' || statusFilter !== 'all'
                                ? 'border-orange-400 bg-orange-50 text-orange-700'
                                : 'border-gray-200 text-gray-500 hover:border-orange-200'
                        }`}
                    >
                        <Filter size={14} /> Filter
                    </button>
                </div>

                {showFilters && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Type</label>
                            <div className="flex gap-2 flex-wrap">
                                {[
                                    { v: 'all',       l: 'All' },
                                    { v: 'complaint', l: 'Complaints' },
                                    { v: 'support',   l: 'Help Requests' },
                                ].map(({ v, l }) => (
                                    <button key={v} onClick={() => setTypeFilter(v)}
                                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                                            typeFilter === v ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}>{l}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Status</label>
                            <div className="flex gap-2 flex-wrap">
                                {[
                                    { v: 'all',        l: 'All' },
                                    { v: 'submitted',  l: 'Waiting' },
                                    { v: 'in-review',  l: 'In Progress' },
                                    { v: 'resolved',   l: 'Resolved' },
                                    { v: 'closed',     l: 'Closed' },
                                ].map(({ v, l }) => (
                                    <button key={v} onClick={() => setStatusFilter(v)}
                                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                                            statusFilter === v ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}>{l}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {(typeFilter !== 'all' || statusFilter !== 'all' || search) && (
                    <button
                        onClick={() => { setTypeFilter('all'); setStatusFilter('all'); setSearch(''); }}
                        className="text-xs text-orange-500 underline font-semibold"
                    >
                        Clear filters
                    </button>
                )}
            </div>

            {/* List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="animate-spin text-orange-400" size={28} />
                </div>
            ) : complaints.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
                    <MessageSquare size={36} className="text-gray-300 mx-auto mb-3" />
                    <p className="font-semibold text-gray-500">Nothing here</p>
                    <p className="text-xs text-gray-400 mt-1">
                        {typeFilter !== 'all' || statusFilter !== 'all' || search ? 'Try different filters.' : 'No workers have sent anything yet.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    <p className="text-xs text-gray-400 font-semibold">{complaints.length} item{complaints.length !== 1 ? 's' : ''}</p>
                    {complaints.map(c => (
                        <ComplaintCard key={c._id} complaint={c} onClick={() => setDetailId(c._id)} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdminWorkerComplaints;