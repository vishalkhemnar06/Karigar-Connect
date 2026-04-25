// src/pages/client/ClientDashboard.jsx
// PREMIUM VERSION - Modern design with glassmorphism, animations, and enhanced UX

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import * as api from '../../api';
import { getImageUrl } from '../../constants/config';
import { openWorkerProfilePreview } from '../../utils/workerProfilePreview';
import DirectHireModal from '../../components/DirectHireModal';
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
  Verified,
  Shield,
  Crown,
  Diamond,
  Sparkles,
  Zap,
  Gift,
  Heart,
  Eye,
  MessageCircle,
  ThumbsUp,
  UserCheck,
  Building2,
  Home,
  Wallet,
  Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            className={[
              'px-4 py-3 rounded-xl font-bold text-sm text-white shadow-xl pointer-events-auto',
              toast.type === 'error' ? 'bg-gradient-to-r from-red-500 to-rose-600' : 'bg-gradient-to-r from-emerald-500 to-green-600',
            ].join(' ')}
          >
            {toast.type === 'success' ? <CheckCircle size={14} className="inline mr-2" /> : <AlertCircle size={14} className="inline mr-2" />}
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

/* ─────────────────────────────────────────────
   PRESENTATIONAL COMPONENTS
───────────────────────────────────────────── */

const StatCard = ({ icon: Icon, gradient, label, value, subLabel, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    whileHover={{ y: -2, scale: 1.02 }}
    className="bg-white rounded-2xl p-4 border border-gray-100 shadow-md hover:shadow-lg transition-all"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-black text-gray-800 mt-1">{value}</p>
        {subLabel && <p className="text-[10px] text-gray-400 mt-0.5">{subLabel}</p>}
      </div>
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${gradient} flex items-center justify-center shadow-md`}>
        <Icon size="18" className="text-white" />
      </div>
    </div>
  </motion.div>
);

const SkeletonCard = () => (
  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
    <div className="pt-[100%] bg-gradient-to-r from-gray-200 to-gray-100" />
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
    const value = point.value === null || point.value === undefined ? '' : String(point.value).trim();
    if (label && value) return `${label}: ${value}`;
    if (label) return label;
    if (value) return value;
  }
  return '';
};

/* ─────────────────────────────────────────────
   KARIGAR CARD (Premium Redesign)
───────────────────────────────────────────── */

const KarigarCard = ({ karigar, index, onHireDirect }) => {
  const [imageError, setImageError] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [summaryData, setSummaryData] = useState(null);

  const safeName = typeof karigar?.name === 'string' ? karigar.name : 'Karigar';
  const initials = useMemo(() => safeName.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase(), [safeName]);
  const isAvailable = karigar.availability !== false;
  const rating = karigar.avgStars || 0;
  const skills = Array.isArray(karigar.skills) ? karigar.skills : [];
  const normalizedPhoneType = String(karigar.phoneType || '').toLowerCase();
  const canDirectHire = /smart|android|iphone|ios/.test(normalizedPhoneType);

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
        points: Array.isArray(payload?.points) ? payload.points.map(formatSummaryPoint).filter(Boolean) : [],
      };
      if (!normalizedSummary.intro && normalizedSummary.points.length === 0) throw new Error('Summary generation failed.');
      setSummaryData(normalizedSummary);
    } catch (error) {
      setSummaryError(error?.response?.data?.message || error?.message || 'Unable to generate summary right now.');
    } finally {
      setSummaryLoading(false);
    }
  }, [karigar?._id]);

  const handleFlipToSummary = async () => {
    if (!isFlipped) setIsFlipped(true);
    if (!summaryData) await loadSummary();
  };

  const renderRatingStars = () => (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <Star key={star} size={12} className={star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
        ))}
      </div>
      <span className="text-[10px] font-semibold text-gray-500">{rating > 0 ? rating.toFixed(1) : 'New'}</span>
    </div>
  );

  const renderSkillChips = () => (
    <div className="flex flex-wrap gap-1.5">
      {skills.slice(0, 2).map((skill, idx) => (
        <span key={idx} className="text-[9px] bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 px-2 py-0.5 rounded-full font-semibold border border-orange-100">
          {skill.name || skill}
        </span>
      ))}
      {skills.length > 2 && <span className="text-[9px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">+{skills.length - 2}</span>}
    </div>
  );

  // Front Face
  if (!isFlipped) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03 }}
        whileHover={{ y: -4 }}
        className="relative bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-xl transition-all overflow-hidden"
      >
        {/* Image Header */}
        <div className="relative pt-[100%] bg-gradient-to-br from-orange-100 to-amber-100 overflow-hidden">
          {karigar.photo && !imageError ? (
            <img src={getImageUrl(karigar.photo)} alt={safeName} onError={() => setImageError(true)} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-5xl font-black text-orange-300">{initials}</span>
            </div>
          )}
          
          {/* Experience Badge */}
          <div className="absolute bottom-2 left-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-md">
            {karigar.experience || 0}+ yrs exp
          </div>

          {/* Availability Badge */}
          <div className={`absolute top-2 right-2 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-md flex items-center gap-1 ${isAvailable ? 'bg-emerald-500' : 'bg-gray-500'}`}>
            <div className={`w-1.5 h-1.5 rounded-full bg-white ${isAvailable ? 'animate-pulse' : ''}`} />
            {isAvailable ? 'Available' : 'Busy'}
          </div>

          {/* Rank Badge */}
          <div className="absolute top-2 left-2 bg-white/90 backdrop-blur text-orange-600 text-[10px] font-bold px-2 py-1 rounded-lg shadow-md flex items-center gap-1">
            <Crown size={10} /> #{karigar.rank || index + 1}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="mb-2">
            <h3 className="font-bold text-gray-800 text-base truncate">{safeName}</h3>
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin size={12} className="text-orange-400 flex-shrink-0" />
              <span className="text-[11px] text-gray-500 truncate">{karigar.address?.city || 'Location not set'}</span>
            </div>
          </div>

          {renderRatingStars()}
          {renderSkillChips()}

          {karigar.karigarId && (
            <p className="text-[9px] text-gray-400 font-mono font-semibold mt-1">{karigar.karigarId}</p>
          )}

          {/* Points */}
          <div className="flex items-center gap-1 mt-2 bg-gradient-to-r from-yellow-50 to-amber-50 px-2 py-0.5 rounded-full border border-yellow-200 inline-flex">
            <TrendingUp size={10} className="text-yellow-600" />
            <span className="text-[9px] font-bold text-yellow-700">{karigar.points || 0} pts</span>
          </div>

          {/* Details Toggle */}
          <button onClick={() => setIsDetailsExpanded(prev => !prev)} className="w-full flex items-center justify-between pt-3 text-gray-500 hover:text-orange-600 transition-colors">
            <span className="text-[10px] font-semibold">More Details</span>
            {isDetailsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {isDetailsExpanded && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 pt-2 border-t border-gray-100">
              {karigar.experience && <div className="flex items-center gap-2 text-[11px]"><Clock size={12} className="text-gray-400" /><span className="text-gray-600">{karigar.experience} years experience</span></div>}
              {karigar.email && <div className="flex items-center gap-2 text-[11px]"><Mail size={12} className="text-gray-400" /><span className="text-gray-600 truncate">{karigar.email}</span></div>}
              {karigar.workHours && <div className="flex items-center gap-2 text-[11px]"><Calendar size={12} className="text-gray-400" /><span className="text-gray-600">{karigar.workHours}</span></div>}
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className={`grid gap-2 mt-3 ${canDirectHire ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {karigar.mobile && (
              <a href={`tel:${karigar.mobile}`} className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-2.5 rounded-lg text-[11px] font-bold hover:shadow-md transition-all">
                <Phone size={12} /> Contact
              </a>
            )}
            {canDirectHire && (
              <button onClick={() => onHireDirect?.(karigar)} className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2.5 rounded-lg text-[11px] font-bold hover:shadow-md transition-all">
                <Zap size={12} /> Hire Now
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <button onClick={() => openWorkerProfilePreview(karigar._id || karigar.karigarId)} className="flex items-center justify-center gap-1.5 border border-orange-200 text-orange-600 py-2 rounded-lg text-[10px] font-semibold hover:bg-orange-50 transition-all">
              <Eye size={12} /> Profile
            </button>
            <button onClick={handleFlipToSummary} disabled={summaryLoading} className="flex items-center justify-center gap-1.5 border border-purple-200 text-purple-600 py-2 rounded-lg text-[10px] font-semibold hover:bg-purple-50 transition-all disabled:opacity-50">
              <Sparkles size={12} /> AI Summary
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Back Face (Summary)
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white rounded-xl border border-purple-100 shadow-md overflow-hidden"
    >
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {karigar.photo && !imageError ? (
              <img src={getImageUrl(karigar.photo)} alt={safeName} className="w-10 h-10 rounded-lg object-cover border-2 border-white/50" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center text-sm font-black text-white">{initials}</div>
            )}
            <div>
              <p className="text-white font-bold text-sm truncate">{safeName}</p>
              <p className="text-[10px] text-purple-200">AI Profile Summary</p>
            </div>
          </div>
          <button onClick={() => setIsFlipped(false)} className="text-[10px] font-bold bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg text-white">Back</button>
        </div>
      </div>

      <div className="p-4 min-h-[300px]">
        {summaryLoading && (
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-500">Generating summary...</p>
          </div>
        )}

        {!summaryLoading && summaryError && (
          <div className="text-center py-6">
            <AlertCircle size={32} className="text-red-500 mx-auto mb-2" />
            <p className="text-xs text-red-500 mb-3">{summaryError}</p>
            <button onClick={loadSummary} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-semibold">Try Again</button>
          </div>
        )}

        {!summaryLoading && !summaryError && summaryData && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
            {summaryData.intro && <p className="text-xs text-gray-700 leading-relaxed mb-3">{summaryData.intro}</p>}
            {summaryData.points?.length > 0 && (
              <ul className="space-y-1">
                {summaryData.points.map((point, idx) => (
                  <li key={idx} className="text-xs text-gray-700 leading-relaxed"><span className="text-purple-500 font-bold mr-1">•</span>{point}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!summaryLoading && !summaryError && !summaryData && (
          <div className="text-center py-6">
            <Sparkles size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-500 mb-3">No summary generated yet.</p>
            <button onClick={loadSummary} className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-xs font-bold">Generate Summary</button>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-gray-100 flex gap-2">
        <button onClick={loadSummary} disabled={summaryLoading} className="flex-1 border border-purple-200 text-purple-600 py-2 rounded-lg text-[10px] font-semibold hover:bg-purple-50">Regenerate</button>
        <button onClick={() => setIsFlipped(false)} className="flex-1 bg-gray-700 text-white py-2 rounded-lg text-[10px] font-semibold">Back to Card</button>
      </div>
    </motion.div>
  );
};

/* ─────────────────────────────────────────────
   MAIN DASHBOARD - Premium Redesign
───────────────────────────────────────────── */

const ClientDashboard = () => {
  const [client, setClient] = useState(null);
  const [karigars, setKarigars] = useState([]);
  const [cityRateSummary, setCityRateSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isDirectHireModalOpen, setIsDirectHireModalOpen] = useState(false);
  const [directHireSelectedWorker, setDirectHireSelectedWorker] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [experienceFilter, setExperienceFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const toast = useToast();

  const hasFilters = Boolean(searchTerm || skillFilter || locationFilter || experienceFilter);
  const availableCount = useMemo(() => karigars.filter(k => k.availability !== false).length, [karigars]);
  const clientCity = String(client?.address?.city || client?.city || '').trim();
  const clientCityKey = clientCity.toLowerCase();

  const topSkills = useMemo(() => {
    const counts = new Map();
    karigars.forEach((worker) => {
      (Array.isArray(worker?.skills) ? worker.skills : []).forEach((skill) => {
        const name = String(skill?.name || skill || '').trim();
        if (!name) return;
        const key = name.toLowerCase();
        const current = counts.get(key) || { skill: name, count: 0 };
        counts.set(key, { skill: current.skill, count: current.count + 1 });
      });
    });
    return [...counts.values()].sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill)).slice(0, 5);
  }, [karigars]);

  const formatMoney = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

  const filteredKarigars = useMemo(() => {
    let result = [...karigars];
    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      result = result.filter(k => k.name?.toLowerCase().includes(query) || k.skills?.some(s => (s.name || s).toLowerCase().includes(query)) || k.address?.city?.toLowerCase().includes(query));
    }
    if (skillFilter) result = result.filter(k => k.skills?.some(s => (s.name || s) === skillFilter));
    if (locationFilter) {
      const loc = locationFilter.toLowerCase();
      result = result.filter(k => k.address?.city?.toLowerCase().includes(loc) || k.address?.locality?.toLowerCase().includes(loc) || k.address?.pincode?.includes(loc));
    }
    if (experienceFilter) result = result.filter(k => (k.experience || 0) >= parseInt(experienceFilter, 10));
    return result;
  }, [karigars, searchTerm, skillFilter, locationFilter, experienceFilter]);

  const fetchDashboardData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [clientRes, karigarRes] = await Promise.allSettled([api.getClientProfile(), api.getAllKarigars()]);
      if (clientRes.status === 'fulfilled') setClient(clientRes.value?.data || null);
      if (karigarRes.status === 'fulfilled') setKarigars(normalizeWorkerList(karigarRes.value?.data));
    } catch (error) { console.error('Dashboard fetch error:', error); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    let active = true;

    const loadCityRates = async () => {
      if (!clientCityKey) {
        setCityRateSummary(null);
        return;
      }

      try {
        const { data } = await api.getCityRateSummary(clientCityKey);
        if (!active) return;
        setCityRateSummary(data?.summary || null);
      } catch (error) {
        if (active) setCityRateSummary(null);
      }
    };

    loadCityRates();
    return () => { active = false; };
  }, [clientCityKey]);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  const clearFilters = () => {
    setSearchTerm(''); setSkillFilter(''); setLocationFilter(''); setExperienceFilter(''); setShowFilters(false);
  };

  const greeting = getGreeting();
  const firstName = client?.name?.split(' ')[0] || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 pb-16">
      <ToastList toasts={toast.toasts} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-8">
        
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          data-guide-id="client-page-dashboard"
          className="mb-8"
        >
          <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Users size="24" className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-black">{greeting}{firstName ? `, ${firstName}` : ''} 👋</h1>
                  <p className="text-white/90 text-sm mt-0.5">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="bg-white/15 rounded-xl px-3 py-1.5 text-center">
                  <p className="text-2xl font-bold">{karigars.length}</p>
                  <p className="text-[10px] text-white/80">Total Karigars</p>
                </div>
                <div className="bg-white/15 rounded-xl px-3 py-1.5 text-center">
                  <p className="text-2xl font-bold">{availableCount}</p>
                  <p className="text-[10px] text-white/80">Available Now</p>
                </div>
                <div className="bg-white/15 rounded-xl px-3 py-1.5 text-center hidden sm:block">
                  <p className="text-2xl font-bold">{SKILLS.length}</p>
                  <p className="text-[10px] text-white/80">Skills</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Users} gradient="from-orange-500 to-amber-500" label="Total Karigars" value={karigars.length} subLabel="On platform" delay={0.05} />
          <StatCard icon={CheckCircle} gradient="from-emerald-500 to-green-600" label="Available Now" value={availableCount} subLabel="Ready to hire" delay={0.1} />
          <StatCard icon={Briefcase} gradient="from-blue-500 to-cyan-600" label="Showing" value={filteredKarigars.length} subLabel={hasFilters ? 'Filtered' : 'All'} delay={0.15} />
          <StatCard icon={TrendingUp} gradient="from-purple-500 to-pink-600" label="Skills" value={SKILLS.length} subLabel="Available" delay={0.2} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-500">Insights</p>
                <h2 className="text-xl font-bold text-gray-900">Top 5 Skills</h2>
              </div>
              <Sparkles size={20} className="text-orange-400" />
            </div>
            <div className="space-y-3">
              {topSkills.length > 0 ? topSkills.map((skill, index) => (
                <div key={skill.skill} className="flex items-center justify-between rounded-2xl border border-orange-100 bg-orange-50/60 px-4 py-3">
                  <div>
                    <p className="font-semibold text-gray-800">{index + 1}. {skill.skill}</p>
                    <p className="text-xs text-gray-500">Available workers</p>
                  </div>
                  <span className="text-lg font-black text-orange-600">{skill.count}</span>
                </div>
              )) : (
                <p className="text-sm text-gray-500">Worker skill data will appear here once karigars are available.</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-500">Rates</p>
                <h2 className="text-xl font-bold text-gray-900">City-Specific Pricing</h2>
              </div>
              <Wallet size={20} className="text-blue-400" />
            </div>
            {clientCity ? (
              cityRateSummary ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-500">Hourly</p>
                    <p className="mt-2 text-2xl font-black text-gray-900">{formatMoney(cityRateSummary.averageHourlyRate)}</p>
                    <p className="text-xs text-gray-500 mt-1">Average per hour in {cityRateSummary.city || clientCity}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-500">Daily</p>
                    <p className="mt-2 text-2xl font-black text-gray-900">{formatMoney(cityRateSummary.averageDailyRate)}</p>
                    <p className="text-xs text-gray-500 mt-1">Average per day</p>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-500">Visit</p>
                    <p className="mt-2 text-2xl font-black text-gray-900">{formatMoney(cityRateSummary.averageVisitRate)}</p>
                    <p className="text-xs text-gray-500 mt-1">Average per visit</p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-500">Skill Count</p>
                    <p className="mt-2 text-2xl font-black text-gray-900">{cityRateSummary.skillCount || 0}</p>
                    <p className="text-xs text-gray-500 mt-1">Tracked base rate skills</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 p-6 text-sm text-gray-600">
                  We do not yet have a live rate table for {clientCity}. Add more pricing data to surface local hourly, daily, and visit rates here.
                </div>
              )
            ) : (
              <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 p-6 text-sm text-gray-600">
                Set your city in the profile to see city-specific rates.
              </div>
            )}
          </div>
        </div>

        {/* Search & Filters Section */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-6">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search size="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400" />
              <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search by name, skill, city..." className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all" />
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${showFilters || hasFilters ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-orange-50'}`}>
              <Filter size="14" /> Filter {hasFilters && <span className="ml-0.5">●</span>}
            </button>
            <button onClick={() => fetchDashboardData(true)} disabled={refreshing} className="p-2.5 border border-gray-200 rounded-xl hover:border-orange-300 transition-all">
              <RefreshCw size="16" className={`text-orange-500 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Skill</label>
                  <select value={skillFilter} onChange={e => setSkillFilter(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-orange-400">
                    <option value="">All Skills</option>
                    {SKILLS.map(skill => <option key={skill} value={skill}>{skill}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Location</label>
                  <input value={locationFilter} onChange={e => setLocationFilter(e.target.value)} placeholder="City or pincode" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Experience</label>
                  <select value={experienceFilter} onChange={e => setExperienceFilter(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-orange-400">
                    <option value="">Any</option>
                    <option value="1">1+ Years</option>
                    <option value="3">3+ Years</option>
                    <option value="5">5+ Years</option>
                    <option value="10">10+ Years</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  {hasFilters && <button onClick={clearFilters} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Clear All</button>}
                  <button onClick={() => setShowFilters(false)} className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold">Apply Filters</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active Filters */}
          {hasFilters && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-gray-100">
              <span className="text-[9px] font-bold text-gray-400 uppercase">Active:</span>
              {[{ label: searchTerm, clear: () => setSearchTerm('') }, { label: skillFilter, clear: () => setSkillFilter('') }, { label: locationFilter, clear: () => setLocationFilter('') }, { label: experienceFilter && `${experienceFilter}+ yrs`, clear: () => setExperienceFilter('') }].filter(f => f.label).map((f, idx) => (
                <span key={idx} className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">{f.label}<button onClick={f.clear} className="hover:text-orange-900">✕</button></span>
              ))}
              <button onClick={clearFilters} className="text-[9px] text-orange-500 font-semibold hover:underline">Clear all</button>
            </div>
          )}
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Available Professionals <span className="text-orange-500">({filteredKarigars.length})</span></h2>
            <p className="text-xs text-gray-400 mt-0.5">{hasFilters ? 'Filtered results' : 'All verified karigars'}</p>
          </div>
          {refreshing && <div className="flex items-center gap-1 text-xs text-orange-500"><RefreshCw size="12" className="animate-spin" /> Refreshing...</div>}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, idx) => <SkeletonCard key={idx} />)}
          </div>
        ) : filteredKarigars.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search size="36" className="text-gray-400" />
            </div>
            <h3 className="font-bold text-gray-700 text-lg mb-2">No professionals found</h3>
            <p className="text-sm text-gray-400 max-w-sm mx-auto">{hasFilters ? 'Try adjusting your filters or search terms.' : 'No karigars are registered yet.'}</p>
            {hasFilters && <button onClick={clearFilters} className="mt-5 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl text-sm font-semibold hover:shadow-md transition-all">Show All Professionals</button>}
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredKarigars.map((karigar, idx) => <KarigarCard key={karigar._id || idx} karigar={karigar} index={idx} onHireDirect={worker => { setDirectHireSelectedWorker(worker); setIsDirectHireModalOpen(true); }} />)}
          </div>
        )}

        {/* Direct Hire Modal */}
        <DirectHireModal
          isOpen={isDirectHireModalOpen}
          worker={directHireSelectedWorker}
          client={client}
          onClose={() => setIsDirectHireModalOpen(false)}
          onSuccess={() => fetchDashboardData(true)}
        />
      </div>
    </div>
  );
};

// Helper imports
const AlertCircle = ({ size, className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

export default ClientDashboard;