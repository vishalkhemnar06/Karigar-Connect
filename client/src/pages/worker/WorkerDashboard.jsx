// src/pages/worker/WorkerDashboard.jsx
import React, { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import * as api from '../../api';
import { AnimatePresence, motion } from 'framer-motion';
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
const MIN_SKILL_RATE = 100;

const DAILY_TRAVEL_OPTIONS = [
  { value: 'cycle', label: 'Cycle' },
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'bus', label: 'Bus' },
  { value: 'lift', label: 'Using Lift' },
  { value: 'other', label: 'Other' },
];

const DAILY_PAYMENT_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'online', label: 'Online' },
  { value: 'flexible', label: 'Flexible' },
];

const DAILY_PHONE_OPTIONS = [
  { value: 'Smartphone', label: 'Smartphone' },
  { value: 'Traditional old button phone', label: 'Traditional old button phone' },
  { value: 'No phone', label: 'No phone' },
];

const normalizeSkillName = (skill) => {
  if (!skill) return '';
  if (typeof skill === 'string') return skill.trim();
  return String(skill?.name || skill?.skill || '').trim();
};

const getRegisteredSkillNames = (profile = null) => {
  const seen = new Set();
  const rawSkills = Array.isArray(profile?.skills) ? profile.skills : [];
  const uniqueSkills = [];
  rawSkills.forEach((skill) => {
    const name = normalizeSkillName(skill);
    if (!name) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    uniqueSkills.push(name);
  });
  return uniqueSkills;
};

const coerceSkillRate = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return MIN_SKILL_RATE;
  return Math.max(MIN_SKILL_RATE, num);
};

const buildDailyProfileForm = (profile = null, dailyProfile = null) => {
  const registeredSkills = getRegisteredSkillNames(profile);
  const allowedSkills = new Set(registeredSkills.map((skill) => skill.toLowerCase()));
  const currentSkills = Array.isArray(dailyProfile?.skillRates) && dailyProfile.skillRates.length
    ? dailyProfile.skillRates
        .map((row) => ({
          skillName: normalizeSkillName(row?.skillName),
          preferenceRank: Number(row?.preferenceRank) || 1,
          hourlyPrice: coerceSkillRate(row?.hourlyPrice),
          dailyPrice: coerceSkillRate(row?.dailyPrice),
          visitPrice: coerceSkillRate(row?.visitPrice),
        }))
        .filter((row) => allowedSkills.has(row.skillName.toLowerCase()))
    : (Array.isArray(profile?.skills) ? profile.skills : []).map((skill, index) => ({
        skillName: normalizeSkillName(skill),
        preferenceRank: Math.min(3, index + 1),
        hourlyPrice: MIN_SKILL_RATE,
        dailyPrice: MIN_SKILL_RATE,
        visitPrice: MIN_SKILL_RATE,
      }));

  return {
    skillRates: currentSkills.length ? currentSkills : [],
    liveLocation: {
      latitude: dailyProfile?.liveLocation?.latitude ?? '',
      longitude: dailyProfile?.liveLocation?.longitude ?? '',
    },
    travelMethod: dailyProfile?.travelMethod || 'other',
    paymentMethod: dailyProfile?.paymentMethod || 'flexible',
    phoneType: dailyProfile?.phoneType || 'Smartphone',
  };
};

const dailyProfileIsComplete = (dailyProfile) => {
  if (!dailyProfile) return false;
  if (!dailyProfile.isComplete) return false;
  return Array.isArray(dailyProfile.skillRates) && dailyProfile.skillRates.length > 0;
};

const parseScheduledDateTime = (scheduledDate, scheduledTime) => {
  if (!scheduledDate) return null;
  const dt = new Date(scheduledDate);
  if (Number.isNaN(dt.getTime())) return null;

  let hours = 9;
  let minutes = 0;
  const raw = String(scheduledTime || '').trim();
  if (raw) {
    const m = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (m) {
      const h = Number(m[1]);
      const mm = Number(m[2] || '0');
      const meridiem = String(m[3] || '').toLowerCase();
      if (Number.isFinite(h) && Number.isFinite(mm)) {
        hours = h;
        minutes = mm;
        if (meridiem === 'pm' && hours < 12) hours += 12;
        if (meridiem === 'am' && hours === 12) hours = 0;
      }
    }
  }

  dt.setHours(hours, minutes, 0, 0);
  return dt.getTime();
};

const formatDurationHMS = (totalSeconds) => {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatDateTime = (ms) => {
  if (!Number.isFinite(ms)) return 'N/A';
  try {
    return new Date(ms).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'N/A';
  }
};

const getActiveTaskBlockFromBookings = (bookings = [], workerId = '') => {
  const wid = String(workerId || '');
  if (!wid || !Array.isArray(bookings)) return null;

  const activeStatuses = new Set(['filled', 'scheduled', 'running']);
  const candidates = [];
  const now = Date.now();
  const travelBufferHours = 2;

  bookings.forEach((job) => {
    const allSlots = Array.isArray(job?.mySlots) && job.mySlots.length
      ? job.mySlots
      : (job?.workerSlots || []).filter((slot) => {
          const assignedId = slot?.assignedWorker?._id?.toString() || slot?.assignedWorker?.toString() || '';
          return assignedId === wid;
        });

    allSlots.forEach((slot) => {
      if (!activeStatuses.has(String(slot?.status || '').toLowerCase())) return;

      const durationHours = Math.max(0, Number(slot?.hoursEstimated || 0));
      const startMs =
        (slot?.actualStartTime ? new Date(slot.actualStartTime).getTime() : null)
        || (job?.actualStartTime ? new Date(job.actualStartTime).getTime() : null)
        || parseScheduledDateTime(job?.scheduledDate, job?.scheduledTime)
        || (job?.createdAt ? new Date(job.createdAt).getTime() : null);

      const endMs = Number.isFinite(startMs) && durationHours > 0
        ? startMs + (durationHours + travelBufferHours) * 60 * 60 * 1000
        : null;

      const blocksNow = String(slot?.status || '').toLowerCase() === 'running'
        || (Number.isFinite(startMs) && Number.isFinite(endMs) && now >= startMs && now < endMs);
      if (!blocksNow) return;

      candidates.push({
        jobId: job?._id,
        jobTitle: job?.title || 'Current task',
        skill: slot?.skill || 'assigned skill',
        durationHours,
        endMs,
      });
    });
  });

  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    const aEnd = Number.isFinite(a.endMs) ? a.endMs : Number.MAX_SAFE_INTEGER;
    const bEnd = Number.isFinite(b.endMs) ? b.endMs : Number.MAX_SAFE_INTEGER;
    return aEnd - bEnd;
  });

  return candidates[0];
};

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
    return days.map((day) => ({
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
  const DASHBOARD_PROFILE_CACHE_KEY = 'workerDashboard.profile.v1';
  const DASHBOARD_ANALYTICS_CACHE_KEY = 'workerDashboard.analytics.v1';

  const [profile, setProfile] = useState(null);
  const [dailyProfile, setDailyProfile] = useState(null);
  const [dailyProfileForm, setDailyProfileForm] = useState(null);
  const [dailySkillToAdd, setDailySkillToAdd] = useState('');
  const [dailyProfileOpen, setDailyProfileOpen] = useState(false);
  const [dailyProfileSaving, setDailyProfileSaving] = useState(false);
  const [analytics, setAnalytics] = useState({ completed: 0, pending: 0, running: 0 });
  const [activeTaskBlock, setActiveTaskBlock] = useState(null);
  const [countdownNow, setCountdownNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const localUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);
  const workerId = localUser?._id || localUser?.id || null;
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [nearbyClients, setNearbyClients] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  const didInitialLoadRef = useRef(false);
  
  const toast = useToast();

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    setNearbyLoading(true);
    try {
      const [resAnalytic, resProfile, resBookings, resDailyProfile, resNearbyClients] = await Promise.all([
        api.getWorkerAnalytics(),
        api.getWorkerProfile(),
        api.getWorkerBookings(),
        api.getWorkerDailyProfile(),
        api.getNearClients(),
      ]);
      if (resAnalytic?.data) {
        const nextAnalytics = resAnalytic.data.data || resAnalytic.data;
        setAnalytics(nextAnalytics);
        sessionStorage.setItem(DASHBOARD_ANALYTICS_CACHE_KEY, JSON.stringify(nextAnalytics));
      }
      if (resProfile?.data) {
        const nextProfile = resProfile.data.data || resProfile.data;
        setProfile(nextProfile);
        sessionStorage.setItem(DASHBOARD_PROFILE_CACHE_KEY, JSON.stringify(nextProfile));
        const effectiveWorkerId = workerId || nextProfile?._id || nextProfile?.id || '';
        setActiveTaskBlock(getActiveTaskBlockFromBookings(resBookings?.data || [], effectiveWorkerId));
      }
      if (resDailyProfile?.data) {
        const nextDailyProfile = resDailyProfile.data.data || resDailyProfile.data;
        setDailyProfile(nextDailyProfile);
      } else if (resProfile?.data?.dailyProfile) {
        setDailyProfile(resProfile.data.dailyProfile);
      }
      const nearbyRows = resNearbyClients?.data?.data || resNearbyClients?.data || [];
      setNearbyClients(Array.isArray(nearbyRows) ? nearbyRows : []);
    } catch (error) {
      console.error("Dashboard Load Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setNearbyLoading(false);
    }
  }, [DASHBOARD_ANALYTICS_CACHE_KEY, DASHBOARD_PROFILE_CACHE_KEY]);

  const filteredNearbyClients = useMemo(() => {
    const source = Array.isArray(nearbyClients) ? nearbyClients : [];
    const q = String(searchQuery || '').trim().toLowerCase();
    if (!q) return source;
    return source.filter((client) => {
      const name = String(client?.name || '').toLowerCase();
      const mobile = String(client?.mobile || '').toLowerCase();
      const clientId = String(client?.karigarId || client?.userId || '').toLowerCase();
      const city = String(client?.address?.city || '').toLowerCase();
      const locality = String(client?.address?.locality || '').toLowerCase();
      return name.includes(q) || mobile.includes(q) || clientId.includes(q) || city.includes(q) || locality.includes(q);
    });
  }, [nearbyClients, searchQuery]);

  useEffect(() => {
    if (didInitialLoadRef.current) return;
    didInitialLoadRef.current = true;

    let hasCache = false;
    try {
      const cachedProfile = sessionStorage.getItem(DASHBOARD_PROFILE_CACHE_KEY);
      const cachedAnalytics = sessionStorage.getItem(DASHBOARD_ANALYTICS_CACHE_KEY);

      if (cachedProfile) {
        setProfile(JSON.parse(cachedProfile));
        hasCache = true;
      }
      if (cachedAnalytics) {
        setAnalytics(JSON.parse(cachedAnalytics));
        hasCache = true;
      }
    } catch {
      // Ignore cache parse errors and continue with live fetch.
    }

    if (hasCache) {
      setLoading(false);
      loadData(true);
      return;
    }

    loadData(false);
  }, [loadData, DASHBOARD_ANALYTICS_CACHE_KEY, DASHBOARD_PROFILE_CACHE_KEY]);

  useEffect(() => {
    if (!activeTaskBlock) return undefined;
    const timer = setInterval(() => setCountdownNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [activeTaskBlock]);

  const openDailyProfileModal = useCallback(() => {
    setDailyProfileForm(buildDailyProfileForm(profile, dailyProfile));
    setDailySkillToAdd('');
    setDailyProfileOpen(true);
  }, [profile, dailyProfile]);

  const closeDailyProfileModal = useCallback(() => {
    setDailyProfileOpen(false);
  }, []);

  const updateSkillRateRow = useCallback((index, field, value) => {
    setDailyProfileForm((prev) => {
      const current = prev || buildDailyProfileForm(profile, dailyProfile);
      const nextSkillRates = [...current.skillRates];
      const nextValue = field === 'hourlyPrice' || field === 'dailyPrice' || field === 'visitPrice'
        ? coerceSkillRate(value)
        : value;
      nextSkillRates[index] = { ...nextSkillRates[index], [field]: nextValue };
      return { ...current, skillRates: nextSkillRates };
    });
  }, [profile, dailyProfile]);

  const addSkillRow = useCallback(() => {
    if (!dailySkillToAdd) {
      toast.error('Select a registered skill to add.');
      return;
    }
    setDailyProfileForm((prev) => {
      const current = prev || buildDailyProfileForm(profile, dailyProfile);
      const exists = current.skillRates.some((row) => normalizeSkillName(row.skillName).toLowerCase() === dailySkillToAdd.toLowerCase());
      if (exists) return current;
      return {
        ...current,
        skillRates: [...current.skillRates, { skillName: dailySkillToAdd, preferenceRank: 1, hourlyPrice: MIN_SKILL_RATE, dailyPrice: MIN_SKILL_RATE, visitPrice: MIN_SKILL_RATE }],
      };
    });
    setDailySkillToAdd('');
  }, [profile, dailyProfile, dailySkillToAdd, toast]);

  const removeSkillRow = useCallback((index) => {
    setDailyProfileForm((prev) => {
      const current = prev || buildDailyProfileForm(profile, dailyProfile);
      const next = current.skillRates.filter((_, rowIndex) => rowIndex !== index);
      return { ...current, skillRates: next };
    });
  }, [profile, dailyProfile]);

  const captureLiveLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('Live location is not available in this browser.');
      return;
    }

    const loadingId = toast.loading('Fetching live location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDailyProfileForm((prev) => {
          const current = prev || buildDailyProfileForm(profile, dailyProfile);
          return {
            ...current,
            liveLocation: {
              latitude: Number(pos.coords.latitude).toFixed(6),
              longitude: Number(pos.coords.longitude).toFixed(6),
            },
          };
        });
        toast.update(loadingId, 'Live location captured.', 'success');
      },
      () => toast.update(loadingId, 'Unable to fetch live location.', 'error'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, [profile, dailyProfile, toast]);

  const handleDailyProfileSave = useCallback(async () => {
    if (!dailyProfileForm) return;
    const registeredSkillNames = getRegisteredSkillNames(profile);
    const allowedSkillSet = new Set(registeredSkillNames.map((skill) => skill.toLowerCase()));
    const normalizedSkillRates = (dailyProfileForm.skillRates || [])
      .map((row) => ({
        skillName: normalizeSkillName(row.skillName),
        preferenceRank: Number(row.preferenceRank) || 1,
        hourlyPrice: coerceSkillRate(row.hourlyPrice),
        dailyPrice: coerceSkillRate(row.dailyPrice),
        visitPrice: coerceSkillRate(row.visitPrice),
      }))
      .filter((row) => row.skillName);

    if (!normalizedSkillRates.length) {
      toast.error('Add at least one registered skill before saving.');
      return;
    }

    const hasNonRegisteredSkill = normalizedSkillRates.some((row) => !allowedSkillSet.has(row.skillName.toLowerCase()));
    if (hasNonRegisteredSkill) {
      toast.error('Only registration skills are allowed. Update your main profile to add more skills.');
      return;
    }

    const hasInvalidRate = normalizedSkillRates.some((row) => row.hourlyPrice < MIN_SKILL_RATE || row.dailyPrice < MIN_SKILL_RATE || row.visitPrice < MIN_SKILL_RATE);
    if (hasInvalidRate) {
      toast.error('Rate for each skill must be at least 100 for /hour, /day, and /visit.');
      return;
    }

    try {
      setDailyProfileSaving(true);
      const payload = {
        skillRates: normalizedSkillRates,
        liveLocation: {
          latitude: Number(dailyProfileForm.liveLocation?.latitude || 0) || null,
          longitude: Number(dailyProfileForm.liveLocation?.longitude || 0) || null,
          source: 'browser',
        },
        travelMethod: dailyProfileForm.travelMethod,
        paymentMethod: dailyProfileForm.paymentMethod,
        phoneType: dailyProfileForm.phoneType,
      };

      const response = await api.updateWorkerDailyProfile(payload);
      const nextDailyProfile = response?.data?.data || response?.data || null;
      setDailyProfile(nextDailyProfile);
      setDailyProfileForm(buildDailyProfileForm(profile, nextDailyProfile));
      setDailyProfileOpen(false);
      toast.success('Daily details saved.');
      loadData(true);
    } catch (error) {
      console.error('Daily profile save error:', error);
      toast.error(error?.response?.data?.message || 'Failed to save daily details.');
    } finally {
      setDailyProfileSaving(false);
    }
  }, [dailyProfileForm, profile, loadData, toast]);

  const remainingSeconds = Number.isFinite(activeTaskBlock?.endMs)
    ? Math.max(0, Math.floor((activeTaskBlock.endMs - countdownNow) / 1000))
    : null;
  const missingDailyFields = Array.isArray(dailyProfile?.missingFields) ? dailyProfile.missingFields : [];
  const showDailyNotice = !dailyProfileIsComplete(dailyProfile);
  const currentDailyForm = dailyProfileForm || buildDailyProfileForm(profile, dailyProfile);
  const registeredSkillNames = getRegisteredSkillNames(profile);
  const selectedSkillKeys = new Set((currentDailyForm.skillRates || []).map((row) => normalizeSkillName(row.skillName).toLowerCase()).filter(Boolean));
  const availableSkillsToAdd = registeredSkillNames.filter((skill) => !selectedSkillKeys.has(skill.toLowerCase()));

  const greet = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
  };

  return (
    <>
      <AnimatePresence>
        {dailyProfileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
            onClick={closeDailyProfileModal}
          >
            <motion.div
              initial={{ y: 30, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 sm:p-5 border-b border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black text-orange-600 uppercase tracking-[0.2em]">Daily Details</p>
                  <h3 className="text-lg font-black text-gray-900">Fill work location and global price rows</h3>
                  <p className="text-xs text-gray-600 mt-1">This data is used to block applications until your profile is complete and to show clients your public work details.</p>
                </div>
                <button
                  type="button"
                  onClick={closeDailyProfileModal}
                  className="p-2 rounded-xl bg-white border border-orange-100 text-gray-500"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-3 bg-orange-50 rounded-2xl p-3 flex items-center justify-between gap-3 border border-orange-100">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-orange-500">Live Location</p>
                      <p className="text-xs text-gray-600">Use the current GPS location for client visibility.</p>
                    </div>
                    <button
                      type="button"
                      onClick={captureLiveLocation}
                      className="px-3 py-2 rounded-xl bg-orange-600 text-white text-xs font-black uppercase tracking-wide"
                    >
                      Fetch Live Location
                    </button>
                  </div>

                  <label className="text-xs font-bold text-gray-600">
                    Latitude
                    <input
                      type="number"
                      value={currentDailyForm.liveLocation.latitude}
                      onChange={(e) => setDailyProfileForm((prev) => ({ ...(prev || currentDailyForm), liveLocation: { ...(prev || currentDailyForm).liveLocation, latitude: e.target.value } }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                      placeholder="Lat"
                    />
                  </label>
                  <label className="text-xs font-bold text-gray-600">
                    Longitude
                    <input
                      type="number"
                      value={currentDailyForm.liveLocation.longitude}
                      onChange={(e) => setDailyProfileForm((prev) => ({ ...(prev || currentDailyForm), liveLocation: { ...(prev || currentDailyForm).liveLocation, longitude: e.target.value } }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                      placeholder="Lng"
                    />
                  </label>
                  <label className="text-xs font-bold text-gray-600">
                    Live Location Status
                    <div className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-gray-50 text-gray-600">
                      {currentDailyForm.liveLocation.latitude && currentDailyForm.liveLocation.longitude ? 'Captured' : 'Not captured yet'}
                    </div>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="text-xs font-bold text-gray-600">
                    Current travel method
                    <select
                      value={currentDailyForm.travelMethod}
                      onChange={(e) => setDailyProfileForm((prev) => ({ ...(prev || currentDailyForm), travelMethod: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
                    >
                      {DAILY_TRAVEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-bold text-gray-600">
                    Payment method
                    <select
                      value={currentDailyForm.paymentMethod}
                      onChange={(e) => setDailyProfileForm((prev) => ({ ...(prev || currentDailyForm), paymentMethod: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
                    >
                      {DAILY_PAYMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-bold text-gray-600">
                    Phone type
                    <select
                      value={currentDailyForm.phoneType}
                      onChange={(e) => setDailyProfileForm((prev) => ({ ...(prev || currentDailyForm), phoneType: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
                    >
                      {DAILY_PHONE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Skill pricing</p>
                    <p className="text-xs text-gray-500">Only registration skills can be added here. To add new skills, update your main profile. Minimum rate is 100.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={dailySkillToAdd}
                      onChange={(e) => setDailySkillToAdd(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-orange-200 text-xs font-bold bg-white min-w-[180px]"
                    >
                      <option value="">Select skill</option>
                      {availableSkillsToAdd.map((skill) => (
                        <option key={skill} value={skill}>{skill}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={addSkillRow}
                      disabled={!dailySkillToAdd || availableSkillsToAdd.length === 0}
                      className="px-3 py-2 rounded-xl border border-orange-200 text-orange-700 text-xs font-black uppercase tracking-wide disabled:opacity-50"
                    >
                      Add Skill
                    </button>
                  </div>
                </div>
                {registeredSkillNames.length === 0 && (
                  <p className="text-xs text-rose-600">No registration skills found. Please update your main profile first.</p>
                )}
                {registeredSkillNames.length > 0 && availableSkillsToAdd.length === 0 && (
                  <p className="text-xs text-gray-500">All registration skills are already added.</p>
                )}

                <div className="space-y-3">
                  {currentDailyForm.skillRates.map((row, index) => (
                    <div key={`${row.skillName || 'skill'}-${index}`} className="rounded-2xl border border-gray-200 p-3 bg-white shadow-sm">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        <label className="text-xs font-bold text-gray-600 md:col-span-2">
                          Skill
                          <select
                            value={row.skillName}
                            onChange={(e) => updateSkillRateRow(index, 'skillName', e.target.value)}
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
                          >
                            <option value="">Select skill</option>
                            {registeredSkillNames
                              .filter((skill) => {
                                if (skill.toLowerCase() === normalizeSkillName(row.skillName).toLowerCase()) return true;
                                return !(currentDailyForm.skillRates || []).some((item, itemIndex) => itemIndex !== index && normalizeSkillName(item.skillName).toLowerCase() === skill.toLowerCase());
                              })
                              .map((skill) => <option key={skill} value={skill}>{skill}</option>)}
                          </select>
                        </label>
                        <label className="text-xs font-bold text-gray-600">
                          Preference
                          <select
                            value={row.preferenceRank}
                            onChange={(e) => updateSkillRateRow(index, 'preferenceRank', e.target.value)}
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
                          >
                            {[1, 2, 3].map((value) => <option key={value} value={value}>{value}</option>)}
                          </select>
                        </label>
                        <label className="text-xs font-bold text-gray-600">
                          /hour
                          <input
                            type="number"
                            value={row.hourlyPrice}
                            onChange={(e) => updateSkillRateRow(index, 'hourlyPrice', e.target.value)}
                            min={MIN_SKILL_RATE}
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                            placeholder="100"
                          />
                        </label>
                        <label className="text-xs font-bold text-gray-600">
                          /day
                          <input
                            type="number"
                            value={row.dailyPrice}
                            onChange={(e) => updateSkillRateRow(index, 'dailyPrice', e.target.value)}
                            min={MIN_SKILL_RATE}
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                            placeholder="100"
                          />
                        </label>
                        <label className="text-xs font-bold text-gray-600">
                          /visit
                          <input
                            type="number"
                            value={row.visitPrice}
                            onChange={(e) => updateSkillRateRow(index, 'visitPrice', e.target.value)}
                            min={MIN_SKILL_RATE}
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                            placeholder="100"
                          />
                        </label>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeSkillRow(index)}
                          className="text-xs font-black uppercase tracking-wide text-rose-600"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-orange-100 bg-white flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeDailyProfileModal}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-xs font-black uppercase tracking-wide"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDailyProfileSave}
                  disabled={dailyProfileSaving}
                  className="px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-black uppercase tracking-wide disabled:opacity-60"
                >
                  {dailyProfileSaving ? 'Saving...' : 'Save Daily Details'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    <div
      className="bg-orange-50/30 min-h-screen p-3 pt-0 pb-32 lg:pb-10 lg:pt-0"
      style={{ fontFamily: 'Inter, sans-serif', fontSize: '2.13rem' }}
    >
      <ToastList toasts={toast.toasts} />
      
      {/* ── COMPACT STICKY HEADER ── */}
      <div data-guide-id="worker-page-dashboard" className="flex items-center justify-between py-3 sticky top-0 bg-orange-50/90 backdrop-blur-md z-40 border-b border-orange-100" style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.13rem' }}>
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
               <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">ID: {profile?.userId || profile?.karigarId || '...'}</span>
               <span className="text-[9px] text-gray-500 font-bold uppercase tracking-tight">{profile?.address?.city || 'Local'}</span>
            </div>
          </div>
        </div>
        <button onClick={() => loadData(true)} className="p-2.5 bg-white rounded-xl border border-orange-100 shadow-sm active:scale-90 transition-all">
          <RefreshCw size={18} className={`text-orange-500 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ACTIVE TASK BANNER */}
      {activeTaskBlock && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-3 mb-4 shadow-sm mt-2">
          <div className="flex items-start gap-3">
            <Clock4 className="text-amber-500 animate-pulse flex-shrink-0" size={18} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-amber-800 uppercase tracking-wider">Apply blocked until client marks task Done</p>
              <p className="text-[10px] text-amber-700 mt-1 truncate">Active task: {activeTaskBlock.skill} in {activeTaskBlock.jobTitle}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-lg text-[10px] font-black tracking-wide">
                  {remainingSeconds === null ? 'Countdown: --:--:--' : `Countdown: ${formatDurationHMS(remainingSeconds)}`}
                </span>
                <span className="text-[10px] text-amber-700">Duration: {Math.max(0, Number(activeTaskBlock.durationHours || 0))}h</span>
                <span className="text-[10px] text-amber-700">Expected end: {formatDateTime(activeTaskBlock.endMs)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDailyNotice && (
        <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-4 mb-4 shadow-sm mt-2">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-rose-500 flex-shrink-0" size={18} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-rose-800 uppercase tracking-wider">Daily details required before applying</p>
              <p className="text-xs text-rose-700 mt-1">
                Please fill your live location, skill pricing, travel method, payment method, and phone type.
              </p>
              {missingDailyFields.length > 0 && (
                <p className="text-[10px] text-rose-600 mt-1">
                  Missing: {missingDailyFields.join(', ')}
                </p>
              )}
              <button
                type="button"
                onClick={openDailyProfileModal}
                className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-black uppercase tracking-wide"
              >
                Fill Daily Details
              </button>
            </div>
          </div>
        </div>
      )}

      {!showDailyNotice && dailyProfile?.liveLocation?.latitude && dailyProfile?.liveLocation?.longitude && (
        <div className="bg-white border border-orange-100 rounded-2xl p-3 mb-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-orange-500">Daily details saved</p>
              <p className="text-xs text-gray-600 mt-1">Live location and skill pricing are ready for client visibility.</p>
            </div>
            <button
              type="button"
              onClick={openDailyProfileModal}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-orange-200 text-orange-700 text-xs font-black uppercase tracking-wide"
            >
              Edit Details
            </button>
          </div>
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
        <h2 className="text-sm font-black text-gray-900 uppercase mb-1 px-1">Nearby Clients</h2>
        <p className="text-xs text-gray-500 mb-4 px-1">Auto-listed by city/locality and within 5 km radius.</p>
        
        {/* Search Input */}
        <div className="bg-white rounded-2xl border border-orange-100 shadow-sm mb-4 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Search size={18} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Filter nearby clients by name, mobile, ID, city, or locality..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm font-medium text-gray-900 placeholder-gray-400 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                }}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X size={16} className="text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Search Results */}
        {nearbyLoading ? (
          <div className="bg-white rounded-2xl border border-orange-100 p-4 text-sm text-gray-500 flex items-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Loading nearby clients...
          </div>
        ) : filteredNearbyClients.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredNearbyClients.map(client => {
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
                  {Number.isFinite(Number(client?.distanceKm)) && (
                    <div className="mt-2 text-[10px] text-emerald-700 font-bold">Distance: {Number(client.distanceKm).toFixed(2)} km</div>
                  )}
                </button>
              );
            })}
          </div>
        ) : searchQuery ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-orange-100">
            <UserCheck size={32} className="text-orange-200 mx-auto mb-2" />
            <p className="text-xs font-bold text-gray-400">No nearby clients matched your filter.</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-10 text-center border border-orange-100">
            <UserCheck size={32} className="text-orange-200 mx-auto mb-2" />
            <p className="text-xs font-bold text-gray-400">No nearby clients found within 5 km.</p>
          </div>
        )}
      </div>

      {/* CLIENT DETAIL MODAL */}
      <ClientDetailModal client={selectedClient} onClose={() => setSelectedClient(null)} />
    </div>
    </>
  );
};

// CRITICAL: Restore the missing default export
export default WorkerDashboard;