// src/pages/worker/AcceptInvites.jsx
// ENHANCED UI VERSION - Mobile Optimized
// Modern gradients, animations, better visual hierarchy, micro-interactions

import React, { useEffect, useState } from 'react';
import { getMyGroupsAPI, leaveGroupAPI } from '../../api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Users, UserPlus, UserMinus, Crown, Shield, 
    Calendar, ChevronRight, RefreshCw, AlertCircle,
    User, X, Plus, Search, Filter, Sparkles, 
    Star, Award, Heart, Smile, MessageCircle
} from 'lucide-react';

export default function AcceptInvites() {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [leavingId, setLeavingId] = useState(null);
    const [expandedGroup, setExpandedGroup] = useState(null);

    const fetchGroups = async () => {
        try {
            setLoading(true);
            const { data } = await getMyGroupsAPI();
            setGroups(data || []);
        } catch {
            toast.error('Failed to load groups');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchGroups(); }, []);

    const handleLeave = async (groupId) => {
        if (!window.confirm('Are you sure you want to leave this group? You will lose access to group resources and conversations.')) return;
        setLeavingId(groupId);
        try {
            await leaveGroupAPI(groupId);
            toast.success('Left group successfully');
            fetchGroups();
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Failed to leave group');
        } finally {
            setLeavingId(null);
        }
    };

    const getMemberCount = (members) => {
        if (!members) return 0;
        return members.length;
    };

    const getGroupIcon = (groupName) => {
        const firstLetter = groupName?.charAt(0)?.toUpperCase() || 'G';
        return firstLetter;
    };

    const getRandomGradient = (id) => {
        const gradients = [
            'from-orange-500 to-red-500',
            'from-blue-500 to-indigo-500',
            'from-green-500 to-emerald-500',
            'from-purple-500 to-pink-500',
            'from-yellow-500 to-orange-500',
            'from-cyan-500 to-blue-500',
        ];
        const index = (id?.length || 0) % gradients.length;
        return gradients[index];
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-10 h-10 md:w-12 md:h-12 border-3 md:border-4 border-orange-500 border-t-transparent rounded-full"
            />
            <p className="mt-3 md:mt-4 text-gray-500 font-semibold text-sm md:text-base">Loading your groups...</p>
            <p className="text-xs text-gray-400 mt-1">Fetching group memberships</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white pb-20">
            <div className="max-w-2xl mx-auto px-4 pt-4 md:pt-6 pb-16">
                {/* Enhanced Header */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl md:rounded-3xl p-4 md:p-6 mb-5 md:mb-6 text-white shadow-2xl relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 md:w-32 md:h-32 bg-white/10 rounded-full blur-2xl" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 md:w-32 md:h-32 bg-white/10 rounded-full blur-2xl" />
                    
                    <div className="flex items-center gap-2 md:gap-3 relative z-10">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-white/20 rounded-xl md:rounded-2xl flex items-center justify-center backdrop-blur-sm">
                            <Users size={20} className="md:size-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-black">My Groups</h1>
                            <p className="text-white/80 text-[10px] md:text-xs mt-0.5 md:mt-1">
                                {groups.length} active group{groups.length !== 1 ? 's' : ''} membership{groups.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Stats Cards */}
                {groups.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="grid grid-cols-2 gap-2 md:gap-3 mb-4 md:mb-6"
                    >
                        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl md:rounded-2xl p-3 md:p-4 border border-orange-100">
                            <div className="flex items-center justify-between mb-1">
                                <Users size={16} className="md:size-5 text-orange-500" />
                                <Sparkles size={12} className="md:size-4 text-orange-400" />
                            </div>
                            <p className="text-xl md:text-2xl font-black text-orange-600">{groups.length}</p>
                            <p className="text-[9px] md:text-xs text-gray-500 font-medium">Total Groups</p>
                        </div>
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl md:rounded-2xl p-3 md:p-4 border border-blue-100">
                            <div className="flex items-center justify-between mb-1">
                                <Crown size={16} className="md:size-5 text-blue-500" />
                                <Star size={12} className="md:size-4 text-blue-400" />
                            </div>
                            <p className="text-xl md:text-2xl font-black text-blue-600">
                                {groups.filter(g => g.isAdmin).length}
                            </p>
                            <p className="text-[9px] md:text-xs text-gray-500 font-medium">Admin Groups</p>
                        </div>
                    </motion.div>
                )}

                {/* Main Content */}
                {groups.length === 0 ? (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-2xl md:rounded-3xl border-2 border-gray-100 p-6 md:p-10 text-center shadow-lg"
                    >
                        <motion.div
                            animate={{ y: [0, -8, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="text-5xl md:text-6xl mb-3 md:mb-4"
                        >
                            👥
                        </motion.div>
                        <p className="font-bold text-gray-800 text-lg md:text-xl mb-1">No Groups Yet</p>
                        <p className="text-gray-500 text-xs md:text-sm max-w-sm mx-auto leading-relaxed">
                            You're not in any groups yet. Ask a group admin to add you, or create your own group to collaborate with other karigars.
                        </p>
                        <div className="mt-5 md:mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
                            <MessageCircle size={12} className="md:size-3" />
                            <span>Groups help you collaborate and share resources</span>
                        </div>
                    </motion.div>
                ) : (
                    <div className="space-y-3 md:space-y-4">
                        <AnimatePresence>
                            {groups.map((group, index) => {
                                const isExpanded = expandedGroup === group._id;
                                const memberCount = getMemberCount(group.members);
                                const gradient = getRandomGradient(group._id);
                                
                                return (
                                    <motion.div
                                        key={group._id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="bg-white rounded-xl md:rounded-2xl border border-gray-100 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
                                    >
                                        {/* Card Header */}
                                        <div className="p-3 md:p-5">
                                            <div className="flex items-start gap-2 md:gap-3">
                                                {/* Group Icon */}
                                                <motion.div 
                                                    whileTap={{ scale: 0.95 }}
                                                    className={`w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-gradient-to-r ${gradient} flex items-center justify-center shadow-lg flex-shrink-0`}
                                                >
                                                    <span className="text-white text-xl md:text-2xl font-black">
                                                        {getGroupIcon(group.name)}
                                                    </span>
                                                </motion.div>

                                                <div className="flex-1 min-w-0">
                                                    {/* Group Name & Admin Badge */}
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <h2 className="font-bold text-gray-800 text-sm md:text-base truncate">
                                                                {group.name}
                                                            </h2>
                                                            {group.isAdmin && (
                                                                <motion.span 
                                                                    initial={{ scale: 0 }}
                                                                    animate={{ scale: 1 }}
                                                                    className="inline-flex items-center gap-0.5 md:gap-1 text-[9px] md:text-[10px] font-bold px-1.5 md:px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white mt-0.5 md:mt-1"
                                                                >
                                                                    <Crown size={8} className="md:size-3" />
                                                                    Admin
                                                                </motion.span>
                                                            )}
                                                        </div>
                                                        
                                                        {!group.isAdmin && (
                                                            <motion.button
                                                                whileTap={{ scale: 0.95 }}
                                                                onClick={() => handleLeave(group.groupId)}
                                                                disabled={leavingId === group.groupId}
                                                                className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all text-[10px] md:text-xs font-semibold touch-manipulation flex-shrink-0"
                                                            >
                                                                {leavingId === group.groupId ? (
                                                                    <div className="w-3 h-3 md:w-4 md:h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                                                ) : (
                                                                    <UserMinus size={10} className="md:size-3" />
                                                                )}
                                                                Leave
                                                            </motion.button>
                                                        )}
                                                    </div>

                                                    {/* Description */}
                                                    {group.description && (
                                                        <p className="text-gray-500 text-[10px] md:text-xs mt-1 line-clamp-2">
                                                            {group.description}
                                                        </p>
                                                    )}

                                                    {/* Group Info */}
                                                    <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-2">
                                                        <div className="flex items-center gap-0.5 md:gap-1 text-[9px] md:text-[10px] text-gray-400">
                                                            <Users size={9} className="md:size-3" />
                                                            <span>{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
                                                        </div>
                                                        <div className="w-1 h-1 rounded-full bg-gray-300" />
                                                        <div className="flex items-center gap-0.5 md:gap-1 text-[9px] md:text-[10px] text-gray-400">
                                                            <Calendar size={9} className="md:size-3" />
                                                            <span>ID: {group.groupId}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Expand/Collapse Toggle */}
                                            {memberCount > 0 && (
                                                <button
                                                    onClick={() => setExpandedGroup(isExpanded ? null : group._id)}
                                                    className="w-full mt-3 pt-2 flex items-center justify-center gap-1 text-[9px] md:text-[10px] text-gray-400 hover:text-orange-500 transition-colors touch-manipulation"
                                                >
                                                    <span>{isExpanded ? 'Hide members' : `Show members (${memberCount})`}</span>
                                                    <ChevronRight 
                                                        size={10} 
                                                        className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                                    />
                                                </button>
                                            )}
                                        </div>

                                        {/* Members Section - Expanded */}
                                        <AnimatePresence>
                                            {isExpanded && memberCount > 0 && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: 0.3 }}
                                                    className="border-t border-gray-100 bg-gradient-to-r from-gray-50 to-white"
                                                >
                                                    <div className="p-3 md:p-4">
                                                        <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
                                                            <Users size={12} className="md:size-4 text-orange-500" />
                                                            <p className="text-[10px] md:text-xs font-bold text-gray-600 uppercase tracking-wide">
                                                                Group Members
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2 md:gap-3">
                                                            {group.members?.map((member) => (
                                                                <motion.div
                                                                    key={member._id}
                                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                                    animate={{ opacity: 1, scale: 1 }}
                                                                    whileTap={{ scale: 0.95 }}
                                                                    className="flex flex-col items-center gap-0.5 group"
                                                                >
                                                                    <div className="relative">
                                                                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-full blur-sm opacity-0 group-hover:opacity-50 transition-opacity" />
                                                                        <img
                                                                            src={member.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=f97316&color=fff&bold=true`}
                                                                            alt={member.name}
                                                                            className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border-2 border-orange-100 shadow-md hover:border-orange-300 transition-all"
                                                                            onError={e => {
                                                                                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=f97316&color=fff&bold=true`;
                                                                            }}
                                                                        />
                                                                        {member.isAdmin && (
                                                                            <div className="absolute -bottom-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                                                                                <Crown size={8} className="md:size-3 text-white" />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-[9px] md:text-[10px] text-gray-600 font-medium truncate max-w-[50px] md:max-w-[60px]">
                                                                        {member.name?.split(' ')[0]}
                                                                    </span>
                                                                </motion.div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>

                        {/* Refresh Button */}
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={fetchGroups}
                            className="w-full py-2.5 md:py-3 border-2 border-orange-200 bg-white text-orange-600 rounded-xl md:rounded-2xl font-bold text-xs md:text-sm hover:bg-orange-50 transition-all flex items-center justify-center gap-2 shadow-md touch-manipulation"
                        >
                            <RefreshCw size={12} className="md:size-4" />
                            Refresh Groups
                        </motion.button>
                    </div>
                )}

                {/* Motivational Banner */}
                {groups.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-5 md:mt-6 p-3 md:p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl md:rounded-2xl border border-orange-200 text-center"
                    >
                        <div className="flex items-center justify-center gap-1.5 md:gap-2 mb-1">
                            <Heart size={12} className="md:size-4 text-orange-500" />
                            <p className="text-[10px] md:text-xs font-semibold text-gray-700">Collaborate & Grow Together</p>
                            <Heart size={12} className="md:size-4 text-orange-500" />
                        </div>
                        <p className="text-[8px] md:text-[10px] text-gray-600">
                            Connect with fellow group members, share resources, and grow your network. Active participation helps you earn more opportunities!
                        </p>
                    </motion.div>
                )}
            </div>
        </div>
    );
}