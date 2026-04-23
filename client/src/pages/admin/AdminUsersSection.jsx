import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../../api';
import { getImageUrl } from '../../constants/config';
import { RefreshCw, Search, Users, Briefcase, Trophy, MessageSquare } from 'lucide-react';

const formatMoney = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

const formatAge = (days) => {
    const ageDays = Number(days || 0);
    if (!ageDays) return 'New';
    if (ageDays < 30) return `${ageDays} day${ageDays === 1 ? '' : 's'}`;
    const months = Math.floor(ageDays / 30);
    if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
    const years = Math.floor(months / 12);
    return `${years} year${years === 1 ? '' : 's'}`;
};

const readAddress = (user = {}) => {
    const address = user.address || {};
    return [
        address.fullAddress,
        address.homeLocation,
        address.locality,
        address.city,
    ].filter(Boolean).join(' • ') || 'N/A';
};

const isMatch = (value, query) => String(value || '').toLowerCase().includes(query);

const buildSkillSearchText = (skills = []) => skills
    .map((skill) => {
        if (typeof skill === 'string') return skill;
        return [skill?.name, skill?.proficiency, skill?.quoteBasis].filter(Boolean).join(' ');
    })
    .join(' ')
    .toLowerCase();

const quoteText = (skill = {}) => {
    const hour = Number(skill?.quoteRates?.hour || 0);
    const day = Number(skill?.quoteRates?.day || 0);
    const visit = Number(skill?.quoteRates?.visit || 0);
    const parts = [];
    if (hour > 0) parts.push(`Hr ${formatMoney(hour)}`);
    if (day > 0) parts.push(`Day ${formatMoney(day)}`);
    if (visit > 0) parts.push(`Visit ${formatMoney(visit)}`);
    return parts.length ? parts.join(' • ') : 'No quoted rate';
};

const UserCard = ({ user, mode, onOpenProfile }) => {
    const photo = getImageUrl(user?.photo);
    const address = readAddress(user);

    if (mode === 'clients') {
        return (
            <div className="rounded-2xl border border-orange-100 bg-white shadow-sm overflow-hidden flex flex-col">
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-4 flex items-start gap-3">
                    <img
                        src={photo}
                        alt={user?.name || 'Client'}
                        className="w-14 h-14 rounded-2xl object-cover border border-orange-100 bg-white"
                        onError={(event) => { event.currentTarget.src = '/default-avatar.png'; }}
                    />
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-500">Client</p>
                        <h3 className="text-lg font-black text-gray-900 truncate">{user?.name || 'Unnamed client'}</h3>
                        <p className="text-xs text-gray-500 truncate">{user?.mobile || 'N/A'}</p>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{address}</p>
                    </div>
                </div>

                <div className="p-4 grid grid-cols-2 gap-3 text-sm">
                    <Stat label="Jobs Posted" value={user?.jobsPosted || 0} />
                    <Stat label="Jobs Completed" value={user?.jobsCompleted || 0} />
                    <Stat label="Payments Paid" value={user?.paymentPaid || 0} />
                    <Stat label="Account Age" value={formatAge(user?.accountAgeDays)} />
                </div>

                <div className="px-4 pb-4 mt-auto">
                    <button
                        type="button"
                        onClick={() => onOpenProfile(user)}
                        className="w-full rounded-xl bg-orange-600 text-white font-bold py-2.5 hover:bg-orange-500 transition-colors"
                    >
                        View Profile
                    </button>
                </div>
            </div>
        );
    }

    const travelMethod = user?.travelMethod || 'N/A';
    const phoneType = user?.phoneType || 'N/A';

    return (
        <div className="rounded-2xl border border-orange-100 bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 flex items-start gap-3">
                <img
                    src={photo}
                    alt={user?.name || 'Worker'}
                    className="w-14 h-14 rounded-2xl object-cover border border-orange-100 bg-white"
                    onError={(event) => { event.currentTarget.src = '/default-avatar.png'; }}
                />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-500">Worker</p>
                            <h3 className="text-lg font-black text-gray-900 truncate">{user?.name || 'Unnamed worker'}</h3>
                        </div>
                        <span className="rounded-full bg-orange-100 text-orange-700 text-[11px] font-black px-2.5 py-1">
                            #{user?.leaderboardRank || '-'}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{user?.mobile || 'N/A'} • {phoneType}</p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{address}</p>
                </div>
            </div>

            <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <Stat label="Jobs Done" value={user?.jobsDone || 0} />
                    <Stat label="Earnings" value={formatMoney(user?.totalEarnings || 0)} />
                    <Stat label="Avg Rating" value={Number(user?.avgStars || 0).toFixed(1)} />
                    <Stat label="Points" value={user?.points || 0} />
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                    <Stat label="Jobs Applied" value={user?.jobsApplied || 0} />
                    <Stat label="Coupons Used" value={user?.couponsUsed || 0} />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-gray-500">
                        <Briefcase size={14} /> Skill Quotes
                    </div>
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                        {(Array.isArray(user?.skills) ? user.skills : []).length ? user.skills.map((skill, index) => (
                            <div key={`${skill?.name || 'skill'}-${index}`} className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">{skill?.name || 'Skill'}</p>
                                        <p className="text-[11px] text-gray-500">{skill?.proficiency || 'N/A'} • {skill?.quoteBasis || 'quoted'}</p>
                                    </div>
                                    <span className="text-xs font-black text-orange-700 whitespace-nowrap">{quoteText(skill)}</span>
                                </div>
                            </div>
                        )) : (
                            <p className="text-sm text-gray-500">No skills recorded.</p>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                    <Stat label="Travel Method" value={travelMethod} />
                    <Stat label="Phone Type" value={phoneType} />
                </div>
            </div>

            <div className="px-4 pb-4 mt-auto">
                <button
                    type="button"
                    onClick={() => onOpenProfile(user)}
                    className="w-full rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 text-white font-bold py-2.5 hover:shadow-md transition-shadow"
                >
                    View Public Profile
                </button>
            </div>
        </div>
    );
};

const Stat = ({ label, value }) => (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500">{label}</p>
        <p className="text-sm font-bold text-gray-900 mt-1 truncate">{value}</p>
    </div>
);

const AdminUsersSection = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('clients');
    const [search, setSearch] = useState('');
    const [clients, setClients] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [error, setError] = useState('');

    const fetchUsers = async (showSpinner = false) => {
        try {
            setError('');
            if (showSpinner) setRefreshing(true);
            else setLoading(true);

            const [workersRes, clientsRes] = await Promise.all([api.getAllWorkers(), api.getAllClients()]);
            setWorkers(Array.isArray(workersRes.data) ? workersRes.data : []);
            setClients(Array.isArray(clientsRes.data) ? clientsRes.data : []);
        } catch (err) {
            setError(err?.response?.data?.message || 'Unable to load users.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchUsers(false);
    }, []);

    const filteredClients = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return clients;
        return clients.filter((client) => {
            const address = client?.address || {};
            return [
                client?.name,
                client?.mobile,
                client?.email,
                client?.profession,
                client?.signupReason,
                address?.city,
                address?.locality,
                address?.fullAddress,
                address?.homeLocation,
                address?.village,
                address?.pincode,
                client?.workplaceInfo,
            ].some((value) => isMatch(value, query));
        });
    }, [clients, search]);

    const filteredWorkers = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return workers;
        return workers.filter((worker) => {
            const address = worker?.address || {};
            return [
                worker?.name,
                worker?.mobile,
                worker?.email,
                worker?.karigarId,
                worker?.userId,
                address?.city,
                address?.locality,
                address?.fullAddress,
                address?.homeLocation,
                address?.village,
                address?.pincode,
                buildSkillSearchText(worker?.skills),
            ].some((value) => isMatch(value, query));
        });
    }, [workers, search]);

    const activeCount = activeTab === 'clients' ? filteredClients.length : filteredWorkers.length;
    const totalCount = clients.length + workers.length;

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-500">Directory</p>
                        <h2 className="text-2xl font-black text-gray-900">Users Section</h2>
                        <p className="text-sm text-gray-500">Search clients and workers by name, number, city, or skill. Open profiles from one place.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => fetchUsers(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-500 transition-colors disabled:opacity-60"
                        disabled={refreshing}
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <SummaryCard icon={Users} label="Clients" value={clients.length} tone="orange" />
                    <SummaryCard icon={Briefcase} label="Workers" value={workers.length} tone="amber" />
                    <SummaryCard icon={Trophy} label="Loaded Records" value={totalCount} tone="gray" />
                </div>

                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="inline-flex rounded-2xl border border-gray-200 bg-gray-50 p-1 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => setActiveTab('clients')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab === 'clients' ? 'bg-orange-600 text-white' : 'text-gray-700'}`}
                        >
                            Clients
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('workers')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab === 'workers' ? 'bg-orange-600 text-white' : 'text-gray-700'}`}
                        >
                            Workers
                        </button>
                    </div>

                    <div className="relative w-full lg:max-w-lg">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search by name, number, city, or skill"
                            className="w-full rounded-2xl border border-gray-200 bg-white pl-10 pr-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50"
                        />
                    </div>
                </div>

                <div className="mt-3 text-sm text-gray-500">
                    Showing {activeCount} {activeTab} record{activeCount === 1 ? '' : 's'}
                </div>
            </div>

            {loading ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-6 text-gray-500">Loading user records...</div>
            ) : error ? (
                <div className="bg-white rounded-2xl border border-red-100 p-6 text-red-600">{error}</div>
            ) : activeTab === 'clients' ? (
                filteredClients.length ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredClients.map((client) => (
                            <UserCard
                                key={client._id}
                                user={client}
                                mode="clients"
                                onOpenProfile={(user) => navigate(`/admin/users/${user._id}`)}
                            />
                        ))}
                    </div>
                ) : (
                    <EmptyState label="clients" />
                )
            ) : filteredWorkers.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredWorkers.map((worker) => (
                        <UserCard
                            key={worker._id}
                            user={worker}
                            mode="workers"
                                onOpenProfile={(user) => navigate(`/profile/public/${user.karigarId || user.userId || user._id}`)}
                        />
                    ))}
                </div>
            ) : (
                <EmptyState label="workers" />
            )}
        </div>
    );
};

const SummaryCard = ({ icon: Icon, label, value, tone = 'gray' }) => {
    const toneClasses = {
        orange: 'from-orange-50 to-amber-50 border-orange-100 text-orange-700',
        amber: 'from-amber-50 to-yellow-50 border-amber-100 text-amber-700',
        gray: 'from-gray-50 to-slate-50 border-gray-100 text-gray-700',
    };

    return (
        <div className={`rounded-2xl border bg-gradient-to-r p-4 ${toneClasses[tone]}`}>
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">{label}</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">{value}</p>
                </div>
                <Icon size={22} />
            </div>
        </div>
    );
};

const EmptyState = ({ label }) => (
    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
        <MessageSquare size={28} className="mx-auto mb-3 text-gray-300" />
        <p className="font-semibold">No {label} matched your search.</p>
    </div>
);

export default AdminUsersSection;
