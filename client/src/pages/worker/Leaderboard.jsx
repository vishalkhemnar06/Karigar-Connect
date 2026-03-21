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
                return <Crown size={28} className="text-yellow-500 drop-shadow-lg" />;
            case 1:
                return <Medal size={28} className="text-gray-400 drop-shadow-lg" />;
            case 2:
                return <Medal size={28} className="text-amber-600 drop-shadow-lg" />;
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
        if (points >= 1000) return { label: "Legend", color: "from-purple-500 to-pink-500", icon: <Diamond size={12} /> };
        if (points >= 500) return { label: "Master", color: "from-blue-500 to-cyan-500", icon: <Zap size={12} /> };
        if (points >= 200) return { label: "Expert", color: "from-green-500 to-emerald-500", icon: <Target size={12} /> };
        return { label: "Rising Star", color: "from-orange-500 to-red-500", icon: <Sparkles size={12} /> };
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
        const topPoints = leaders[0]?.points || 0;
        const top3Points = leaders.slice(0, 3).reduce((sum, l) => sum + l.points, 0);
        
        return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    className="relative overflow-hidden bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl p-5 text-white shadow-xl"
                >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-2xl" />
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold opacity-90">Total Karigars</p>
                            <Users size={28} className="opacity-80" />
                        </div>
                        <p className="text-3xl font-black">{leaders.length}</p>
                        <p className="text-xs opacity-80 mt-1">active members</p>
                    </div>
                </motion.div>
                
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl p-5 text-white shadow-xl"
                >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-2xl" />
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold opacity-90">Total Points</p>
                            <TrendingUp size={28} className="opacity-80" />
                        </div>
                        <p className="text-3xl font-black">{totalPoints.toLocaleString()}</p>
                        <p className="text-xs opacity-80 mt-1">cumulative points</p>
                    </div>
                </motion.div>
                
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    className="relative overflow-hidden bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-5 text-white shadow-xl"
                >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-2xl" />
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold opacity-90">Average Points</p>
                            <Star size={28} className="opacity-80" />
                        </div>
                        <p className="text-3xl font-black">{avgPoints.toLocaleString()}</p>
                        <p className="text-xs opacity-80 mt-1">per karigar</p>
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-xl"
                >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-2xl" />
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold opacity-90">Top 3 Total</p>
                            <Flame size={28} className="opacity-80" />
                        </div>
                        <p className="text-3xl font-black">{top3Points.toLocaleString()}</p>
                        <p className="text-xs opacity-80 mt-1">from top performers</p>
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
                whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                onMouseEnter={() => setHoveredCard(leader._id)}
                onMouseLeave={() => setHoveredCard(null)}
                className={`p-5 flex items-center space-x-4 transition-all duration-300 ${getRankBgColor(actualRank - 1)}`}
            >
                {/* Rank with animated glow */}
                <div className="relative w-16 text-center">
                    {isTopThree ? (
                        <motion.div 
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            className="flex justify-center"
                        >
                            {getRankIcon(actualRank - 1)}
                        </motion.div>
                    ) : (
                        <div className="relative">
                            <div className={`absolute inset-0 bg-gradient-to-r ${getRankColor(actualRank - 1)} rounded-full blur-md opacity-0 group-hover:opacity-50 transition-opacity`} />
                            <span className={`relative text-xl font-black ${actualRank <= 10 ? 'bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent' : 'text-gray-500'}`}>
                                #{actualRank}
                            </span>
                        </div>
                    )}
                </div>
                
                {/* Avatar with ring effect */}
                <div className="relative">
                    <motion.div 
                        whileHover={{ scale: 1.05 }}
                        className="relative"
                    >
                        <div className={`absolute inset-0 rounded-full ${isTopThree ? `bg-gradient-to-r ${getRankColor(actualRank - 1)} blur-md` : ''}`} 
                             style={{ opacity: isHovered ? 0.5 : 0, transition: 'opacity 0.3s' }} />
                        <img 
                            src={getImageUrl(leader.photo, `https://ui-avatars.com/api/?name=${leader.name}&background=random&bold=true`)} 
                            alt={leader.name} 
                            className={`h-16 w-16 rounded-full object-cover border-3 shadow-lg transition-all duration-300 ${
                                isTopThree 
                                    ? `border-${actualRank === 1 ? 'yellow-400' : actualRank === 2 ? 'gray-300' : 'amber-600'} ring-2 ring-offset-2 ring-${actualRank === 1 ? 'yellow-400' : actualRank === 2 ? 'gray-300' : 'amber-600'}`
                                    : 'border-gray-200 hover:border-orange-300'
                            }`}
                        />
                        {isTopThree && (
                            <motion.div 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: index * 0.1 }}
                                className={`absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-r ${getRankColor(actualRank - 1)} flex items-center justify-center shadow-lg`}
                            >
                                <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                            </motion.div>
                        )}
                    </motion.div>
                </div>
                
                {/* Info with enhanced details */}
                <div className="flex-grow">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-800 text-xl">{leader.name}</p>
                        <motion.span 
                            whileHover={{ scale: 1.05 }}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r ${pointsBadge.color} text-white text-[10px] font-bold rounded-full shadow-sm`}
                        >
                            {pointsBadge.icon}
                            {pointsBadge.label}
                        </motion.span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs text-gray-500 font-mono flex items-center gap-1">
                            <Briefcase size={10} />
                            ID: {leader.karigarId}
                        </p>
                        {leader.location && (
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                <MapPin size={10} />
                                {leader.location}
                            </p>
                        )}
                    </div>
                    {leader.achievements && leader.achievements.length > 0 && (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                            {leader.achievements.slice(0, 3).map((achievement, i) => (
                                <motion.span 
                                    key={i}
                                    initial={{ scale: 0.9 }}
                                    animate={{ scale: 1 }}
                                    whileHover={{ scale: 1.05 }}
                                    className="text-xs bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 px-2 py-1 rounded-full font-medium shadow-sm"
                                >
                                    🏆 {achievement}
                                </motion.span>
                            ))}
                            {leader.achievements.length > 3 && (
                                <span className="text-xs text-gray-400">+{leader.achievements.length - 3} more</span>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Points with animation */}
                <div className="text-right">
                    <motion.div 
                        whileHover={{ scale: 1.05 }}
                        className="flex items-center gap-2"
                    >
                        <p className={`text-3xl font-black ${getPointsColor(leader.points)}`}>
                            {leader.points.toLocaleString()}
                        </p>
                        <motion.div
                            animate={isTopThree ? { rotate: [0, 10, -10, 0] } : {}}
                            transition={{ duration: 1, repeat: isTopThree ? Infinity : 0, repeatDelay: 3 }}
                        >
                            <Trophy size={24} className={isTopThree ? "text-yellow-500" : "text-gray-300"} />
                        </motion.div>
                    </motion.div>
                    <p className="text-xs text-gray-400 mt-1">Total Points</p>
                    {leader.pointsChange && (
                        <p className="text-xs text-green-500 mt-0.5 flex items-center gap-1 justify-end">
                            <TrendingUp size={10} />
                            +{leader.pointsChange} this month
                        </p>
                    )}
                </div>
            </motion.li>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center"
                >
                    <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"
                    />
                    <p className="text-gray-600 font-semibold">Loading leaderboard...</p>
                    <p className="text-sm text-gray-400 mt-1">Fetching top performers</p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header with decorative elements */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative mb-8"
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-r from-orange-200 to-red-200 rounded-full blur-3xl opacity-30" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-r from-yellow-200 to-orange-200 rounded-full blur-3xl opacity-30" />
                    
                    <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                                    <Trophy size={24} className="text-white" />
                                </div>
                                <h1 className="text-5xl font-black bg-gradient-to-r from-orange-600 via-red-600 to-purple-600 bg-clip-text text-transparent">
                                    Top Karigars
                                </h1>
                            </div>
                            <p className="text-gray-600 text-lg mt-1">Celebrating excellence in craftsmanship</p>
                        </div>
                        
                        <div className="flex gap-3">
                            <motion.button
                                whileHover={{ scale: 1.05, rotate: 180 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleRefresh}
                                className="p-3 bg-white hover:bg-gray-100 rounded-xl transition-all duration-200 shadow-md border border-gray-200"
                                title="Refresh leaderboard"
                            >
                                <RefreshCw size={20} className="text-gray-600" />
                            </motion.button>
                        </div>
                    </div>
                </motion.div>
                
                {/* Stats Cards */}
                {getStatCard()}
                
                {/* Enhanced Filters */}
                <div className="flex flex-wrap gap-4 mb-8">
                    <div className="flex gap-2">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSortBy('points')}
                            className={`px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 ${
                                sortBy === 'points' 
                                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg' 
                                    : 'bg-white text-gray-600 hover:bg-gray-100 border-2 border-gray-200'
                            }`}
                        >
                            <Trophy size={16} />
                            Rank by Points
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSortBy('name')}
                            className={`px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 ${
                                sortBy === 'name' 
                                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg' 
                                    : 'bg-white text-gray-600 hover:bg-gray-100 border-2 border-gray-200'
                            }`}
                        >
                            <Users size={16} />
                            Sort by Name
                        </motion.button>
                    </div>
                    
                    <div className="flex gap-2">
                        {[
                            { key: 'all', label: 'All', icon: <Users size={14} /> },
                            { key: 'top10', label: 'Top 10', icon: <Crown size={14} /> },
                            { key: 'top25', label: 'Top 25', icon: <Medal size={14} /> },
                        ].map((option) => (
                            <motion.button
                                key={option.key}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setFilterBy(option.key)}
                                className={`px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 ${
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
                
                {/* Leaderboard List with enhanced styling */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100"
                >
                    {sortedAndFilteredLeaders.length === 0 ? (
                        <div className="text-center py-20">
                            <motion.div
                                animate={{ y: [0, -10, 0] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                <Trophy size={64} className="text-gray-300 mx-auto mb-4" />
                            </motion.div>
                            <p className="text-gray-500 text-xl font-semibold">No karigars found</p>
                            <p className="text-gray-400 mt-2">Check back later for updates</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            <AnimatePresence>
                                {sortedAndFilteredLeaders.map((leader, index) => getLeaderCard(leader, index))}
                            </AnimatePresence>
                        </ul>
                    )}
                </motion.div>
                
                {/* Enhanced Footer */}
                {leaders.length > 25 && filterBy !== 'all' && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-8 text-center"
                    >
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setFilterBy('all')}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                        >
                            <Users size={18} />
                            View all {leaders.length} karigars
                            <ChevronRight size={18} />
                        </motion.button>
                    </motion.div>
                )}

                {/* Motivational banner */}
                {leaders.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-10 p-6 bg-gradient-to-r from-orange-50 to-red-50 rounded-2xl border border-orange-200 text-center"
                    >
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <Sparkles size={20} className="text-orange-500" />
                            <p className="text-sm font-semibold text-gray-700">Keep Up the Great Work!</p>
                            <Sparkles size={20} className="text-orange-500" />
                        </div>
                        <p className="text-xs text-gray-600">
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