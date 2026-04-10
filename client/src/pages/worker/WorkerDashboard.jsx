// src/pages/worker/WorkerDashboard.jsx
import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import * as api from '../../api';
import {
  MapPin, Briefcase,
  CheckCircle, Clock4, AlertTriangle, Star,
  RefreshCw, Shield, Phone, Award, UserCheck,
  TrendingUp, Activity, Zap, Target, ArrowUp, ArrowDown,
  BarChart3, PieChart, Calendar, Eye, X, Search, Loader2
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
const safeArray = v => (Array.isArray(v) ? v : []);

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
  const safeName = typeof client?.name === 'string' ? client.name : 'Client';
  const initials = safeName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
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

// ── BAR CHART COMPONENT ──
const BarChart = memo(({ data, color = 'orange', height = 100, animated = true }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  const [animate, setAnimate] = useState(!animated);

  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => setAnimate(true), 100);
      return () => clearTimeout(timer);
    }
  }, [animated]);

  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1 group">
          <div className="relative w-full flex items-end justify-center" style={{ height: height - 20 }}>
            <div
              className={`w-full rounded-lg bg-${color}-400 group-hover:bg-${color}-500 transition-all duration-700 ease-out cursor-pointer shadow-sm`}
              style={{
                height: animate ? `${(d.value / max) * 100}%` : '0%',
                minHeight: animate && d.value ? 4 : 0,
                transitionDelay: `${i * 50}ms`
              }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
          <span className="text-[8px] text-gray-400 truncate w-full text-center font-bold">{d.label}</span>
        </div>
      ))}
    </div>
  );
});
BarChart.displayName = 'BarChart';

// ── DONUT CHART COMPONENT ──
const DonutChart = memo(({ segments, size = 100, thickness = 20, centerText }) => {
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let cumulative = 0;

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dash = pct * circumference;
          const offset = -cumulative * circumference;
          cumulative += pct;
          return (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={offset}
              className="transition-all duration-1000 ease-out"
            />
          );
        })}
      </svg>
      {centerText && (
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          {centerText}
        </div>
      )}
    </div>
  );
});
DonutChart.displayName = 'DonutChart';

// ── ANALYTICS SECTION ──
const AnalyticsSection = memo(({ analytics, profile, loading }) => {
  // Trending data for demonstration
  const jobsTrendData = useMemo(() => {
    if (analytics.completed === 0) return [];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((day, idx) => ({
      label: day,
      value: Math.max(1, Math.floor(analytics.completed * Math.random() * 0.3))
    }));
  }, [analytics.completed]);

  const donutSegments = useMemo(() => {
    const total = (analytics.completed || 0) + (analytics.pending || 0) + (analytics.running || 0);
    if (total === 0) return [{ value: 1, color: '#e5e7eb' }];
    return [
      { value: analytics.completed || 0, color: '#10b981' },
      { value: analytics.running || 0, color: '#f59e0b' },
      { value: analytics.pending || 0, color: '#3b82f6' },
    ];
  }, [analytics]);

  const completionRate = useMemo(() => {
    const applied = (analytics.pending || 0) + (analytics.completed || 0);
    return applied > 0 ? Math.round((analytics.completed / applied) * 100) : 0;
  }, [analytics]);

  const avgRating = profile?.averageRating || 0;
  const ratingPercent = Math.round((avgRating / 5) * 100);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => <Skel key={i} h="h-32" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards - 2x2 Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-3 border border-green-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle size={16} className="text-green-500" />
            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">+{analytics.completed || 0}</span>
          </div>
          <p className="text-2xl font-black text-gray-900">{analytics.completed || 0}</p>
          <p className="text-[10px] text-gray-500 font-semibold mt-1">Completed Jobs</p>
        </div>

        <div className="bg-white rounded-2xl p-3 border border-amber-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <Clock4 size={16} className="text-amber-500" />
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">{analytics.running || 0}</span>
          </div>
          <p className="text-2xl font-black text-gray-900">{analytics.running || 0}</p>
          <p className="text-[10px] text-gray-500 font-semibold mt-1">Active Jobs</p>
        </div>

        <div className="bg-white rounded-2xl p-3 border border-blue-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <Briefcase size={16} className="text-blue-500" />
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{analytics.pending || 0}</span>
          </div>
          <p className="text-2xl font-black text-gray-900">{analytics.pending || 0}</p>
          <p className="text-[10px] text-gray-500 font-semibold mt-1">Pending Apply</p>
        </div>

        <div className="bg-white rounded-2xl p-3 border border-orange-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <Star size={16} className="text-orange-500" />
            <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">{profile?.totalRatings || 0}</span>
          </div>
          <p className="text-2xl font-black text-gray-900">{profile?.averageRating || 0}</p>
          <p className="text-[10px] text-gray-500 font-semibold mt-1">Avg Rating</p>
        </div>
      </div>

      {/* Jobs Distribution Chart */}
      <div className="bg-white rounded-2xl p-4 border border-orange-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-black text-gray-800 text-sm">Job Status</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Current distribution</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-8">
          <DonutChart
            segments={donutSegments}
            size={110}
            thickness={18}
            centerText={
              <>
                <p className="text-lg font-black text-gray-900">{(analytics.completed || 0) + (analytics.running || 0)}</p>
                <p className="text-[9px] text-gray-400">Active</p>
              </>
            }
          />
          <div className="space-y-2.5 flex-1">
            {[
              { label: 'Completed', value: analytics.completed || 0, color: '#10b981' },
              { label: 'Running', value: analytics.running || 0, color: '#f59e0b' },
              { label: 'Pending', value: analytics.pending || 0, color: '#3b82f6' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] text-gray-600 font-medium flex-1">{item.label}</span>
                <span className="font-black text-gray-800 text-xs">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Jobs Trend Chart */}
      {jobsTrendData.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-orange-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-black text-gray-800 text-sm">Weekly Trend</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Jobs completed per day</p>
            </div>
            <TrendingUp size={16} className="text-orange-500" />
          </div>
          <BarChart data={jobsTrendData} color="orange" height={110} animated={true} />
        </div>
      )}

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-purple-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Target size={14} className="text-purple-500" />
            <p className="text-[10px] font-black text-gray-600 uppercase tracking-tight">Completion Rate</p>
          </div>
          <p className="text-2xl font-black text-gray-900 mb-2">{completionRate}%</p>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full transition-all duration-700"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <p className="text-[9px] text-gray-400 mt-2">Of applied jobs</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-yellow-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Star size={14} className="text-yellow-500" />
            <p className="text-[10px] font-black text-gray-600 uppercase tracking-tight">Rating</p>
          </div>
          <p className="text-2xl font-black text-gray-900 mb-2">{avgRating}/5</p>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full transition-all duration-700"
              style={{ width: `${ratingPercent}%` }}
            />
          </div>
          <p className="text-[9px] text-gray-400 mt-2">From {profile?.totalRatings || 0} reviews</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-4 border border-orange-100">
        <h3 className="font-black text-gray-800 text-sm mb-3">Quick Stats</h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white rounded-xl p-2.5 shadow-sm">
            <p className="text-xs font-black text-gray-900">{Math.round(((analytics.completed || 0) / Math.max((analytics.completed || 0) + (analytics.running || 0) + (analytics.pending || 0), 1)) * 100)}%</p>
            <p className="text-[8px] text-gray-500 mt-0.5 font-semibold">Success</p>
          </div>
          <div className="bg-white rounded-xl p-2.5 shadow-sm">
            <p className="text-xs font-black text-gray-900">{profile?.experience || 0}y</p>
            <p className="text-[8px] text-gray-500 mt-0.5 font-semibold">Experience</p>
          </div>
          <div className="bg-white rounded-xl p-2.5 shadow-sm">
            <p className="text-xs font-black text-gray-900">{profile?.points || 0}</p>
            <p className="text-[8px] text-gray-500 mt-0.5 font-semibold">Points</p>
          </div>
        </div>
      </div>
    </div>
  );
});
AnalyticsSection.displayName = 'AnalyticsSection';

const ClientDetailModal = memo(({ client, onClose }) => {
  if (!client) return null;

  const safeName = typeof client?.name === 'string' ? client.name : 'Client';
  const initials = safeName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const location = [client.address?.locality, client.address?.city, client.address?.state].filter(Boolean).join(', ') || 'Unknown';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-3">
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-5 sm:scale-in-95 transition-all">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="font-black text-white text-lg">Client Details</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-all">
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Profile Section */}
          <div className="text-center">
            <div className="w-24 h-24 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto mb-3 overflow-hidden shadow-md">
              {client.photo 
                ? <img src={api.getImageUrl(client.photo)} className="w-full h-full object-cover" alt="" />
                : <div className="w-full h-full flex items-center justify-center text-orange-500 font-black text-2xl">{initials}</div>
              }
            </div>
            <h3 className="font-black text-xl text-gray-900 mb-1">{safeName}</h3>
            <p className="text-sm text-gray-500 flex items-center justify-center gap-1">
              <MapPin size={14} /> {location}
            </p>
          </div>

          {/* Contact Info */}
          <div className="bg-orange-50 rounded-2xl p-4 space-y-3 border border-orange-100">
            <h4 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Contact Info</h4>
            {client.email && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Email</span>
                <span className="text-xs font-bold text-gray-900 break-all text-right">{client.email}</span>
              </div>
            )}
            {client.mobile && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Mobile</span>
                <span className="text-xs font-bold text-gray-900">{client.mobile}</span>
              </div>
            )}
            {client.karigarId && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Client ID</span>
                <span className="text-xs font-bold text-gray-900">{client.karigarId}</span>
              </div>
            )}
          </div>

          {/* Location Details */}
          {(client.address?.city || client.address?.state) && (
            <div className="bg-blue-50 rounded-2xl p-4 space-y-2 border border-blue-100">
              <h4 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Location</h4>
              {client.address?.locality && <p className="text-xs text-gray-700"><span className="font-semibold">Locality:</span> {client.address.locality}</p>}
              {client.address?.city && <p className="text-xs text-gray-700"><span className="font-semibold">City:</span> {client.address.city}</p>}
              {client.address?.state && <p className="text-xs text-gray-700"><span className="font-semibold">State:</span> {client.address.state}</p>}
            </div>
          )}

          {/* Job Statistics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-2xl p-3 text-center border border-green-100">
              <p className="text-lg font-black text-green-600">{client.totalPosted || 0}</p>
              <p className="text-[10px] text-green-800 font-semibold uppercase mt-1">Jobs Posted</p>
            </div>
            <div className="bg-blue-50 rounded-2xl p-3 text-center border border-blue-100">
              <p className="text-lg font-black text-blue-600">{client.totalCompleted || 0}</p>
              <p className="text-[10px] text-blue-800 font-semibold uppercase mt-1">Jobs Completed</p>
            </div>
          </div>

          {/* Rating */}
          {client.averageRating !== undefined && (
            <div className="bg-yellow-50 rounded-2xl p-4 text-center border border-yellow-100">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Star size={18} className="text-yellow-500 fill-yellow-500" />
                <p className="text-2xl font-black text-gray-900">{client.averageRating || 0}</p>
              </div>
              <p className="text-xs text-gray-600">Rating from {client.totalRatings || 0} reviews</p>
            </div>
          )}

          {/* Member Since */}
          {client.createdAt && (
            <div className="bg-gray-50 rounded-2xl p-3 text-center border border-gray-100">
              <p className="text-xs text-gray-600">Member since</p>
              <p className="text-sm font-bold text-gray-900 mt-1">{new Date(client.createdAt).toLocaleDateString()}</p>
            </div>
          )}

          {/* Call Button */}
          {client.mobile && (
            <a 
              href={`tel:${client.mobile}`}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-4 rounded-2xl font-black text-base hover:shadow-lg hover:shadow-orange-300 active:scale-95 transition-all"
            >
              <Phone size={18} /> Call {safeName.split(' ')[0]}
            </a>
          )}
        </div>
      </div>
    </div>
  );
});
ClientDetailModal.displayName = 'ClientDetailModal';

const WorkerDashboard = () => {
  const [profile, setProfile] = useState(null);
  const [analytics, setAnalytics] = useState({ completed: 0, pending: 0, running: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  
  const toast = useToast();

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    try {
      const [resAnalytic, resProfile] = await Promise.all([
        api.getWorkerAnalytics(),
        api.getWorkerProfile()
      ]);
      if (resAnalytic?.data) setAnalytics(resAnalytic.data.data || resAnalytic.data);
      if (resProfile?.data) setProfile(resProfile.data.data || resProfile.data);
    } catch (error) {
      console.error("Dashboard Load Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await api.searchClientForComplaint(searchQuery);
      const clients = response?.data?.data || response?.data || [];
      setSearchResults(Array.isArray(clients) ? clients : []);
      if (clients.length === 0) {
        toast.error('No clients found');
      }
    } catch (error) {
      console.error("Search Error:", error);
      toast.error('Failed to search clients');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const greet = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
  };

  return (
    <div
      className="bg-orange-50/30 min-h-screen p-3 pt-0 pb-32 lg:pb-10 lg:pt-0"
      style={{ fontFamily: 'Inter, sans-serif', fontSize: '2.13rem' }}
    >
      <ToastList toasts={toast.toasts} />
      
      {/* ── COMPACT STICKY HEADER ── */}
      <div className="flex items-center justify-between py-3 sticky top-0 bg-orange-50/90 backdrop-blur-md z-40 border-b border-orange-100" style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.13rem' }}>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-6 mt-4" style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.13rem' }}>
        {loading ? [1,2,3,4].map(i => <Skel key={i} h="h-24" />) : (
          <>
            <StatCard title="Points" value={profile?.points} icon={Star} grad="linear-gradient(135deg, #FFD700, #FFA500)" subtitle="Reputation" />
            <StatCard title="Done" value={analytics.completed} icon={CheckCircle} grad="linear-gradient(135deg, #10B981, #059669)" subtitle="Completed" />
            <StatCard title="Exp" value={profile?.experience} icon={Award} grad="linear-gradient(135deg, #8B5CF6, #7C3AED)" suffix=" Yrs" />
            <StatCard title="Applied" value={analytics.pending} icon={Briefcase} grad="linear-gradient(135deg, #3B82F6, #2563EB)" subtitle="Pending" />
          </>
        )}
      </div>

      {/* ANALYTICS SECTION WITH GRAPHS */}
      <div className="mb-6">
        <h2 className="text-sm font-black text-gray-900 uppercase mb-4 px-1">Dashboard Analytics</h2>
        <AnalyticsSection analytics={analytics} profile={profile} loading={loading} />
      </div>

      {/* SEARCH CLIENT SECTION */}
      <div className="mb-6">
        <h2 className="text-sm font-black text-gray-900 uppercase mb-4 px-1">Search Client</h2>
        
        {/* Search Input */}
        <div className="bg-white rounded-2xl border border-orange-100 shadow-sm mb-4 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Search size={18} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by name, mobile, or client ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 bg-transparent text-sm font-medium text-gray-900 placeholder-gray-400 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X size={16} className="text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Search Button */}
        <button
          onClick={handleSearch}
          disabled={!searchQuery.trim() || searchLoading}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 rounded-2xl font-black text-sm uppercase tracking-wide hover:shadow-lg hover:shadow-orange-300 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4"
        >
          {searchLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search size={16} />
              Search Clients
            </>
          )}
        </button>

        {/* Search Results */}
        {searchResults.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {searchResults.map(client => {
              const safeName = typeof client?.name === 'string' ? client.name : 'Client';
              const initials = safeName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
              const location = [client.address?.locality, client.address?.city].filter(Boolean).join(', ') || 'Unknown';

              return (
                <button
                  key={client._id}
                  onClick={() => setSelectedClient(client)}
                  className="bg-white rounded-2xl border border-orange-100 p-4 shadow-sm hover:shadow-md active:scale-95 transition-all text-left"
                >
                  <div className="flex gap-3 items-center mb-3">
                    <div className="w-12 h-12 rounded-xl bg-orange-100 flex-shrink-0 overflow-hidden">
                      {client.photo 
                        ? <img src={api.getImageUrl(client.photo)} className="w-full h-full object-cover" alt="" />
                        : <div className="w-full h-full flex items-center justify-center text-orange-500 font-bold text-sm">{initials}</div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 text-sm truncate">{safeName}</h4>
                      <p className="text-[10px] text-gray-500 flex items-center gap-1 truncate"><MapPin size={10}/>{location}</p>
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
                  <div className="flex items-center gap-2 text-[10px] text-gray-600 font-semibold">
                    <Eye size={12} /> View Details
                  </div>
                </button>
              );
            })}
          </div>
        ) : searchQuery && !searchLoading ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-orange-100">
            <UserCheck size={32} className="text-orange-200 mx-auto mb-2" />
            <p className="text-xs font-bold text-gray-400">No clients found. Try a different search.</p>
          </div>
        ) : null}
      </div>

      {/* CLIENT DETAIL MODAL */}
      <ClientDetailModal client={selectedClient} onClose={() => setSelectedClient(null)} />
    </div>
  );
};

// CRITICAL: Restore the missing default export
export default WorkerDashboard;