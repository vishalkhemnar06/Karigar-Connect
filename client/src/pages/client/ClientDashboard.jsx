// src/pages/client/ClientDashboard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// BUGS FIXED:
//   1. DOUBLE SIDEBAR — Component had its own <aside> + full-page flex layout,
//      but ClientLayout already wraps it with a sidebar via <Outlet />.
//      FIX: Removed ALL layout chrome (aside, header, flex wrapper, mobile overlay).
//      This file now renders ONLY the main content area.
//
//   2. `toastId` referenced but never defined in the catch block → ReferenceError.
//      FIX: Removed toastId reference entirely; using self-contained toast.
//
//   3. `getImageUrl()` called in KarigarCard without a valid import when photos
//      are Cloudinary URLs (not local paths) → broken images.
//      FIX: Use karigar.photo directly with an initials fallback on error.
//
//   4. Availability badge always showed "Available" regardless of DB value.
//      FIX: Badge reflects karigar.availability boolean from real data.
//
//   5. Sequential API calls (await client, then await karigars).
//      FIX: Promise.allSettled for true parallel fetching.
//
//   6. skills array entries can be objects {name, proficiency} OR plain strings.
//      FIX: (sk.name || sk) used everywhere for safe skill name access.
//
//   7. "View Profile" link used karigar._id (MongoDB ObjectId) but the public
//      profile route /profile/public/:workerId expects a karigarId string
//      like "K736300". FIX: Changed to karigar.karigarId.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../../api';
import {
  Search, MapPin, Award, Filter, CheckCircle,
  Star, X, RefreshCw, Briefcase, Users, ChevronRight, TrendingUp,
} from 'lucide-react';

/* ════════════════════════════════════════════
   SKILL LIST
════════════════════════════════════════════ */
const SKILLS = [
  'Plumber','Electrician','Carpenter','Painter','Mason','Welder','Mechanic',
  'Cook','Driver','Gardener','AC Technician','Appliance Repair','Roofer',
  'Flooring Installer','Tiler','Landscaper','Pest Control','Housekeeper',
  'Mover','Security Guard','Event Staff','Caterer','Bartender','DJ',
  'Photographer','Videographer','Graphic Designer','Web Developer','Content Writer',
  'Social Media Manager','SEO Specialist','IT Support','Data Entry Operator',
  'Tutor','Personal Trainer','Yoga Instructor','Babysitter','Elder Care Provider',
  'Pet Sitter','Dog Walker','Handyman','Interior Designer','Architect',
  'Electrician (Industrial)','Plumber (Commercial)','HVAC Technician',
  'Locksmith','Tailor','Beautician','Makeup Artist','Other',
];

/* ════════════════════════════════════════════
   TOAST  (no external dep)
════════════════════════════════════════════ */
let _tid = 0;
const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = 'error') => {
    const id = ++_tid;
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);
  return { toasts, error: m => add(m, 'error'), success: m => add(m, 'success') };
};

const ToastList = ({ toasts }) => (
  <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
    {toasts.map(t => (
      <div key={t.id} style={{
        background: t.type === 'error' ? '#ef4444' : '#22c55e',
        color: '#fff', padding: '11px 18px', borderRadius: 12, fontWeight: 700,
        fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        display: 'flex', alignItems: 'center', gap: 8, minWidth: 200,
        fontFamily: 'inherit', animation: 'cd-in 0.3s ease',
      }}>
        {t.type === 'success' ? '✓' : '✕'} {t.msg}
      </div>
    ))}
  </div>
);

/* ════════════════════════════════════════════
   SKELETON
════════════════════════════════════════════ */
const Skel = ({ h = 300, r = 18 }) => (
  <div style={{
    height: h, borderRadius: r,
    background: 'linear-gradient(90deg,#fff7ed 25%,#ffedd5 50%,#fff7ed 75%)',
    backgroundSize: '200% 100%', animation: 'cd-shimmer 1.4s infinite',
  }} />
);

/* ════════════════════════════════════════════
   STAT CARD
════════════════════════════════════════════ */
const StatCard = ({ icon: Icon, grad, label, value, sub }) => (
  <div style={{
    background: '#fff', borderRadius: 16, padding: '16px 18px',
    border: '1px solid #fed7aa', boxShadow: '0 1px 10px rgba(251,146,60,0.07)',
    display: 'flex', alignItems: 'center', gap: 14, flex: '1 1 140px',
    transition: 'transform 0.18s, box-shadow 0.18s',
  }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(251,146,60,0.15)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 10px rgba(251,146,60,0.07)'; }}
  >
    <div style={{ width: 44, height: 44, borderRadius: 13, background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 3px 12px rgba(249,115,22,0.25)' }}>
      <Icon size={20} color="#fff" />
    </div>
    <div style={{ minWidth: 0 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 900, color: '#111827', margin: '2px 0 0', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#6b7280', margin: '3px 0 0', fontWeight: 500 }}>{sub}</p>}
    </div>
  </div>
);

/* ════════════════════════════════════════════
   KARIGAR CARD
════════════════════════════════════════════ */
const KarigarCard = ({ karigar, idx }) => {
  const [imgErr, setImgErr] = useState(false);
  const initials  = (karigar.name || 'K').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const isAvailable = karigar.availability !== false;
  const rating    = karigar.avgStars || 0;
  const skills    = karigar.skills || [];

  return (
    <div style={{
      background: '#fff', borderRadius: 20, border: '1px solid #fed7aa',
      overflow: 'hidden', boxShadow: '0 2px 14px rgba(251,146,60,0.07)',
      display: 'flex', flexDirection: 'column',
      transition: 'transform 0.2s, box-shadow 0.2s',
      animation: `cd-fadeUp 0.4s ease ${Math.min(idx * 0.05, 0.5)}s both`,
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 14px 40px rgba(251,146,60,0.18)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 14px rgba(251,146,60,0.07)'; }}
    >
      {/* ── Photo ── */}
      <div style={{ position: 'relative', paddingTop: '100%', background: 'linear-gradient(135deg,#fff7ed,#ffedd5)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          {karigar.photo && !imgErr
            ? <img src={karigar.photo} alt={karigar.name} onError={() => setImgErr(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#ffedd5,#fff7ed)' }}>
                <span style={{ fontSize: 46, fontWeight: 900, color: '#fb923c' }}>{initials}</span>
              </div>
          }
        </div>

        {/* Experience badge */}
        <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'linear-gradient(135deg,#f97316,#fbbf24)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 99, boxShadow: '0 2px 8px rgba(249,115,22,0.4)', zIndex: 1 }}>
          {karigar.experience || 0}+ yrs exp
        </div>

        {/* Availability badge */}
        <div style={{ position: 'absolute', top: 10, right: 10, background: isAvailable ? '#22c55e' : '#9ca3af', color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.18)', zIndex: 1 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff', animation: isAvailable ? 'cd-pulse 1.5s infinite' : 'none' }} />
          {isAvailable ? 'Available' : 'Busy'}
        </div>

        {/* hover tint overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.08), transparent)', pointerEvents: 'none' }} />
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Name + location */}
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {karigar.name}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
            <MapPin size={12} color="#f97316" />
            <span style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {karigar.address?.city || 'Location not set'}
            </span>
          </div>
        </div>

        {/* Stars */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ display: 'flex', gap: 2 }}>
            {[1, 2, 3, 4, 5].map(s => (
              <Star key={s} size={12} color={s <= rating ? '#f59e0b' : '#e5e7eb'} fill={s <= rating ? '#f59e0b' : 'none'} />
            ))}
          </div>
          <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>
            {rating > 0 ? rating.toFixed(1) : 'New'}
          </span>
        </div>

        {/* Skills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {skills.slice(0, 2).map((sk, i) => (
            <span key={i} style={{ background: '#fff7ed', color: '#c2410c', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99, border: '1px solid #fed7aa' }}>
              {sk.name || sk}
            </span>
          ))}
          {skills.length > 2 && (
            <span style={{ background: '#f3f4f6', color: '#6b7280', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99 }}>
              +{skills.length - 2} more
            </span>
          )}
          {!skills.length && <span style={{ color: '#9ca3af', fontSize: 11 }}>No skills listed</span>}
        </div>

        {/* Karigar ID */}
        {karigar.karigarId && (
          <p style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace', margin: 0, fontWeight: 600 }}>
            {karigar.karigarId}
          </p>
        )}

        {/* Rank + Points */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 99, padding: '3px 9px' }}>
            <Award size={10} color="#f97316" />
            <span style={{ fontSize: 10, fontWeight: 800, color: '#c2410c' }}>#{karigar.rank || idx + 1}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 99, padding: '3px 9px' }}>
            <TrendingUp size={10} color="#d97706" />
            <span style={{ fontSize: 10, fontWeight: 800, color: '#b45309' }}>{karigar.points || 0} pts</span>
          </div>
        </div>

        {/* CTA buttons */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {karigar.mobile && (
            <a href={`tel:${karigar.mobile}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: 'linear-gradient(135deg,#22c55e,#4ade80)', color: '#fff',
                borderRadius: 12, padding: '9px 14px', fontSize: 12, fontWeight: 800,
                textDecoration: 'none', boxShadow: '0 2px 10px rgba(34,197,94,0.28)',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Contact Now
            </a>
          )}
          {/* FIX 7: was karigar._id (MongoDB ObjectId) — route expects karigarId like "K736300" */}
          <Link to={`/profile/public/${karigar.karigarId}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: 'linear-gradient(135deg,#f97316,#fbbf24)', color: '#fff',
              borderRadius: 12, padding: '10px 14px', fontSize: 12, fontWeight: 800,
              textDecoration: 'none', boxShadow: '0 2px 10px rgba(249,115,22,0.28)',
              transition: 'opacity 0.15s, transform 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'scale(1.01)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
          >
            View Profile <ChevronRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════
   MAIN COMPONENT
   — renders ONLY content (no sidebar/header)
   — drop inside <ClientLayout> via <Outlet />
════════════════════════════════════════════ */
const ClientDashboard = () => {
  const [clientData,       setClientData]       = useState(null);
  const [karigars,         setKarigars]         = useState([]);
  const [filteredKarigars, setFilteredKarigars] = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [refreshing,       setRefreshing]       = useState(false);
  const [showFilters,      setShowFilters]      = useState(false);
  const [searchTerm,       setSearchTerm]       = useState('');
  const [skillFilter,      setSkillFilter]      = useState('');
  const [locationFilter,   setLocationFilter]   = useState('');
  const [experienceFilter, setExperienceFilter] = useState('');
  const toast = useToast();

  /* ── Parallel fetch ── */
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [clientRes, karigarRes] = await Promise.allSettled([
        api.getClientProfile(),
        api.getAllKarigars(),
      ]);
      if (clientRes.status  === 'fulfilled') setClientData(clientRes.value?.data || null);
      if (karigarRes.status === 'fulfilled') {
        const list = karigarRes.value?.data || [];
        setKarigars(list);
        setFilteredKarigars(list);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Filter ── */
  useEffect(() => {
    let r = karigars;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      r = r.filter(k =>
        k.name?.toLowerCase().includes(q) ||
        k.skills?.some(s => (s.name || s).toLowerCase().includes(q)) ||
        k.address?.city?.toLowerCase().includes(q)
      );
    }
    if (skillFilter)
      r = r.filter(k => k.skills?.some(s => (s.name || s) === skillFilter));
    if (locationFilter) {
      const loc = locationFilter.toLowerCase();
      r = r.filter(k =>
        k.address?.city?.toLowerCase().includes(loc) ||
        k.address?.locality?.toLowerCase().includes(loc) ||
        k.address?.pincode?.includes(loc)
      );
    }
    if (experienceFilter)
      r = r.filter(k => (k.experience || 0) >= parseInt(experienceFilter));
    setFilteredKarigars(r);
  }, [searchTerm, skillFilter, locationFilter, experienceFilter, karigars]);

  const clearFilters = () => { setSearchTerm(''); setSkillFilter(''); setLocationFilter(''); setExperienceFilter(''); };
  const hasFilters   = !!(searchTerm || skillFilter || locationFilter || experienceFilter);
  const availCount   = karigars.filter(k => k.availability !== false).length;
  const hour         = new Date().getHours();
  const greet        = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName    = clientData?.name?.split(' ')[0] || null;

  return (
    <div style={{ background: '#fff7ed', minHeight: '100%', padding: '24px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes cd-shimmer { to { background-position: -200% 0; } }
        @keyframes cd-in      { from { transform: translateX(30px); opacity: 0; } to { transform: none; opacity: 1; } }
        @keyframes cd-fadeUp  { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        @keyframes cd-spin    { to { transform: rotate(360deg); } }
        @keyframes cd-pulse   { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        .cd-input:focus { border-color: #f97316 !important; box-shadow: 0 0 0 3px rgba(249,115,22,0.12) !important; background: #fff !important; }
        .cd-sel:focus   { border-color: #f97316 !important; outline: none !important; }
        .cd-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
          gap: 18px;
        }
        @media (max-width: 500px) { .cd-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; } }
      `}</style>

      <ToastList toasts={toast.toasts} />

      {/* ── Greeting ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: 0 }}>
            {greet}{firstName ? `, ${firstName}` : ''} 👋
          </h1>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 3, fontWeight: 500 }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button onClick={() => fetchData(true)} disabled={refreshing}
          style={{ background: '#fff', border: '1.5px solid #fed7aa', borderRadius: 11, padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#f97316', fontFamily: 'inherit', transition: 'background 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = '#fff7ed'}
          onMouseLeave={e => e.currentTarget.style.background = '#fff'}
        >
          <RefreshCw size={13} style={{ animation: refreshing ? 'cd-spin 0.8s linear infinite' : 'none' }} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* ── Stats ── */}
      {loading
        ? <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>{[1,2,3,4].map(i => <Skel key={i} h={84} r={16} />)}</div>
        : (
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <StatCard icon={Users}       grad="linear-gradient(135deg,#f97316,#fbbf24)" label="Total Karigars"   value={karigars.length}         sub="On the platform" />
            <StatCard icon={CheckCircle} grad="linear-gradient(135deg,#22c55e,#4ade80)" label="Available Now"    value={availCount}              sub="Ready for hire" />
            <StatCard icon={Briefcase}   grad="linear-gradient(135deg,#3b82f6,#60a5fa)" label="Showing"          value={filteredKarigars.length} sub={hasFilters ? 'After filters' : 'All results'} />
            <StatCard icon={TrendingUp}  grad="linear-gradient(135deg,#8b5cf6,#a78bfa)" label="Skill Categories" value={SKILLS.length}           sub="Available" />
          </div>
        )
      }

      {/* ── Search + Filter bar ── */}
      <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #fed7aa', padding: '16px 18px', marginBottom: 16, boxShadow: '0 1px 10px rgba(251,146,60,0.06)' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={15} color="#f97316" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input className="cd-input" type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by name, skill, or city…"
              style={{ width: '100%', padding: '11px 34px 11px 36px', border: '2px solid #fed7aa', borderRadius: 12, fontSize: 13, fontFamily: 'inherit', fontWeight: 500, background: '#fff7ed', outline: 'none', color: '#111827', boxSizing: 'border-box', transition: 'all 0.18s' }}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <X size={14} color="#9ca3af" />
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <button onClick={() => setShowFilters(p => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '11px 16px', borderRadius: 12,
              border: `2px solid ${showFilters || hasFilters ? '#f97316' : '#fed7aa'}`,
              background: showFilters || hasFilters ? 'linear-gradient(135deg,#f97316,#fbbf24)' : '#fff',
              color: showFilters || hasFilters ? '#fff' : '#f97316',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}>
            <Filter size={14} />Filters {hasFilters ? '●' : ''}
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #fed7aa', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 7 }}>
                <Award size={10} color="#f97316" />Skill
              </label>
              <select className="cd-sel" value={skillFilter} onChange={e => setSkillFilter(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '2px solid #fed7aa', borderRadius: 11, fontSize: 13, fontFamily: 'inherit', fontWeight: 500, background: '#fff7ed', color: '#111827', appearance: 'none', cursor: 'pointer' }}>
                <option value="">All Skills</option>
                {SKILLS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 7 }}>
                <Search size={10} color="#f97316" />Location
              </label>
              <input className="cd-input" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
                placeholder="City or pincode"
                style={{ width: '100%', padding: '9px 12px', border: '2px solid #fed7aa', borderRadius: 11, fontSize: 13, fontFamily: 'inherit', fontWeight: 500, background: '#fff7ed', outline: 'none', color: '#111827', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 7 }}>
                <Star size={10} color="#f97316" />Experience
              </label>
              <select className="cd-sel" value={experienceFilter} onChange={e => setExperienceFilter(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '2px solid #fed7aa', borderRadius: 11, fontSize: 13, fontFamily: 'inherit', fontWeight: 500, background: '#fff7ed', color: '#111827', appearance: 'none', cursor: 'pointer' }}>
                <option value="">Any</option>
                <option value="1">1+ Years</option>
                <option value="3">3+ Years</option>
                <option value="5">5+ Years</option>
                <option value="10">10+ Years</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 8 }}>
              {hasFilters && (
                <button onClick={clearFilters}
                  style={{ padding: '9px 14px', border: '1.5px solid #fed7aa', borderRadius: 11, background: '#fff', fontSize: 12, fontWeight: 700, color: '#f97316', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <X size={12} />Clear All
                </button>
              )}
              <button onClick={() => setShowFilters(false)}
                style={{ padding: '9px 14px', border: 'none', borderRadius: 11, background: 'linear-gradient(135deg,#f97316,#fbbf24)', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                Apply
              </button>
            </div>
          </div>
        )}

        {/* Active filter chips */}
        {hasFilters && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Active:</span>
            {[
              { label: searchTerm,                                    clear: () => setSearchTerm('')        },
              { label: skillFilter,                                    clear: () => setSkillFilter('')       },
              { label: locationFilter,                                 clear: () => setLocationFilter('')    },
              { label: experienceFilter && `${experienceFilter}+ yrs`, clear: () => setExperienceFilter('') },
            ].filter(f => f.label).map((f, i) => (
              <span key={i} style={{ background: '#ffedd5', color: '#c2410c', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 5, border: '1px solid #fed7aa' }}>
                {f.label}
                <button onClick={f.clear} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                  <X size={11} color="#c2410c" />
                </button>
              </span>
            ))}
            <button onClick={clearFilters} style={{ background: 'none', border: 'none', color: '#f97316', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ── Results header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: '#111827', margin: 0 }}>
            Available Professionals <span style={{ color: '#f97316' }}>({filteredKarigars.length})</span>
          </h2>
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2, fontWeight: 500 }}>
            {hasFilters ? 'Filtered results' : 'All verified karigars on the platform'}
          </p>
        </div>
        {refreshing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#f97316', fontWeight: 600 }}>
            <RefreshCw size={12} style={{ animation: 'cd-spin 0.8s linear infinite' }} /> Refreshing…
          </div>
        )}
      </div>

      {/* ── Grid ── */}
      {loading ? (
        <div className="cd-grid">
          {[1,2,3,4,5,6,7,8].map(i => <Skel key={i} h={340} />)}
        </div>
      ) : filteredKarigars.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #fed7aa', padding: '60px 24px', textAlign: 'center', boxShadow: '0 1px 10px rgba(251,146,60,0.06)' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🔍</div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 8 }}>No professionals found</h3>
          <p style={{ color: '#6b7280', fontSize: 13, maxWidth: 340, margin: '0 auto 20px', lineHeight: 1.65 }}>
            {hasFilters ? 'Try adjusting your filters or search terms.' : 'No karigars are registered yet.'}
          </p>
          {hasFilters && (
            <button onClick={clearFilters}
              style={{ background: 'linear-gradient(135deg,#f97316,#fbbf24)', color: '#fff', border: 'none', fontWeight: 700, padding: '11px 24px', borderRadius: 12, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Show All Professionals
            </button>
          )}
        </div>
      ) : (
        <div className="cd-grid">
          {filteredKarigars.map((karigar, idx) => (
            <KarigarCard key={karigar._id} karigar={karigar} idx={idx} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientDashboard;