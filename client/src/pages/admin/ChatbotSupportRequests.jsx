import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
    AlertTriangle, CheckCircle2, Clock3, RefreshCw, Send, Trash2, User, Phone, ShieldAlert,
    MessageSquare, XCircle, CircleCheckBig, History, TimerReset, CornerDownRight, Users,
    Search, Filter, MoreVertical, ChevronRight, Inbox, MessageCircle, BadgeCheck,
    Clock, Calendar, Loader2, ArrowLeft, Check, X, MinusCircle
} from 'lucide-react';
import * as api from '../../api';

const POLL_INTERVAL_MS = 1000;

const formatClock = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};

const formatDuration = (seconds = 0) => {
    const total = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
};

const statusConfig = {
    pending: { 
        label: 'Pending', 
        gradient: 'from-amber-500 to-orange-500',
        icon: Clock3,
        bgLight: 'bg-amber-50',
        textLight: 'text-amber-700',
        borderLight: 'border-amber-200'
    },
    accepted: { 
        label: 'Connected', 
        gradient: 'from-emerald-500 to-green-500',
        icon: CheckCircle2,
        bgLight: 'bg-emerald-50',
        textLight: 'text-emerald-700',
        borderLight: 'border-emerald-200'
    },
    closed: { 
        label: 'Closed', 
        gradient: 'from-slate-500 to-gray-600',
        icon: CircleCheckBig,
        bgLight: 'bg-slate-100',
        textLight: 'text-slate-600',
        borderLight: 'border-slate-200'
    },
    expired: { 
        label: 'Expired', 
        gradient: 'from-rose-500 to-red-500',
        icon: XCircle,
        bgLight: 'bg-rose-50',
        textLight: 'text-rose-700',
        borderLight: 'border-rose-200'
    },
};

export default function ChatbotSupportRequests() {
    const [requests, setRequests] = useState([]);
    const [activeRequest, setActiveRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [reply, setReply] = useState('');
    const [filter, setFilter] = useState('pending');
    const [searchTerm, setSearchTerm] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [acceptPopup, setAcceptPopup] = useState(null);
    const messageListRef = useRef(null);
    const activeRequestRef = useRef(null);
    const lastPendingKeysRef = useRef([]);
    const filterRef = useRef(filter);

    const filteredRequests = useMemo(() => {
        let filtered = filter === 'all' ? requests : requests.filter((request) => request.status === filter);
        
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(request => 
                request.clientName?.toLowerCase().includes(term) ||
                request.clientMobile?.includes(term) ||
                request.initialMessage?.toLowerCase().includes(term)
            );
        }
        
        return filtered;
    }, [requests, filter, searchTerm]);

    const pendingCount = requests.filter((request) => request.status === 'pending').length;
    const activeCount = requests.filter((request) => request.status === 'accepted').length;
    const closedCount = requests.filter((request) => request.status === 'closed').length;

    useEffect(() => {
        activeRequestRef.current = activeRequest;
    }, [activeRequest]);

    useEffect(() => {
        if (!acceptPopup) return undefined;
        const timer = window.setTimeout(() => setAcceptPopup(null), 5000);
        return () => window.clearTimeout(timer);
    }, [acceptPopup]);

    useEffect(() => {
        filterRef.current = filter;
    }, [filter]);

    const loadRequests = async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        try {
            const { data } = await api.getAdminChatbotSupportRequests();
            const nextRequests = Array.isArray(data?.requests) ? data.requests : [];
            setRequests(nextRequests);

            const nextPendingKeys = nextRequests
                .filter((request) => request.status === 'pending')
                .map((request) => request.id);

            const newPending = nextRequests.filter(
                (request) => request.status === 'pending' && !lastPendingKeysRef.current.includes(request.id)
            );
            if (newPending.length > 0 && !silent) {
                const topRequest = newPending[0];
                toast.custom((t) => (
                    <div className="bg-white rounded-xl shadow-lg border-l-4 border-orange-500 p-3 max-w-sm">
                        <div className="flex items-start gap-3">
                            <div className="bg-orange-100 rounded-full p-2">
                                <ShieldAlert className="text-orange-600" size={18} />
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-gray-900">New Support Request</p>
                                <p className="text-sm text-gray-600">{topRequest.clientName} • {topRequest.clientMobile}</p>
                            </div>
                        </div>
                    </div>
                ), { duration: 5000 });
            }
            lastPendingKeysRef.current = nextPendingKeys;

            if (!activeRequestRef.current && nextRequests.length > 0) {
                const firstVisible = nextRequests.find((request) => filterRef.current === 'all' || request.status === filterRef.current)
                    || nextRequests[0];
                if (firstVisible) {
                    setActiveRequest(firstVisible);
                }
            }

            if (activeRequestRef.current) {
                const updatedActive = nextRequests.find((request) => request.id === activeRequestRef.current.id);
                if (updatedActive) {
                    setActiveRequest((prev) => {
                        if (!prev) return updatedActive;
                        const preservedMessages = Array.isArray(prev.messages) && prev.messages.length > 0 ? prev.messages : updatedActive.messages;
                        return {
                            ...updatedActive,
                            messages: preservedMessages,
                        };
                    });
                }
            }
        } catch (error) {
            if (!silent) {
                toast.error(error?.response?.data?.message || 'Failed to load support requests.');
            }
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const loadRequestDetail = async (requestId) => {
        if (!requestId) return;
        setDetailLoading(true);
        try {
            const { data } = await api.getAdminChatbotSupportRequestById(requestId);
            if (data?.request) {
                setActiveRequest(data.request);
                setRequests((prev) => prev.map((request) => (request.id === data.request.id ? data.request : request)));
            }
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to load chat details.');
        } finally {
            setDetailLoading(false);
        }
    };

    useEffect(() => {
        loadRequests();
        const interval = setInterval(() => loadRequests({ silent: true }), POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (activeRequest?.id) {
            loadRequestDetail(activeRequest.id);
        }
    }, [activeRequest?.id]);

    useEffect(() => {
        if (!messageListRef.current) return;
        messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }, [activeRequest?.messages, activeRequest?.status]);

    const refreshNow = async () => {
        setIsRefreshing(true);
        await loadRequests();
        if (activeRequest?.id) {
            await loadRequestDetail(activeRequest.id);
        }
        setIsRefreshing(false);
        toast.success('Requests updated');
    };

    const handleAccept = async (requestId) => {
        if (actionLoading || !requestId) return;
        setActionLoading(true);
        try {
            const { data: latestData } = await api.getAdminChatbotSupportRequestById(requestId);
            if (latestData?.request && latestData.request.status !== 'pending') {
                setActiveRequest(latestData.request);
                await loadRequests({ silent: true });
                toast.error(latestData.request.status === 'accepted' ? 'Request already claimed by another admin.' : 'Request is no longer available.');
                return;
            }

            const { data } = await api.acceptAdminChatbotSupportRequest(requestId);
            toast.success('Support request accepted. You can now chat with the client.');
            setAcceptPopup({
                clientName: data?.request?.clientName || 'the client',
                clientMobile: data?.request?.clientMobile || '',
            });
            if (data?.request) setActiveRequest(data.request);
            await loadRequests({ silent: true });
        } catch (error) {
            const message = error?.response?.data?.message || 'Failed to accept request.';
            toast.error(message);
            if (error?.response?.status === 409) {
                await loadRequests({ silent: true });
                if (requestId) await loadRequestDetail(requestId);
            }
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async (requestId) => {
        try {
            await api.rejectAdminChatbotSupportRequest(requestId);
            toast.success('Request removed from your queue.');
            await loadRequests({ silent: true });
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to reject request.');
        }
    };

    const handleClose = async (requestId) => {
        try {
            const { data } = await api.closeAdminChatbotSupportRequest(requestId);
            toast.success('Chat closed successfully.');
            if (data?.request) setActiveRequest(data.request);
            await loadRequests({ silent: true });
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to close chat.');
        }
    };

    const handleDelete = async (requestId) => {
        try {
            await api.deleteAdminChatbotSupportRequest(requestId);
            toast.success('Chat record deleted.');
            setActiveRequest((prev) => (prev?.id === requestId ? null : prev));
            await loadRequests({ silent: true });
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to delete chat.');
        }
    };

    const submitReply = async () => {
        const trimmed = reply.trim();
        if (!trimmed || !activeRequest?.id || activeRequest.status !== 'accepted') return;

        try {
            setSending(true);
            const { data } = await api.sendAdminChatbotSupportMessage(activeRequest.id, trimmed);
            setReply('');
            if (data?.request) setActiveRequest(data.request);
            await loadRequests({ silent: true });
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to send message.');
        } finally {
            setSending(false);
        }
    };

    const handleSendReply = async (event) => {
        event.preventDefault();
        await submitReply();
    };

    const handleReplyKeyDown = async (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            await submitReply();
        }
    };

    const activeStatus = activeRequest ? statusConfig[activeRequest.status] || statusConfig.pending : null;
    const StatusIcon = activeStatus?.icon || Clock3;

    const getTimeInfo = (request) => {
        if (request.status === 'pending') {
            return { text: `Expires in ${formatDuration(request.waitingSecondsRemaining)}`, icon: TimerReset, className: 'text-amber-600' };
        }
        if (request.status === 'accepted') {
            return { text: `Active for ${formatDuration(request.connectionSecondsElapsed)}`, icon: History, className: 'text-emerald-600' };
        }
        return null;
    };

    const timeInfo = activeRequest ? getTimeInfo(activeRequest) : null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/40 via-white to-amber-50/30">
            <div className="max-w-[1600px] mx-auto p-6 space-y-6">
                {/* Header Section */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-2.5 shadow-lg">
                                <MessageSquare className="text-white" size={22} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Support Requests</h1>
                                <p className="text-sm text-gray-500 mt-0.5">Manage human handoff requests from chatbot clients</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={refreshNow}
                            disabled={isRefreshing}
                            className="px-4 py-2 rounded-xl bg-white text-gray-700 border border-orange-200 hover:bg-orange-50 transition-all duration-200 inline-flex items-center gap-2 shadow-sm"
                        >
                            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>
                </div>
                <AnimatePresence>
                    {acceptPopup && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm"
                        >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-start gap-3">
                                    <div className="rounded-full bg-sky-100 p-2">
                                        <CheckCircle2 className="text-sky-600" size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-sky-900">Support request accepted</p>
                                        <p className="text-sm text-sky-700">
                                            Connected with {acceptPopup.clientName}{acceptPopup.clientMobile ? ` (${acceptPopup.clientMobile})` : ''}.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setAcceptPopup(null)}
                                    className="text-sky-700 underline text-sm"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl border border-orange-100 p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Total Requests</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{requests.length}</p>
                            </div>
                            <div className="bg-orange-100 rounded-full p-2">
                                <MessageSquare className="text-orange-600" size={20} />
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl border border-amber-100 p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-amber-600 font-medium">Pending</p>
                                <p className="text-2xl font-bold text-amber-700 mt-1">{pendingCount}</p>
                            </div>
                            <div className="bg-amber-100 rounded-full p-2">
                                <Clock3 className="text-amber-600" size={20} />
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-emerald-600 font-medium">Active Chats</p>
                                <p className="text-2xl font-bold text-emerald-700 mt-1">{activeCount}</p>
                            </div>
                            <div className="bg-emerald-100 rounded-full p-2">
                                <MessageCircle className="text-emerald-600" size={20} />
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Resolved</p>
                                <p className="text-2xl font-bold text-slate-700 mt-1">{closedCount}</p>
                            </div>
                            <div className="bg-slate-100 rounded-full p-2">
                                <CheckCircle2 className="text-slate-500" size={20} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-6">
                    {/* Requests List Panel */}
                    <div className="bg-white rounded-2xl border border-orange-100 shadow-lg overflow-hidden">
                        <div className="px-4 py-4 border-b border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Users size="18" className="text-orange-500" />
                                    <span className="font-semibold text-gray-800">Request Queue</span>
                                </div>
                                <span className="text-xs font-medium text-orange-700 bg-white px-2.5 py-1 rounded-full border border-orange-200">{filteredRequests.length}</span>
                            </div>
                            
                            {/* Search Bar */}
                            <div className="relative">
                                <Search size="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name, phone, or message..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-orange-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 bg-white"
                                />
                            </div>
                            
                            {/* Filter Tabs */}
                            <div className="flex gap-1 mt-3">
                                {['pending', 'accepted', 'all'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setFilter(tab)}
                                        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                            filter === tab
                                                ? tab === 'pending' ? 'bg-amber-500 text-white shadow-sm'
                                                  : tab === 'accepted' ? 'bg-emerald-500 text-white shadow-sm'
                                                  : 'bg-slate-700 text-white shadow-sm'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                        {tab !== 'all' && (
                                            <span className="ml-1 opacity-80">
                                                ({tab === 'pending' ? pendingCount : activeCount})
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div className="max-h-[620px] overflow-y-auto custom-scrollbar divide-y divide-gray-100">
                            {loading ? (
                                <div className="p-12 text-center">
                                    <Loader2 size="32" className="mx-auto mb-3 text-orange-300 animate-spin" />
                                    <p className="text-gray-500 text-sm">Loading requests...</p>
                                </div>
                            ) : filteredRequests.length === 0 ? (
                                <div className="p-12 text-center">
                                    <Inbox size="48" className="mx-auto mb-4 text-gray-300" />
                                    <p className="font-medium text-gray-600">No requests found</p>
                                    <p className="text-sm text-gray-400 mt-1">
                                        {searchTerm ? 'Try a different search term' : 'All caught up!'}
                                    </p>
                                </div>
                            ) : filteredRequests.map((request) => {
                                const config = statusConfig[request.status] || statusConfig.pending;
                                const ActiveIcon = config.icon;
                                const selected = activeRequest?.id === request.id;
                                return (
                                    <button
                                        key={request.id}
                                        onClick={() => setActiveRequest(request)}
                                        className={`w-full text-left p-4 transition-all duration-200 ${
                                            selected 
                                                ? 'bg-gradient-to-r from-orange-50 to-amber-50 border-l-4 border-orange-500' 
                                                : 'hover:bg-gray-50 border-l-4 border-transparent'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                                                        {request.clientName?.charAt(0) || 'C'}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-gray-900 truncate">{request.clientName || 'Unknown Client'}</p>
                                                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                            <Phone size="10" /> {request.clientMobile || 'No phone'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-gray-400 flex items-center gap-1 mt-2">
                                                    <Calendar size="10" />
                                                    {formatClock(request.requestedAt)}
                                                </p>
                                                <p className="text-xs text-gray-600 mt-2 line-clamp-2 bg-gray-50 p-2 rounded-lg">
                                                    {request.initialMessage || 'Human support requested'}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${config.gradient} text-white whitespace-nowrap`}>
                                                    <ActiveIcon size="9" /> {config.label}
                                                </span>
                                                <span className="text-[10px] text-gray-400">{request.messageCount || 0} msgs</span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Chat Panel */}
                    <div className="bg-white rounded-2xl border border-orange-100 shadow-lg overflow-hidden flex flex-col min-h-[680px] max-h-[calc(100vh-240px)]">
                        {activeRequest ? (
                            <>
                                {/* Chat Header */}
                                <div className="px-6 py-4 border-b border-orange-100 bg-gradient-to-r from-orange-50 via-white to-amber-50">
                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                                                {activeRequest.clientName?.charAt(0) || 'C'}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-xl font-bold text-gray-900">{activeRequest.clientName}</h3>
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-gradient-to-r ${activeStatus?.gradient} text-white shadow-sm`}>
                                                        <StatusIcon size="10" /> {activeStatus?.label}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500">
                                                    <span className="inline-flex items-center gap-1"><Phone size="12" /> {activeRequest.clientMobile}</span>
                                                    <span className="inline-flex items-center gap-1"><Calendar size="12" /> {formatClock(activeRequest.requestedAt)}</span>
                                                    {timeInfo && (
                                                        <span className={`inline-flex items-center gap-1 ${timeInfo.className}`}>
                                                            <timeInfo.icon size="12" /> {timeInfo.text}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {activeRequest.status === 'pending' && (
                                                <>
                                                    <button
                                                        onClick={() => handleAccept(activeRequest.id)}
                                                        disabled={actionLoading}
                                                        className={`px-5 py-2.5 rounded-xl text-white text-sm font-semibold inline-flex items-center gap-2 transition-all duration-200 ${
                                                            actionLoading ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 shadow-md hover:shadow-lg'
                                                        }`}
                                                    >
                                                        {actionLoading ? <Loader2 size="14" className="animate-spin" /> : <Check size="14" />}
                                                        Accept Request
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(activeRequest.id)}
                                                        className="px-5 py-2.5 rounded-xl bg-white border border-gray-300 text-gray-700 text-sm font-semibold inline-flex items-center gap-2 hover:bg-gray-50 transition-all duration-200"
                                                    >
                                                        <X size="14" /> Reject
                                                    </button>
                                                </>
                                            )}
                                            {activeRequest.status === 'accepted' && (
                                                <button
                                                    onClick={() => handleClose(activeRequest.id)}
                                                    className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold inline-flex items-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg"
                                                >
                                                    <MinusCircle size="14" /> Close Chat
                                                </button>
                                            )}
                                            {['closed', 'expired'].includes(activeRequest.status) && (
                                                <button
                                                    onClick={() => handleDelete(activeRequest.id)}
                                                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold inline-flex items-center gap-2 transition-all duration-200"
                                                >
                                                    <Trash2 size="14" /> Delete Record
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {activeRequest.status === 'accepted' && activeRequest.acceptedByAdmin && (
                                        <div className="mt-3 pt-3 border-t border-orange-100 flex items-center gap-2">
                                            <BadgeCheck size="14" className="text-emerald-500" />
                                            <p className="text-xs text-gray-500">
                                                Assigned to <span className="font-medium text-gray-700">{activeRequest.acceptedByAdmin.adminName || 'Admin'}</span>
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Messages Area */}
                                <div ref={messageListRef} className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 bg-gradient-to-b from-orange-50/20 via-white to-white custom-scrollbar">
                                    <AnimatePresence initial={false}>
                                        {detailLoading && (!activeRequest.messages || activeRequest.messages.length === 0) ? (
                                            <div className="flex flex-col items-center justify-center py-12">
                                                <Loader2 size="36" className="text-orange-400 animate-spin mb-3" />
                                                <p className="text-sm text-gray-500">Loading conversation...</p>
                                            </div>
                                        ) : (activeRequest.messages || []).length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-12">
                                                <MessageCircle size="48" className="text-gray-300 mb-3" />
                                                <p className="text-gray-500 font-medium">No messages yet</p>
                                                <p className="text-xs text-gray-400 mt-1">Start the conversation by accepting the request</p>
                                            </div>
                                        ) : (
                                            (activeRequest.messages || []).map((message, index) => {
                                                const isAdmin = message.senderType === 'admin';
                                                const isClient = message.senderType === 'client';
                                                const isSystem = message.senderType === 'system';
                                                
                                                if (isSystem) {
                                                    return (
                                                        <div key={`${message.createdAt || index}-${index}`} className="flex justify-center">
                                                            <div className="bg-slate-100 text-slate-600 text-xs px-3 py-1.5 rounded-full">
                                                                {message.message}
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                
                                                return (
                                                    <motion.div
                                                        key={`${message.createdAt || index}-${index}`}
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}
                                                    >
                                                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
                                                            isClient 
                                                                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-br-sm' 
                                                                : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                                                        }`}>
                                                            <div className={`flex items-center gap-1.5 mb-1 text-[9px] font-medium uppercase tracking-wide ${
                                                                isClient ? 'text-orange-100' : 'text-gray-400'
                                                            }`}>
                                                                {isClient ? <User size="10" /> : <ShieldAlert size="10" />}
                                                                <span>{message.senderName || (isClient ? 'Client' : 'Admin')}</span>
                                                            </div>
                                                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.message}</p>
                                                            <p className={`mt-1.5 text-[9px] ${isClient ? 'text-orange-100/70' : 'text-gray-400'}`}>
                                                                {formatClock(message.createdAt)}
                                                            </p>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Reply Input */}
                                <form onSubmit={handleSendReply} className="p-4 border-t border-orange-100 bg-white">
                                    <div className="flex items-end gap-3">
                                        <div className="flex-1">
                                            <textarea
                                                value={reply}
                                                onChange={(e) => setReply(e.target.value)}
                                                onKeyDown={handleReplyKeyDown}
                                                placeholder={activeRequest.status === 'accepted' ? 'Type your response here...' : 'Accept the request to start chatting'}
                                                disabled={activeRequest.status !== 'accepted' || sending}
                                                rows={2}
                                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 resize-none disabled:bg-gray-50 disabled:text-gray-400 transition-all duration-200"
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={activeRequest.status !== 'accepted' || sending || !reply.trim()}
                                            className="h-11 px-5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md transition-all duration-200"
                                        >
                                            {sending ? <Loader2 size="16" className="animate-spin" /> : <Send size="16" />}
                                            Send
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-2 text-center">
                                        Responses will be sent directly to the client via the chatbot interface
                                    </p>
                                </form>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                                <div className="bg-orange-100 rounded-full p-4 mb-4">
                                    <MessageCircle size="40" className="text-orange-500" />
                                </div>
                                <p className="font-semibold text-gray-800 text-lg">No Request Selected</p>
                                <p className="text-sm text-gray-500 mt-1 max-w-sm">
                                    Select a support request from the queue to view the conversation and respond to clients.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Custom Scrollbar Styles */}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #fef3c7;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #f97316;
                    border-radius: 10px;
                }
                .line-clamp-2 {
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
            `}</style>
        </div>
    );
}