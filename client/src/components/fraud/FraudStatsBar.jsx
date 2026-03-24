// client/src/components/fraud/FraudStatsBar.jsx
// Top stats row + model metrics + "Run Full Scan" button.

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchModelMetrics, triggerFullScan } from '../../store/slices/fraudSlice';

function StatCard({ label, value, sub, accent }) {
    return (
        <div style={{
            background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 10, padding: '14px 18px', flex: 1, minWidth: 130,
        }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>
                {label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: accent || '#111827', lineHeight: 1, marginBottom: 3 }}>
                {value}
            </div>
            {sub && <div style={{ fontSize: 11, color: '#9ca3af' }}>{sub}</div>}
        </div>
    );
}

export function FraudStatsBar() {
    const dispatch = useDispatch();
    const { metrics, alerts, complaintStats, scanStatus, scanLoading } = useSelector(s => s.fraud);

    useEffect(() => { dispatch(fetchModelMetrics()); }, [dispatch]);

    const high   = alerts.filter(a => a.risk_level === 'HIGH').length;
    const medium = alerts.filter(a => a.risk_level === 'MEDIUM').length;
    const wm     = metrics?.worker || {};
    const cm     = metrics?.client || {};
    const clientPending = complaintStats?.client?.pending ?? 0;
    const workerPending = (complaintStats?.worker?.byStatus?.submitted || 0) + (complaintStats?.worker?.byStatus?.inReview || 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>

            {/* Queue stats */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <StatCard label="Total Flagged"  value={alerts.length}          sub="in queue"                     accent="#6366f1" />
                <StatCard label="High Risk"      value={high}                   sub="immediate review needed"       accent="#ef4444" />
                <StatCard label="Medium Risk"    value={medium}                 sub="review recommended"            accent="#f97316" />
                <StatCard label="Client Complaints" value={clientPending}       sub="pending"                      accent="#dc2626" />
                <StatCard label="Worker Tickets"   value={workerPending}       sub="submitted + in-review"        accent="#b45309" />
                <StatCard label="Last Scan"
                    value={scanStatus ? scanStatus.scanned?.toLocaleString() : '—'}
                    sub={scanStatus ? `${scanStatus.flagged_count} flagged` : 'not yet run'}
                />
            </div>

            {/* Model metrics */}
            {metrics && (
                <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                        Model Performance
                    </div>
                    <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                        {[{ label: 'Worker Model', m: wm }, { label: 'Client Model', m: cm }].map(({ label, m }) => (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', minWidth: 100 }}>{label}</span>
                                {[['f1','F1'], ['precision','Precision'], ['recall','Recall'], ['auc_roc','AUC-ROC']].map(([k, lbl]) => (
                                    <div key={k} style={{ textAlign: 'center' }}>
                                        <div style={{
                                            fontSize: 14, fontWeight: 700,
                                            color: parseFloat(m[k]) >= 0.85 ? '#16a34a'
                                                 : parseFloat(m[k]) >= 0.70 ? '#d97706' : '#dc2626',
                                        }}>
                                            {m[k] != null ? (m[k] * 100).toFixed(1) + '%' : '—'}
                                        </div>
                                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{lbl}</div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Scan button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                    onClick={() => dispatch(triggerFullScan())}
                    disabled={scanLoading}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        background: scanLoading ? '#e5e7eb' : '#111827',
                        color: scanLoading ? '#9ca3af' : '#fff',
                        border: 'none', borderRadius: 8,
                        padding: '9px 18px', fontSize: 13, fontWeight: 600,
                        cursor: scanLoading ? 'not-allowed' : 'pointer',
                        transition: 'background 0.2s',
                    }}
                >
                    {scanLoading ? (
                        <><SpinIcon /> Scanning…</>
                    ) : (
                        <><SearchIcon /> Run Full Scan Now</>
                    )}
                </button>
            </div>
        </div>
    );
}

const SearchIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 7v4l2 2"/>
    </svg>
);
const SpinIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
        style={{ animation: 'fraud-spin 0.8s linear infinite' }}>
        <path d="M21 12a9 9 0 1 1-9-9"/>
    </svg>
);