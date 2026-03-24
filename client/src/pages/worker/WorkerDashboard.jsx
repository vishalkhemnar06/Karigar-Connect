// src/pages/worker/WorkerDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../../api';
import {
  MapPin, Briefcase,
  CheckCircle, Clock4, AlertTriangle, Star,
  RefreshCw, Shield, Phone, Award, UserCheck,
} from 'lucide-react';

// ── TOAST SYSTEM (Preserved Functionality) ──
let _tid = 0;
const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = 'success', ttl = 3200) => {
    const id = ++_tid;
    setToasts(p => [...p, { id, msg, type }]);
    if (type !== 'loading') setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), ttl);
    return id;
  }, []);
  const update = useCallback((id, msg, type) => {
    setToasts(p => p.map(t => t.id === id ? { ...t, msg, type } : t));
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }, []);
  return { toasts, loading: m => add(m, 'loading'), success: m => add(m, 'success'), error: m => add(m, 'error'), update };
};

const ToastList = ({ toasts }) => (
  <div className="fixed top-3 left-3 right-3 sm:left-auto sm:right-5 sm:top-5 z-[9999] flex flex-col gap-2 pointer-events-none">
    {toasts.map(t => (
      <div key={t.id} className={`
        flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-xs text-white shadow-xl animate-in slide-in-from-top-2
        ${t.type === 'error' ? 'bg-red-500' : t.type === 'loading' ? 'bg-indigo-500' : 'bg-green-500'}
      `}>
        {t.type === 'loading' && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />}
        {t.type === 'success' && '✓'}{t.type === 'error' && '✕'}
        {t.msg}
      </div>
    ))}
  </div>
);

const safeNum = v => (v === null || v === undefined ? 0 : Number(v));

const Skel = ({ h = 'h-24', r = 'rounded-2xl' }) => (
  <div className={`${h} ${r} bg-gradient-to-r from-orange-50 via-orange-100 to-orange-50 animate-pulse`} />
);

// ── UI COMPONENTS (Mobile Optimized) ──
const StatCard = ({ title, value, subtitle, icon: Icon, grad, prefix = '', suffix = '' }) => (
  <div className="bg-white rounded-2xl p-3 border border-orange-100 shadow-sm active:scale-95 transition-all">
    <div className="flex items-center justify-between mb-1">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: grad }}>
        <Icon size={16} color="#fff" />
      </div>
      <p className="text-[9px] font-black text-gray-400 uppercase tracking-tight">{title}</p>
    </div>
    <p className="text-xl font-black text-gray-900 leading-none">
      {prefix}{safeNum(value).toLocaleString('en-IN')}{suffix}
    </p>
    {subtitle && <p className="text-[9px] text-gray-400 mt-1 truncate font-medium">{subtitle}</p>}
  </div>
);

const ClientCard = ({ client }) => {
  const initials = (client.name || 'C').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const location = [client.address?.locality, client.address?.city].filter(Boolean).join(', ') || 'Unknown';
  return (
    <div className="bg-white rounded-2xl border border-orange-100 p-4 shadow-sm active:bg-orange-50/30 transition-all">
      <div className="flex gap-3 items-center mb-3">
        <div className="w-10 h-10 rounded-xl bg-orange-100 flex-shrink-0 overflow-hidden">
          {client.photo 
            ? <img src={api.getImageUrl(client.photo)} className="w-full h-full object-cover" alt="" />
            : <div className="w-full h-full flex items-center justify-center text-orange-500 font-bold text-sm">{initials}</div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-gray-900 text-sm truncate">{client.name}</h4>
          <p className="text-[10px] text-gray-500 flex items-center gap-1"><MapPin size={10}/>{location}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-orange-50/50 rounded-lg p-1.5 text-center">
          <p className="text-xs font-black text-orange-600">{client.totalPosted || 0}</p>
          <p className="text-[8px] text-gray-400 uppercase font-bold">Posted</p>
        </div>
        <div className="bg-green-50/50 rounded-lg p-1.5 text-center">
          <p className="text-xs font-black text-green-600">{client.totalCompleted || 0}</p>
          <p className="text-[8px] text-gray-400 uppercase font-bold">Done</p>
        </div>
      </div>
      {client.mobile && (
        <a href={`tel:${client.mobile}`} className="flex items-center justify-center gap-2 text-white bg-orange-500 py-3 rounded-xl font-bold text-xs">
          <Phone size={14} /> Call Now
        </a>
      )}
    </div>
  );
};

// ── MAIN DASHBOARD ──
const WorkerDashboard = () => {
  const [nearClients, setNearClients] = useState([]);
  const [profile, setProfile] = useState(null);
  const [analytics, setAnalytics] = useState({ completed: 0, pending: 0, running: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    try {
      const [resAnalytic, resProfile, resNear] = await Promise.all([
        api.getWorkerAnalytics(),
        api.getWorkerProfile(),
        api.getNearClients()
      ]);
      if (resAnalytic?.data) setAnalytics(resAnalytic.data.data || resAnalytic.data);
      if (resProfile?.data) setProfile(resProfile.data.data || resProfile.data);
      if (resNear?.data) setNearClients(resNear.data.data || resNear.data || []);
    } catch (error) {
      console.error("Dashboard Load Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const greet = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
  };

  return (
    <div className="bg-orange-50/30 min-h-screen p-3 pt-0 pb-32 lg:pb-10 lg:pt-0">
      <ToastList toasts={toast.toasts} />
      
      {/* ── COMPACT STICKY HEADER ── */}
      <div className="flex items-center justify-between py-3 sticky top-0 bg-orange-50/90 backdrop-blur-md z-40 border-b border-orange-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white font-black shadow-lg shadow-orange-200">
            {profile?.photo 
              ? <img src={api.getImageUrl(profile.photo)} className="w-full h-full object-cover rounded-xl" alt="" />
              : profile?.name?.charAt(0).toUpperCase() || 'W'
            }
          </div>
          <div>
            <h1 className="text-sm font-black text-gray-900 leading-tight">{greet()}, {profile?.name?.split(' ')[0]}!</h1>
            <div className="flex items-center gap-1.5">
               <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">ID: {profile?.karigarId || '...'}</span>
               <span className="text-[9px] text-gray-500 font-bold uppercase tracking-tight">{profile?.address?.city || 'Local'}</span>
            </div>
          </div>
        </div>
        <button onClick={() => loadData(true)} className="p-2.5 bg-white rounded-xl border border-orange-100 shadow-sm active:scale-90 transition-all">
          <RefreshCw size={18} className={`text-orange-500 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ACTIVE TASK BANNER */}
      {analytics.running > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-2xl p-3 mb-4 flex items-center gap-3 shadow-sm mt-2">
          <Clock4 className="text-amber-500 animate-pulse" size={18} />
          <p className="text-[10px] font-black text-amber-800 uppercase tracking-wider">Job in Progress</p>
        </div>
      )}

      {/* STATS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-6 mt-4">
        {loading ? [1,2,3,4].map(i => <Skel key={i} h="h-24" />) : (
          <>
            <StatCard title="Points" value={profile?.points} icon={Star} grad="linear-gradient(135deg, #FFD700, #FFA500)" subtitle="Reputation" />
            <StatCard title="Done" value={analytics.completed} icon={CheckCircle} grad="linear-gradient(135deg, #10B981, #059669)" subtitle="Completed" />
            <StatCard title="Exp" value={profile?.experience} icon={Award} grad="linear-gradient(135deg, #8B5CF6, #7C3AED)" suffix=" Yrs" />
            <StatCard title="Applied" value={analytics.pending} icon={Briefcase} grad="linear-gradient(135deg, #3B82F6, #2563EB)" subtitle="Pending" />
          </>
        )}
      </div>

      {/* NEAR CLIENTS */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-sm font-black text-gray-900 uppercase">Near Clients <span className="text-orange-500">({nearClients.length})</span></h2>
        <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase"><MapPin size={10} /> {profile?.address?.city}</div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1,2,3].map(i => <Skel key={i} h="h-44" />)}
        </div>
      ) : nearClients.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {nearClients.map(c => <ClientCard key={c._id} client={c} />)}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-10 text-center border border-orange-100">
          <UserCheck size={32} className="text-orange-200 mx-auto mb-2" />
          <p className="text-xs font-bold text-gray-400">Searching for clients nearby...</p>
        </div>
      )}
    </div>
  );
};

// CRITICAL: Restore the missing default export
export default WorkerDashboard;