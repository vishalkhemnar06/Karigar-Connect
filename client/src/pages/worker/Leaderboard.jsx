import { getImageUrl } from '../../constants/config';
import React, { useState, useEffect, useMemo } from 'react';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { 
    Trophy, Medal, Crown, Star, TrendingUp, Award, ChevronRight, 
    RefreshCw, Users, BarChart3, Sparkles, Target, Zap, 
    Gift, Flame, Diamond, Shield, MapPin, Briefcase 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Leaderboard = () => {
    const [leaders, setLeaders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState('points'); // 'points' or 'name'
    const [filterBy, setFilterBy] = useState('all'); // 'all', 'top10', 'top25'
    const [hoveredCard, setHoveredCard] = useState(null);

    useEffect(() => {
        fetchLeaders();
    }, []);

    const fetchLeaders = async () => {
        try {
            setLoading(true);
            const { data } = await api.getLeaderboard();
            setLeaders(data);
        } catch (error) {
            toast.error("Could not fetch leaderboard. Please try again.");
            console.error('Leaderboard fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        fetchLeaders();
        toast.success("Leaderboard refreshed!");
    };

    const getRankIcon = (index) => {
        switch(index) {
            case 0:
                return <Crown size={24} className="text-yellow-500 drop-shadow-lg" />;
            case 1:
                return <Medal size={24} className="text-gray-400 drop-shadow-lg" />;
            case 2:
                return <Medal size={24} className="text-amber-600 drop-shadow-lg" />;
            default:
                return null;
        }
    };

    const getRankColor = (index) => {
        if (index === 0) return "from-yellow-400 to-orange-500";
        if (index === 1) return "from-gray-300 to-gray-400";
        if (index === 2) return "from-amber-600 to-orange-600";
        return "from-gray-100 to-gray-200";
    };

    const getRankBgColor = (index) => {
        if (index === 0) return "bg-gradient-to-r from-yellow-50 via-orange-50 to-amber-50 border-2 border-yellow-200 shadow-lg";
        if (index === 1) return "bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-200 shadow-md";
        if (index === 2) return "bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 shadow-md";
        return "bg-white hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 border border-gray-100 hover:shadow-md transition-all duration-300";
    };

    const getPointsColor = (points) => {
        if (points >= 1000) return "text-purple-600";
        if (points >= 500) return "text-blue-600";
        if (points >= 200) return "text-green-600";
        return "text-orange-600";
    };

    const getPointsBadge = (points) => {
        if (points >= 1000) return { label: "Legend", color: "from-purple-500 to-pink-500", icon: <Diamond size={10} /> };
        if (points >= 500) return { label: "Master", color: "from-blue-500 to-cyan-500", icon: <Zap size={10} /> };
        if (points >= 200) return { label: "Expert", color: "from-green-500 to-emerald-500", icon: <Target size={10} /> };
        return { label: "Rising Star", color: "from-orange-500 to-red-500", icon: <Sparkles size={10} /> };
    };

    const sortedAndFilteredLeaders = useMemo(() => {
        let filtered = [...leaders];
        
        // Apply filters
        if (filterBy === 'top10') {
            filtered = filtered.slice(0, 10);
        } else if (filterBy === 'top25') {
            filtered = filtered.slice(0, 25);
        }
        
        // Apply sorting
        if (sortBy === 'name') {
            filtered.sort((a, b) => a.name.localeCompare(b.name));
        } else {
            // Already sorted by points from API, but ensure it's consistent
            filtered.sort((a, b) => b.points - a.points);
        }
        
        return filtered;
    }, [leaders, sortBy, filterBy]);

    const getStatCard = () => {
        if (leaders.length === 0) return null;
        
        const totalPoints = leaders.reduce((sum, leader) => sum + leader.points, 0);
        const avgPoints = Math.round(totalPoints / leaders.length);
        const top3Points = leaders.slice(0, 3).reduce((sum, l) => sum + l.points, 0);
        
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    whileTap={{ scale: 0.98 }}
                    className="relative overflow-hidden bg-gradient-to-br from-orange-500 to-red-600 rounded-xl md:rounded-2xl p-3 md:p-5 text-white shadow-lg"
                >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full blur-2xl" />
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-1 md:mb-2">
                            <p className="text-[10px] md:text-sm font-semibold opacity-90">Total Karigars</p>
                            <Users size={20} className="opacity-80 md:size-7" />
                        </div>
                        <p className="text-xl md:text-3xl font-black">{leaders.length}</p>
                        <p className="text-[8px] md:text-xs opacity-80 mt-0.5 md:mt-1">active members</p>
                    </div>
                </motion.div>
                
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    whileTap={{ scale: 0.98 }}
                    className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl md:rounded-2xl p-3 md:p-5 text-white shadow-lg"
                >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full blur-2xl" />
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-1 md:mb-2">
                            <p className="text-[10px] md:text-sm font-semibold opacity-90">Total Points</p>
                            <TrendingUp size={20} className="opacity-80 md:size-7" />
                        </div>
                        <p className="text-xl md:text-3xl font-black">{totalPoints.toLocaleString()}</p>
                        <p className="text-[8px] md:text-xs opacity-80 mt-0.5 md:mt-1">cumulative points</p>
                    </div>
                </motion.div>
                
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    whileTap={{ scale: 0.98 }}
                    className="relative overflow-hidden bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl md:rounded-2xl p-3 md:p-5 text-white shadow-lg"
                >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full blur-2xl" />
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-1 md:mb-2">
                            <p className="text-[10px] md:text-sm font-semibold opacity-90">Average Points</p>
                            <Star size={20} className="opacity-80 md:size-7" />
                        </div>
                        <p className="text-xl md:text-3xl font-black">{avgPoints.toLocaleString()}</p>
                        <p className="text-[8px] md:text-xs opacity-80 mt-0.5 md:mt-1">per karigar</p>
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    whileTap={{ scale: 0.98 }}
                    className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl md:rounded-2xl p-3 md:p-5 text-white shadow-lg"
                >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full blur-2xl" />
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-1 md:mb-2">
                            <p className="text-[10px] md:text-sm font-semibold opacity-90">Top 3 Total</p>
                            <Flame size={20} className="opacity-80 md:size-7" />
                        </div>
                        <p className="text-xl md:text-3xl font-black">{top3Points.toLocaleString()}</p>
                        <p className="text-[8px] md:text-xs opacity-80 mt-0.5 md:mt-1">from top performers</p>
                    </div>
                </motion.div>
            </div>
        );
    };

    const getLeaderCard = (leader, index) => {
        const actualRank = leaders.findIndex(l => l._id === leader._id) + 1;
        const isTopThree = actualRank <= 3;
        const pointsBadge = getPointsBadge(leader.points);
        const isHovered = hoveredCard === leader._id;
        
        return (
            <motion.li
                key={leader._id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                whileTap={{ scale: 0.98 }}
                onMouseEnter={() => setHoveredCard(leader._id)}
                onMouseLeave={() => setHoveredCard(null)}
                className={`p-3 md:p-5 flex items-center space-x-2 md:space-x-4 transition-all duration-300 ${getRankBgColor(actualRank - 1)}`}
            >
                {/* Rank - Mobile optimized */}
                <div className="w-10 md:w-16 text-center flex-shrink-0">
                    {isTopThree ? (
                        <motion.div 
                            whileTap={{ scale: 0.9 }}
                            className="flex justify-center"
                        >
                            {getRankIcon(actualRank - 1)}
                        </motion.div>
                    ) : (
                        <div className="relative">
                            <span className={`relative text-sm md:text-xl font-black ${actualRank <= 10 ? 'bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent' : 'text-gray-500'}`}>
                                #{actualRank}
                            </span>
                        </div>
                    )}
                </div>
                
                {/* Avatar with ring effect - Mobile optimized */}
                <div className="relative flex-shrink-0">
                    <motion.div 
                        whileTap={{ scale: 0.95 }}
                        className="relative"
                    >
                        <div className={`absolute inset-0 rounded-full ${isTopThree ? `bg-gradient-to-r ${getRankColor(actualRank - 1)} blur-md` : ''}`} 
                             style={{ opacity: isHovered ? 0.5 : 0, transition: 'opacity 0.3s' }} />
                        <img 
                            src={getImageUrl(leader.photo, `https://ui-avatars.com/api/?name=${leader.name}&background=random&bold=true`)} 
                            alt={leader.name} 
                            className={`h-12 w-12 md:h-16 md:w-16 rounded-full object-cover border-2 md:border-3 shadow-lg transition-all duration-300 ${
                                isTopThree 
                                    ? `border-${actualRank === 1 ? 'yellow-400' : actualRank === 2 ? 'gray-300' : 'amber-600'} ring-1 md:ring-2 ring-offset-1 md:ring-offset-2 ring-${actualRank === 1 ? 'yellow-400' : actualRank === 2 ? 'gray-300' : 'amber-600'}`
                                    : 'border-gray-200 hover:border-orange-300'
                            }`}
                        />
                        {isTopThree && (
                            <motion.div 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: index * 0.1 }}
                                className={`absolute -top-1 -right-1 w-4 h-4 md:w-6 md:h-6 rounded-full bg-gradient-to-r ${getRankColor(actualRank - 1)} flex items-center justify-center shadow-lg`}
                            >
                                <div className="w-1.5 h-1.5 md:w-2.5 md:h-2.5 bg-white rounded-full"></div>
                            </motion.div>
                        )}
                    </motion.div>
                </div>
                
                {/* Info with enhanced details - Mobile optimized */}
                <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                        <p className="font-bold text-gray-800 text-sm md:text-xl truncate max-w-[120px] md:max-w-none">{leader.name}</p>
                        <motion.span 
                            whileTap={{ scale: 0.95 }}
                            className={`inline-flex items-center gap-0.5 md:gap-1 px-1.5 md:px-2.5 py-0.5 md:py-1 bg-gradient-to-r ${pointsBadge.color} text-white text-[8px] md:text-[10px] font-bold rounded-full shadow-sm flex-shrink-0`}
                        >
                            {pointsBadge.icon}
                            <span className="hidden xs:inline">{pointsBadge.label}</span>
                        </motion.span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 md:gap-3 mt-0.5 md:mt-1">
                        <p className="text-[9px] md:text-xs text-gray-500 font-mono flex items-center gap-0.5 md:gap-1">
                            <Briefcase size={8} className="md:size-3" />
                            <span className="truncate max-w-[60px] md:max-w-none">ID: {leader.karigarId}</span>
                        </p>
                        {leader.location && (
                            <p className="text-[9px] md:text-xs text-gray-500 flex items-center gap-0.5 md:gap-1">
                                <MapPin size={8} className="md:size-3" />
                                <span className="truncate max-w-[80px] md:max-w-none">{leader.location}</span>
                            </p>
                        )}
                    </div>
                    {leader.achievements && leader.achievements.length > 0 && (
                        <div className="flex gap-1 mt-1 md:mt-2 flex-wrap">
                            {leader.achievements.slice(0, 2).map((achievement, i) => (
                                <motion.span 
                                    key={i}
                                    initial={{ scale: 0.9 }}
                                    animate={{ scale: 1 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="text-[8px] md:text-xs bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 px-1.5 md:px-2 py-0.5 md:py-1 rounded-full font-medium shadow-sm"
                                >
                                    🏆 {achievement.length > 12 ? achievement.slice(0, 10) + '...' : achievement}
                                </motion.span>
                            ))}
                            {leader.achievements.length > 2 && (
                                <span className="text-[7px] md:text-xs text-gray-400">+{leader.achievements.length - 2}</span>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Points with animation - Mobile optimized */}
                <div className="text-right flex-shrink-0">
                    <motion.div 
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-0.5 md:gap-2"
                    >
                        <p className={`text-base md:text-3xl font-black ${getPointsColor(leader.points)}`}>
                            {leader.points.toLocaleString()}
                        </p>
                        <motion.div
                            animate={isTopThree ? { rotate: [0, 10, -10, 0] } : {}}
                            transition={{ duration: 1, repeat: isTopThree ? Infinity : 0, repeatDelay: 3 }}
                        >
                            <Trophy size={16} className={`md:size-6 ${isTopThree ? "text-yellow-500" : "text-gray-300"}`} />
                        </motion.div>
                    </motion.div>
                    <p className="text-[8px] md:text-xs text-gray-400 mt-0.5 md:mt-1 hidden xs:block">Total Points</p>
                    {leader.pointsChange && (
                        <p className="text-[7px] md:text-xs text-green-500 mt-0.5 flex items-center gap-0.5 justify-end">
                            <TrendingUp size={7} className="md:size-3" />
                            +{leader.pointsChange}
                        </p>
                    )}
                </div>
            </motion.li>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen p-4">
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center"
                >
                    <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="w-12 h-12 md:w-16 md:h-16 border-3 md:border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-3 md:mb-4"
                    />
                    <p className="text-gray-600 font-semibold text-sm md:text-base">Loading leaderboard...</p>
                    <p className="text-xs text-gray-400 mt-1">Fetching top performers</p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
                {/* Header with decorative elements - Mobile optimized */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative mb-6 md:mb-8"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 md:w-64 md:h-64 bg-gradient-to-r from-orange-200 to-red-200 rounded-full blur-3xl opacity-30" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 md:w-64 md:h-64 bg-gradient-to-r from-yellow-200 to-orange-200 rounded-full blur-3xl opacity-30" />
                    
                    <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4">
                        <div>
                            <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg">
                                    <Trophy size={20} className="md:size-6 text-white" />
                                </div>
                                <h1 className="text-2xl md:text-5xl font-black bg-gradient-to-r from-orange-600 via-red-600 to-purple-600 bg-clip-text text-transparent">
                                    Top Karigars
                                </h1>
                            </div>
                            <p className="text-gray-600 text-xs md:text-lg mt-0.5 md:mt-1">Celebrating excellence in craftsmanship</p>
                        </div>
                        
                        <div className="flex gap-2 md:gap-3">
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={handleRefresh}
                                className="p-2 md:p-3 bg-white hover:bg-gray-100 rounded-lg md:rounded-xl transition-all duration-200 shadow-md border border-gray-200 touch-manipulation"
                                title="Refresh leaderboard"
                            >
                                <RefreshCw size={16} className="md:size-5 text-gray-600" />
                            </motion.button>
                        </div>
                    </div>
                </motion.div>
                
                {/* Stats Cards */}
                {getStatCard()}
                
                {/* Enhanced Filters - Mobile optimized with horizontal scroll */}
                <div className="overflow-x-auto no-scrollbar -mx-4 px-4 mb-5 md:mb-8">
                    <div className="flex flex-nowrap gap-2 md:gap-4 min-w-max pb-1">
                        <div className="flex gap-2">
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setSortBy('points')}
                                className={`px-3 md:px-5 py-1.5 md:py-2.5 rounded-lg md:rounded-xl font-semibold transition-all duration-200 flex items-center gap-1.5 md:gap-2 text-xs md:text-sm whitespace-nowrap touch-manipulation ${
                                    sortBy === 'points' 
                                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg' 
                                        : 'bg-white text-gray-600 hover:bg-gray-100 border-2 border-gray-200'
                                }`}
                            >
                                <Trophy size={12} className="md:size-4" />
                                Rank by Points
                            </motion.button>
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setSortBy('name')}
                                className={`px-3 md:px-5 py-1.5 md:py-2.5 rounded-lg md:rounded-xl font-semibold transition-all duration-200 flex items-center gap-1.5 md:gap-2 text-xs md:text-sm whitespace-nowrap touch-manipulation ${
                                    sortBy === 'name' 
                                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg' 
                                        : 'bg-white text-gray-600 hover:bg-gray-100 border-2 border-gray-200'
                                }`}
                            >
                                <Users size={12} className="md:size-4" />
                                Sort by Name
                            </motion.button>
                        </div>
                        
                        <div className="flex gap-2">
                            {[
                                { key: 'all', label: 'All', icon: <Users size={12} /> },
                                { key: 'top10', label: 'Top 10', icon: <Crown size={12} /> },
                                { key: 'top25', label: 'Top 25', icon: <Medal size={12} /> },
                            ].map((option) => (
                                <motion.button
                                    key={option.key}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setFilterBy(option.key)}
                                    className={`px-3 md:px-5 py-1.5 md:py-2.5 rounded-lg md:rounded-xl font-semibold transition-all duration-200 flex items-center gap-1.5 md:gap-2 text-xs md:text-sm whitespace-nowrap touch-manipulation ${
                                        filterBy === option.key 
                                            ? 'bg-gray-800 text-white shadow-lg' 
                                            : 'bg-white text-gray-600 hover:bg-gray-100 border-2 border-gray-200'
                                    }`}
                                >
                                    {option.icon}
                                    {option.label}
                                </motion.button>
                            ))}
                        </div>
                    </div>
                </div>
                
                {/* Leaderboard List with enhanced styling - Mobile optimized */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-xl md:rounded-3xl shadow-xl md:shadow-2xl overflow-hidden border border-gray-100"
                >
                    {sortedAndFilteredLeaders.length === 0 ? (
                        <div className="text-center py-12 md:py-20">
                            <motion.div
                                animate={{ y: [0, -8, 0] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                <Trophy size={48} className="md:size-64 text-gray-300 mx-auto mb-3 md:mb-4" />
                            </motion.div>
                            <p className="text-gray-500 text-base md:text-xl font-semibold">No karigars found</p>
                            <p className="text-gray-400 text-xs md:text-sm mt-1 md:mt-2">Check back later for updates</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            <AnimatePresence>
                                {sortedAndFilteredLeaders.map((leader, index) => getLeaderCard(leader, index))}
                            </AnimatePresence>
                        </ul>
                    )}
                </motion.div>
                
                {/* Enhanced Footer - Mobile optimized */}
                {leaders.length > 25 && filterBy !== 'all' && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-5 md:mt-8 text-center"
                    >
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setFilterBy('all')}
                            className="inline-flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg md:rounded-xl font-semibold text-xs md:text-sm hover:shadow-lg transition-all touch-manipulation"
                        >
                            <Users size={14} className="md:size-4" />
                            View all {leaders.length} karigars
                            <ChevronRight size={14} className="md:size-4" />
                        </motion.button>
                    </motion.div>
                )}

                {/* Motivational banner - Mobile optimized */}
                {leaders.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-6 md:mt-10 p-4 md:p-6 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl md:rounded-2xl border border-orange-200 text-center"
                    >
                        <div className="flex items-center justify-center gap-1.5 md:gap-2 mb-1 md:mb-2">
                            <Sparkles size={14} className="md:size-5 text-orange-500" />
                            <p className="text-xs md:text-sm font-semibold text-gray-700">Keep Up the Great Work!</p>
                            <Sparkles size={14} className="md:size-5 text-orange-500" />
                        </div>
                        <p className="text-[10px] md:text-xs text-gray-600 px-2">
                            Complete more jobs, get better ratings, and climb the leaderboard. 
                            Top performers get exclusive rewards and recognition!
                        </p>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default Leaderboard;