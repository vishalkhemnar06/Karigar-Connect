// src/pages/admin/AdminComplaints.jsx
// FIXED VERSION - resolves detail view and action issues

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';
import logo from '../../assets/logo.jpg';
import { getImageUrl } from '../../constants/config';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle, Eye, Phone, Mail, ShieldX, ShieldCheck,
    MessageSquare, CheckCircle, X, Clock, RefreshCw,
    User, Briefcase, MapPin, Star, Loader2,
    Search, ChevronLeft, Send, XCircle, AlertCircle,
    Flag, UserX, Shield, TrendingUp, Award, Calendar,
    ThumbsUp, ThumbsDown, Filter, Zap, Sparkles,
    BarChart3
} from 'lucide-react';

// ── Enhanced Status Badge ─────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const map = {
        submitted:      { cls: 'bg-yellow-50 text-yellow-700 border-yellow-200',   icon: Clock,       label: 'Submitted'    },
        'in-review':    { cls: 'bg-blue-50 text-blue-700 border-blue-200',         icon: Eye,         label: 'In Review'    },
        'action-taken': { cls: 'bg-orange-50 text-orange-700 border-orange-200',   icon: Flag,        label: 'Action Taken' },
        resolved:       { cls: 'bg-green-50 text-green-700 border-green-200',      icon: CheckCircle, label: 'Resolved'     },
        dismissed:      { cls: 'bg-gray-50 text-gray-500 border-gray-200',         icon: XCircle,     label: 'Dismissed'    },
        blocked:        { cls: 'bg-red-50 text-red-700 border-red-200',            icon: ShieldX,     label: 'Blocked'      },
    };
    const { cls, icon: Icon, label } = map[status] || map.submitted;
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full border ${cls}`}>
            <Icon size={12} />
            {label}
        </span>
    );
};

// ── Action Modal ──────────────────────────────────────────────────────────────
const ActionModal = ({ complaint, onClose, onDone }) => {
    const [action, setAction]               = useState('');
    const [customMessage, setCustomMessage] = useState('');
    const [adminNotes, setAdminNotes]       = useState('');
    const [submitting, setSubmitting]       = useState(false);

    const worker = complaint?.againstWorker;

    const ACTIONS = [
        { id: 'warn',    label: 'Send Warning',     icon: MessageSquare, desc: 'Send SMS warning. Worker can continue.',          gradient: 'from-yellow-500 to-amber-500',  activeClass: 'border-yellow-500 bg-yellow-50',  iconClass: 'bg-yellow-100 text-yellow-600', labelClass: 'text-yellow-700' },
        { id: 'block',   label: 'Block Worker',     icon: ShieldX,       desc: 'Block account permanently.',                      gradient: 'from-red-500 to-rose-500',      activeClass: 'border-red-500 bg-red-50',        iconClass: 'bg-red-100 text-red-600',       labelClass: 'text-red-700'    },
        { id: 'clear',   label: 'Clear & Continue', icon: ShieldCheck,   desc: 'Worker cleared. Complaint resolved.',             gradient: 'from-green-500 to-emerald-500', activeClass: 'border-green-500 bg-green-50',    iconClass: 'bg-green-100 text-green-600',   labelClass: 'text-green-700'  },
        { id: 'dismiss', label: 'Dismiss',          icon: XCircle,       desc: 'No action. Complaint dismissed.',                 gradient: 'from-gray-500 to-gray-600',     activeClass: 'border-gray-400 bg-gray-50',      iconClass: 'bg-gray-100 text-gray-500',     labelClass: 'text-gray-600'   },
    ];

    const selectedAction = ACTIONS.find(a => a.id === action);

    const handleSubmit = async () => {
        if (!action) { toast.error('Please select an action.'); return; }
        setSubmitting(true);
        try {
            await api.takeAdminActionOnComplaint(complaint._id, {
                action,
                customMessage: customMessage.trim() || undefined,
                adminNotes:    adminNotes.trim()    || undefined,
            });
            toast.success(`Action "${action}" executed successfully.`);
            onDone();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Action failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[70] flex items-center justify-center p-4"
        >
            <motion.div
                initial={{ scale: 0.9, y: 50, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: 50, opacity: 0 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <AlertTriangle size={20} />
                                <h3 className="text-xl font-black">Take Action</h3>
                            </div>
                            <p className="text-orange-100 text-xs">
                                Against: <strong className="text-white">{worker?.name || 'Unknown Worker'}</strong>
                                {worker?.karigarId && ` · ${worker.karigarId}`}
                            </p>
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.05, rotate: 90 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={onClose}
                            className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all"
                        >
                            <X size={18} />
                        </motion.button>
                    </div>
                </div>

                <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                    {/* Action selection */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <Zap size={14} className="text-orange-500" />
                            Select Action
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {ACTIONS.map(({ id, label, icon: Icon, desc, activeClass, iconClass, labelClass, gradient }) => (
                                <motion.button
                                    key={id}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setAction(id)}
                                    className={`flex flex-col items-start gap-1.5 p-3.5 rounded-2xl border-2 text-left transition-all ${
                                        action === id ? activeClass : 'border-gray-100 hover:border-gray-200 bg-white'
                                    }`}
                                >
                                    <div className={`p-1.5 rounded-xl ${action === id ? iconClass : 'bg-gray-100'}`}>
                                        <Icon size={15} className={action === id ? '' : 'text-gray-400'} />
                                    </div>
                                    <p className={`text-xs font-bold ${action === id ? labelClass : 'text-gray-700'}`}>{label}</p>
                                    <p className="text-[10px] text-gray-400 leading-tight">{desc}</p>
                                    {action === id && (
                                        <div className={`w-full h-0.5 bg-gradient-to-r ${gradient} rounded-full mt-1`} />
                                    )}
                                </motion.button>
                            ))}
                        </div>
                    </div>

                    {/* Custom message for warn / clear */}
                    {(action === 'warn' || action === 'clear') && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                Custom Message to Worker <span className="text-gray-400 font-normal">(optional — blank = default)</span>
                            </label>
                            <textarea
                                value={customMessage}
                                onChange={e => setCustomMessage(e.target.value)}
                                placeholder="Will be sent via SMS to the worker..."
                                rows={3}
                                className="w-full border-2 border-gray-200 rounded-2xl p-3 text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-50 outline-none transition-all resize-none"
                            />
                        </motion.div>
                    )}

                    {/* Admin notes */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Internal Admin Notes <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        <textarea
                            value={adminNotes}
                            onChange={e => setAdminNotes(e.target.value)}
                            placeholder="Internal notes for record keeping..."
                            rows={2}
                            className="w-full border-2 border-gray-200 rounded-2xl p-3 text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-50 outline-none transition-all resize-none"
                        />
                    </div>

                    {/* Worker contact info */}
                    {worker && (
                        <div className="bg-orange-50 rounded-2xl p-4 border border-orange-200">
                            <p className="text-xs font-bold text-orange-600 mb-2 flex items-center gap-2">
                                <Phone size={12} /> Worker Contact
                            </p>
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="flex items-center gap-1.5 text-sm text-gray-700">
                                    <Phone size={13} className="text-orange-500" />
                                    <span className="font-mono font-semibold">{worker.mobile || '—'}</span>
                                </div>
                                {worker.email && (
                                    <div className="flex items-center gap-1.5 text-sm text-gray-700">
                                        <Mail size={13} className="text-orange-500" />
                                        <span className="truncate max-w-[200px]">{worker.email}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-gray-100 flex gap-3 bg-gray-50">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onClose}
                        className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-100 transition-all"
                    >
                        Cancel
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSubmit}
                        disabled={!action || submitting}
                        className={`flex-1 py-3 rounded-2xl text-white font-bold text-sm shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                            selectedAction ? `bg-gradient-to-r ${selectedAction.gradient}` : 'bg-gradient-to-r from-orange-500 to-red-500'
                        }`}
                    >
                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        {submitting ? 'Processing...' : 'Execute Action'}
                    </motion.button>
                </div>
            </motion.div>
        </motion.div>
    );
};

// ── Worker Profile Drawer ─────────────────────────────────────────────────────
const WorkerProfileDrawer = ({ complaint, onClose, onAction }) => {
    const [fullComplaint, setFullComplaint] = useState(null);
    const [loading, setLoading]             = useState(true);

    // FIX: fetch full complaint details including populated worker when drawer opens
    useEffect(() => {
        if (!complaint?._id) return;
        setLoading(true);
        api.getAdminComplaintById(complaint._id)
            .then(({ data }) => setFullComplaint(data.complaint))
            .catch(() => setFullComplaint(complaint)) // fallback to list data
            .finally(() => setLoading(false));
    }, [complaint?._id]);

    const c      = fullComplaint || complaint;
    const worker = c?.againstWorker;
    const client = c?.filedBy;

    if (!complaint) return null;

    const skills = Array.isArray(worker?.skills)
        ? worker.skills.map(s => typeof s === 'object' ? `${s.name}${s.proficiency ? ` (${s.proficiency})` : ''}` : s)
        : [];

    const isActioned = ['action-taken', 'resolved', 'dismissed', 'blocked'].includes(c?.status);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-end"
            onClick={onClose}
        >
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="relative w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white flex-shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={onClose}
                            className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all"
                        >
                            <ChevronLeft size={18} />
                        </motion.button>
                        <StatusBadge status={c?.status} />
                    </div>

                    {loading ? (
                        <div className="flex items-center gap-3">
                            <div className="w-16 h-16 rounded-2xl bg-white/20 animate-pulse" />
                            <div className="space-y-2">
                                <div className="w-32 h-4 bg-white/20 rounded animate-pulse" />
                                <div className="w-24 h-3 bg-white/20 rounded animate-pulse" />
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4">
<img
  src={
    worker?.photo
      ? getImageUrl(worker.photo)
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(worker?.name || 'W')}&background=f97316&color=fff&bold=true`
  }
  alt={worker?.name}
  className="w-12 h-12 rounded-2xl object-cover border-2 border-orange-100 shadow-sm"
  onError={(e) => {
    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(worker?.name || 'W')}&background=f97316&color=fff&bold=true`;
  }}
/>
                            <div>
                                <h3 className="text-xl font-black">{worker?.name || 'Unknown Worker'}</h3>
                                <p className="text-orange-100 text-sm">
                                    {worker?.karigarId}
                                    {worker?.overallExperience && ` · ${worker.overallExperience}`}
                                </p>
                                <p className="text-orange-100 text-xs mt-0.5 flex items-center gap-1">
                                    <Phone size={10} /> {worker?.mobile || '—'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {loading ? (
                        <div className="space-y-4">
                            {[1,2,3].map(i => (
                                <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <>
                            {/* Complaint details */}
                            <div className="bg-red-50 rounded-2xl p-5 border border-red-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
                                        <Flag size={14} className="text-red-500" />
                                    </div>
                                    <p className="text-xs font-bold text-red-600 uppercase tracking-wider">
                                        Complaint by {client?.name || 'Unknown Client'}
                                    </p>
                                </div>
                                <span className="inline-block bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full mb-3">
                                    {c?.category}
                                </span>
                                <p className="text-sm text-gray-800 leading-relaxed">{c?.description}</p>
                                <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                                    <Calendar size={10} />
                                    Filed {new Date(c?.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                            </div>

                            {/* Worker info grid */}
                            {worker && (
                                <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <User size={12} /> Worker Details
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { label: 'Mobile',      value: worker.mobile || '—',                         icon: Phone,       bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-500' },
                                            { label: 'Experience',  value: worker.experience ? `${worker.experience} yrs` : 'N/A', icon: Briefcase, bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-500'   },
                                            { label: 'Status',      value: worker.verificationStatus || '—',             icon: ShieldCheck, bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-500'  },
                                            { label: 'Points',      value: worker.points ?? '—',                         icon: Award,       bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-500' },
                                            { label: 'Gender',      value: worker.gender || 'N/A',                       icon: User,        bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-500'   },
                                            { label: 'City',        value: worker.address?.city || 'N/A',                icon: MapPin,      bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-500' },
                                        ].map(({ label, value, icon: Icon, bg, border, text }) => (
                                            <div key={label} className={`${bg} rounded-xl p-3 border ${border}`}>
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <Icon size={11} className={text} />
                                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</p>
                                                </div>
                                                <p className="text-sm font-semibold text-gray-800">{String(value)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Skills */}
                            {skills.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <Sparkles size={12} /> Skills
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {skills.map((s, i) => (
                                            <span key={i} className="bg-orange-100 text-orange-700 text-xs font-medium px-3 py-1.5 rounded-full border border-orange-200">
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Admin action result */}
                            {c?.adminNotes && (
                                <div className={`rounded-2xl p-4 border ${
                                    c.adminAction === 'blocked'  ? 'bg-red-50 border-red-200' :
                                    c.adminAction === 'warned'   ? 'bg-yellow-50 border-yellow-200' :
                                    c.adminAction === 'cleared'  ? 'bg-green-50 border-green-200' :
                                    'bg-gray-50 border-gray-200'
                                }`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Shield size={14} className="text-gray-600" />
                                        <p className="text-xs font-bold uppercase tracking-wider text-gray-600">Admin Action Taken</p>
                                    </div>
                                    <p className="text-sm text-gray-800 leading-relaxed">{c.adminNotes}</p>
                                    <div className="flex items-center justify-between mt-3">
                                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                                            c.adminAction === 'blocked'  ? 'bg-red-100 text-red-700' :
                                            c.adminAction === 'warned'   ? 'bg-yellow-100 text-yellow-700' :
                                            c.adminAction === 'cleared'  ? 'bg-green-100 text-green-700' :
                                            'bg-gray-100 text-gray-600'
                                        }`}>
                                            {c.adminAction}
                                        </span>
                                        {c.actionTakenAt && (
                                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                                <Calendar size={10} />
                                                {new Date(c.actionTakenAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Call button */}
                            {worker?.mobile && (
                                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                                    <p className="text-xs font-bold text-gray-500 mb-3 flex items-center gap-2">
                                        <Phone size={12} /> Quick Contact
                                    </p>
                                    <a
                                        href={`tel:+91${worker.mobile}`}
                                        className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl font-bold text-sm shadow-lg hover:shadow-green-300 transition-all hover:scale-105 active:scale-95"
                                    >
                                        <Phone size={16} />
                                        Call {worker.name}: {worker.mobile}
                                    </a>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Action footer */}
                {!isActioned && !loading && (
                    <div className="flex-shrink-0 p-5 border-t border-gray-100 bg-white">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onAction}
                            className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl font-black shadow-lg hover:shadow-orange-300 transition-all flex items-center justify-center gap-2"
                        >
                            <AlertTriangle size={18} />
                            Take Action on This Complaint
                        </motion.button>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, color, icon: Icon, gradient }) => (
    <motion.div
        whileHover={{ y: -2, scale: 1.02 }}
        className={`bg-white rounded-2xl p-4 border-l-4 shadow-md hover:shadow-xl transition-all ${color}`}
    >
        <div className="flex items-center justify-between mb-2">
            <p className="text-2xl font-black text-gray-900">{value}</p>
            <div className={`w-8 h-8 rounded-xl bg-gradient-to-r ${gradient} flex items-center justify-center shadow-sm`}>
                <Icon size={14} className="text-white" />
            </div>
        </div>
        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">{label}</p>
    </motion.div>
);

// ── Shared state hook ─────────────────────────────────────────────────────────
function useComplaintsLogic() {
    const [complaints, setComplaints]         = useState([]);
    const [stats, setStats]                   = useState({});
    const [loading, setLoading]               = useState(true);
    const [statusFilter, setStatusFilter]     = useState('all');
    const [searchTerm, setSearchTerm]         = useState('');
    const [page, setPage]                     = useState(1);
    const [totalPages, setTotalPages]         = useState(1);
    const [viewComplaint, setViewComplaint]   = useState(null);
    const [actionComplaint, setActionComplaint] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [listRes, statsRes] = await Promise.all([
                api.getAdminComplaints({ status: statusFilter, page }),
                api.getAdminComplaintStats(),
            ]);
            setComplaints(listRes.data.complaints || []);
            setTotalPages(listRes.data.totalPages || 1);
            setStats(statsRes.data || {});
        } catch (err) {
            toast.error('Failed to load complaints.');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, page]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { setPage(1); }, [statusFilter]);

    const filtered = complaints.filter(c => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (
            c.againstWorker?.name?.toLowerCase().includes(q)    ||
            c.againstWorker?.karigarId?.toLowerCase().includes(q) ||
            c.filedBy?.name?.toLowerCase().includes(q)          ||
            c.category?.toLowerCase().includes(q)
        );
    });

    return {
        complaints, stats, loading, statusFilter, setStatusFilter,
        searchTerm, setSearchTerm, page, setPage, totalPages,
        viewComplaint, setViewComplaint, actionComplaint, setActionComplaint,
        fetchData, filtered,
    };
}

// ── Complaints Body ───────────────────────────────────────────────────────────
function ComplaintsBody({ logic }) {
    const {
        stats, loading, statusFilter, setStatusFilter,
        searchTerm, setSearchTerm, page, setPage, totalPages,
        viewComplaint, setViewComplaint, actionComplaint, setActionComplaint,
        fetchData, filtered,
    } = logic;

    const STATUS_FILTERS = [
        { id: 'all',          label: 'All',          count: stats.total       || 0, icon: BarChart3,   gradient: 'from-gray-500 to-gray-600'    },
        { id: 'submitted',    label: 'New',          count: stats.submitted   || 0, icon: Clock,       gradient: 'from-yellow-500 to-amber-500'  },
        { id: 'in-review',    label: 'In Review',    count: stats.inReview    || 0, icon: Eye,         gradient: 'from-blue-500 to-indigo-500'   },
        { id: 'action-taken', label: 'Action Taken', count: stats.actionTaken || 0, icon: Flag,        gradient: 'from-orange-500 to-red-500'    },
        { id: 'resolved',     label: 'Resolved',     count: stats.resolved    || 0, icon: CheckCircle, gradient: 'from-green-500 to-emerald-500' },
        { id: 'dismissed',    label: 'Dismissed',    count: stats.dismissed   || 0, icon: XCircle,     gradient: 'from-gray-500 to-gray-600'     },
        { id: 'blocked',      label: 'Blocked',      count: stats.blocked     || 0, icon: ShieldX,     gradient: 'from-red-500 to-rose-500'      },
    ];

    const STAT_CARDS = [
        { label: 'Total',        value: stats.total       || 0, icon: BarChart3,   gradient: 'from-gray-500 to-gray-600',    color: 'border-gray-400'   },
        { label: 'New',          value: stats.submitted   || 0, icon: Clock,       gradient: 'from-yellow-500 to-amber-500', color: 'border-yellow-500' },
        { label: 'In Review',    value: stats.inReview    || 0, icon: Eye,         gradient: 'from-blue-500 to-indigo-500',  color: 'border-blue-500'   },
        { label: 'Action Taken', value: stats.actionTaken || 0, icon: Flag,        gradient: 'from-orange-500 to-red-500',   color: 'border-orange-500' },
        { label: 'Resolved',     value: stats.resolved    || 0, icon: CheckCircle, gradient: 'from-green-500 to-emerald-500',color: 'border-green-500'  },
        { label: 'Dismissed',    value: stats.dismissed   || 0, icon: XCircle,     gradient: 'from-gray-500 to-gray-600',    color: 'border-gray-400'   },
        { label: 'Blocked',      value: stats.blocked     || 0, icon: ShieldX,     gradient: 'from-red-500 to-rose-500',     color: 'border-red-500'    },
    ];

    return (
        <>
            <AnimatePresence>
                {viewComplaint && (
                    <WorkerProfileDrawer
                        complaint={viewComplaint}
                        onClose={() => setViewComplaint(null)}
                        onAction={() => {
                            setActionComplaint(viewComplaint);
                            setViewComplaint(null);
                        }}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {actionComplaint && (
                    <ActionModal
                        complaint={actionComplaint}
                        onClose={() => setActionComplaint(null)}
                        onDone={fetchData}
                    />
                )}
            </AnimatePresence>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mb-6">
                {STAT_CARDS.map((card, idx) => (
                    <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                        <StatCard {...card} />
                    </motion.div>
                ))}
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-2xl border-2 border-orange-100 shadow-md p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex flex-wrap gap-2 flex-1">
                        {STATUS_FILTERS.map(({ id, label, count, icon: Icon, gradient }) => (
                            <motion.button
                                key={id}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setStatusFilter(id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    statusFilter === id
                                        ? `bg-gradient-to-r ${gradient} text-white shadow-md`
                                        : 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                                }`}
                            >
                                <Icon size={12} />
                                {label}
                                {count > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                                        statusFilter === id ? 'bg-white/30 text-white' : 'bg-orange-100 text-orange-700'
                                    }`}>
                                        {count}
                                    </span>
                                )}
                            </motion.button>
                        ))}
                    </div>
                    <div className="relative md:w-64">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search complaints..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-50 outline-none transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Complaint List */}
            <AnimatePresence mode="wait">
                {loading ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20">
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full" />
                        <p className="mt-4 text-gray-500 font-semibold">Loading complaints...</p>
                    </motion.div>
                ) : filtered.length === 0 ? (
                    <motion.div key="empty" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center py-20 bg-white rounded-3xl shadow-xl border border-gray-100">
                        <div className="text-6xl mb-4">🛡️</div>
                        <p className="font-bold text-gray-800 text-xl mb-2">No complaints found</p>
                        <p className="text-gray-400 text-sm">
                            {statusFilter !== 'all' ? `No complaints with status "${statusFilter}"` : 'No complaints yet'}
                        </p>
                        {(statusFilter !== 'all' || searchTerm) && (
                            <button
                                onClick={() => { setStatusFilter('all'); setSearchTerm(''); }}
                                className="mt-6 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold hover:shadow-lg transition-all"
                            >
                                Clear Filters
                            </button>
                        )}
                    </motion.div>
                ) : (
                    <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                        {filtered.map((c, idx) => {
                            const worker     = c.againstWorker;
                            const client     = c.filedBy;
                            const isActioned = ['action-taken', 'resolved', 'dismissed', 'blocked'].includes(c.status);

                            return (
                                <motion.div
                                    key={c._id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    whileHover={{ y: -2 }}
                                    className="bg-white rounded-2xl border-2 border-gray-100 shadow-md hover:shadow-xl transition-all overflow-hidden"
                                >
                                    <div className="p-5">
                                        <div className="flex flex-col md:flex-row md:items-start gap-4">
                                            {/* Worker info */}
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="relative flex-shrink-0">
                                                    <img
  src={
    worker?.photo
      ? getImageUrl(worker.photo)
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(worker?.name || 'W')}&background=f97316&color=fff&bold=true`
  }
  alt={worker?.name}
  className="w-12 h-12 rounded-2xl object-cover border-2 border-orange-100 shadow-sm"
  onError={(e) => {
    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(worker?.name || 'W')}&background=f97316&color=fff&bold=true`;
  }}
/>
                                                    <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                                                        worker?.verificationStatus === 'approved' ? 'bg-green-500' :
                                                        worker?.verificationStatus === 'blocked'  ? 'bg-red-500' : 'bg-gray-400'
                                                    }`} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="font-bold text-gray-900 text-sm">{worker?.name || 'Unknown Worker'}</p>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                            worker?.verificationStatus === 'blocked' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                                                        }`}>
                                                            {worker?.verificationStatus || 'unknown'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-orange-600 font-mono font-semibold">{worker?.karigarId}</p>
                                                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                        <Phone size={10} /> {worker?.mobile || '—'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Complaint info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                                    <span className="bg-red-50 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full border border-red-200">
                                                        {c.category}
                                                    </span>
                                                    <StatusBadge status={c.status} />
                                                </div>
                                                <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">{c.description}</p>
                                                <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                                                    <User size={10} /> By <strong>{client?.name || 'Unknown'}</strong>
                                                    <span className="w-1 h-1 rounded-full bg-gray-300 inline-block" />
                                                    <Calendar size={10} />
                                                    {new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </p>
                                            </div>

                                            {/* Action buttons */}
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <motion.button
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => setViewComplaint(c)}
                                                    className="p-2.5 bg-orange-100 text-orange-600 rounded-xl hover:bg-orange-200 transition-all"
                                                    title="View full details"
                                                >
                                                    <Eye size={15} />
                                                </motion.button>
                                                {!isActioned ? (
                                                    <motion.button
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        onClick={() => setActionComplaint(c)}
                                                        className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all"
                                                    >
                                                        Take Action
                                                    </motion.button>
                                                ) : (
                                                    <span className={`text-xs font-bold px-3 py-1.5 rounded-xl ${
                                                        c.adminAction === 'blocked'  ? 'bg-red-100 text-red-700 border border-red-200' :
                                                        c.adminAction === 'warned'   ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                                                        c.adminAction === 'cleared'  ? 'bg-green-100 text-green-700 border border-green-200' :
                                                        'bg-gray-100 text-gray-600 border border-gray-200'
                                                    }`}>
                                                        ✓ {c.adminAction}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Admin notes bar */}
                                    {c.adminNotes && (
                                        <div className={`px-5 py-2.5 border-t text-xs ${
                                            c.adminAction === 'blocked'  ? 'bg-red-50 border-red-100 text-red-700' :
                                            c.adminAction === 'warned'   ? 'bg-yellow-50 border-yellow-100 text-yellow-700' :
                                            c.adminAction === 'cleared'  ? 'bg-green-50 border-green-100 text-green-700' :
                                            'bg-gray-50 border-gray-100 text-gray-600'
                                        }`}>
                                            <strong>Admin Notes:</strong> {c.adminNotes}
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Pagination */}
            {totalPages > 1 && filtered.length > 0 && (
                <div className="flex justify-center gap-3 mt-8">
                    <motion.button
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-5 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-semibold disabled:opacity-40 hover:bg-orange-50 hover:border-orange-300 transition-all"
                    >
                        Previous
                    </motion.button>
                    <div className="flex items-center gap-2">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5)          pageNum = i + 1;
                            else if (page <= 3)           pageNum = i + 1;
                            else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                            else                          pageNum = page - 2 + i;
                            if (pageNum < 1 || pageNum > totalPages) return null;
                            return (
                                <motion.button
                                    key={pageNum}
                                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                    onClick={() => setPage(pageNum)}
                                    className={`w-9 h-9 rounded-xl text-sm font-bold transition-all ${
                                        page === pageNum
                                            ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                                            : 'bg-gray-100 text-gray-600 hover:bg-orange-100'
                                    }`}
                                >
                                    {pageNum}
                                </motion.button>
                            );
                        })}
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-5 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-semibold disabled:opacity-40 hover:bg-orange-50 hover:border-orange-300 transition-all"
                    >
                        Next
                    </motion.button>
                </div>
            )}
        </>
    );
}

// ── Named export: used by AdminDashboard inline ───────────────────────────────
export function AdminComplaintsContent() {
    const logic = useComplaintsLogic();
    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-black text-gray-900">Complaint Management</h1>
                    <p className="text-gray-500 text-sm">Client complaints against workers</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.05, rotate: 180 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={logic.fetchData}
                    className="p-2 bg-orange-100 text-orange-600 rounded-xl hover:bg-orange-200 transition-all"
                >
                    <RefreshCw size={18} className={logic.loading ? 'animate-spin' : ''} />
                </motion.button>
            </div>
            <ComplaintsBody logic={logic} />
        </div>
    );
}

// ── Default export: standalone page ──────────────────────────────────────────
export default function AdminComplaints() {
    const navigate = useNavigate();
    const logic    = useComplaintsLogic();

    return (
        <div className="bg-gradient-to-br from-orange-50/30 via-white to-orange-50/20 p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
                <ComplaintsBody logic={logic} />
            </div>
        </div>
    );
}