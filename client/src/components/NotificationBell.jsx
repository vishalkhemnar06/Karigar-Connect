// client/src/components/NotificationBell.jsx
// UPDATES:
//  - Delete individual notification
//  - Clear all notifications
//  - No toast popups — all results shown inline
//  - Unread dot on bell, count badge

import { useState, useEffect, useRef } from 'react';
import {
    getClientNotifications,
    markClientNotificationRead,
    markAllClientNotificationsRead,
    deleteClientNotification,
    clearAllClientNotifications,
    getWorkerNotifications,
    markWorkerNotificationRead,
    markAllWorkerNotificationsRead,
    deleteWorkerNotification,
    clearAllWorkerNotifications,
} from '../api/index';

const TYPE_ICONS = {
    job_update:  '💼',
    application: '📋',
    hired:       '✅',
    cancelled:   '❌',
    rating:      '⭐',
    payment:     '💰',
    start_reminder: '🔔',
    reminder:       '🔔',
    message:     '💬',
    default:     '🔔',
};

export default function NotificationBell({ role = 'client' }) {
    const [open,          setOpen]          = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount,   setUnreadCount]   = useState(0);
    const [loading,       setLoading]       = useState(false);
    const [statusMsg,     setStatusMsg]     = useState(''); // inline status instead of toast
    const dropdownRef = useRef(null);

    // API functions based on role
    const api = {
        get:      role === 'client' ? getClientNotifications         : getWorkerNotifications,
        markOne:  role === 'client' ? markClientNotificationRead     : markWorkerNotificationRead,
        markAll:  role === 'client' ? markAllClientNotificationsRead : markAllWorkerNotificationsRead,
        delOne:   role === 'client' ? deleteClientNotification       : deleteWorkerNotification,
        clearAll: role === 'client' ? clearAllClientNotifications    : clearAllWorkerNotifications,
    };

    const showStatus = (msg) => {
        setStatusMsg(msg);
        setTimeout(() => setStatusMsg(''), 2500);
    };

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const { data } = await api.get();
            setNotifications(data.notifications || []);
            setUnreadCount(data.unreadCount   || 0);
        } catch { /* silent */ }
        finally { setLoading(false); }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60_000);
        return () => clearInterval(interval);
    }, [role]);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleMarkRead = async (id) => {
        try {
            await api.markOne(id);
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch { /* silent */ }
    };

    const handleMarkAllRead = async () => {
        try {
            await api.markAll();
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
            showStatus('All notifications marked as read.');
        } catch {
            showStatus('Failed to mark all as read.');
        }
    };

    const handleDeleteOne = async (e, id) => {
        e.stopPropagation();
        try {
            await api.delOne(id);
            setNotifications(prev => prev.filter(n => n._id !== id));
            setUnreadCount(prev => {
                const wasUnread = notifications.find(n => n._id === id && !n.read);
                return wasUnread ? Math.max(0, prev - 1) : prev;
            });
        } catch {
            showStatus('Failed to delete notification.');
        }
    };

    const handleClearAll = async () => {
        try {
            await api.clearAll();
            setNotifications([]);
            setUnreadCount(0);
            showStatus('All notifications cleared.');
        } catch {
            showStatus('Failed to clear notifications.');
        }
    };

    const timeAgo = (date) => {
        const diff = Date.now() - new Date(date).getTime();
        const mins = Math.floor(diff / 60_000);
        if (mins < 1)  return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24)  return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell button */}
            <button
                onClick={() => setOpen(o => !o)}
                className="relative p-2 rounded-full hover:bg-orange-50 transition-colors focus:outline-none"
                aria-label="Notifications"
            >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div
                    className="absolute right-0 mt-2 w-96 max-h-[540px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 flex flex-col overflow-hidden"
                    style={{ minWidth: '320px' }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                            Notifications
                            {unreadCount > 0 && (
                                <span className="bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded-full font-bold">{unreadCount} new</span>
                            )}
                        </h3>
                        <div className="flex items-center gap-3">
                            {unreadCount > 0 && (
                                <button onClick={handleMarkAllRead} className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
                                    Mark all read
                                </button>
                            )}
                            {notifications.length > 0 && (
                                <button onClick={handleClearAll} className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
                                    Clear all
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Inline status message — no popup */}
                    {statusMsg && (
                        <div className="px-4 py-2 bg-green-50 border-b border-green-100 text-xs text-green-700 font-medium flex-shrink-0">
                            ✓ {statusMsg}
                        </div>
                    )}

                    {/* List */}
                    <div className="overflow-y-auto flex-1">
                        {loading && (
                            <div className="flex items-center justify-center py-10">
                                <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}

                        {!loading && notifications.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-14 text-gray-400">
                                <span className="text-4xl mb-3">🔔</span>
                                <span className="text-sm font-medium">No notifications</span>
                                <span className="text-xs text-gray-300 mt-1">You're all caught up!</span>
                            </div>
                        )}

                        {!loading && notifications.map(n => (
                            <div
                                key={n._id}
                                onClick={() => !n.read && handleMarkRead(n._id)}
                                className={`group flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 cursor-pointer transition-colors ${
                                    n.read ? 'bg-white hover:bg-gray-50' : 'bg-orange-50/50 hover:bg-orange-100/50'
                                }`}
                            >
                                {/* Icon */}
                                <div className="text-xl mt-0.5 flex-shrink-0">
                                    {TYPE_ICONS[n.type] || TYPE_ICONS.default}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    {n.title && (
                                        <p className={`text-sm font-semibold truncate ${n.read ? 'text-gray-600' : 'text-gray-900'}`}>
                                            {n.title}
                                        </p>
                                    )}
                                    <p className={`text-xs leading-relaxed mt-0.5 ${n.read ? 'text-gray-400' : 'text-gray-700'} line-clamp-2`}>
                                        {n.message}
                                    </p>
                                    <p className="text-[10px] text-gray-300 mt-1">{timeAgo(n.createdAt)}</p>
                                </div>

                                {/* Right side: unread dot + delete */}
                                <div className="flex flex-col items-center gap-2 flex-shrink-0 ml-1">
                                    {!n.read && (
                                        <div className="w-2 h-2 bg-orange-500 rounded-full mt-1" />
                                    )}
                                    <button
                                        onClick={(e) => handleDeleteOne(e, n._id)}
                                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all text-base leading-none mt-0.5"
                                        title="Delete notification"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
