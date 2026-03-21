import { getImageUrl } from '../../constants/config';
import React, { useState, useEffect, useMemo } from 'react';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { Trophy, Medal, Crown, Star, TrendingUp, Award, ChevronRight, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Leaderboard = () => {
    const [leaders, setLeaders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState('points'); // 'points' or 'name'
    const [filterBy, setFilterBy] = useState('all'); // 'all', 'top10', 'top25'

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
                return <Crown size={24} className="text-yellow-500" />;
            case 1:
                return <Medal size={24} className="text-gray-400" />;
            case 2:
                return <Medal size={24} className="text-amber-600" />;
            default:
                return null;
        }
    };

    const getRankColor = (index) => {
        if (index === 0) return "from-yellow-400 to-yellow-500";
        if (index === 1) return "from-gray-300 to-gray-400";
        if (index === 2) return "from-amber-600 to-amber-700";
        return "from-gray-100 to-gray-200";
    };

    const getRankBgColor = (index) => {
        if (index === 0) return "bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200";
        if (index === 1) return "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200";
        if (index === 2) return "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200";
        return "bg-white hover:bg-gray-50 border-gray-100";
    };

    const getPointsColor = (points) => {
        if (points >= 1000) return "text-purple-600";
        if (points >= 500) return "text-blue-600";
        if (points >= 200) return "text-green-600";
        return "text-orange-600";
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
        
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-gradient-to-r from-orange-500 to-red-500 rounded-lg p-4 text-white"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm opacity-90">Total Karigars</p>
                            <p className="text-2xl font-bold">{leaders.length}</p>
                        </div>
                        <Award size={32} className="opacity-80" />
                    </div>
                </motion.div>
                
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg p-4 text-white"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm opacity-90">Total Points</p>
                            <p className="text-2xl font-bold">{totalPoints.toLocaleString()}</p>
                        </div>
                        <TrendingUp size={32} className="opacity-80" />
                    </div>
                </motion.div>
                
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg p-4 text-white"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm opacity-90">Average Points</p>
                            <p className="text-2xl font-bold">{avgPoints.toLocaleString()}</p>
                        </div>
                        <Star size={32} className="opacity-80" />
                    </div>
                </motion.div>
            </div>
        );
    };

    const getLeaderCard = (leader, index) => {
        const actualRank = leaders.findIndex(l => l._id === leader._id) + 1;
        const isTopThree = actualRank <= 3;
        
        return (
            <motion.li
                key={leader._id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
                className={`p-4 flex items-center space-x-4 border-b last:border-b-0 transition-all duration-300 ${getRankBgColor(actualRank - 1)}`}
            >
                {/* Rank */}
                <div className="relative w-12 text-center">
                    {isTopThree ? (
                        <div className="flex justify-center">
                            {getRankIcon(actualRank - 1)}
                        </div>
                    ) : (
                        <span className={`text-xl font-bold ${actualRank <= 10 ? 'text-orange-500' : 'text-gray-500'}`}>
                            #{actualRank}
                        </span>
                    )}
                </div>
                
                {/* Avatar */}
                <div className="relative">
                    <img 
                        src={getImageUrl(leader.photo, `https://ui-avatars.com/api/?name=${leader.name}&background=random`)} 
                        alt={leader.name} 
                        className={`h-14 w-14 rounded-full object-cover border-3 ${isTopThree ? `border-${actualRank === 1 ? 'yellow-400' : actualRank === 2 ? 'gray-300' : 'amber-600'}` : 'border-gray-200'}`}
                    />
                    {isTopThree && (
                        <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r ${getRankColor(actualRank - 1)} flex items-center justify-center`}>
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                    )}
                </div>
                
                {/* Info */}
                <div className="flex-grow">
                    <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-800 text-lg">{leader.name}</p>
                        {leader.points >= 1000 && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-600 text-xs rounded-full font-semibold">
                                Legend
                            </span>
                        )}
                        {leader.points >= 500 && leader.points < 1000 && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full font-semibold">
                                Master
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-500 font-mono">{leader.karigarId}</p>
                    {leader.achievements && leader.achievements.length > 0 && (
                        <div className="flex gap-1 mt-1">
                            {leader.achievements.slice(0, 3).map((achievement, i) => (
                                <span key={i} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                    {achievement}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                
                {/* Points */}
                <div className="text-right">
                    <div className="flex items-center gap-2">
                        <p className={`text-2xl font-bold ${getPointsColor(leader.points)}`}>
                            {leader.points.toLocaleString()}
                        </p>
                        <Trophy size={20} className={isTopThree ? "text-yellow-500" : "text-gray-300"} />
                    </div>
                    <p className="text-xs text-gray-400">Points</p>
                </div>
            </motion.li>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading leaderboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                        Top Karigars Leaderboard
                    </h1>
                    <p className="text-gray-600 mt-2">Celebrating excellence in craftsmanship</p>
                </div>
                
                <div className="flex gap-3">
                    <button
                        onClick={handleRefresh}
                        className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
                        title="Refresh leaderboard"
                    >
                        <RefreshCw size={20} className="text-gray-600" />
                    </button>
                </div>
            </div>
            
            {/* Stats Cards */}
            {getStatCard()}
            
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
                <div className="flex gap-2">
                    <button
                        onClick={() => setSortBy('points')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                            sortBy === 'points' 
                                ? 'bg-orange-500 text-white shadow-md' 
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        Rank by Points
                    </button>
                    <button
                        onClick={() => setSortBy('name')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                            sortBy === 'name' 
                                ? 'bg-orange-500 text-white shadow-md' 
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        Sort by Name
                    </button>
                </div>
                
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilterBy('all')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                            filterBy === 'all' 
                                ? 'bg-gray-800 text-white' 
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilterBy('top10')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                            filterBy === 'top10' 
                                ? 'bg-gray-800 text-white' 
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        Top 10
                    </button>
                    <button
                        onClick={() => setFilterBy('top25')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                            filterBy === 'top25' 
                                ? 'bg-gray-800 text-white' 
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        Top 25
                    </button>
                </div>
            </div>
            
            {/* Leaderboard List */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                {sortedAndFilteredLeaders.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-gray-500 text-lg">No karigars found</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        <AnimatePresence>
                            {sortedAndFilteredLeaders.map((leader, index) => getLeaderCard(leader, index))}
                        </AnimatePresence>
                    </ul>
                )}
            </div>
            
            {/* Footer */}
            {leaders.length > 25 && filterBy !== 'all' && (
                <div className="mt-6 text-center">
                    <button
                        onClick={() => setFilterBy('all')}
                        className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium"
                    >
                        View all {leaders.length} karigars
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default Leaderboard;