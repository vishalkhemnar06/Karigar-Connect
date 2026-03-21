// src/pages/worker/MyGroups.jsx
// ENHANCED UI VERSION - All original functionality preserved
// Enhanced with: Modern gradients, animations, glassmorphism, better visual hierarchy, micro-interactions

import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, Trash2, LogOut, Copy, CheckCircle,
  ChevronRight, User, Shield, RefreshCw, AlertTriangle,
  Search, Hash, X, Briefcase, Star, MapPin, ExternalLink,
  Crown, Award, Sparkles, Calendar, Mail, Phone, 
  MessageCircle, Heart, ShieldCheck, Eye, EyeOff,
  Clock, Award as AwardIcon, TrendingUp, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getMyGroupsAPI, addMemberAPI, deleteGroupAPI, leaveGroupAPI } from '../../api';

/* ════════════════════════════════════════════
   TOAST - Enhanced
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
  <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none' }}>
    <AnimatePresence>
      {toasts.map(t => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, x: 50, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 50, scale: 0.9 }}
          style={{
            background: t.type === 'error' ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 
                       t.type === 'info' ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 
                       'linear-gradient(135deg, #22c55e, #16a34a)',
            color: '#fff', padding: '12px 20px', borderRadius: 14, fontWeight: 700, fontSize: 13,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 10,
            minWidth: 220, fontFamily: 'inherit', backdropFilter: 'blur(10px)',
          }}
        >
          <span style={{ fontSize: 16 }}>{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}</span>
          {t.msg}
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

/* ════════════════════════════════════════════
   CONFIRM DIALOG - Enhanced
════════════════════════════════════════════ */
const ConfirmDialog = ({ message, onConfirm, onCancel, danger = true }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(8px)', padding: 20,
    }}
    onClick={onCancel}
  >
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      style={{
        background: '#fff', borderRadius: 24, padding: '32px 28px 28px',
        maxWidth: 380, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
        fontFamily: 'inherit',
      }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <motion.div
          animate={{ rotate: danger ? [0, -5, 5, 0] : [0, 10, -10, 0] }}
          transition={{ duration: 0.5 }}
          style={{
            width: 48, height: 48, borderRadius: 16,
            background: danger ? '#fef2f2' : '#fff7ed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <AlertTriangle size={24} color={danger ? '#ef4444' : '#f97316'} />
        </motion.div>
        <p style={{ fontSize: 16, fontWeight: 800, color: '#111827', margin: 0, lineHeight: 1.4 }}>{message}</p>
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onCancel}
          style={{
            padding: '10px 22px', borderRadius: 12, border: '1.5px solid #e5e7eb',
            background: '#fff', fontSize: 13, fontWeight: 700, color: '#6b7280',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s'
          }}
        >
          Cancel
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onConfirm}
          style={{
            padding: '10px 22px', borderRadius: 12, border: 'none',
            background: danger ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #f97316, #fbbf24)',
            fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit'
          }}
        >
          Confirm
        </motion.button>
      </div>
    </motion.div>
  </motion.div>
);

/* ════════════════════════════════════════════
   MEMBER PROFILE MODAL - Enhanced
════════════════════════════════════════════ */
const MemberProfileModal = ({ member, isGroupAdmin, onClose, navigate }) => {
  if (!member) return null;

  const skills = Array.isArray(member.skills)
    ? member.skills.map(s => typeof s === 'object' ? s.name : s)
    : [];

  const memberSince = member.createdAt ? new Date(member.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, backdropFilter: 'blur(8px)', padding: 20,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        style={{
          background: '#fff', borderRadius: 28, width: '100%', maxWidth: 440,
          overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.25)',
          fontFamily: 'inherit',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header with gradient */}
        <div style={{
          background: 'linear-gradient(135deg, #f97316, #fbbf24)',
          padding: '28px 28px 24px', position: 'relative'
        }}>
          <motion.button
            whileHover={{ scale: 1.05, rotate: 90 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            style={{
              position: 'absolute', top: 18, right: 18,
              background: 'rgba(255,255,255,0.2)', border: 'none',
              borderRadius: 12, padding: 8, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(4px)'
            }}
          >
            <X size={18} color="#fff" />
          </motion.button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {member.photo ? (
              <motion.img
                whileHover={{ scale: 1.05 }}
                src={member.photo}
                alt={member.name}
                style={{
                  width: 80, height: 80, borderRadius: 24,
                  objectFit: 'cover', border: '3px solid rgba(255,255,255,0.5)',
                  flexShrink: 0, boxShadow: '0 8px 20px rgba(0,0,0,0.1)'
                }}
              />
            ) : (
              <div style={{
                width: 80, height: 80, borderRadius: 24,
                background: 'rgba(255,255,255,0.2)', border: '3px solid rgba(255,255,255,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, backdropFilter: 'blur(4px)'
              }}>
                <User size={36} color="#fff" />
              </div>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <h3 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0 }}>{member.name}</h3>
                {isGroupAdmin && (
                  <span style={{
                    background: 'rgba(255,255,255,0.25)', color: '#fff',
                    fontSize: 10, fontWeight: 800, padding: '3px 10px',
                    borderRadius: 99, display: 'flex', alignItems: 'center',
                    gap: 4, border: '1px solid rgba(255,255,255,0.3)'
                  }}>
                    <Shield size={10} /> ADMIN
                  </span>
                )}
              </div>
              <p style={{
                fontSize: 13, color: 'rgba(255,255,255,0.9)',
                fontFamily: 'monospace', margin: 0, fontWeight: 600
              }}>
                {member.karigarId}
              </p>
              {memberSince && (
                <p style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.8)',
                  margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: 4
                }}>
                  <Calendar size={10} /> Member since {memberSince}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 28px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Skills */}
          {skills.length > 0 && (
            <div>
              <p style={{
                fontSize: 11, fontWeight: 800, color: '#9ca3af',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6
              }}>
                <Briefcase size={12} /> EXPERTISE
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {skills.map((s, i) => (
                  <motion.span
                    key={i}
                    whileHover={{ scale: 1.05 }}
                    style={{
                      background: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
                      color: '#c2410c', fontSize: 12, fontWeight: 700,
                      padding: '6px 14px', borderRadius: 99,
                      border: '1px solid #fed7aa', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                  >
                    {s}
                  </motion.span>
                ))}
              </div>
            </div>
          )}

          {/* Experience */}
          {member.experience && (
            <motion.div
              whileHover={{ scale: 1.02 }}
              style={{
                background: 'linear-gradient(135deg, #f9fafb, #f3f4f6)',
                borderRadius: 16, padding: '14px 18px',
                display: 'flex', alignItems: 'center', gap: 12
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'linear-gradient(135deg, #f97316, #fbbf24)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Star size={20} color="#fff" />
              </div>
              <div>
                <p style={{ fontSize: 12, color: '#6b7280', margin: 0, fontWeight: 500 }}>Experience</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: 0 }}>
                  {member.experience} years
                </p>
              </div>
            </motion.div>
          )}

          {/* View full profile button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { onClose(); navigate(`/profile/public/${member.karigarId}`); }}
            style={{
              width: '100%', background: 'linear-gradient(135deg, #f97316, #fbbf24)',
              border: 'none', borderRadius: 18, padding: '14px',
              color: '#fff', fontSize: 14, fontWeight: 800,
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 10, fontFamily: 'inherit',
              boxShadow: '0 6px 20px rgba(249,115,22,0.3)'
            }}
          >
            <ExternalLink size={16} /> View Full Profile
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ════════════════════════════════════════════
   SKELETON - Enhanced
════════════════════════════════════════════ */
const Skel = ({ h = 200 }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    style={{
      height: h, borderRadius: 24,
      background: 'linear-gradient(90deg, #fff7ed 25%, #ffedd5 50%, #fff7ed 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }}
  />
);

/* ════════════════════════════════════════════
   MEMBER AVATAR - Enhanced
════════════════════════════════════════════ */
const MemberAvatar = ({ member }) => {
  const initials = (member.name || 'M').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return member.photo
    ? <img src={member.photo} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
    : <span style={{ fontSize: 14, fontWeight: 800, color: '#c2410c' }}>{initials}</span>;
};

/* ════════════════════════════════════════════
   GROUP CARD - Enhanced
════════════════════════════════════════════ */
const GroupCard = ({ group, onRefresh, toast, idx, onViewMember }) => {
  const [memberId,   setMemberId]   = useState('');
  const [adding,     setAdding]     = useState(false);
  const [addOpen,    setAddOpen]    = useState(false);
  const [confirm,    setConfirm]    = useState(null);
  const [copiedId,   setCopiedId]   = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [showMembers, setShowMembers] = useState(true);

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

  const memberCount   = group.members?.length || 0;
  const creatorId     = group.creator?._id || group.creator;

  return (
    <>
      <AnimatePresence>
        {confirm && (
          <ConfirmDialog
            message={confirm.message}
            danger={confirm.action === 'delete'}
            onConfirm={confirm.action === 'delete' ? doDelete : doLeave}
            onCancel={() => setConfirm(null)}
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * 0.05 }}
        whileHover={{ y: -4 }}
        style={{
          background: '#fff', borderRadius: 28, border: '1px solid #fed7aa',
          overflow: 'hidden', boxShadow: '0 4px 20px rgba(251,146,60,0.08)',
          transition: 'box-shadow 0.3s ease'
        }}
      >
        {/* Header with enhanced gradient */}
        <div style={{
          background: 'linear-gradient(135deg, #f97316, #fbbf24)',
          padding: '24px 28px', position: 'relative', overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute', top: -20, right: -20, width: 120, height: 120,
            background: 'rgba(255,255,255,0.1)', borderRadius: '50%'
          }} />
          <div style={{
            position: 'absolute', bottom: -30, left: -30, width: 150, height: 150,
            background: 'rgba(255,255,255,0.05)', borderRadius: '50%'
          }} />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.2 }}>
                  {group.name}
                </h2>
                {group.isAdmin && (
                  <span style={{
                    background: 'rgba(255,255,255,0.25)', color: '#fff',
                    fontSize: 11, fontWeight: 800, padding: '4px 12px',
                    borderRadius: 99, display: 'flex', alignItems: 'center',
                    gap: 6, border: '1px solid rgba(255,255,255,0.3)',
                    backdropFilter: 'blur(4px)'
                  }}>
                    <Shield size={12} /> ADMIN
                  </span>
                )}
              </div>
              {group.description && (
                <p style={{
                  fontSize: 13, color: 'rgba(255,255,255,0.9)',
                  marginBottom: 16, lineHeight: 1.5
                }}>
                  {group.description}
                </p>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={copy}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: 12, padding: '8px 16px', cursor: 'pointer',
                    color: '#fff', fontSize: 12, fontWeight: 700,
                    fontFamily: 'monospace', transition: 'background 0.2s'
                  }}
                >
                  {copiedId ? <CheckCircle size={14} /> : <Copy size={14} />}
                  {group.groupId || group._id}
                </motion.button>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'rgba(255,255,255,0.2)', borderRadius: 12,
                  padding: '8px 16px', fontSize: 12, fontWeight: 700,
                  color: '#fff', border: '1px solid rgba(255,255,255,0.2)'
                }}>
                  <Users size={14} />{memberCount} member{memberCount !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Members section */}
        <div style={{ padding: '24px 28px' }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', marginBottom: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Users size={16} color="#f97316" />
              </div>
              <p style={{
                fontSize: 13, fontWeight: 800, color: '#9ca3af',
                textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0
              }}>
                Team Members
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowMembers(!showMembers)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, color: '#f97316', fontWeight: 600
              }}
            >
              {showMembers ? <EyeOff size={12} /> : <Eye size={12} />}
              {showMembers ? 'Hide' : 'Show'}
            </motion.button>
          </div>

          <AnimatePresence>
            {showMembers && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                {memberCount === 0 ? (
                  <div style={{
                    textAlign: 'center', padding: '32px 20px',
                    background: '#f9fafb', borderRadius: 16,
                    color: '#9ca3af', fontSize: 13, fontWeight: 500
                  }}>
                    <Users size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
                    <p>No members yet</p>
                  </div>
                ) : (
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 12, marginBottom: 20
                  }}>
                    {group.members.map((member, i) => {
                      const isAdmin = member._id?.toString() === creatorId?.toString();
                      return (
                        <motion.button
                          key={member._id || i}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.03 }}
                          whileHover={{ scale: 1.02, y: -2 }}
                          onClick={() => onViewMember(member, isAdmin)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '12px 14px', background: '#fff7ed',
                            border: '1.5px solid #fed7aa', borderRadius: 16,
                            cursor: 'pointer', transition: 'all 0.2s',
                            textAlign: 'left', fontFamily: 'inherit', width: '100%'
                          }}
                        >
                          <div style={{
                            width: 44, height: 44, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #ffedd5, #fed7aa)',
                            border: '2px solid #fed7aa', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden', flexShrink: 0, position: 'relative'
                          }}>
                            <MemberAvatar member={member} />
                            {isAdmin && (
                              <div style={{
                                position: 'absolute', bottom: -2, right: -2,
                                width: 16, height: 16, background: '#f97316',
                                borderRadius: '50%', border: '2px solid #fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}>
                                <Shield size={8} color="#fff" />
                              </div>
                            )}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{
                              fontSize: 14, fontWeight: 800, color: '#111827',
                              margin: 0, overflow: 'hidden', textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {member.name}
                            </p>
                            <p style={{
                              fontSize: 11, color: '#9ca3af',
                              fontFamily: 'monospace', margin: '2px 0 0',
                              fontWeight: 600
                            }}>
                              {member.karigarId}
                            </p>
                          </div>
                          <ChevronRight size={16} color="#f97316" />
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Admin controls - Enhanced */}
          {group.isAdmin ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
                border: '1.5px solid #fed7aa', borderRadius: 20,
                padding: '18px 20px', marginTop: 8
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14
              }}>
                <Shield size={14} color="#f97316" />
                <p style={{
                  fontSize: 11, fontWeight: 800, color: '#9ca3af',
                  textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0
                }}>
                  Admin Controls
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <AnimatePresence mode="wait">
                  {addOpen ? (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' }}
                    >
                      <div style={{ position: 'relative', flex: '1 1 200px' }}>
                        <Hash size={14} color="#f97316" style={{
                          position: 'absolute', left: 12, top: '50%',
                          transform: 'translateY(-50%)', pointerEvents: 'none'
                        }} />
                        <input
                          value={memberId}
                          onChange={e => setMemberId(e.target.value)}
                          placeholder="Karigar ID (e.g., K123456)"
                          onKeyDown={e => e.key === 'Enter' && doAddMember()}
                          autoFocus
                          style={{
                            width: '100%', padding: '10px 12px 10px 36px',
                            border: '2px solid #fed7aa', borderRadius: 14,
                            fontSize: 12, fontFamily: 'monospace', fontWeight: 600,
                            background: '#fff', outline: 'none', color: '#111827',
                            transition: 'border-color 0.2s'
                          }}
                        />
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={doAddMember}
                        disabled={adding}
                        style={{
                          padding: '10px 20px', borderRadius: 14, border: 'none',
                          background: 'linear-gradient(135deg, #f97316, #fbbf24)',
                          color: '#fff', fontSize: 12, fontWeight: 700,
                          cursor: adding ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', gap: 6,
                          fontFamily: 'inherit'
                        }}
                      >
                        {adding ? (
                          <div style={{
                            width: 14, height: 14, border: '2px solid rgba(255,255,255,0.35)',
                            borderTop: '2px solid #fff', borderRadius: '50%',
                            animation: 'spin 0.7s linear infinite'
                          }} />
                        ) : <UserPlus size={14} />}
                        {adding ? 'Adding…' : 'Add'}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { setAddOpen(false); setMemberId(''); }}
                        style={{
                          padding: '10px 18px', borderRadius: 14,
                          border: '1.5px solid #e5e7eb', background: '#fff',
                          fontSize: 12, fontWeight: 700, color: '#6b7280',
                          cursor: 'pointer', fontFamily: 'inherit'
                        }}
                      >
                        Cancel
                      </motion.button>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="add-btn"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setAddOpen(true)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 20px', borderRadius: 14,
                        border: '1.5px solid #fed7aa', background: '#fff',
                        fontSize: 12, fontWeight: 700, color: '#f97316',
                        cursor: 'pointer', fontFamily: 'inherit'
                      }}
                    >
                      <UserPlus size={14} />Add Member
                    </motion.button>
                  )}
                </AnimatePresence>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setConfirm({ action: 'delete', message: `Permanently delete "${group.name}"? This cannot be undone.` })}
                  disabled={actionBusy}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 20px', borderRadius: 14,
                    border: '1.5px solid #fecaca', background: '#fff',
                    fontSize: 12, fontWeight: 700, color: '#ef4444',
                    cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto'
                  }}
                >
                  <Trash2 size={14} />Delete Group
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', background: '#f9fafb',
                border: '1.5px solid #e5e7eb', borderRadius: 18,
                padding: '14px 20px', flexWrap: 'wrap', gap: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: '#22c55e', boxShadow: '0 0 0 2px #bbf7d0'
                }} />
                <p style={{ fontSize: 13, color: '#6b7280', fontWeight: 600, margin: 0 }}>
                  You are a member of this group
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setConfirm({ action: 'leave', message: `Leave "${group.name}"? You won't be able to rejoin without an admin invite.` })}
                disabled={actionBusy}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 20px', borderRadius: 12,
                  border: '1.5px solid #e5e7eb', background: '#fff',
                  fontSize: 12, fontWeight: 700, color: '#6b7280',
                  cursor: 'pointer', fontFamily: 'inherit'
                }}
              >
                <LogOut size={14} />Leave Group
              </motion.button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </>
  );
};

/* ════════════════════════════════════════════
   MAIN - Enhanced
════════════════════════════════════════════ */
export default function MyGroups() {
  const navigate = useNavigate();
  const [groups,     setGroups]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');
  const [viewMember, setViewMember] = useState(null);
  const toast = useToast();

  const fetchGroups = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const res = await getMyGroupsAPI();
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
  const totalPoints = groups.reduce((sum, g) => sum + (g.totalPoints || 0), 0);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
      minHeight: '100%', padding: '28px 24px', fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes shimmer { to { background-position: -200% 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <ToastList toasts={toast.toasts} />

      <AnimatePresence>
        {viewMember && (
          <MemberProfileModal
            member={viewMember.member}
            isGroupAdmin={viewMember.isAdmin}
            onClose={() => setViewMember(null)}
            navigate={navigate}
          />
        )}
      </AnimatePresence>

      {/* Enhanced Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          marginBottom: 28, flexWrap: 'wrap', gap: 16
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 20,
              background: 'linear-gradient(135deg, #f97316, #fbbf24)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(249,115,22,0.25)'
            }}>
              <Users size={24} color="#fff" />
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111827', margin: 0 }}>
              My Work Groups
            </h1>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16,
            flexWrap: 'wrap', marginTop: 4
          }}>
            <span style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 13, color: '#6b7280', fontWeight: 600,
              background: '#fff', padding: '6px 14px', borderRadius: 99,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
              <Users size={14} /> {groups.length} Groups
            </span>
            <span style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 13, color: '#6b7280', fontWeight: 600,
              background: '#fff', padding: '6px 14px', borderRadius: 99,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
              <Shield size={14} /> {adminCount} Admin
            </span>
            <span style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 13, color: '#6b7280', fontWeight: 600,
              background: '#fff', padding: '6px 14px', borderRadius: 99,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
              <User size={14} /> {memberCount} Member
            </span>
            {totalPoints > 0 && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 13, color: '#f97316', fontWeight: 700,
                background: '#fff', padding: '6px 14px', borderRadius: 99,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}>
                <TrendingUp size={14} /> +{totalPoints} Points
              </span>
            )}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <motion.button
            whileHover={{ scale: 1.05, rotate: 180 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => fetchGroups(true)}
            disabled={refreshing}
            style={{
              background: '#fff', border: '1.5px solid #fed7aa',
              borderRadius: 14, padding: '10px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}
            title="Refresh"
          >
            <RefreshCw size={18} color="#f97316" style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          </motion.button>
          
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link to="/worker/create-group"
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 24px', background: 'linear-gradient(135deg, #f97316, #fbbf24)',
                color: '#fff', borderRadius: 16, fontSize: 14, fontWeight: 800,
                textDecoration: 'none', boxShadow: '0 6px 20px rgba(249,115,22,0.35)',
                transition: 'all 0.2s'
              }}
            >
              <UserPlus size={18} />Create Group
            </Link>
          </motion.div>
        </div>
      </motion.div>

      {/* Enhanced Search */}
      {!loading && groups.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ position: 'relative', marginBottom: 24, maxWidth: 420 }}
        >
          <Search size={18} color="#f97316" style={{
            position: 'absolute', left: 16, top: '50%',
            transform: 'translateY(-50%)', pointerEvents: 'none'
          }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search groups by name or description..."
            style={{
              width: '100%', padding: '14px 18px 14px 48px',
              border: '2px solid #fed7aa', borderRadius: 20,
              fontSize: 14, fontFamily: 'inherit', fontWeight: 500,
              background: '#fff', outline: 'none', color: '#111827',
              transition: 'border-color 0.2s, box-shadow 0.2s'
            }}
            onFocus={e => { e.target.style.borderColor = '#f97316'; e.target.style.boxShadow = '0 0 0 4px rgba(249,115,22,0.1)'; }}
            onBlur={e => { e.target.style.borderColor = '#fed7aa'; e.target.style.boxShadow = 'none'; }}
          />
        </motion.div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {[1, 2, 3].map(i => <Skel key={i} h={280} />)}
        </div>
      ) : groups.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            background: '#fff', borderRadius: 32, border: '1px solid #fed7aa',
            padding: '64px 32px', textAlign: 'center', boxShadow: '0 8px 32px rgba(251,146,60,0.08)'
          }}
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              width: 96, height: 96, borderRadius: '50%',
              background: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
              border: '2px solid #fed7aa', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px'
            }}
          >
            <Users size={44} color="#f97316" />
          </motion.div>
          <h3 style={{ fontSize: 24, fontWeight: 900, color: '#111827', marginBottom: 12 }}>
            No Groups Yet
          </h3>
          <p style={{ color: '#6b7280', fontSize: 14, maxWidth: 360, margin: '0 auto 28px', lineHeight: 1.6 }}>
            Create your first work group to collaborate with other karigars and manage projects together.
          </p>
          <Link to="/worker/create-group"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: 'linear-gradient(135deg, #f97316, #fbbf24)',
              color: '#fff', borderRadius: 18, padding: '14px 32px',
              fontSize: 15, fontWeight: 800, textDecoration: 'none',
              boxShadow: '0 6px 20px rgba(249,115,22,0.35)'
            }}
          >
            <UserPlus size={18} /> Create Your First Group
          </Link>
        </motion.div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            background: '#fff', borderRadius: 32, border: '1px solid #fed7aa',
            padding: '56px 32px', textAlign: 'center'
          }}
        >
          <p style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 12 }}>
            No results for "{search}"
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSearch('')}
            style={{
              background: 'linear-gradient(135deg, #f97316, #fbbf24)',
              color: '#fff', border: 'none', fontWeight: 700,
              padding: '12px 28px', borderRadius: 16, fontSize: 14,
              cursor: 'pointer', fontFamily: 'inherit', marginTop: 8
            }}
          >
            Clear Search
          </motion.button>
        </motion.div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {filtered.map((group, idx) => (
            <GroupCard
              key={group._id}
              group={group}
              idx={idx}
              onRefresh={() => fetchGroups(true)}
              toast={toast}
              onViewMember={(member, isAdmin) => setViewMember({ member, isAdmin })}
            />
          ))}
        </div>
      )}
    </div>
  );
}