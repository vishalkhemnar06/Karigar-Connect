import { getImageUrl } from '../../constants/config';
import React, { useState, useEffect, useMemo } from 'react';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { 
    Trophy, Medal, Crown, Star, TrendingUp, Award, ChevronRight, 
    RefreshCw, Users, BarChart3, Sparkles, Target, Zap, 
    Gift, Flame, Diamond, Shield, MapPin, Briefcase, 
    UserCircle, Verified, Clock, Calendar, CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Leaderboard = () => {
    const [leaders, setLeaders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState('points');
    const [filterBy, setFilterBy] = useState('all');
    const [hoveredCard, setHoveredCard] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

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

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchLeaders();
        setRefreshing(false);
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
        if (index === 0) return "bg-gradient-to-r from-yellow-50 via-orange-50 to-amber-50 border-l-4 border-yellow-400";
        if (index === 1) return "bg-gradient-to-r from-gray-50 to-gray-100 border-l-4 border-gray-300";
        if (index === 2) return "bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500";
        return "bg-white hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 border-l-4 border-transparent hover:border-orange-300 transition-all duration-300";
    };

    const getPointsColor = (points) => {
        if (points >= 1000) return "text-purple-600";
        if (points >= 500) return "text-blue-600";
        if (points >= 200) return "text-emerald-600";
        return "text-orange-600";
    };

    const getPointsBadge = (points) => {
        if (points >= 1000) return { label: "Legend", color: "from-purple-500 to-pink-500", icon: <Diamond size={12} /> };
        if (points >= 500) return { label: "Master", color: "from-blue-500 to-cyan-500", icon: <Zap size={12} /> };
        if (points >= 200) return { label: "Expert", color: "from-emerald-500 to-green-500", icon: <Target size={12} /> };
        return { label: "Rising Star", color: "from-orange-500 to-amber-500", icon: <Sparkles size={12} /> };
    };

    const sortedAndFilteredLeaders = useMemo(() => {
        let filtered = [...leaders];
        
        if (filterBy === 'top10') {
            filtered = filtered.slice(0, 10);
        } else if (filterBy === 'top25') {
            filtered = filtered.slice(0, 25);
        }
        
        if (sortBy === 'name') {
            filtered.sort((a, b) => a.name.localeCompare(b.name));
        } else {
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    whileHover={{ y: -2 }}
                    className="relative overflow-hidden bg-gradient-to-br from-orange-500 to-red-600 rounded-xl p-5 text-white shadow-lg hover:shadow-xl transition-all"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold opacity-90">Total Karigars</p>
                            <Users size={24} className="opacity-80" />
                        </div>
                        <p className="text-3xl font-black">{leaders.length}</p>
                        <p className="text-xs opacity-80 mt-1">active members</p>
                    </div>
                </motion.div>
                
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    whileHover={{ y: -2 }}
                    className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl p-5 text-white shadow-lg hover:shadow-xl transition-all"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold opacity-90">Total Points</p>
                            <TrendingUp size={24} className="opacity-80" />
                        </div>
                        <p className="text-3xl font-black">{totalPoints.toLocaleString()}</p>
                        <p className="text-xs opacity-80 mt-1">cumulative points</p>
                    </div>
                </motion.div>
                
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    whileHover={{ y: -2 }}
                    className="relative overflow-hidden bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-5 text-white shadow-lg hover:shadow-xl transition-all"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold opacity-90">Average Points</p>
                            <Star size={24} className="opacity-80" />
                        </div>
                        <p className="text-3xl font-black">{avgPoints.toLocaleString()}</p>
                        <p className="text-xs opacity-80 mt-1">per karigar</p>
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    whileHover={{ y: -2 }}
                    className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-5 text-white shadow-lg hover:shadow-xl transition-all"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold opacity-90">Top 3 Total</p>
                            <Flame size={24} className="opacity-80" />
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
                transition={{ delay: index * 0.03 }}
                whileHover={{ x: 4 }}
                onMouseEnter={() => setHoveredCard(leader._id)}
                onMouseLeave={() => setHoveredCard(null)}
                className={`p-5 flex items-center gap-4 transition-all duration-300 ${getRankBgColor(actualRank - 1)}`}
            >
                {/* Rank */}
                <div className="w-16 text-center flex-shrink-0">
                    {isTopThree ? (
                        <motion.div 
                            whileHover={{ scale: 1.1 }}
                            className="flex justify-center"
                        >
                            {getRankIcon(actualRank - 1)}
                        </motion.div>
                    ) : (
                        <div className="relative">
                            <span className={`relative text-xl font-black ${actualRank <= 10 ? 'bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent' : 'text-gray-500'}`}>
                                #{actualRank}
                            </span>
                        </div>
                    )}
                </div>
                
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                    <motion.div 
                        whileHover={{ scale: 1.05 }}
                        className="relative"
                    >
                        <div className={`absolute inset-0 rounded-full ${isTopThree ? `bg-gradient-to-r ${getRankColor(actualRank - 1)} blur-md` : ''}`} 
                             style={{ opacity: isHovered ? 0.5 : 0, transition: 'opacity 0.3s' }} />
                        <img 
                            src={getImageUrl(leader.photo, `https://ui-avatars.com/api/?name=${encodeURIComponent(leader.name)}&background=f97316&color=fff&bold=true`)} 
                            alt={leader.name} 
                            className={`h-16 w-16 rounded-full object-cover border-3 shadow-lg transition-all duration-300 ${
                                isTopThree 
                                    ? `border-${actualRank === 1 ? 'yellow-400' : actualRank === 2 ? 'gray-300' : 'amber-500'} ring-2 ring-offset-2 ring-${actualRank === 1 ? 'yellow-400' : actualRank === 2 ? 'gray-300' : 'amber-500'}`
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
                
                {/* Info */}
                <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-800 text-lg truncate max-w-[150px]">{leader.name}</p>
                        {leader.verificationStatus === 'approved' && (
                            <Verified size={16} className="text-emerald-500 flex-shrink-0" />
                        )}
                        <motion.span 
                            whileHover={{ scale: 1.05 }}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r ${pointsBadge.color} text-white text-[10px] font-bold rounded-full shadow-sm flex-shrink-0`}
                        >
                            {pointsBadge.icon}
                            {pointsBadge.label}
                        </motion.span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                        <p className="text-xs text-gray-500 font-mono flex items-center gap-1">
                            <Briefcase size={12} />
                            ID: {leader.karigarId}
                        </p>
                        {leader.location && (
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                <MapPin size={12} />
                                {leader.location}
                            </p>
                        )}
                    </div>
                    {leader.achievements && leader.achievements.length > 0 && (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                            {leader.achievements.slice(0, 2).map((achievement, i) => (
                                <motion.span 
                                    key={i}
                                    initial={{ scale: 0.9 }}
                                    animate={{ scale: 1 }}
                                    whileHover={{ scale: 1.05 }}
                                    className="text-xs bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-medium shadow-sm"
                                >
                                    🏆 {achievement.length > 15 ? achievement.slice(0, 12) + '...' : achievement}
                                </motion.span>
                            ))}
                            {leader.achievements.length > 2 && (
                                <span className="text-xs text-gray-400">+{leader.achievements.length - 2}</span>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Points */}
                <div className="text-right flex-shrink-0">
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
                        <p className="text-xs text-emerald-500 mt-0.5 flex items-center gap-0.5 justify-end">
                            <TrendingUp size={10} />
                            +{leader.pointsChange}
                        </p>
                    )}
                </div>
            </motion.li>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 size="48" className="animate-spin text-orange-500 mx-auto mb-4" />
                    <p className="text-gray-600 font-semibold">Loading leaderboard...</p>
                    <p className="text-xs text-gray-400 mt-1">Fetching top performers</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 pb-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
                
                {/* Hero Header */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    data-guide-id="worker-page-leaderboard"
                    className="mb-8"
                >
                    <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-xl">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                    <Trophy size="24" className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black">Top Karigars</h1>
                                    <p className="text-white/90 text-sm mt-0.5">Celebrating excellence in craftsmanship</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleRefresh}
                                    disabled={refreshing}
                                    className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-xl text-sm font-semibold hover:bg-white/30 transition-all"
                                >
                                    <RefreshCw size="14" className={refreshing ? 'animate-spin' : ''} />
                                    Refresh
                                </motion.button>
                            </div>
                        </div>
                    </div>
                </motion.div>
                
                {/* Stats Cards */}
                {getStatCard()}
                
                {/* Filters */}
                <div className="mb-8">
                    <div className="flex flex-wrap gap-3">
                        <div className="flex gap-2">
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setSortBy('points')}
                                className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 text-sm ${
                                    sortBy === 'points' 
                                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md' 
                                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                }`}
                            >
                                <Trophy size="14" />
                                Rank by Points
                            </motion.button>
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setSortBy('name')}
                                className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 text-sm ${
                                    sortBy === 'name' 
                                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md' 
                                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                }`}
                            >
                                <Users size="14" />
                                Sort by Name
                            </motion.button>
                        </div>
                        
                        <div className="flex gap-2">
                            {[
                                { key: 'all', label: 'All Karigars', icon: <Users size="14" /> },
                                { key: 'top10', label: 'Top 10', icon: <Crown size="14" /> },
                                { key: 'top25', label: 'Top 25', icon: <Medal size="14" /> },
                            ].map((option) => (
                                <motion.button
                                    key={option.key}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setFilterBy(option.key)}
                                    className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 text-sm ${
                                        filterBy === option.key 
                                            ? 'bg-gray-800 text-white shadow-md' 
                                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                    }`}
                                >
                                    {option.icon}
                                    {option.label}
                                </motion.button>
                            ))}
                        </div>
                    </div>
                </div>
                
                {/* Leaderboard List */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-xl shadow-xl overflow-hidden border border-gray-100"
                >
                    {sortedAndFilteredLeaders.length === 0 ? (
                        <div className="text-center py-20">
                            <motion.div
                                animate={{ y: [0, -8, 0] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                <Trophy size="64" className="text-gray-300 mx-auto mb-4" />
                            </motion.div>
                            <p className="text-gray-500 text-lg font-semibold">No karigars found</p>
                            <p className="text-gray-400 text-sm mt-1">Check back later for updates</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            <AnimatePresence>
                                {sortedAndFilteredLeaders.map((leader, index) => getLeaderCard(leader, index))}
                            </AnimatePresence>
                        </ul>
                    )}
                </motion.div>
                
                {/* View All Button */}
                {leaders.length > 25 && filterBy !== 'all' && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-8 text-center"
                    >
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setFilterBy('all')}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg transition-all"
                        >
                            <Users size="16" />
                            View all {leaders.length} karigars
                            <ChevronRight size="16" />
                        </motion.button>
                    </motion.div>
                )}

                {/* Motivational Banner */}
                {leaders.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-10 p-5 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200 text-center"
                    >
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <Sparkles size="16" className="text-orange-500" />
                            <p className="text-sm font-bold text-gray-700">Keep Up the Great Work!</p>
                            <Sparkles size="16" className="text-orange-500" />
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

// Helper component for Loader
const Loader2 = ({ size, className }) => (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);

export default Leaderboard;