// client/src/components/fraud/AlertDrawer.jsx
// Slide-in right panel — full alert details, SHAP chart, block/delete buttons.

import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { clearSelected } from '../../store/slices/fraudSlice';
import { RiskBadge }   from './RiskBadge';
import { ShapChart }   from './ShapChart';
import { ActionModal } from './ActionModal';

const VERIF_STYLE = {
    approved: { bg: '#f0fdf4', color: '#15803d' },
    pending:  { bg: '#fefce8', color: '#854d0e' },
    rejected: { bg: '#fef2f2', color: '#dc2626' },
    blocked:  { bg: '#f3f4f6', color: '#374151' },
};

export function AlertDrawer() {
    const dispatch              = useDispatch();
    const { selectedAlert }     = useSelector(s => s.fraud);
    const [activeModal, setModal] = useState(null); // 'block' | 'delete'

    const open  = !!selectedAlert;
    const close = () => { dispatch(clearSelected()); setModal(null); };
    const snap  = selectedAlert?.features_snapshot || {};

    return (
        <>
            {open && <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 900 }} />}

            <div style={{
                position: 'fixed', top: 0, right: 0, height: '100vh',
                width: 460, maxWidth: '95vw',
                background: '#fff', boxShadow: '-4px 0 30px rgba(0,0,0,0.12)',
                zIndex: 950, overflowY: 'auto', display: 'flex', flexDirection: 'column',
                transform: open ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)',
            }}>
                {selectedAlert && (
                    <>
                        {/* Header */}
                        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f3f4f6', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Fraud Alert Detail</h2>
                                <button onClick={close} style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, width: 30, height: 30, cursor: 'pointer', fontSize: 16, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{
                                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                                    background: selectedAlert.user_role === 'worker' ? '#dbeafe' : '#dcfce7',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 17, fontWeight: 700,
                                    color: selectedAlert.user_role === 'worker' ? '#1d4ed8' : '#15803d',
                                }}>
                                    {selectedAlert.name?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{selectedAlert.name || 'Unknown'}</div>
                                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>
                                        {selectedAlert.karigar_id && `${selectedAlert.karigar_id} · `}
                                        {selectedAlert.mobile || selectedAlert.user_id?.slice(-8)}
                                    </div>
                                </div>
                                <RiskBadge level={selectedAlert.risk_level} />
                            </div>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '18px 22px', flex: 1 }}>

                            <Sec title="Fraud Score">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <div style={{ flex: 1, height: 10, background: '#f3f4f6', borderRadius: 5, overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${Math.round((selectedAlert.fraud_probability||0)*100)}%`,
                                            background: selectedAlert.risk_level==='HIGH'?'#ef4444':selectedAlert.risk_level==='MEDIUM'?'#f97316':'#eab308',
                                            borderRadius: 5, transition: 'width 0.5s ease',
                                        }}/>
                                    </div>
                                    <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', minWidth: 52,
                                        color: selectedAlert.risk_level==='HIGH'?'#dc2626':selectedAlert.risk_level==='MEDIUM'?'#d97706':'#ca8a04' }}>
                                        {Math.round((selectedAlert.fraud_probability||0)*100)}%
                                    </span>
                                </div>
                            </Sec>

                            <Sec title="Account Info">
                                <Grid items={[
                                    { label:'Role',        val: selectedAlert.user_role,          cap: true },
                                    { label:'Status',      val: (
                                        <span style={{ fontSize:12, fontWeight:600, padding:'2px 8px', borderRadius:4, ...(VERIF_STYLE[selectedAlert.verification_status]||{}) }}>
                                            {selectedAlert.verification_status||'—'}
                                        </span>
                                    )},
                                    { label:'Account Age', val: snap.account_age_days != null ? `${snap.account_age_days} days` : '—' },
                                    { label:'Points',      val: snap.points != null ? snap.points : '—', hi: (snap.points||0)<0 },
                                    { label:'ID Verified', val: snap.doc_verified===1?'✅ Yes':'❌ No' },
                                    { label:'eShram Card', val: snap.has_eshram_card===1?'✅ Yes':'❌ No' },
                                ]}/>
                            </Sec>

                            <Sec title="Behavioral Signals (7–30 days)">
                                <Grid items={[
                                    { label:'Failed Logins',    val: snap.failed_logins_7d    ?? '—', hi:(snap.failed_logins_7d||0)>3 },
                                    { label:'Device Changes',   val: snap.device_changes_30d  ?? '—', hi:(snap.device_changes_30d||0)>3 },
                                    { label:'Location Changes', val: snap.location_changes_30d?? '—', hi:(snap.location_changes_30d||0)>3 },
                                    { label:'Suspicious IPs',   val: snap.suspicious_ip_count ?? '—', hi:(snap.suspicious_ip_count||0)>0 },
                                    { label:'Profile Edits',    val: snap.profile_updates_30d ?? '—', hi:(snap.profile_updates_30d||0)>8 },
                                    { label:'Avail. Toggles',   val: snap.availability_toggles_7d ?? '—', hi:(snap.availability_toggles_7d||0)>6 },
                                ]}/>
                            </Sec>

                            {selectedAlert.user_role === 'worker' && (
                                <Sec title="Job Signals">
                                    <Grid items={[
                                        { label:'Applications',        val: snap.total_applications    ?? '—' },
                                        { label:'Completed',           val: snap.jobs_completed        ?? '—' },
                                        { label:'Cancellations',       val: snap.job_cancellations_total ?? '—', hi:(snap.job_cancellations_total||0)>3 },
                                        { label:'Grace Window Abuses', val: snap.cancel_within_grace_window_count ?? '—', hi:(snap.cancel_within_grace_window_count||0)>0 },
                                        { label:'Cancel Rate',         val: snap.cancellation_rate != null ? `${(snap.cancellation_rate*100).toFixed(1)}%` : '—', hi:(snap.cancellation_rate||0)>0.4 },
                                        { label:'Avg Rating',          val: snap.avg_rating ?? '—', hi:(snap.avg_rating||5)<3 },
                                    ]}/>
                                </Sec>
                            )}

                            {selectedAlert.user_role === 'client' && (
                                <Sec title="Job Signals">
                                    <Grid items={[
                                        { label:'Jobs Posted',       val: snap.total_jobs_posted             ?? '—' },
                                        { label:'Completed',         val: snap.jobs_completed_as_client      ?? '—' },
                                        { label:'Cancelled',         val: snap.jobs_cancelled_by_client      ?? '—', hi:(snap.jobs_cancelled_by_client||0)>4 },
                                        { label:'Workers Removed',   val: snap.workers_accepted_then_removed ?? '—', hi:(snap.workers_accepted_then_removed||0)>2 },
                                        { label:'App Toggles',       val: snap.application_toggle_count      ?? '—', hi:(snap.application_toggle_count||0)>5 },
                                        { label:'Avg Cancel Time',   val: snap.avg_job_post_to_cancel_hours != null ? `${snap.avg_job_post_to_cancel_hours}h` : '—', hi:(snap.avg_job_post_to_cancel_hours||999)<6 },
                                    ]}/>
                                </Sec>
                            )}

                            <Sec title="Top Fraud Signals (SHAP)">
                                <ShapChart reasons={selectedAlert.top_reasons || []} />
                            </Sec>

                            <Sec title="Complaints">
                                <Grid items={[
                                    { label:'Received', val: snap.complaints_received_count ?? '—', hi:(snap.complaints_received_count||0)>1 },
                                    { label:'Filed',    val: snap.complaints_filed_count    ?? '—' },
                                ]}/>
                            </Sec>
                        </div>

                        {/* Sticky action footer */}
                        <div style={{ padding: '14px 22px', borderTop: '1px solid #f3f4f6', background: '#fff', position: 'sticky', bottom: 0, display: 'flex', gap: 10 }}>
                            <Btn color="#d97706" bg="#fffbeb" hover="#fef3c7" border="#d97706" onClick={() => setModal('block')}>
                                🔒 Block Account
                            </Btn>
                            <Btn color="#dc2626" bg="#fef2f2" hover="#fee2e2" border="#dc2626" onClick={() => setModal('delete')}>
                                🗑️ Delete Account
                            </Btn>
                        </div>
                    </>
                )}
            </div>

            {activeModal && selectedAlert && (
                <ActionModal alert={selectedAlert} action={activeModal} onClose={() => setModal(null)} />
            )}
        </>
    );
}

function Sec({ title, children }) {
    return (
        <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' }}>
                {title}
            </div>
            {children}
        </div>
    );
}

function Grid({ items }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
            {items.map((item, i) => (
                <div key={i} style={{ background: item.hi ? '#fef2f2' : '#f9fafb', border: `1px solid ${item.hi ? '#fca5a5' : '#f3f4f6'}`, borderRadius: 7, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2, fontWeight: 600 }}>{item.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: item.hi ? '#dc2626' : '#111827', textTransform: item.cap ? 'capitalize' : 'none' }}>
                        {item.val}
                    </div>
                </div>
            ))}
        </div>
    );
}

function Btn({ children, color, bg, hover, border, onClick }) {
    const [hovered, setHovered] = useState(false);
    return (
        <button onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                flex: 1, padding: '10px 0',
                border: `1.5px solid ${border}`, borderRadius: 9,
                background: hovered ? hover : bg, color,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'background 0.15s',
            }}>
            {children}
        </button>
    );
}