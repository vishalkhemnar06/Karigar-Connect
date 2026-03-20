// src/pages/admin/AdminComplaints.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';
import logo from '../../assets/logo.jpg';
import {
    AlertTriangle, Eye, Phone, Mail, ShieldX, ShieldCheck,
    MessageSquare, CheckCircle, X, Clock, RefreshCw,
    User, Briefcase, MapPin, Star, Loader2,
    Search, ChevronLeft, Send, XCircle, AlertCircle
} from 'lucide-react';

// ── Status badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const map = {
        submitted:     { cls: 'bg-yellow-100 text-yellow-800 border-yellow-200',  label: 'Submitted' },
        'in-review':   { cls: 'bg-blue-100 text-blue-800 border-blue-200',        label: 'In Review' },
        'action-taken':{ cls: 'bg-orange-100 text-orange-800 border-orange-200',  label: 'Action Taken' },
        resolved:      { cls: 'bg-green-100 text-green-800 border-green-200',     label: 'Resolved' },
        dismissed:     { cls: 'bg-gray-100 text-gray-500 border-gray-200',        label: 'Dismissed' },
        blocked:       { cls: 'bg-red-100 text-red-700 border-red-200',           label: 'Blocked' },
    };
    const { cls, label } = map[status] || map.submitted;
    return <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${cls}`}>{label}</span>;
};

// ── Action Modal ─────────────────────────────────────────────────────────────
const ActionModal = ({ complaint, onClose, onDone }) => {
    const [action, setAction]               = useState('');
    const [customMessage, setCustomMessage] = useState('');
    const [adminNotes, setAdminNotes]       = useState('');
    const [submitting, setSubmitting]       = useState(false);

    const worker = complaint?.againstWorker;

    const ACTIONS = [
        {
            id: 'warn',
            label: 'Send Warning',
            icon: MessageSquare,
            desc: 'Send SMS & email warning. Worker can continue working.',
            activeClass: 'border-yellow-500 bg-yellow-50',
            iconClass: 'bg-yellow-100 text-yellow-600',
            labelClass: 'text-yellow-700',
            btnClass: 'bg-yellow-500 hover:bg-yellow-600 shadow-yellow-200',
        },
        {
            id: 'block',
            label: 'Block Worker',
            icon: ShieldX,
            desc: 'Block account. Complaint moves to Blocked section.',
            activeClass: 'border-red-500 bg-red-50',
            iconClass: 'bg-red-100 text-red-600',
            labelClass: 'text-red-700',
            btnClass: 'bg-red-500 hover:bg-red-600 shadow-red-200',
        },
        {
            id: 'clear',
            label: 'Clear & Continue',
            icon: ShieldCheck,
            desc: 'Worker cleared. Complaint moves to Resolved section.',
            activeClass: 'border-green-500 bg-green-50',
            iconClass: 'bg-green-100 text-green-600',
            labelClass: 'text-green-700',
            btnClass: 'bg-green-500 hover:bg-green-600 shadow-green-200',
        },
        {
            id: 'dismiss',
            label: 'Dismiss',
            icon: XCircle,
            desc: 'No action taken. Complaint moves to Dismissed section.',
            activeClass: 'border-gray-400 bg-gray-50',
            iconClass: 'bg-gray-100 text-gray-500',
            labelClass: 'text-gray-600',
            btnClass: 'bg-gray-500 hover:bg-gray-600 shadow-gray-200',
        },
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-600 to-red-500 p-5 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-black">Take Action</h3>
                            <p className="text-orange-100 text-xs mt-0.5">
                                Against: <strong>{worker?.name}</strong> · {worker?.karigarId}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                    {/* Action selection */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3">Select Action</label>
                        <div className="grid grid-cols-2 gap-3">
                            {ACTIONS.map(({ id, label, icon: Icon, desc, activeClass, iconClass, labelClass }) => (
                                <button
                                    key={id}
                                    onClick={() => setAction(id)}
                                    className={`flex flex-col items-start gap-1.5 p-3.5 rounded-2xl border-2 text-left transition-all ${
                                        action === id ? activeClass : 'border-gray-100 hover:border-gray-200 bg-white'
                                    }`}
                                >
                                    <div className={`p-1.5 rounded-xl ${action === id ? iconClass : 'bg-gray-100'}`}>
                                        <Icon size={15} className={action === id ? iconClass.split(' ')[1] : 'text-gray-400'} />
                                    </div>
                                    <p className={`text-xs font-bold ${action === id ? labelClass : 'text-gray-700'}`}>{label}</p>
                                    <p className="text-[10px] text-gray-400 leading-tight">{desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom message for warn / clear */}
                    {(action === 'warn' || action === 'clear') && (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                Custom Message to Worker <span className="text-gray-400 font-normal">(optional — leave blank for default)</span>
                            </label>
                            <textarea
                                value={customMessage}
                                onChange={e => setCustomMessage(e.target.value)}
                                placeholder="Will be sent via SMS and email to the worker..."
                                rows={3}
                                className="w-full border-2 border-gray-100 rounded-2xl p-3 text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-50 outline-none transition-all resize-none"
                            />
                        </div>
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
                            className="w-full border-2 border-gray-100 rounded-2xl p-3 text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-50 outline-none transition-all resize-none"
                        />
                    </div>

                    {/* Worker contact */}
                    <div className="bg-orange-50 rounded-2xl p-3 border border-orange-100">
                        <p className="text-xs font-bold text-orange-600 mb-2">Worker Contact</p>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 text-sm text-gray-700">
                                <Phone size={13} className="text-orange-500" />
                                <span className="font-mono">{worker?.mobile || '—'}</span>
                            </div>
                            {worker?.email && (
                                <div className="flex items-center gap-1.5 text-sm text-gray-700">
                                    <Mail size={13} className="text-orange-500" />
                                    <span className="truncate max-w-[160px]">{worker.email}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-gray-100 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!action || submitting}
                        className={`flex-1 py-3 rounded-2xl text-white font-bold text-sm shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                            selectedAction?.btnClass || 'bg-orange-500 hover:bg-orange-600 shadow-orange-200'
                        }`}
                    >
                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        {submitting ? 'Processing...' : 'Execute Action'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Worker Profile Drawer ─────────────────────────────────────────────────────
const WorkerProfileDrawer = ({ complaint, onClose, onAction }) => {
    if (!complaint) return null;
    const worker = complaint.againstWorker;
    const client = complaint.filedBy;
    if (!worker) return null;

    const skills = Array.isArray(worker.skills)
        ? worker.skills.map(s => typeof s === 'object' ? `${s.name} (${s.proficiency})` : s)
        : [];

    const isActioned = ['action-taken', 'resolved', 'dismissed', 'blocked'].includes(complaint.status);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-end">
            <div className="absolute inset-0" onClick={onClose} />
            <div className="relative w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-600 to-amber-500 p-5 text-white flex-shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={onClose} className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all">
                            <ChevronLeft size={18} />
                        </button>
                        <StatusBadge status={complaint.status} />
                    </div>
                    <div className="flex items-center gap-4">
                        <img
                            src={worker.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.name)}&background=f97316&color=fff`}
                            alt={worker.name}
                            className="w-16 h-16 rounded-2xl object-cover border-2 border-white/50 shadow-lg"
                            onError={e => { e.target.src = `https://ui-avatars.com/api/?name=W&background=f97316&color=fff`; }}
                        />
                        <div>
                            <h3 className="text-xl font-black">{worker.name}</h3>
                            <p className="text-orange-100 text-sm">{worker.karigarId} · {worker.overallExperience || 'Worker'}</p>
                            <p className="text-orange-100 text-xs mt-0.5">{worker.mobile}</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Complaint details */}
                    <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
                        <p className="text-xs font-black text-red-600 uppercase tracking-wider mb-1">
                            Complaint by {client?.name}
                        </p>
                        <span className="inline-block bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full mb-2">
                            {complaint.category}
                        </span>
                        <p className="text-sm text-gray-800 leading-relaxed">{complaint.description}</p>
                        <p className="text-xs text-gray-400 mt-2">
                            Filed {new Date(complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>

                    {/* Worker info grid */}
                    <div>
                        <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">Worker Details</h4>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Mobile',     value: worker.mobile,                                  icon: Phone },
                                { label: 'Experience', value: worker.experience ? `${worker.experience} yrs` : 'N/A', icon: Briefcase },
                                { label: 'Status',     value: worker.verificationStatus,                      icon: ShieldCheck },
                                { label: 'Score',      value: worker.points ?? '—',                           icon: Star },
                                { label: 'Gender',     value: worker.gender || 'N/A',                         icon: User },
                                { label: 'City',       value: worker.address?.city || 'N/A',                  icon: MapPin },
                            ].map(({ label, value, icon: Icon }) => (
                                <div key={label} className="bg-orange-50/60 rounded-xl p-3 border border-orange-100/50">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Icon size={11} className="text-orange-500" />
                                        <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">{label}</p>
                                    </div>
                                    <p className="text-sm font-semibold text-gray-800">{String(value)}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Skills */}
                    {skills.length > 0 && (
                        <div>
                            <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Skills</h4>
                            <div className="flex flex-wrap gap-2">
                                {skills.map((s, i) => (
                                    <span key={i} className="bg-orange-100 text-orange-700 text-xs font-medium px-2.5 py-1 rounded-full">{s}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Admin action result */}
                    {complaint.adminNotes && (
                        <div className={`rounded-2xl p-4 border ${
                            complaint.adminAction === 'blocked'   ? 'bg-red-50 border-red-100' :
                            complaint.adminAction === 'warned'    ? 'bg-yellow-50 border-yellow-100' :
                            complaint.adminAction === 'cleared'   ? 'bg-green-50 border-green-100' :
                            'bg-gray-50 border-gray-100'
                        }`}>
                            <p className="text-xs font-black uppercase tracking-wider mb-2 text-gray-600">Admin Action Taken</p>
                            <p className="text-sm text-gray-800">{complaint.adminNotes}</p>
                            <div className="flex items-center justify-between mt-2">
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                    complaint.adminAction === 'blocked'  ? 'bg-red-100 text-red-700' :
                                    complaint.adminAction === 'warned'   ? 'bg-yellow-100 text-yellow-700' :
                                    complaint.adminAction === 'cleared'  ? 'bg-green-100 text-green-700' :
                                    'bg-gray-100 text-gray-600'
                                }`}>
                                    {complaint.adminAction}
                                </span>
                                {complaint.actionTakenAt && (
                                    <span className="text-xs text-gray-400">
                                        {new Date(complaint.actionTakenAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Call button */}
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                        <p className="text-xs font-bold text-gray-500 mb-3">Quick Contact</p>
                        <a
                            href={`tel:+91${worker.mobile}`}
                            className="flex items-center justify-center gap-2 w-full py-3 bg-green-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-green-200 hover:bg-green-600 transition-all"
                        >
                            <Phone size={16} />
                            Call {worker.name}: {worker.mobile}
                        </a>
                    </div>
                </div>

                {/* Action footer — hidden if already actioned */}
                {!isActioned && (
                    <div className="flex-shrink-0 p-5 border-t border-gray-100 bg-white">
                        <button
                            onClick={onAction}
                            className="w-full py-4 bg-gradient-to-r from-orange-600 to-red-500 text-white rounded-2xl font-black shadow-lg shadow-orange-200 hover:shadow-orange-300 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                            <AlertTriangle size={18} />
                            Take Action on This Complaint
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminComplaints() {
    const navigate = useNavigate();

    const [complaints, setComplaints]           = useState([]);
    const [stats, setStats]                     = useState({});
    const [loading, setLoading]                 = useState(true);
    const [statusFilter, setStatusFilter]       = useState('all');
    const [searchTerm, setSearchTerm]           = useState('');
    const [page, setPage]                       = useState(1);
    const [totalPages, setTotalPages]           = useState(1);
    const [viewComplaint, setViewComplaint]     = useState(null);
    const [actionComplaint, setActionComplaint] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [listRes, statsRes] = await Promise.all([
                api.getAdminComplaints({ status: statusFilter, page }),
                api.getAdminComplaintStats(),
            ]);
            setComplaints(listRes.data.complaints || []);
            setTotalPages(listRes.data.totalPages  || 1);
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
            c.againstWorker?.name?.toLowerCase().includes(q) ||
            c.againstWorker?.karigarId?.toLowerCase().includes(q) ||
            c.filedBy?.name?.toLowerCase().includes(q) ||
            c.category?.toLowerCase().includes(q)
        );
    });

    // Status filter tabs — includes 'blocked' as its own section
    const STATUS_FILTERS = [
        { id: 'all',          label: 'All',          count: stats.total       || 0 },
        { id: 'submitted',    label: 'New',          count: stats.submitted   || 0 },
        { id: 'in-review',    label: 'In Review',    count: stats.inReview    || 0 },
        { id: 'action-taken', label: 'Action Taken', count: stats.actionTaken || 0 },
        { id: 'resolved',     label: 'Resolved',     count: stats.resolved    || 0 },
        { id: 'dismissed',    label: 'Dismissed',    count: stats.dismissed   || 0 },
        { id: 'blocked',      label: 'Blocked',      count: stats.blocked     || 0 },
    ];

    const STAT_CARDS = [
        { label: 'Total',        value: stats.total       || 0, color: 'border-gray-400' },
        { label: 'New',          value: stats.submitted   || 0, color: 'border-yellow-500' },
        { label: 'In Review',    value: stats.inReview    || 0, color: 'border-blue-500' },
        { label: 'Action Taken', value: stats.actionTaken || 0, color: 'border-orange-500' },
        { label: 'Resolved',     value: stats.resolved    || 0, color: 'border-green-500' },
        { label: 'Dismissed',    value: stats.dismissed   || 0, color: 'border-gray-400' },
        { label: 'Blocked',      value: stats.blocked     || 0, color: 'border-red-500' },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white">
            {/* Modals */}
            {viewComplaint && (
                <WorkerProfileDrawer
                    complaint={viewComplaint}
                    onClose={() => setViewComplaint(null)}
                    onAction={() => { setActionComplaint(viewComplaint); setViewComplaint(null); }}
                />
            )}
            {actionComplaint && (
                <ActionModal
                    complaint={actionComplaint}
                    onClose={() => setActionComplaint(null)}
                    onDone={fetchData}
                />
            )}

            {/* Header */}
            <header className="bg-gradient-to-r from-orange-600 to-orange-400 shadow-lg sticky top-0 z-40">
                <div className="flex items-center gap-4 p-4">
                    <button
                        onClick={() => navigate('/admin/dashboard')}
                        className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all text-white"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <img src={logo} alt="Logo" className="w-9 h-9 rounded-full object-cover border-2 border-white/40" />
                    <div className="flex-1">
                        <h1 className="text-lg font-black text-white">Complaint Management</h1>
                        <p className="text-orange-100 text-xs">Client complaints against workers</p>
                    </div>
                    <button onClick={fetchData} className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all text-white">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

            <div className="p-4 md:p-6 max-w-6xl mx-auto">
                {/* Stat cards */}
                <div className="grid grid-cols-4 md:grid-cols-7 gap-3 mb-6">
                    {STAT_CARDS.map(({ label, value, color }) => (
                        <div key={label} className={`bg-white rounded-2xl p-3 border-l-4 shadow-sm ${color}`}>
                            <p className="text-xl font-black text-gray-900">{value}</p>
                            <p className="text-[10px] text-gray-500 font-medium leading-tight mt-0.5">{label}</p>
                        </div>
                    ))}
                </div>

                {/* Filter bar */}
                <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-4 mb-6">
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="flex flex-wrap gap-2 flex-1">
                            {STATUS_FILTERS.map(({ id, label, count }) => (
                                <button
                                    key={id}
                                    onClick={() => setStatusFilter(id)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                        statusFilter === id
                                            ? 'bg-orange-500 text-white shadow-sm'
                                            : 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                                    }`}
                                >
                                    {label}
                                    {count > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                                            statusFilter === id ? 'bg-white/30 text-white' : 'bg-orange-100 text-orange-700'
                                        }`}>{count}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                        <div className="relative md:w-56">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border-2 border-gray-100 rounded-xl text-sm focus:border-orange-400 outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Complaint list */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 size={32} className="animate-spin text-orange-400" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <AlertTriangle size={48} className="mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No complaints found</p>
                        <p className="text-sm mt-1">
                            {statusFilter !== 'all' ? `No complaints with status "${statusFilter}"` : 'No complaints yet'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filtered.map(c => {
                            const worker = c.againstWorker;
                            const client = c.filedBy;
                            const isActioned = ['action-taken', 'resolved', 'dismissed', 'blocked'].includes(c.status);

                            return (
                                <div key={c._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
                                    <div className="p-5">
                                        <div className="flex flex-col md:flex-row md:items-start gap-4">
                                            {/* Worker info */}
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="relative flex-shrink-0">
                                                    <img
                                                        src={worker?.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(worker?.name || 'W')}&background=f97316&color=fff`}
                                                        alt={worker?.name}
                                                        className="w-12 h-12 rounded-2xl object-cover border-2 border-orange-100"
                                                        onError={e => { e.target.src = `https://ui-avatars.com/api/?name=W&background=f97316&color=fff`; }}
                                                    />
                                                    <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                                                        worker?.verificationStatus === 'approved' ? 'bg-green-400' :
                                                        worker?.verificationStatus === 'blocked'  ? 'bg-red-400' : 'bg-gray-300'
                                                    }`} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="font-bold text-gray-900 text-sm">{worker?.name || 'Unknown Worker'}</p>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                                            worker?.verificationStatus === 'blocked' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                                                        }`}>
                                                            {worker?.verificationStatus}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-orange-600 font-mono">{worker?.karigarId}</p>
                                                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                        <Phone size={10} /> {worker?.mobile}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Complaint info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                                    <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                                        {c.category}
                                                    </span>
                                                    <StatusBadge status={c.status} />
                                                </div>
                                                <p className="text-sm text-gray-700 line-clamp-2">{c.description}</p>
                                                <p className="text-xs text-gray-400 mt-1.5">
                                                    By <strong>{client?.name || 'Unknown'}</strong> ·{' '}
                                                    {new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </p>
                                            </div>

                                            {/* Action buttons */}
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <button
                                                    onClick={() => setViewComplaint(c)}
                                                    className="p-2.5 bg-orange-100 text-orange-600 rounded-xl hover:bg-orange-200 transition-all"
                                                    title="View full details"
                                                >
                                                    <Eye size={15} />
                                                </button>
                                                {!isActioned && (
                                                    <button
                                                        onClick={() => setActionComplaint(c)}
                                                        className="px-3 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
                                                    >
                                                        Take Action
                                                    </button>
                                                )}
                                                {isActioned && (
                                                    <span className={`text-xs font-bold px-2.5 py-1.5 rounded-xl ${
                                                        c.adminAction === 'blocked'   ? 'bg-red-100 text-red-700' :
                                                        c.adminAction === 'warned'    ? 'bg-yellow-100 text-yellow-700' :
                                                        c.adminAction === 'cleared'   ? 'bg-green-100 text-green-700' :
                                                        'bg-gray-100 text-gray-600'
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
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-6">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-4 py-2 rounded-xl border text-sm font-medium disabled:opacity-40 hover:bg-orange-50 transition-all"
                        >
                            Previous
                        </button>
                        <span className="px-4 py-2 text-sm text-gray-600 font-medium">
                            {page} / {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-4 py-2 rounded-xl border text-sm font-medium disabled:opacity-40 hover:bg-orange-50 transition-all"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}