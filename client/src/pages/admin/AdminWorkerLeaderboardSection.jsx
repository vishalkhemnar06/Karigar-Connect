import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as api from '../../api';
import { getImageUrl } from '../../constants/config';
import { 
    RefreshCw, Search, Trophy, MapPin, Phone, Briefcase, 
    Star, Award, TrendingUp, Crown, Medal, Diamond, 
    Sparkles, Zap, Gift, Heart, ThumbsUp, Users, 
    Filter, ChevronDown, ChevronUp, Eye, Download,
    Calendar, Clock, CheckCircle, XCircle, AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const PAGE_SIZE = 100;

const formatPercent = (value) => `${Number(value || 0).toFixed(0)}%`;

const getSkillNames = (skills = []) => (Array.isArray(skills) ? skills : [])
    .map((skill) => (typeof skill === 'string' ? skill : skill?.name))
    .filter(Boolean);

const StatCard = ({ label, value, icon: Icon, accent = 'gray', delay = 0 }) => {
    const tones = {
        orange: 'from-orange-50 to-amber-50 text-orange-700 border-orange-200',
        amber: 'from-amber-50 to-yellow-50 text-amber-700 border-amber-200',
        emerald: 'from-emerald-50 to-green-50 text-emerald-700 border-emerald-200',
        purple: 'from-purple-50 to-pink-50 text-purple-700 border-purple-200',
        blue: 'from-blue-50 to-cyan-50 text-blue-700 border-blue-200',
        slate: 'from-slate-50 to-gray-100 text-slate-700 border-slate-200',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className={`rounded-2xl bg-gradient-to-br ${tones[accent] || tones.slate} border p-4 shadow-sm hover:shadow-md transition-all`}
        >
            <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-80">{label}</p>
                {Icon && <Icon size="14" className="opacity-60" />}
            </div>
            <p className="text-2xl font-black mt-1">{value}</p>
        </motion.div>
    );
};

const WorkerRow = ({ worker, rank }) => {
    const photo = getImageUrl(worker?.photo);
    const skills = getSkillNames(worker?.skills);
    const rating = Number(worker?.avgStars || 0);
    const rankIcon = rank === 1 ? <Crown size="16" className="text-yellow-500" /> :
                     rank === 2 ? <Medal size="16" className="text-gray-400" /> :
                     rank === 3 ? <Medal size="16" className="text-amber-600" /> : null;

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ y: -2 }}
            className="rounded-2xl border border-orange-100 bg-white shadow-md hover:shadow-xl transition-all overflow-hidden group"
        >
            <div className={`h-1.5 ${
                rank === 1 ? 'bg-gradient-to-r from-yellow-500 to-amber-500' :
                rank === 2 ? 'bg-gradient-to-r from-gray-400 to-gray-500' :
                rank === 3 ? 'bg-gradient-to-r from-amber-600 to-orange-600' :
                'bg-gradient-to-r from-orange-400 to-amber-400'
            }`} />

            <div className="p-5">
                <div className="flex flex-col lg:flex-row gap-5">
                    {/* Left Section - Avatar & Basic Info */}
                    <div className="flex items-center gap-4 lg:w-1/3">
                        <div className="relative">
                            <img
                                src={photo}
                                alt={worker?.name || 'Worker'}
                                className="w-16 h-16 rounded-2xl object-cover border-2 border-orange-200 shadow-md"
                                onError={(event) => { event.currentTarget.src = '/default-avatar.png'; }}
                            />
                            <div className="absolute -bottom-1 -right-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-black px-2.5 py-0.5 shadow-md flex items-center gap-0.5">
                                {rankIcon}
                                <span>#{rank || '-'}</span>
                            </div>
                            {worker?.verificationStatus === 'approved' && (
                                <div className="absolute -top-1 -left-1">
                                    <CheckCircle size="14" className="text-emerald-500 fill-white" />
                                </div>
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-lg font-bold text-gray-800 truncate">{worker?.name || 'Unnamed worker'}</h3>
                                <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Worker</span>
                            </div>
                            <p className="text-xs text-gray-500 font-mono mt-0.5">{worker?.karigarId || 'N/A'}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {(skills.length ? skills.slice(0, 3) : ['No skills recorded']).map((skill) => (
                                    <span key={skill} className="rounded-full bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 text-[10px] font-bold px-2.5 py-1 border border-orange-100">
                                        {skill}
                                    </span>
                                ))}
                                {skills.length > 3 && (
                                    <span className="text-[10px] text-gray-400">+{skills.length - 3}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Middle Section - Contact & Location */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 p-2 rounded-lg">
                                <Phone size="14" className="text-orange-500" />
                                <span className="font-semibold">{worker?.mobile || 'N/A'}</span>
                            </div>
                            <div className="flex items-start gap-2 text-sm text-gray-700 bg-gray-50 p-2 rounded-lg">
                                <MapPin size="14" className="text-orange-500 mt-0.5" />
                                <span className="font-medium line-clamp-2 flex-1">{worker?.city || worker?.address?.city || 'Location not set'}</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 p-2 rounded-lg">
                                <Briefcase size="14" className="text-orange-500" />
                                <span className="font-semibold">{worker?.jobsDone || 0} jobs completed</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 p-2 rounded-lg">
                                <Calendar size="14" className="text-orange-500" />
                                <span className="font-semibold">Experience: {worker?.experience || 0} years</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Section - Stats Cards */}
                    <div className="lg:w-80 grid grid-cols-2 gap-3">
                        <StatCard label="Points" value={worker?.points || 0} icon={Trophy} accent="orange" />
                        <StatCard label="Rating" value={rating.toFixed(1)} icon={Star} accent="amber" />
                        <StatCard label="Discount" value={formatPercent(worker?.discountPct || 0)} icon={Gift} accent="emerald" />
                        <StatCard label="Completed" value={worker?.jobsDone || 0} icon={CheckCircle} accent="blue" />
                    </div>
                </div>

                {/* Footer Stats */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1">
                        <Award size="10" /> Rank #{rank || '-'}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1">
                        <Star size="10" /> {worker?.ratingCount || 0} ratings
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1">
                        <TrendingUp size="10" /> Discount score: {worker?.discountScore || 0}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1">
                        <Clock size="10" /> Member since: {worker?.createdAt ? new Date(worker.createdAt).toLocaleDateString('en-IN') : 'N/A'}
                    </span>
                </div>
            </div>
        </motion.div>
    );
};

const AdminWorkerLeaderboardSection = () => {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [workers, setWorkers] = useState([]);
    const [search, setSearch] = useState('');
    const [cityFilter, setCityFilter] = useState('all');
    const [skillFilter, setSkillFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [cityOptions, setCityOptions] = useState([]);
    const [skillOptions, setSkillOptions] = useState([]);
    const [error, setError] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [statsSummary, setStatsSummary] = useState({
        totalWorkers: 0,
        avgPoints: 0,
        topPoints: 0,
        avgRating: 0
    });

    const fetchLeaderboard = async (showSpinner = false, targetPage = page) => {
        try {
            setError('');
            if (showSpinner) setRefreshing(true);
            else setLoading(true);

            const response = await api.getAdminWorkerLeaderboard({
                page: targetPage,
                limit: PAGE_SIZE,
                search,
                city: cityFilter === 'all' ? '' : cityFilter,
                skill: skillFilter === 'all' ? '' : skillFilter,
            });
            setWorkers(Array.isArray(response?.data?.workers) ? response.data.workers : []);
            setTotal(Number(response?.data?.total || 0));
            setTotalPages(Math.max(1, Number(response?.data?.totalPages || 1)));
            setPage(Number(response?.data?.page || targetPage || 1));
            setCityOptions(Array.isArray(response?.data?.filters?.cities) ? response.data.filters.cities : []);
            setSkillOptions(Array.isArray(response?.data?.filters?.skills) ? response.data.filters.skills : []);
            
            // Calculate summary stats
            const workersData = response?.data?.workers || [];
            const totalPoints = workersData.reduce((sum, w) => sum + (w.points || 0), 0);
            const totalRatings = workersData.reduce((sum, w) => sum + (w.avgStars || 0), 0);
            setStatsSummary({
                totalWorkers: workersData.length,
                avgPoints: workersData.length ? Math.round(totalPoints / workersData.length) : 0,
                topPoints: Math.max(...workersData.map(w => w.points || 0), 0),
                avgRating: workersData.length ? (totalRatings / workersData.length).toFixed(1) : 0
            });
        } catch (err) {
            setError(err?.response?.data?.message || 'Unable to load worker leaderboard.');
            toast.error('Failed to load leaderboard');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchLeaderboard(false, page);
    }, [page, search, cityFilter, skillFilter]);

    useEffect(() => {
        setPage(1);
    }, [search, cityFilter, skillFilter]);

    const handleExport = () => {
        if (!workers.length) {
            toast.error('No data to export');
            return;
        }

        const exportData = workers.map(worker => ({
            Rank: worker.rank || '-',
            Name: worker.name || 'N/A',
            'Karigar ID': worker.karigarId || 'N/A',
            Mobile: worker.mobile || 'N/A',
            City: worker.city || worker.address?.city || 'N/A',
            'Skills': getSkillNames(worker.skills).join(', '),
            'Points': worker.points || 0,
            'Avg Rating': (worker.avgStars || 0).toFixed(1),
            'Jobs Done': worker.jobsDone || 0,
            'Discount %': formatPercent(worker.discountPct || 0),
            'Discount Score': worker.discountScore || 0,
            'Experience': `${worker.experience || 0} years`,
            'Status': worker.verificationStatus || 'N/A',
            'Rating Count': worker.ratingCount || 0,
            'Created At': worker.createdAt ? new Date(worker.createdAt).toLocaleDateString('en-IN') : 'N/A'
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Worker Leaderboard');
        XLSX.writeFile(wb, `worker_leaderboard_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success('Export successful');
    };

    const clearFilters = () => {
        setSearch('');
        setCityFilter('all');
        setSkillFilter('all');
        setShowFilters(false);
        toast.success('Filters cleared');
    };

    const pageNumbers = useMemo(
        () => Array.from({ length: totalPages }, (_, index) => index + 1),
        [totalPages],
    );

    const hasActiveFilters = search || cityFilter !== 'all' || skillFilter !== 'all';

    return (
        <div className="space-y-5">
            {/* Header Section */}
            <div className="bg-white rounded-2xl border border-orange-100 shadow-md p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center">
                                <Trophy size="14" className="text-white" />
                            </div>
                            <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-500">Leaderboard</p>
                        </div>
                        <h2 className="text-2xl font-black text-gray-800">Worker Leaderboard</h2>
                        <p className="text-sm text-gray-500 mt-1">Rank workers by live points, ratings, and discount eligibility</p>
                    </div>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleExport}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-100 text-green-700 font-bold hover:bg-green-200 transition-colors"
                        >
                            <Download size="16" /> Export
                        </button>
                        <button
                            type="button"
                            onClick={() => fetchLeaderboard(true, page)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold hover:shadow-md transition-colors disabled:opacity-60"
                            disabled={refreshing}
                        >
                            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Summary Stats */}
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard label="Total Workers" value={statsSummary.totalWorkers} icon={Users} accent="orange" delay={0} />
                    <StatCard label="Avg Points" value={statsSummary.avgPoints} icon={Award} accent="purple" delay={0.05} />
                    <StatCard label="Top Points" value={statsSummary.topPoints} icon={Crown} accent="amber" delay={0.1} />
                    <StatCard label="Avg Rating" value={statsSummary.avgRating} icon={Star} accent="emerald" delay={0.15} />
                </div>

                {/* Search and Filters */}
                <div className="mt-6 space-y-3">
                    <div className="flex flex-col lg:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search size="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search by name, mobile, or Karigar ID..."
                                className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowFilters(!showFilters)}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 font-semibold hover:border-orange-300 transition-all"
                        >
                            <Filter size="16" />
                            Filters
                            {showFilters ? <ChevronUp size="14" /> : <ChevronDown size="14" />}
                        </button>
                    </div>

                    <AnimatePresence>
                        {showFilters && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2"
                            >
                                <select
                                    value={cityFilter}
                                    onChange={(event) => setCityFilter(event.target.value)}
                                    className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                                >
                                    <option value="all">All Cities</option>
                                    {cityOptions.map((city) => (
                                        <option key={city} value={city}>{city}</option>
                                    ))}
                                </select>

                                <select
                                    value={skillFilter}
                                    onChange={(event) => setSkillFilter(event.target.value)}
                                    className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                                >
                                    <option value="all">All Skills</option>
                                    {skillOptions.map((skill) => (
                                        <option key={skill} value={skill}>{skill}</option>
                                    ))}
                                </select>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Active Filters Display */}
                {hasActiveFilters && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-[10px] text-gray-500 font-semibold">Active filters:</span>
                        {search && (
                            <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-semibold px-2 py-1 rounded-full">
                                Search: {search}
                                <button onClick={() => setSearch('')} className="hover:text-orange-900">✕</button>
                            </span>
                        )}
                        {cityFilter !== 'all' && (
                            <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-semibold px-2 py-1 rounded-full">
                                City: {cityFilter}
                                <button onClick={() => setCityFilter('all')} className="hover:text-orange-900">✕</button>
                            </span>
                        )}
                        {skillFilter !== 'all' && (
                            <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-semibold px-2 py-1 rounded-full">
                                Skill: {skillFilter}
                                <button onClick={() => setSkillFilter('all')} className="hover:text-orange-900">✕</button>
                            </span>
                        )}
                        <button onClick={clearFilters} className="text-[10px] text-orange-500 font-semibold hover:underline">Clear all</button>
                    </div>
                )}
            </div>

            {/* Results Count */}
            {!loading && workers.length > 0 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                        Showing <span className="font-bold text-orange-600">{workers.length}</span> of <span className="font-bold">{total}</span> workers
                    </p>
                </div>
            )}

            {/* Table Header (Desktop) */}
            <div className="hidden lg:block bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 px-5 py-3 bg-gradient-to-r from-orange-50 to-amber-50 text-[11px] font-black uppercase tracking-[0.18em] text-orange-700 border-b border-orange-200">
                    <div className="lg:col-span-4 flex items-center gap-2"><Trophy size="14" /> Worker Information</div>
                    <div className="lg:col-span-4 flex items-center gap-2"><MapPin size="14" /> Contact & Location</div>
                    <div className="lg:col-span-4 grid grid-cols-4 gap-3 text-center">
                        <div>Points</div>
                        <div>Rating</div>
                        <div>Discount</div>
                        <div>Jobs Done</div>
                    </div>
                </div>
            </div>

            {/* Worker Cards */}
            {loading ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                    <div className="animate-spin h-10 w-10 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-gray-500">Loading leaderboard...</p>
                </div>
            ) : error ? (
                <div className="bg-gradient-to-r from-red-50 to-rose-50 rounded-2xl border border-red-200 p-8 text-center">
                    <AlertCircle size="48" className="text-red-500 mx-auto mb-3" />
                    <p className="text-red-600 font-semibold">{error}</p>
                    <button onClick={() => fetchLeaderboard(true, page)} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold">Try Again</button>
                </div>
            ) : workers.length ? (
                <div className="space-y-4">
                    {workers.map((worker, idx) => (
                        <WorkerRow key={worker._id} worker={worker} rank={idx + 1 + (page - 1) * PAGE_SIZE} />
                    ))}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="bg-white rounded-2xl border border-orange-100 px-5 py-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <p className="text-sm text-gray-600">
                                    Page <span className="font-bold text-orange-600">{page}</span> of <span className="font-bold">{totalPages}</span>
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPage(1)}
                                        disabled={page <= 1}
                                        className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 disabled:opacity-50 hover:border-orange-300 transition-all"
                                    >
                                        First
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                                        disabled={page <= 1}
                                        className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 disabled:opacity-50 hover:border-orange-300 transition-all"
                                    >
                                        Prev
                                    </button>

                                    <div className="flex gap-1">
                                        {pageNumbers.slice(Math.max(0, page - 3), Math.min(totalPages, page + 2)).map((pageNumber) => (
                                            <button
                                                key={pageNumber}
                                                type="button"
                                                onClick={() => setPage(pageNumber)}
                                                className={`px-3 py-1.5 rounded-lg border text-sm font-semibold transition-all ${
                                                    page === pageNumber 
                                                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 border-orange-500 text-white shadow-sm' 
                                                        : 'bg-white border-gray-200 text-gray-700 hover:border-orange-300'
                                                }`}
                                            >
                                                {pageNumber}
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                                        disabled={page >= totalPages}
                                        className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 disabled:opacity-50 hover:border-orange-300 transition-all"
                                    >
                                        Next
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPage(totalPages)}
                                        disabled={page >= totalPages}
                                        className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 disabled:opacity-50 hover:border-orange-300 transition-all"
                                    >
                                        Last
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                    <Trophy size="48" className="text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No workers match your search criteria</p>
                    {hasActiveFilters && (
                        <button onClick={clearFilters} className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold">Clear Filters</button>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminWorkerLeaderboardSection;