// src/pages/client/ClientGroups.jsx
// Brand new page — clients browse all worker groups, view member profiles,
// contact group admin via phone/email

import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../../api';
import {
    Users, Search, Phone, Mail, ChevronRight, X, Shield,
    Briefcase, Star, RefreshCw, Loader2, MapPin, ExternalLink,
    Filter, ChevronDown, User, MessageSquare, Copy, CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

// ── helpers ───────────────────────────────────────────────────────────────────
const SKILL_OPTIONS = [
    'Plumber', 'Electrician', 'Carpenter', 'Painter', 'Mason',
    'Welder', 'Tiler', 'AC Technician', 'Interior Designer', 'Other',
];

// ── Member Profile Drawer ─────────────────────────────────────────────────────
const MemberDrawer = ({ member, isAdmin, onClose, navigate }) => {
    if (!member) return null;
    const skills = Array.isArray(member.skills)
        ? member.skills.map(s => typeof s === 'object' ? s.name : s)
        : [];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-end"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={onClose}
        >
            <div
                className="relative bg-white h-full w-full max-w-sm shadow-2xl flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-br from-orange-500 to-amber-500 p-6 flex-shrink-0">
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all">
                        <X size={18} className="text-white" />
                    </button>
                    <div className="flex items-center gap-4">
                        {member.photo ? (
                            <img src={member.photo} alt={member.name} className="w-16 h-16 rounded-2xl object-cover border-3 border-white/50 shadow-lg flex-shrink-0" />
                        ) : (
                            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 border-2 border-white/40">
                                <User size={28} className="text-white" />
                            </div>
                        )}
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-xl font-black text-white">{member.name}</h3>
                                {isAdmin && (
                                    <span className="bg-white/25 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-white/30">
                                        <Shield size={8} /> ADMIN
                                    </span>
                                )}
                            </div>
                            <p className="text-orange-100 text-xs font-mono font-semibold">{member.karigarId}</p>
                            {member.overallExperience && (
                                <p className="text-orange-100 text-xs mt-1">{member.overallExperience}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Skills */}
                    {skills.length > 0 && (
                        <div>
                            <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <Briefcase size={11} /> Skills
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {skills.map((s, i) => (
                                    <span key={i} className="bg-orange-50 text-orange-700 text-xs font-bold px-2.5 py-1 rounded-full border border-orange-200">{s}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Experience */}
                    {member.experience && (
                        <div className="flex items-center gap-3 bg-orange-50 rounded-2xl p-3 border border-orange-100">
                            <Star size={16} className="text-orange-500 flex-shrink-0" />
                            <p className="text-sm font-semibold text-gray-700">{member.experience} years of experience</p>
                        </div>
                    )}

                    {/* City */}
                    {member.address?.city && (
                        <div className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3 border border-gray-100">
                            <MapPin size={16} className="text-gray-400 flex-shrink-0" />
                            <p className="text-sm font-semibold text-gray-700">{member.address.city}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 p-5 border-t border-gray-100">
                    <button
                        onClick={() => { onClose(); navigate(`/profile/public/${member.karigarId}`); }}
                        className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-orange-200 hover:shadow-orange-300 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <ExternalLink size={15} /> View Full Profile
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Contact Admin Modal ───────────────────────────────────────────────────────
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={onClose}
        >
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-5 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-black">Contact Group Admin</h3>
                            <p className="text-orange-100 text-xs mt-0.5">{group.name}</p>
                        </div>
                        <button onClick={onClose} className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    {/* Admin info */}
                    <div className="flex items-center gap-4 bg-orange-50 rounded-2xl p-4 border border-orange-100">
                        {admin?.photo ? (
                            <img src={admin.photo} alt={admin.name} className="w-12 h-12 rounded-2xl object-cover border-2 border-orange-200 flex-shrink-0" />
                        ) : (
                            <div className="w-12 h-12 rounded-2xl bg-orange-200 flex items-center justify-center flex-shrink-0">
                                <Shield size={20} className="text-orange-600" />
                            </div>
                        )}
                        <div>
                            <p className="font-bold text-gray-900">{admin?.name}</p>
                            <p className="text-xs text-orange-500 font-mono">{admin?.karigarId}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Group Admin</p>
                        </div>
                    </div>

                    {/* Phone */}
                    {admin?.mobile && (
                        <div className="border-2 border-gray-100 rounded-2xl p-4 hover:border-orange-200 transition-all">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Phone size={11} /> Mobile Number
                            </p>
                            <div className="flex items-center justify-between gap-3">
                                <p className="font-bold text-gray-900 font-mono text-lg">{admin.mobile}</p>
                                <div className="flex gap-2">
                                    <a
                                        href={`tel:+91${admin.mobile}`}
                                        className="flex items-center gap-1.5 bg-green-500 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-green-600 transition-all shadow-lg shadow-green-200"
                                    >
                                        <Phone size={13} /> Call
                                    </a>
                                    <button
                                        onClick={() => copy(admin.mobile, 'phone')}
                                        className="flex items-center gap-1 bg-gray-100 text-gray-600 px-3 py-2 rounded-xl text-xs font-bold hover:bg-gray-200 transition-all"
                                    >
                                        {copied === 'phone' ? <CheckCircle size={13} className="text-green-500" /> : <Copy size={13} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Email */}
                    {admin?.email && (
                        <div className="border-2 border-gray-100 rounded-2xl p-4 hover:border-orange-200 transition-all">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Mail size={11} /> Email Address
                            </p>
                            <div className="flex items-center justify-between gap-3">
                                <p className="font-bold text-gray-900 text-sm truncate">{admin.email}</p>
                                <div className="flex gap-2 flex-shrink-0">
                                    <a
                                        href={`mailto:${admin.email}`}
                                        className="flex items-center gap-1.5 bg-blue-500 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-200"
                                    >
                                        <Mail size={13} /> Email
                                    </a>
                                    <button
                                        onClick={() => copy(admin.email, 'email')}
                                        className="flex items-center gap-1 bg-gray-100 text-gray-600 px-3 py-2 rounded-xl text-xs font-bold hover:bg-gray-200 transition-all"
                                    >
                                        {copied === 'email' ? <CheckCircle size={13} className="text-green-500" /> : <Copy size={13} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {!admin?.mobile && !admin?.email && (
                        <div className="text-center py-6 text-gray-400">
                            <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Contact details not available</p>
                        </div>
                    )}

                    <p className="text-xs text-gray-400 text-center">
                        Contact the group admin directly to discuss job requirements and availability
                    </p>
                </div>
            </div>
        </div>
    );
};

// ── Group Card ────────────────────────────────────────────────────────────────
const GroupCard = ({ group, onViewMember, onContact }) => {
    const admin   = group.creator;
    const members = group.members || [];

    // Collect unique skills from all members
    const allSkills = [...new Set(
        members.flatMap(m =>
            Array.isArray(m.skills) ? m.skills.map(s => typeof s === 'object' ? s.name : s) : []
        )
    )].slice(0, 5);

    return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-black text-white truncate">{group.name}</h3>
                        {group.description && (
                            <p className="text-orange-100 text-xs mt-1 line-clamp-2">{group.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-3">
                            <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                                <Users size={11} /> {members.length} member{members.length !== 1 ? 's' : ''}
                            </span>
                            <span className="bg-white/15 text-white/80 text-xs font-mono px-2 py-1 rounded-full">
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
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Group Skills</p>
                        <div className="flex flex-wrap gap-1.5">
                            {allSkills.map((s, i) => (
                                <span key={i} className="bg-orange-50 text-orange-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-orange-100">{s}</span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Members row — clickable */}
                <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Team Members</p>
                    <div className="flex flex-wrap gap-2">
                        {members.slice(0, 6).map((m, i) => {
                            const isAdmin = m._id?.toString() === (admin?._id?.toString() || admin?.toString());
                            return (
                                <button
                                    key={m._id || i}
                                    onClick={() => onViewMember(m, isAdmin)}
                                    className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2 hover:border-orange-300 hover:bg-orange-50 transition-all group"
                                >
                                    {m.photo ? (
                                        <img src={m.photo} alt={m.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                                    ) : (
                                        <div className="w-7 h-7 rounded-full bg-orange-200 flex items-center justify-center flex-shrink-0">
                                            <span className="text-[10px] font-bold text-orange-700">
                                                {(m.name || 'W').charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                    <div className="text-left">
                                        <p className="text-xs font-bold text-gray-800 group-hover:text-orange-700 transition-colors leading-tight">
                                            {m.name?.split(' ')[0]}
                                            {isAdmin && <span className="ml-1 text-orange-500">★</span>}
                                        </p>
                                        <p className="text-[10px] text-gray-400 font-mono">{m.karigarId}</p>
                                    </div>
                                </button>
                            );
                        })}
                        {members.length > 6 && (
                            <div className="flex items-center justify-center bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2 text-xs font-bold text-gray-400">
                                +{members.length - 6} more
                            </div>
                        )}
                    </div>
                </div>

                {/* Admin info + contact */}
                {admin && (
                    <div className="flex items-center justify-between gap-3 bg-orange-50 rounded-2xl p-3 border border-orange-100">
                        <div className="flex items-center gap-2.5">
                            {admin.photo ? (
                                <img src={admin.photo} alt={admin.name} className="w-9 h-9 rounded-xl object-cover border border-orange-200 flex-shrink-0" />
                            ) : (
                                <div className="w-9 h-9 rounded-xl bg-orange-200 flex items-center justify-center flex-shrink-0">
                                    <Shield size={14} className="text-orange-600" />
                                </div>
                            )}
                            <div>
                                <p className="text-xs font-black text-gray-800">{admin.name}</p>
                                <p className="text-[10px] text-orange-500 font-bold">Group Admin</p>
                            </div>
                        </div>
                        <button
                            onClick={() => onContact(group)}
                            className="flex items-center gap-1.5 bg-orange-500 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-orange-600 active:scale-95 transition-all shadow-md shadow-orange-200 flex-shrink-0"
                        >
                            <Phone size={12} /> Contact
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
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
    const [viewMember, setViewMember]   = useState(null); // { member, isAdmin }
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
        <div className="min-h-screen bg-gradient-to-br from-orange-50/40 via-white to-orange-50/20 p-4 md:p-8">
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
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-200">
                            <Users size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900">Browse Worker Groups</h1>
                            <p className="text-sm text-gray-500">Find skilled teams for your projects</p>
                        </div>
                    </div>
                </div>

                {/* Search + filter bar */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 mb-6 space-y-3">
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search groups by name or description..."
                                className="w-full pl-10 pr-4 py-3 border-2 border-gray-100 rounded-2xl text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-50 outline-none transition-all"
                            />
                        </div>
                        <button
                            onClick={() => setShowFilters(v => !v)}
                            className={`flex items-center gap-2 px-4 py-3 rounded-2xl border-2 font-bold text-sm transition-all ${
                                showFilters || skillFilter
                                    ? 'border-orange-400 bg-orange-50 text-orange-600'
                                    : 'border-gray-100 text-gray-600 hover:border-orange-200'
                            }`}
                        >
                            <Filter size={15} />
                            Filter
                            {skillFilter && <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />}
                        </button>
                        <button
                            onClick={() => fetchGroups(1, true)}
                            className="p-3 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-2xl transition-all border-2 border-gray-100"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    {showFilters && (
                        <div>
                            <p className="text-xs font-bold text-gray-500 mb-2">Filter by Skill</p>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setSkillFilter('')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${!skillFilter ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600'}`}
                                >
                                    All Skills
                                </button>
                                {SKILL_OPTIONS.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setSkillFilter(skillFilter === s ? '' : s)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${skillFilter === s ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600'}`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Results count */}
                {!loading && (
                    <p className="text-sm text-gray-500 font-medium mb-4">
                        {total} group{total !== 1 ? 's' : ''} found
                        {skillFilter && <span> with <strong className="text-orange-600">{skillFilter}</strong> skill</span>}
                        {search && <span> matching "<strong>{search}</strong>"</span>}
                    </p>
                )}

                {/* Groups grid */}
                {loading && groups.length === 0 ? (
                    <div className="flex justify-center py-20">
                        <Loader2 size={32} className="animate-spin text-orange-400" />
                    </div>
                ) : groups.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <Users size={48} className="mx-auto mb-3 opacity-30" />
                        <p className="font-medium text-lg">No groups found</p>
                        <p className="text-sm mt-1">Try a different search or clear filters</p>
                        {(search || skillFilter) && (
                            <button
                                onClick={() => { setSearch(''); setSkillFilter(''); }}
                                className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-2xl text-sm font-bold hover:bg-orange-600 transition-all"
                            >
                                Clear all filters
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                                className="w-full mt-6 py-3 border-2 border-orange-200 text-orange-600 rounded-2xl font-bold text-sm hover:bg-orange-50 transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <ChevronDown size={16} />}
                                Load more groups
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}