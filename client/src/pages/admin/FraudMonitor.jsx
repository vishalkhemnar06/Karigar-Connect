import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

import { AlertDrawer } from '../../components/fraud/AlertDrawer';
import { FraudQueue } from '../../components/fraud/FraudQueue';
import { FraudStatsBar } from '../../components/fraud/FraudStatsBar';
import { useFraudSocket } from '../../hooks/useFraudSocket';
import {
  fetchFraudActions,
  fetchFraudQueue,
} from '../../store/slices/fraudSlice';

import {
  Shield, AlertTriangle, RefreshCw, ArrowLeft, Eye,
  History, Clock, User, ShieldAlert, Zap, Sparkles,
  TrendingUp, Activity, Bell, CheckCircle, XCircle,
  AlertCircle, BarChart3, PieChart, Target, Crown,
  Award, FileText, MessageSquare, UserCheck, UserX,
  ShieldCheck, ShieldX, Lock, Unlock, Flag, Radar
} from 'lucide-react';

function HistoryPanel() {
  const history = useSelector(state => state.fraud.history);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-white rounded-3xl border border-orange-100 shadow-xl overflow-hidden"
    >
      <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <History size={16} className="text-white" />
            </div>
            <h2 className="text-lg font-black text-white">Recent Admin Actions</h2>
          </div>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/80 bg-white/20 px-3 py-1 rounded-full">
            Latest 50
          </span>
        </div>
      </div>

      <div className="p-5">
        {history.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <History size={24} className="text-gray-300" />
            </div>
            <p className="text-sm text-gray-500 font-medium">No fraud actions taken yet</p>
            <p className="text-xs text-gray-400 mt-1">Actions will appear here when you take action on flagged users</p>
          </motion.div>
        ) : (
          <div className="space-y-3 max-h-[28rem] overflow-y-auto custom-scrollbar pr-1">
            <AnimatePresence>
              {history.map((item, index) => {
                const actionColors = {
                  warn: 'bg-yellow-50 border-yellow-200 text-yellow-700',
                  block: 'bg-red-50 border-red-200 text-red-700',
                  clear: 'bg-green-50 border-green-200 text-green-700',
                  investigate: 'bg-blue-50 border-blue-200 text-blue-700',
                };
                const actionIcons = {
                  warn: <AlertTriangle size={12} />,
                  block: <ShieldX size={12} />,
                  clear: <CheckCircle size={12} />,
                  investigate: <Eye size={12} />,
                };
                const bgColor = actionColors[item.action] || 'bg-gray-50 border-gray-200 text-gray-700';
                const ActionIcon = actionIcons[item.action] || <Shield size={12} />;

                return (
                  <motion.div
                    key={`${item.userName || 'action'}-${item.takenAt || index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    whileHover={{ scale: 1.01 }}
                    className={`rounded-2xl border p-4 transition-all ${bgColor}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-gray-900 text-sm">{item.userName || 'Unknown user'}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize flex items-center gap-1 ${bgColor}`}>
                            {ActionIcon}
                            {item.action}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 capitalize flex items-center gap-1">
                          <User size={10} /> {item.userRole || 'user'}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock size={10} />
                          {item.takenAt ? new Date(item.takenAt).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : '—'}
                        </p>
                      </div>
                    </div>
                    {item.reason && (
                      <p className="mt-2 text-sm text-gray-600 border-t border-gray-200/50 pt-2 mt-2">
                        <span className="font-semibold text-gray-700">Reason:</span> {item.reason}
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function FraudMonitor() {
  const dispatch = useDispatch();
  const { error, loading } = useSelector(state => state.fraud);
  const [refreshing, setRefreshing] = useState(false);

  const refreshMonitor = async (showToast = false) => {
    setRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchFraudQueue()).unwrap(),
        dispatch(fetchFraudActions()).unwrap(),
      ]);

      if (showToast) {
        toast.success('Fraud queue refreshed successfully.');
      }
    } catch (refreshError) {
      if (showToast) {
        toast.error(refreshError || 'Failed to refresh fraud queue.');
      }
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setRefreshing(true);

    Promise.all([
      dispatch(fetchFraudQueue()).unwrap(),
      dispatch(fetchFraudActions()).unwrap(),
    ])
      .catch(() => {})
      .finally(() => {
        setRefreshing(false);
      });
  }, [dispatch]);

  useEffect(() => {
    if (!error) return;
    toast.error(error);
  }, [error]);

  useFraudSocket({
    onAlert: payload => {
      if (payload?.name) {
        toast(`New fraud alert: ${payload.name}`, { icon: '⚠️' });
      }
    },
    onActionTaken: () => {
      dispatch(fetchFraudActions());
    },
  });

  const isRefreshing = refreshing || loading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/20">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <Radar size={20} className="text-white" />
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.35em] text-orange-600">Admin Risk Console</p>
              </div>
              <h1 className="text-4xl font-black bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                Fraud Detection Monitor
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-gray-600 leading-relaxed">
                Live risk queue backed by the Python fraud service. Review model signals, 
                run scans, and take admin action without touching the rest of the admin workflow.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => refreshMonitor(true)}
                disabled={isRefreshing}
                className="flex items-center gap-2 rounded-xl border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 px-5 py-2.5 text-sm font-bold text-orange-700 shadow-sm transition-all hover:border-orange-300 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRefreshing ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                {isRefreshing ? 'Refreshing Queue...' : 'Refresh Queue'}
              </motion.button>
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  to="/admin/dashboard"
                  className="flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 shadow-sm transition-all hover:border-orange-300 hover:text-orange-600"
                >
                  <ArrowLeft size={16} />
                  Back To Dashboard
                </Link>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <FraudStatsBar />
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,0.9fr)] mt-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
          >
            <FraudQueue />
          </motion.div>
          <HistoryPanel />
        </div>
      </div>

      <AlertDrawer />

      <style>{`
        @keyframes fraud-spin { 
          from { transform: rotate(0deg); } 
          to { transform: rotate(360deg); } 
        }
        @keyframes shimmer { 
          0% { background-position: 200% 0; } 
          100% { background-position: -200% 0; } 
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #f97316;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #ea580c;
        }
      `}</style>
    </div>
  );
}