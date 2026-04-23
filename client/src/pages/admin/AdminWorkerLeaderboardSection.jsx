import React, { useEffect, useMemo, useState } from 'react';
import * as api from '../../api';
import { getImageUrl } from '../../constants/config';
import { RefreshCw, Search, Trophy, MapPin, Phone, Briefcase } from 'lucide-react';

const PAGE_SIZE = 100;

const formatPercent = (value) => `${Number(value || 0).toFixed(0)}%`;

const getSkillNames = (skills = []) => (Array.isArray(skills) ? skills : [])
    .map((skill) => (typeof skill === 'string' ? skill : skill?.name))
    .filter(Boolean);

const WorkerRow = ({ worker }) => {
    const photo = getImageUrl(worker?.photo);
    const skills = getSkillNames(worker?.skills);

    return (
        <div className="rounded-2xl border border-orange-100 bg-white shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 xl:grid-cols-7 gap-4 p-4 items-center">
                <div className="flex items-center gap-3 xl:col-span-2">
                    <div className="relative shrink-0">
                        <img
                            src={photo}
                            alt={worker?.name || 'Worker'}
                            className="w-14 h-14 rounded-2xl object-cover border border-orange-100 bg-white"
                            onError={(event) => { event.currentTarget.src = '/default-avatar.png'; }}
                        />
                        <span className="absolute -bottom-1 -right-1 rounded-full bg-orange-600 text-white text-[10px] font-black px-2 py-0.5 shadow">
                            #{worker?.rank || '-'}
                        </span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-500">Worker</p>
                        <h3 className="text-lg font-black text-gray-900 truncate">{worker?.name || 'Unnamed worker'}</h3>
                        <p className="text-xs text-gray-500 truncate">
                            {worker?.karigarId || 'N/A'} • {worker?.verificationStatus || 'unknown'}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {(skills.length ? skills : ['No skills recorded']).slice(0, 3).map((skill) => (
                                <span key={skill} className="rounded-full bg-orange-50 text-orange-700 text-[11px] font-bold px-2.5 py-1">
                                    {skill}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="xl:col-span-2 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-700">
                        <Phone size={14} className="text-orange-500" />
                        <span className="font-semibold">{worker?.mobile || 'N/A'}</span>
                    </div>
                    <div className="flex items-start gap-2 text-gray-700">
                        <MapPin size={14} className="text-orange-500 mt-0.5" />
                        <span className="font-medium line-clamp-2">{worker?.city || worker?.address?.city || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                        <Briefcase size={14} className="text-orange-500" />
                        <span className="font-medium">{worker?.jobsDone || 0} completed jobs</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 xl:col-span-3">
                    <StatCard label="Points" value={worker?.points || 0} accent="orange" />
                    <StatCard label="Avg Rating" value={Number(worker?.avgStars || 0).toFixed(1)} accent="amber" />
                    <StatCard label="Discount" value={formatPercent(worker?.discountPct || 0)} accent="emerald" />
                    <StatCard label="Completed" value={worker?.jobsDone || 0} accent="slate" />
                </div>
            </div>

            <div className="px-4 pb-4 pt-0 flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-gray-500">
                <span className="rounded-full bg-gray-100 px-2.5 py-1">Rank #{worker?.rank || '-'}</span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1">{worker?.ratingCount || 0} ratings</span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1">Discount score: {worker?.discountScore || 0}</span>
            </div>
        </div>
    );
};

const StatCard = ({ label, value, accent = 'gray' }) => {
    const tones = {
        orange: 'bg-orange-50 text-orange-700 border-orange-100',
        amber: 'bg-amber-50 text-amber-700 border-amber-100',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        slate: 'bg-slate-50 text-slate-700 border-slate-100',
        gray: 'bg-gray-50 text-gray-700 border-gray-100',
    };

    return (
        <div className={`rounded-2xl border p-3 ${tones[accent] || tones.gray}`}>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] opacity-80">{label}</p>
            <p className="text-xl font-black mt-1">{value}</p>
        </div>
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
        } catch (err) {
            setError(err?.response?.data?.message || 'Unable to load worker leaderboard.');
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

    const pageNumbers = useMemo(
        () => Array.from({ length: totalPages }, (_, index) => index + 1),
        [totalPages],
    );

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-500">Leaderboard</p>
                        <h2 className="text-2xl font-black text-gray-900">Worker Leaderboard</h2>
                        <p className="text-sm text-gray-500">Rank workers by live points, ratings, and discount eligibility. Search by name, mobile, or Karigar ID.</p>
                    </div>

                    <button
                        type="button"
                        onClick={() => fetchLeaderboard(true, page)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-500 transition-colors disabled:opacity-60"
                        disabled={refreshing}
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                <div className="mt-4 grid grid-cols-1 lg:grid-cols-4 gap-3">
                    <div className="relative lg:col-span-2">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search by name, mobile, or Karigar ID"
                            className="w-full rounded-2xl border border-gray-200 bg-white pl-10 pr-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50"
                        />
                    </div>

                    <select
                        value={cityFilter}
                        onChange={(event) => setCityFilter(event.target.value)}
                        className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50"
                    >
                        <option value="all">All Cities</option>
                        {cityOptions.map((city) => (
                            <option key={city} value={city}>{city}</option>
                        ))}
                    </select>

                    <select
                        value={skillFilter}
                        onChange={(event) => setSkillFilter(event.target.value)}
                        className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50"
                    >
                        <option value="all">All Skills</option>
                        {skillOptions.map((skill) => (
                            <option key={skill} value={skill}>{skill}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-6 text-gray-500">Loading worker leaderboard...</div>
            ) : error ? (
                <div className="bg-white rounded-2xl border border-red-100 p-6 text-red-600">{error}</div>
            ) : workers.length ? (
                <div className="space-y-3">
                    <div className="hidden xl:grid grid-cols-7 gap-4 px-4 py-3 rounded-2xl bg-orange-50 border border-orange-100 text-[11px] font-black uppercase tracking-[0.18em] text-orange-700">
                        <div className="col-span-2 flex items-center gap-2"><Trophy size={14} /> Worker</div>
                        <div className="col-span-2 flex items-center gap-2"><Phone size={14} /> Contact / City</div>
                        <div className="text-center">Points</div>
                        <div className="text-center">Avg Rating</div>
                        <div className="text-center">Discount</div>
                    </div>

                    {workers.map((worker) => (
                        <WorkerRow key={worker._id} worker={worker} />
                    ))}

                    <div className="border border-orange-100 rounded-2xl px-4 py-4 bg-orange-50/40">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <p className="text-sm text-gray-600">
                                Showing up to {PAGE_SIZE} workers per page. Total workers: <span className="font-bold text-gray-900">{total}</span>.
                            </p>

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                                    disabled={page <= 1}
                                    className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-700 disabled:opacity-50"
                                >
                                    Prev
                                </button>

                                {pageNumbers.map((pageNumber) => (
                                    <button
                                        key={pageNumber}
                                        type="button"
                                        onClick={() => setPage(pageNumber)}
                                        className={`px-3 py-1.5 rounded-lg border text-sm font-bold ${page === pageNumber ? 'bg-orange-600 border-orange-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}
                                    >
                                        {pageNumber}
                                    </button>
                                ))}

                                <button
                                    type="button"
                                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                                    disabled={page >= totalPages}
                                    className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-700 disabled:opacity-50"
                                >
                                    Next
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setPage(totalPages)}
                                    disabled={page >= totalPages}
                                    className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-700 disabled:opacity-50"
                                >
                                    Last
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
                    No workers matched your filters.
                </div>
            )}
        </div>
    );
};

export default AdminWorkerLeaderboardSection;