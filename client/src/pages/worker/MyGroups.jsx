// src/pages/worker/MyGroups.jsx
// FIXES:
//   1. Import from "../../api" (groupService.js deleted)
//   2. toast replaced with self-contained toast (no react-hot-toast dep)
//   3. getImageUrl() undefined reference removed — uses member.photo directly
//   4. window.confirm replaced with inline confirmation UI (better UX + mobile friendly)
//   5. newMemberId is per-group (not shared state) — adding to one group doesn't
//      bleed into another
//   6. Content-only — no sidebar/layout wrapper

import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, UserPlus, Trash2, LogOut, Copy, CheckCircle,
  ChevronRight, User, Shield, RefreshCw, AlertTriangle,
  Search, Hash,
} from 'lucide-react';
import { getMyGroupsAPI, addMemberAPI, deleteGroupAPI, leaveGroupAPI } from '../../api';

/* ════════════════════════════════════════════
   TOAST
════════════════════════════════════════════ */
let _tid = 0;
const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg, type = 'success') => {
    const id = ++_tid;
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);
  return { toasts, success: m => show(m, 'success'), error: m => show(m, 'error'), info: m => show(m, 'info') };
};

const ToastList = ({ toasts }) => (
  <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
    {toasts.map(t => (
      <div key={t.id} style={{
        background: t.type === 'error' ? '#ef4444' : t.type === 'info' ? '#3b82f6' : '#22c55e',
        color: '#fff', padding: '11px 18px', borderRadius: 12, fontWeight: 700, fontSize: 13,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 8,
        minWidth: 200, fontFamily: 'inherit', animation: 'mg-in 0.3s ease',
      }}>
        {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'} {t.msg}
      </div>
    ))}
  </div>
);

/* ════════════════════════════════════════════
   CONFIRM DIALOG (replaces window.confirm)
════════════════════════════════════════════ */
const ConfirmDialog = ({ message, onConfirm, onCancel, danger = true }) => (
  <div style={{
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, backdropFilter: 'blur(3px)', padding: 20,
  }}>
    <div style={{
      background: '#fff', borderRadius: 20, padding: '28px 28px 24px',
      maxWidth: 360, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      animation: 'mg-pop 0.25s ease', fontFamily: 'inherit',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: danger ? '#fef2f2' : '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <AlertTriangle size={20} color={danger ? '#ef4444' : '#f97316'} />
        </div>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.4 }}>{message}</p>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onCancel}
          style={{ padding: '9px 20px', borderRadius: 11, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 700, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit' }}
          onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
          onMouseLeave={e => e.currentTarget.style.background = '#fff'}
        >Cancel</button>
        <button onClick={onConfirm}
          style={{ padding: '9px 20px', borderRadius: 11, border: 'none', background: danger ? '#ef4444' : '#f97316', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >Confirm</button>
      </div>
    </div>
  </div>
);

/* ════════════════════════════════════════════
   SKELETON
════════════════════════════════════════════ */
const Skel = ({ h = 200 }) => (
  <div style={{
    height: h, borderRadius: 20,
    background: 'linear-gradient(90deg,#fff7ed 25%,#ffedd5 50%,#fff7ed 75%)',
    backgroundSize: '200% 100%', animation: 'mg-shimmer 1.4s infinite',
  }} />
);

/* ════════════════════════════════════════════
   MEMBER AVATAR
════════════════════════════════════════════ */
const MemberAvatar = ({ member }) => {
  const initials = (member.name || 'M').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return member.photo
    ? <img src={member.photo} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
    : <span style={{ fontSize: 13, fontWeight: 800, color: '#c2410c' }}>{initials}</span>;
};

/* ════════════════════════════════════════════
   GROUP CARD
════════════════════════════════════════════ */
const GroupCard = ({ group, onRefresh, toast, idx }) => {
  const [memberId,   setMemberId]   = useState('');
  const [adding,     setAdding]     = useState(false);
  const [addOpen,    setAddOpen]    = useState(false);
  const [confirm,    setConfirm]    = useState(null); // { action, message }
  const [copiedId,   setCopiedId]   = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(group.groupId || group._id);
    setCopiedId(true);
    toast.info('Group ID copied!');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const doAddMember = async () => {
    if (!memberId.trim()) { toast.error('Please enter a Karigar ID'); return; }
    setAdding(true);
    try {
      await addMemberAPI(group.groupId || group._id, memberId.trim());
      toast.success('Member added successfully!');
      setMemberId('');
      setAddOpen(false);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Error adding member');
    } finally {
      setAdding(false);
    }
  };

  const doDelete = async () => {
    setConfirm(null);
    setActionBusy(true);
    try {
      await deleteGroupAPI(group.groupId || group._id);
      toast.success('Group deleted');
      onRefresh();
    } catch {
      toast.error('Failed to delete group');
    } finally {
      setActionBusy(false);
    }
  };

  const doLeave = async () => {
    setConfirm(null);
    setActionBusy(true);
    try {
      await leaveGroupAPI(group.groupId || group._id);
      toast.success('You left the group');
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Error leaving group');
    } finally {
      setActionBusy(false);
    }
  };

  const memberCount = group.members?.length || 0;

  return (
    <>
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          danger={confirm.action === 'delete'}
          onConfirm={confirm.action === 'delete' ? doDelete : doLeave}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div style={{
        background: '#fff', borderRadius: 20, border: '1px solid #fed7aa',
        overflow: 'hidden', boxShadow: '0 2px 16px rgba(251,146,60,0.07)',
        transition: 'box-shadow 0.2s, transform 0.2s',
        animation: `mg-fadeUp 0.4s ease ${idx * 0.08}s both`,
      }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 36px rgba(251,146,60,0.16)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 16px rgba(251,146,60,0.07)'; e.currentTarget.style.transform = 'none'; }}
      >
        {/* ── Card header ── */}
        <div style={{ background: 'linear-gradient(135deg,#f97316,#fbbf24)', padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.2 }}>{group.name}</h2>
                {group.isAdmin && (
                  <span style={{ background: 'rgba(255,255,255,0.22)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 4, border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(4px)', whiteSpace: 'nowrap' }}>
                    <Shield size={9} />ADMIN
                  </span>
                )}
              </div>
              {group.description && (
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.82)', marginBottom: 12, lineHeight: 1.5, margin: '0 0 12px' }}>{group.description}</p>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {/* Group ID copy */}
                <button onClick={copy}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'monospace', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.28)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
                >
                  {copiedId ? <CheckCircle size={13} /> : <Copy size={13} />}
                  {group.groupId || group._id}
                </button>
                {/* Member count */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.18)', borderRadius: 10, padding: '6px 12px', fontSize: 12, fontWeight: 700, color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <Users size={13} />{memberCount} member{memberCount !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Members grid ── */}
        <div style={{ padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.09em', margin: 0 }}>
              Team Members
            </p>
            <span style={{ background: '#fff7ed', color: '#c2410c', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 99, border: '1px solid #fed7aa' }}>
              {memberCount} active
            </span>
          </div>

          {memberCount === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af', fontSize: 13, fontWeight: 500 }}>
              No members yet
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>
              {group.members.map((member, i) => (
                <Link
                  key={member._id || i}
                  to={`/profile/public/${member.karigarId}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 13,
                    textDecoration: 'none', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#ffedd5'; e.currentTarget.style.borderColor = '#fb923c'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff7ed'; e.currentTarget.style.borderColor = '#fed7aa'; }}
                >
                  {/* avatar */}
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#ffedd5', border: '2px solid #fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    <MemberAvatar member={member} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</p>
                    <p style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace', margin: '1px 0 0', fontWeight: 600 }}>{member.karigarId}</p>
                  </div>
                  <ChevronRight size={14} color="#f97316" />
                </Link>
              ))}
            </div>
          )}

          {/* ── Admin controls ── */}
          {group.isAdmin ? (
            <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 14, padding: '14px 16px' }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Shield size={10} color="#f97316" />Admin Controls
              </p>

              {/* Add member row */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {addOpen ? (
                  <>
                    <div style={{ position: 'relative', flex: '1 1 180px' }}>
                      <Hash size={14} color="#f97316" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                      <input
                        value={memberId}
                        onChange={e => setMemberId(e.target.value)}
                        placeholder="Karigar ID (e.g. K123456)"
                        onKeyDown={e => e.key === 'Enter' && doAddMember()}
                        autoFocus
                        style={{
                          width: '100%', padding: '9px 12px 9px 34px', border: '2px solid #fed7aa',
                          borderRadius: 11, fontSize: 12, fontFamily: 'monospace', fontWeight: 600,
                          background: '#fff', outline: 'none', color: '#111827', boxSizing: 'border-box',
                          transition: 'border-color 0.15s',
                        }}
                        onFocus={e => e.target.style.borderColor = '#f97316'}
                        onBlur={e => e.target.style.borderColor = '#fed7aa'}
                      />
                    </div>
                    <button onClick={doAddMember} disabled={adding}
                      style={{ padding: '9px 16px', borderRadius: 11, border: 'none', background: 'linear-gradient(135deg,#f97316,#fbbf24)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: adding ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                      {adding
                        ? <div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.35)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'mg-spin 0.7s linear infinite' }} />
                        : <UserPlus size={13} />
                      }
                      {adding ? 'Adding…' : 'Add'}
                    </button>
                    <button onClick={() => { setAddOpen(false); setMemberId(''); }}
                      style={{ padding: '9px 14px', borderRadius: 11, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 700, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit' }}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button onClick={() => setAddOpen(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 11, border: '1.5px solid #fed7aa', background: '#fff', fontSize: 12, fontWeight: 700, color: '#f97316', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fff7ed'; e.currentTarget.style.borderColor = '#fb923c'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#fed7aa'; }}
                  >
                    <UserPlus size={13} />Add Member
                  </button>
                )}

                {/* Delete group */}
                <button
                  onClick={() => setConfirm({ action: 'delete', message: `Permanently delete "${group.name}"? This cannot be undone.` })}
                  disabled={actionBusy}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 11, border: '1.5px solid #fecaca', background: '#fff', fontSize: 12, fontWeight: 700, color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', marginLeft: 'auto' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                >
                  <Trash2 size={13} />Delete Group
                </button>
              </div>
            </div>
          ) : (
            /* ── Member view ── */
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 13, padding: '12px 16px', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
                <p style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, margin: 0 }}>You are a member of this group</p>
              </div>
              <button
                onClick={() => setConfirm({ action: 'leave', message: `Leave "${group.name}"? You won't be able to rejoin without an admin invite.` })}
                disabled={actionBusy}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 11, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 700, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#fca5a5'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
              >
                <LogOut size={13} />Leave Group
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

/* ════════════════════════════════════════════
   MAIN — content only
════════════════════════════════════════════ */
export default function MyGroups() {
  const [groups,    setGroups]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [search,    setSearch]    = useState('');
  const toast = useToast();

  const fetchGroups = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const res = await getMyGroupsAPI(); // GET /worker/groups or similar
      setGroups(res.data || []);
    } catch (err) {
      console.error('fetchGroups error:', err);
      if (!silent) toast.error('Could not load groups.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const filtered = groups.filter(g =>
    !search || g.name?.toLowerCase().includes(search.toLowerCase()) ||
    g.description?.toLowerCase().includes(search.toLowerCase())
  );

  const adminCount  = groups.filter(g => g.isAdmin).length;
  const memberCount = groups.filter(g => !g.isAdmin).length;

  return (
    <div style={{ background: '#fff7ed', minHeight: '100%', padding: '24px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes mg-shimmer { to { background-position: -200% 0; } }
        @keyframes mg-in      { from { transform: translateX(30px); opacity: 0; } to { transform: none; opacity: 1; } }
        @keyframes mg-fadeUp  { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        @keyframes mg-pop     { 0% { transform: scale(0.88); opacity: 0; } 70% { transform: scale(1.02); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes mg-spin    { to { transform: rotate(360deg); } }
      `}</style>

      <ToastList toasts={toast.toasts} />

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: 0 }}>My Work Groups</h1>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            {groups.length} group{groups.length !== 1 ? 's' : ''} · {adminCount} as admin · {memberCount} as member
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => fetchGroups(true)} disabled={refreshing}
            style={{ background: '#fff', border: '1.5px solid #fed7aa', borderRadius: 11, padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#fff7ed'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            title="Refresh"
          >
            <RefreshCw size={15} color="#f97316" style={{ animation: refreshing ? 'mg-spin 0.8s linear infinite' : 'none' }} />
          </button>
          <Link to="/worker/create-group"
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px',
              background: 'linear-gradient(135deg,#f97316,#fbbf24)', color: '#fff',
              borderRadius: 13, fontSize: 13, fontWeight: 800, textDecoration: 'none',
              boxShadow: '0 3px 14px rgba(249,115,22,0.28)', transition: 'opacity 0.15s, transform 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
          >
            <UserPlus size={15} />Create Group
          </Link>
        </div>
      </div>

      {/* ── Search (only if groups exist) ── */}
      {!loading && groups.length > 0 && (
        <div style={{ position: 'relative', marginBottom: 20, maxWidth: 380 }}>
          <Search size={15} color="#f97316" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search groups…"
            style={{
              width: '100%', padding: '10px 14px 10px 36px', border: '2px solid #fed7aa',
              borderRadius: 12, fontSize: 13, fontFamily: 'inherit', fontWeight: 500,
              background: '#fff', outline: 'none', color: '#111827', boxSizing: 'border-box',
              transition: 'border-color 0.18s',
            }}
            onFocus={e => e.target.style.borderColor = '#f97316'}
            onBlur={e => e.target.style.borderColor = '#fed7aa'}
          />
        </div>
      )}

      {/* ── Loading ── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2].map(i => <Skel key={i} h={260} />)}
        </div>

      ) : groups.length === 0 ? (
        /* ── Empty state ── */
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #fed7aa', padding: '60px 24px', textAlign: 'center', boxShadow: '0 1px 10px rgba(251,146,60,0.06)' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#fff7ed,#ffedd5)', border: '2px solid #fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
            <Users size={30} color="#f97316" />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 8 }}>No Groups Yet</h3>
          <p style={{ color: '#6b7280', fontSize: 13, maxWidth: 320, margin: '0 auto 22px', lineHeight: 1.65 }}>
            Create your first work group to collaborate with other karigars and manage projects together.
          </p>
          <Link to="/worker/create-group"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#f97316,#fbbf24)', color: '#fff', borderRadius: 13, padding: '12px 26px', fontSize: 14, fontWeight: 800, textDecoration: 'none', boxShadow: '0 4px 16px rgba(249,115,22,0.28)' }}>
            <UserPlus size={16} />Create Your First Group
          </Link>
        </div>

      ) : filtered.length === 0 ? (
        /* ── Search empty ── */
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #fed7aa', padding: '50px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 8 }}>No results for "{search}"</p>
          <button onClick={() => setSearch('')}
            style={{ background: 'linear-gradient(135deg,#f97316,#fbbf24)', color: '#fff', border: 'none', fontWeight: 700, padding: '10px 22px', borderRadius: 11, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            Clear search
          </button>
        </div>

      ) : (
        /* ── Group cards ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filtered.map((group, idx) => (
            <GroupCard
              key={group._id}
              group={group}
              idx={idx}
              onRefresh={() => fetchGroups(true)}
              toast={toast}
            />
          ))}
        </div>
      )}
    </div>
  );
}