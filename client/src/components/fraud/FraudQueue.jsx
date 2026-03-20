// client/src/components/fraud/FraudQueue.jsx
// Sortable, filterable table of flagged profiles.

import { useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectAlert } from '../../store/slices/fraudSlice';
import { RiskBadge } from './RiskBadge';

const ROLE_BADGE = {
    worker: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    client: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
};

export function FraudQueue() {
    const dispatch = useDispatch();
    const { alerts, loading } = useSelector(s => s.fraud);

    const [search,     setSearch]     = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [riskFilter, setRiskFilter] = useState('all');
    const [sortKey,    setSortKey]    = useState('fraud_probability');
    const [sortDir,    setSortDir]    = useState('desc');

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

    const toggleSort = k => {
        if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(k); setSortDir('desc'); }
    };

    const SortArrow = ({ col }) => sortKey !== col
        ? <span style={{ opacity: 0.3, marginLeft: 3 }}>↕</span>
        : <span style={{ marginLeft: 3 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;

    if (loading) return <Skeleton />;

    return (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>

            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #f3f4f6', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                        style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                    <input
                        placeholder="Search name, ID, phone…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            width: '100%', padding: '8px 10px 8px 32px',
                            border: '1px solid #e5e7eb', borderRadius: 8,
                            fontSize: 13, outline: 'none', background: '#f9fafb',
                            color: '#111827', boxSizing: 'border-box',
                        }}
                    />
                </div>
                {[
                    { val: roleFilter, set: setRoleFilter, opts: [['all','All Roles'],['worker','Workers'],['client','Clients']] },
                    { val: riskFilter, set: setRiskFilter, opts: [['all','All Risk'],['HIGH','High Risk'],['MEDIUM','Medium Risk'],['LOW','Low Risk']] },
                ].map((sel, i) => (
                    <select key={i} value={sel.val} onChange={e => sel.set(e.target.value)}
                        style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, background: '#f9fafb', color: '#374151', outline: 'none', cursor: 'pointer' }}>
                        {sel.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                ))}
                <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                    {filtered.length} / {alerts.length} profiles
                </span>
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
                <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af' }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>🛡️</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                        {search || roleFilter !== 'all' || riskFilter !== 'all'
                            ? 'No results match your filters'
                            : 'No fraud alerts in queue'}
                    </div>
                    <div style={{ fontSize: 13 }}>
                        {search || roleFilter !== 'all' || riskFilter !== 'all'
                            ? 'Try adjusting the search or filters.'
                            : 'Run a full scan or wait for the daily batch at 2:00 AM.'}
                    </div>
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: '#f9fafb' }}>
                                {[
                                    { k: 'name',              l: 'User' },
                                    { k: 'user_role',         l: 'Role' },
                                    { k: 'risk_level',        l: 'Risk' },
                                    { k: 'fraud_probability', l: 'Probability' },
                                    { k: 'top_reason',        l: 'Top Reason', ns: true },
                                    { k: 'alertedAt',         l: 'Flagged At' },
                                    { k: 'action',            l: '', ns: true },
                                ].map(col => (
                                    <th key={col.k} onClick={() => !col.ns && toggleSort(col.k)}
                                        style={{
                                            padding: '10px 14px', textAlign: 'left',
                                            fontSize: 11, fontWeight: 700, color: '#6b7280',
                                            letterSpacing: '0.05em', textTransform: 'uppercase',
                                            cursor: col.ns ? 'default' : 'pointer', userSelect: 'none',
                                            whiteSpace: 'nowrap', borderBottom: '1px solid #e5e7eb',
                                        }}>
                                        {col.l}{!col.ns && <SortArrow col={col.k} />}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((alert, idx) => {
                                const prob      = Math.round((alert.fraud_probability || 0) * 100);
                                const probColor = prob >= 80 ? '#dc2626' : prob >= 60 ? '#d97706' : '#ca8a04';
                                const rc        = ROLE_BADGE[alert.user_role] || {};
                                const flaggedAt = alert.alertedAt
                                    ? new Date(alert.alertedAt).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
                                    : '—';
                                const even = idx % 2 === 0;

                                return (
                                    <tr key={alert.user_id}
                                        onClick={() => dispatch(selectAlert(alert))}
                                        style={{ background: even ? '#fff' : '#fafafa', cursor: 'pointer', transition: 'background 0.15s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                                        onMouseLeave={e => e.currentTarget.style.background = even ? '#fff' : '#fafafa'}
                                    >
                                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                                            <div style={{ fontWeight: 600, color: '#111827', marginBottom: 2 }}>{alert.name || '—'}</div>
                                            <div style={{ fontSize: 11, color: '#9ca3af' }}>
                                                {alert.karigar_id || alert.user_id?.slice(-8)}
                                                {alert.mobile && ` · ${alert.mobile}`}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                                            <span style={{ fontSize: 11, fontWeight: 600, background: rc.bg, color: rc.color, border: `1px solid ${rc.border}`, borderRadius: 5, padding: '3px 8px', textTransform: 'capitalize' }}>
                                                {alert.user_role}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                                            <RiskBadge level={alert.risk_level} />
                                        </td>
                                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ width: 48, height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${prob}%`, background: probColor, borderRadius: 3 }} />
                                                </div>
                                                <span style={{ fontWeight: 700, color: probColor, fontSize: 13, fontFamily: 'monospace' }}>{prob}%</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6', maxWidth: 220 }}>
                                            <span style={{ fontSize: 12, color: '#4b5563', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                {alert.top_reasons?.[0]?.label || '—'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
                                            {flaggedAt}
                                        </td>
                                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                                            <button onClick={() => dispatch(selectAlert(alert))} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 10px', fontSize: 12, color: '#374151', cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                                Review →
                                            </button>
                                        </td>
                                    </tr>
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
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3,4].map(i => (
                <div key={i} style={{ height: 52, borderRadius: 8, background: 'linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
            ))}
        </div>
    );
}