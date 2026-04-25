// src/components/admin/AllClients.jsx
// PREMIUM VERSION - Modern client card design with gradients, animations, and enhanced UX

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Trash2, Search, User, Mail, Phone, MapPin, Calendar, Briefcase, Star, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { getImageUrl } from '../../constants/config';

const AllClients = ({ rows, searchTerm, onSearchChange, onViewDetails, onDelete }) => {
    const [hoveredCard, setHoveredCard] = useState(null);
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [showFilters, setShowFilters] = useState(false);
    const [filterCity, setFilterCity] = useState('');

    // Get unique cities from clients
    const cities = [...new Set(rows.map(client => client.address?.city || client.city).filter(Boolean))];

    // Sort clients based on current sort settings
    const sortedClients = [...rows].sort((a, b) => {
        let aVal, bVal;
        if (sortBy === 'name') {
            aVal = a.name || '';
            bVal = b.name || '';
        } else if (sortBy === 'jobsPosted') {
            aVal = a.jobsPosted || 0;
            bVal = b.jobsPosted || 0;
        } else if (sortBy === 'dateJoined') {
            aVal = new Date(a.createdAt || 0);
            bVal = new Date(b.createdAt || 0);
        } else {
            aVal = a.name || '';
            bVal = b.name || '';
        }
        
        if (typeof aVal === 'string') {
            return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // Filter clients by city
    const filteredClients = filterCity ? sortedClients.filter(client => 
        (client.address?.city || client.city) === filterCity
    ) : sortedClients;

    const toggleSort = (key) => {
        if (sortBy === key) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(key);
            setSortOrder('asc');
        }
    };

    const clearFilters = () => {
        setFilterCity('');
        onSearchChange('');
        setShowFilters(false);
    };

    const getRandomGradient = (index) => {
        const gradients = [
            'from-orange-500 to-amber-500',
            'from-blue-500 to-cyan-500',
            'from-emerald-500 to-teal-500',
            'from-purple-500 to-pink-500',
            'from-rose-500 to-red-500',
            'from-indigo-500 to-blue-500'
        ];
        return gradients[index % gradients.length];
    };

    const formatDate = (date) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    return (
        <div className="space-y-5">
            {/* Search and Filter Bar */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
                <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
                    <div className="relative flex-1">
                        <Search size="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, mobile, or email..."
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm transition-all"
                        />
                    </div>
                    
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                                showFilters || filterCity ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-orange-50'
                            }`}
                        >
                            <Filter size="14" /> Filters
                            {filterCity && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </button>
                        
                        {(searchTerm || filterCity) && (
                            <button
                                onClick={clearFilters}
                                className="px-4 py-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium text-sm transition-colors flex items-center gap-1"
                            >
                                <X size="14" /> Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* Filters Panel */}
                <AnimatePresence>
                    {showFilters && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 pt-4 border-t border-gray-100"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Sort By</label>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { key: 'name', label: 'Name' },
                                            { key: 'jobsPosted', label: 'Jobs Posted' },
                                            { key: 'dateJoined', label: 'Date Joined' },
                                        ].map(option => (
                                            <button
                                                key={option.key}
                                                onClick={() => toggleSort(option.key)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                                                    sortBy === option.key
                                                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-orange-50'
                                                }`}
                                            >
                                                {option.label}
                                                {sortBy === option.key && (sortOrder === 'asc' ? '↑' : '↓')}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Filter by City</label>
                                    <select
                                        value={filterCity}
                                        onChange={(e) => setFilterCity(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none"
                                    >
                                        <option value="">All Cities</option>
                                        {cities.map(city => (
                                            <option key={city} value={city}>{city}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Active Filters Display */}
                {(searchTerm || filterCity) && (
                    <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-gray-100">
                        <span className="text-[9px] text-gray-500 font-semibold uppercase">Active filters:</span>
                        {searchTerm && (
                            <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-600 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                Search: {searchTerm}
                                <button onClick={() => onSearchChange('')} className="hover:text-orange-800">✕</button>
                            </span>
                        )}
                        {filterCity && (
                            <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-600 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                City: {filterCity}
                                <button onClick={() => setFilterCity('')} className="hover:text-orange-800">✕</button>
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Results Count */}
            {filteredClients.length > 0 && (
                <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 font-medium">
                        Showing <span className="font-bold text-orange-600">{filteredClients.length}</span> client{filteredClients.length !== 1 ? 's' : ''}
                    </p>
                </div>
            )}

            {/* Client Cards Grid */}
            {filteredClients.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredClients.map((user, idx) => {
                        const gradient = getRandomGradient(idx);
                        const isHovered = hoveredCard === user._id;
                        const initials = user.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'C';
                        
                        return (
                            <motion.div
                                key={user._id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                whileHover={{ y: -4 }}
                                onMouseEnter={() => setHoveredCard(user._id)}
                                onMouseLeave={() => setHoveredCard(null)}
                                className="bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group"
                            >
                                {/* Gradient Header Bar */}
                                <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />
                                
                                {/* Card Content */}
                                <div className="p-5">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <img
                                                    src={getImageUrl(user.photo)}
                                                    alt={user.name}
                                                    className="w-12 h-12 rounded-xl object-cover border-2 border-orange-200 shadow-sm"
                                                    onError={(e) => { e.target.src = `/default-avatar.png`; }}
                                                />
                                                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-800 text-base truncate max-w-[150px]">{user.name || 'Client'}</h3>
                                                <p className="text-xs text-gray-500 font-mono">{user.karigarId || user.userId || 'N/A'}</p>
                                            </div>
                                        </div>
                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 capitalize">
                                            Client
                                        </span>
                                    </div>

                                    {/* Contact Information */}
                                    <div className="space-y-2 mb-4">
                                        {user.mobile && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <Phone size="14" className="text-gray-400 flex-shrink-0" />
                                                <span className="text-gray-700 font-medium">{user.mobile}</span>
                                            </div>
                                        )}
                                        {user.email && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <Mail size="14" className="text-gray-400 flex-shrink-0" />
                                                <span className="text-gray-600 truncate">{user.email}</span>
                                            </div>
                                        )}
                                        {(user.address?.city || user.city) && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <MapPin size="14" className="text-gray-400 flex-shrink-0" />
                                                <span className="text-gray-600">{user.address?.city || user.city}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                        <div className="bg-orange-50 rounded-lg p-2 text-center">
                                            <p className="text-xs font-semibold text-orange-600">Jobs Posted</p>
                                            <p className="text-xl font-bold text-orange-700">{user.jobsPosted || 0}</p>
                                        </div>
                                        <div className="bg-emerald-50 rounded-lg p-2 text-center">
                                            <p className="text-xs font-semibold text-emerald-600">Jobs Completed</p>
                                            <p className="text-xl font-bold text-emerald-700">{user.jobsCompleted || 0}</p>
                                        </div>
                                    </div>

                                    {/* Member Since */}
                                    {user.createdAt && (
                                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mb-3">
                                            <Calendar size="10" />
                                            <span>Member since {formatDate(user.createdAt)}</span>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                                        <button
                                            onClick={() => onViewDetails(user)}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-semibold hover:shadow-md transition-all"
                                        >
                                            <Eye size="14" /> View Details
                                        </button>
                                        <button
                                            onClick={() => onDelete(user._id, user.name, user.role || 'client')}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-all"
                                        >
                                            <Trash2 size="14" /> Delete
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            ) : (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center"
                >
                    <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <User size="36" className="text-gray-400" />
                    </div>
                    <h3 className="font-bold text-gray-700 text-lg mb-2">No Clients Found</h3>
                    <p className="text-gray-400 text-sm max-w-sm mx-auto">
                        {searchTerm || filterCity ? 'Try adjusting your search or filters.' : 'No clients have registered yet.'}
                    </p>
                    {(searchTerm || filterCity) && (
                        <button
                            onClick={clearFilters}
                            className="mt-5 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl text-sm font-semibold hover:shadow-md transition-all"
                        >
                            Clear Filters
                        </button>
                    )}
                </motion.div>
            )}
        </div>
    );
};

export default AllClients;