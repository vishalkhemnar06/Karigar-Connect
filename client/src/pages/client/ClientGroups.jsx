// src/pages/client/ClientGroups.jsx
// FULLY RESPONSIVE - Mobile-first design, touch-optimized

import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../../api';
import { getImageUrl } from '../../constants/config';
import {
    Users, Search, Phone, Mail, ChevronRight, X, Shield,
    Briefcase, Star, RefreshCw, Loader2, MapPin, ExternalLink,
    Filter, ChevronDown, User, MessageSquare, Copy, CheckCircle,
    ChevronUp, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

// ── helpers ───────────────────────────────────────────────────────────────────
const SKILL_OPTIONS = [
    'Plumber', 'Electrician', 'Carpenter', 'Painter', 'Mason',
    'Welder', 'Tiler', 'AC Technician', 'Interior Designer', 'Other',
];

// ── Member Profile Drawer (Mobile Optimized) ─────────────────────────────────────
const MemberDrawer = ({ member, isAdmin, onClose, navigate }) => {
    if (!member) return null;
    const skills = Array.isArray(member.skills)
        ? member.skills.map(s => typeof s === 'object' ? s.name : s)
        : [];

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={onClose}
        >
            <div
                className="relative bg-white w-full sm:rounded-3xl shadow-2xl sm:max-w-sm max-h-[90vh] overflow-hidden flex flex-col sm:rounded-t-3xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-br from-orange-500 to-amber-500 p-5 sm:p-6 flex-shrink-0">
                    <button 
                        onClick={onClose} 
                        className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 sm:p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all active:scale-95"
                    >
                        <X size={16} className="text-white" />
                    </button>
                   <div className="flex items-center gap-3 sm:gap-4">
  {member.photo ? (
    <img
      src={getImageUrl(member.photo)}
      alt={member.name}
      className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-3 border-white/50 shadow-lg flex-shrink-0"
      onError={(e) => {
        e.target.style.display = "none";
      }}
    />
  ) : (
    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 border-2 border-white/40">
      <User size={24} className="text-white" />
    </div>
  )}

  <div className="flex-1 min-w-0">
    <div className="flex flex-wrap items-center gap-1.5 mb-1">
      <h3 className="text-lg sm:text-xl font-black text-white truncate">
        {member.name}
      </h3>

      {isAdmin && (
        <span className="bg-white/25 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border border-white/30">
          <Shield size={8} /> ADMIN
        </span>
      )}
    </div>

    <p className="text-orange-100 text-[10px] sm:text-xs font-mono font-semibold break-all">
      {member.karigarId}
    </p>

    {member.overallExperience && (
      <p className="text-orange-100 text-[10px] sm:text-xs mt-1">
        {member.overallExperience}
      </p>
    )}
  </div>
</div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 sm:space-y-5">
                    {/* Skills */}
                    {skills.length > 0 && (
                        <div>
                            <p className="text-[10px] sm:text-xs font-black text-gray-500 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-1">
                                <Briefcase size={10} /> Skills
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {skills.map((s, i) => (
                                    <span key={i} className="bg-orange-50 text-orange-700 text-[10px] sm:text-xs font-bold px-2 sm:px-2.5 py-1 rounded-full border border-orange-200">
                                        {s}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Experience */}
                    {member.experience && (
                        <div className="flex items-center gap-2 sm:gap-3 bg-orange-50 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 border border-orange-100">
                            <Star size={14} className="text-orange-500 flex-shrink-0" />
                            <p className="text-xs sm:text-sm font-semibold text-gray-700">{member.experience} years of experience</p>
                        </div>
                    )}

                    {/* City */}
                    {member.address?.city && (
                        <div className="flex items-center gap-2 sm:gap-3 bg-gray-50 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 border border-gray-100">
                            <MapPin size={14} className="text-gray-400 flex-shrink-0" />
                            <p className="text-xs sm:text-sm font-semibold text-gray-700">{member.address.city}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 p-4 sm:p-5 border-t border-gray-100">
                    <button
                        onClick={() => { onClose(); navigate(`/profile/public/${member.karigarId}`); }}
                        className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm shadow-lg shadow-orange-200 hover:shadow-orange-300 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <ExternalLink size={14} /> View Full Profile
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Contact Admin Modal (Mobile Optimized) ───────────────────────────────────────
const ContactAdminModal = ({ group, onClose }) => {
    const [copied, setCopied] = useState('');
    if (!group) return null;
    const admin = group.creator;

    const copy = (text, field) => {
        navigator.clipboard.writeText(text);
        setCopied(field);
        toast.success('Copied!');
        setTimeout(() => setCopied(''), 2000);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={onClose}
        >
            <div
                className="bg-white w-full sm:rounded-3xl shadow-2xl sm:max-w-md max-h-[90vh] overflow-y-auto sm:rounded-t-3xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-4 sm:p-5 text-white sticky top-0 z-10">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base sm:text-lg font-black">Contact Group Admin</h3>
                            <p className="text-orange-100 text-[10px] sm:text-xs mt-0.5 truncate max-w-[200px]">{group.name}</p>
                        </div>
                        <button onClick={onClose} className="p-1.5 sm:p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all active:scale-95">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                    {/* Admin info */}
                    <div className="flex items-center gap-3 sm:gap-4 bg-orange-50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-orange-100">
                        {admin?.photo ? (
                            <img src={admin.photo} alt={admin.name} className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl object-cover border-2 border-orange-200 flex-shrink-0" />
                        ) : (
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-orange-200 flex items-center justify-center flex-shrink-0">
                                <Shield size={16} className="text-orange-600" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 text-sm sm:text-base truncate">{admin?.name}</p>
                            <p className="text-[10px] sm:text-xs text-orange-500 font-mono truncate">{admin?.karigarId}</p>
                            <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5">Group Admin</p>
                        </div>
                    </div>

                    {/* Phone */}
                    {admin?.mobile && (
                        <div className="border-2 border-gray-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 hover:border-orange-200 transition-all">
                            <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Phone size={10} /> Mobile Number
                            </p>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-bold text-gray-900 font-mono text-sm sm:text-base break-all">{admin.mobile}</p>
                                <div className="flex gap-1.5">
                                    <a
                                        href={`tel:+91${admin.mobile}`}
                                        className="flex items-center gap-1 bg-green-500 text-white px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold hover:bg-green-600 transition-all active:scale-95"
                                    >
                                        <Phone size={11} /> Call
                                    </a>
                                    <button
                                        onClick={() => copy(admin.mobile, 'phone')}
                                        className="flex items-center gap-1 bg-gray-100 text-gray-600 px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold hover:bg-gray-200 transition-all active:scale-95"
                                    >
                                        {copied === 'phone' ? <CheckCircle size={11} className="text-green-500" /> : <Copy size={11} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Email */}
                    {admin?.email && (
                        <div className="border-2 border-gray-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 hover:border-orange-200 transition-all">
                            <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Mail size={10} /> Email Address
                            </p>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-bold text-gray-900 text-xs sm:text-sm break-all">{admin.email}</p>
                                <div className="flex gap-1.5">
                                    <a
                                        href={`mailto:${admin.email}`}
                                        className="flex items-center gap-1 bg-blue-500 text-white px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold hover:bg-blue-600 transition-all active:scale-95"
                                    >
                                        <Mail size={11} /> Email
                                    </a>
                                    <button
                                        onClick={() => copy(admin.email, 'email')}
                                        className="flex items-center gap-1 bg-gray-100 text-gray-600 px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold hover:bg-gray-200 transition-all active:scale-95"
                                    >
                                        {copied === 'email' ? <CheckCircle size={11} className="text-green-500" /> : <Copy size={11} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {!admin?.mobile && !admin?.email && (
                        <div className="text-center py-4 sm:py-6 text-gray-400">
                            <MessageSquare size={28} className="mx-auto mb-2 opacity-30" />
                            <p className="text-xs sm:text-sm">Contact details not available</p>
                        </div>
                    )}

                    <p className="text-[10px] sm:text-xs text-gray-400 text-center">
                        Contact the group admin directly to discuss job requirements and availability
                    </p>
                </div>
            </div>
        </div>
    );
};

// ── Group Card (Mobile Optimized) ────────────────────────────────────────────────
const GroupCard = ({ group, onViewMember, onContact }) => {
    const admin   = group.creator;
    const members = group.members || [];

    const allSkills = [...new Set(
        members.flatMap(m =>
            Array.isArray(m.skills) ? m.skills.map(s => typeof s === 'object' ? s.name : s) : []
        )
    )].slice(0, 5);

    return (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-black text-white truncate">{group.name}</h3>
                        {group.description && (
                            <p className="text-orange-100 text-[11px] sm:text-xs mt-1 line-clamp-2">{group.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <span className="bg-white/20 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Users size={10} /> {members.length} member{members.length !== 1 ? 's' : ''}
                            </span>
                            <span className="bg-white/15 text-white/80 text-[9px] sm:text-[10px] font-mono px-1.5 py-0.5 rounded-full break-all max-w-[120px]">
                                {group.groupId}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
                {/* Skills */}
                {allSkills.length > 0 && (
                    <div>
                        <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Group Skills</p>
                        <div className="flex flex-wrap gap-1">
                            {allSkills.map((s, i) => (
                                <span key={i} className="bg-orange-50 text-orange-700 text-[9px] sm:text-[10px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-full border border-orange-100">
                                    {s}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Members row — clickable */}
                <div>
                    <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Team Members</p>
                    <div className="flex flex-wrap gap-1.5">
                        {members.slice(0, 4).map((m, i) => {
                            const isAdmin = m._id?.toString() === (admin?._id?.toString() || admin?.toString());
                            return (
                                <button
                                    key={m._id || i}
                                    onClick={() => onViewMember(m, isAdmin)}
                                    className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2 py-1 hover:border-orange-300 hover:bg-orange-50 transition-all active:scale-95"
                                >
                                    {m.photo ? (
                                        <img
  src={getImageUrl(m.photo)}
  alt={m.name}
  className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover flex-shrink-0"
/>
                                    ) : (
                                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-orange-200 flex items-center justify-center flex-shrink-0">
                                            <span className="text-[8px] sm:text-[9px] font-bold text-orange-700">
                                                {(m.name || 'W').charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                    <div className="text-left min-w-0">
                                        <p className="text-[9px] sm:text-[10px] font-bold text-gray-800 group-hover:text-orange-700 transition-colors truncate">
                                            {m.name?.split(' ')[0]}
                                            {isAdmin && <span className="ml-0.5 text-orange-500">★</span>}
                                        </p>
                                        <p className="text-[7px] sm:text-[8px] text-gray-400 font-mono truncate">{m.karigarId}</p>
                                    </div>
                                </button>
                            );
                        })}
                        {members.length > 4 && (
                            <div className="flex items-center justify-center bg-gray-50 border border-gray-200 rounded-xl px-2 py-1 text-[9px] sm:text-[10px] font-bold text-gray-400">
                                +{members.length - 4}
                            </div>
                        )}
                    </div>
                </div>

                {/* Admin info + contact */}
                {admin && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-orange-50 rounded-xl p-2.5 sm:p-3 border border-orange-100">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            {admin.photo ? (
                                <img
  src={getImageUrl(admin.photo)}
  alt={admin.name}
  className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover border border-orange-200 flex-shrink-0"
/>
                            ) : (
                                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-orange-200 flex items-center justify-center flex-shrink-0">
                                    <Shield size={12} className="text-orange-600" />
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="text-[11px] sm:text-xs font-black text-gray-800 truncate">{admin.name}</p>
                                <p className="text-[9px] sm:text-[10px] text-orange-500 font-bold">Group Admin</p>
                            </div>
                        </div>
                        <button
                            onClick={() => onContact(group)}
                            className="w-full sm:w-auto flex items-center justify-center gap-1 bg-orange-500 text-white px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold hover:bg-orange-600 active:scale-95 transition-all shadow-md shadow-orange-200"
                        >
                            <Phone size={11} /> Contact
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Main Page (Mobile Optimized) ─────────────────────────────────────────────────
export default function ClientGroups() {
    const navigate = useNavigate();

    const [groups, setGroups]         = useState([]);
    const [loading, setLoading]       = useState(true);
    const [page, setPage]             = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal]           = useState(0);
    const [search, setSearch]         = useState('');
    const [skillFilter, setSkillFilter] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [viewMember, setViewMember]   = useState(null);
    const [contactGroup, setContactGroup] = useState(null);

    const fetchGroups = useCallback(async (p = 1, reset = false) => {
        setLoading(true);
        try {
            const { data } = await api.browseGroups({ search, skill: skillFilter, page: p });
            if (reset || p === 1) {
                setGroups(data.groups || []);
            } else {
                setGroups(prev => [...prev, ...(data.groups || [])]);
            }
            setTotalPages(data.totalPages || 1);
            setTotal(data.total || 0);
            setPage(p);
        } catch {
            toast.error('Failed to load groups.');
        } finally {
            setLoading(false);
        }
    }, [search, skillFilter]);

    useEffect(() => { fetchGroups(1, true); }, [search, skillFilter]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/40 via-white to-orange-50/20 p-3 sm:p-4 md:p-8 pb-24">
            {/* Member profile drawer */}
            {viewMember && (
                <MemberDrawer
                    member={viewMember.member}
                    isAdmin={viewMember.isAdmin}
                    onClose={() => setViewMember(null)}
                    navigate={navigate}
                />
            )}

            {/* Contact admin modal */}
            {contactGroup && (
                <ContactAdminModal
                    group={contactGroup}
                    onClose={() => setContactGroup(null)}
                />
            )}

            <div className="max-w-5xl mx-auto">
                {/* Page header */}
                <div className="mb-5 sm:mb-8">
                    <div className="flex items-center gap-2 sm:gap-3 mb-2">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-orange-200">
                            <Users size={16} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                                Browse Worker Groups
                            </h1>
                            <p className="text-[11px] sm:text-sm text-gray-500">Find skilled teams for your projects</p>
                        </div>
                    </div>
                </div>

                {/* Search + filter bar */}
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm p-3 sm:p-4 mb-4 sm:mb-6 space-y-2 sm:space-y-3">
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <Search size={14} className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search groups..."
                                className="w-full pl-8 sm:pl-10 pr-3 py-2.5 border-2 border-gray-100 rounded-xl sm:rounded-2xl text-xs sm:text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-50 outline-none transition-all"
                            />
                        </div>
                        <button
                            onClick={() => setShowFilters(v => !v)}
                            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border-2 font-bold text-xs sm:text-sm transition-all ${
                                showFilters || skillFilter
                                    ? 'border-orange-400 bg-orange-50 text-orange-600'
                                    : 'border-gray-100 text-gray-600 hover:border-orange-200'
                            }`}
                        >
                            <Filter size={13} />
                            <span className="hidden xs:inline">Filter</span>
                            {skillFilter && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />}
                        </button>
                        <button
                            onClick={() => fetchGroups(1, true)}
                            className="p-2.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all border-2 border-gray-100"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    {showFilters && (
                        <div className="pt-1">
                            <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1.5">Filter by Skill</p>
                            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                                <button
                                    onClick={() => setSkillFilter('')}
                                    className={`px-2 sm:px-3 py-1 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all whitespace-nowrap ${
                                        !skillFilter ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                                    }`}
                                >
                                    All
                                </button>
                                {SKILL_OPTIONS.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setSkillFilter(skillFilter === s ? '' : s)}
                                        className={`px-2 sm:px-3 py-1 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all whitespace-nowrap ${
                                            skillFilter === s ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                                        }`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Results count */}
                {!loading && groups.length > 0 && (
                    <p className="text-[10px] sm:text-xs text-gray-500 font-medium mb-3 sm:mb-4">
                        {total} group{total !== 1 ? 's' : ''} found
                        {skillFilter && <span> with <strong className="text-orange-600">{skillFilter}</strong> skill</span>}
                        {search && <span> matching "<strong className="text-orange-600 break-words">{search}</strong>"</span>}
                    </p>
                )}

                {/* Groups grid */}
                {loading && groups.length === 0 ? (
                    <div className="flex justify-center py-16 sm:py-20">
                        <Loader2 size={28} className="animate-spin text-orange-400" />
                    </div>
                ) : groups.length === 0 ? (
                    <div className="text-center py-12 sm:py-20 text-gray-400">
                        <Users size={40} className="mx-auto mb-2 opacity-30" />
                        <p className="font-medium text-base sm:text-lg">No groups found</p>
                        <p className="text-[11px] sm:text-sm mt-1">Try a different search or clear filters</p>
                        {(search || skillFilter) && (
                            <button
                                onClick={() => { setSearch(''); setSkillFilter(''); setShowFilters(false); }}
                                className="mt-3 px-4 py-2 bg-orange-500 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-orange-600 transition-all active:scale-95"
                            >
                                Clear all filters
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-4 sm:gap-5">
                            {groups.map(group => (
                                <GroupCard
                                    key={group._id}
                                    group={group}
                                    onViewMember={(member, isAdmin) => setViewMember({ member, isAdmin })}
                                    onContact={setContactGroup}
                                />
                            ))}
                        </div>

                        {page < totalPages && (
                            <button
                                onClick={() => fetchGroups(page + 1)}
                                disabled={loading}
                                className="w-full mt-5 sm:mt-6 py-2.5 sm:py-3 border-2 border-orange-200 text-orange-600 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm hover:bg-orange-50 transition-all flex items-center justify-center gap-2 active:scale-95"
                            >
                                {loading ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
                                Load more groups
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}