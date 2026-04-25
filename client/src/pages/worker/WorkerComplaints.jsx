import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '../../api';
import toast from 'react-hot-toast';
import {
    AlertTriangle, CheckCircle, Clock, MessageSquare, ChevronRight,
    Send, X, Search, User, Shield, HelpCircle, RefreshCw,
    ArrowLeft, AlertCircle, Loader2, Trash2, Mail, Star, 
    Bell, Calendar, MoreVertical, Sparkles, Plus, 
    MessageCircle, Flag, LifeBuoy, Smile, Heart,
    Award, TrendingUp, Crown, Diamond, Zap, Gift
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Constants ─────────────────────────────────────────────────────────────────
const COMPLAINT_CATEGORIES = ['Client', 'Payment', 'Safety', 'Other'];
const SUPPORT_CATEGORIES   = ['Platform', 'Technical', 'Payment', 'Other'];
const TWENTY_FOUR_HOURS    = 24 * 60 * 60 * 1000;

const STATUS_CONFIG = {
    submitted:   { label: 'Waiting for reply', bg: 'bg-amber-100', text: 'text-amber-800', icon: Clock, gradient: 'from-amber-500 to-orange-500' },
    'in-review': { label: 'Being reviewed',    bg: 'bg-blue-100',   text: 'text-blue-800',   icon: Clock, gradient: 'from-blue-500 to-indigo-500' },
    resolved:    { label: 'Resolved',          bg: 'bg-emerald-100',  text: 'text-emerald-800',  icon: CheckCircle, gradient: 'from-emerald-500 to-teal-500' },
    closed:      { label: 'Closed',            bg: 'bg-gray-100',   text: 'text-gray-700',   icon: X, gradient: 'from-gray-500 to-gray-600' },
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

// ── Enhanced Badges ────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.submitted;
    const Icon = cfg.icon;
    return (
        <motion.span 
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className={`inline-flex items-center gap-1.5 text-[10px] md:text-xs font-bold px-2.5 md:px-3 py-1 md:py-1.5 rounded-full ${cfg.bg} ${cfg.text} shadow-sm border border-current/10`}
        >
            <Icon size={10} className="md:size-3" />
            <span>{cfg.label}</span>
        </motion.span>
    );
}

function TypeChip({ type }) {
    return type === 'support'
        ? (
            <motion.span 
                whileHover={{ scale: 1.05 }}
                className="inline-flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold px-2.5 md:px-3 py-1 md:py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md"
            >
                <LifeBuoy size={10} className="md:size-3" /> Help Request
            </motion.span>
        ) : (
            <motion.span 
                whileHover={{ scale: 1.05 }}
                className="inline-flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold px-2.5 md:px-3 py-1 md:py-1.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md"
            >
                <Flag size={10} className="md:size-3" /> Complaint
            </motion.span>
        );
}

// ── Enhanced Message Bubble ────────────────────────────────────────────────────
function MessageBubble({ message }) {
    const isAdmin = message.sender === 'admin';
    return (
        <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3 }}
            className={`flex ${isAdmin ? 'justify-start' : 'justify-end'} mb-4`}
        >
            <div className={`max-w-[85%] ${isAdmin ? 'mr-auto' : 'ml-auto'}`}>
                <div className="flex items-center gap-2 mb-1.5">
                    {isAdmin && (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center shadow-sm">
                            <Shield size={12} className="text-white" />
                        </div>
                    )}
                    <p className={`text-[10px] md:text-xs font-bold ${isAdmin ? 'text-gray-600' : 'text-orange-600'}`}>
                        {isAdmin ? 'Support Team' : 'You'}
                    </p>
                    <p className="text-[8px] md:text-[9px] text-gray-400">
                        {new Date(message.sentAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
                <div className={`px-4 py-3 rounded-xl text-xs md:text-sm leading-relaxed shadow-md ${
                    isAdmin
                        ? 'bg-white border border-gray-100 text-gray-700 rounded-tl-none'
                        : 'bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-tr-none'
                }`}>
                    {message.text}
                </div>
            </div>
        </motion.div>
    );
}

// ── Enhanced Detail Summary Block ──────────────────────────────────────────────
function ComplaintDetailSummary({ complaint }) {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-5 shadow-md"
        >
            <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center shadow-md">
                    <Mail size={14} className="text-white" />
                </div>
                <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">Request Details</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white/60 rounded-lg p-3">
                    <p className="text-[9px] text-gray-500 font-bold uppercase mb-1">Type</p>
                    <TypeChip type={complaint.type} />
                </div>
                <div className="bg-white/60 rounded-lg p-3">
                    <p className="text-[9px] text-gray-500 font-bold uppercase mb-1">Category</p>
                    <p className="text-gray-800 font-bold text-sm">{complaint.category}</p>
                </div>
                <div className="bg-white/60 rounded-lg p-3">
                    <p className="text-[9px] text-gray-500 font-bold uppercase mb-1">Status</p>
                    <StatusBadge status={complaint.status} />
                </div>
                <div className="bg-white/60 rounded-lg p-3">
                    <p className="text-[9px] text-gray-500 font-bold uppercase mb-1">Sent On</p>
                    <p className="text-gray-700 text-xs font-semibold">
                        {new Date(complaint.createdAt).toLocaleDateString('en-IN', { 
                            day: 'numeric', 
                            month: 'short', 
                            year: 'numeric' 
                        })}
                    </p>
                </div>
            </div>
            
            {complaint.againstUserName && (
                <div className="bg-white/60 rounded-lg p-3 mb-4">
                    <p className="text-[9px] text-gray-500 font-bold uppercase mb-1">Complaint Against</p>
                    <p className="text-gray-800 font-bold flex items-center gap-2 text-sm">
                        <User size={14} className="text-orange-500" />
                        {complaint.againstUserName}
                    </p>
                </div>
            )}
            
            <div className="bg-white rounded-lg p-4">
                <p className="text-[9px] text-gray-500 font-bold uppercase mb-2">Description</p>
                <p className="text-gray-700 text-sm leading-relaxed">{complaint.description}</p>
            </div>
        </motion.div>
    );
}

// ── Enhanced Thread View ───────────────────────────────────────────────────────
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
            toast.success('Deleted successfully.');
            if (onDelete) onDelete(complaintId);
            onBack();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not delete.');
        } finally { setDeleting(false); }
    };

    const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-96">
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full"
            />
            <p className="mt-4 text-gray-500 font-semibold">Loading conversation...</p>
        </div>
    );
    
    if (!complaint) return (
        <div className="text-center py-20 bg-white rounded-xl shadow-lg">
            <AlertCircle size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 font-semibold">Could not load this request.</p>
            <button onClick={onBack} className="mt-6 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-semibold text-sm hover:shadow-lg transition-all">
                Go back
            </button>
        </div>
    );

    const isClosed      = ['resolved', 'closed'].includes(complaint.status);
    const deletable     = canDelete(complaint);
    const timeLeft      = timeLeftToDelete(complaint.createdAt);
    const adminReplied  = complaint.messages?.some(m => m.sender === 'admin');

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col bg-white rounded-xl shadow-xl overflow-hidden w-full"
            style={{ minHeight: '85vh' }}
        >
            {/* Enhanced Header */}
            <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 px-6 py-5 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack} 
                        className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-all"
                    >
                        <ArrowLeft size={20} className="text-white" />
                    </button>
                    <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap mb-2">
                            <TypeChip type={complaint.type} />
                            <StatusBadge status={complaint.status} />
                        </div>
                        <p className="text-white font-bold text-lg truncate">{complaint.category}</p>
                        {complaint.againstUserName && (
                            <p className="text-white/80 text-sm mt-1 truncate">Against: {complaint.againstUserName}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {deletable && (
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={handleDelete}
                                disabled={deleting}
                                title={`You can delete within 24 hours (${timeLeft} left)`}
                                className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-all"
                            >
                                {deleting ? <Loader2 size="18" className="animate-spin text-white" /> : <Trash2 size="18" className="text-white" />}
                            </motion.button>
                        )}
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={load}
                            className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-all"
                        >
                            <RefreshCw size="18" className="text-white" />
                        </motion.button>
                    </div>
                </div>
            </div>

            {/* Detail summary */}
            <div className="px-6 pt-6 pb-4 bg-white">
                <ComplaintDetailSummary complaint={complaint} />
            </div>

            {/* Delete info */}
            {timeLeft && !adminReplied && (
                <div className="px-6 py-3 bg-amber-50 border-b border-amber-100">
                    <p className="text-xs text-amber-700 font-semibold flex items-center gap-2">
                        <Clock size="14" />
                        You can delete this within {timeLeft}
                    </p>
                </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-6 py-6 bg-gradient-to-b from-gray-50 to-white">
                <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full">
                        <MessageCircle size="14" className="text-gray-500" />
                        <p className="text-xs text-gray-500 font-semibold">Conversation Thread</p>
                    </div>
                </div>
                
                {complaint.messages.length === 0 ? (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-16"
                    >
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <MessageSquare size="28" className="text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-semibold">No replies yet</p>
                        <p className="text-sm text-gray-400 mt-1">We'll get back to you soon</p>
                    </motion.div>
                ) : (
                    complaint.messages.map((m, i) => <MessageBubble key={m._id || i} message={m} />)
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input Area */}
            {isClosed ? (
                <div className="px-6 py-5 bg-gray-100 border-t border-gray-200 text-center">
                    <p className="text-gray-600 font-semibold">
                        This issue is {complaint.status === 'resolved' ? 'resolved' : 'closed'}. 
                        File a new one if you need more help.
                    </p>
                </div>
            ) : (
                <div className="px-6 py-4 bg-white border-t border-gray-100">
                    <div className="flex gap-3">
                        <textarea
                            value={reply}
                            onChange={e => setReply(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={2}
                            placeholder="Type your message here..."
                            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 resize-none transition-all"
                        />
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={handleSend}
                            disabled={sending || !reply.trim()}
                            className="px-5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl disabled:opacity-50 transition-all shadow-md h-fit py-3"
                        >
                            {sending ? <Loader2 size="18" className="animate-spin" /> : <Send size="18" />}
                        </motion.button>
                    </div>
                </div>
            )}
        </motion.div>
    );
}

// ── Enhanced New Request Form ──────────────────────────────────────────────────
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
        const toastId = toast.loading('Sending your request...');
        try {
            const { data } = await api.fileComplaint({
                type,
                category,
                description: description.trim(),
                againstUserId: selectedClient?._id,
            });
            toast.success('Sent successfully!', { id: toastId });
            setCategory(''); setDescription(''); setSelectedClient(null); setClientSearch('');
            if (onFiled) onFiled(data.complaint);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not send.', { id: toastId });
        } finally { setSubmitting(false); }
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-xl overflow-hidden"
        >
            <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 px-6 py-5">
                <h2 className="text-xl font-bold text-white">File a New Request</h2>
                <p className="text-white/85 text-sm mt-1">We're here for you 24/7. Let us help!</p>
            </div>
            
            <div className="p-6">
                {/* Type selector */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    {[
                        { key: 'complaint', label: 'Report a Problem', icon: Flag, sub: 'Issue with a client', color: 'orange' },
                        { key: 'support',   label: 'Ask for Help',     icon: LifeBuoy, sub: 'App or account', color: 'purple' },
                    ].map(opt => {
                        const Icon = opt.icon;
                        const active = type === opt.key;
                        return (
                            <motion.button
                                key={opt.key}
                                whileTap={{ scale: 0.95 }}
                                type="button"
                                onClick={() => setType(opt.key)}
                                className={`relative p-5 rounded-xl border-2 transition-all ${
                                    active
                                        ? opt.color === 'orange'
                                            ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-amber-50 shadow-md'
                                            : 'border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 shadow-md'
                                        : 'border-gray-200 hover:border-gray-300 bg-white'
                                }`}
                            >
                                <Icon size={28} className={`mx-auto mb-2 ${active ? (opt.color === 'orange' ? 'text-orange-500' : 'text-purple-500') : 'text-gray-400'}`} />
                                <p className={`text-sm font-bold ${active ? (opt.color === 'orange' ? 'text-orange-700' : 'text-purple-700') : 'text-gray-600'}`}>
                                    {opt.label}
                                </p>
                                <p className={`text-xs mt-1 hidden sm:block ${active ? 'opacity-80' : 'text-gray-400'}`}>
                                    {opt.sub}
                                </p>
                                {active && (
                                    <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${opt.color === 'orange' ? 'bg-orange-500' : 'bg-purple-500'}`} />
                                )}
                            </motion.button>
                        );
                    })}
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Category */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            {type === 'complaint' ? 'What is the problem about?' : 'What do you need help with?'} <span className="text-red-500">*</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {categories.map(cat => (
                                <motion.button
                                    key={cat}
                                    whileTap={{ scale: 0.95 }}
                                    type="button"
                                    onClick={() => setCategory(cat)}
                                    className={`px-4 py-2 rounded-lg text-xs font-semibold border-2 transition-all ${
                                        category === cat
                                            ? type === 'support'
                                                ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm'
                                                : 'border-orange-500 bg-orange-50 text-orange-700 shadow-sm'
                                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                    }`}
                                >{cat}</motion.button>
                            ))}
                        </div>
                    </div>

                    {/* Client search */}
                    {type === 'complaint' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                Who is this complaint about? <span className="text-gray-400 font-normal text-[10px]">(optional)</span>
                            </label>
                            {selectedClient ? (
                                <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center shadow-sm">
                                        <User size="16" className="text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-800 truncate">{selectedClient.name}</p>
                                        <p className="text-xs text-gray-500 truncate">{selectedClient.mobile}</p>
                                    </div>
                                    <button type="button" onClick={() => { setSelectedClient(null); setClientSearch(''); }} className="p-1 hover:bg-orange-100 rounded-full transition-colors">
                                        <X size="14" className="text-orange-500" />
                                    </button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <Search size="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={clientSearch}
                                        onChange={e => setClientSearch(e.target.value)}
                                        placeholder="Search by name or mobile..."
                                        className="w-full pl-9 pr-8 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                                    />
                                    {searchingClient && <Loader2 size="14" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
                                    {clientResults.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden max-h-48 overflow-y-auto">
                                            {clientResults.map(c => (
                                                <button
                                                    key={c._id}
                                                    type="button"
                                                    onClick={() => { setSelectedClient(c); setClientSearch(''); setClientResults([]); }}
                                                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-orange-50 text-left transition-colors"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
                                                        <User size="12" className="text-white" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-gray-800 truncate">{c.name}</p>
                                                        <p className="text-xs text-gray-500 truncate">{c.mobile}</p>
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
                        <label className="block text-sm font-bold text-gray-700 mb-2">
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
                                    : 'What happened? Include dates, job names, and any other details…'
                            }
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 resize-none transition-all"
                        />
                        <p className="text-xs text-gray-400 mt-1 flex justify-end">{description.length} characters</p>
                    </div>

                    {/* Safety banner */}
                    {type === 'complaint' && category === 'Safety' && (
                        <motion.div 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-red-50 border border-red-200 rounded-xl p-4"
                        >
                            <p className="text-sm text-red-700 font-semibold flex items-center gap-2">
                                <AlertTriangle size="18" />
                                Safety complaints are treated urgently.
                            </p>
                        </motion.div>
                    )}

                    {/* Info banner */}
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-4">
                        <p className="text-xs text-gray-600 flex items-center gap-2 font-medium">
                            <Clock size="14" />
                            You can delete what you send within 24 hours, as long as we haven't replied yet.
                        </p>
                    </div>

                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        type="submit"
                        disabled={submitting || !category || !description.trim()}
                        className={`w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-md ${
                            type === 'support' 
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600' 
                                : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600'
                        }`}
                    >
                        {submitting
                            ? <><Loader2 size="16" className="animate-spin" /> Sending...</>
                            : type === 'support'
                                ? <><LifeBuoy size="16" /> Send Help Request</>
                                : <><Flag size="16" /> Send Complaint</>}
                    </motion.button>
                </form>
            </div>
        </motion.div>
    );
}

// ── Enhanced Request Card ──────────────────────────────────────────────────────
function RequestCard({ complaint, onClick, onDelete }) {
    const unread   = complaint.workerUnread || 0;
    const lastMsg  = complaint.messages?.[complaint.messages.length - 1];
    const lastFrom = lastMsg?.sender === 'admin' ? 'Support Team' : 'You';
    const preview  = lastMsg?.text?.slice(0, 50) + (lastMsg?.text?.length > 50 ? '…' : '');
    const deletable = canDelete(complaint);
    const timeLeft  = timeLeftToDelete(complaint.createdAt);

    const handleDeleteClick = async (e) => {
        e.stopPropagation();
        if (!window.confirm('Delete this? It cannot be undone.')) return;
        try {
            await api.deleteMyComplaint(complaint._id);
            toast.success('Deleted successfully.');
            if (onDelete) onDelete(complaint._id);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not delete.');
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            onClick={onClick}
            className={`bg-white rounded-xl border-2 p-5 cursor-pointer transition-all shadow-md hover:shadow-xl ${
                unread > 0 ? 'border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50' : 'border-gray-100 hover:border-orange-200'
            }`}
        >
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <TypeChip type={complaint.type} />
                    <StatusBadge status={complaint.status} />
                    {unread > 0 && (
                        <motion.span 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm"
                        >
                            {unread} new
                        </motion.span>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {deletable && (
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={handleDeleteClick}
                            title={`Delete (${timeLeft} left)`}
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-all"
                        >
                            <Trash2 size="12" />
                        </motion.button>
                    )}
                    <p className="text-xs text-gray-400 font-semibold">
                        {new Date(complaint.updatedAt || complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                </div>
            </div>

            <p className="text-base font-bold text-gray-800 mb-1 truncate">
                {complaint.category}
                {complaint.againstUserName && (
                    <span className="font-normal text-gray-500 text-xs ml-2">— {complaint.againstUserName}</span>
                )}
            </p>

            <p className="text-sm text-gray-600 mt-2 line-clamp-2 leading-relaxed">{complaint.description}</p>

            {preview && (
                <div className="mt-3 pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                        <span className="font-bold text-gray-600">{lastFrom}:</span> {preview}
                    </p>
                </div>
            )}

            <div className="flex items-center gap-4 mt-3 pt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1.5">
                    <MessageSquare size="12" /> {complaint.messages?.length || 0} messages
                </span>
                <span className="flex items-center gap-1.5">
                    <Calendar size="12" /> {new Date(complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
            </div>
        </motion.div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
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

    if (threadId) {
        return (
            <div className="w-full pb-20 px-4 md:px-6">
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
        <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 pb-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-8">
                
                {/* Hero Header */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    data-guide-id="worker-page-support"
                    className="mb-8"
                >
                    <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-xl">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                    <LifeBuoy size="24" className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black">Help & Support Center</h1>
                                    <p className="text-white/90 text-sm mt-0.5">File complaints or get support</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="bg-white/15 rounded-xl px-3 py-1.5 text-center">
                                    <p className="text-xl font-bold">{complaints.length}</p>
                                    <p className="text-[10px] text-white/80">Total Requests</p>
                                </div>
                                <div className="bg-white/15 rounded-xl px-3 py-1.5 text-center">
                                    <p className="text-xl font-bold">{totalUnread}</p>
                                    <p className="text-[10px] text-white/80">Unread</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Action Buttons */}
                <div className="flex gap-3 mb-6">
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setActiveTab('new')}
                        className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all shadow-md flex-1 justify-center ${
                            activeTab === 'new' 
                                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg' 
                                : 'bg-white text-gray-600 hover:shadow-lg border border-gray-200'
                        }`}
                    >
                        <Plus size="16" />
                        New Request
                    </motion.button>
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setActiveTab('list')}
                        className={`relative flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all shadow-md flex-1 justify-center ${
                            activeTab === 'list' 
                                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg' 
                                : 'bg-white text-gray-600 hover:shadow-lg border border-gray-200'
                        }`}
                    >
                        <MessageSquare size="16" />
                        All Requests
                        {totalUnread > 0 && (
                            <motion.span 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
                            >
                                {totalUnread}
                            </motion.span>
                        )}
                    </motion.button>
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={load}
                        className="p-3 rounded-xl bg-white hover:shadow-lg transition-all border border-gray-200"
                    >
                        <RefreshCw size="16" className="text-gray-600" />
                    </motion.button>
                </div>

                {/* Content */}
                <AnimatePresence mode="wait">
                    {activeTab === 'new' && (
                        <motion.div
                            key="new"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <NewRequestForm
                                onFiled={(newItem) => {
                                    setComplaints(prev => [newItem, ...prev]);
                                    setActiveTab('list');
                                    setThreadId(newItem._id);
                                }}
                            />
                        </motion.div>
                    )}

                    {activeTab === 'list' && (
                        <motion.div
                            key="list"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            {/* Filter Chips */}
                            <div className="overflow-x-auto no-scrollbar -mx-4 px-4 pb-2 mb-5">
                                <div className="flex items-center gap-2 min-w-max">
                                    {[
                                        { key: 'all', label: 'All', count: complaints.length, icon: Star },
                                        { key: 'complaint', label: 'Complaints', count: complaints.filter(c => c.type === 'complaint').length, icon: Flag },
                                        { key: 'support', label: 'Help', count: complaints.filter(c => c.type === 'support').length, icon: LifeBuoy },
                                        { key: 'open', label: 'Open', count: complaints.filter(c => ['submitted', 'in-review'].includes(c.status)).length, icon: Clock },
                                        { key: 'done', label: 'Resolved', count: complaints.filter(c => ['resolved', 'closed'].includes(c.status)).length, icon: CheckCircle },
                                    ].map(f => {
                                        const Icon = f.icon;
                                        const isActive = filter === f.key;
                                        return (
                                            <motion.button
                                                key={f.key}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => setFilter(f.key)}
                                                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                                                    isActive 
                                                        ? 'border-orange-500 bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm' 
                                                        : 'border-gray-200 bg-white text-gray-600 hover:border-orange-300'
                                                }`}
                                            >
                                                <Icon size="12" />
                                                {f.label}
                                                {f.count > 0 && (
                                                    <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                                                        isActive ? 'bg-white/20' : 'bg-gray-100'
                                                    }`}>
                                                        {f.count}
                                                    </span>
                                                )}
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            </div>

                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl shadow-lg">
                                    <Loader2 size="40" className="animate-spin text-orange-500 mb-4" />
                                    <p className="text-gray-500 font-semibold">Loading your requests...</p>
                                </div>
                            ) : filtered.length === 0 ? (
                                <motion.div 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-center py-20 bg-white rounded-xl shadow-lg"
                                >
                                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <MessageCircle size="32" className="text-gray-400" />
                                    </div>
                                    <p className="font-bold text-gray-600 text-lg">
                                        {filter === 'all' ? 'No requests yet' : 'Nothing here'}
                                    </p>
                                    <p className="text-sm text-gray-400 mt-2">
                                        {filter === 'all' ? 'Click "New Request" to get help' : 'Try a different filter'}
                                    </p>
                                    {filter === 'all' && (
                                        <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => setActiveTab('new')}
                                            className="mt-6 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-bold rounded-lg hover:shadow-lg transition-all inline-flex items-center gap-2"
                                        >
                                            <Plus size="14" /> New Request
                                        </motion.button>
                                    )}
                                </motion.div>
                            ) : (
                                <div className="space-y-4">
                                    {filtered.map((c) => (
                                        <RequestCard
                                            key={c._id}
                                            complaint={c}
                                            onClick={() => setThreadId(c._id)}
                                            onDelete={handleDelete}
                                        />
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default WorkerComplaints;