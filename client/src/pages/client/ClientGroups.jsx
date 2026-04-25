// src/pages/client/ClientGroups.jsx
// PREMIUM VERSION - Fully responsive, mobile-optimized, modern design

import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../../api';
import { getImageUrl } from '../../constants/config';
import {
    Users, Search, Phone, Mail, ChevronRight, X, Shield,
    Briefcase, Star, RefreshCw, Loader2, MapPin, ExternalLink,
    Filter, ChevronDown, User, MessageSquare, Copy, CheckCircle,
    ChevronUp, Eye, Crown, Diamond, Sparkles, Zap, Gift,
    Heart, ThumbsUp, Award, TrendingUp, Clock, Calendar,
    Verified, Building2, Home, Wallet, Camera, Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { openWorkerProfilePreview } from '../../utils/workerProfilePreview';

// ── Constants ───────────────────────────────────────────────────────────────────
const SKILL_OPTIONS = [
    'Plumber', 'Electrician', 'Carpenter', 'Painter', 'Mason',
    'Welder', 'Tiler', 'AC Technician', 'Interior Designer', 'Other',
];

// ── Member Profile Drawer (Premium) ─────────────────────────────────────────────
const MemberDrawer = ({ member, isAdmin, onClose }) => {
    if (!member) return null;
    const skills = Array.isArray(member.skills)
        ? member.skills.map(s => typeof s === 'object' ? s.name : s)
        : [];

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
                style={{ background: 'rgba(0,0,0,0.6)' }}
                onClick={onClose}
            >
                <motion.div
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: '100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="relative bg-white w-full sm:rounded-2xl shadow-2xl sm:max-w-md max-h-[90vh] overflow-hidden flex flex-col"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-5 flex-shrink-0">
                        <button 
                            onClick={onClose} 
                            className="absolute top-3 right-3 p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all active:scale-95"
                        >
                            <X size="18" className="text-white" />
                        </button>
                        <div className="flex items-center gap-3">
                            {member.photo ? (
                                <img
                                    src={getImageUrl(member.photo)}
                                    alt={member.name}
                                    className="w-16 h-16 rounded-xl object-cover border-2 border-white/50 shadow-md flex-shrink-0"
                                    onError={(e) => { e.target.style.display = "none"; }}
                                />
                            ) : (
                                <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 border-2 border-white/40">
                                    <User size="24" className="text-white" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                    <h3 className="text-lg font-bold text-white truncate">{member.name}</h3>
                                    {isAdmin && (
                                        <span className="bg-white/25 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                            <Shield size="10" /> ADMIN
                                        </span>
                                    )}
                                </div>
                                <p className="text-orange-100 text-[10px] font-mono font-semibold break-all">{member.karigarId}</p>
                                {member.overallExperience && (
                                    <p className="text-orange-100 text-[10px] mt-1">{member.overallExperience}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                        {skills.length > 0 && (
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <Briefcase size="10" /> Skills
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {skills.map((s, i) => (
                                        <span key={i} className="bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-orange-100">
                                            {s}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {member.experience && (
                            <div className="flex items-center gap-2 bg-orange-50 rounded-xl p-3 border border-orange-100">
                                <Star size="14" className="text-orange-500 flex-shrink-0" />
                                <p className="text-xs font-semibold text-gray-700">{member.experience} years of experience</p>
                            </div>
                        )}

                        {member.address?.city && (
                            <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3 border border-gray-100">
                                <MapPin size="14" className="text-gray-400 flex-shrink-0" />
                                <p className="text-xs font-semibold text-gray-700">{member.address.city}</p>
                            </div>
                        )}

                        {member.completedJobs !== undefined && (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                                    <p className="text-lg font-bold text-emerald-700">{member.completedJobs || 0}</p>
                                    <p className="text-[10px] text-emerald-600 font-semibold">Jobs Completed</p>
                                </div>
                                <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                                    <p className="text-lg font-bold text-blue-700">{member.points || 0}</p>
                                    <p className="text-[10px] text-blue-600 font-semibold">Points</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex-shrink-0 p-5 border-t border-gray-100">
                        <button
                            onClick={() => { onClose(); openWorkerProfilePreview(member?._id || member?.karigarId); }}
                            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 rounded-xl font-bold text-sm shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <ExternalLink size="14" /> View Full Profile
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

// ── Contact Admin Modal (Premium) ───────────────────────────────────────────────
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
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
                style={{ background: 'rgba(0,0,0,0.6)' }}
                onClick={onClose}
            >
                <motion.div
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: '100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="bg-white w-full sm:rounded-2xl shadow-2xl sm:max-w-md max-h-[90vh] overflow-y-auto"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-5 text-white sticky top-0 z-10">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold">Contact Group Admin</h3>
                                <p className="text-orange-100 text-xs mt-0.5 truncate max-w-[200px]">{group.name}</p>
                            </div>
                            <button onClick={onClose} className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all active:scale-95">
                                <X size="16" />
                            </button>
                        </div>
                    </div>

                    <div className="p-5 space-y-4">
                        {/* Admin info */}
                        <div className="flex items-center gap-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-100">
                            {admin?.photo ? (
                                <img src={getImageUrl(admin.photo)} alt={admin.name} className="w-12 h-12 rounded-xl object-cover border-2 border-orange-200 flex-shrink-0" />
                            ) : (
                                <div className="w-12 h-12 rounded-xl bg-orange-200 flex items-center justify-center flex-shrink-0">
                                    <Shield size="16" className="text-orange-600" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-gray-800 text-sm truncate">{admin?.name}</p>
                                <p className="text-[10px] text-orange-500 font-mono truncate">{admin?.karigarId}</p>
                                <p className="text-[9px] text-gray-400 mt-0.5">Group Admin</p>
                            </div>
                        </div>

                        {/* Phone */}
                        {admin?.mobile && (
                            <div className="border border-gray-200 rounded-xl p-4 hover:border-orange-200 transition-all">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <Phone size="10" /> Mobile Number
                                </p>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="font-bold text-gray-800 font-mono text-sm break-all">{admin.mobile}</p>
                                    <div className="flex gap-1.5">
                                        <a
                                            href={`tel:+91${admin.mobile}`}
                                            className="flex items-center gap-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold hover:shadow-md transition-all active:scale-95"
                                        >
                                            <Phone size="11" /> Call
                                        </a>
                                        <button
                                            onClick={() => copy(admin.mobile, 'phone')}
                                            className="flex items-center gap-1 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-gray-200 transition-all active:scale-95"
                                        >
                                            {copied === 'phone' ? <CheckCircle size="11" className="text-green-500" /> : <Copy size="11" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Email */}
                        {admin?.email && (
                            <div className="border border-gray-200 rounded-xl p-4 hover:border-orange-200 transition-all">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <Mail size="10" /> Email Address
                                </p>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="font-bold text-gray-800 text-xs break-all">{admin.email}</p>
                                    <div className="flex gap-1.5">
                                        <a
                                            href={`mailto:${admin.email}`}
                                            className="flex items-center gap-1 bg-gradient-to-r from-blue-500 to-cyan-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold hover:shadow-md transition-all active:scale-95"
                                        >
                                            <Mail size="11" /> Email
                                        </a>
                                        <button
                                            onClick={() => copy(admin.email, 'email')}
                                            className="flex items-center gap-1 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-gray-200 transition-all active:scale-95"
                                        >
                                            {copied === 'email' ? <CheckCircle size="11" className="text-green-500" /> : <Copy size="11" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {!admin?.mobile && !admin?.email && (
                            <div className="text-center py-6 text-gray-400">
                                <MessageSquare size="32" className="mx-auto mb-2 opacity-30" />
                                <p className="text-sm">Contact details not available</p>
                            </div>
                        )}

                        <p className="text-[10px] text-gray-400 text-center">
                            Contact the group admin directly to discuss job requirements and availability
                        </p>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

// ── Premium Group Card ────────────────────────────────────────────────────────
const GroupCard = ({ group, onViewMember, onContact }) => {
    const admin   = group.creator;
    const members = group.members || [];

    const allSkills = [...new Set(
        members.flatMap(m =>
            Array.isArray(m.skills) ? m.skills.map(s => typeof s === 'object' ? s.name : s) : []
        )
    )].slice(0, 6);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            className="bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-xl transition-all overflow-hidden"
        >
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-5">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-white truncate">{group.name}</h3>
                        {group.description && (
                            <p className="text-orange-100 text-xs mt-1 line-clamp-2">{group.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="bg-white/20 text-white text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Users size="10" /> {members.length} member{members.length !== 1 ? 's' : ''}
                            </span>
                            <span className="bg-white/15 text-white/80 text-[10px] font-mono px-2 py-0.5 rounded-full break-all max-w-[140px]">
                                {group.groupId}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-5 space-y-4">
                {/* Skills */}
                {allSkills.length > 0 && (
                    <div>
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-2">Group Skills</p>
                        <div className="flex flex-wrap gap-1.5">
                            {allSkills.map((s, i) => (
                                <span key={i} className="bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-orange-100">
                                    {s}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Members row */}
                <div>
                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-2">Team Members</p>
                    <div className="flex flex-wrap gap-2">
                        {members.slice(0, 4).map((m, i) => {
                            const isAdmin = m._id?.toString() === (admin?._id?.toString() || admin?.toString());
                            return (
                                <button
                                    key={m._id || i}
                                    onClick={() => onViewMember(m, isAdmin)}
                                    className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:border-orange-300 hover:bg-orange-50 transition-all active:scale-95"
                                >
                                    {m.photo ? (
                                        <img
                                            src={getImageUrl(m.photo)}
                                            alt={m.name}
                                            className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                                        />
                                    ) : (
                                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-orange-200 to-amber-200 flex items-center justify-center flex-shrink-0">
                                            <span className="text-[9px] font-bold text-orange-700">
                                                {(m.name || 'W').charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                    <div className="text-left min-w-0">
                                        <p className="text-[10px] font-bold text-gray-800 truncate max-w-[80px]">
                                            {m.name?.split(' ')[0]}
                                            {isAdmin && <span className="ml-0.5 text-orange-500">★</span>}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                        {members.length > 4 && (
                            <div className="flex items-center justify-center bg-gray-100 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-gray-500">
                                +{members.length - 4}
                            </div>
                        )}
                    </div>
                </div>

                {/* Admin info + contact */}
                {admin && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-3 border border-orange-100">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            {admin.photo ? (
                                <img
                                    src={getImageUrl(admin.photo)}
                                    alt={admin.name}
                                    className="w-8 h-8 rounded-lg object-cover border border-orange-200 flex-shrink-0"
                                />
                            ) : (
                                <div className="w-8 h-8 rounded-lg bg-orange-200 flex items-center justify-center flex-shrink-0">
                                    <Shield size="12" className="text-orange-600" />
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-800 truncate">{admin.name}</p>
                                <p className="text-[9px] text-orange-600 font-semibold">Group Admin</p>
                            </div>
                        </div>
                        <button
                            onClick={() => onContact(group)}
                            className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold hover:shadow-md active:scale-95 transition-all"
                        >
                            <Phone size="11" /> Contact Admin
                        </button>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

// ── Main Page (Premium Design) ─────────────────────────────────────────────────
export default function ClientGroups() {
    const [groups, setGroups]         = useState([]);
    const [loading, setLoading]       = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage]             = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal]           = useState(0);
    const [search, setSearch]         = useState('');
    const [skillFilter, setSkillFilter] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [viewMember, setViewMember]   = useState(null);
    const [contactGroup, setContactGroup] = useState(null);

    const fetchGroups = useCallback(async (p = 1, reset = false, isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
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
            setRefreshing(false);
        }
    }, [search, skillFilter]);

    useEffect(() => { fetchGroups(1, true); }, [search, skillFilter]);

    const handleRefresh = () => {
        fetchGroups(1, true, true);
    };

    const clearFilters = () => {
        setSearch('');
        setSkillFilter('');
        setShowFilters(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 pb-20">
            {/* Member profile drawer */}
            {viewMember && (
                <MemberDrawer
                    member={viewMember.member}
                    isAdmin={viewMember.isAdmin}
                    onClose={() => setViewMember(null)}
                />
            )}

            {/* Contact admin modal */}
            {contactGroup && (
                <ContactAdminModal
                    group={contactGroup}
                    onClose={() => setContactGroup(null)}
                />
            )}

            <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-8">
                
                {/* Hero Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-xl">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                    <Users size="24" className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black" data-guide-id="client-page-groups">Worker Groups</h1>
                                    <p className="text-white/90 text-sm mt-0.5">Find skilled teams for your projects</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="bg-white/15 rounded-xl px-3 py-1.5 text-center">
                                    <p className="text-xl font-bold">{total}</p>
                                    <p className="text-[10px] text-white/80">Total Groups</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Search & Filters */}
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-6">
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <Search size="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search groups by name, description, or skills..."
                                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                            />
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${showFilters || skillFilter ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-orange-50'}`}
                        >
                            <Filter size="14" /> Filter
                            {skillFilter && <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-white" />}
                        </button>
                        <button
                            onClick={handleRefresh}
                            className="p-2.5 border border-gray-200 rounded-xl hover:border-orange-300 transition-all"
                        >
                            <RefreshCw size="16" className={`text-orange-500 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    <AnimatePresence>
                        {showFilters && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-4 pt-4 border-t border-gray-100"
                            >
                                <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2">Filter by Skill</p>
                                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pb-1">
                                    <button
                                        onClick={() => setSkillFilter('')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${!skillFilter ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-orange-50'}`}
                                    >
                                        All Skills
                                    </button>
                                    {SKILL_OPTIONS.map(s => (
                                        <button
                                            key={s}
                                            onClick={() => setSkillFilter(skillFilter === s ? '' : s)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${skillFilter === s ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-orange-50'}`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Active Filters */}
                    {(search || skillFilter) && (
                        <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-gray-100">
                            <span className="text-[9px] font-bold text-gray-500 uppercase">Active Filters:</span>
                            {search && (
                                <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                    Search: {search}
                                    <button onClick={() => setSearch('')} className="hover:text-orange-900">✕</button>
                                </span>
                            )}
                            {skillFilter && (
                                <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                    Skill: {skillFilter}
                                    <button onClick={() => setSkillFilter('')} className="hover:text-orange-900">✕</button>
                                </span>
                            )}
                            <button onClick={clearFilters} className="text-[9px] text-orange-500 font-semibold hover:underline">Clear All</button>
                        </div>
                    )}
                </div>

                {/* Results Count */}
                {!loading && groups.length > 0 && (
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-xs text-gray-500 font-medium">
                            {total} group{total !== 1 ? 's' : ''} found
                            {skillFilter && <span> with <span className="font-semibold text-orange-600">{skillFilter}</span> skill</span>}
                        </p>
                    </div>
                )}

                {/* Groups Grid */}
                {loading && groups.length === 0 ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 size="40" className="animate-spin text-orange-500" />
                    </div>
                ) : groups.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center"
                    >
                        <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Users size="36" className="text-gray-400" />
                        </div>
                        <h3 className="font-bold text-gray-700 text-lg mb-2">No Groups Found</h3>
                        <p className="text-gray-400 text-sm max-w-sm mx-auto">
                            {search || skillFilter ? 'Try adjusting your search or filters.' : 'No worker groups are available yet.'}
                        </p>
                        {(search || skillFilter) && (
                            <button onClick={clearFilters} className="mt-5 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl text-sm font-semibold hover:shadow-md transition-all">
                                Clear Filters
                            </button>
                        )}
                    </motion.div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-5">
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
                                className="w-full mt-6 py-3 bg-white border border-orange-200 text-orange-600 rounded-xl font-semibold text-sm hover:bg-orange-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                            >
                                {loading ? <Loader2 size="14" className="animate-spin" /> : <ChevronDown size="14" />}
                                Load More Groups
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// // Helper Loader Component
// const Loader2 = ({ size, className }) => (
//     <svg className={`animate-spin ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//         <path d="M21 12a9 9 0 1 1-6.219-8.56" />
//     </svg>
// );