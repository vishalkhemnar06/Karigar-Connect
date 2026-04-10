// src/pages/client/ClientDashboard.jsx
// MOBILE-FRIENDLY, CLEANED & PROFESSIONAL VERSION

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import * as api from '../../api';
import { getImageUrl } from '../../constants/config';
import { openWorkerProfilePreview } from '../../utils/workerProfilePreview';
import {
  Search,
  MapPin,
  Award,
  Filter,
  CheckCircle,
  Star,
  RefreshCw,
  Briefcase,
  Users,
  ChevronRight,
  TrendingUp,
  Phone,
  Mail,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */

const SKILLS = [
  'Plumber', 'Electrician', 'Carpenter', 'Painter', 'Mason', 'Welder', 'Mechanic',
  'Cook', 'Driver', 'Gardener', 'AC Technician', 'Appliance Repair', 'Roofer',
  'Flooring Installer', 'Tiler', 'Landscaper', 'Pest Control', 'Housekeeper',
  'Mover', 'Security Guard', 'Event Staff', 'Caterer', 'Bartender', 'DJ',
  'Photographer', 'Videographer', 'Graphic Designer', 'Web Developer', 'Content Writer',
  'Social Media Manager', 'SEO Specialist', 'IT Support', 'Data Entry Operator',
  'Tutor', 'Personal Trainer', 'Yoga Instructor', 'Babysitter', 'Elder Care Provider',
  'Pet Sitter', 'Dog Walker', 'Handyman', 'Interior Designer', 'Architect',
  'Electrician (Industrial)', 'Plumber (Commercial)', 'HVAC Technician',
  'Locksmith', 'Tailor', 'Beautician', 'Makeup Artist', 'Other',
];

/* ─────────────────────────────────────────────
   TOAST HOOK & COMPONENT
───────────────────────────────────────────── */

let toastIdCounter = 0;

const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'error') => {
    const id = ++toastIdCounter;

    setToasts(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const error = useCallback(msg => addToast(msg, 'error'), [addToast]);
  const success = useCallback(msg => addToast(msg, 'success'), [addToast]);

  return { toasts, error, success };
};

const ToastList = ({ toasts }) => {
  if (!toasts.length) return null;

  return (
    <div className="fixed top-3 right-3 left-3 sm:left-auto sm:right-5 sm:top-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={[
            'px-4 py-3 rounded-xl font-bold text-sm text-white shadow-xl',
            'animate-in slide-in-from-right pointer-events-auto',
            toast.type === 'error' ? 'bg-red-500' : 'bg-green-500',
          ].join(' ')}
        >
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────────
   PRESENTATIONAL COMPONENTS
───────────────────────────────────────────── */

const StatCard = ({ icon: Icon, gradient, label, value, subLabel }) => (
  <div className="bg-white rounded-2xl p-3 sm:p-4 border border-orange-100 shadow-sm hover:shadow-md transition-all">
    <div className="flex items-center gap-3">
      <div
        className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md"
        style={{ background: gradient }}
      >
        <Icon size={18} className="text-white" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-lg sm:text-2xl font-black text-gray-900 leading-tight">
          {value}
        </p>
        {subLabel && (
          <p className="text-[10px] text-gray-400 mt-0.5">
            {subLabel}
          </p>
        )}
      </div>
    </div>
  </div>
);

const SkeletonCard = () => (
  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
    <div className="pt-[100%] bg-gray-200" />
    <div className="p-4 space-y-3">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-100 rounded w-1/2" />
      <div className="flex gap-1">
        <div className="h-6 bg-gray-100 rounded w-16" />
        <div className="h-6 bg-gray-100 rounded w-16" />
      </div>
      <div className="flex gap-2 pt-2">
        <div className="h-8 bg-gray-100 rounded flex-1" />
        <div className="h-8 bg-gray-100 rounded flex-1" />
      </div>
    </div>
  </div>
);

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

const normalizeWorkerList = payload => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.workers)) return payload.workers;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const formatSummaryPoint = point => {
  if (typeof point === 'string' || typeof point === 'number') return String(point);

  if (point && typeof point === 'object') {
    const label = typeof point.label === 'string' ? point.label.trim() : '';
    const value =
      point.value === null || point.value === undefined
        ? ''
        : String(point.value).trim();

    if (label && value) return `${label}: ${value}`;
    if (label) return label;
    if (value) return value;
  }

  return '';
};

/* ─────────────────────────────────────────────
   KARIGAR CARD
───────────────────────────────────────────── */

const KarigarCard = ({ karigar, index }) => {
  const [imageError, setImageError] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [summaryData, setSummaryData] = useState(null);

  const safeName =
    typeof karigar?.name === 'string' ? karigar.name : 'Karigar';

  const initials = useMemo(
    () =>
      safeName
        .split(' ')
        .filter(Boolean)
        .map(w => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
    [safeName],
  );

  const isAvailable = karigar.availability !== false;
  const rating = karigar.avgStars || 0;
  const skills = Array.isArray(karigar.skills) ? karigar.skills : [];

  const loadSummary = useCallback(async () => {
    if (!karigar?._id) {
      setSummaryError('Worker information is incomplete.');
      return;
    }

    setSummaryLoading(true);
    setSummaryError('');

    try {
      const response = await api.generateWorkerProfileSummary(karigar._id);
      const payload = response?.data?.summary;

      const normalizedSummary = {
        intro: typeof payload?.intro === 'string' ? payload.intro : '',
        points: Array.isArray(payload?.points)
          ? payload.points.map(formatSummaryPoint).filter(Boolean)
          : [],
      };

      if (!normalizedSummary.intro && normalizedSummary.points.length === 0) {
        throw new Error('Summary generation failed.');
      }

      setSummaryData(normalizedSummary);
    } catch (error) {
      setSummaryError(
        error?.response?.data?.message ||
          error?.message ||
          'Unable to generate summary right now.',
      );
    } finally {
      setSummaryLoading(false);
    }
  }, [karigar?._id]);

  const handleFlipToSummary = async () => {
    if (!isFlipped) {
      setIsFlipped(true);
    }
    if (!summaryData) {
      await loadSummary();
    }
  };

  const renderRatingStars = () => (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            size={12}
            className={
              star <= rating
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-200'
            }
          />
        ))}
      </div>
      <span className="text-[10px] sm:text-xs font-semibold text-gray-500">
        {rating > 0 ? rating.toFixed(1) : 'New'}
      </span>
    </div>
  );

  const renderSkillChips = () => (
    <div className="flex flex-wrap gap-1.5">
      {skills.slice(0, 2).map((skill, idx) => (
        <span
          key={idx}
          className="text-[9px] sm:text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold"
        >
          {skill.name || skill}
        </span>
      ))}

      {skills.length > 2 && (
        <span className="text-[9px] sm:text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">
          +{skills.length - 2}
        </span>
      )}
    </div>
  );

  /* FRONT FACE */
  if (!isFlipped) {
    return (
      <div className="relative min-h-[580px]">
        <div className="bg-white rounded-2xl border border-orange-100 overflow-hidden shadow-sm hover:shadow-md transition-all h-full">
          <div className="h-full overflow-y-auto">
            {/* Image / Header */}
            <div className="relative pt-[92%] bg-gradient-to-br from-orange-50 to-amber-50">
              <div className="absolute inset-0">
                {karigar.photo && !imageError ? (
                  <img
                    src={getImageUrl(karigar.photo)}
                    alt={safeName}
                    onError={() => setImageError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-amber-100">
                    <span className="text-4xl sm:text-5xl font-black text-orange-400">
                      {initials}
                    </span>
                  </div>
                )}
              </div>

              <div className="absolute bottom-2 left-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] sm:text-xs font-bold px-2 py-1 rounded-full shadow-md">
                {karigar.experience || 0}+ yrs exp
              </div>

              <div
                className={[
                  'absolute top-2 right-2 text-white text-[10px] sm:text-xs font-bold',
                  'px-2 py-1 rounded-full shadow-md flex items-center gap-1',
                  isAvailable ? 'bg-green-500' : 'bg-gray-500',
                ].join(' ')}
              >
                <div
                  className={[
                    'w-1.5 h-1.5 rounded-full bg-white',
                    isAvailable ? 'animate-pulse' : '',
                  ].join(' ')}
                />
                {isAvailable ? 'Available' : 'Busy'}
              </div>
            </div>

            {/* Body */}
            <div className="p-3 sm:p-4 space-y-2">
              {/* Name + Location */}
              <div>
                <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">
                  {safeName}
                </h3>
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin
                    size={12}
                    className="text-orange-500 flex-shrink-0"
                  />
                  <span className="text-[11px] sm:text-xs text-gray-500 truncate">
                    {karigar.address?.city || 'Location not set'}
                  </span>
                </div>
              </div>

              {renderRatingStars()}
              {renderSkillChips()}

              {karigar.karigarId && (
                <p className="text-[9px] sm:text-[10px] text-gray-400 font-mono font-semibold">
                  {karigar.karigarId}
                </p>
              )}

              {/* Rank + Points */}
              <div className="flex gap-2">
                <div className="flex items-center gap-1 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                  <Award size={10} className="text-orange-500" />
                  <span className="text-[9px] sm:text-[10px] font-bold text-orange-600">
                    #{karigar.rank || index + 1}
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-yellow-50 px-2 py-0.5 rounded-full border border-yellow-200">
                  <TrendingUp size={10} className="text-yellow-600" />
                  <span className="text-[9px] sm:text-[10px] font-bold text-yellow-700">
                    {karigar.points || 0} pts
                  </span>
                </div>
              </div>

              {/* Details toggle */}
              <button
                type="button"
                onClick={() => setIsDetailsExpanded(prev => !prev)}
                className="w-full flex items-center justify-between pt-2 text-gray-500 hover:text-orange-600 transition-colors"
              >
                <span className="text-[10px] font-semibold">More Details</span>
                {isDetailsExpanded ? (
                  <ChevronUp size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
              </button>

              {isDetailsExpanded && (
                <div className="space-y-2 pt-1 border-t border-gray-100">
                  {karigar.experience && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <Clock size={12} className="text-gray-400" />
                      <span className="text-gray-600">
                        {karigar.experience} years experience
                      </span>
                    </div>
                  )}

                  {karigar.email && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <Mail size={12} className="text-gray-400" />
                      <span className="text-gray-600 truncate">
                        {karigar.email}
                      </span>
                    </div>
                  )}

                  {karigar.workHours && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <Calendar size={12} className="text-gray-400" />
                      <span className="text-gray-600">
                        {karigar.workHours}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {karigar.mobile && (
                  <a
                    href={`tel:${karigar.mobile}`}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-2 rounded-xl text-[11px] sm:text-xs font-bold hover:shadow-lg transition-all active:scale-95"
                  >
                    <Phone size={12} /> Contact
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => openWorkerProfilePreview(karigar._id || karigar.karigarId)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 rounded-xl text-[11px] sm:text-xs font-bold hover:shadow-lg transition-all active:scale-95"
                >
                  View Profile <ChevronRight size={12} />
                </button>
              </div>

              {/* AI Summary button */}
              <button
                type="button"
                onClick={handleFlipToSummary}
                disabled={summaryLoading}
                className="w-full mt-2 border-2 border-orange-200 text-orange-700 py-2 rounded-xl text-[11px] sm:text-xs font-bold hover:bg-orange-50 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {summaryLoading
                  ? 'Generating Profile Summary...'
                  : summaryData
                  ? 'View Profile Summary'
                  : 'Generate Profile Summary'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* BACK FACE (SUMMARY) */

  return (
    <div className="relative min-h-[580px]">
      <div className="bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden h-full">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {karigar.photo && !imageError ? (
                <img
                  src={getImageUrl(karigar.photo)}
                  alt={safeName}
                  className="w-9 h-9 rounded-xl object-cover border border-white/50"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-sm font-black">
                  {initials}
                </div>
              )}

              <div className="min-w-0">
                <p className="text-xs font-black truncate">{safeName}</p>
                <p className="text-[10px] text-orange-100 truncate">
                  AI Profile Summary
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsFlipped(false)}
              className="text-[10px] font-bold bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg"
            >
              Back
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            {summaryLoading && (
              <div className="h-full min-h-[260px] flex flex-col items-center justify-center gap-3">
                <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-semibold text-gray-500">
                  Generating profile summary...
                </p>
              </div>
            )}

            {!summaryLoading && summaryError && (
              <div className="space-y-3">
                <p className="text-xs text-red-500 font-semibold">
                  {summaryError}
                </p>
                <button
                  type="button"
                  onClick={loadSummary}
                  className="w-full border border-red-200 text-red-600 py-2 rounded-xl text-xs font-bold hover:bg-red-50"
                >
                  Try Again
                </button>
              </div>
            )}

            {!summaryLoading && !summaryError && summaryData && (
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 space-y-2">
                {summaryData.intro && (
                  <p className="text-xs text-gray-700 leading-relaxed">
                    {summaryData.intro}
                  </p>
                )}

                {Array.isArray(summaryData.points) &&
                  summaryData.points.length > 0 && (
                    <ul className="space-y-1">
                      {summaryData.points.map((point, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-gray-700 leading-relaxed"
                        >
                          <span className="text-orange-500 font-black mr-1">
                            •
                          </span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  )}
              </div>
            )}

            {!summaryLoading && !summaryError && !summaryData && (
              <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center gap-3">
                <p className="text-xs text-gray-500">
                  No summary generated yet.
                </p>
                <button
                  type="button"
                  onClick={loadSummary}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold"
                >
                  Generate Summary
                </button>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="p-3 border-top border-orange-100 flex gap-2">
            <button
              type="button"
              onClick={loadSummary}
              disabled={summaryLoading}
              className="flex-1 border-2 border-orange-200 text-orange-700 py-2 rounded-xl text-[11px] sm:text-xs font-bold hover:bg-orange-50 transition-all disabled:opacity-60"
            >
              Regenerate
            </button>
            <button
              type="button"
              onClick={() => setIsFlipped(false)}
              className="flex-1 bg-gradient-to-r from-gray-700 to-gray-800 text-white py-2 rounded-xl text-[11px] sm:text-xs font-bold"
            >
              Back to Card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   MAIN DASHBOARD
───────────────────────────────────────────── */

const ClientDashboard = () => {
  const [client, setClient] = useState(null);
  const [karigars, setKarigars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [experienceFilter, setExperienceFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const toast = useToast();

  const hasFilters = Boolean(
    searchTerm || skillFilter || locationFilter || experienceFilter,
  );

  const availableCount = useMemo(
    () => karigars.filter(k => k.availability !== false).length,
    [karigars],
  );

  const filteredKarigars = useMemo(() => {
    let result = [...karigars];

    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      result = result.filter(k =>
        k.name?.toLowerCase().includes(query) ||
        k.skills?.some(s => (s.name || s).toLowerCase().includes(query)) ||
        k.address?.city?.toLowerCase().includes(query),
      );
    }

    if (skillFilter) {
      result = result.filter(k =>
        k.skills?.some(s => (s.name || s) === skillFilter),
      );
    }

    if (locationFilter) {
      const loc = locationFilter.toLowerCase();
      result = result.filter(
        k =>
          k.address?.city?.toLowerCase().includes(loc) ||
          k.address?.locality?.toLowerCase().includes(loc) ||
          k.address?.pincode?.includes(loc),
      );
    }

    if (experienceFilter) {
      const minExp = parseInt(experienceFilter, 10);
      result = result.filter(k => (k.experience || 0) >= minExp);
    }

    return result;
  }, [karigars, searchTerm, skillFilter, locationFilter, experienceFilter]);

  const fetchDashboardData = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const [clientRes, karigarRes] = await Promise.allSettled([
          api.getClientProfile(),
          api.getAllKarigars(),
        ]);

        if (clientRes.status === 'fulfilled') {
          setClient(clientRes.value?.data || null);
        }

        if (karigarRes.status === 'fulfilled') {
          const list = normalizeWorkerList(karigarRes.value?.data);
          setKarigars(list);
        }
      } catch (error) {
        console.error('Dashboard fetch error:', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const clearFilters = () => {
    setSearchTerm('');
    setSkillFilter('');
    setLocationFilter('');
    setExperienceFilter('');
    setShowFilters(false);
  };

  const greeting = getGreeting();
  const firstName = client?.name?.split(' ')[0] || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/30 p-3 sm:p-6">
      <ToastList toasts={toast.toasts} />

      {/* Greeting */}
      <header className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900">
            {greeting}
            {firstName ? `, ${firstName}` : ''} 👋
          </h1>
          <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 font-medium">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchDashboardData(true)}
          disabled={refreshing}
          className="p-2 sm:p-2.5 bg-white border-2 border-orange-200 rounded-xl hover:border-orange-300 transition-all active:scale-95"
          aria-label="Refresh dashboard"
        >
          <RefreshCw
            size={16}
            className={`text-orange-500 ${
              refreshing ? 'animate-spin' : ''
            }`}
          />
        </button>
      </header>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[1, 2, 3, 4].map(id => (
            <div
              key={id}
              className="h-24 bg-gray-100 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : (
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatCard
            icon={Users}
            gradient="linear-gradient(135deg,#f97316,#fbbf24)"
            label="Total Karigars"
            value={karigars.length}
            subLabel="On platform"
          />
          <StatCard
            icon={CheckCircle}
            gradient="linear-gradient(135deg,#22c55e,#4ade80)"
            label="Available Now"
            value={availableCount}
            subLabel="Ready to hire"
          />
          <StatCard
            icon={Briefcase}
            gradient="linear-gradient(135deg,#3b82f6,#60a5fa)"
            label="Showing"
            value={filteredKarigars.length}
            subLabel={hasFilters ? 'Filtered' : 'All'}
          />
          <StatCard
            icon={TrendingUp}
            gradient="linear-gradient(135deg,#8b5cf6,#a78bfa)"
            label="Skills"
            value={SKILLS.length}
            subLabel="Available"
          />
        </section>
      )}

      {/* Search & Filters */}
      <section className="bg-white rounded-xl sm:rounded-2xl border border-orange-100 p-3 sm:p-4 mb-4 shadow-sm">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by name, skill, city..."
              className="w-full pl-9 pr-3 py-2 sm:py-2.5 border-2 border-orange-100 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-50 bg-orange-50/30"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowFilters(prev => !prev)}
            className={[
              'flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95',
              showFilters || hasFilters
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white'
                : 'bg-orange-50 text-orange-600 border-2 border-orange-200',
            ].join(' ')}
          >
            <Filter size={14} />
            <span className="hidden xs:inline">Filter</span>
            {hasFilters && <span className="ml-0.5">●</span>}
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-orange-100 space-y-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">
                Skill
              </label>
              <select
                value={skillFilter}
                onChange={e => setSkillFilter(e.target.value)}
                className="w-full px-3 py-2 border-2 border-orange-100 rounded-xl text-sm bg-orange-50/30 focus:outline-none focus:border-orange-400"
              >
                <option value="">All Skills</option>
                {SKILLS.map(skill => (
                  <option key={skill} value={skill}>
                    {skill}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">
                Location
              </label>
              <input
                value={locationFilter}
                onChange={e => setLocationFilter(e.target.value)}
                placeholder="City or pincode"
                className="w-full px-3 py-2 border-2 border-orange-100 rounded-xl text-sm bg-orange-50/30 focus:outline-none focus:border-orange-400"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">
                Experience
              </label>
              <select
                value={experienceFilter}
                onChange={e => setExperienceFilter(e.target.value)}
                className="w-full px-3 py-2 border-2 border-orange-100 rounded-xl text-sm bg-orange-50/30 focus:outline-none focus:border-orange-400"
              >
                <option value="">Any</option>
                <option value="1">1+ Years</option>
                <option value="3">3+ Years</option>
                <option value="5">5+ Years</option>
                <option value="10">10+ Years</option>
              </select>
            </div>

            <div className="flex gap-2 pt-1">
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex-1 px-3 py-2 border-2 border-orange-200 rounded-xl text-sm font-semibold text-orange-600 hover:bg-orange-50 transition-all active:scale-95"
                >
                  Clear All
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-3 py-2 rounded-xl text-sm font-bold active:scale-95"
              >
                Apply
              </button>
            </div>
          </div>
        )}

        {/* Active filter chips */}
        {hasFilters && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-orange-100">
            <span className="text-[9px] font-bold text-gray-400 uppercase">
              Active:
            </span>
            {[
              { label: searchTerm, clear: () => setSearchTerm('') },
              { label: skillFilter, clear: () => setSkillFilter('') },
              { label: locationFilter, clear: () => setLocationFilter('') },
              {
                label: experienceFilter && `${experienceFilter}+ yrs`,
                clear: () => setExperienceFilter(''),
              },
            ]
              .filter(f => f.label)
              .map((f, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                >
                  {f.label}
                  <button
                    type="button"
                    onClick={f.clear}
                    className="hover:text-orange-900"
                  >
                    ✕
                  </button>
                </span>
              ))}
            <button
              type="button"
              onClick={clearFilters}
              className="text-[9px] text-orange-500 font-semibold hover:underline"
            >
              Clear all
            </button>
          </div>
        )}
      </section>

      {/* Results header */}
      <section className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-gray-900">
            Available Professionals{' '}
            <span className="text-orange-500">
              ({filteredKarigars.length})
            </span>
          </h2>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
            {hasFilters ? 'Filtered results' : 'All verified karigars'}
          </p>
        </div>

        {refreshing && (
          <div className="flex items-center gap-1 text-[11px] text-orange-500 font-semibold">
            <RefreshCw size={12} className="animate-spin" /> Refreshing...
          </div>
        )}
      </section>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <SkeletonCard key={idx} />
          ))}
        </div>
      ) : filteredKarigars.length === 0 ? (
        <section className="bg-white rounded-2xl border border-orange-100 p-8 sm:p-12 text-center">
          <div className="text-5xl mb-3">🔍</div>
          <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
            No professionals found
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto">
            {hasFilters
              ? 'Try adjusting your filters or search terms.'
              : 'No karigars are registered yet.'}
          </p>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all active:scale-95"
            >
              Show All Professionals
            </button>
          )}
        </section>
      ) : (
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filteredKarigars.map((karigar, idx) => (
            <KarigarCard key={karigar._id || idx} karigar={karigar} index={idx} />
          ))}
        </section>
      )}
    </div>
  );
};

export default ClientDashboard;
