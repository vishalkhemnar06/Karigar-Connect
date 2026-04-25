// client/src/components/fraud/AlertDrawer.jsx
// Slide-in right panel — full alert details, SHAP chart, block/delete buttons.

import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { clearSelected } from '../../store/slices/fraudSlice';
import { RiskBadge } from './RiskBadge';
import { ShapChart } from './ShapChart';
import { ActionModal } from './ActionModal';
import { 
    X, User, Shield, AlertTriangle, Clock, Calendar, 
    Phone, Mail, MapPin, Briefcase, Star, Award,
    TrendingUp, Activity, BarChart3, PieChart, Target, Trash2
} from 'lucide-react';

const VERIF_STYLE = {
    approved: { bg: '#f0fdf4', color: '#15803d', icon: '✅' },
    pending:  { bg: '#fefce8', color: '#854d0e', icon: '⏳' },
    rejected: { bg: '#fef2f2', color: '#dc2626', icon: '❌' },
    blocked:  { bg: '#f3f4f6', color: '#374151', icon: '🔒' },
};

export function AlertDrawer() {
    const dispatch = useDispatch();
    const { selectedAlert } = useSelector(s => s.fraud);
    const [activeModal, setModal] = useState(null);
    const open = !!selectedAlert;

    const close = () => { 
        dispatch(clearSelected()); 
        setModal(null); 
    };

    const snap = selectedAlert?.features_snapshot || {};

    return (
        <>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[900]"
                        onClick={close}
                    />
                )}
            </AnimatePresence>

            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: open ? 0 : '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 h-full w-[480px] max-w-[95vw] bg-white shadow-2xl z-[950] overflow-y-auto flex flex-col"
            >
                {selectedAlert && (
                    <>
                        {/* Header */}
                        <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-red-500 p-5 text-white z-10">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                                        <Shield size="14" className="text-white" />
                                    </div>
                                    <h2 className="font-bold text-base">Fraud Alert Detail</h2>
                                </div>
                                <button 
                                    onClick={close}
                                    className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
                                >
                                    <X size="16" className="text-white" />
                                </button>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${
                                    selectedAlert.user_role === 'worker' ? 'bg-blue-500' : 'bg-emerald-500'
                                }`}>
                                    {selectedAlert.name?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                                <div className="flex-1">
                                    <div className="font-bold text-base">{selectedAlert.name || 'Unknown'}</div>
                                    <div className="text-white/80 text-xs mt-0.5">
                                        {selectedAlert.karigar_id && `${selectedAlert.karigar_id} · `}
                                        {selectedAlert.mobile || selectedAlert.user_id?.slice(-8)}
                                    </div>
                                </div>
                                <RiskBadge level={selectedAlert.risk_level} />
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 p-5 space-y-5">
                            {/* Fraud Score */}
                            <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-200">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] font-bold text-orange-700 uppercase tracking-wider">Fraud Score</p>
                                    <span className={`text-lg font-bold ${
                                        selectedAlert.risk_level === 'HIGH' ? 'text-red-600' :
                                        selectedAlert.risk_level === 'MEDIUM' ? 'text-orange-600' : 'text-yellow-600'
                                    }`}>
                                        {Math.round((selectedAlert.fraud_probability || 0) * 100)}%
                                    </span>
                                </div>
                                <div className="h-2 bg-orange-200 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.round((selectedAlert.fraud_probability || 0) * 100)}%` }}
                                        transition={{ duration: 0.8 }}
                                        className={`h-full rounded-full ${
                                            selectedAlert.risk_level === 'HIGH' ? 'bg-red-500' :
                                            selectedAlert.risk_level === 'MEDIUM' ? 'bg-orange-500' : 'bg-yellow-500'
                                        }`}
                                    />
                                </div>
                            </div>

                            {/* Account Info */}
                            <Section title="Account Information" icon={User}>
                                <Grid items={[
                                    { label: 'Role', val: selectedAlert.user_role, cap: true },
                                    { label: 'Status', val: (
                                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                                            selectedAlert.verificationStatus === 'approved' ? 'bg-green-100 text-green-700' :
                                            selectedAlert.verificationStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                            selectedAlert.verificationStatus === 'rejected' ? 'bg-red-100 text-red-700' :
                                            'bg-gray-100 text-gray-700'
                                        }`}>
                                            {VERIF_STYLE[selectedAlert.verification_status]?.icon} {selectedAlert.verification_status || '—'}
                                        </span>
                                    ) },
                                    { label: 'Account Age', val: snap.account_age_days != null ? `${snap.account_age_days} days` : '—' },
                                    { label: 'Points', val: snap.points != null ? snap.points : '—', hi: (snap.points || 0) < 0 },
                                    { label: 'ID Verified', val: snap.doc_verified === 1 ? '✅ Yes' : '❌ No' },
                                    { label: 'eShram Card', val: snap.has_eshram_card === 1 ? '✅ Yes' : '❌ No' },
                                ]} />
                            </Section>

                            {/* Behavioral Signals */}
                            <Section title="Behavioral Signals (7–30 days)" icon={Activity}>
                                <Grid items={[
                                    { label: 'Failed Logins', val: snap.failed_logins_7d ?? '—', hi: (snap.failed_logins_7d || 0) > 3 },
                                    { label: 'Device Changes', val: snap.device_changes_30d ?? '—', hi: (snap.device_changes_30d || 0) > 3 },
                                    { label: 'Location Changes', val: snap.location_changes_30d ?? '—', hi: (snap.location_changes_30d || 0) > 3 },
                                    { label: 'Suspicious IPs', val: snap.suspicious_ip_count ?? '—', hi: (snap.suspicious_ip_count || 0) > 0 },
                                    { label: 'Profile Edits', val: snap.profile_updates_30d ?? '—', hi: (snap.profile_updates_30d || 0) > 8 },
                                    { label: 'Avail. Toggles', val: snap.availability_toggles_7d ?? '—', hi: (snap.availability_toggles_7d || 0) > 6 },
                                ]} />
                            </Section>

                            {/* Worker-specific */}
                            {selectedAlert.user_role === 'worker' && (
                                <Section title="Job Signals" icon={Briefcase}>
                                    <Grid items={[
                                        { label: 'Applications', val: snap.total_applications ?? '—' },
                                        { label: 'Job Completed', val: snap.jobs_completed ?? '—' },
                                        { label: 'Job Cancellations', val: snap.job_cancellations_total ?? '—', hi: (snap.job_cancellations_total || 0) > 3 },
                                        { label: 'Grace Window Abuses', val: snap.cancel_within_grace_window_count ?? '—', hi: (snap.cancel_within_grace_window_count || 0) > 0 },
                                        { label: 'Cancel Rate', val: snap.cancellation_rate != null ? `${(snap.cancellation_rate * 100).toFixed(1)}%` : '—', hi: (snap.cancellation_rate || 0) > 0.4 },
                                        { label: 'Avg Rating', val: snap.avg_rating ?? '—', hi: (snap.avg_rating || 5) < 3 },
                                    ]} />
                                </Section>
                            )}

                            {/* Client-specific */}
                            {selectedAlert.user_role === 'client' && (
                                <Section title="Job Signals" icon={Briefcase}>
                                    <Grid items={[
                                        { label: 'Jobs Posted', val: snap.total_jobs_posted ?? '—' },
                                        { label: 'Completed', val: snap.jobs_completed_as_client ?? '—' },
                                        { label: 'Cancelled', val: snap.jobs_cancelled_by_client ?? '—', hi: (snap.jobs_cancelled_by_client || 0) > 4 },
                                        { label: 'Workers Removed', val: snap.workers_accepted_then_removed ?? '—', hi: (snap.workers_accepted_then_removed || 0) > 2 },
                                        { label: 'App Toggles', val: snap.application_toggle_count ?? '—', hi: (snap.application_toggle_count || 0) > 5 },
                                        { label: 'Avg Cancel Time', val: snap.avg_job_post_to_cancel_hours != null ? `${snap.avg_job_post_to_cancel_hours}h` : '—', hi: (snap.avg_job_post_to_cancel_hours || 999) < 6 },
                                    ]} />
                                </Section>
                            )}

                            {/* SHAP Chart */}
                            <Section title="Top Fraud Signals (SHAP)" icon={BarChart3}>
                                <ShapChart reasons={selectedAlert.top_reasons || []} />
                            </Section>

                            {/* Complaints */}
                            <Section title="Complaint History" icon={AlertTriangle}>
                                <Grid items={[
                                    { label: 'Complaints Received', val: snap.complaints_received_count ?? '—', hi: (snap.complaints_received_count || 0) > 1 },
                                    { label: 'Complaints Filed', val: snap.complaints_filed_count ?? '—' },
                                ]} />
                            </Section>
                        </div>

                        {/* Footer Actions */}
                        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-5 flex gap-3">
                            <button
                                onClick={() => setModal('block')}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-orange-200 text-orange-700 font-bold text-sm hover:bg-orange-50 transition-all"
                            >
                                <Shield size="14" /> Block Account
                            </button>
                            <button
                                onClick={() => setModal('delete')}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-bold text-sm hover:shadow-md transition-all"
                            >
                                <Trash2 size="14" /> Delete Account
                            </button>
                        </div>
                    </>
                )}
            </motion.div>

            {activeModal && selectedAlert && (
                <ActionModal alert={selectedAlert} action={activeModal} onClose={() => setModal(null)} />
            )}
        </>
    );
}

function Section({ title, icon: Icon, children }) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center shadow-sm">
                    <Icon size="12" className="text-white" />
                </div>
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">{title}</h3>
            </div>
            {children}
        </div>
    );
}

function Grid({ items }) {
    return (
        <div className="grid grid-cols-2 gap-2">
            {items.map((item, i) => (
                <div key={i} className={`bg-gray-50 rounded-lg p-2.5 border ${item.hi ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
                    <p className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider">{item.label}</p>
                    <p className={`text-sm font-bold mt-1 ${item.hi ? 'text-red-600' : 'text-gray-800'}`}>
                        {item.val}
                    </p>
                </div>
            ))}
        </div>
    );
}