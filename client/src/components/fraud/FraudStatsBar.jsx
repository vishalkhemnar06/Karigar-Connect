// client/src/components/fraud/FraudStatsBar.jsx
// Top stats row + model metrics + "Run Full Scan" button.

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { triggerFullScan } from '../../store/slices/fraudSlice';
import { 
    Shield, AlertTriangle, Users, Clock, 
    TrendingUp, Zap, Server, Database, 
    Activity, BarChart3, PieChart, Target 
} from 'lucide-react';

function StatCard({ label, value, sub, icon: Icon, accent, delay = 0 }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            whileHover={{ y: -2 }}
            className="bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all"
        >
            <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</p>
                <div className={`p-1.5 rounded-lg bg-gradient-to-r ${accent} shadow-sm`}>
                    <Icon size="14" className="text-white" />
                </div>
            </div>
            <p className={`text-2xl font-bold ${accent.includes('orange') ? 'text-orange-600' : accent.includes('red') ? 'text-red-600' : accent.includes('purple') ? 'text-purple-600' : 'text-gray-800'}`}>
                {value}
            </p>
            {sub && <p className="text-[10px] text-gray-400 mt-1">{sub}</p>}
        </motion.div>
    );
}

export function FraudStatsBar() {
    const dispatch = useDispatch();
    const { alerts, complaintStats, scanStatus, scanLoading } = useSelector(s => s.fraud);

    const high = alerts.filter(a => a.risk_level === 'HIGH').length;
    const medium = alerts.filter(a => a.risk_level === 'MEDIUM').length;
    const clientPending = complaintStats?.client?.pending ?? 0;
    const workerPending = (complaintStats?.worker?.byStatus?.submitted || 0) + (complaintStats?.worker?.byStatus?.inReview || 0);

    return (
        <div className="space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard label="Total Flagged" value={alerts.length} sub="in queue" icon={Shield} accent="from-purple-500 to-pink-500" delay={0} />
                <StatCard label="High Risk" value={high} sub="immediate review" icon={AlertTriangle} accent="from-red-500 to-rose-500" delay={0.05} />
                <StatCard label="Medium Risk" value={medium} sub="review recommended" icon={TrendingUp} accent="from-orange-500 to-amber-500" delay={0.1} />
                <StatCard label="Client Complaints" value={clientPending} sub="pending resolution" icon={Users} accent="from-blue-500 to-cyan-500" delay={0.15} />
                <StatCard label="Worker Tickets" value={workerPending} sub="submitted + in-review" icon={Activity} accent="from-emerald-500 to-teal-500" delay={0.2} />
                <StatCard label="Last Scan" 
                    value={scanStatus ? scanStatus.scanned?.toLocaleString() : '—'}
                    sub={scanStatus ? `${scanStatus.flagged_count} flagged` : 'not yet run'}
                    icon={Database} accent="from-gray-500 to-gray-600" delay={0.25} />
            </div>

            {/* Scan Button */}
            <div className="flex justify-end">
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => dispatch(triggerFullScan())}
                    disabled={scanLoading}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-gray-800 to-gray-900 text-white font-bold text-sm hover:shadow-lg transition-all disabled:opacity-50"
                >
                    {scanLoading ? (
                        <>
                            <Loader2 size="14" className="animate-spin" />
                            Scanning...
                        </>
                    ) : (
                        <>
                            <Zap size="14" />
                            Run Full Scan Now
                        </>
                    )}
                </motion.button>
            </div>
        </div>
    );
}

// Helper Loader Component
const Loader2 = ({ size, className }) => (
    <svg className={`animate-spin ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);