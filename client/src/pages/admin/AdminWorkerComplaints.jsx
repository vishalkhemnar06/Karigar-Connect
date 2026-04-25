// client/src/pages/admin/AdminWorkerComplaints.jsx
// PREMIUM VERSION - Modern design with gradients, animations, and enhanced UX

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as api from '../../api';
import { getImageUrl } from '../../constants/config';
import toast from 'react-hot-toast';
import {
    AlertTriangle, CheckCircle, Clock, MessageSquare,
    Search, Send, RefreshCw, X, HelpCircle,
    User, AlertCircle, Loader2, ArrowLeft, Filter,
    Phone, Shield, ChevronDown, Star, Award, Briefcase,
    Calendar, MapPin, Mail, Eye, TrendingUp, Zap,
    Sparkles, Crown, Flag, ThumbsUp, ThumbsDown,
    FileText, BarChart3, ChevronRight, Menu,
    Verified, Heart, Gift, Diamond, Trophy,
    Users, Building2, Home, Wallet, Camera, Upload
} from 'lucide-react';

// ── Enhanced Status Config ─────────────────────────────────────────────────────
const STATUS_CONFIG = {
    submitted:   { label: 'Waiting',     bg: 'from-yellow-50 to-amber-50',  text: 'text-yellow-700', icon: Clock,        border: 'border-yellow-200', gradient: 'from-yellow-500 to-amber-500' },
    'in-review': { label: 'In Progress', bg: 'from-blue-50 to-indigo-50',   text: 'text-blue-700',   icon: Clock,        border: 'border-blue-200',   gradient: 'from-blue-500 to-indigo-500' },
    resolved:    { label: 'Resolved',    bg: 'from-green-50 to-emerald-50', text: 'text-green-700',  icon: CheckCircle,  border: 'border-green-200',  gradient: 'from-emerald-500 to-green-500' },
    closed:      { label: 'Closed',      bg: 'from-gray-50 to-gray-100',    text: 'text-gray-600',   icon: X,            border: 'border-gray-200',   gradient: 'from-gray-500 to-gray-600' },
};

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.submitted;
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 text-[10px] md:text-xs font-bold px-2.5 md:px-3 py-1 md:py-1.5 rounded-full bg-gradient-to-r ${cfg.bg} ${cfg.text} border ${cfg.border} shadow-sm`}>
            <Icon size={10} className="md:size-3" /> {cfg.label}
        </span>
    );
}

function TypeChip({ type }) {
    return type === 'support'
        ? <span className="inline-flex items-center gap-1.5 text-[9px] md:text-[11px] font-bold px-2.5 md:px-3 py-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md"><HelpCircle size={10} /> Help Request</span>
        : <span className="inline-flex items-center gap-1.5 text-[9px] md:text-[11px] font-bold px-2.5 md:px-3 py-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md"><AlertTriangle size={10} /> Complaint</span>;
}

// ── Stat Card Component ────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, gradient, delay = 0 }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        whileHover={{ y: -2, scale: 1.02 }}
        className="bg-white rounded-xl p-4 shadow-md hover:shadow-xl transition-all relative overflow-hidden group"
    >
        <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-r ${gradient} opacity-10 rounded-full -m-4 group-hover:scale-110 transition-transform`} />
        <div className="relative z-10">
            <p className="text-2xl font-black text-gray-800">{value}</p>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-1">{label}</p>
        </div>
        <div className={`absolute bottom-3 right-3 p-2 rounded-lg bg-gradient-to-r ${gradient} text-white shadow-md`}>
            <Icon size="14" />
        </div>
    </motion.div>
);

// ── Enhanced Message Bubble ────────────────────────────────────────────────────
function MessageBubble({ message }) {
    const isAdmin = message.sender === 'admin';
    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3 }}
            className={`flex ${isAdmin ? 'justify-end' : 'justify-start'} mb-4`}
        >
            <div className={`max-w-[85%] ${isAdmin ? 'ml-auto' : 'mr-auto'}`}>
                <div className={`flex items-center gap-2 mb-1 ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                    {!isAdmin && (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center shadow-sm">
                            <User size="10" className="text-white" />
                        </div>
                    )}
                    <p className={`text-[10px] font-bold ${isAdmin ? 'text-orange-600' : 'text-gray-500'}`}>
                        {isAdmin ? 'You (Admin)' : message.senderName || 'Worker'}
                    </p>
                    {isAdmin && (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center shadow-sm">
                            <Shield size="10" className="text-white" />
                        </div>
                    )}
                </div>
                <div className={`px-4 py-3 rounded-xl text-xs md:text-sm leading-relaxed shadow-md ${
                    isAdmin
                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-tr-none'
                        : 'bg-white border border-gray-100 text-gray-700 rounded-tl-none shadow-sm'
                }`}>
                    {message.text}
                </div>
                <p className={`text-[9px] text-gray-400 mt-1 ${isAdmin ? 'text-right mr-1' : 'ml-2'}`}>
                    {new Date(message.sentAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {!isAdmin && !message.read && <span className="ml-1.5 text-orange-500 font-bold">• Unread</span>}
                </p>
            </div>
        </motion.div>
    );
}

// ── Worker Profile Card ───────────────────────────────────────────────────────
function WorkerProfileCard({ worker, againstUserName }) {
    if (!worker) return null;

    const stats = [
        { label: 'Jobs',   value: worker.completedJobs || 0,            icon: Briefcase, gradient: 'from-blue-500 to-cyan-500' },
        { label: 'Rating', value: worker.avgStars?.toFixed(1) || '—',   icon: Star,       gradient: 'from-yellow-500 to-amber-500' },
        { label: 'Points', value: worker.points || 0,                   icon: Trophy,     gradient: 'from-orange-500 to-red-500' },
        { label: 'Exp',    value: worker.experience ? `${worker.experience}y` : '—', icon: TrendingUp, gradient: 'from-purple-500 to-pink-500' },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-5 shadow-lg"
        >
            <div className="flex items-start gap-4">
                <div className="relative flex-shrink-0">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center overflow-hidden border-2 border-white shadow-md">
                        {worker?.photo ? (
                            <img
                                src={getImageUrl(worker.photo)}
                                alt={worker.name}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.style.display = 'none'; }}
                            />
                        ) : (
                            <User size="24" className="text-white" />
                        )}
                    </div>
                    {worker.verificationStatus === 'approved' && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
                            <Verified size="10" className="text-white" />
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-bold text-gray-800 text-base truncate">{worker.name}</p>
                        {worker.avgStars > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                                <Star size="8" className="fill-yellow-500" />
                                {worker.avgStars.toFixed(1)}
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] text-orange-600 font-mono font-semibold break-all">{worker.karigarId}</p>

                    <div className="grid grid-cols-4 gap-2 mt-3">
                        {stats.map(({ label, value, icon: Icon, gradient }) => (
                            <div key={label} className="bg-white/60 rounded-lg p-2 text-center">
                                <div className={`w-6 h-6 rounded-lg bg-gradient-to-r ${gradient} flex items-center justify-center mx-auto mb-1 shadow-sm`}>
                                    <Icon size="10" className="text-white" />
                                </div>
                                <p className="text-xs font-bold text-gray-800">{value}</p>
                                <p className="text-[8px] text-gray-500">{label}</p>
                            </div>
                        ))}
                    </div>

                    {worker.mobile && (
                        <a href={`tel:${worker.mobile}`} className="inline-flex items-center gap-1 text-[10px] text-blue-600 font-semibold mt-2 hover:underline">
                            <Phone size="10" /> {worker.mobile}
                        </a>
                    )}

                    {againstUserName && (
                        <div className="mt-3 bg-red-100 rounded-lg px-3 py-2 border border-red-200">
                            <p className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                                <Flag size="10" /> Complaint Against: {againstUserName}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

// ── Complaint Detail Summary ──────────────────────────────────────────────────
function ComplaintDetailSummary({ complaint }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-5 shadow-lg"
        >
            <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center shadow-md">
                    <MessageSquare size="14" className="text-white" />
                </div>
                <p className="text-[10px] font-bold text-orange-700 uppercase tracking-wide">Complaint Details</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white/60 rounded-lg p-3">
                    <p className="text-[9px] text-gray-500 font-bold uppercase mb-1">Type</p>
                    <TypeChip type={complaint.type} />
                </div>
                <div className="bg-white/60 rounded-lg p-3">
                    <p className="text-[9px] text-gray-500 font-bold uppercase mb-1">Category</p>
                    <p className="font-bold text-gray-800 text-sm truncate">{complaint.category}</p>
                </div>
                <div className="bg-white/60 rounded-lg p-3">
                    <p className="text-[9px] text-gray-500 font-bold uppercase mb-1">Status</p>
                    <StatusBadge status={complaint.status} />
                </div>
                <div className="bg-white/60 rounded-lg p-3">
                    <p className="text-[9px] text-gray-500 font-bold uppercase mb-1">Filed On</p>
                    <p className="text-xs text-gray-700 font-semibold flex items-center gap-1">
                        <Calendar size="10" />
                        {new Date(complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                </div>
            </div>

            {complaint.againstUserName && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
                    <p className="text-[9px] text-gray-500 font-bold uppercase mb-1 flex items-center gap-1">
                        <Flag size="10" /> Complaint Against
                    </p>
                    <p className="text-sm font-bold text-red-700 truncate">{complaint.againstUserName}</p>
                </div>
            )}

            <div className="bg-white rounded-lg p-4 border border-orange-200">
                <p className="text-[9px] text-gray-500 font-bold uppercase mb-2 flex items-center gap-1">
                    <FileText size="10" /> Description
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">{complaint.description}</p>
            </div>
        </motion.div>
    );
}

// ── Complaint Detail Panel ────────────────────────────────────────────────────
function ComplaintDetail({ complaintId, onBack, onUpdate }) {
    const [complaint,  setComplaint]  = useState(null);
    const [loading,    setLoading]    = useState(true);
    const [reply,      setReply]      = useState('');
    const [sending,    setSending]    = useState(false);
    const [statusOpen, setStatusOpen] = useState(false);
    const [actioning,  setActioning]  = useState(false);
    const bottomRef = useRef(null);

    const load = useCallback(async () => {
        try {
            const { data } = await api.getAdminWorkerComplaintById(complaintId);
            setComplaint(data);
        } catch {
            toast.error('Could not load this item.');
        } finally {
            setLoading(false);
        }
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
        } finally {
            setSending(false);
        }
    };

    const handleStatusChange = async (action) => {
        setActioning(true);
        setStatusOpen(false);
        try {
            const { data } = await api.takeAdminWorkerComplaintAction(complaintId, { action });
            setComplaint(data.complaint);
            if (onUpdate) onUpdate(data.complaint);
            toast.success(action === 'resolved' ? 'Marked as resolved.' : 'Marked as closed.');
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Action failed.');
        } finally {
            setActioning(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-32">
            <Loader2 size="40" className="animate-spin text-orange-500 mb-4" />
            <p className="text-gray-500 font-medium">Loading conversation...</p>
        </div>
    );

    if (!complaint) return (
        <div className="text-center py-20 bg-white rounded-2xl shadow-xl">
            <AlertCircle size="48" className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-semibold">Request not found.</p>
            <button onClick={onBack} className="mt-4 text-orange-500 font-bold underline">Go back</button>
        </div>
    );

    const isOpen   = ['submitted', 'in-review'].includes(complaint.status);
    const isClosed = ['resolved', 'closed'].includes(complaint.status);

    return (
        <div className="flex flex-col bg-white rounded-2xl shadow-xl overflow-hidden" style={{ minHeight: '85vh' }}>
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 px-6 py-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-all"
                    >
                        <ArrowLeft size="18" className="text-white" />
                    </button>
                    <div className="flex-1 flex items-center gap-2 flex-wrap">
                        <TypeChip type={complaint.type} />
                        <StatusBadge status={complaint.status} />
                        <span className="text-xs text-white/80 font-medium bg-white/20 px-2 py-0.5 rounded-full">
                            {complaint.category}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {isOpen && (
                            <div className="relative">
                                <button
                                    onClick={() => setStatusOpen(!statusOpen)}
                                    disabled={actioning}
                                    className="flex items-center gap-1 text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg font-bold transition-all disabled:opacity-60"
                                >
                                    {actioning ? <Loader2 size="12" className="animate-spin" /> : 'Mark'}
                                    <ChevronDown size="12" />
                                </button>
                                <AnimatePresence>
                                    {statusOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                            className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-20 overflow-hidden min-w-[140px]"
                                        >
                                            <button
                                                onClick={() => handleStatusChange('resolved')}
                                                className="w-full text-left px-4 py-2.5 text-sm text-emerald-700 hover:bg-emerald-50 font-bold flex items-center gap-2 transition-all"
                                            >
                                                <CheckCircle size="14" /> Resolved
                                            </button>
                                            <button
                                                onClick={() => handleStatusChange('closed')}
                                                className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 font-bold flex items-center gap-2 transition-all"
                                            >
                                                <X size="14" /> Close
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                        <button
                            onClick={load}
                            className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-all"
                        >
                            <RefreshCw size="16" className="text-white" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Worker Profile */}
            <div className="px-6 pt-6 pb-3 bg-white">
                <WorkerProfileCard worker={complaint.filedBy} againstUserName={complaint.againstUserName} />
            </div>

            {/* Complaint details */}
            <div className="px-6 pb-4 bg-white">
                <ComplaintDetailSummary complaint={complaint} />
            </div>

            {/* Message thread */}
            <div className="flex-1 overflow-y-auto px-6 py-5 bg-gradient-to-b from-gray-50 to-white">
                <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full">
                        <MessageSquare size="14" className="text-gray-500" />
                        <p className="text-xs text-gray-500 font-semibold">Conversation Thread</p>
                    </div>
                </div>

                {complaint.messages.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <MessageSquare size="28" className="text-gray-400" />
                        </div>
                        <p className="text-gray-500">No messages yet. Start the conversation below.</p>
                    </div>
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
                        placeholder={isClosed ? 'This issue is closed.' : 'Write your reply...'}
                        disabled={isClosed}
                        className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 resize-none disabled:bg-gray-50 disabled:text-gray-400 transition-all"
                    />
                    <button
                        onClick={handleReply}
                        disabled={sending || !reply.trim() || isClosed}
                        className="px-5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl disabled:opacity-50 transition-all shadow-md flex items-center justify-center"
                    >
                        {sending ? <Loader2 size="16" className="animate-spin" /> : <Send size="16" />}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Complaint Card ────────────────────────────────────────────────────────────
function ComplaintCard({ complaint, onClick }) {
    const unread  = complaint.adminUnread || 0;
    const lastMsg = complaint.messages?.[complaint.messages.length - 1];
    const preview = lastMsg?.text?.slice(0, 50) + (lastMsg?.text?.length > 50 ? '…' : '');
    const from    = lastMsg?.sender === 'admin' ? 'You' : complaint.filedBy?.name?.split(' ')[0] || 'Worker';
    const worker  = complaint.filedBy;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            onClick={onClick}
            className={`bg-white rounded-xl border p-5 cursor-pointer hover:shadow-xl transition-all ${
                unread > 0 ? 'border-orange-300 bg-gradient-to-r from-orange-50/30 to-amber-50/30' : 'border-gray-100 hover:border-orange-200'
            }`}
        >
            <div className="flex items-start gap-4">
                <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center overflow-hidden shadow-md">
                        {worker?.photo ? (
                            <img
                                src={getImageUrl(worker.photo)}
                                alt={worker.name}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.style.display = 'none'; }}
                            />
                        ) : (
                            <User size="20" className="text-white" />
                        )}
                    </div>
                    {unread > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
                            <span className="text-[9px] font-bold text-white">{unread}</span>
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-gray-800 text-base truncate">{worker?.name || 'Worker'}</p>
                                {worker?.mobile && (
                                    <span className="text-[9px] text-gray-400 flex items-center gap-0.5">
                                        <Phone size="8" /> {worker.mobile}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <TypeChip type={complaint.type} />
                                <StatusBadge status={complaint.status} />
                                {unread > 0 && (
                                    <span className="bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                        {unread} new
                                    </span>
                                )}
                            </div>
                        </div>
                        <p className="text-[9px] text-gray-400 flex items-center gap-0.5">
                            <Calendar size="8" />
                            {new Date(complaint.updatedAt || complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                    </div>

                    <p className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                        <Flag size="10" className="text-orange-500" />
                        <span className="truncate">{complaint.category}</span>
                        {complaint.againstUserName && (
                            <span className="text-red-500 font-normal text-xs truncate">— vs {complaint.againstUserName}</span>
                        )}
                    </p>

                    <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">{complaint.description}</p>

                    {preview && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                            <p className="text-[10px] text-gray-400">
                                <span className="font-bold text-gray-500">{from}:</span> {preview}
                            </p>
                        </div>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-[9px] text-gray-400">
                        <span className="flex items-center gap-0.5">
                            <MessageSquare size="8" /> {complaint.messages?.length || 0} messages
                        </span>
                        <span className="flex items-center gap-0.5">
                            <Calendar size="7" />
                            {new Date(complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
const AdminWorkerComplaints = () => {
    const navigate = useNavigate();
    const [complaints,   setComplaints]   = useState([]);
    const [stats,        setStats]        = useState(null);
    const [loading,      setLoading]      = useState(true);
    const [refreshing,   setRefreshing]   = useState(false);
    const [detailId,     setDetailId]     = useState(null);
    const [typeFilter,   setTypeFilter]   = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchInput,     setSearchInput]     = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [showFilters,     setShowFilters]     = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (typeFilter       !== 'all') params.type   = typeFilter;
            if (statusFilter     !== 'all') params.status = statusFilter;
            if (debouncedSearch)            params.search = debouncedSearch;

            const [listRes, statsRes] = await Promise.allSettled([
                api.getAdminWorkerComplaints(params),
                api.getAdminWorkerComplaintStats(),
            ]);

            if (listRes.status  === 'fulfilled') {
                setComplaints(listRes.value.data?.complaints || listRes.value.data || []);
            }
            if (statsRes.status === 'fulfilled') {
                setStats(statsRes.value.data);
            }
        } catch {
            toast.error('Could not load complaints.');
        } finally {
            setLoading(false);
        }
    }, [typeFilter, statusFilter, debouncedSearch]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
        toast.success('Complaints refreshed');
    };

    if (detailId) {
        return (
            <div className="max-w-4xl mx-auto p-4">
                <ComplaintDetail
                    complaintId={detailId}
                    onBack={() => { setDetailId(null); loadData(); }}
                    onUpdate={(updated) => setComplaints(prev => prev.map(c => c._id === updated._id ? updated : c))}
                />
            </div>
        );
    }

    const hasActiveFilters = typeFilter !== 'all' || statusFilter !== 'all' || searchInput;

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 pb-16">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-8">
                
                {/* Hero Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-xl">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                    <AlertTriangle size="24" className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black">Worker Complaints</h1>
                                    <p className="text-white/90 text-sm mt-0.5">Manage worker complaints and support requests</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="bg-white/15 rounded-xl px-3 py-1.5 text-center">
                                    <p className="text-xl font-bold">{stats?.total || 0}</p>
                                    <p className="text-[10px] text-white/80">Total Requests</p>
                                </div>
                                <div className="bg-white/15 rounded-xl px-3 py-1.5 text-center">
                                    <p className="text-xl font-bold">{stats?.adminUnread || 0}</p>
                                    <p className="text-[10px] text-white/80">Unread</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <StatCard label="Total Requests" value={stats.total} icon={MessageSquare} gradient="from-gray-500 to-gray-600" delay={0} />
                        <StatCard label="Pending" value={stats.byStatus?.submitted || 0} icon={Clock} gradient="from-yellow-500 to-amber-500" delay={0.05} />
                        <StatCard label="Unread" value={stats.adminUnread || 0} icon={Mail} gradient="from-orange-500 to-red-500" delay={0.1} />
                        <StatCard label="Resolved" value={stats.byStatus?.resolved || 0} icon={CheckCircle} gradient="from-emerald-500 to-green-500" delay={0.15} />
                    </div>
                )}

                {/* Search & Filters */}
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 mb-6">
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <Search size="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                                placeholder="Search by worker name, category, or complaint ID..."
                                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                            />
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${showFilters || hasActiveFilters ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-orange-50'}`}
                        >
                            <Filter size="14" /> Filter
                            {(typeFilter !== 'all' || statusFilter !== 'all') && (
                                <span className="ml-0.5 w-4 h-4 bg-white/20 rounded-full text-white text-[10px] flex items-center justify-center">
                                    {(typeFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0)}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="p-2.5 border border-gray-200 rounded-xl hover:border-orange-300 transition-all"
                        >
                            <RefreshCw size="16" className={`text-orange-500 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    <AnimatePresence>
                        {showFilters && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-4 pt-4 border-t border-gray-100"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Type</label>
                                        <div className="flex gap-2">
                                            {[
                                                { v: 'all', label: 'All', icon: MessageSquare },
                                                { v: 'complaint', label: 'Complaints', icon: AlertTriangle },
                                                { v: 'support', label: 'Help Requests', icon: HelpCircle },
                                            ].map(({ v, label, icon: Icon }) => (
                                                <button
                                                    key={v}
                                                    onClick={() => setTypeFilter(v)}
                                                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                                                        typeFilter === v
                                                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm'
                                                            : 'bg-gray-100 text-gray-600 hover:bg-orange-50'
                                                    }`}
                                                >
                                                    <Icon size="12" /> {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Status</label>
                                        <div className="flex gap-2">
                                            {[
                                                { v: 'all', label: 'All', icon: BarChart3 },
                                                { v: 'submitted', label: 'Waiting', icon: Clock },
                                                { v: 'in-review', label: 'In Progress', icon: Eye },
                                                { v: 'resolved', label: 'Resolved', icon: CheckCircle },
                                                { v: 'closed', label: 'Closed', icon: X },
                                            ].map(({ v, label, icon: Icon }) => (
                                                <button
                                                    key={v}
                                                    onClick={() => setStatusFilter(v)}
                                                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                                                        statusFilter === v
                                                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm'
                                                            : 'bg-gray-100 text-gray-600 hover:bg-orange-50'
                                                    }`}
                                                >
                                                    <Icon size="12" /> {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Active Filters */}
                    {hasActiveFilters && (
                        <div className="flex flex-wrap items-center gap-2 mt-4 pt-2 border-t border-gray-100">
                            <span className="text-[9px] text-gray-500 font-semibold">Active filters:</span>
                            {searchInput && (
                                <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                    Search: {searchInput}
                                    <button onClick={() => setSearchInput('')} className="hover:text-orange-900">✕</button>
                                </span>
                            )}
                            {typeFilter !== 'all' && (
                                <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                    Type: {typeFilter}
                                    <button onClick={() => setTypeFilter('all')} className="hover:text-orange-900">✕</button>
                                </span>
                            )}
                            {statusFilter !== 'all' && (
                                <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                    Status: {statusFilter}
                                    <button onClick={() => setStatusFilter('all')} className="hover:text-orange-900">✕</button>
                                </span>
                            )}
                            <button onClick={() => { setTypeFilter('all'); setStatusFilter('all'); setSearchInput(''); }} className="text-[9px] text-orange-500 font-semibold hover:underline">
                                Clear all
                            </button>
                        </div>
                    )}
                </div>

                {/* Results Count */}
                {!loading && complaints.length > 0 && (
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-xs text-gray-500 font-medium">
                            {complaints.length} complaint{complaints.length !== 1 ? 's' : ''} found
                        </p>
                    </div>
                )}

                {/* Complaints List */}
                {loading ? (
                    <div className="flex items-center justify-center py-20 bg-white rounded-xl shadow-md">
                        <Loader2 size="40" className="animate-spin text-orange-500" />
                    </div>
                ) : complaints.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center"
                    >
                        <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <MessageSquare size="36" className="text-gray-400" />
                        </div>
                        <h3 className="font-bold text-gray-700 text-lg mb-2">No Complaints Found</h3>
                        <p className="text-gray-400 text-sm max-w-sm mx-auto">
                            {hasActiveFilters ? 'Try adjusting your filters or search terms.' : 'No workers have submitted any complaints or help requests yet.'}
                        </p>
                        {hasActiveFilters && (
                            <button onClick={() => { setTypeFilter('all'); setStatusFilter('all'); setSearchInput(''); }} className="mt-5 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl text-sm font-semibold hover:shadow-md transition-all">
                                Clear Filters
                            </button>
                        )}
                    </motion.div>
                ) : (
                    <div className="space-y-4">
                        {complaints.map((c, idx) => (
                            <ComplaintCard key={c._id} complaint={c} onClick={() => setDetailId(c._id)} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminWorkerComplaints;