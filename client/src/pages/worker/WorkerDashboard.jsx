import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../../api';

import {
  MapPin, Briefcase,
  CheckCircle, Clock4, AlertTriangle, Star,
  RefreshCw, Shield, Phone, BookOpen, Award, UserCheck,
} from 'lucide-react';

/* ════════════════════════════════════════════
   TOAST  (no external dep)
════════════════════════════════════════════ */
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
  return {
    toasts,
    loading: m => add(m, 'loading'),
    success: m => add(m, 'success'),
    error:   m => add(m, 'error'),
    update,
  };
};

const ToastList = ({ toasts }) => (
  <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
    {toasts.map(t => (
      <div key={t.id} style={{
        background: t.type === 'error' ? '#ef4444' : t.type === 'loading' ? '#6366f1' : '#22c55e',
        color: '#fff', padding: '11px 18px', borderRadius: 12, fontWeight: 700, fontSize: 13,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 9, minWidth: 220,
        fontFamily: 'inherit',
      }}>
        {t.type === 'loading' && <div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'wd-spin 0.7s linear infinite', flexShrink: 0 }} />}
        {t.type === 'success' && '✓'}{t.type === 'error' && '✕'}
        {t.msg}
      </div>
    ))}
  </div>
);

/* ════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════ */
const timeAgo = ds => {
  if (!ds) return '—';
  const h = Math.floor((Date.now() - new Date(ds)) / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  if (h < 168) return `${Math.floor(h / 24)}d ago`;
  return `${Math.floor(h / 168)}w ago`;
};

const safeNum = v => (v === null || v === undefined ? 0 : Number(v));

/* ════════════════════════════════════════════
   SKELETON
════════════════════════════════════════════ */
const Skel = ({ h = 100, r = 14 }) => (
  <div style={{
    height: h, borderRadius: r,
    background: 'linear-gradient(90deg,#fff7ed 25%,#ffedd5 50%,#fff7ed 75%)',
    backgroundSize: '200% 100%', animation: 'wd-shimmer 1.4s infinite',
  }} />
);

/* ════════════════════════════════════════════
   STAT CARD
════════════════════════════════════════════ */
const StatCard = ({ title, value, subtitle, icon: Icon, grad, prefix = '', suffix = '' }) => (
  <div
    style={{
      background: '#fff', borderRadius: 16, padding: '18px 20px',
      border: '1px solid #fed7aa', boxShadow: '0 1px 10px rgba(251,146,60,0.07)',
      transition: 'transform 0.18s, box-shadow 0.18s', flex: 1, minWidth: 0,
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(251,146,60,0.15)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 10px rgba(251,146,60,0.07)'; }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </p>
        <p style={{ fontSize: 28, fontWeight: 900, color: '#111827', lineHeight: 1 }}>
          {prefix}{safeNum(value).toLocaleString('en-IN')}{suffix}
        </p>
        {subtitle && <p style={{ fontSize: 11, color: '#6b7280', marginTop: 5, fontWeight: 500 }}>{subtitle}</p>}
      </div>
      <div style={{ background: grad, borderRadius: 12, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={19} color="#fff" />
      </div>
    </div>
  </div>
);

/* ════════════════════════════════════════════
   NEAR CLIENT CARD
════════════════════════════════════════════ */
const ClientCard = ({ client }) => {
  const initials = (client.name || 'C').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const city     = client.address?.city || '';
  const locality = client.address?.locality || '';
  const location = [locality, city].filter(Boolean).join(', ') || '—';

  return (
    <div style={{
      background: '#fff', borderRadius: 18, border: '1px solid #fed7aa',
      boxShadow: '0 1px 12px rgba(251,146,60,0.06)', overflow: 'hidden',
      transition: 'box-shadow 0.2s, border-color 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 30px rgba(251,146,60,0.16)'; e.currentTarget.style.borderColor = '#fb923c'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 12px rgba(251,146,60,0.06)'; e.currentTarget.style.borderColor = '#fed7aa'; }}
    >
      <div style={{ height: 3, background: 'linear-gradient(90deg,#f97316,#fbbf24)' }} />
      <div style={{ padding: '18px 20px' }}>
        {/* header */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, flexShrink: 0, overflow: 'hidden', border: '2px solid #fed7aa' }}>
            {client.photo
              ? <img src={api.getImageUrl(client.photo)} alt={client.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />
              : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#f97316,#fbbf24)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#fff' }}>{initials}</div>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>{client.name}</span>
              {client.verificationStatus === 'approved' && (
                <span style={{ background: '#f0fdf4', color: '#16a34a', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99, border: '1px solid #bbf7d0' }}>✓ Verified</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#6b7280', fontSize: 12, marginTop: 3 }}>
              <MapPin size={11} color="#f97316" />
              <span>{location}</span>
            </div>
          </div>
        </div>

        {/* stats row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[
            { label: 'Jobs Posted',    value: client.totalPosted },
            { label: 'Completed',      value: client.totalCompleted },
          ].map(({ label, value }, i) => (
            <div key={i} style={{ flex: 1, background: '#fff7ed', borderRadius: 10, padding: '8px 10px', textAlign: 'center', border: '1px solid #fed7aa' }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#f97316' }}>{value}</div>
              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, marginTop: 1 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* recent jobs */}
        {client.recentJobs?.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Recent Jobs</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {client.recentJobs.map((j, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#fff7ed', borderRadius: 8, padding: '5px 10px' }}>
                  <Briefcase size={11} color="#f97316" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: '#374151', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.title}</span>
                  <span style={{ fontSize: 10, color: j.status === 'completed' ? '#16a34a' : '#f97316', fontWeight: 700, flexShrink: 0, textTransform: 'capitalize' }}>{j.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* contact */}
        {client.mobile && (
          <a href={`tel:${client.mobile}`}
            style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#2563eb', fontSize: 13, fontWeight: 700, textDecoration: 'none', background: '#eff6ff', padding: '9px 14px', borderRadius: 11, border: '1.5px solid #bfdbfe' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#dbeafe'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#eff6ff'; }}
          >
            <Phone size={13} />{client.mobile}
          </a>
        )}
      </div>
    </div>
  );
};
/* ════════════════════════════════════════════
   MAIN — renders ONLY content (no sidebar)
════════════════════════════════════════════ */
const WorkerDashboard = () => {
  const [nearClients, setNearClients] = useState([]);
  const [profile,     setProfile]     = useState(null);
  const [analytics,   setAnalytics]   = useState({
    completedJobs: 0, pendingApplications: 0, hasActiveTask: false, points: 0,
  });
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const toast = useToast();

  /* ── fetch everything ── */
  const fetchAll = useCallback(async (silent = false) => {
    const tid = null;
    if (!silent) setLoading(true); else setRefreshing(true);
    setFetchError(null);

    try {
      const [analyticsR, profileR, nearR] = await Promise.allSettled([
        api.getWorkerAnalytics(), // GET /worker/analytics
        api.getWorkerProfile(),   // GET /worker/profile
        api.getNearClients(),     // GET /worker/near-clients
      ]);

      const d = analyticsR.status === 'fulfilled' ? (analyticsR.value?.data || {}) : {};
      const prof = profileR.status === 'fulfilled' ? (profileR.value?.data || null) : null;
      setAnalytics(prev => ({
        ...prev,
        completedJobs:       d.completed            ?? prev.completedJobs,
        pendingApplications: d.pending              ?? prev.pendingApplications,
        hasActiveTask:       typeof d.running === 'number' ? d.running > 0 : prev.hasActiveTask,
        points:              prof?.points           ?? prev.points,
      }));

      if (prof) setProfile(prof);
      if (nearR.status  === 'fulfilled') setNearClients(nearR.value?.data  || []);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Could not load dashboard.';
      setFetchError(msg);
      if (tid) toast.update(tid, msg, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  /* ── profile shortcuts ── */
  const workerName = profile?.name      || 'Worker';
  const karigarId  = profile?.karigarId || '—';
  const avail      = profile?.availability ?? true;
  const photoUrl   = profile?.photo     || null;
  const initials   = workerName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const hour       = new Date().getHours();
  const greet      = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  /* ════════════════════════════════════════════
     RENDER — pure content block, no wrapper layout
  ════════════════════════════════════════════ */
  return (
    <div style={{ background: '#fff7ed', minHeight: '100%', padding: '24px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes wd-spin    { to { transform: rotate(360deg); } }
        @keyframes wd-shimmer { to { background-position: -200% 0; } }
        .wd-g4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        .wd-g3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        @media (max-width: 1100px) { .wd-g4 { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 700px)  { .wd-g4 { grid-template-columns: 1fr; } .wd-g3 { grid-template-columns: 1fr; } }
        @media (max-width: 900px)  { .wd-g3 { grid-template-columns: repeat(2, 1fr); } }
      `}</style>

      <ToastList toasts={toast.toasts} />

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: 0 }}>
            {greet}, {workerName.split(' ')[0]} 👋
          </h1>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 3, fontWeight: 500 }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* availability pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: avail ? '#f0fdf4' : '#fef2f2', border: `1px solid ${avail ? '#bbf7d0' : '#fecaca'}`, borderRadius: 10, padding: '6px 12px' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: avail ? '#22c55e' : '#ef4444' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: avail ? '#16a34a' : '#dc2626' }}>{avail ? 'Available' : 'Unavailable'}</span>
          </div>
          {/* points */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '6px 12px' }}>
            <Star size={13} color="#f59e0b" fill="#f59e0b" />
            <span style={{ fontSize: 12, fontWeight: 800, color: '#d97706' }}>{safeNum(analytics.points)} pts</span>
          </div>
          {/* refresh */}
          <button onClick={() => fetchAll(true)} disabled={refreshing}
            title="Refresh"
            style={{ background: '#fff', border: '1.5px solid #fed7aa', borderRadius: 10, padding: '7px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fff7ed'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
          >
            <RefreshCw size={15} color="#f97316" style={{ animation: refreshing ? 'wd-spin 0.8s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {fetchError && (
        <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 14, padding: '13px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={17} color="#ef4444" />
            <span style={{ fontWeight: 700, color: '#dc2626', fontSize: 13 }}>{fetchError}</span>
          </div>
          <button onClick={() => fetchAll()}
            style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Retry
          </button>
        </div>
      )}

      {/* ── Active task warning ── */}
      {analytics.hasActiveTask && (
        <div style={{ background: '#fef3c7', border: '1.5px solid #fcd34d', borderRadius: 14, padding: '13px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={17} color="#d97706" />
          <div>
            <div style={{ fontWeight: 800, color: '#92400e', fontSize: 13 }}>You have an active task in progress</div>
            <div style={{ fontSize: 12, color: '#b45309', marginTop: 1 }}>Complete it before applying to new jobs.</div>
          </div>
        </div>
      )}

      {/* ── Stats row 1 (4 cards) ── */}
      <div className="wd-g4" style={{ marginBottom: 14 }}>
        {loading
          ? [1, 2, 3, 4].map(i => <Skel key={i} h={102} />)
          : <>
              <StatCard title="Near Clients"      value={nearClients.length}            subtitle="Clients in your city"  icon={UserCheck}   grad="linear-gradient(135deg,#f97316,#fbbf24)" />
              <StatCard title="Completed Jobs"    value={analytics.completedJobs}       subtitle="Successfully finished" icon={CheckCircle} grad="linear-gradient(135deg,#3b82f6,#60a5fa)" />
              <StatCard title="Karigar Points"    value={analytics.points}              subtitle="Reputation score"      icon={Star}        grad="linear-gradient(135deg,#f59e0b,#fbbf24)" />
              <StatCard title="Pending"           value={analytics.pendingApplications} subtitle="Awaiting client response" icon={Clock4}   grad="linear-gradient(135deg,#8b5cf6,#a78bfa)" />
            </>
        }
      </div>

      {/* ── Stats row 2 (3 cards) ── */}
      <div className="wd-g3" style={{ marginBottom: 24 }}>
        {loading
          ? [1, 2, 3].map(i => <Skel key={i} h={96} />)
          : <>
              <StatCard title="Experience"   value={safeNum(profile?.experience)}  suffix=" yrs"  subtitle={profile?.overallExperience || '—'} icon={Award}  grad="linear-gradient(135deg,#ec4899,#f472b6)" />
              <StatCard title="Availability" value={avail ? 1 : 0}                 suffix={avail ? ' ✓' : ' ✗'} subtitle={avail ? 'Open to work' : 'Currently busy'} icon={Shield} grad={avail ? 'linear-gradient(135deg,#22c55e,#4ade80)' : 'linear-gradient(135deg,#9ca3af,#6b7280)'} />
            </>
        }
      </div>

      {/* ── Profile snapshot ── */}
      {!loading && profile && (
        <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #fed7aa', padding: '16px 20px', marginBottom: 20, boxShadow: '0 1px 10px rgba(251,146,60,0.06)' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 12 }}>Your Profile</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {photoUrl
                ? <img src={photoUrl} alt={workerName} style={{ width: 44, height: 44, borderRadius: 11, objectFit: 'cover', border: '2px solid #fed7aa' }} />
                : <div style={{ width: 44, height: 44, borderRadius: 11, background: 'linear-gradient(135deg,#f97316,#fbbf24)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff' }}>{initials}</div>
              }
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#111827' }}>{workerName}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {profile.gender || '—'} · {profile.address?.city || '—'}{profile.address?.pincode ? `, ${profile.address.pincode}` : ''}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
              {[
                { icon: Phone,    v: profile.mobile || '—' },
                { icon: MapPin,   v: profile.address?.locality || profile.address?.city || '—' },
                { icon: BookOpen, v: profile.education || '—' },
                { icon: Shield,   v: `ID: ${karigarId}` },
              ].map(({ icon: IC, v }, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280', background: '#fff7ed', padding: '5px 11px', borderRadius: 9, fontWeight: 500 }}>
                  <IC size={12} color="#f97316" />{v}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Near Clients section header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: '#111827', margin: 0 }}>
            Near Clients <span style={{ color: '#f97316' }}>({nearClients.length})</span>
          </h2>
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2, fontWeight: 500 }}>
            Clients in {profile?.address?.city || 'your city'} who have posted jobs
          </p>
        </div>
        {refreshing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#f97316', fontWeight: 600 }}>
            <RefreshCw size={12} style={{ animation: 'wd-spin 0.8s linear infinite' }} />
            Refreshing…
          </div>
        )}
      </div>

      {/* ── Near Clients list ── */}
      {loading ? (
        <div className="wd-g3">
          {[1, 2, 3].map(i => <Skel key={i} h={260} />)}
        </div>
      ) : nearClients.length > 0 ? (
        <div className="wd-g3">
          {nearClients.map(c => <ClientCard key={c._id} client={c} />)}
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #fed7aa', padding: '50px 24px', textAlign: 'center', boxShadow: '0 1px 10px rgba(251,146,60,0.06)' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <UserCheck size={28} color="#f97316" />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 8 }}>No nearby clients found</h3>
          <p style={{ color: '#6b7280', fontSize: 13, maxWidth: 340, margin: '0 auto', lineHeight: 1.6 }}>
            No clients have posted jobs in {profile?.address?.city || 'your city'} yet. Check back later!
          </p>
        </div>
      )}
    </div>
  );
};

export default WorkerDashboard;
