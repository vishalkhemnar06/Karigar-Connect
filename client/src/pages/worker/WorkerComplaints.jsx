// client/src/pages/worker/WorkerComplaints.jsx
// ENHANCED UI VERSION - All original functionality preserved
// Enhanced with: Modern gradients, animations, glassmorphism, better spacing, micro-interactions

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '../../api';
import toast from 'react-hot-toast';
import {
    AlertTriangle, CheckCircle, Clock, MessageSquare, ChevronRight,
    Send, X, Search, User, Shield, HelpCircle, RefreshCw,
    ArrowLeft, AlertCircle, Loader2, Trash2, Mail, Star, 
    Bell, Calendar, MoreVertical, Sparkles, Plus, 
    MessageCircle, Flag, LifeBuoy, Smile
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
            className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${cfg.bg} ${cfg.text} shadow-sm`}
        >
            <Icon size={12} className="animate-pulse" />
            <span>{cfg.label}</span>
        </motion.span>
    );
}

function TypeChip({ type }) {
    return type === 'support'
        ? (
            <motion.span 
                whileHover={{ scale: 1.05 }}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md"
            >
                <LifeBuoy size={10} /> Help Request
            </motion.span>
        ) : (
            <motion.span 
                whileHover={{ scale: 1.05 }}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md"
            >
                <Flag size={10} /> Complaint
            </motion.span>
        );
}

// ── Enhanced Message Bubble ────────────────────────────────────────────────────
function MessageBubble({ message }) {
    const isAdmin = message.sender === 'admin';
    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${isAdmin ? 'justify-start' : 'justify-end'} mb-4`}
        >
            <div className={`max-w-[85%] ${isAdmin ? 'mr-auto' : 'ml-auto'}`}>
                <div className="flex items-center gap-2 mb-1.5">
                    {isAdmin && (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center shadow-sm">
                            <Shield size={12} className="text-white" />
                        </div>
                    )}
                    <p className={`text-[11px] font-bold ${isAdmin ? 'text-gray-600' : 'text-orange-600'}`}>
                        {isAdmin ? 'Support Team' : 'You'}
                    </p>
                </div>
                <div className={`px-5 py-3 rounded-2xl text-sm leading-relaxed shadow-md ${
                    isAdmin
                        ? 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'
                        : 'bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-tr-none'
                }`}>
                    {message.text}
                </div>
                <p className={`text-[10px] text-gray-400 mt-1.5 ${isAdmin ? 'ml-2' : 'text-right mr-2'}`}>
                    {new Date(message.sentAt).toLocaleString('en-IN', { 
                        day: 'numeric', 
                        month: 'short', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    })}
                </p>
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
            className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 rounded-2xl p-5 shadow-lg"
        >
            <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center shadow-md">
                    <Mail size={14} className="text-white" />
                </div>
                <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">Your Request Details</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white/60 rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Type</p>
                    <TypeChip type={complaint.type} />
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Category</p>
                    <p className="text-gray-800 font-bold text-sm">{complaint.category}</p>
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Status</p>
                    <StatusBadge status={complaint.status} />
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Sent On</p>
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
                <div className="bg-white/60 rounded-xl p-3 mb-4">
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Complaint Against</p>
                    <p className="text-gray-800 font-bold flex items-center gap-2">
                        <User size={14} className="text-orange-500" />
                        {complaint.againstUserName}
                    </p>
                </div>
            )}
            
            <div className="bg-white rounded-xl p-4">
                <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">What You Wrote</p>
                <p className="text-gray-700 leading-relaxed">{complaint.description}</p>
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
        <div className="text-center py-20 bg-white rounded-2xl shadow-lg">
            <AlertCircle size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 font-semibold">Could not load this request.</p>
            <button onClick={onBack} className="mt-6 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all">
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
            className="flex flex-col bg-gray-50 rounded-2xl shadow-xl overflow-hidden"
            style={{ minHeight: '80vh' }}
        >
            {/* Enhanced Header */}
            <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onBack} 
                        className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-all backdrop-blur-sm"
                    >
                        <ArrowLeft size={20} className="text-white" />
                    </button>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <TypeChip type={complaint.type} />
                            <StatusBadge status={complaint.status} />
                        </div>
                        <p className="text-white font-bold text-lg">{complaint.category}</p>
                        {complaint.againstUserName && (
                            <p className="text-white/80 text-xs mt-1">Against: {complaint.againstUserName}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {deletable && (
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleDelete}
                                disabled={deleting}
                                title={`You can delete within 24 hours (${timeLeft} left)`}
                                className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-all backdrop-blur-sm"
                            >
                                {deleting ? <Loader2 size={18} className="animate-spin text-white" /> : <Trash2 size={18} className="text-white" />}
                            </motion.button>
                        )}
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={load}
                            className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-all backdrop-blur-sm"
                        >
                            <RefreshCw size={18} className="text-white" />
                        </motion.button>
                    </div>
                </div>
            </div>

            {/* Full detail summary */}
            <div className="px-6 pt-6 pb-4 bg-white">
                <ComplaintDetailSummary complaint={complaint} />
            </div>

            {/* Delete time info */}
            {timeLeft && !adminReplied && (
                <div className="px-6 py-3 bg-amber-50 border-b border-amber-100">
                    <p className="text-xs text-amber-700 font-semibold flex items-center gap-2">
                        <Clock size={12} />
                        🕐 You can delete this within {timeLeft}
                    </p>
                </div>
            )}
            {!timeLeft && !adminReplied && (
                <div className="px-6 py-3 bg-gray-50">
                    <p className="text-xs text-gray-500">Cannot delete — more than 24 hours have passed.</p>
                </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-6 py-6 bg-gradient-to-b from-gray-50 to-white">
                <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full">
                        <MessageCircle size={12} className="text-gray-500" />
                        <p className="text-xs text-gray-500 font-semibold">Conversation</p>
                    </div>
                </div>
                
                {complaint.messages.length === 0 ? (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-12"
                    >
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <MessageSquare size={24} className="text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-500">No replies yet. We'll get back to you soon.</p>
                    </motion.div>
                ) : (
                    complaint.messages.map((m, i) => <MessageBubble key={m._id || i} message={m} />)
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input Area */}
            {isClosed ? (
                <div className="px-6 py-4 bg-gray-100 border-t border-gray-200 text-center">
                    <p className="text-sm text-gray-600 font-semibold">
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
                            className="flex-1 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200 resize-none transition-all"
                        />
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleSend}
                            disabled={sending || !reply.trim()}
                            className="px-5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-2xl disabled:opacity-50 transition-all shadow-md"
                        >
                            {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
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
            className="bg-white rounded-3xl shadow-xl overflow-hidden"
        >
            <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4">
                <h2 className="text-xl font-bold text-white">Need Help?</h2>
                <p className="text-white/80 text-sm mt-1">We're here for you 24/7</p>
            </div>
            
            <div className="p-6">
                {/* Type selector */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                    {[
                        { key: 'complaint', label: 'Report a Problem', icon: Flag, sub: 'Issue with a client or payment', color: 'orange' },
                        { key: 'support',   label: 'Ask for Help',     icon: LifeBuoy,    sub: 'App or account questions',        color: 'purple' },
                    ].map(opt => {
                        const Icon = opt.icon;
                        const active = type === opt.key;
                        return (
                            <motion.button
                                key={opt.key}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="button"
                                onClick={() => setType(opt.key)}
                                className={`relative p-4 rounded-2xl border-2 transition-all ${
                                    active
                                        ? opt.color === 'orange'
                                            ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-amber-50 shadow-lg'
                                            : 'border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 shadow-lg'
                                        : 'border-gray-200 hover:border-gray-300 bg-white'
                                }`}
                            >
                                <Icon size={24} className={`mx-auto mb-2 ${active ? (opt.color === 'orange' ? 'text-orange-500' : 'text-purple-500') : 'text-gray-400'}`} />
                                <p className={`text-sm font-bold ${active ? (opt.color === 'orange' ? 'text-orange-700' : 'text-purple-700') : 'text-gray-600'}`}>
                                    {opt.label}
                                </p>
                                <p className={`text-[10px] mt-1 ${active ? 'opacity-80' : 'text-gray-400'}`}>
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
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    type="button"
                                    onClick={() => setCategory(cat)}
                                    className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                                        category === cat
                                            ? type === 'support'
                                                ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-md'
                                                : 'border-orange-500 bg-orange-50 text-orange-700 shadow-md'
                                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                    }`}
                                >{cat}</motion.button>
                            ))}
                        </div>
                    </div>

                    {/* Client search (complaint only) */}
                    {type === 'complaint' && (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                Who is this complaint about? <span className="text-gray-400 font-normal text-xs">(optional)</span>
                            </label>
                            {selectedClient ? (
                                <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 rounded-2xl">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center shadow-md">
                                        <User size={16} className="text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-gray-800">{selectedClient.name}</p>
                                        <p className="text-xs text-gray-500">{selectedClient.mobile}</p>
                                    </div>
                                    <button type="button" onClick={() => { setSelectedClient(null); setClientSearch(''); }} className="p-2 hover:bg-orange-100 rounded-full transition-colors">
                                        <X size={16} className="text-orange-500" />
                                    </button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={clientSearch}
                                        onChange={e => setClientSearch(e.target.value)}
                                        placeholder="Search client by name or mobile number..."
                                        className="w-full pl-11 pr-4 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200 transition-all"
                                    />
                                    {searchingClient && <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
                                    {clientResults.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-200 rounded-2xl shadow-xl z-20 overflow-hidden">
                                            {clientResults.map(c => (
                                                <button
                                                    key={c._id}
                                                    type="button"
                                                    onClick={() => { setSelectedClient(c); setClientSearch(''); setClientResults([]); }}
                                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-50 text-left transition-colors"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
                                                        <User size={12} className="text-white" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-800">{c.name}</p>
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
                                    : 'What happened? Include dates, job names, and any other details that can help us…'
                            }
                            className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200 resize-none transition-all"
                        />
                        <p className="text-xs text-gray-400 mt-2 flex justify-end">{description.length} characters</p>
                    </div>

                    {/* Safety banner */}
                    {type === 'complaint' && category === 'Safety' && (
                        <motion.div 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-red-50 border-2 border-red-200 rounded-2xl p-4"
                        >
                            <p className="text-sm text-red-700 font-semibold flex items-center gap-2">
                                <AlertTriangle size={16} />
                                ⚠️ Safety complaints are treated urgently and reviewed as soon as possible.
                            </p>
                        </motion.div>
                    )}

                    {/* Info about delete window */}
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-2xl p-4">
                        <p className="text-xs text-gray-600 flex items-center gap-2">
                            <Clock size={12} />
                            💡 You can delete what you send within 24 hours, as long as we haven't replied yet.
                        </p>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={submitting || !category || !description.trim()}
                        className={`w-full py-4 rounded-2xl font-bold text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg ${
                            type === 'support' 
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600' 
                                : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600'
                        }`}
                    >
                        {submitting
                            ? <><Loader2 size={18} className="animate-spin" /> Sending...</>
                            : type === 'support'
                                ? <><LifeBuoy size={18} /> Send Help Request</>
                                : <><Flag size={18} /> Send Complaint</>}
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
    const preview  = lastMsg?.text?.slice(0, 65) + (lastMsg?.text?.length > 65 ? '…' : '');
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
            whileHover={{ scale: 1.02, y: -2 }}
            onClick={onClick}
            className={`bg-white rounded-2xl border-2 p-5 cursor-pointer transition-all shadow-md hover:shadow-xl ${
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
                            className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md"
                        >
                            {unread} new{unread > 1 ? 's' : ''}
                        </motion.span>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {deletable && (
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={handleDeleteClick}
                            title={`Delete (${timeLeft} left)`}
                            className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 transition-all"
                        >
                            <Trash2 size={14} />
                        </motion.button>
                    )}
                    <p className="text-[10px] text-gray-400 font-semibold">
                        {new Date(complaint.updatedAt || complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                </div>
            </div>

            <p className="text-base font-bold text-gray-800 mb-1">
                {complaint.category}
                {complaint.againstUserName && (
                    <span className="font-normal text-gray-500 text-xs ml-2">— {complaint.againstUserName}</span>
                )}
            </p>

            <p className="text-sm text-gray-600 mt-2 line-clamp-2 leading-relaxed">{complaint.description}</p>

            {preview && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                        <span className="font-bold text-gray-600">{lastFrom}:</span> {preview}
                    </p>
                </div>
            )}

            <div className="flex items-center gap-4 mt-3 pt-2 text-[11px] text-gray-400">
                <span className="flex items-center gap-1">
                    <MessageSquare size={11} /> {complaint.messages?.length || 0} messages
                </span>
                <span className="flex items-center gap-1">
                    <Calendar size={11} /> {new Date(complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
            </div>
        </motion.div>
    );
}

// ── Enhanced Main Component ────────────────────────────────────────────────────
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
            <div className="max-w-3xl mx-auto pb-12 px-4">
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
        <div className="max-w-3xl mx-auto space-y-6 pb-24 px-4">
            {/* Enhanced Header */}
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-orange-500 to-red-500 rounded-3xl p-8 text-white shadow-2xl"
            >
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                        <LifeBuoy size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Help & Support</h1>
                        <p className="text-white/90 text-sm mt-1">We're here to help you every step of the way</p>
                    </div>
                </div>
            </motion.div>

            {/* Enhanced Tabs */}
            <div className="flex gap-3">
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveTab('new')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-md ${
                        activeTab === 'new' 
                            ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg' 
                            : 'bg-white text-gray-600 hover:shadow-lg border-2 border-gray-200'
                    }`}
                >
                    <Plus size={18} />
                    New Request
                </motion.button>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveTab('list')}
                    className={`relative flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-md ${
                        activeTab === 'list' 
                            ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg' 
                            : 'bg-white text-gray-600 hover:shadow-lg border-2 border-gray-200'
                    }`}
                >
                    <MessageSquare size={18} />
                    My Requests
                    {totalUnread > 0 && (
                        <motion.span 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md"
                        >
                            {totalUnread}
                        </motion.span>
                    )}
                </motion.button>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={load}
                    className="ml-auto p-3 rounded-2xl bg-white hover:shadow-lg transition-all border-2 border-gray-200"
                >
                    <RefreshCw size={18} className="text-gray-600" />
                </motion.button>
            </div>

            {/* New request form */}
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

                {/* List */}
                {activeTab === 'list' && (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        {/* Enhanced Filter chips */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-5 no-scrollbar">
                            {[
                                { key: 'all',       label: `All (${complaints.length})`, icon: Star },
                                { key: 'complaint', label: `Complaints (${complaints.filter(c => c.type === 'complaint').length})`, icon: Flag },
                                { key: 'support',   label: `Help Requests (${complaints.filter(c => c.type === 'support').length})`, icon: LifeBuoy },
                                { key: 'open',      label: 'Waiting', icon: Clock },
                                { key: 'done',      label: 'Resolved', icon: CheckCircle },
                            ].map(f => {
                                const Icon = f.icon;
                                return (
                                    <motion.button
                                        key={f.key}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setFilter(f.key)}
                                        className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border-2 transition-all ${
                                            filter === f.key 
                                                ? 'border-orange-500 bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md' 
                                                : 'border-gray-200 bg-white text-gray-600 hover:border-orange-300'
                                        }`}
                                    >
                                        <Icon size={12} />
                                        {f.label}
                                    </motion.button>
                                );
                            })}
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl shadow-lg">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full"
                                />
                                <p className="mt-4 text-gray-500 font-semibold">Loading your requests...</p>
                            </div>
                        ) : filtered.length === 0 ? (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center py-20 bg-white rounded-3xl shadow-lg"
                            >
                                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <MessageCircle size={32} className="text-gray-400" />
                                </div>
                                <p className="font-bold text-gray-600 text-lg">
                                    {filter === 'all' ? 'No requests yet' : 'Nothing here'}
                                </p>
                                <p className="text-sm text-gray-400 mt-2">
                                    {filter === 'all' ? 'Click "New Request" to get help' : 'Try a different filter'}
                                </p>
                                {filter === 'all' && (
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setActiveTab('new')}
                                        className="mt-6 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all"
                                    >
                                        <Plus size={16} className="inline mr-2" />
                                        New Request
                                    </motion.button>
                                )}
                            </motion.div>
                        ) : (
                            <div className="space-y-4">
                                {filtered.map((c, index) => (
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
    );
};

export default WorkerComplaints;