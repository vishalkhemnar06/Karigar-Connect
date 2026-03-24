// src/pages/worker/MyGroups.jsx
// MOBILE-FRIENDLY VERSION - All original functionality preserved
// Enhanced with: Responsive design, touch-friendly interactions, mobile-optimized layouts

import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, Trash2, LogOut, Copy, CheckCircle,
  ChevronRight, User, Shield, RefreshCw, AlertTriangle,
  Search, Hash, X, Briefcase, Star, MapPin, ExternalLink,
  Crown, Award, Sparkles, Calendar, Mail, Phone, 
  MessageCircle, Heart, ShieldCheck, Eye, EyeOff,
  Clock, Award as AwardIcon, TrendingUp, Zap, ChevronDown, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getMyGroupsAPI, addMemberAPI, deleteGroupAPI, leaveGroupAPI } from '../../api';
const getImage = (path) => {
  if (!path) return null;

  const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

  return path.startsWith("http")
    ? path
    : `${BASE_URL}/${path.replace(/^\/+/, "")}`;
};

/* ════════════════════════════════════════════
   TOAST - Enhanced Mobile
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
  <div className="fixed top-3 left-3 right-3 sm:left-auto sm:right-5 sm:top-5 z-[9999] flex flex-col gap-2 pointer-events-none">
    <AnimatePresence>
      {toasts.map(t => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, x: 50, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 50, scale: 0.9 }}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm text-white shadow-xl ${
            t.type === 'error' ? 'bg-gradient-to-r from-red-500 to-red-600' :
            t.type === 'info' ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
            'bg-gradient-to-r from-green-500 to-emerald-600'
          }`}
        >
          <span className="text-sm">{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}</span>
          {t.msg}
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

/* ════════════════════════════════════════════
   CONFIRM DIALOG - Mobile Optimized
════════════════════════════════════════════ */
const ConfirmDialog = ({ message, onConfirm, onCancel, danger = true }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] backdrop-blur-sm p-4"
    onClick={onCancel}
  >
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 max-w-[380px] w-full shadow-2xl"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center gap-3 sm:gap-4 mb-4">
        <motion.div
          animate={{ rotate: danger ? [0, -5, 5, 0] : [0, 10, -10, 0] }}
          transition={{ duration: 0.5 }}
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 ${
            danger ? 'bg-red-50' : 'bg-orange-50'
          }`}
        >
          <AlertTriangle size={24} color={danger ? '#ef4444' : '#f97316'} />
        </motion.div>
        <p className="text-sm sm:text-base font-bold text-gray-900 leading-relaxed flex-1">{message}</p>
      </div>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 font-bold text-xs sm:text-sm hover:bg-gray-50 transition-all active:scale-95"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white transition-all active:scale-95 ${
            danger ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-orange-500 to-amber-500'
          }`}
        >
          Confirm
        </button>
      </div>
    </motion.div>
  </motion.div>
);

/* ════════════════════════════════════════════
   MEMBER PROFILE MODAL - Mobile Optimized
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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white w-full sm:rounded-3xl max-w-[440px] max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-5 sm:p-7 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 rounded-xl p-2 transition-all active:scale-95"
          >
            <X size={18} className="text-white" />
          </button>
          
          <div className="flex items-center gap-4">
            {member.photo ? (
              <motion.img
                whileHover={{ scale: 1.05 }}
                src={getImage(member.photo)}
                alt={member.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-3 border-white/50 shadow-lg flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/20 border-3 border-white/40 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                <User size={28} className="text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="text-lg sm:text-xl font-black text-white truncate">{member.name}</h3>
                {isGroupAdmin && (
                  <span className="bg-white/25 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 whitespace-nowrap">
                    <Shield size={10} /> ADMIN
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-orange-100 font-mono font-semibold break-all">{member.karigarId}</p>
              {memberSince && (
                <p className="text-[10px] sm:text-xs text-orange-100/80 mt-1 flex items-center gap-1">
                  <Calendar size={10} /> Member since {memberSince}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-7 space-y-5">
          {/* Skills */}
          {skills.length > 0 && (
            <div>
              <p className="text-[10px] sm:text-[11px] font-black text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Briefcase size={12} /> EXPERTISE
              </p>
              <div className="flex flex-wrap gap-2">
                {skills.map((s, i) => (
                  <motion.span
                    key={i}
                    whileHover={{ scale: 1.05 }}
                    className="bg-orange-50 text-orange-700 text-xs sm:text-sm font-bold px-3 py-1.5 rounded-full border border-orange-200 shadow-sm"
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
              className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center flex-shrink-0">
                <Star size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500 font-medium">Experience</p>
                <p className="text-base sm:text-lg font-black text-gray-900">{member.experience} years</p>
              </div>
            </motion.div>
          )}

          {/* View full profile button */}
          <button
            onClick={() => { onClose(); navigate(`/profile/public/${member.karigarId}`); }}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 sm:py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:shadow-lg transition-all active:scale-95"
          >
            <ExternalLink size={14} /> View Full Profile
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ════════════════════════════════════════════
   SKELETON - Mobile Optimized
════════════════════════════════════════════ */
const Skel = ({ h = 200 }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="h-[200px] sm:h-[220px] rounded-2xl sm:rounded-3xl bg-gradient-to-r from-orange-50 via-orange-100 to-orange-50 bg-[length:200%_100%] animate-pulse"
    style={{ height: h }}
  />
);

/* ════════════════════════════════════════════
   MEMBER AVATAR - Enhanced
════════════════════════════════════════════ */
const MemberAvatar = ({ member }) => {
  const initials = (member?.name || 'M')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const [imgError, setImgError] = useState(false);

  const imageSrc = member?.photo && !imgError
    ? getImage(member.photo)
    : null;

  return imageSrc ? (
    <img
      src={imageSrc}
      alt={member.name}
      onError={() => setImgError(true)}
      className="w-full h-full object-cover rounded-full"
    />
  ) : (
    <span className="text-xs sm:text-sm font-black text-orange-700 flex items-center justify-center w-full h-full">
      {initials}
    </span>
  );
};

/* ════════════════════════════════════════════
   GROUP CARD - Mobile Optimized
════════════════════════════════════════════ */
const GroupCard = ({ group, onRefresh, toast, idx, onViewMember }) => {
  const [memberId, setMemberId] = useState('');
  const [adding, setAdding] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [copiedId, setCopiedId] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [showMembers, setShowMembers] = useState(true);
  const [showAdminControls, setShowAdminControls] = useState(false);

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
  const creatorId = group.creator?._id || group.creator;

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
        whileHover={{ y: -2 }}
        className="bg-white rounded-2xl sm:rounded-3xl border border-orange-100 overflow-hidden shadow-md hover:shadow-xl transition-all"
      >
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-5 sm:p-7 relative overflow-hidden">
          <div className="absolute -top-5 -right-5 w-24 h-24 bg-white/10 rounded-full" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />
          
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h2 className="text-lg sm:text-xl font-black text-white break-words">{group.name}</h2>
                  {group.isAdmin && (
                    <span className="bg-white/25 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 whitespace-nowrap">
                      <Shield size={10} /> ADMIN
                    </span>
                  )}
                </div>
                {group.description && (
                  <p className="text-xs sm:text-sm text-orange-100 mb-3 line-clamp-2">{group.description}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={copy}
                    className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl px-3 py-1.5 text-white text-[11px] sm:text-xs font-bold hover:bg-white/30 transition-all active:scale-95"
                  >
                    {copiedId ? <CheckCircle size={12} /> : <Copy size={12} />}
                    <span className="font-mono text-[10px] sm:text-xs truncate max-w-[120px]">{group.groupId || group._id}</span>
                  </button>
                  <div className="flex items-center gap-1.5 bg-white/20 rounded-xl px-3 py-1.5 text-white text-[11px] sm:text-xs font-bold">
                    <Users size={12} />{memberCount} member{memberCount !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Members section */}
        <div className="p-5 sm:p-7">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
                <Users size={14} className="text-orange-500" />
              </div>
              <p className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-wider">Team Members</p>
            </div>
            <button
              onClick={() => setShowMembers(!showMembers)}
              className="flex items-center gap-1 text-orange-500 text-[10px] sm:text-xs font-semibold active:scale-95"
            >
              {showMembers ? <EyeOff size={12} /> : <Eye size={12} />}
              {showMembers ? 'Hide' : 'Show'}
            </button>
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
                  <div className="text-center py-8 bg-gray-50 rounded-xl">
                    <Users size={28} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-xs text-gray-400">No members yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 mb-5">
                    {group.members.slice(0, 5).map((member, i) => {
                      const isAdmin = member._id?.toString() === creatorId?.toString();
                      return (
                        <button
                          key={member._id || i}
                          onClick={() => onViewMember(member, isAdmin)}
                          className="w-full flex items-center gap-3 p-3 bg-orange-50 border border-orange-100 rounded-xl hover:bg-orange-100 transition-all active:scale-98 text-left"
                        >
                          <div className="relative w-10 h-10 rounded-full bg-gradient-to-r from-orange-200 to-amber-200 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-orange-200">
                            <MemberAvatar member={member} />
                            {isAdmin && (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center">
                                <Shield size={8} className="text-white" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-800 truncate">{member.name}</p>
                            <p className="text-[10px] text-gray-500 font-mono truncate">{member.karigarId}</p>
                          </div>
                          <ChevronRight size={14} className="text-orange-400 flex-shrink-0" />
                        </button>
                      );
                    })}
                    {memberCount > 5 && (
                      <p className="text-center text-[10px] text-gray-400 pt-1">+{memberCount - 5} more members</p>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Admin controls - Mobile Optimized */}
          {group.isAdmin ? (
            <div className="mt-4 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4">
              <button
                onClick={() => setShowAdminControls(!showAdminControls)}
                className="w-full flex items-center justify-between text-left mb-3"
              >
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-orange-500" />
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Admin Controls</p>
                </div>
                {showAdminControls ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              
              <AnimatePresence>
                {showAdminControls && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    <AnimatePresence mode="wait">
                      {addOpen ? (
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="space-y-2"
                        >
                          <div className="relative">
                            <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400" />
                            <input
                              value={memberId}
                              onChange={e => setMemberId(e.target.value)}
                              placeholder="Karigar ID (e.g., K123456)"
                              onKeyDown={e => e.key === 'Enter' && doAddMember()}
                              autoFocus
                              className="w-full pl-9 pr-3 py-2.5 border-2 border-orange-200 rounded-xl text-xs font-mono font-semibold bg-white focus:outline-none focus:border-orange-400"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={doAddMember}
                              disabled={adding}
                              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 rounded-xl text-xs font-bold disabled:opacity-50 active:scale-95"
                            >
                              {adding ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                              ) : (
                                <span className="flex items-center justify-center gap-1">
                                  <UserPlus size={12} /> Add
                                </span>
                              )}
                            </button>
                            <button
                              onClick={() => { setAddOpen(false); setMemberId(''); }}
                              className="px-4 py-2 border-2 border-gray-200 rounded-xl text-xs font-bold text-gray-600 active:scale-95"
                            >
                              Cancel
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <button
                          onClick={() => setAddOpen(true)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-orange-200 rounded-xl text-orange-600 text-xs font-bold hover:bg-orange-50 transition-all active:scale-95"
                        >
                          <UserPlus size={14} /> Add Member
                        </button>
                      )}
                    </AnimatePresence>
                    
                    <button
                      onClick={() => setConfirm({ action: 'delete', message: `Permanently delete "${group.name}"? This cannot be undone.` })}
                      disabled={actionBusy}
                      className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-red-200 rounded-xl text-red-500 text-xs font-bold hover:bg-red-50 transition-all active:scale-95"
                    >
                      <Trash2 size={14} /> Delete Group
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm" />
                <p className="text-xs text-gray-600 font-medium">You are a member of this group</p>
              </div>
              <button
                onClick={() => setConfirm({ action: 'leave', message: `Leave "${group.name}"? You won't be able to rejoin without an admin invite.` })}
                disabled={actionBusy}
                className="flex items-center gap-2 px-4 py-1.5 border border-gray-300 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-all active:scale-95"
              >
                <LogOut size={12} /> Leave Group
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
};

/* ════════════════════════════════════════════
   MAIN - Mobile Optimized
════════════════════════════════════════════ */
export default function MyGroups() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
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

  const adminCount = groups.filter(g => g.isAdmin).length;
  const memberCount = groups.filter(g => !g.isAdmin).length;
  const totalPoints = groups.reduce((sum, g) => sum + (g.totalPoints || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 p-4 sm:p-6 md:p-8 pb-24">
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

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 sm:mb-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center shadow-lg">
                <Users size={22} className="text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900">My Work Groups</h1>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full text-xs font-semibold text-gray-600 shadow-sm">
                <Users size={12} /> {groups.length} Groups
              </span>
              <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full text-xs font-semibold text-gray-600 shadow-sm">
                <Shield size={12} /> {adminCount} Admin
              </span>
              <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full text-xs font-semibold text-gray-600 shadow-sm">
                <User size={12} /> {memberCount} Member
              </span>
              {totalPoints > 0 && (
                <span className="flex items-center gap-1.5 bg-gradient-to-r from-orange-100 to-amber-100 px-3 py-1.5 rounded-full text-xs font-bold text-orange-600 shadow-sm">
                  <TrendingUp size={12} /> +{totalPoints} Points
                </span>
              )}
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => fetchGroups(true)}
              disabled={refreshing}
              className="p-2.5 bg-white border-2 border-orange-200 rounded-xl hover:border-orange-300 transition-all active:scale-95"
              title="Refresh"
            >
              <RefreshCw size={18} className={`text-orange-500 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            
            <Link
              to="/worker/create-group"
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold text-sm hover:shadow-lg transition-all active:scale-95"
            >
              <UserPlus size={16} />
              <span className="hidden sm:inline">Create Group</span>
              <span className="sm:hidden">Create</span>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Search */}
      {!loading && groups.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-6"
        >
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search groups by name or description..."
            className="w-full pl-11 pr-4 py-3 border-2 border-orange-100 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50 transition-all"
          />
        </motion.div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skel key={i} h={280} />)}
        </div>
      ) : groups.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl border border-orange-100 p-8 sm:p-12 text-center shadow-sm"
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 flex items-center justify-center mx-auto mb-5"
          >
            <Users size={36} className="text-orange-400" />
          </motion.div>
          <h3 className="text-xl sm:text-2xl font-black text-gray-900 mb-2">No Groups Yet</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
            Create your first work group to collaborate with other karigars and manage projects together.
          </p>
          <Link
            to="/worker/create-group"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold text-sm hover:shadow-lg transition-all active:scale-95"
          >
            <UserPlus size={16} /> Create Your First Group
          </Link>
        </motion.div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-2xl border border-orange-100 p-8 sm:p-12 text-center"
        >
          <p className="text-base sm:text-lg font-bold text-gray-800 mb-3">No results for "{search}"</p>
          <button
            onClick={() => setSearch('')}
            className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all active:scale-95"
          >
            Clear Search
          </button>
        </motion.div>
      ) : (
        <div className="space-y-4">
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