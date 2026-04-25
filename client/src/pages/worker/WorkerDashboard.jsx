// src/pages/worker/WorkerDashboard.jsx
// PREMIUM DASHBOARD - Modern design with glassmorphism, animations, and enhanced UX

import React, { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import * as api from '../../api';
import { AnimatePresence, motion } from 'framer-motion';
import {
  MapPin, Briefcase, CheckCircle, Clock4, AlertTriangle, Star,
  RefreshCw, Shield, Phone, Award, UserCheck, TrendingUp, Activity,
  Zap, Target, ArrowUp, ArrowDown, BarChart3, PieChart, Calendar,
  Eye, X, Search, Loader2, Wallet, Crown, Diamond, Sparkles,
  Home, Building2, User, Verified, Clock, Calendar as CalendarIcon,
  Trophy, Flame, Gift, Heart, Smile, ThumbsUp, Users, FileText
} from 'lucide-react';

// ── Toast System ──
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
  <AnimatePresence>
    {toasts.map(t => (
      <motion.div
        key={t.id}
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 100 }}
        className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-xs text-white shadow-xl ${
          t.type === 'error' ? 'bg-gradient-to-r from-red-500 to-rose-500' : 
          t.type === 'loading' ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 
          'bg-gradient-to-r from-emerald-500 to-green-500'
        }`}
      >
        {t.type === 'loading' && <Loader2 size={12} className="animate-spin" />}
        {t.type === 'success' && <CheckCircle size={12} />}
        {t.type === 'error' && <AlertTriangle size={12} />}
        {t.msg}
      </motion.div>
    ))}
  </AnimatePresence>
);

// ── Constants ──
const safeNum = v => (v === null || v === undefined ? 0 : Number(v));
const MIN_SKILL_RATE = 100;

const DAILY_TRAVEL_OPTIONS = [
  { value: 'cycle', label: '🚲 Cycle' },
  { value: 'motorcycle', label: '🏍️ Motorcycle' },
  { value: 'bus', label: '🚌 Bus' },
  { value: 'lift', label: '🚗 Using Lift' },
  { value: 'other', label: '🚶 Other' },
];

const DAILY_PAYMENT_OPTIONS = [
  { value: 'cash', label: '💵 Cash' },
  { value: 'online', label: '📱 Online' },
  { value: 'flexible', label: '🔄 Flexible' },
];

const DAILY_PHONE_OPTIONS = [
  { value: 'Smartphone', label: '📱 Smartphone' },
  { value: 'Traditional old button phone', label: '📞 Button Phone' },
  { value: 'No phone', label: '❌ No phone' },
];

// ── Helper Functions ──
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
  let hours = 9, minutes = 0;
  const raw = String(scheduledTime || '').trim();
  if (raw) {
    const m = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (m) {
      let h = Number(m[1]);
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
      const startMs = (slot?.actualStartTime ? new Date(slot.actualStartTime).getTime() : null)
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

// ── UI Components ──
const StatCard = ({ title, value, subtitle, icon: Icon, gradient, prefix = '', suffix = '', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    whileHover={{ y: -4 }}
    className="bg-white rounded-xl p-4 border border-gray-100 shadow-md hover:shadow-lg transition-all"
  >
    <div className="flex items-center justify-between mb-2">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md`}>
        <Icon size="18" className="text-white" />
      </div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{title}</p>
    </div>
    <p className="text-2xl font-black text-gray-800 leading-none">
      {prefix}{safeNum(value).toLocaleString('en-IN')}{suffix}
    </p>
    {subtitle && <p className="text-[10px] text-gray-400 mt-1 font-medium">{subtitle}</p>}
  </motion.div>
);

// ── Bar Chart Component ──
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
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1 group">
          <div className="relative w-full flex items-end justify-center" style={{ height: height - 20 }}>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: animate ? `${(d.value / max) * 100}%` : '0%' }}
              transition={{ duration: 0.8, delay: i * 0.05 }}
              className={`w-full rounded-lg bg-${color}-400 group-hover:bg-${color}-500 transition-all cursor-pointer shadow-sm`}
              style={{ minHeight: animate && d.value ? 4 : 0 }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
          <span className="text-[8px] text-gray-400 truncate w-full text-center font-medium">{d.label}</span>
        </div>
      ))}
    </div>
  );
});
BarChart.displayName = 'BarChart';

// ── Donut Chart Component ──
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

// ── Analytics Section ──
const AnalyticsSection = memo(({ analytics, profile, loading }) => {
  const jobsTrendData = useMemo(() => {
    const rows = Array.isArray(analytics?.weeklyCompleted) ? analytics.weeklyCompleted : [];
    return rows
      .map((row) => ({
        label: String(row?.label || '').slice(0, 3) || 'Day',
        value: Math.max(0, Number(row?.value) || 0),
      }));
  }, [analytics?.weeklyCompleted]);

  const citySkillRates = useMemo(() => {
    const rows = Array.isArray(analytics?.citySkillRates) ? analytics.citySkillRates : [];
    return rows.filter((row) => row?.skill);
  }, [analytics?.citySkillRates]);

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
        {[1, 2, 3].map(i => <Skel key={i} h="h-32" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-md">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
            <PieChart size="14" className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm">Job Distribution</h3>
            <p className="text-[10px] text-gray-400">Current status breakdown</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-6">
          <DonutChart
            segments={donutSegments}
            size={110}
            thickness={18}
            centerText={
              <>
                <p className="text-xl font-black text-gray-800">{(analytics.completed || 0) + (analytics.running || 0)}</p>
                <p className="text-[8px] text-gray-400">Active</p>
              </>
            }
          />
          <div className="space-y-2 flex-1">
            {[
              { label: 'Completed', value: analytics.completed || 0, color: '#10b981', icon: CheckCircle },
              { label: 'Running', value: analytics.running || 0, color: '#f59e0b', icon: Activity },
              { label: 'Pending', value: analytics.pending || 0, color: '#3b82f6', icon: Clock4 },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] text-gray-600 font-medium flex-1">{item.label}</span>
                <span className="font-bold text-gray-800 text-sm">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {jobsTrendData.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <TrendingUp size="14" className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-sm">Weekly Activity</h3>
                <p className="text-[10px] text-gray-400">Jobs completed per day</p>
              </div>
            </div>
          </div>
          <BarChart data={jobsTrendData} color="orange" height={110} animated />
        </div>
      )}

      {citySkillRates.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                <Wallet size="14" className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-sm">Current Skill Base Rates</h3>
                <p className="text-[10px] text-gray-400">
                  {analytics?.workerCity ? `${analytics.workerCity} market snapshot` : 'City market snapshot'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {citySkillRates.map((rateRow) => (
              <div key={rateRow.skillKey || rateRow.skill} className="rounded-xl border border-gray-100 px-3 py-2 bg-gray-50/70">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-gray-800">{rateRow.skill}</p>
                  <p className="text-[10px] text-gray-500">{rateRow.currency || 'INR'}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded-lg bg-white px-2 py-1 border border-gray-100">
                    <p className="text-[9px] text-gray-500">Hour</p>
                    <p className="font-bold text-gray-800">₹{safeNum(rateRow.hourRate)}</p>
                  </div>
                  <div className="rounded-lg bg-white px-2 py-1 border border-gray-100">
                    <p className="text-[9px] text-gray-500">Day</p>
                    <p className="font-bold text-gray-800">₹{safeNum(rateRow.dayRate)}</p>
                  </div>
                  <div className="rounded-lg bg-white px-2 py-1 border border-gray-100">
                    <p className="text-[9px] text-gray-500">Visit</p>
                    <p className="font-bold text-gray-800">₹{safeNum(rateRow.visitRate)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
          <div className="flex items-center gap-2 mb-2">
            <Target size="14" className="text-purple-600" />
            <p className="text-[10px] font-bold text-purple-700 uppercase tracking-tight">Completion Rate</p>
          </div>
          <p className="text-3xl font-black text-purple-800 mb-2">{completionRate}%</p>
          <div className="h-1.5 bg-purple-200 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${completionRate}%` }}
              transition={{ duration: 1 }}
              className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full"
            />
          </div>
          <p className="text-[9px] text-purple-600 mt-2 font-medium">Of applied jobs</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl p-4 border border-yellow-200">
          <div className="flex items-center gap-2 mb-2">
            <Star size="14" className="text-yellow-600 fill-yellow-600" />
            <p className="text-[10px] font-bold text-yellow-700 uppercase tracking-tight">Rating</p>
          </div>
          <p className="text-3xl font-black text-yellow-800 mb-2">{avgRating}/5</p>
          <div className="h-1.5 bg-yellow-200 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${ratingPercent}%` }}
              transition={{ duration: 1 }}
              className="h-full bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full"
            />
          </div>
          <p className="text-[9px] text-yellow-600 mt-2 font-medium">From {profile?.totalRatings || 0} reviews</p>
        </div>
      </div>
    </div>
  );
});
AnalyticsSection.displayName = 'AnalyticsSection';

// ── Client Detail Modal ──
const ClientDetailModal = memo(({ client, onClose }) => {
  if (!client) return null;
  const safeName = typeof client?.name === 'string' ? client.name : 'Client';
  const initials = safeName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const location = [client.address?.locality, client.address?.city, client.address?.state].filter(Boolean).join(', ') || 'Unknown';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-4 sticky top-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User size="18" className="text-white" />
              <h2 className="font-bold text-white text-base">Client Details</h2>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-all">
              <X size="18" className="text-white" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div className="text-center">
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center mx-auto mb-3 overflow-hidden shadow-md">
                {client.photo 
                  ? <img src={api.getImageUrl(client.photo)} className="w-full h-full object-cover" alt="" />
                  : <div className="w-full h-full flex items-center justify-center text-orange-500 font-bold text-2xl">{initials}</div>
                }
              </div>
              <h3 className="font-bold text-gray-800 text-lg mb-1">{safeName}</h3>
              <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
                <MapPin size="12" /> {location}
              </p>
            </div>

            <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 space-y-3 border border-orange-100">
              <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wide flex items-center gap-1">
                <Phone size="12" /> Contact Info
              </h4>
              {client.email && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Email</span>
                  <span className="text-xs font-semibold text-gray-800 break-all text-right">{client.email}</span>
                </div>
              )}
              {client.mobile && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Mobile</span>
                  <span className="text-xs font-bold text-gray-800">{client.mobile}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                <p className="text-lg font-bold text-emerald-700">{client.totalPosted || 0}</p>
                <p className="text-[10px] text-emerald-800 font-semibold uppercase">Jobs Posted</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                <p className="text-lg font-bold text-blue-700">{client.totalCompleted || 0}</p>
                <p className="text-[10px] text-blue-800 font-semibold uppercase">Jobs Done</p>
              </div>
            </div>

            {client.averageRating !== undefined && (
              <div className="bg-yellow-50 rounded-xl p-4 text-center border border-yellow-100">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Star size="16" className="text-yellow-500 fill-yellow-500" />
                  <p className="text-xl font-bold text-gray-800">{client.averageRating || 0}</p>
                </div>
                <p className="text-[10px] text-gray-600">From {client.totalRatings || 0} reviews</p>
              </div>
            )}

            {client.mobile && (
              <a 
                href={`tel:${client.mobile}`}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 rounded-xl font-bold text-sm hover:shadow-lg transition-all"
              >
                <Phone size="14" /> Call {safeName.split(' ')[0]}
              </a>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});
ClientDetailModal.displayName = 'ClientDetailModal';

// ── Loading Skeleton ──
const Skel = ({ h = 'h-24', r = 'rounded-xl' }) => (
  <div className={`${h} ${r} bg-gradient-to-r from-orange-50 via-orange-100 to-orange-50 animate-pulse`} />
);

const DailyProfileModal = ({
  profile,
  dailyProfileForm,
  setDailyProfileForm,
  dailySkillToAdd,
  setDailySkillToAdd,
  dailyProfileSaving,
  onSave,
  onClose,
  onAddSkill,
  onRemoveSkill,
  onUpdateSkill,
  onCaptureLocation,
  registeredSkillNames,
  availableSkillsToAdd,
}) => {
  if (!dailyProfileForm) return null;

  const blockNegativeInput = (event) => {
    if (['-', '+', 'e', 'E'].includes(event.key)) {
      event.preventDefault();
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm p-4 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-orange-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-4 text-white rounded-t-2xl flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black">Fill Daily Details</h3>
            <p className="text-xs text-orange-100">Required before applying to nearby jobs</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-white/20 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSave} className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700">Latitude</label>
              <input
                type="number"
                step="any"
                value={dailyProfileForm?.liveLocation?.latitude ?? ''}
                onChange={(e) => setDailyProfileForm((prev) => ({
                  ...prev,
                  liveLocation: {
                    ...(prev?.liveLocation || {}),
                    latitude: e.target.value,
                  },
                }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                placeholder="18.5204"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700">Longitude</label>
              <input
                type="number"
                step="any"
                value={dailyProfileForm?.liveLocation?.longitude ?? ''}
                onChange={(e) => setDailyProfileForm((prev) => ({
                  ...prev,
                  liveLocation: {
                    ...(prev?.liveLocation || {}),
                    longitude: e.target.value,
                  },
                }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                placeholder="73.8567"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={onCaptureLocation}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-sm font-semibold hover:bg-blue-100 transition-colors"
          >
            <MapPin size={14} /> Use Current Location
          </button>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700">Travel Method</label>
              <select
                value={dailyProfileForm?.travelMethod || 'other'}
                onChange={(e) => setDailyProfileForm((prev) => ({ ...prev, travelMethod: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              >
                {DAILY_TRAVEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700">Payment Method</label>
              <select
                value={dailyProfileForm?.paymentMethod || 'flexible'}
                onChange={(e) => setDailyProfileForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              >
                {DAILY_PAYMENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700">Phone Type</label>
              <select
                value={dailyProfileForm?.phoneType || 'Smartphone'}
                onChange={(e) => setDailyProfileForm((prev) => ({ ...prev, phoneType: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              >
                {DAILY_PHONE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-black text-gray-800">Skill Pricing</h4>
              <div className="flex items-center gap-2">
                <select
                  value={dailySkillToAdd}
                  onChange={(e) => setDailySkillToAdd(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-2 text-xs"
                >
                  <option value="">Select skill</option>
                  {availableSkillsToAdd.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={onAddSkill}
                  disabled={!dailySkillToAdd}
                  className="px-3 py-2 rounded-lg bg-orange-500 text-white text-xs font-bold disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="hidden md:grid grid-cols-12 gap-2 px-1 pb-1 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                <div className="col-span-3">Skill</div>
                <div className="col-span-2">Preference</div>
                <div className="col-span-2">Hour</div>
                <div className="col-span-2">Day</div>
                <div className="col-span-2">Visit</div>
                <div className="col-span-1 text-right">Remove</div>
              </div>
              {(dailyProfileForm?.skillRates || []).map((row, idx) => (
                <div key={`${row.skillName}-${idx}`} className="grid grid-cols-12 gap-2 items-center border border-gray-100 rounded-xl p-2.5 bg-gray-50">
                  <div className="col-span-12 md:col-span-3 text-sm font-semibold text-gray-800">
                    {row.skillName}
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <input
                      type="number"
                      min="1"
                      value={row.preferenceRank ?? ''}
                      onKeyDown={blockNegativeInput}
                      onChange={(e) => onUpdateSkill(idx, 'preferenceRank', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                      placeholder="Preference"
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <input
                      type="number"
                      min="100"
                      value={row.hourlyPrice ?? ''}
                      onKeyDown={blockNegativeInput}
                      onChange={(e) => onUpdateSkill(idx, 'hourlyPrice', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                      placeholder="Hour"
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <input
                      type="number"
                      min="100"
                      value={row.dailyPrice ?? ''}
                      onKeyDown={blockNegativeInput}
                      onChange={(e) => onUpdateSkill(idx, 'dailyPrice', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                      placeholder="Day"
                    />
                  </div>
                  <div className="col-span-8 md:col-span-2">
                    <input
                      type="number"
                      min="100"
                      value={row.visitPrice ?? ''}
                      onKeyDown={blockNegativeInput}
                      onChange={(e) => onUpdateSkill(idx, 'visitPrice', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                      placeholder="Visit"
                    />
                  </div>
                  <div className="col-span-4 md:col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => onRemoveSkill(idx)}
                      className="p-2 rounded-lg text-red-500 hover:bg-red-50"
                      disabled={(dailyProfileForm?.skillRates || []).length <= 1}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-gray-500">
              Registered skills: {registeredSkillNames.length ? registeredSkillNames.join(', ') : 'No skills in profile'}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700">Cancel</button>
            <button
              type="submit"
              disabled={dailyProfileSaving}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-bold disabled:opacity-60"
            >
              {dailyProfileSaving ? 'Saving...' : 'Save Daily Details'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

// ── Main Dashboard Component ──
const WorkerDashboard = () => {
  const DASHBOARD_PROFILE_CACHE_KEY = 'workerDashboard.profile.v1';
  const DASHBOARD_ANALYTICS_CACHE_KEY = 'workerDashboard.analytics.v1';

  const [profile, setProfile] = useState(null);
  const [dailyProfile, setDailyProfile] = useState(null);
  const [dailyProfileForm, setDailyProfileForm] = useState(null);
  const [dailySkillToAdd, setDailySkillToAdd] = useState('');
  const [dailyProfileOpen, setDailyProfileOpen] = useState(false);
  const [dailyProfileSaving, setDailyProfileSaving] = useState(false);
  const [analytics, setAnalytics] = useState({
    completed: 0,
    pending: 0,
    running: 0,
    weeklyCompleted: [],
    citySkillRates: [],
    workerCity: '',
  });
  const [activeTaskBlock, setActiveTaskBlock] = useState(null);
  const [countdownNow, setCountdownNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [nearbyClients, setNearbyClients] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  const localUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  }, []);
  const workerId = localUser?._id || localUser?.id || null;
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
      if (cachedProfile) { setProfile(JSON.parse(cachedProfile)); hasCache = true; }
      if (cachedAnalytics) { setAnalytics(JSON.parse(cachedAnalytics)); hasCache = true; }
    } catch { /* ignore */ }
    if (hasCache) { setLoading(false); loadData(true); return; }
    loadData(false);
  }, [loadData]);

  useEffect(() => {
    if (!activeTaskBlock) return undefined;
    const timer = setInterval(() => setCountdownNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [activeTaskBlock]);

  const greet = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
  };

  useEffect(() => {
    if (!profile) return;
    setDailyProfileForm(buildDailyProfileForm(profile, dailyProfile));
  }, [profile, dailyProfile]);

  const availableSkillsToAdd = useMemo(() => {
    const selected = new Set((dailyProfileForm?.skillRates || []).map((row) => String(row?.skillName || '').toLowerCase()));
    return getRegisteredSkillNames(profile).filter((name) => !selected.has(String(name).toLowerCase()));
  }, [profile, dailyProfileForm]);

  const updateSkillRateRow = useCallback((index, field, value) => {
    setDailyProfileForm((prev) => {
      if (!prev) return prev;
      const nextRows = [...(prev.skillRates || [])];
      if (!nextRows[index]) return prev;
      const raw = String(value ?? '');
      let nextValue = raw;
      if (raw !== '') {
        if (field === 'preferenceRank') {
          nextValue = Math.max(1, Number(raw) || 1);
        } else {
          const parsed = Number(raw);
          nextValue = Number.isFinite(parsed) ? parsed : '';
        }
      }
      nextRows[index] = { ...nextRows[index], [field]: nextValue };
      return { ...prev, skillRates: nextRows };
    });
  }, []);

  const removeSkillRow = useCallback((index) => {
    setDailyProfileForm((prev) => {
      if (!prev) return prev;
      const rows = [...(prev.skillRates || [])];
      if (rows.length <= 1) return prev;
      rows.splice(index, 1);
      return { ...prev, skillRates: rows };
    });
  }, []);

  const addSkillRow = useCallback(() => {
    const nextSkill = String(dailySkillToAdd || '').trim();
    if (!nextSkill) return;
    setDailyProfileForm((prev) => {
      if (!prev) return prev;
      const exists = (prev.skillRates || []).some((row) => String(row?.skillName || '').toLowerCase() === nextSkill.toLowerCase());
      if (exists) return prev;
      return {
        ...prev,
        skillRates: [
          ...(prev.skillRates || []),
          { skillName: nextSkill, preferenceRank: 1, hourlyPrice: MIN_SKILL_RATE, dailyPrice: MIN_SKILL_RATE, visitPrice: MIN_SKILL_RATE },
        ],
      };
    });
    setDailySkillToAdd('');
  }, [dailySkillToAdd]);

  const captureLiveLocation = useCallback(() => {
    if (!navigator?.geolocation) {
      toast.error('Geolocation is not supported on this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos?.coords?.latitude || 0);
        const lng = Number(pos?.coords?.longitude || 0);
        setDailyProfileForm((prev) => ({
          ...(prev || {}),
          liveLocation: {
            ...(prev?.liveLocation || {}),
            latitude: Number.isFinite(lat) ? lat : '',
            longitude: Number.isFinite(lng) ? lng : '',
          },
        }));
        toast.success('Live location captured.');
      },
      () => toast.error('Unable to capture your location.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [toast]);

  const handleDailyProfileSave = useCallback(async (event) => {
    event?.preventDefault?.();
    if (!dailyProfileForm) return;

    const lat = Number(dailyProfileForm?.liveLocation?.latitude);
    const lng = Number(dailyProfileForm?.liveLocation?.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast.error('Please provide a valid live location (latitude and longitude).');
      return;
    }

    if (!Array.isArray(dailyProfileForm?.skillRates) || dailyProfileForm.skillRates.length === 0) {
      toast.error('Please add at least one skill rate.');
      return;
    }

    for (const row of dailyProfileForm.skillRates) {
      const skillName = String(row?.skillName || 'Skill').trim();
      const preference = Number(row?.preferenceRank);
      const hourly = Number(row?.hourlyPrice);
      const daily = Number(row?.dailyPrice);
      const visit = Number(row?.visitPrice);

      if (!Number.isFinite(preference) || preference < 1) {
        toast.error(`Enter a valid Preference for ${skillName}.`);
        return;
      }
      if (!Number.isFinite(hourly) || hourly < MIN_SKILL_RATE) {
        toast.error(`Enter Hour rate >= ${MIN_SKILL_RATE} for ${skillName}.`);
        return;
      }
      if (!Number.isFinite(daily) || daily < MIN_SKILL_RATE) {
        toast.error(`Enter Day rate >= ${MIN_SKILL_RATE} for ${skillName}.`);
        return;
      }
      if (!Number.isFinite(visit) || visit < MIN_SKILL_RATE) {
        toast.error(`Enter Visit rate >= ${MIN_SKILL_RATE} for ${skillName}.`);
        return;
      }
    }

    const payload = {
      liveLocation: { latitude: lat, longitude: lng },
      travelMethod: dailyProfileForm.travelMethod || 'other',
      paymentMethod: dailyProfileForm.paymentMethod || 'flexible',
      phoneType: dailyProfileForm.phoneType || 'Smartphone',
      skillRates: dailyProfileForm.skillRates.map((row) => ({
        skillName: String(row.skillName || '').trim(),
        preferenceRank: Math.max(1, Number(row.preferenceRank)),
        hourlyPrice: Number(row.hourlyPrice),
        dailyPrice: Number(row.dailyPrice),
        visitPrice: Number(row.visitPrice),
      })),
    };

    try {
      setDailyProfileSaving(true);
      const response = await api.updateWorkerDailyProfile(payload);
      const nextDailyProfile = response?.data?.data || response?.data || null;
      if (nextDailyProfile) setDailyProfile(nextDailyProfile);
      toast.success('Daily details saved successfully.');
      setDailyProfileOpen(false);
      await loadData(true);
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to save daily details.';
      toast.error(message);
    } finally {
      setDailyProfileSaving(false);
    }
  }, [dailyProfileForm, loadData, toast]);

  const remainingSeconds = Number.isFinite(activeTaskBlock?.endMs)
    ? Math.max(0, Math.floor((activeTaskBlock.endMs - countdownNow) / 1000))
    : null;
  const showDailyNotice = !dailyProfileIsComplete(dailyProfile);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 pb-20">
      <ToastList toasts={toast.toasts} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          data-guide-id="worker-page-dashboard"
          className="mb-6"
        >
          <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm overflow-hidden shadow-lg">
                  {profile?.photo 
                    ? <img src={api.getImageUrl(profile.photo)} className="w-full h-full object-cover" alt="" />
                    : <span className="text-2xl font-black text-white">{profile?.name?.charAt(0).toUpperCase() || 'W'}</span>
                  }
                </div>
                <div>
                  <h1 className="text-2xl font-black">Good {greet()}, {profile?.name?.split(' ')[0]}!</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-mono">ID: {profile?.userId || profile?.karigarId || '...'}</p>
                    <p className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{profile?.address?.city || 'Local'}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setDailyProfileOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-xl text-sm font-semibold hover:bg-white/30 transition-all"
                >
                  <FileText size="14" />
                  {showDailyNotice ? 'Fill Details' : 'Edit Details'}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => loadData(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-xl text-sm font-semibold hover:bg-white/30 transition-all"
                >
                  <RefreshCw size="14" className={refreshing ? 'animate-spin' : ''} />
                  Refresh
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Active Task Banner */}
        <AnimatePresence>
          {activeTaskBlock && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock4 size="18" className="text-amber-600" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-bold text-amber-800">Active Task in Progress</p>
                    <span className="px-2 py-0.5 bg-amber-200 text-amber-800 rounded text-xs font-bold">
                      {remainingSeconds !== null ? formatDurationHMS(remainingSeconds) : 'Timing TBD'}
                    </span>
                  </div>
                  <p className="text-xs text-amber-700">
                    {activeTaskBlock.skill} in {activeTaskBlock.jobTitle}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Daily Profile Notice */}
        <AnimatePresence>
          {showDailyNotice && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center">
                  <AlertTriangle size="18" className="text-rose-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-rose-800">Daily Details Required</p>
                  <p className="text-xs text-rose-600 mb-3">Please fill your live location, skill pricing, and preferences before applying for jobs.</p>
                  <button
                    onClick={() => setDailyProfileOpen(true)}
                    className="px-4 py-2 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-lg text-sm font-semibold hover:shadow-md transition-all"
                  >
                    Fill Daily Details
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {loading ? [1,2,3,4].map(i => <Skel key={i} h="h-24" />) : (
            <>
              <StatCard title="REPUTATION" value={profile?.points} icon={Crown} gradient="from-yellow-500 to-amber-500" subtitle="Total Points" delay={0.1} />
              <StatCard title="COMPLETED" value={analytics.completed} icon={CheckCircle} gradient="from-emerald-500 to-green-500" subtitle="Jobs Done" delay={0.15} />
              <StatCard title="EXPERIENCE" value={profile?.experience} icon={Award} gradient="from-purple-500 to-indigo-500" subtitle="Years" suffix=" Yrs" delay={0.2} />
              <StatCard title="PENDING" value={analytics.pending} icon={Briefcase} gradient="from-blue-500 to-cyan-500" subtitle="Applications" delay={0.25} />
            </>
          )}
        </div>

        {/* Analytics Section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
              <BarChart3 size="14" className="text-white" />
            </div>
            <h2 className="text-base font-bold text-gray-800">Performance Analytics</h2>
          </div>
          <AnalyticsSection analytics={analytics} profile={profile} loading={loading} />
        </div>

        {/* Nearby Clients Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
              <Users size="14" className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800">Nearby Clients</h2>
              <p className="text-[10px] text-gray-400">Listed by proximity within 5 km radius</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search size="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, mobile, ID, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 bg-white transition-all"
            />
          </div>

          {/* Client Grid */}
          {nearbyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size="32" className="animate-spin text-orange-500" />
            </div>
          ) : filteredNearbyClients.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNearbyClients.map(client => (
                <motion.button
                  key={client._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -4 }}
                  onClick={() => setSelectedClient(client)}
                  className="bg-white rounded-xl border border-gray-100 p-4 shadow-md hover:shadow-lg transition-all text-left"
                >
                  <div className="flex gap-3 items-center mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 flex-shrink-0 overflow-hidden">
                      {client.photo 
                        ? <img src={api.getImageUrl(client.photo)} className="w-full h-full object-cover" alt="" />
                        : <div className="w-full h-full flex items-center justify-center text-orange-500 font-bold text-sm">
                            {client.name?.charAt(0).toUpperCase() || 'C'}
                          </div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-800 text-sm truncate">{client.name || 'Client'}</h4>
                      <p className="text-[10px] text-gray-500 flex items-center gap-1 truncate">
                        <MapPin size="10" /> {[client.address?.locality, client.address?.city].filter(Boolean).join(', ') || 'Location'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-orange-50 rounded-lg p-1.5 text-center">
                      <p className="text-xs font-bold text-orange-600">{client.totalPosted || 0}</p>
                      <p className="text-[8px] text-gray-500 font-semibold">Jobs Posted</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-1.5 text-center">
                      <p className="text-xs font-bold text-emerald-600">{client.totalCompleted || 0}</p>
                      <p className="text-[8px] text-gray-500 font-semibold">Jobs Done</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-blue-600 font-medium flex items-center gap-1">
                      <Eye size="10" /> View Details
                    </span>
                    {client.distanceKm && (
                      <span className="text-[10px] text-emerald-600 font-bold">
                        📍 {Number(client.distanceKm).toFixed(1)} km
                      </span>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <UserCheck size="32" className="text-gray-400" />
              </div>
              <p className="font-bold text-gray-600 text-base mb-1">
                {searchQuery ? 'No matching clients found' : 'No nearby clients available'}
              </p>
              <p className="text-xs text-gray-400">
                {searchQuery ? 'Try a different search term' : 'Check back later for clients in your area'}
              </p>
            </div>
          )}
        </div>

        {/* Daily Profile Modal */}
        <AnimatePresence>
          {dailyProfileOpen && (
            <DailyProfileModal
              profile={profile}
              dailyProfile={dailyProfile}
              dailyProfileForm={dailyProfileForm}
              setDailyProfileForm={setDailyProfileForm}
              dailySkillToAdd={dailySkillToAdd}
              setDailySkillToAdd={setDailySkillToAdd}
              dailyProfileSaving={dailyProfileSaving}
              onSave={handleDailyProfileSave}
              onClose={() => setDailyProfileOpen(false)}
              onAddSkill={addSkillRow}
              onRemoveSkill={removeSkillRow}
              onUpdateSkill={updateSkillRateRow}
              onCaptureLocation={captureLiveLocation}
              registeredSkillNames={getRegisteredSkillNames(profile)}
              availableSkillsToAdd={availableSkillsToAdd}
            />
          )}
        </AnimatePresence>

        {/* Client Detail Modal */}
        <ClientDetailModal client={selectedClient} onClose={() => setSelectedClient(null)} />
      </div>
    </div>
  );
};

// Note: DailyProfileModal component would be extracted here for better organization

export default WorkerDashboard;