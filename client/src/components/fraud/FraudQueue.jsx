// client/src/components/fraud/FraudQueue.jsx
// Sortable, filterable table of flagged profiles.

import { useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { selectAlert } from '../../store/slices/fraudSlice';
import { RiskBadge } from './RiskBadge';
import { Search, Filter, ChevronDown, ChevronUp, Eye, User, Calendar, Clock, Shield } from 'lucide-react';
const ROLE_BADGE = {
    worker: { bg: 'bg-blue-100', color: 'text-blue-700', border: 'border-blue-200', icon: '🔨' },
    client: { bg: 'bg-emerald-100', color: 'text-emerald-700', border: 'border-emerald-200', icon: '👤' },
};

export function FraudQueue() {
    const dispatch = useDispatch();
    const { alerts, loading } = useSelector(s => s.fraud);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [riskFilter, setRiskFilter] = useState('all');
    const [sortKey, setSortKey] = useState('fraud_probability');
    const [sortDir, setSortDir] = useState('desc');
    const [showFilters, setShowFilters] = useState(false);

    const filtered = useMemo(() => {
        let list = [...alerts];
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(a =>
                a.name?.toLowerCase().includes(q) ||
                a.user_id?.toLowerCase().includes(q) ||
                a.karigar_id?.toLowerCase().includes(q) ||
                a.mobile?.includes(q)
            );
        }
        if (roleFilter !== 'all') list = list.filter(a => a.user_role === roleFilter);
        if (riskFilter !== 'all') list = list.filter(a => a.risk_level === riskFilter);
        list.sort((a, b) => {
            let av = a[sortKey], bv = b[sortKey];
            if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
            if (av < bv) return sortDir === 'asc' ? -1 : 1;
            if (av > bv) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return list;
    }, [alerts, search, roleFilter, riskFilter, sortKey, sortDir]);

    const toggleSort = (k) => {
        if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(k); setSortDir('desc'); }
    };

    const SortArrow = ({ col }) => sortKey !== col
        ? <ChevronDown size="12" className="opacity-30" />
        : sortDir === 'asc' ? <ChevronUp size="12" /> : <ChevronDown size="12" />;

    const hasActiveFilters = search || roleFilter !== 'all' || riskFilter !== 'all';

    if (loading) return <Skeleton />;

    return (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-gray-100">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search size="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            placeholder="Search by name, ID, or phone..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                            showFilters || hasActiveFilters ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-orange-50'
                        }`}
                    >
                        <Filter size="14" /> Filter
                        {(roleFilter !== 'all' || riskFilter !== 'all') && (
                            <span className="ml-0.5 w-4 h-4 bg-white/20 rounded-full text-white text-[10px] flex items-center justify-center">
                                {(roleFilter !== 'all' ? 1 : 0) + (riskFilter !== 'all' ? 1 : 0)}
                            </span>
                        )}
                    </button>
                </div>

                <AnimatePresence>
                    {showFilters && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 pt-3 border-t border-gray-100"
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <select
                                    value={roleFilter}
                                    onChange={e => setRoleFilter(e.target.value)}
                                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none"
                                >
                                    <option value="all">All Roles</option>
                                    <option value="worker">Workers</option>
                                    <option value="client">Clients</option>
                                </select>
                                <select
                                    value={riskFilter}
                                    onChange={e => setRiskFilter(e.target.value)}
                                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none"
                                >
                                    <option value="all">All Risk Levels</option>
                                    <option value="HIGH">High Risk</option>
                                    <option value="MEDIUM">Medium Risk</option>
                                    <option value="LOW">Low Risk</option>
                                </select>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {hasActiveFilters && (
                    <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-gray-100">
                        <span className="text-[9px] text-gray-500 font-semibold">Active filters:</span>
                        {search && (
                            <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                Search: {search}
                                <button onClick={() => setSearch('')} className="hover:text-orange-900">✕</button>
                            </span>
                        )}
                        {roleFilter !== 'all' && (
                            <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                Role: {roleFilter}
                                <button onClick={() => setRoleFilter('all')} className="hover:text-orange-900">✕</button>
                            </span>
                        )}
                        {riskFilter !== 'all' && (
                            <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                Risk: {riskFilter}
                                <button onClick={() => setRiskFilter('all')} className="hover:text-orange-900">✕</button>
                            </span>
                        )}
                        <button onClick={() => { setSearch(''); setRoleFilter('all'); setRiskFilter('all'); }} className="text-[9px] text-orange-500 font-semibold hover:underline">
                            Clear all
                        </button>
                    </div>
                )}
            </div>

            {/* Results Count */}
            {filtered.length > 0 && (
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 flex justify-between">
                    <span>{filtered.length} of {alerts.length} profiles</span>
                    <span>Showing sorted by {sortKey}</span>
                </div>
            )}

            {/* Table */}
            {filtered.length === 0 ? (
                <div className="py-16 text-center">
                    <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Shield size="32" className="text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-semibold">
                        {search || roleFilter !== 'all' || riskFilter !== 'all'
                            ? 'No results match your filters'
                            : 'No fraud alerts in queue'}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                        {search || roleFilter !== 'all' || riskFilter !== 'all'
                            ? 'Try adjusting the search or filters.'
                            : 'Run a full scan or wait for the daily batch at 2:00 AM.'}
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th onClick={() => toggleSort('name')} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:text-orange-600">
                                    User <SortArrow col="name" />
                                </th>
                                <th onClick={() => toggleSort('user_role')} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:text-orange-600">
                                    Role <SortArrow col="user_role" />
                                </th>
                                <th onClick={() => toggleSort('risk_level')} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:text-orange-600">
                                    Risk <SortArrow col="risk_level" />
                                </th>
                                <th onClick={() => toggleSort('fraud_probability')} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:text-orange-600">
                                    Probability <SortArrow col="fraud_probability" />
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Top Reason</th>
                                <th onClick={() => toggleSort('alertedAt')} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:text-orange-600">
                                    Flagged <SortArrow col="alertedAt" />
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((alert, idx) => {
                                const prob = Math.round((alert.fraud_probability || 0) * 100);
                                const probColor = prob >= 80 ? 'text-red-600' : prob >= 60 ? 'text-orange-600' : 'text-yellow-600';
                                const rc = ROLE_BADGE[alert.user_role] || ROLE_BADGE.worker;
                                const flaggedAt = alert.alertedAt
                                    ? new Date(alert.alertedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                                    : '—';
                                const even = idx % 2 === 0;

                                return (
                                    <motion.tr
                                        key={alert.user_id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: idx * 0.02 }}
                                        onClick={() => dispatch(selectAlert(alert))}
                                        className={`cursor-pointer transition-all hover:bg-orange-50 ${even ? 'bg-white' : 'bg-gray-50/50'}`}
                                    >
                                        <td className="px-4 py-3 border-b border-gray-100">
                                            <div className="font-semibold text-gray-800 text-sm">{alert.name || '—'}</div>
                                            <div className="text-[10px] text-gray-500 mt-0.5">
                                                {alert.karigar_id || alert.user_id?.slice(-8)}
                                                {alert.mobile && ` · ${alert.mobile}`}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 border-b border-gray-100">
                                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${rc.bg} ${rc.color} border ${rc.border}`}>
                                                {rc.icon} {alert.user_role}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 border-b border-gray-100">
                                            <RiskBadge level={alert.risk_level} />
                                        </td>
                                        <td className="px-4 py-3 border-b border-gray-100">
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full ${
                                                        prob >= 80 ? 'bg-red-500' : prob >= 60 ? 'bg-orange-500' : 'bg-yellow-500'
                                                    }`} style={{ width: `${prob}%` }} />
                                                </div>
                                                <span className={`text-xs font-bold ${probColor}`}>{prob}%</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 border-b border-gray-100 max-w-[200px]">
                                            <span className="text-xs text-gray-600 line-clamp-1">
                                                {alert.top_reasons?.[0]?.label || '—'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 border-b border-gray-100 text-xs text-gray-500 whitespace-nowrap">
                                            {flaggedAt}
                                        </td>
                                        <td className="px-4 py-3 border-b border-gray-100 text-right">
                                            <button className="px-3 py-1.5 text-xs font-semibold text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition-all">
                                                Review <Eye size="10" className="inline ml-1" />
                                            </button>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function Skeleton() {
    return (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
            <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-16 rounded-lg bg-gradient-to-r from-gray-200 to-gray-100 animate-pulse" />
                ))}
            </div>
        </div>
    );
}