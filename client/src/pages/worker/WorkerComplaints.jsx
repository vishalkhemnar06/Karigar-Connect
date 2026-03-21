// client/src/pages/worker/WorkerComplaints.jsx
// CHANGES:
//  1. Plain language throughout — simple words workers understand
//  2. Worker can delete their complaint/request within 24 hours
//     (button shown on list card + inside thread, disabled after 24h or after admin replies)
//  3. After filing, worker sees full details of what they sent
//  4. Thread view shows all details (type, category, who it's against, description, date)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '../../api';
import toast from 'react-hot-toast';
import {
    AlertTriangle, CheckCircle, Clock, MessageSquare, ChevronRight,
    Send, X, Search, User, Shield, HelpCircle, RefreshCw,
    ArrowLeft, AlertCircle, Loader2, Trash2,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────
const COMPLAINT_CATEGORIES = ['Client', 'Payment', 'Safety', 'Other'];
const SUPPORT_CATEGORIES   = ['Platform', 'Technical', 'Payment', 'Other'];
const TWENTY_FOUR_HOURS    = 24 * 60 * 60 * 1000;

const STATUS_CONFIG = {
    submitted:   { label: 'Waiting for reply', bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
    'in-review': { label: 'Being reviewed',    bg: 'bg-blue-100',   text: 'text-blue-800',   icon: Clock },
    resolved:    { label: 'Resolved',          bg: 'bg-green-100',  text: 'text-green-800',  icon: CheckCircle },
    closed:      { label: 'Closed',            bg: 'bg-gray-100',   text: 'text-gray-700',   icon: X },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const canDelete = (complaint) => {
    const age         = Date.now() - new Date(complaint.createdAt).getTime();
    const withinTime  = age < TWENTY_FOUR_HOURS;
    const adminSpoke  = complaint.messages?.some(m => m.sender === 'admin');
    return withinTime && !adminSpoke;
};

const timeLeftToDelete = (createdAt) => {
    const msLeft = TWENTY_FOUR_HOURS - (Date.now() - new Date(createdAt).getTime());
    if (msLeft <= 0) return null;
    const h = Math.floor(msLeft / 3600000);
    const m = Math.floor((msLeft % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// ── Badges ────────────────────────────────────────────────────────────────────
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
        <div className={`flex ${isAdmin ? 'justify-start' : 'justify-end'} mb-3`}>
            <div className="max-w-[82%]">
                <p className={`text-[10px] font-semibold mb-1 flex items-center gap-1 ${isAdmin ? 'text-gray-400' : 'justify-end text-orange-400'}`}>
                    {isAdmin
                        ? <><Shield size={9} className="text-orange-500" /> {message.senderName || 'Support Team'}</>
                        : <>{message.senderName || 'You'}</>}
                </p>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    isAdmin
                        ? 'bg-white border border-orange-100 text-gray-800 rounded-tl-sm shadow-sm'
                        : 'bg-orange-500 text-white rounded-tr-sm'
                }`}>
                    {message.text}
                </div>
                <p className={`text-[10px] text-gray-400 mt-1 ${isAdmin ? 'ml-1' : 'text-right mr-1'}`}>
                    {new Date(message.sentAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
            </div>
        </div>
    );
}

// ── Detail Summary Block (shows all filed details) ────────────────────────────
function ComplaintDetailSummary({ complaint }) {
    return (
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 space-y-2.5 text-sm">
            <p className="text-xs font-bold text-orange-700 uppercase tracking-wide mb-1">Your Request Details</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase">Type</p>
                    <TypeChip type={complaint.type} />
                </div>
                <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase">Category</p>
                    <p className="text-gray-800 font-semibold">{complaint.category}</p>
                </div>
                <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase">Status</p>
                    <StatusBadge status={complaint.status} />
                </div>
                <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase">Sent On</p>
                    <p className="text-gray-700 text-xs">{new Date(complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
            </div>
            {complaint.againstUserName && (
                <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase">Complaint Against</p>
                    <p className="text-gray-800 font-semibold">{complaint.againstUserName}</p>
                </div>
            )}
            <div>
                <p className="text-[10px] text-gray-400 font-semibold uppercase mb-1">What You Wrote</p>
                <p className="text-gray-700 leading-relaxed bg-white rounded-lg px-3 py-2 border border-orange-100">{complaint.description}</p>
            </div>
        </div>
    );
}

// ── Thread View ───────────────────────────────────────────────────────────────
function ThreadView({ complaintId, onBack, onUpdate, onDelete }) {
    const [complaint, setComplaint] = useState(null);
    const [loading,   setLoading]   = useState(true);
    const [reply,     setReply]     = useState('');
    const [sending,   setSending]   = useState(false);
    const [deleting,  setDeleting]  = useState(false);
    const bottomRef = useRef(null);

    const load = useCallback(async () => {
        try {
            const { data } = await api.getMyComplaintById(complaintId);
            setComplaint(data);
        } catch { toast.error('Could not load this item.'); }
        finally { setLoading(false); }
    }, [complaintId]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [complaint?.messages?.length]);

    const handleSend = async () => {
        if (!reply.trim()) return;
        setSending(true);
        try {
            const { data } = await api.sendComplaintMessage(complaintId, { text: reply.trim() });
            setComplaint(data.complaint);
            setReply('');
            if (onUpdate) onUpdate(data.complaint);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not send message.');
        } finally { setSending(false); }
    };

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this? This cannot be undone.')) return;
        setDeleting(true);
        try {
            await api.deleteMyComplaint(complaintId);
            toast.success('Deleted.');
            if (onDelete) onDelete(complaintId);
            onBack();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not delete.');
        } finally { setDeleting(false); }
    };

    const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-orange-500" size={28} /></div>;
    if (!complaint) return (
        <div className="text-center py-16 text-gray-400">
            <AlertCircle size={32} className="mx-auto mb-2" />
            <p>Could not load.</p>
            <button onClick={onBack} className="mt-4 text-orange-500 text-sm underline">Go back</button>
        </div>
    );

    const isClosed      = ['resolved', 'closed'].includes(complaint.status);
    const deletable     = canDelete(complaint);
    const timeLeft      = timeLeftToDelete(complaint.createdAt);
    const adminReplied  = complaint.messages?.some(m => m.sender === 'admin');

    return (
        <div className="flex flex-col" style={{ minHeight: '70vh' }}>
            {/* Header */}
            <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-start gap-3 sticky top-0 z-10">
                <button onClick={onBack} className="mt-0.5 p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
                    <ArrowLeft size={18} className="text-gray-600" />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <TypeChip type={complaint.type} />
                        <StatusBadge status={complaint.status} />
                    </div>
                    <p className="text-sm font-bold text-gray-800 mt-1">{complaint.category}</p>
                    {complaint.againstUserName && <p className="text-xs text-gray-400">Against: {complaint.againstUserName}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {deletable && (
                        <button
                            onClick={handleDelete}
                            disabled={deleting}
                            title={`You can delete within 24 hours (${timeLeft} left)`}
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors disabled:opacity-50"
                        >
                            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                    )}
                    <button onClick={load} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        <RefreshCw size={14} className="text-gray-400" />
                    </button>
                </div>
            </div>

            {/* Full detail summary */}
            <div className="px-4 pt-4 pb-2">
                <ComplaintDetailSummary complaint={complaint} />
            </div>

            {/* Delete time info */}
            {timeLeft && !adminReplied && (
                <div className="px-4 py-2">
                    <p className="text-[10px] text-gray-400 bg-gray-50 rounded-lg px-3 py-1.5 inline-block">
                        🕐 You can delete this within {timeLeft}
                    </p>
                </div>
            )}
            {!timeLeft && !adminReplied && (
                <div className="px-4 py-1">
                    <p className="text-[10px] text-gray-400">Cannot delete — more than 24 hours have passed.</p>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 bg-gray-50">
                <p className="text-xs text-center text-gray-400 mb-4 font-semibold">— Conversation —</p>
                {complaint.messages.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-6">No replies yet. We'll get back to you soon.</p>
                ) : (
                    complaint.messages.map((m, i) => <MessageBubble key={m._id || i} message={m} />)
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            {isClosed ? (
                <div className="px-4 py-3 bg-gray-100 border-t border-gray-200 text-center">
                    <p className="text-xs text-gray-500 font-medium">
                        This issue is {complaint.status === 'resolved' ? 'resolved' : 'closed'}. File a new one if you need more help.
                    </p>
                </div>
            ) : (
                <div className="px-4 py-3 bg-white border-t border-gray-100 flex items-end gap-2">
                    <textarea
                        value={reply}
                        onChange={e => setReply(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={2}
                        placeholder="Add more information or ask a question…"
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

// ── New Request Form ──────────────────────────────────────────────────────────
function NewRequestForm({ onFiled }) {
    const [type,        setType]        = useState('complaint');
    const [category,    setCategory]    = useState('');
    const [description, setDescription] = useState('');
    const [submitting,  setSubmitting]  = useState(false);
    const [clientSearch,    setClientSearch]    = useState('');
    const [clientResults,   setClientResults]   = useState([]);
    const [selectedClient,  setSelectedClient]  = useState(null);
    const [searchingClient, setSearchingClient] = useState(false);
    const searchTimer = useRef(null);

    const categories = type === 'support' ? SUPPORT_CATEGORIES : COMPLAINT_CATEGORIES;

    useEffect(() => { setCategory(''); setSelectedClient(null); setClientSearch(''); }, [type]);

    useEffect(() => {
        if (type !== 'complaint' || clientSearch.length < 2) { setClientResults([]); return; }
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(async () => {
            setSearchingClient(true);
            try { const { data } = await api.searchClientForComplaint(clientSearch); setClientResults(data); }
            catch { setClientResults([]); }
            finally { setSearchingClient(false); }
        }, 400);
        return () => clearTimeout(searchTimer.current);
    }, [clientSearch, type]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!category) return toast.error('Please choose a category.');
        if (!description.trim()) return toast.error('Please describe your issue.');
        setSubmitting(true);
        const toastId = toast.loading('Sending…');
        try {
            const { data } = await api.fileComplaint({
                type,
                category,
                description: description.trim(),
                againstUserId: selectedClient?._id,
            });
            toast.success(data.message || 'Sent!', { id: toastId });
            setCategory(''); setDescription(''); setSelectedClient(null); setClientSearch('');
            if (onFiled) onFiled(data.complaint);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not send.', { id: toastId });
        } finally { setSubmitting(false); }
    };

    return (
        <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-5">What do you need help with?</h2>

            {/* Type selector */}
            <div className="flex gap-3 mb-5">
                {[
                    { key: 'complaint', label: 'Report a Problem', icon: AlertTriangle, sub: 'Issue with a client or payment', color: 'orange' },
                    { key: 'support',   label: 'Ask for Help',     icon: HelpCircle,    sub: 'App or account questions',        color: 'purple' },
                ].map(opt => {
                    const Icon = opt.icon;
                    const active = type === opt.key;
                    return (
                        <button
                            key={opt.key}
                            type="button"
                            onClick={() => setType(opt.key)}
                            className={`flex-1 flex flex-col items-center gap-1.5 py-4 px-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                                active
                                    ? opt.color === 'orange'
                                        ? 'border-orange-400 bg-orange-50 text-orange-700'
                                        : 'border-purple-400 bg-purple-50 text-purple-700'
                                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                            }`}
                        >
                            <Icon size={20} className={active ? (opt.color === 'orange' ? 'text-orange-500' : 'text-purple-500') : 'text-gray-400'} />
                            <span>{opt.label}</span>
                            <span className={`text-[10px] font-normal ${active ? 'opacity-80' : 'text-gray-400'}`}>{opt.sub}</span>
                        </button>
                    );
                })}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Category */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {type === 'complaint' ? 'What is the problem about?' : 'What do you need help with?'} <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setCategory(cat)}
                                className={`px-3 py-1.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                                    category === cat
                                        ? type === 'support'
                                            ? 'border-purple-400 bg-purple-50 text-purple-700'
                                            : 'border-orange-400 bg-orange-50 text-orange-700'
                                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                }`}
                            >{cat}</button>
                        ))}
                    </div>
                </div>

                {/* Client search (complaint only) */}
                {type === 'complaint' && (
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Who is this complaint about? <span className="text-gray-400 font-normal text-xs">(optional)</span>
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
                                    placeholder="Search client by name or mobile number…"
                                    className="w-full pl-9 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                                />
                                {searchingClient && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
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
                                                <div>
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
                        Explain your issue in detail <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        rows={5}
                        required
                        placeholder={
                            type === 'support'
                                ? 'What problem are you facing? Include any steps you already tried…'
                                : 'What happened? Include dates, job names, and any other details that can help us…'
                        }
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">{description.length} characters</p>
                </div>

                {/* Safety banner */}
                {type === 'complaint' && category === 'Safety' && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 font-semibold">
                        ⚠️ Safety complaints are treated urgently and reviewed as soon as possible.
                    </div>
                )}

                {/* Info about delete window */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-500">
                    💡 You can delete what you send within 24 hours, as long as we haven't replied yet.
                </div>

                <button
                    type="submit"
                    disabled={submitting || !category || !description.trim()}
                    className={`w-full py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2 ${
                        type === 'support' ? 'bg-purple-500 hover:bg-purple-600' : 'bg-orange-500 hover:bg-orange-600'
                    }`}
                >
                    {submitting
                        ? <><Loader2 size={16} className="animate-spin" /> Sending…</>
                        : type === 'support'
                            ? <><HelpCircle size={16} /> Send Help Request</>
                            : <><AlertTriangle size={16} /> Send Complaint</>}
                </button>
            </form>
        </div>
    );
}

// ── Request Card (list view) ──────────────────────────────────────────────────
function RequestCard({ complaint, onClick, onDelete }) {
    const unread   = complaint.workerUnread || 0;
    const lastMsg  = complaint.messages?.[complaint.messages.length - 1];
    const lastFrom = lastMsg?.sender === 'admin' ? 'Support Team' : 'You';
    const preview  = lastMsg?.text?.slice(0, 65) + (lastMsg?.text?.length > 65 ? '…' : '');
    const deletable = canDelete(complaint);
    const timeLeft  = timeLeftToDelete(complaint.createdAt);

    const handleDeleteClick = async (e) => {
        e.stopPropagation();
        if (!window.confirm('Delete this? It cannot be undone.')) return;
        try {
            await api.deleteMyComplaint(complaint._id);
            toast.success('Deleted.');
            if (onDelete) onDelete(complaint._id);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not delete.');
        }
    };

    return (
        <div
            onClick={onClick}
            className={`bg-white rounded-2xl border p-4 cursor-pointer hover:shadow-md transition-all group ${
                unread > 0 ? 'border-orange-300 bg-orange-50/20' : 'border-gray-100 hover:border-orange-200'
            }`}
        >
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                    <TypeChip type={complaint.type} />
                    <StatusBadge status={complaint.status} />
                    {unread > 0 && (
                        <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                            {unread} new reply{unread > 1 ? 's' : ''}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    {deletable && (
                        <button
                            onClick={handleDeleteClick}
                            title={`Delete (${timeLeft} left)`}
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors"
                        >
                            <Trash2 size={13} />
                        </button>
                    )}
                    <p className="text-[10px] text-gray-400">
                        {new Date(complaint.updatedAt || complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                </div>
            </div>

            <p className="text-sm font-bold text-gray-800">
                {complaint.category}
                {complaint.againstUserName && <span className="font-normal text-gray-500 text-xs ml-2">— {complaint.againstUserName}</span>}
            </p>

            {/* Description preview */}
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{complaint.description}</p>

            {/* Last message preview */}
            {preview && (
                <p className="text-xs text-gray-400 mt-1.5 border-t border-gray-50 pt-1.5">
                    <span className="font-medium text-gray-500">{lastFrom}:</span> {preview}
                </p>
            )}

            <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><MessageSquare size={9} /> {complaint.messages?.length || 0} messages</span>
                <span>{new Date(complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
const WorkerComplaints = () => {
    const [activeTab,  setActiveTab]  = useState('list');
    const [threadId,   setThreadId]   = useState(null);
    const [complaints, setComplaints] = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [filter,     setFilter]     = useState('all');

    const load = useCallback(async () => {
        try {
            const { data } = await api.getMyComplaints();
            setComplaints(Array.isArray(data) ? data : []);
        } catch { toast.error('Could not load your requests.'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleDelete = useCallback((id) => {
        setComplaints(prev => prev.filter(c => c._id !== id));
    }, []);

    const totalUnread = complaints.reduce((s, c) => s + (c.workerUnread || 0), 0);

    const filtered = complaints.filter(c => {
        if (filter === 'complaint') return c.type === 'complaint';
        if (filter === 'support')   return c.type === 'support';
        if (filter === 'open')      return ['submitted', 'in-review'].includes(c.status);
        if (filter === 'done')      return ['resolved', 'closed'].includes(c.status);
        return true;
    });

    // Thread view
    if (threadId) {
        return (
            <div className="max-w-2xl mx-auto pb-10">
                <ThreadView
                    complaintId={threadId}
                    onBack={() => { setThreadId(null); load(); }}
                    onUpdate={(updated) => setComplaints(prev => prev.map(c => c._id === updated._id ? updated : c))}
                    onDelete={handleDelete}
                />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-5 pb-20">

            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-800">Help & Complaints</h1>
                <p className="text-gray-500 text-sm mt-0.5">Report a problem or ask our team for help</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab('new')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                        activeTab === 'new' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500 hover:border-orange-200'
                    }`}
                >
                    <AlertTriangle size={14} />
                    New Request
                </button>
                <button
                    onClick={() => setActiveTab('list')}
                    className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                        activeTab === 'list' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500 hover:border-orange-200'
                    }`}
                >
                    <MessageSquare size={14} />
                    My Requests
                    {totalUnread > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                            {totalUnread}
                        </span>
                    )}
                </button>
                <button onClick={load} className="ml-auto p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-orange-500 hover:border-orange-200 transition-colors">
                    <RefreshCw size={14} />
                </button>
            </div>

            {/* New request form */}
            {activeTab === 'new' && (
                <NewRequestForm
                    onFiled={(newItem) => {
                        setComplaints(prev => [newItem, ...prev]);
                        setActiveTab('list');
                        setThreadId(newItem._id);
                    }}
                />
            )}

            {/* List */}
            {activeTab === 'list' && (
                <div>
                    {/* Filter chips */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4 no-scrollbar">
                        {[
                            { key: 'all',       label: `All (${complaints.length})` },
                            { key: 'complaint', label: `Complaints (${complaints.filter(c => c.type === 'complaint').length})` },
                            { key: 'support',   label: `Help Requests (${complaints.filter(c => c.type === 'support').length})` },
                            { key: 'open',      label: 'Waiting' },
                            { key: 'done',      label: 'Resolved' },
                        ].map(f => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                                    filter === f.key ? 'border-orange-400 bg-orange-100 text-orange-700' : 'border-gray-200 text-gray-500 hover:border-orange-200'
                                }`}
                            >{f.label}</button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-orange-400" size={28} /></div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                            <MessageSquare size={36} className="text-gray-300 mx-auto mb-3" />
                            <p className="font-semibold text-gray-500">
                                {filter === 'all' ? 'No requests yet' : 'Nothing here'}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                {filter === 'all' ? 'Use "New Request" to report a problem or ask for help.' : 'Try a different filter.'}
                            </p>
                            {filter === 'all' && (
                                <button
                                    onClick={() => setActiveTab('new')}
                                    className="mt-4 px-4 py-2 bg-orange-500 text-white text-sm font-bold rounded-xl hover:bg-orange-600 transition-colors"
                                >
                                    + New Request
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filtered.map(c => (
                                <RequestCard
                                    key={c._id}
                                    complaint={c}
                                    onClick={() => setThreadId(c._id)}
                                    onDelete={handleDelete}
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