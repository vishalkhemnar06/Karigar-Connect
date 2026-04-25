import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, UserPlus, Trash2, LogOut, Copy, CheckCircle,
  ChevronRight, User, Shield, RefreshCw, AlertTriangle,
  Search, Hash, X, Briefcase, Star, MapPin, ExternalLink,
  Crown, Award, Sparkles, Calendar, Mail, Phone, 
  MessageCircle, Heart, ShieldCheck, Eye, EyeOff,
  Clock, Award as AwardIcon, TrendingUp, Zap, ChevronDown, ChevronUp,
  Verified, Diamond, Trophy, Gift, Target, Rocket, Bell,
  Settings, UserCheck, Plus, Minus, Globe, Link2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getMyGroupsAPI, addMemberAPI, deleteGroupAPI, leaveGroupAPI } from '../../api';
import WorkerProfilePreviewModal from '../../components/WorkerProfilePreviewModal';

const getImage = (path) => {
  if (!path) return null;
  const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
  return path.startsWith("http") ? path : `${BASE_URL}/${path.replace(/^\/+/, "")}`;
};

// ── Toast System ──
let _tid = 0;
const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg, type = 'success') => {
    const id = ++_tid;
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  const success = useCallback((m) => show(m, 'success'), [show]);
  const error = useCallback((m) => show(m, 'error'), [show]);
  const info = useCallback((m) => show(m, 'info'), [show]);

  return useMemo(() => ({ toasts, success, error, info }), [toasts, success, error, info]);
};

const ToastList = ({ toasts }) => (
  <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
    <AnimatePresence>
      {toasts.map(t => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, x: 100, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 100, scale: 0.9 }}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm text-white shadow-xl ${
            t.type === 'error' ? 'bg-gradient-to-r from-red-500 to-rose-600' :
            t.type === 'info' ? 'bg-gradient-to-r from-blue-500 to-indigo-600' :
            'bg-gradient-to-r from-emerald-500 to-green-600'
          }`}
        >
          {t.type === 'success' && <CheckCircle size={14} />}
          {t.type === 'error' && <AlertTriangle size={14} />}
          {t.type === 'info' && <Bell size={14} />}
          {t.msg}
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

// ── Confirm Dialog ──
const ConfirmDialog = ({ message, onConfirm, onCancel, danger = true }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4"
    onClick={onCancel}
  >
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
          danger ? 'bg-red-100' : 'bg-orange-100'
        }`}>
          <AlertTriangle size={24} className={danger ? 'text-red-500' : 'text-orange-500'} />
        </div>
        <p className="text-sm font-bold text-gray-800 leading-relaxed flex-1">{message}</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-all"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-sm text-white transition-all ${
            danger ? 'bg-gradient-to-r from-red-500 to-rose-600' : 'bg-gradient-to-r from-orange-500 to-amber-600'
          }`}
        >
          Confirm
        </button>
      </div>
    </motion.div>
  </motion.div>
);

// ── Member Profile Modal ──
const MemberProfileModal = ({ member, isGroupAdmin, onClose, onPreviewProfile }) => {
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
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[2000] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white w-full sm:rounded-2xl max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 rounded-xl p-2 transition-all"
          >
            <X size={18} className="text-white" />
          </button>
          
          <div className="flex items-center gap-4">
            {member.photo ? (
              <motion.img
                whileHover={{ scale: 1.05 }}
                src={getImage(member.photo)}
                alt={member.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-white/50 shadow-md"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center">
                <User size={28} className="text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-white truncate">{member.name}</h3>
                {isGroupAdmin && (
                  <span className="bg-white/25 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <Shield size={10} /> ADMIN
                  </span>
                )}
              </div>
              <p className="text-xs text-orange-100 font-mono font-semibold break-all">{member.userId || member.karigarId}</p>
              {memberSince && (
                <p className="text-[10px] text-orange-100/80 mt-1 flex items-center gap-1">
                  <Calendar size={10} /> Member since {memberSince}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Skills */}
          {skills.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Briefcase size={12} /> Expertise
              </p>
              <div className="flex flex-wrap gap-2">
                {skills.map((s, i) => (
                  <motion.span
                    key={i}
                    whileHover={{ scale: 1.05 }}
                    className="bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 text-xs font-bold px-3 py-1.5 rounded-full border border-orange-200"
                  >
                    {s}
                  </motion.span>
                ))}
              </div>
            </div>
          )}

          {/* Experience */}
          {member.experience && (
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center shadow-sm">
                <Star size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-medium">Experience</p>
                <p className="text-base font-bold text-gray-800">{member.experience} years</p>
              </div>
            </div>
          )}

          {/* View Profile Button */}
          <button
            onClick={() => {
              const previewId = member?._id || member?.userId || member?.karigarId;
              if (!previewId) return;
              onClose();
              onPreviewProfile(previewId);
            }}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:shadow-md transition-all"
          >
            <ExternalLink size={14} /> View Full Profile
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Member Avatar ──
const MemberAvatar = ({ member }) => {
  const initials = (member?.name || 'M')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const [imgError, setImgError] = useState(false);
  const imageSrc = member?.photo && !imgError ? getImage(member.photo) : null;

  return imageSrc ? (
    <img
      src={imageSrc}
      alt={member.name}
      onError={() => setImgError(true)}
      className="w-full h-full object-cover rounded-full"
    />
  ) : (
    <span className="text-xs font-bold text-orange-700 flex items-center justify-center w-full h-full">
      {initials}
    </span>
  );
};

// ── Group Card (Premium) ──
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
        whileHover={{ y: -4 }}
        className="bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-xl transition-all overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />
          
          <div className="relative z-10">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold text-white break-words">{group.name}</h2>
                    {group.isAdmin && (
                      <span className="bg-white/25 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                        <Shield size={10} /> ADMIN
                      </span>
                    )}
                  </div>
                  {group.description && (
                    <p className="text-xs text-orange-100 mb-3 line-clamp-2">{group.description}</p>
                  )}
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={copy}
                  className="flex items-center gap-1.5 bg-white/20 backdrop-blur border border-white/30 rounded-lg px-3 py-1.5 text-white text-[11px] font-semibold hover:bg-white/30 transition-all"
                >
                  {copiedId ? <CheckCircle size={12} /> : <Copy size={12} />}
                  <span className="font-mono text-[10px] truncate max-w-[100px]">{group.groupId || group._id}</span>
                </button>
                <div className="flex items-center gap-1.5 bg-white/20 rounded-lg px-3 py-1.5 text-white text-[11px] font-semibold">
                  <Users size={12} />{memberCount} member{memberCount !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Members Section */}
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center shadow-sm">
                <Users size={14} className="text-white" />
              </div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Team Members</p>
            </div>
            <button
              onClick={() => setShowMembers(!showMembers)}
              className="flex items-center gap-1 text-orange-500 text-[10px] font-semibold"
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
                          className="w-full flex items-center gap-3 p-3 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-xl hover:from-orange-100 hover:to-amber-100 transition-all text-left"
                        >
                          <div className="relative w-10 h-10 rounded-full bg-gradient-to-r from-orange-200 to-amber-200 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-orange-200">
                            <MemberAvatar member={member} />
                            {isAdmin && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full border-2 border-white flex items-center justify-center">
                                <Shield size={8} className="text-white" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-800 truncate">{member.name}</p>
                            <p className="text-[10px] text-gray-500 font-mono truncate">{member.userId || member.karigarId}</p>
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

          {/* Admin Controls */}
          {group.isAdmin ? (
            <div className="mt-4 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4">
              <button
                onClick={() => setShowAdminControls(!showAdminControls)}
                className="w-full flex items-center justify-between text-left mb-3"
              >
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-orange-600" />
                  <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Admin Controls</p>
                </div>
                {showAdminControls ? <ChevronUp size={14} className="text-orange-500" /> : <ChevronDown size={14} className="text-orange-500" />}
              </button>
              
              <AnimatePresence>
                {showAdminControls && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
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
                            className="w-full pl-9 pr-3 py-2.5 border border-orange-200 rounded-xl text-xs font-mono font-semibold bg-white focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={doAddMember}
                            disabled={adding}
                            className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 rounded-xl text-xs font-bold disabled:opacity-50 transition-all"
                          >
                            {adding ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Add Member'}
                          </button>
                          <button
                            onClick={() => { setAddOpen(false); setMemberId(''); }}
                            className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <button
                        onClick={() => setAddOpen(true)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 border border-orange-200 rounded-xl text-orange-600 text-xs font-bold hover:bg-orange-50 transition-all"
                      >
                        <UserPlus size={14} /> Add Member
                      </button>
                    )}
                    
                    <button
                      onClick={() => setConfirm({ action: 'delete', message: `Permanently delete "${group.name}"? This cannot be undone.` })}
                      disabled={actionBusy}
                      className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-200 rounded-xl text-red-500 text-xs font-bold hover:bg-red-50 transition-all"
                    >
                      <Trash2 size={14} /> Delete Group
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="mt-4 bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm" />
                <p className="text-xs text-gray-600 font-medium">Group Member</p>
              </div>
              <button
                onClick={() => setConfirm({ action: 'leave', message: `Leave "${group.name}"? You won't be able to rejoin without an admin invite.` })}
                disabled={actionBusy}
                className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-all"
              >
                <LogOut size={12} /> Leave
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
};

// Helper for Loader
const Loader2 = ({ size, className }) => (
  <svg className={`animate-spin ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

// ── Main Component ──
export default function MyGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMember, setViewMember] = useState(null);
  const [previewWorkerId, setPreviewWorkerId] = useState('');
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
  }, [toast]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const filtered = groups.filter(g =>
    !search || g.name?.toLowerCase().includes(search.toLowerCase()) ||
    g.description?.toLowerCase().includes(search.toLowerCase())
  );

  const adminCount = groups.filter(g => g.isAdmin).length;
  const memberCount = groups.filter(g => !g.isAdmin).length;
  const totalPoints = groups.reduce((sum, g) => sum + (g.totalPoints || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 pb-16">
      <ToastList toasts={toast.toasts} />

      <AnimatePresence>
        {viewMember && (
          <MemberProfileModal
            member={viewMember.member}
            isGroupAdmin={viewMember.isAdmin}
            onClose={() => setViewMember(null)}
            onPreviewProfile={setPreviewWorkerId}
          />
        )}
      </AnimatePresence>

      {previewWorkerId && (
        <WorkerProfilePreviewModal
          workerId={previewWorkerId}
          onClose={() => setPreviewWorkerId('')}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-5 pb-8">
        
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          data-guide-id="worker-page-my-groups"
          className="mb-8"
        >
          <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Users size="24" className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-black">My Work Groups</h1>
                  <p className="text-white/90 text-sm mt-0.5">Collaborate with fellow karigars</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="bg-white/15 rounded-xl px-3 py-1.5 text-center">
                  <p className="text-xl font-bold">{groups.length}</p>
                  <p className="text-[10px] text-white/80">Total Groups</p>
                </div>
                <div className="bg-white/15 rounded-xl px-3 py-1.5 text-center">
                  <p className="text-xl font-bold">{adminCount}</p>
                  <p className="text-[10px] text-white/80">Admin</p>
                </div>
                <div className="bg-white/15 rounded-xl px-3 py-1.5 text-center">
                  <p className="text-xl font-bold">{memberCount}</p>
                  <p className="text-[10px] text-white/80">Member</p>
                </div>
                {totalPoints > 0 && (
                  <div className="bg-white/15 rounded-xl px-3 py-1.5 text-center">
                    <p className="text-xl font-bold">+{totalPoints}</p>
                    <p className="text-[10px] text-white/80">Points</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <Search size="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search groups by name or description..."
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 bg-white transition-all"
            />
          </div>
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => fetchGroups(true)}
              disabled={refreshing}
              className="p-2.5 bg-white border border-gray-200 rounded-xl hover:border-orange-300 transition-all"
            >
              <RefreshCw size="16" className={`text-orange-500 ${refreshing ? 'animate-spin' : ''}`} />
            </motion.button>
            <Link
              to="/worker/create-group"
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold text-sm hover:shadow-md transition-all"
            >
              <UserPlus size="16" /> Create Group
            </Link>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skel key={i} />)}
          </div>
        ) : groups.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users size="36" className="text-orange-400" />
            </div>
            <h3 className="font-bold text-gray-800 text-xl mb-2">No Groups Yet</h3>
            <p className="text-gray-400 text-sm mb-5">Create your first work group to collaborate with others</p>
            <Link
              to="/worker/create-group"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              <UserPlus size="16" /> Create Your First Group
            </Link>
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center"
          >
            <Search size="48" className="text-gray-300 mx-auto mb-3" />
            <p className="font-bold text-gray-700 text-lg mb-2">No results for "{search}"</p>
            <button
              onClick={() => setSearch('')}
              className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg transition-all"
            >
              Clear Search
            </button>
          </motion.div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 font-medium">
                {filtered.length} group{filtered.length !== 1 ? 's' : ''} found
              </p>
            </div>
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
    </div>
  );
}

// Skeleton Component
const Skel = () => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
    <div className="h-32 bg-gradient-to-r from-gray-200 to-gray-100" />
    <div className="p-5 space-y-3">
      <div className="h-5 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
      <div className="h-3 bg-gray-200 rounded w-2/3" />
      <div className="flex gap-2 pt-2">
        <div className="h-8 bg-gray-200 rounded w-20" />
        <div className="h-8 bg-gray-200 rounded w-24" />
      </div>
    </div>
  </div>
);