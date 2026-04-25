// src/components/admin/Payment.jsx
// PREMIUM VERSION - Enhanced payment tracking with modern UI

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    CreditCard, Search, Filter, ChevronDown, ChevronUp, 
    Phone, AlertCircle, CheckCircle, XCircle, Clock,
    User, Users, MapPin, Briefcase, Calendar, DollarSign,
    TrendingUp, Activity, BarChart3, PieChart
} from 'lucide-react';

const Payment = ({
    directHireTab,
    setDirectHireTab,
    directHireCityFilter,
    setDirectHireCityFilter,
    directHireSkillFilter,
    setDirectHireSkillFilter,
    directHireSearch,
    setDirectHireSearch,
    directHireCityOptions,
    directHireSkillOptions,
    directHireSummary,
    directHireLoading,
    directHirePayments,
    directHireActionLoading,
    fetchDirectHirePayments,
    handleWarnClient,
    handleBlockClient,
    handleUnblockClient,
    formatJobDateTime,
    formatMoney,
}) => {
    const [showFilters, setShowFilters] = useState(false);
    const hasActiveFilters = directHireCityFilter !== 'all' || directHireSkillFilter !== 'all' || directHireSearch;

    return (
        <div className="space-y-5">
            {/* Header Card */}
            <div className="bg-white rounded-2xl border border-orange-100 shadow-md p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center">
                                <CreditCard size="14" className="text-white" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-800">Direct Hire Payments</h2>
                        </div>
                        <p className="text-sm text-gray-500">Track and manage direct hire payment transactions</p>
                    </div>
                    
                    <div className="flex gap-2">
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setDirectHireTab('pending')}
                            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                                directHireTab === 'pending' 
                                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md' 
                                    : 'bg-gray-100 text-gray-700 hover:bg-orange-50'
                            }`}
                        >
                            Pending Payments
                        </motion.button>
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setDirectHireTab('completed')}
                            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                                directHireTab === 'completed' 
                                    ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md' 
                                    : 'bg-gray-100 text-gray-700 hover:bg-orange-50'
                            }`}
                        >
                            Completed Payments
                        </motion.button>
                    </div>
                </div>

                {/* Filters */}
                <div className="mt-5 space-y-3">
                    <div className="flex flex-wrap gap-2">
                        <div className="flex-1 min-w-[200px] relative">
                            <Search size="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={directHireSearch}
                                onChange={(e) => setDirectHireSearch(e.target.value)}
                                placeholder="Search by client name or phone..."
                                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all"
                            />
                        </div>
                        
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                showFilters || hasActiveFilters ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-orange-50'
                            }`}
                        >
                            <Filter size="14" /> Filters
                            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </button>
                        
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={fetchDirectHirePayments}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
                        >
                            Refresh
                        </motion.button>
                    </div>

                    <AnimatePresence>
                        {showFilters && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="pt-3 border-t border-gray-100"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                                            Filter by City
                                        </label>
                                        <select
                                            value={directHireCityFilter}
                                            onChange={(e) => setDirectHireCityFilter(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none"
                                        >
                                            <option value="all">All Cities</option>
                                            {directHireCityOptions.map((city) => (
                                                <option key={city} value={city.toLowerCase()}>{city}</option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                                            Filter by Skill
                                        </label>
                                        <select
                                            value={directHireSkillFilter}
                                            onChange={(e) => setDirectHireSkillFilter(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none"
                                        >
                                            <option value="all">All Skills</option>
                                            {directHireSkillOptions.map((skill) => (
                                                <option key={skill} value={skill.toLowerCase()}>{skill}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {hasActiveFilters && (
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                            <span className="text-[9px] text-gray-500 font-semibold">Active filters:</span>
                            {directHireSearch && (
                                <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                    Search: {directHireSearch}
                                    <button onClick={() => setDirectHireSearch('')} className="hover:text-orange-900">✕</button>
                                </span>
                            )}
                            {directHireCityFilter !== 'all' && (
                                <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                    City: {directHireCityFilter}
                                    <button onClick={() => setDirectHireCityFilter('all')} className="hover:text-orange-900">✕</button>
                                </span>
                            )}
                            {directHireSkillFilter !== 'all' && (
                                <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                    Skill: {directHireSkillFilter}
                                    <button onClick={() => setDirectHireSkillFilter('all')} className="hover:text-orange-900">✕</button>
                                </span>
                            )}
                            <button
                                onClick={() => {
                                    setDirectHireCityFilter('all');
                                    setDirectHireSkillFilter('all');
                                    setDirectHireSearch('');
                                }}
                                className="text-[9px] text-orange-500 font-semibold hover:underline"
                            >
                                Clear all
                            </button>
                        </div>
                    )}
                </div>

                {/* Summary */}
                {directHireTab === 'completed' && (
                    <div className="mt-4 p-3 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border border-emerald-200">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-emerald-700">Total Paid Amount</span>
                            <span className="text-xl font-bold text-emerald-800">{formatMoney(directHireSummary.totalPaidAmount || 0)}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Payment Records */}
            {directHireLoading ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                    <div className="animate-spin w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-gray-500">Loading payment records...</p>
                </div>
            ) : directHirePayments.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl border border-gray-100 p-12 text-center"
                >
                    <CreditCard size="48" className="text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No payment records found</p>
                    <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                </motion.div>
            ) : (
                <div className="space-y-4">
                    {directHirePayments.map((row, idx) => {
                        const job = row?.job || {};
                        const clientLocked = Boolean(job?.postedBy?.paymentLock?.active);
                        const isOverdue = row?.isOverdue;
                        
                        return (
                            <motion.div
                                key={job._id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                whileHover={{ y: -2 }}
                                className="bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-xl transition-all overflow-hidden"
                            >
                                <div className={`h-1 ${directHireTab === 'completed' ? 'bg-gradient-to-r from-emerald-500 to-green-500' : isOverdue ? 'bg-gradient-to-r from-red-500 to-rose-500' : 'bg-gradient-to-r from-amber-500 to-orange-500'}`} />
                                
                                <div className="p-5">
                                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-800">{job.title || 'Untitled Job'}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <User size="12" className="text-gray-400" />
                                                <p className="text-sm text-gray-600">{job.postedBy?.name} • {job.postedBy?.mobile || 'N/A'}</p>
                                            </div>
                                        </div>
                                        {isOverdue ? (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                                                <AlertCircle size="12" /> Overdue • {row.overdueMinutes} min
                                            </span>
                                        ) : (
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                                                directHireTab === 'completed' 
                                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                                                    : 'bg-amber-100 text-amber-700 border-amber-200'
                                            }`}>
                                                {directHireTab === 'completed' ? <CheckCircle size="12" /> : <Clock size="12" />}
                                                {directHireTab === 'completed' ? 'Payment Done' : 'Pending'}
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-sm">
                                        <div className="flex items-center gap-2"><Calendar size="14" className="text-gray-400" /> {formatJobDateTime(job)}</div>
                                        <div className="flex items-center gap-2"><Clock size="14" className="text-gray-400" /> {job?.directHire?.durationValue || 1} {job?.directHire?.durationUnit || '/day'}</div>
                                        <div className="flex items-center gap-2"><MapPin size="14" className="text-gray-400" /> {job?.location?.city || row?.city || 'N/A'}</div>
                                        <div className="flex items-center gap-2"><Briefcase size="14" className="text-gray-400" /> {row?.skill || (job?.skills || []).join(', ') || 'N/A'}</div>
                                    </div>

                                    {/* Workers & Payments */}
                                    <div className="bg-gray-50 rounded-xl p-4 mb-4">
                                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-1">
                                            <Users size="12" /> Workers & Payments
                                        </p>
                                        <div className="space-y-2">
                                            {(row?.paymentRows || []).map((pay, idx) => (
                                                <div key={idx} className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-200 last:border-0">
                                                    <div className="font-semibold text-gray-800">{pay.name} • {pay.mobile || 'N/A'}</div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-gray-700">{formatMoney(pay.amount || 0)}</span>
                                                        <span className="text-xs text-gray-500">{pay.method || 'cash'}</span>
                                                        {pay.paid && <CheckCircle size="14" className="text-emerald-500" />}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    {directHireTab === 'pending' && (
                                        <div className="flex flex-wrap gap-2">
                                            <a
                                                href={job?.postedBy?.mobile ? `tel:${job.postedBy.mobile}` : undefined}
                                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-semibold hover:shadow-md transition-all"
                                            >
                                                <Phone size="14" /> Call Client
                                            </a>
                                            <button
                                                onClick={() => handleWarnClient(job._id)}
                                                disabled={directHireActionLoading[`warn-${job._id}`]}
                                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold hover:shadow-md transition-all disabled:opacity-50"
                                            >
                                                {directHireActionLoading[`warn-${job._id}`] ? 'Sending...' : 'Send Warning SMS'}
                                            </button>
                                            {!clientLocked ? (
                                                <button
                                                    onClick={() => handleBlockClient(job._id)}
                                                    disabled={directHireActionLoading[`block-${job._id}`]}
                                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-rose-600 text-white text-sm font-semibold hover:shadow-md transition-all disabled:opacity-50"
                                                >
                                                    {directHireActionLoading[`block-${job._id}`] ? 'Blocking...' : 'Block Services'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleUnblockClient(job._id)}
                                                    disabled={directHireActionLoading[`unblock-${job._id}`]}
                                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-semibold hover:shadow-md transition-all disabled:opacity-50"
                                                >
                                                    {directHireActionLoading[`unblock-${job._id}`] ? 'Unblocking...' : 'Unblock Services'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Payment;