// client/src/pages/admin/AdminWorkerComplaints.jsx
// ENHANCED UI VERSION - All original functionality preserved

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle, CheckCircle, Clock, MessageSquare,
    Search, Send, RefreshCw, X, HelpCircle,
    User, AlertCircle, Loader2, ArrowLeft, Filter,
    Phone, Shield, ChevronDown, Star, Award, Briefcase,
    Calendar, MapPin, Mail, Eye, TrendingUp, Zap,
    Sparkles, Crown, Flag, ThumbsUp, ThumbsDown,
    FileText,  // ← Added this missing import
    BarChart3  // Also add BarChart3 if it's used (for the filter icons)
} from 'lucide-react';

// ── Enhanced Status Config ─────────────────────────────────────────────────────
const STATUS_CONFIG = {
    submitted:   { label: 'Waiting', bg: 'bg-gradient-to-r from-yellow-50 to-amber-50', text: 'text-yellow-700', icon: Clock, border: 'border-yellow-200' },
    'in-review': { label: 'In Progress', bg: 'bg-gradient-to-r from-blue-50 to-indigo-50', text: 'text-blue-700', icon: Clock, border: 'border-blue-200' },
    resolved:    { label: 'Resolved', bg: 'bg-gradient-to-r from-green-50 to-emerald-50', text: 'text-green-700', icon: CheckCircle, border: 'border-green-200' },
    closed:      { label: 'Closed', bg: 'bg-gradient-to-r from-gray-50 to-gray-100', text: 'text-gray-600', icon: X, border: 'border-gray-200' },
};

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.submitted;
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border} shadow-sm`}>
            <Icon size={10} />{cfg.label}
        </span>
    );
}

function TypeChip({ type }) {
    return type === 'support'
        ? <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md"><HelpCircle size={10} /> Help Request</span>
        : <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md"><AlertTriangle size={10} /> Complaint</span>;
}

// ── Enhanced Message Bubble ────────────────────────────────────────────────────
function MessageBubble({ message }) {
    const isAdmin = message.sender === 'admin';
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${isAdmin ? 'justify-end' : 'justify-start'} mb-4`}
        >
            <div className={`max-w-[85%] ${isAdmin ? 'ml-auto' : 'mr-auto'}`}>
                <div className={`flex items-center gap-2 mb-1.5 ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                    {!isAdmin && (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center shadow-sm">
                            <User size={10} className="text-white" />
                        </div>
                    )}
                    <p className={`text-[11px] font-bold ${isAdmin ? 'text-orange-600' : 'text-gray-500'}`}>
                        {isAdmin ? 'You (Admin)' : message.senderName || 'Worker'}
                    </p>
                    {isAdmin && (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center shadow-sm">
                            <Shield size={10} className="text-white" />
                        </div>
                    )}
                </div>
                <div className={`px-5 py-3 rounded-2xl text-sm leading-relaxed shadow-md ${
                    isAdmin
                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-tr-none'
                        : 'bg-white border-2 border-gray-100 text-gray-800 rounded-tl-none shadow-sm'
                }`}>
                    {message.text}
                </div>
                <p className={`text-[10px] text-gray-400 mt-1.5 ${isAdmin ? 'text-right mr-1' : 'ml-2'}`}>
                    {new Date(message.sentAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {!isAdmin && !message.read && <span className="ml-2 text-orange-500 font-bold">• Unread</span>}
                </p>
            </div>
        </motion.div>
    );
}

// ── Enhanced Worker Profile Card ───────────────────────────────────────────────
function WorkerProfileCard({ worker, againstUserName }) {
    if (!worker) return null;
    
    const stats = [
        { label: 'Jobs Completed', value: worker.completedJobs || 0, icon: Briefcase },
        { label: 'Rating', value: worker.avgStars?.toFixed(1) || '—', icon: Star },
        { label: 'Points', value: worker.points || 0, icon: Award },
        { label: 'Experience', value: worker.experience ? `${worker.experience}y` : '—', icon: TrendingUp },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 rounded-2xl p-5 shadow-lg"
        >
            <div className="flex items-start gap-5">
                {/* Avatar */}
                <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center flex-shrink-0 overflow-hidden border-3 border-white shadow-lg">
                        {worker.photo
                            ? <img src={worker.photo.startsWith('http') ? worker.photo : `http://localhost:5000/${worker.photo}`}
                                   alt={worker.name}
                                   className="w-full h-full object-cover"
                                   onError={e => { e.target.style.display = 'none'; }}
                              />
                            : <User size={28} className="text-white" />
                        }
                    </div>
                    {worker.verificationStatus === 'approved' && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                            <CheckCircle size={10} className="text-white" />
                        </div>
                    )}
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-black text-gray-900 text-xl">{worker.name}</p>
                        {worker.avgStars > 0 && (
                            <span className="flex items-center gap-0.5 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                                <Star size={10} className="fill-yellow-500" />
                                {worker.avgStars.toFixed(1)}
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-orange-600 font-bold font-mono">{worker.karigarId}</p>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                        {stats.map(({ label, value, icon: Icon }) => (
                            <div key={label} className="bg-white/60 rounded-xl p-2 text-center">
                                <Icon size={12} className="text-orange-500 mx-auto mb-1" />
                                <p className="text-xs font-bold text-gray-800">{value}</p>
                                <p className="text-[9px] text-gray-500">{label}</p>
                            </div>
                        ))}
                    </div>
                    
                    {worker.mobile && (
                        <a href={`tel:${worker.mobile}`} className="inline-flex items-center gap-1.5 text-xs text-blue-600 font-semibold mt-2 hover:underline">
                            <Phone size={10} /> {worker.mobile}
                        </a>
                    )}
                    
                    {againstUserName && (
                        <div className="mt-3 bg-red-100 rounded-xl px-3 py-2 border border-red-200">
                            <p className="text-xs text-red-600 font-bold flex items-center gap-1">
                                <Flag size={10} /> Complaint against: {againstUserName}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

// ── Enhanced Complaint Detail Summary ──────────────────────────────────────────
function ComplaintDetailSummary({ complaint }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 rounded-2xl p-5 shadow-lg"
        >
            <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center shadow-md">
                    <MessageSquare size={14} className="text-white" />
                </div>
                <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">What the worker sent</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white/60 rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Type</p>
                    <TypeChip type={complaint.type} />
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Category</p>
                    <p className="font-bold text-gray-800 text-sm">{complaint.category}</p>
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Status</p>
                    <StatusBadge status={complaint.status} />
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Date Sent</p>
                    <p className="text-xs text-gray-700 font-semibold flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
            </div>

            {complaint.againstUserName && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-1 flex items-center gap-1">
                        <Flag size={10} /> Complaint Against
                    </p>
                    <p className="text-sm font-bold text-red-700">{complaint.againstUserName}</p>
                </div>
            )}

            <div className="bg-white rounded-xl p-4 border border-orange-200">
                <p className="text-[10px] text-gray-500 font-bold uppercase mb-2 flex items-center gap-1">
                    <FileText size={10} /> Full Description
                </p>
                <p className="text-sm text-gray-800 leading-relaxed">{complaint.description}</p>
            </div>
        </motion.div>
    );
}

// ── Enhanced Complaint Detail Panel ────────────────────────────────────────────
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
            toast.success('Reply sent successfully.');
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

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-32">
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full"
            />
            <p className="mt-4 text-gray-500 font-semibold">Loading conversation...</p>
        </div>
    );
    
    if (!complaint) return (
        <div className="text-center py-20 bg-white rounded-3xl shadow-xl">
            <AlertCircle size={48} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-semibold">Request not found.</p>
            <button onClick={onBack} className="mt-4 text-orange-500 text-sm font-bold underline">Go back</button>
        </div>
    );

    const isOpen   = ['submitted', 'in-review'].includes(complaint.status);
    const isClosed = ['resolved', 'closed'].includes(complaint.status);

    return (
        <div className="flex flex-col bg-gray-50 rounded-2xl shadow-xl overflow-hidden" style={{ minHeight: '85vh' }}>
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onBack}
                        className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-all backdrop-blur-sm"
                    >
                        <ArrowLeft size={18} className="text-white" />
                    </motion.button>
                    <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                        <TypeChip type={complaint.type} />
                        <StatusBadge status={complaint.status} />
                        <span className="text-xs text-white/80 font-medium capitalize bg-white/20 px-2 py-1 rounded-full">
                            {complaint.category}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {isOpen && (
                            <div className="relative">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setStatusOpen(s => !s)}
                                    disabled={actioning}
                                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg font-bold transition-all disabled:opacity-60 backdrop-blur-sm"
                                >
                                    {actioning ? <Loader2 size={12} className="animate-spin" /> : 'Mark as'}
                                    <ChevronDown size={12} />
                                </motion.button>
                                <AnimatePresence>
                                    {statusOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                            className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden min-w-[150px]"
                                        >
                                            <button
                                                onClick={() => handleStatusChange('resolved')}
                                                className="w-full text-left px-4 py-2.5 text-sm text-green-700 hover:bg-green-50 font-bold flex items-center gap-2 transition-all"
                                            >
                                                <CheckCircle size={14} /> Resolved
                                            </button>
                                            <button
                                                onClick={() => handleStatusChange('closed')}
                                                className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 font-bold flex items-center gap-2 transition-all"
                                            >
                                                <X size={14} /> Close
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                        <motion.button
                            whileHover={{ scale: 1.05, rotate: 180 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={load}
                            className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-all backdrop-blur-sm"
                        >
                            <RefreshCw size={14} className="text-white" />
                        </motion.button>
                    </div>
                </div>
            </div>

            {/* Worker Profile */}
            <div className="px-6 pt-6 pb-3 bg-white">
                <WorkerProfileCard worker={complaint.filedBy} againstUserName={complaint.againstUserName} />
            </div>

            {/* Full complaint details */}
            <div className="px-6 pb-4 bg-white">
                <ComplaintDetailSummary complaint={complaint} />
            </div>

            {/* Message thread */}
            <div className="flex-1 overflow-y-auto px-6 py-5 bg-gradient-to-b from-gray-50 to-white">
                <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full">
                        <MessageSquare size={12} className="text-gray-500" />
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
                        <p className="text-sm text-gray-500">No messages yet. Start the conversation below.</p>
                    </motion.div>
                ) : (
                    complaint.messages.map((m, i) => <MessageBubble key={m._id || i} message={m} />)
                )}
                <div ref={bottomRef} />
            </div>

            {/* Reply box */}
            <div className="px-6 py-4 bg-white border-t border-gray-100">
                <div className="flex gap-3">
                    <textarea
                        value={reply}
                        onChange={e => setReply(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={2}
                        placeholder={isClosed ? 'This issue is closed.' : 'Write your reply to the worker...'}
                        disabled={isClosed}
                        className="flex-1 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200 resize-none disabled:bg-gray-50 disabled:text-gray-400 transition-all"
                    />
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleReply}
                        disabled={sending || !reply.trim() || isClosed}
                        className="p-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-2xl disabled:opacity-50 transition-all shadow-md flex-shrink-0"
                    >
                        {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                    </motion.button>
                </div>
            </div>
        </div>
    );
}

// ── Enhanced Complaint Card ────────────────────────────────────────────────────
function ComplaintCard({ complaint, onClick }) {
    const unread   = complaint.adminUnread || 0;
    const lastMsg  = complaint.messages?.[complaint.messages.length - 1];
    const preview  = lastMsg?.text?.slice(0, 60) + (lastMsg?.text?.length > 60 ? '…' : '');
    const from     = lastMsg?.sender === 'admin' ? 'You' : complaint.filedBy?.name || 'Worker';
    const worker   = complaint.filedBy;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            onClick={onClick}
            className={`bg-white rounded-2xl border-2 p-5 cursor-pointer hover:shadow-xl transition-all group ${
                unread > 0 ? 'border-orange-300 bg-gradient-to-r from-orange-50/30 to-amber-50/30' : 'border-gray-100 hover:border-orange-200'
            }`}
        >
            <div className="flex items-start gap-4">
                {/* Worker avatar */}
                <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center overflow-hidden shadow-md">
                        {worker?.photo
                            ? <img src={worker.photo.startsWith('http') ? worker.photo : `http://localhost:5000/${worker.photo}`}
                                   alt={worker.name}
                                   className="w-full h-full object-cover"
                                   onError={e => { e.target.style.display = 'none'; }}
                              />
                            : <User size={20} className="text-white" />
                        }
                    </div>
                    {unread > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center">
                            <span className="text-[9px] font-black text-white">{unread}</span>
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-gray-900 text-base">{worker?.name || 'Worker'}</p>
                                {worker?.mobile && (
                                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                        <Phone size={8} /> {worker.mobile}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <TypeChip type={complaint.type} />
                                <StatusBadge status={complaint.status} />
                                {unread > 0 && (
                                    <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                        {unread} unread
                                    </span>
                                )}
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                            <Calendar size={8} />
                            {new Date(complaint.updatedAt || complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                    </div>

                    {/* Category + against */}
                    <p className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                        <Flag size={10} className="text-orange-500" />
                        {complaint.category}
                        {complaint.againstUserName && (
                            <span className="text-red-500 font-normal text-xs">— vs {complaint.againstUserName}</span>
                        )}
                    </p>

                    {/* Description preview */}
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">{complaint.description}</p>

                    {/* Last message */}
                    {preview && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                            <p className="text-[10px] text-gray-400">
                                <span className="font-bold text-gray-500">{from}:</span> {preview}
                            </p>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                        <span className="flex items-center gap-1">
                            <MessageSquare size={9} /> {complaint.messages?.length || 0} messages
                        </span>
                        <span className="flex items-center gap-1">
                            <Calendar size={8} />
                            {new Date(complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// ── Enhanced Stat Card ─────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, gradient, delay = 0 }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        whileHover={{ y: -2, scale: 1.02 }}
        className={`bg-white rounded-2xl p-5 shadow-md hover:shadow-xl transition-all relative overflow-hidden group`}
    >
        <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-r ${gradient} opacity-10 rounded-full -m-4 group-hover:scale-110 transition-transform`} />
        <div className="relative z-10">
            <p className="text-3xl font-black text-gray-900">{value}</p>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1">{label}</p>
        </div>
        <div className={`absolute bottom-3 right-3 p-2 rounded-xl bg-gradient-to-r ${gradient} text-white shadow-md`}>
            <Icon size={16} />
        </div>
    </motion.div>
);

// ── Main Component ────────────────────────────────────────────────────────────
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
        } catch { toast.error('Could not load complaints.'); }
        finally { setLoading(false); }
    }, [typeFilter, statusFilter, search]);

    useEffect(() => { loadData(); }, [loadData]);

    if (detailId) {
        return (
            <div className="max-w-3xl mx-auto p-4">
                <ComplaintDetail
                    complaintId={detailId}
                    onBack={() => { setDetailId(null); loadData(); }}
                    onUpdate={(updated) => setComplaints(prev => prev.map(c => c._id === updated._id ? updated : c))}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/20 p-4 md:p-6">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-r from-orange-500 to-red-500 rounded-3xl p-6 text-white shadow-xl"
                >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                                    <MessageSquare size={24} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-black">Worker Support</h1>
                                    <p className="text-white/90 text-sm mt-1">Manage worker complaints & help requests</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => navigate('/admin/dashboard')}
                                className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-xl text-sm font-bold hover:bg-white/30 transition-all backdrop-blur-sm"
                            >
                                <ArrowLeft size={14} /> Dashboard
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05, rotate: 180 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={loadData}
                                className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-all"
                            >
                                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            </motion.button>
                        </div>
                    </div>
                </motion.div>

                {/* Stats */}
                {stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <StatCard label="Total Received" value={stats.total} icon={MessageSquare} gradient="from-gray-500 to-gray-600" delay={0} />
                        <StatCard label="Waiting" value={stats.byStatus?.submitted || 0} icon={Clock} gradient="from-yellow-500 to-amber-500" delay={0.05} />
                        <StatCard label="Unread Messages" value={stats.adminUnread || 0} icon={Mail} gradient="from-orange-500 to-red-500" delay={0.1} />
                        <StatCard label="Resolved" value={stats.byStatus?.resolved || 0} icon={CheckCircle} gradient="from-green-500 to-emerald-500" delay={0.15} />
                    </div>
                )}

                {/* Search + Filter */}
                <div className="bg-white rounded-2xl border-2 border-orange-100 shadow-md p-5">
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search by worker name or description..."
                                className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50 transition-all"
                            />
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowFilters(f => !f)}
                            className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-bold transition-all ${
                                showFilters || typeFilter !== 'all' || statusFilter !== 'all'
                                    ? 'border-orange-400 bg-orange-50 text-orange-700'
                                    : 'border-gray-200 text-gray-500 hover:border-orange-200'
                            }`}
                        >
                            <Filter size={14} /> Filter
                            {(typeFilter !== 'all' || statusFilter !== 'all') && (
                                <span className="w-5 h-5 bg-orange-500 text-white rounded-full text-[10px] flex items-center justify-center">
                                    {(typeFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0)}
                                </span>
                            )}
                        </motion.button>
                    </div>

                    <AnimatePresence>
                        {showFilters && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4 mt-3 border-t border-gray-100">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Type</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {[
                                                { v: 'all', l: 'All', icon: MessageSquare },
                                                { v: 'complaint', l: 'Complaints', icon: AlertTriangle },
                                                { v: 'support', l: 'Help Requests', icon: HelpCircle },
                                            ].map(({ v, l, icon: Icon }) => (
                                                <motion.button
                                                    key={v}
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => setTypeFilter(v)}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                                        typeFilter === v
                                                            ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                    }`}
                                                >
                                                    <Icon size={10} /> {l}
                                                </motion.button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Status</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {[
                                                { v: 'all', l: 'All', icon: BarChart3 },
                                                { v: 'submitted', l: 'Waiting', icon: Clock },
                                                { v: 'in-review', l: 'In Progress', icon: Eye },
                                                { v: 'resolved', l: 'Resolved', icon: CheckCircle },
                                                { v: 'closed', l: 'Closed', icon: X },
                                            ].map(({ v, l, icon: Icon }) => (
                                                <motion.button
                                                    key={v}
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => setStatusFilter(v)}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                                        statusFilter === v
                                                            ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                    }`}
                                                >
                                                    <Icon size={10} /> {l}
                                                </motion.button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {(typeFilter !== 'all' || statusFilter !== 'all' || search) && (
                        <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            onClick={() => { setTypeFilter('all'); setStatusFilter('all'); setSearch(''); }}
                            className="mt-3 text-xs text-orange-500 font-bold hover:underline flex items-center gap-1"
                        >
                            <X size={10} /> Clear all filters
                        </motion.button>
                    )}
                </div>

                {/* List */}
                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl shadow-xl"
                        >
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full"
                            />
                            <p className="mt-4 text-gray-500 font-semibold">Loading requests...</p>
                        </motion.div>
                    ) : complaints.length === 0 ? (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="text-center py-20 bg-white rounded-3xl shadow-xl border border-gray-100"
                        >
                            <motion.div
                                animate={{ y: [0, -10, 0] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="text-6xl mb-4"
                            >
                                📭
                            </motion.div>
                            <p className="font-bold text-gray-800 text-xl mb-2">No requests found</p>
                            <p className="text-gray-400 text-sm">
                                {typeFilter !== 'all' || statusFilter !== 'all' || search
                                    ? 'Try different filters or clear search'
                                    : 'No workers have submitted any complaints or help requests yet.'}
                            </p>
                            {(typeFilter !== 'all' || statusFilter !== 'all' || search) && (
                                <button
                                    onClick={() => { setTypeFilter('all'); setStatusFilter('all'); setSearch(''); }}
                                    className="mt-6 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold hover:shadow-lg transition-all"
                                >
                                    Clear Filters
                                </button>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="list"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="space-y-3"
                        >
                            <p className="text-xs text-gray-400 font-semibold flex items-center gap-1">
                                <MessageSquare size={10} />
                                {complaints.length} item{complaints.length !== 1 ? 's' : ''} found
                            </p>
                            {complaints.map((c, idx) => (
                                <ComplaintCard key={c._id} complaint={c} onClick={() => setDetailId(c._id)} />
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default AdminWorkerComplaints;