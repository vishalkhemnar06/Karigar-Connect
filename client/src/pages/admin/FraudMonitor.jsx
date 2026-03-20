import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import { AlertDrawer } from '../../components/fraud/AlertDrawer';
import { FraudQueue } from '../../components/fraud/FraudQueue';
import { FraudStatsBar } from '../../components/fraud/FraudStatsBar';
import { useFraudSocket } from '../../hooks/useFraudSocket';
import {
  fetchFraudActions,
  fetchFraudQueue,
} from '../../store/slices/fraudSlice';

function HistoryPanel() {
  const history = useSelector(state => state.fraud.history);

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Recent Admin Actions</h2>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Latest 50</span>
      </div>

      {history.length === 0 ? (
        <p className="text-sm text-gray-500">No fraud actions have been taken yet.</p>
      ) : (
        <div className="space-y-3 max-h-[24rem] overflow-y-auto pr-1">
          {history.map((item, index) => (
            <div key={`${item.userName || 'action'}-${item.takenAt || index}`} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.userName || 'Unknown user'}</p>
                  <p className="text-xs text-gray-500 capitalize">{item.userRole || 'user'} • {item.action}</p>
                </div>
                <span className="text-xs text-gray-400">{item.takenAt ? new Date(item.takenAt).toLocaleString('en-IN') : '—'}</span>
              </div>
              <p className="mt-2 text-sm text-gray-600">{item.reason || 'No reason recorded.'}</p>
            </div>
          ))}
        </div>
      )}
    </section>
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
        toast.success('Fraud queue refreshed.');
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
      .catch(() => {
      })
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.18),_transparent_28%),linear-gradient(180deg,_#fffaf5_0%,_#f8fafc_100%)] text-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-orange-500">Admin Risk Console</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950">Fraud Detection Monitor</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600">
              Live risk queue backed by the Python fraud service. Review model signals, run scans, and take admin action without touching the rest of the admin workflow.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => refreshMonitor(true)}
              disabled={isRefreshing}
              className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 shadow-sm transition hover:border-orange-300 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRefreshing ? 'Refreshing Queue...' : 'Refresh Queue'}
            </button>
            <Link to="/admin/dashboard" className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-orange-300 hover:text-orange-600">
              Back To Dashboard
            </Link>
          </div>
        </div>

        <FraudStatsBar />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,0.9fr)]">
          <FraudQueue />
          <HistoryPanel />
        </div>
      </div>

      <AlertDrawer />

      <style>{`
        @keyframes fraud-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
    </div>
  );
}