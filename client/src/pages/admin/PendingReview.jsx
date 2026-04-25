// src/components/admin/PendingReview.jsx
// PREMIUM VERSION - Modern worker review board with enhanced UI

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Check, X, ShieldX, Trash2, Eye, Clock, UserCheck, 
    UserX, ShieldCheck, Search, RefreshCw, Filter, 
    ChevronDown, ChevronUp, MapPin, Phone, Award, 
    Star, TrendingUp, Briefcase, Calendar, AlertCircle
} from 'lucide-react';
import { getImageUrl } from '../../constants/config';

const InfoPill = ({ label, value, mono = false, icon: Icon }) => (
    <div className="rounded-xl border border-gray-100 bg-gradient-to-r from-gray-50 to-white px-3 py-2.5 shadow-sm">
        <div className="flex items-center gap-1.5 mb-1">
            {Icon && <Icon size="10" className="text-gray-400" />}
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-500">{label}</p>
        </div>
        <p className={`text-sm font-bold text-gray-900 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
);

const StatusBadge = ({ status }) => {
    const config = {
        pending: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200', label: 'Pending' },
        approved: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200', label: 'Approved' },
        rejected: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200', label: 'Rejected' },
        blocked: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200', label: 'Blocked' },
    };
    const cfg = config[status] || config.pending;
    return (
        <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
            {cfg.label}
        </span>
    );
};

const PendingReview = ({
    currentTab,
    onTabChange,
    searchValue,
    onSearchChange,
    cityValue,
    onCityChange,
    cityOptions,
    rows,
    stats,
    onRefresh,
    currentAdminId,
    onViewDetails,
    onClaimWorker,
    onStatusUpdate,
    onDelete,
    onVerifyOpen,
    lockedTab,
}) => {
    const [showFilters, setShowFilters] = useState(false);
    const [hoveredCard, setHoveredCard] = useState(null);
    const activeTab = lockedTab || currentTab;
    
    const tabs = [
        { key: 'pending', label: 'Pending', count: stats.pending, icon: Clock, tone: 'amber', gradient: 'from-amber-500 to-orange-500' },
        { key: 'approved', label: 'Approved', count: stats.approved, icon: UserCheck, tone: 'green', gradient: 'from-emerald-500 to-green-500' },
        { key: 'rejected', label: 'Rejected', count: stats.rejected, icon: UserX, tone: 'red', gradient: 'from-red-500 to-rose-500' },
        { key: 'blocked', label: 'Blocked', count: stats.blocked, icon: ShieldX, tone: 'slate', gradient: 'from-gray-500 to-gray-600' },
    ];

    const tabTone = {
        amber: 'from-amber-400 to-orange-500',
        green: 'from-emerald-500 to-green-600',
        red: 'from-rose-500 to-red-600',
        slate: 'from-slate-600 to-slate-700',
    };

    const chipTone = {
        pending: 'bg-amber-100 text-amber-800 border-amber-200',
        approved: 'bg-green-100 text-green-800 border-green-200',
        rejected: 'bg-red-100 text-red-800 border-red-200',
        blocked: 'bg-slate-100 text-slate-800 border-slate-200',
    };

    const hasActiveFilters = cityValue !== 'all' || searchValue;

    return (
        <div className="bg-white rounded-2xl border border-orange-100 shadow-md overflow-hidden">
            {/* Header Section */}
            <div className="p-6 border-b border-orange-100 bg-gradient-to-r from-orange-50 via-white to-white">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center">
                                <UserCheck size="14" className="text-white" />
                            </div>
                            <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-500">Workers</p>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800">Worker Review Board</h3>
                        <p className="text-sm text-gray-500 mt-1">Review and manage worker applications by status</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            type="button"
                            onClick={onRefresh}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-orange-200 bg-white text-orange-600 font-semibold text-sm hover:bg-orange-50 transition-all"
                        >
                            <RefreshCw size="14" /> Refresh
                        </motion.button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.key;
                        return (
                            <motion.button
                                key={tab.key}
                                whileTap={{ scale: 0.98 }}
                                type="button"
                                onClick={() => !lockedTab && onTabChange(tab.key)}
                                className={`rounded-xl border p-3 text-left transition-all ${
                                    isActive 
                                        ? `bg-gradient-to-r ${tabTone[tab.tone]} text-white border-transparent shadow-md` 
                                        : 'bg-white border-gray-200 text-gray-700 hover:border-orange-200 hover:bg-orange-50'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <Icon size="16" className={isActive ? 'text-white' : 'text-gray-500'} />
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                        isActive ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-600'
                                    }`}>
                                        {tab.count}
                                    </span>
                                </div>
                                <p className="mt-2 text-sm font-bold">{tab.label}</p>
                            </motion.button>
                        );
                    })}
                </div>

                {/* Search and Filters */}
                <div className="mt-5 space-y-3">
                    <div className="flex flex-col lg:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search size="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchValue}
                                onChange={(event) => onSearchChange(event.target.value)}
                                placeholder={`Search ${activeTab} workers by name or mobile...`}
                                className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                            />
                        </div>
                        
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                showFilters || hasActiveFilters ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-orange-50'
                            }`}
                        >
                            <Filter size="14" /> Filters
                            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </button>
                        
                        {searchValue && (
                            <button
                                type="button"
                                onClick={() => onSearchChange('')}
                                className="px-4 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors"
                            >
                                Clear Search
                            </button>
                        )}
                    </div>

                    <AnimatePresence>
                        {showFilters && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="pt-3 border-t border-gray-100"
                            >
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                                            Filter by City
                                        </label>
                                        <select
                                            value={cityValue}
                                            onChange={(event) => onCityChange(event.target.value)}
                                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                                        >
                                            <option value="all">All Cities</option>
                                            {cityOptions.map((city) => (
                                                <option key={city} value={city.toLowerCase()}>{city}</option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    {hasActiveFilters && (
                                        <div className="flex items-end">
                                            <button
                                                onClick={() => {
                                                    onCityChange('all');
                                                    onSearchChange('');
                                                }}
                                                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors"
                                            >
                                                Clear Filters
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {hasActiveFilters && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span className="text-[9px] text-gray-500 font-semibold">Active filters:</span>
                            {searchValue && (
                                <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                    Search: {searchValue}
                                    <button onClick={() => onSearchChange('')} className="hover:text-orange-900">✕</button>
                                </span>
                            )}
                            {cityValue !== 'all' && (
                                <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                    City: {cityValue}
                                    <button onClick={() => onCityChange('all')} className="hover:text-orange-900">✕</button>
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Worker Cards Grid */}
            <div className="p-6">
                {rows.length ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {rows.map((user, idx) => {
                            const lockOwnerId = user?.reviewLock?.lockedBy?._id || user?.reviewLock?.lockedBy || null;
                            const claimedByMe = lockOwnerId && String(lockOwnerId) === String(currentAdminId);
                            const claimedByOther = lockOwnerId && !claimedByMe;
                            const city = user?.address?.city || user?.city || 'N/A';
                            const isHovered = hoveredCard === user._id;
                            const gradientHeader = user.verificationStatus === 'approved' ? 'from-emerald-400 to-green-500' :
                                                   user.verificationStatus === 'rejected' ? 'from-rose-400 to-red-500' :
                                                   user.verificationStatus === 'blocked' ? 'from-slate-500 to-slate-700' :
                                                   'from-amber-400 to-orange-500';

                            return (
                                <motion.div
                                    key={user._id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    whileHover={{ y: -4 }}
                                    onMouseEnter={() => setHoveredCard(user._id)}
                                    onMouseLeave={() => setHoveredCard(null)}
                                    className="group bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
                                >
                                    <div className={`h-20 bg-gradient-to-r ${gradientHeader}`} />

                                    <div className="px-5 pb-5 -mt-10">
                                        <div className="flex items-start gap-4">
                                            <img
                                                src={getImageUrl(user.photo)}
                                                alt={user.name}
                                                className="w-20 h-20 rounded-xl object-cover border-4 border-white shadow-lg bg-white"
                                                onError={(event) => { event.currentTarget.src = '/default-avatar.png'; }}
                                            />
                                            <div className="flex-1 min-w-0 pt-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-orange-500">Worker</p>
                                                        <h3 className="text-base font-bold text-gray-800 break-words">{user.name}</h3>
                                                    </div>
                                                    <StatusBadge status={user.verificationStatus} />
                                                </div>
                                                <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                                                    <MapPin size="12" className="text-orange-400" />
                                                    <span className="truncate">{city}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 mt-4">
                                            <InfoPill label="Mobile" value={user.mobile || 'N/A'} icon={Phone} />
                                            <InfoPill label="Karigar ID" value={user.karigarId || 'N/A'} mono icon={Award} />
                                            <InfoPill label="Points" value={user.points || 0} icon={Star} />
                                            <InfoPill label="Experience" value={`${user.experience || 0} yrs`} icon={TrendingUp} />
                                        </div>

                                        {user.role === 'worker' && user.verificationStatus === 'pending' && user?.reviewLock?.lockedBy && (
                                            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
                                                <AlertCircle size="12" />
                                                Locked by {user.reviewLock.lockedBy.name || 'Admin'}
                                            </div>
                                        )}

                                        <div className="mt-4 space-y-2">
                                            <button
                                                type="button"
                                                onClick={() => onViewDetails(user)}
                                                className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2.5 text-sm font-bold hover:shadow-md transition-all"
                                            >
                                                <Eye size="14" /> View Details
                                            </button>

                                            {user.role === 'worker' && user.verificationStatus === 'pending' && (
                                                !lockOwnerId ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => onClaimWorker(user._id)}
                                                        className="w-full flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 py-2.5 text-sm font-bold hover:bg-blue-100 transition-all"
                                                    >
                                                        <ShieldCheck size="14" /> Claim Review
                                                    </button>
                                                ) : claimedByMe ? (
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => onVerifyOpen(user)}
                                                            className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 text-white py-2.5 text-sm font-bold hover:shadow-md transition-all"
                                                        >
                                                            <Check size="14" /> Approve
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const reason = window.prompt('Enter rejection reason:') || '';
                                                                onStatusUpdate(user._id, 'rejected', 0, reason);
                                                            }}
                                                            className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-red-500 to-rose-600 text-white py-2.5 text-sm font-bold hover:shadow-md transition-all"
                                                        >
                                                            <X size="14" /> Reject
                                                        </button>
                                                    </div>
                                                ) : claimedByOther ? (
                                                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-center text-sm font-bold text-slate-500">
                                                        Under Review by Another Admin
                                                    </div>
                                                ) : null
                                            )}

                                            {user.role === 'worker' && user.verificationStatus === 'approved' && (
                                                <button
                                                    type="button"
                                                    onClick={() => onStatusUpdate(user._id, 'blocked')}
                                                    className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 py-2.5 text-sm font-bold hover:bg-slate-100 transition-all"
                                                >
                                                    <ShieldX size="14" /> Block Account
                                                </button>
                                            )}

                                            {user.role === 'worker' && user.verificationStatus === 'blocked' && (
                                                <button
                                                    type="button"
                                                    onClick={() => onStatusUpdate(user._id, 'unblocked')}
                                                    className="w-full flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 py-2.5 text-sm font-bold hover:bg-emerald-100 transition-all"
                                                >
                                                    <ShieldCheck size="14" /> Unblock Account
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => onDelete(user._id, user.name, user.role)}
                                                className="w-full flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 text-red-600 py-2.5 text-sm font-bold hover:bg-red-100 transition-all"
                                            >
                                                <Trash2 size="14" /> Delete
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/30 p-12 text-center"
                    >
                        <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <UserCheck size="36" className="text-gray-400" />
                        </div>
                        <p className="text-lg font-bold text-gray-700">No {activeTab} workers found</p>
                        <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filters</p>
                        {hasActiveFilters && (
                            <button
                                onClick={() => {
                                    onSearchChange('');
                                    onCityChange('all');
                                }}
                                className="mt-4 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl text-sm font-semibold hover:shadow-md transition-all"
                            >
                                Clear Filters
                            </button>
                        )}
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default PendingReview;