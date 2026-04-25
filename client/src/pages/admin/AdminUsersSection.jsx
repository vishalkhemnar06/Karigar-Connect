import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as api from '../../api';
import { getImageUrl } from '../../constants/config';
import { 
    RefreshCw, Search, Users, Briefcase, Trophy, MessageSquare,
    User, Star, MapPin, Phone, Mail, Calendar, Award, 
    TrendingUp, Wallet, CheckCircle, XCircle, Clock,
    Eye, ChevronRight, Filter, Download, FileText, Printer,
    Share2, Heart, ThumbsUp, Crown, Diamond, Sparkles, Zap,
    Building2, Home, Smartphone, AlertCircle, Shield
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import toast from 'react-hot-toast';

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
        address.village,
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
    if (hour > 0) parts.push(`Hour: ${formatMoney(hour)}`);
    if (day > 0) parts.push(`Day: ${formatMoney(day)}`);
    if (visit > 0) parts.push(`Visit: ${formatMoney(visit)}`);
    return parts.length ? parts.join(' • ') : 'No quoted rate';
};

const Stat = ({ label, value, icon: Icon, gradient = 'from-gray-50 to-white' }) => (
    <div className={`rounded-xl bg-gradient-to-r ${gradient} border border-gray-100 px-3 py-2.5 shadow-sm`}>
        <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">{label}</p>
            {Icon && <Icon size={14} className="text-orange-400" />}
        </div>
        <p className="text-sm font-bold text-gray-900 mt-1 truncate">{value}</p>
    </div>
);

const SummaryCard = ({ icon: Icon, label, value, tone = 'gray', delay = 0 }) => {
    const toneClasses = {
        orange: 'from-orange-500 to-amber-500 text-white',
        amber: 'from-amber-500 to-yellow-500 text-white',
        gray: 'from-gray-600 to-gray-700 text-white',
        green: 'from-emerald-500 to-green-500 text-white',
        blue: 'from-blue-500 to-cyan-500 text-white',
        purple: 'from-purple-500 to-pink-500 text-white',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className={`rounded-2xl bg-gradient-to-r p-5 shadow-md ${toneClasses[tone]}`}
        >
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{label}</p>
                    <p className="text-3xl font-black mt-1">{value}</p>
                </div>
                <div className="p-2 bg-white/20 rounded-xl">
                    <Icon size="24" />
                </div>
            </div>
        </motion.div>
    );
};

const EmptyState = ({ label }) => (
    <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm"
    >
        <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageSquare size="36" className="text-gray-400" />
        </div>
        <p className="font-bold text-gray-700 text-lg mb-1">No {label} found</p>
        <p className="text-gray-400 text-sm">Try adjusting your search or filters</p>
    </motion.div>
);

// Enhanced User Card Component
const UserCard = ({ user, mode, onOpenProfile }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const photo = getImageUrl(user?.photo);
    const address = readAddress(user);
    const rating = Number(user?.avgStars || 0);

    if (mode === 'clients') {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4 }}
                className="rounded-2xl border border-orange-100 bg-white shadow-md hover:shadow-xl transition-all overflow-hidden group"
            >
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-5">
                    <div className="flex items-start gap-4">
                        <div className="relative">
                            <img
                                src={photo}
                                alt={user?.name || 'Client'}
                                className="w-16 h-16 rounded-2xl object-cover border-2 border-orange-200 shadow-sm"
                                onError={(event) => { event.currentTarget.src = '/default-avatar.png'; }}
                            />
                            {user?.verificationStatus === 'approved' && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                                    <CheckCircle size="10" className="text-white" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-lg font-bold text-gray-800 truncate">{user?.name || 'Unnamed client'}</h3>
                                <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Client</span>
                            </div>
                            <p className="text-sm text-gray-600 font-mono mt-0.5">{user?.mobile || 'N/A'}</p>
                            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                                <MapPin size="12" className="text-orange-400" />
                                <span className="truncate">{address}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <Stat label="Jobs Posted" value={user?.jobsPosted || 0} icon={Briefcase} gradient="from-blue-50 to-cyan-50" />
                        <Stat label="Jobs Completed" value={user?.jobsCompleted || 0} icon={CheckCircle} gradient="from-emerald-50 to-green-50" />
                        <Stat label="Total Paid" value={formatMoney(user?.paymentPaid || 0)} icon={Wallet} gradient="from-purple-50 to-pink-50" />
                        <Stat label="Account Age" value={formatAge(user?.accountAgeDays)} icon={Calendar} gradient="from-orange-50 to-amber-50" />
                    </div>

                    {user?.email && (
                        <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 p-2 rounded-lg">
                            <Mail size="12" className="text-gray-400" />
                            <span className="truncate">{user.email}</span>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => onOpenProfile(user)}
                        className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold py-2.5 hover:shadow-md transition-all flex items-center justify-center gap-2 group"
                    >
                        <Eye size="16" /> View Full Profile <ChevronRight size="14" className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </motion.div>
        );
    }

    // Worker Card
    const travelMethod = user?.travelMethod || 'N/A';
    const phoneType = user?.phoneType || 'N/A';
    const skills = Array.isArray(user?.skills) ? user.skills : [];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            className="rounded-2xl border border-orange-100 bg-white shadow-md hover:shadow-xl transition-all overflow-hidden group"
        >
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-5">
                <div className="flex items-start gap-4">
                    <div className="relative">
                        <img
                            src={photo}
                            alt={user?.name || 'Worker'}
                            className="w-16 h-16 rounded-2xl object-cover border-2 border-orange-200 shadow-sm"
                            onError={(event) => { event.currentTarget.src = '/default-avatar.png'; }}
                        />
                        {user?.verificationStatus === 'approved' && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                                <CheckCircle size="10" className="text-white" />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 truncate">{user?.name || 'Unnamed worker'}</h3>
                                <p className="text-xs text-gray-600 font-mono">{user?.karigarId || user?.userId}</p>
                            </div>
                            {user?.leaderboardRank && (
                                <div className="flex flex-col items-center">
                                    <div className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                        <Crown size="8" /> #{user.leaderboardRank}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                            <Phone size="10" className="text-gray-400" />
                            <span>{user?.mobile || 'N/A'}</span>
                            <span className="mx-1">•</span>
                            <Smartphone size="10" className="text-gray-400" />
                            <span>{phoneType}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                            <MapPin size="10" className="text-orange-400" />
                            <span className="truncate">{address}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-5 space-y-4">
                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-2">
                    <Stat label="Jobs" value={user?.jobsDone || 0} icon={Briefcase} gradient="from-blue-50 to-cyan-50" />
                    <Stat label="Earnings" value={formatMoney(user?.totalEarnings || 0)} icon={Wallet} gradient="from-emerald-50 to-green-50" />
                    <Stat label="Rating" value={rating.toFixed(1)} icon={Star} gradient="from-yellow-50 to-amber-50" />
                    <Stat label="Points" value={user?.points || 0} icon={Trophy} gradient="from-purple-50 to-pink-50" />
                </div>

                {/* Skills Section - Collapsible */}
                {skills.length > 0 && (
                    <div className="space-y-2">
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="w-full flex items-center justify-between text-xs font-bold text-gray-600 uppercase tracking-wider"
                        >
                            <span className="flex items-center gap-1"><Briefcase size="12" /> Skills & Quotes</span>
                            <span>{isExpanded ? '▼' : '▶'}</span>
                        </button>
                        <AnimatePresence>
                            {isExpanded && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar"
                                >
                                    {skills.map((skill, index) => (
                                        <div key={`${skill?.name || 'skill'}-${index}`} className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <div>
                                                    <p className="text-sm font-bold text-gray-800">{skill?.name || 'Skill'}</p>
                                                    <p className="text-[10px] text-gray-500">{skill?.proficiency || 'N/A'} • {skill?.quoteBasis || 'quoted'}</p>
                                                </div>
                                                <span className="text-[10px] font-bold text-orange-700 whitespace-nowrap">{quoteText(skill)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {/* Additional Info */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-[9px] text-gray-500">Travel</p>
                        <p className="font-semibold text-gray-700">{travelMethod}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-[9px] text-gray-500">Applied</p>
                        <p className="font-semibold text-gray-700">{user?.jobsApplied || 0}</p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => onOpenProfile(user)}
                    className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold py-2.5 hover:shadow-md transition-all flex items-center justify-center gap-2 group"
                >
                    <Eye size="16" /> View Public Profile <ChevronRight size="14" className="group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </motion.div>
    );
};

// Export Modal Component
const ExportModal = ({ isOpen, onClose, onExport }) => {
    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-5">
                    <h3 className="text-white font-bold text-lg">Export Users Data</h3>
                    <p className="text-orange-100 text-sm">Choose export format</p>
                </div>
                <div className="p-6 space-y-3">
                    <button
                        onClick={() => onExport('excel')}
                        className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-orange-50 hover:border-orange-200 transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                <FileText size="18" className="text-green-600" />
                            </div>
                            <div className="text-left">
                                <p className="font-bold text-gray-800">Excel Format (.xlsx)</p>
                                <p className="text-xs text-gray-500">Compatible with Microsoft Excel</p>
                            </div>
                        </div>
                        <ChevronRight size="18" className="text-gray-400" />
                    </button>
                    <button
                        onClick={() => onExport('pdf')}
                        className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-orange-50 hover:border-orange-200 transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                                <FileText size="18" className="text-red-600" />
                            </div>
                            <div className="text-left">
                                <p className="font-bold text-gray-800">PDF Format (.pdf)</p>
                                <p className="text-xs text-gray-500">Printable document format</p>
                            </div>
                        </div>
                        <ChevronRight size="18" className="text-gray-400" />
                    </button>
                </div>
                <div className="p-4 border-t border-gray-100 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800 font-semibold">Cancel</button>
                </div>
            </motion.div>
        </motion.div>
    );
};

// Main Component
const AdminUsersSection = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('clients');
    const [search, setSearch] = useState('');
    const [clients, setClients] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [error, setError] = useState('');
    const [showExportModal, setShowExportModal] = useState(false);
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');

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
            toast.error('Failed to load users');
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
        let filtered = clients;
        if (query) {
            filtered = clients.filter((client) => {
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
        }
        // Sort
        filtered.sort((a, b) => {
            let aVal, bVal;
            if (sortBy === 'name') { aVal = a.name || ''; bVal = b.name || ''; }
            else if (sortBy === 'jobsPosted') { aVal = a.jobsPosted || 0; bVal = b.jobsPosted || 0; }
            else if (sortBy === 'jobsCompleted') { aVal = a.jobsCompleted || 0; bVal = b.jobsCompleted || 0; }
            else if (sortBy === 'paymentPaid') { aVal = a.paymentPaid || 0; bVal = b.paymentPaid || 0; }
            else { aVal = a.name || ''; bVal = b.name || ''; }
            
            if (typeof aVal === 'string') {
                return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        });
        return filtered;
    }, [clients, search, sortBy, sortOrder]);

    const filteredWorkers = useMemo(() => {
        const query = search.trim().toLowerCase();
        let filtered = workers;
        if (query) {
            filtered = workers.filter((worker) => {
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
        }
        // Sort
        filtered.sort((a, b) => {
            let aVal, bVal;
            if (sortBy === 'name') { aVal = a.name || ''; bVal = b.name || ''; }
            else if (sortBy === 'jobsDone') { aVal = a.jobsDone || 0; bVal = b.jobsDone || 0; }
            else if (sortBy === 'points') { aVal = a.points || 0; bVal = b.points || 0; }
            else if (sortBy === 'rating') { aVal = a.avgStars || 0; bVal = b.avgStars || 0; }
            else if (sortBy === 'earnings') { aVal = a.totalEarnings || 0; bVal = b.totalEarnings || 0; }
            else { aVal = a.name || ''; bVal = b.name || ''; }
            
            if (typeof aVal === 'string') {
                return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        });
        return filtered;
    }, [workers, search, sortBy, sortOrder]);

    const activeCount = activeTab === 'clients' ? filteredClients.length : filteredWorkers.length;
    const totalCount = clients.length + workers.length;

    const handleExport = async (format) => {
        const data = activeTab === 'clients' ? filteredClients : filteredWorkers;
        if (!data.length) {
            toast.error('No data to export');
            return;
        }

        if (format === 'excel') {
            const rows = data.map(item => {
                if (activeTab === 'clients') {
                    return {
                        Name: item.name || 'N/A',
                        Mobile: item.mobile || 'N/A',
                        Email: item.email || 'N/A',
                        'Jobs Posted': item.jobsPosted || 0,
                        'Jobs Completed': item.jobsCompleted || 0,
                        'Total Paid': item.paymentPaid || 0,
                        City: item.address?.city || 'N/A',
                        'Account Age': formatAge(item.accountAgeDays),
                    };
                } else {
                    return {
                        Name: item.name || 'N/A',
                        'Karigar ID': item.karigarId || item.userId || 'N/A',
                        Mobile: item.mobile || 'N/A',
                        'Jobs Done': item.jobsDone || 0,
                        Earnings: item.totalEarnings || 0,
                        Rating: Number(item.avgStars || 0).toFixed(1),
                        Points: item.points || 0,
                        City: item.address?.city || 'N/A',
                        Status: item.verificationStatus || 'pending',
                    };
                }
            });
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, activeTab === 'clients' ? 'Clients' : 'Workers');
            XLSX.writeFile(wb, `${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
            toast.success('Export successful');
        } else if (format === 'pdf') {
            const doc = new jsPDF();
            doc.text(`${activeTab === 'clients' ? 'Clients' : 'Workers'} Report`, 14, 22);
            const headers = activeTab === 'clients' 
                ? [['Name', 'Mobile', 'Email', 'Jobs Posted', 'Jobs Completed', 'Total Paid', 'City']]
                : [['Name', 'Karigar ID', 'Mobile', 'Jobs Done', 'Earnings', 'Rating', 'Points', 'City']];
            const body = data.map(item => {
                if (activeTab === 'clients') {
                    return [
                        item.name || 'N/A',
                        item.mobile || 'N/A',
                        item.email || 'N/A',
                        String(item.jobsPosted || 0),
                        String(item.jobsCompleted || 0),
                        formatMoney(item.paymentPaid || 0),
                        item.address?.city || 'N/A',
                    ];
                } else {
                    return [
                        item.name || 'N/A',
                        item.karigarId || item.userId || 'N/A',
                        item.mobile || 'N/A',
                        String(item.jobsDone || 0),
                        formatMoney(item.totalEarnings || 0),
                        Number(item.avgStars || 0).toFixed(1),
                        String(item.points || 0),
                        item.address?.city || 'N/A',
                    ];
                }
            });
            doc.autoTable({ startY: 30, head: headers, body: body });
            doc.save(`${activeTab}_${new Date().toISOString().split('T')[0]}.pdf`);
            toast.success('Export successful');
        }
        setShowExportModal(false);
    };

    const sortOptions = activeTab === 'clients' 
        ? [
            { value: 'name', label: 'Name' },
            { value: 'jobsPosted', label: 'Jobs Posted' },
            { value: 'jobsCompleted', label: 'Jobs Completed' },
            { value: 'paymentPaid', label: 'Payment Paid' },
        ]
        : [
            { value: 'name', label: 'Name' },
            { value: 'jobsDone', label: 'Jobs Done' },
            { value: 'points', label: 'Points' },
            { value: 'rating', label: 'Rating' },
            { value: 'earnings', label: 'Earnings' },
        ];

    const handleSortChange = (value) => {
        if (sortBy === value) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(value);
            setSortOrder('asc');
        }
    };

    return (
        <div className="space-y-5">
            {/* Header Section */}
            <div className="bg-white rounded-2xl border border-orange-100 shadow-md p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center">
                                <Users size="14" className="text-white" />
                            </div>
                            <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-500">Directory</p>
                        </div>
                        <h2 className="text-2xl font-black text-gray-800">User Management</h2>
                        <p className="text-sm text-gray-500 mt-1">Search, filter, and manage all platform users</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => setShowExportModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-orange-200 text-orange-600 font-bold hover:bg-orange-50 transition-colors"
                            disabled={refreshing || loading}
                        >
                            <Download size="16" /> Export
                        </button>
                        <button
                            type="button"
                            onClick={() => fetchUsers(true)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold hover:shadow-md transition-all disabled:opacity-60"
                            disabled={refreshing}
                        >
                            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <SummaryCard icon={Users} label="Total Clients" value={clients.length} tone="orange" delay={0} />
                    <SummaryCard icon={Briefcase} label="Total Workers" value={workers.length} tone="amber" delay={0.05} />
                    <SummaryCard icon={Trophy} label="Total Records" value={totalCount} tone="purple" delay={0.1} />
                    <SummaryCard icon={Star} label="Active Users" value={workers.filter(w => w.verificationStatus === 'approved').length + clients.length} tone="green" delay={0.15} />
                </div>

                {/* Search and Filters */}
                <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => setActiveTab('clients')}
                            className={`flex-1 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'clients' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md' : 'text-gray-700 hover:bg-orange-100'}`}
                        >
                            👥 Clients
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('workers')}
                            className={`flex-1 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'workers' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md' : 'text-gray-700 hover:bg-orange-100'}`}
                        >
                            🔨 Workers
                        </button>
                    </div>

                    <div className="flex gap-3 flex-1 lg:max-w-md">
                        <div className="relative flex-1">
                            <Search size="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search by name, number, city, or skill"
                                className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                            />
                        </div>
                        
                        <div className="relative">
                            <select
                                value={sortBy}
                                onChange={(e) => handleSortChange(e.target.value)}
                                className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none"
                            >
                                {sortOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>Sort by {opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Results Count */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                        Showing <span className="font-bold text-orange-600">{activeCount}</span> {activeTab} record{activeCount === 1 ? '' : 's'}
                        {search && <span> matching "<span className="font-semibold">{search}</span>"</span>}
                    </p>
                    {search && (
                        <button onClick={() => setSearch('')} className="text-xs text-orange-500 font-semibold hover:underline">
                            Clear Search
                        </button>
                    )}
                </div>
            </div>

            {/* Content Grid */}
            {loading ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                    <div className="animate-spin h-10 w-10 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-gray-500">Loading user records...</p>
                </div>
            ) : error ? (
                <div className="bg-gradient-to-r from-red-50 to-rose-50 rounded-2xl border border-red-200 p-8 text-center">
                    <AlertCircle size="48" className="text-red-500 mx-auto mb-3" />
                    <p className="text-red-600 font-semibold">{error}</p>
                    <button onClick={() => fetchUsers()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold">Try Again</button>
                </div>
            ) : activeTab === 'clients' ? (
                filteredClients.length ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {filteredClients.map((client, idx) => (
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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

            {/* Export Modal */}
            <AnimatePresence>
                {showExportModal && (
                    <ExportModal
                        isOpen={showExportModal}
                        onClose={() => setShowExportModal(false)}
                        onExport={handleExport}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminUsersSection;