// client/src/pages/worker/WorkerComplaints.jsx
// Full complaint & support system for workers:
//   - Tab 1: File a new complaint (against a client) OR support ticket
//   - Tab 2: My tickets list — with status, unread badges, type chips
//   - Thread view: full message conversation with admin
//
// Original Complaints.jsx functionality fully preserved + enhanced.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '../../api';
import toast from 'react-hot-toast';
import {
    AlertTriangle, CheckCircle, Clock, MessageSquare, ChevronRight,
    Send, X, Search, User, Shield, HelpCircle, RefreshCw,
    ArrowLeft, AlertCircle, Loader2, ChevronDown,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────
const COMPLAINT_CATEGORIES = ['Client', 'Payment', 'Safety', 'Other'];
const SUPPORT_CATEGORIES   = ['Platform', 'Technical', 'Payment', 'Other'];

const STATUS_CONFIG = {
    submitted:  { label: 'Submitted',  bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
    'in-review':{ label: 'In Review',  bg: 'bg-blue-100',   text: 'text-blue-800',   icon: Clock },
    resolved:   { label: 'Resolved',   bg: 'bg-green-100',  text: 'text-green-800',  icon: CheckCircle },
    closed:     { label: 'Closed',     bg: 'bg-gray-100',   text: 'text-gray-700',   icon: X },
};

const PRIORITY_CONFIG = {
    low:    { label: 'Low',    bg: 'bg-gray-100',   text: 'text-gray-600'   },
    medium: { label: 'Medium', bg: 'bg-blue-100',   text: 'text-blue-700'   },
    high:   { label: 'High',   bg: 'bg-red-100',    text: 'text-red-700'    },
};

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.submitted;
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
            <Icon size={10} />
            {cfg.label}
        </span>
    );
}

// ── Priority Badge ────────────────────────────────────────────────────────────
function PriorityBadge({ priority }) {
    const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
    return (
        <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
            {cfg.label}
        </span>
    );
}

// ── Type Chip ─────────────────────────────────────────────────────────────────
function TypeChip({ type }) {
    return type === 'support'
        ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700"><HelpCircle size={9} /> Support</span>
        : <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700"><AlertTriangle size={9} /> Complaint</span>;
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ message }) {
    const isAdmin = message.sender === 'admin';
    return (
        <div className={`flex ${isAdmin ? 'justify-start' : 'justify-end'} mb-3`}>
            <div className={`max-w-[80%] ${isAdmin ? 'order-2' : ''}`}>
                {isAdmin && (
                    <p className="text-[10px] text-gray-400 font-semibold mb-1 ml-1 flex items-center gap-1">
                        <Shield size={9} className="text-orange-500" /> {message.senderName || 'Support Team'}
                    </p>
                )}
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    isAdmin
                        ? 'bg-white border border-orange-100 text-gray-800 rounded-tl-sm shadow-sm'
                        : 'bg-orange-500 text-white rounded-tr-sm'
                }`}>
                    {message.text}
                </div>
                <p className={`text-[10px] text-gray-400 mt-1 ${isAdmin ? 'ml-1' : 'text-right mr-1'}`}>
                    {new Date(message.sentAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {!isAdmin && !message.read && <span className="ml-1 text-orange-300">• Unread</span>}
                </p>
            </div>
        </div>
    );
}

// ── Thread View ───────────────────────────────────────────────────────────────
function ThreadView({ complaintId, onBack, onUpdate }) {
    const [complaint, setComplaint] = useState(null);
    const [loading,   setLoading]   = useState(true);
    const [reply,     setReply]     = useState('');
    const [sending,   setSending]   = useState(false);
    const bottomRef = useRef(null);

    const load = useCallback(async () => {
        try {
            const { data } = await api.getMyComplaintById(complaintId);
            setComplaint(data);
        } catch {
            toast.error('Failed to load thread.');
        } finally {
            setLoading(false);
        }
    }, [complaintId]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [complaint?.messages?.length]);

    const handleSend = async () => {
        if (!reply.trim()) return;
        setSending(true);
        try {
            const { data } = await api.sendComplaintMessage(complaintId, { text: reply.trim() });
            setComplaint(data.complaint);
            setReply('');
            if (onUpdate) onUpdate(data.complaint);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to send message.');
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin text-orange-500" size={28} />
        </div>
    );
    if (!complaint) return (
        <div className="text-center py-16 text-gray-400">
            <AlertCircle size={32} className="mx-auto mb-2" />
            <p>Could not load this ticket.</p>
            <button onClick={onBack} className="mt-4 text-orange-500 text-sm underline">Go back</button>
        </div>
    );

    const isClosed = ['resolved', 'closed'].includes(complaint.status);

    return (
        <div className="flex flex-col h-full">
            {/* Thread header */}
            <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-start gap-3 sticky top-0 z-10">
                <button onClick={onBack} className="mt-0.5 p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
                    <ArrowLeft size={18} className="text-gray-600" />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <TypeChip type={complaint.type} />
                        <StatusBadge status={complaint.status} />
                        <PriorityBadge priority={complaint.priority} />
                    </div>
                    <p className="text-sm font-bold text-gray-800 mt-1 truncate">
                        {complaint.category} — {complaint.type === 'support' ? 'Support Request' : 'Complaint'}
                    </p>
                    {complaint.againstUserName && (
                        <p className="text-xs text-gray-400 mt-0.5">Against: {complaint.againstUserName}</p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-0.5">
                        Filed {new Date(complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                </div>
                <button onClick={load} className="mt-0.5 p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
                    <RefreshCw size={14} className="text-gray-400" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50 space-y-1" style={{ minHeight: 0 }}>
                {complaint.messages.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-8">No messages yet.</p>
                ) : (
                    complaint.messages.map((m, i) => <MessageBubble key={m._id || i} message={m} />)
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            {isClosed ? (
                <div className="px-4 py-3 bg-gray-100 border-t border-gray-200 text-center">
                    <p className="text-xs text-gray-500 font-medium">
                        This ticket is {complaint.status}. {complaint.status === 'resolved' ? 'If you have a new issue, please file a new ticket.' : 'Contact support for further assistance.'}
                    </p>
                </div>
            ) : (
                <div className="px-4 py-3 bg-white border-t border-gray-100 flex items-end gap-2">
                    <textarea
                        value={reply}
                        onChange={e => setReply(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={2}
                        placeholder="Type your message… (Enter to send)"
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                    />
                    <button
                        onClick={handleSend}
                        disabled={sending || !reply.trim()}
                        className="p-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl disabled:opacity-50 transition-colors flex-shrink-0"
                    >
                        {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                </div>
            )}
        </div>
    );
}

// ── File New Ticket Form ──────────────────────────────────────────────────────
function FileTicketForm({ onFiled }) {
    const [ticketType, setTicketType]   = useState('complaint'); // 'complaint' | 'support'
    const [category,   setCategory]     = useState('');
    const [description, setDescription] = useState('');
    const [submitting,  setSubmitting]  = useState(false);

    // For complaint against client
    const [clientSearch, setClientSearch]     = useState('');
    const [clientResults, setClientResults]   = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [searchingClient, setSearchingClient] = useState(false);
    const searchTimerRef = useRef(null);

    const categories = ticketType === 'support' ? SUPPORT_CATEGORIES : COMPLAINT_CATEGORIES;

    // Reset category when type changes
    useEffect(() => { setCategory(''); setSelectedClient(null); setClientSearch(''); }, [ticketType]);

    // Debounced client search
    useEffect(() => {
        if (ticketType !== 'complaint') return;
        if (clientSearch.length < 2) { setClientResults([]); return; }
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(async () => {
            setSearchingClient(true);
            try {
                const { data } = await api.searchClientForComplaint(clientSearch);
                setClientResults(data);
            } catch { setClientResults([]); }
            finally { setSearchingClient(false); }
        }, 400);
        return () => clearTimeout(searchTimerRef.current);
    }, [clientSearch, ticketType]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!category) return toast.error('Please select a category.');
        if (!description.trim()) return toast.error('Please describe your issue.');
        setSubmitting(true);
        const toastId = toast.loading('Submitting…');
        try {
            const payload = {
                type:          ticketType,
                category,
                description:   description.trim(),
                againstUserId: selectedClient?._id || undefined,
            };
            const { data } = await api.fileComplaint(payload);
            toast.success(data.message || 'Ticket filed!', { id: toastId });
            setCategory(''); setDescription(''); setSelectedClient(null); setClientSearch('');
            if (onFiled) onFiled(data.complaint);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to submit.', { id: toastId });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-5">File a New Ticket</h2>

            {/* Type selector */}
            <div className="flex gap-3 mb-5">
                <button
                    type="button"
                    onClick={() => setTicketType('complaint')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                        ticketType === 'complaint'
                            ? 'border-orange-400 bg-orange-50 text-orange-700'
                            : 'border-gray-200 text-gray-500 hover:border-orange-200'
                    }`}
                >
                    <AlertTriangle size={16} />
                    Complaint Against Client
                </button>
                <button
                    type="button"
                    onClick={() => setTicketType('support')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                        ticketType === 'support'
                            ? 'border-purple-400 bg-purple-50 text-purple-700'
                            : 'border-gray-200 text-gray-500 hover:border-purple-200'
                    }`}
                >
                    <HelpCircle size={16} />
                    Platform Support
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Category */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Category <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setCategory(cat)}
                                className={`px-3 py-1.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                                    category === cat
                                        ? ticketType === 'support'
                                            ? 'border-purple-400 bg-purple-50 text-purple-700'
                                            : 'border-orange-400 bg-orange-50 text-orange-700'
                                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Client search — only for complaints */}
                {ticketType === 'complaint' && (
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Client You're Complaining About <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        {selectedClient ? (
                            <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                                <div className="w-8 h-8 rounded-full bg-orange-200 flex items-center justify-center flex-shrink-0">
                                    <User size={14} className="text-orange-700" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-800">{selectedClient.name}</p>
                                    <p className="text-xs text-gray-500">{selectedClient.mobile}</p>
                                </div>
                                <button type="button" onClick={() => { setSelectedClient(null); setClientSearch(''); }} className="p-1 hover:bg-orange-100 rounded-lg">
                                    <X size={14} className="text-orange-500" />
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                <input
                                    type="text"
                                    value={clientSearch}
                                    onChange={e => setClientSearch(e.target.value)}
                                    placeholder="Search by name or mobile…"
                                    className="w-full pl-9 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                                />
                                {searchingClient && (
                                    <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                                )}
                                {clientResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                                        {clientResults.map(c => (
                                            <button
                                                key={c._id}
                                                type="button"
                                                onClick={() => { setSelectedClient(c); setClientSearch(''); setClientResults([]); }}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50 text-left transition-colors"
                                            >
                                                <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                                                    <User size={12} className="text-orange-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                                                    <p className="text-xs text-gray-500">{c.mobile}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Description */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Describe Your Issue <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        rows={5}
                        required
                        placeholder={
                            ticketType === 'support'
                                ? 'Describe the technical issue or question you need help with…'
                                : 'Describe what happened — include dates, job names, and any relevant details…'
                        }
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">{description.length} characters</p>
                </div>

                {/* Info banners */}
                {ticketType === 'support' && (
                    <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-xs text-purple-700">
                        💡 For urgent technical issues our team typically responds within 24 hours.
                    </div>
                )}
                {ticketType === 'complaint' && category === 'Safety' && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 font-semibold">
                        ⚠️ Safety complaints are treated as high priority and reviewed immediately.
                    </div>
                )}

                <button
                    type="submit"
                    disabled={submitting || !category || !description.trim()}
                    className={`w-full py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2 ${
                        ticketType === 'support'
                            ? 'bg-purple-500 hover:bg-purple-600'
                            : 'bg-orange-500 hover:bg-orange-600'
                    }`}
                >
                    {submitting ? (
                        <><Loader2 size={16} className="animate-spin" /> Submitting…</>
                    ) : (
                        <>{ticketType === 'support' ? <HelpCircle size={16} /> : <AlertTriangle size={16} />}
                        Submit {ticketType === 'support' ? 'Support Request' : 'Complaint'}</>
                    )}
                </button>
            </form>
        </div>
    );
}

// ── Ticket Card ───────────────────────────────────────────────────────────────
function TicketCard({ complaint, onClick }) {
    const unread   = complaint.workerUnread || 0;
    const lastMsg  = complaint.messages?.[complaint.messages.length - 1];
    const lastFrom = lastMsg?.sender === 'admin' ? 'Support Team' : 'You';
    const preview  = lastMsg?.text?.slice(0, 60) + (lastMsg?.text?.length > 60 ? '…' : '');

    return (
        <div
            onClick={onClick}
            className={`bg-white rounded-2xl border shadow-sm p-4 cursor-pointer hover:shadow-md transition-all group ${
                unread > 0 ? 'border-orange-300 bg-orange-50/30' : 'border-gray-100 hover:border-orange-200'
            }`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <TypeChip type={complaint.type} />
                        <StatusBadge status={complaint.status} />
                        <PriorityBadge priority={complaint.priority} />
                        {unread > 0 && (
                            <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                                {unread} new
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-800">{complaint.category}</p>
                        {complaint.againstUserName && (
                            <span className="text-xs text-gray-400">vs {complaint.againstUserName}</span>
                        )}
                    </div>

                    {preview && (
                        <p className="text-xs text-gray-500 mt-1">
                            <span className="font-medium">{lastFrom}:</span> {preview}
                        </p>
                    )}
                </div>

                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <p className="text-[10px] text-gray-400">
                        {new Date(complaint.updatedAt || complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-orange-400 transition-colors" />
                </div>
            </div>

            <div className="flex items-center gap-3 mt-2.5 text-[10px] text-gray-400">
                <span className="flex items-center gap-1">
                    <MessageSquare size={9} />
                    {complaint.messages?.length || 0} messages
                </span>
                <span>
                    Filed {new Date(complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
const WorkerComplaints = () => {
    const [activeTab,    setActiveTab]    = useState('list');   // 'new' | 'list'
    const [threadId,     setThreadId]     = useState(null);      // complaint _id being viewed
    const [complaints,   setComplaints]   = useState([]);
    const [loading,      setLoading]      = useState(true);
    const [filter,       setFilter]       = useState('all');     // 'all' | 'complaint' | 'support' | 'open' | 'resolved'

    const loadComplaints = useCallback(async () => {
        try {
            const { data } = await api.getMyComplaints();
            setComplaints(Array.isArray(data) ? data : []);
        } catch {
            toast.error('Failed to load tickets.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadComplaints(); }, [loadComplaints]);

    const totalUnread = complaints.reduce((s, c) => s + (c.workerUnread || 0), 0);

    const filtered = complaints.filter(c => {
        if (filter === 'complaint') return c.type === 'complaint';
        if (filter === 'support')   return c.type === 'support';
        if (filter === 'open')      return ['submitted', 'in-review'].includes(c.status);
        if (filter === 'resolved')  return ['resolved', 'closed'].includes(c.status);
        return true;
    });

    // Thread view
    if (threadId) {
        return (
            <div className="flex flex-col h-full max-w-2xl mx-auto" style={{ minHeight: '60vh' }}>
                <ThreadView
                    complaintId={threadId}
                    onBack={() => { setThreadId(null); loadComplaints(); }}
                    onUpdate={(updated) => {
                        setComplaints(prev => prev.map(c => c._id === updated._id ? updated : c));
                    }}
                />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-5 pb-20">

            {/* Page header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-800">Help & Complaints</h1>
                <p className="text-gray-500 text-sm mt-0.5">
                    File complaints against clients or get platform support
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab('new')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                        activeTab === 'new'
                            ? 'border-orange-400 bg-orange-50 text-orange-700'
                            : 'border-gray-200 text-gray-500 hover:border-orange-200'
                    }`}
                >
                    <AlertTriangle size={14} />
                    New Ticket
                </button>
                <button
                    onClick={() => setActiveTab('list')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all relative ${
                        activeTab === 'list'
                            ? 'border-orange-400 bg-orange-50 text-orange-700'
                            : 'border-gray-200 text-gray-500 hover:border-orange-200'
                    }`}
                >
                    <MessageSquare size={14} />
                    My Tickets
                    {totalUnread > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                            {totalUnread}
                        </span>
                    )}
                </button>
                <button onClick={loadComplaints} className="ml-auto p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-orange-500 hover:border-orange-200 transition-colors">
                    <RefreshCw size={14} />
                </button>
            </div>

            {/* New ticket form */}
            {activeTab === 'new' && (
                <FileTicketForm
                    onFiled={(newComplaint) => {
                        setComplaints(prev => [newComplaint, ...prev]);
                        setActiveTab('list');
                        setThreadId(newComplaint._id);
                    }}
                />
            )}

            {/* Ticket list */}
            {activeTab === 'list' && (
                <div>
                    {/* Filter chips */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4 no-scrollbar">
                        {[
                            { key: 'all',       label: `All (${complaints.length})` },
                            { key: 'complaint', label: `Complaints (${complaints.filter(c => c.type === 'complaint').length})` },
                            { key: 'support',   label: `Support (${complaints.filter(c => c.type === 'support').length})` },
                            { key: 'open',      label: 'Open' },
                            { key: 'resolved',  label: 'Resolved' },
                        ].map(f => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                                    filter === f.key
                                        ? 'border-orange-400 bg-orange-100 text-orange-700'
                                        : 'border-gray-200 text-gray-500 hover:border-orange-200'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="animate-spin text-orange-400" size={28} />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                            <MessageSquare size={36} className="text-gray-300 mx-auto mb-3" />
                            <p className="font-semibold text-gray-500">
                                {filter === 'all' ? 'No tickets yet' : `No ${filter} tickets`}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                {filter === 'all'
                                    ? 'File a complaint or support request to get started.'
                                    : 'Try a different filter.'}
                            </p>
                            {filter === 'all' && (
                                <button
                                    onClick={() => setActiveTab('new')}
                                    className="mt-4 px-4 py-2 bg-orange-500 text-white text-sm font-bold rounded-xl hover:bg-orange-600 transition-colors"
                                >
                                    + New Ticket
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filtered.map(c => (
                                <TicketCard
                                    key={c._id}
                                    complaint={c}
                                    onClick={() => setThreadId(c._id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default WorkerComplaints;