import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as api from '../../api';
import { 
    RefreshCw, Search, ArrowUpDown, MapPin, Wrench, BadgePercent, 
    Clock3, Upload, AlertCircle, TrendingUp, Database, 
    BarChart3, PieChart, DollarSign, Calendar, Download,
    Filter, ChevronDown, ChevronUp, Eye, FileText, X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const formatMoney = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;
const formatConfidence = (amount) => `${(Number(amount || 0) * 100).toFixed(0)}%`;
const formatDate = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
};

const MARKET_SORT_OPTIONS = [
    { value: 'p50', label: 'Sort by P50 (Median)', icon: TrendingUp },
    { value: 'p75', label: 'Sort by P75', icon: TrendingUp },
    { value: 'p90', label: 'Sort by P90', icon: TrendingUp },
    { value: 'dataPoints', label: 'Sort by Data Points', icon: Database },
    { value: 'confidence', label: 'Sort by Confidence', icon: BarChart3 },
    { value: 'lastUpdated', label: 'Sort by Last Updated', icon: Calendar },
];

const BASE_SORT_OPTIONS = [
    { value: 'hourRate', label: 'Sort by Hour Rate', icon: DollarSign },
    { value: 'dayRate', label: 'Sort by Day Rate', icon: DollarSign },
    { value: 'visitRate', label: 'Sort by Visit Rate', icon: DollarSign },
];

const PAGE_SIZE = 100;

const SummaryCard = ({ icon: Icon, label, value, tone = 'gray', delay = 0 }) => {
    const toneClasses = {
        orange: 'from-orange-500 to-amber-500 text-white',
        amber: 'from-amber-500 to-yellow-500 text-white',
        emerald: 'from-emerald-500 to-green-500 text-white',
        blue: 'from-blue-500 to-cyan-500 text-white',
        purple: 'from-purple-500 to-pink-500 text-white',
        gray: 'from-gray-600 to-gray-700 text-white',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className={`rounded-2xl bg-gradient-to-r ${toneClasses[tone]} p-5 shadow-md hover:shadow-lg transition-all`}
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

const AdminMarketplaceSection = () => {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [rates, setRates] = useState([]);
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState('market');
    const [sortField, setSortField] = useState('p50');
    const [sortDirection, setSortDirection] = useState('desc');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [error, setError] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [selectedCity, setSelectedCity] = useState('all');
    const [selectedSkill, setSelectedSkill] = useState('all');
    const [cityOptions, setCityOptions] = useState([]);
    const [skillOptions, setSkillOptions] = useState([]);

    // CSV upload states
    const [csvFile, setCsvFile] = useState(null);
    const [csvUploading, setCsvUploading] = useState(false);
    const [csvError, setCsvError] = useState('');
    const [csvSuccess, setCsvSuccess] = useState('');
    const [lastCsvImportTime, setLastCsvImportTime] = useState(null);
    const [nextCsvAllowedTime, setNextCsvAllowedTime] = useState(null);

    // Manual market rate update states
    const [marketUpdateLoading, setMarketUpdateLoading] = useState(false);
    const [marketUpdateError, setMarketUpdateError] = useState('');
    const [marketUpdateSuccess, setMarketUpdateSuccess] = useState('');
    const [lastMarketUpdateTime, setLastMarketUpdateTime] = useState(null);
    const [nextMarketUpdateTime, setNextMarketUpdateTime] = useState(null);
    const [clockTick, setClockTick] = useState(Date.now());

    useEffect(() => {
        const timerId = setInterval(() => setClockTick(Date.now()), 1000);
        return () => clearInterval(timerId);
    }, []);

    const fetchRates = async (showSpinner = false, targetPage = page) => {
        try {
            setError('');
            if (showSpinner) setRefreshing(true);
            else setLoading(true);
            
            const response = await api.getMarketplaceRates({
                mode: viewMode,
                page: targetPage,
                limit: PAGE_SIZE,
                search,
                sortField,
                sortDirection,
                city: selectedCity !== 'all' ? selectedCity : undefined,
                skill: selectedSkill !== 'all' ? selectedSkill : undefined,
            });
            
            setRates(Array.isArray(response?.data?.rates) ? response.data.rates : []);
            setTotal(Number(response?.data?.total || 0));
            setTotalPages(Math.max(1, Number(response?.data?.totalPages || 1)));
            setPage(Number(response?.data?.page || targetPage || 1));
            
            // Extract unique cities and skills for filters
            const cities = new Set();
            const skills = new Set();
            (response?.data?.rates || []).forEach(rate => {
                if (rate.city) cities.add(rate.city);
                if (rate.skill) skills.add(rate.skill);
            });
            setCityOptions(Array.from(cities).sort());
            setSkillOptions(Array.from(skills).sort());

            const cooldowns = response?.data?.cooldowns || {};
            if (cooldowns.base) {
                setLastCsvImportTime(cooldowns.base.lastUpdatedAt ? new Date(cooldowns.base.lastUpdatedAt) : null);
                setNextCsvAllowedTime(cooldowns.base.nextAllowedAt ? new Date(cooldowns.base.nextAllowedAt) : null);
            }
            if (cooldowns.market) {
                setLastMarketUpdateTime(cooldowns.market.lastUpdatedAt ? new Date(cooldowns.market.lastUpdatedAt) : null);
                setNextMarketUpdateTime(cooldowns.market.nextAllowedAt ? new Date(cooldowns.market.nextAllowedAt) : null);
            }
        } catch (err) {
            setError(err?.response?.data?.message || 'Unable to load marketplace rates.');
            toast.error('Failed to load rates');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchRates(false, page);
    }, [viewMode, page, search, sortField, sortDirection, selectedCity, selectedSkill]);

    useEffect(() => {
        setSortField(viewMode === 'market' ? 'p50' : 'hourRate');
        setSortDirection('desc');
        setPage(1);
        setSelectedCity('all');
        setSelectedSkill('all');
    }, [viewMode]);

    useEffect(() => {
        setPage(1);
    }, [search, selectedCity, selectedSkill]);

    const handleCsvUpload = async () => {
        if (!csvFile) {
            setCsvError('Please select a CSV file first.');
            return;
        }

        try {
            setCsvError('');
            setCsvSuccess('');
            setCsvUploading(true);

            const formData = new FormData();
            formData.append('file', csvFile);

            const response = await api.uploadBaseRatesCsv(formData);

            setLastCsvImportTime(new Date());
            setNextCsvAllowedTime(new Date(response.data?.nextAllowedAt));
            setCsvSuccess(`Successfully imported ${response.data?.recordsUpserted || 0} base rate records.`);
            setCsvFile(null);
            toast.success('CSV imported successfully');

            // Clear file input
            const fileInput = document.getElementById('csvFileInput');
            if (fileInput) fileInput.value = '';

            setTimeout(() => fetchRates(true, page), 1000);
        } catch (err) {
            const errorMsg = err?.response?.data?.message || 'Failed to upload CSV file.';
            setCsvError(errorMsg);
            toast.error(errorMsg);
        } finally {
            setCsvUploading(false);
        }
    };

    const handleManualMarketUpdate = async () => {
        try {
            setMarketUpdateError('');
            setMarketUpdateSuccess('');
            setMarketUpdateLoading(true);

            const response = await api.manuallyUpdateMarketRates();

            setLastMarketUpdateTime(new Date());
            setNextMarketUpdateTime(new Date(response.data?.nextAllowedAt));
            setMarketUpdateSuccess('Market rates updated successfully. Please refresh to see the latest data.');
            toast.success('Market rates updated successfully');

            setTimeout(() => fetchRates(true, page), 2000);
        } catch (err) {
            const errorMsg = err?.response?.data?.message || 'Failed to update market rates.';
            setMarketUpdateError(errorMsg);
            toast.error(errorMsg);

            if (err?.response?.data?.nextAllowedAt) {
                setNextMarketUpdateTime(new Date(err.response.data.nextAllowedAt));
            }
        } finally {
            setMarketUpdateLoading(false);
        }
    };

    const formatCountdownTime = (futureDate) => {
        if (!futureDate) return 'N/A';
        const future = new Date(futureDate).getTime();
        const now = clockTick;
        const diff = future - now;

        if (diff <= 0) return '00:00:00:00';

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        const pad = (value) => String(value).padStart(2, '0');

        return `${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    };

    const isCsvCooldownActive = nextCsvAllowedTime ? new Date(nextCsvAllowedTime).getTime() > clockTick : false;
    const isMarketCooldownActive = nextMarketUpdateTime ? new Date(nextMarketUpdateTime).getTime() > clockTick : false;
    const csvCooldownText = nextCsvAllowedTime ? formatCountdownTime(nextCsvAllowedTime) : '00:00:00:00';
    const marketCooldownText = nextMarketUpdateTime ? formatCountdownTime(nextMarketUpdateTime) : '00:00:00:00';

    const sortOptions = viewMode === 'market' ? MARKET_SORT_OPTIONS : BASE_SORT_OPTIONS;

    const summary = useMemo(() => {
        const cities = new Set();
        const skills = new Set();
        let latest = null;

        rates.forEach((row) => {
            const city = row?.city || row?.cityKey;
            const skill = row?.skill || row?.skillKey;
            if (city) cities.add(String(city));
            if (skill) skills.add(String(skill));
            const lastUpdated = row?.lastUpdated || row?.updatedAt || row?.calculatedAt;
            if (lastUpdated) {
                const candidate = new Date(lastUpdated);
                if (!Number.isNaN(candidate.getTime()) && (!latest || candidate > latest)) {
                    latest = candidate;
                }
            }
        });

        return {
            rows: total,
            cities: cities.size,
            skills: skills.size,
            latest: latest ? latest.toISOString() : null,
        };
    }, [rates, total]);

    // Export to CSV
    const handleExport = () => {
        if (!rates.length) {
            toast.error('No data to export');
            return;
        }

        const exportData = rates.map(row => {
            if (viewMode === 'market') {
                return {
                    City: row.city || 'N/A',
                    Skill: row.skill || 'N/A',
                    P50: formatMoney(row.p50),
                    P75: formatMoney(row.p75),
                    P90: formatMoney(row.p90),
                    'Data Points': row.dataPoints || 0,
                    Confidence: formatConfidence(row.confidence || 0),
                    'Last Updated': formatDate(row.lastUpdated || row.updatedAt),
                };
            } else {
                return {
                    City: row.city || 'N/A',
                    Skill: row.skill || 'N/A',
                    'Hour Rate': formatMoney(row.hourRate),
                    'Day Rate': formatMoney(row.dayRate),
                    'Visit Rate': formatMoney(row.visitRate),
                    Source: row.source || 'base_rate',
                };
            }
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, viewMode === 'market' ? 'Market Rates' : 'Base Rates');
        XLSX.writeFile(wb, `${viewMode}_rates_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success('Export successful');
    };

    const pageNumbers = useMemo(
        () => Array.from({ length: totalPages }, (_, index) => index + 1),
        [totalPages],
    );

    const renderRow = (row) => {
        if (viewMode === 'market') {
            return (
                <motion.div 
                    key={row._id} 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="grid grid-cols-1 md:grid-cols-7 gap-3 px-4 py-4 items-center border-b border-gray-50 hover:bg-orange-50/30 transition-colors"
                >
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 md:hidden">City</p>
                        <p className="text-sm font-bold text-gray-800">{row.city || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 md:hidden">Skill</p>
                        <p className="text-sm font-bold text-gray-800 capitalize">{row.skill || 'N/A'}</p>
                    </div>
                    <div className="md:text-right">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 md:hidden">P50</p>
                        <p className="text-sm font-bold text-orange-600">{formatMoney(row.p50)}</p>
                    </div>
                    <div className="md:text-right">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 md:hidden">P75</p>
                        <p className="text-sm font-bold text-orange-600">{formatMoney(row.p75)}</p>
                    </div>
                    <div className="md:text-right">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 md:hidden">P90</p>
                        <p className="text-sm font-bold text-orange-600">{formatMoney(row.p90)}</p>
                    </div>
                    <div className="md:text-right">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 md:hidden">Data</p>
                        <p className="text-sm font-bold text-gray-700">{row.dataPoints || 0} pts</p>
                        <p className="text-[10px] text-gray-500">Conf {formatConfidence(row.confidence || 0)}</p>
                    </div>
                    <div className="md:text-right">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                            row.source === 'live_rate' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                            {row.source || 'market_rate'}
                        </span>
                    </div>
                </motion.div>
            );
        }

        return (
            <motion.div 
                key={row._id} 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="grid grid-cols-1 md:grid-cols-6 gap-3 px-4 py-4 items-center border-b border-gray-50 hover:bg-orange-50/30 transition-colors"
            >
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 md:hidden">City</p>
                    <p className="text-sm font-bold text-gray-800">{row.city || 'N/A'}</p>
                </div>
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 md:hidden">Skill</p>
                    <p className="text-sm font-bold text-gray-800 capitalize">{row.skill || 'N/A'}</p>
                </div>
                <div className="md:text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 md:hidden">/Hour</p>
                    <p className="text-sm font-bold text-orange-600">{formatMoney(row.hourRate)}</p>
                </div>
                <div className="md:text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 md:hidden">/Day</p>
                    <p className="text-sm font-bold text-orange-600">{formatMoney(row.dayRate)}</p>
                </div>
                <div className="md:text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 md:hidden">/Visit</p>
                    <p className="text-sm font-bold text-orange-600">{formatMoney(row.visitRate)}</p>
                </div>
                <div className="md:text-right">
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                        {row.source || 'base_rate'}
                    </span>
                </div>
            </motion.div>
        );
    };

    return (
        <div className="space-y-5">
            {/* Header Section */}
            <div className="bg-white rounded-2xl border border-orange-100 shadow-md p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center">
                                <BarChart3 size="14" className="text-white" />
                            </div>
                            <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-500">Marketplace</p>
                        </div>
                        <h2 className="text-2xl font-black text-gray-800">City Skill Rates</h2>
                        <p className="text-sm text-gray-500 mt-1">View and manage base rates and live market rates</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setViewMode('base')}
                            className={`px-4 py-2.5 rounded-xl font-bold border transition-all ${viewMode === 'base' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border-transparent shadow-md' : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'}`}
                        >
                            📊 Base Rate
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('market')}
                            className={`px-4 py-2.5 rounded-xl font-bold border transition-all ${viewMode === 'market' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border-transparent shadow-md' : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'}`}
                        >
                            📈 Market Rate
                        </button>
                        <button
                            type="button"
                            onClick={() => fetchRates(true, page)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-100 text-orange-700 font-bold hover:bg-orange-200 transition-colors disabled:opacity-60"
                            disabled={refreshing}
                        >
                            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                        <button
                            type="button"
                            onClick={handleExport}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-100 text-green-700 font-bold hover:bg-green-200 transition-colors"
                        >
                            <Download size="16" /> Export
                        </button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <SummaryCard icon={viewMode === 'market' ? BadgePercent : MapPin} label={viewMode === 'market' ? 'Live Rows' : 'Base Rows'} value={summary.rows} tone="orange" delay={0} />
                    <SummaryCard icon={MapPin} label="Cities Covered" value={summary.cities} tone="amber" delay={0.05} />
                    <SummaryCard icon={Wrench} label="Skills Tracked" value={summary.skills} tone="blue" delay={0.1} />
                    <SummaryCard icon={Clock3} label="Last Updated" value={summary.latest ? formatDate(summary.latest) : 'N/A'} tone="emerald" delay={0.15} />
                </div>

                {/* Cooldown Notifications */}
                {viewMode === 'base' && nextCsvAllowedTime && (
                    <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                <Clock3 size="14" className="text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-blue-800">CSV Import Cooldown</p>
                                <p className="text-xs text-blue-700 mt-1">
                                    Next import allowed in: <span className="font-black text-blue-900">{csvCooldownText}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* CSV Import Section */}
                {viewMode === 'base' && (
                    <div className="mt-4">
                        <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold hover:shadow-md transition-all cursor-pointer">
                            <Upload size="16" />
                            <span>Import CSV</span>
                            <input
                                id="csvFileInput"
                                type="file"
                                accept=".csv"
                                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                                className="hidden"
                            />
                        </label>

                        {csvFile && (
                            <div className="mt-3 p-4 rounded-2xl bg-blue-50 border border-blue-200">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <FileText size="18" className="text-blue-600" />
                                        <div>
                                            <p className="text-sm font-bold text-blue-900">{csvFile.name}</p>
                                            <p className="text-xs text-blue-700">{(csvFile.size / 1024).toFixed(2)} KB</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setCsvFile(null)}
                                            className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200"
                                        >
                                            <X size="14" /> Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCsvUpload}
                                            className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition-colors disabled:opacity-60"
                                            disabled={csvUploading || isCsvCooldownActive}
                                        >
                                            {csvUploading ? 'Uploading...' : (isCsvCooldownActive ? 'Cooldown Active' : 'Upload')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Market Update Section */}
                {viewMode === 'market' && (
                    <div className="mt-4">
                        <button
                            type="button"
                            onClick={handleManualMarketUpdate}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold hover:shadow-md transition-all disabled:opacity-60"
                            disabled={marketUpdateLoading || isMarketCooldownActive}
                        >
                            <RefreshCw size={16} className={marketUpdateLoading ? 'animate-spin' : ''} />
                            Update Market Rates
                        </button>

                        {nextMarketUpdateTime && (
                            <div className="mt-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                                        <Clock3 size="14" className="text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-emerald-800">Market Rate Update Cooldown</p>
                                        <p className="text-xs text-emerald-700 mt-1">
                                            Next update allowed in: <span className="font-black text-emerald-900">{marketCooldownText}</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Success/Error Messages */}
                <AnimatePresence>
                    {csvSuccess && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mt-4 p-4 rounded-2xl bg-green-50 border border-green-200 flex items-start gap-3"
                        >
                            <CheckCircle size="18" className="text-green-600 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-bold text-green-800">CSV Import Successful</p>
                                <p className="text-xs text-green-700 mt-1">{csvSuccess}</p>
                            </div>
                            <button onClick={() => setCsvSuccess('')} className="ml-auto"><X size="14" className="text-green-600" /></button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {csvError && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mt-4 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3"
                        >
                            <AlertCircle size="18" className="text-red-600 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-bold text-red-800">CSV Import Failed</p>
                                <p className="text-xs text-red-700 mt-1">{csvError}</p>
                            </div>
                            <button onClick={() => setCsvError('')} className="ml-auto"><X size="14" className="text-red-600" /></button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {marketUpdateSuccess && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mt-4 p-4 rounded-2xl bg-green-50 border border-green-200 flex items-start gap-3"
                        >
                            <CheckCircle size="18" className="text-green-600 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-bold text-green-800">Market Rate Update Successful</p>
                                <p className="text-xs text-green-700 mt-1">{marketUpdateSuccess}</p>
                            </div>
                            <button onClick={() => setMarketUpdateSuccess('')} className="ml-auto"><X size="14" className="text-green-600" /></button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {marketUpdateError && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mt-4 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3"
                        >
                            <AlertCircle size="18" className="text-red-600 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-bold text-red-800">Market Rate Update Failed</p>
                                <p className="text-xs text-red-700 mt-1">{marketUpdateError}</p>
                            </div>
                            <button onClick={() => setMarketUpdateError('')} className="ml-auto"><X size="14" className="text-red-600" /></button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Search and Filters */}
                <div className="mt-6 space-y-3">
                    <div className="flex flex-col lg:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search size="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search by city or skill..."
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

                        <select
                            value={sortField}
                            onChange={(event) => setSortField(event.target.value)}
                            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        >
                            {sortOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>

                        <button
                            type="button"
                            onClick={() => setSortDirection((value) => (value === 'asc' ? 'desc' : 'asc'))}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 font-semibold hover:border-orange-300 transition-all"
                        >
                            <ArrowUpDown size="14" />
                            {sortDirection === 'asc' ? 'Ascending' : 'Descending'}
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
                                    value={selectedCity}
                                    onChange={(e) => setSelectedCity(e.target.value)}
                                    className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                                >
                                    <option value="all">All Cities</option>
                                    {cityOptions.map(city => (
                                        <option key={city} value={city}>{city}</option>
                                    ))}
                                </select>

                                <select
                                    value={selectedSkill}
                                    onChange={(e) => setSelectedSkill(e.target.value)}
                                    className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                                >
                                    <option value="all">All Skills</option>
                                    {skillOptions.map(skill => (
                                        <option key={skill} value={skill}>{skill}</option>
                                    ))}
                                </select>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Results Count */}
            {!loading && rates.length > 0 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                        Showing <span className="font-bold text-orange-600">{rates.length}</span> of <span className="font-bold">{total}</span> records
                    </p>
                    {(search || selectedCity !== 'all' || selectedSkill !== 'all') && (
                        <button onClick={() => { setSearch(''); setSelectedCity('all'); setSelectedSkill('all'); }} className="text-xs text-orange-500 font-semibold hover:underline">
                            Clear Filters
                        </button>
                    )}
                </div>
            )}

            {/* Table Header */}
            <div className="bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden">
                <div className={`hidden md:grid gap-3 bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-orange-700 border-b border-orange-200 ${viewMode === 'market' ? 'grid-cols-7' : 'grid-cols-6'}`}>
                    <div className="flex items-center gap-1"><MapPin size="12" /> City</div>
                    <div className="flex items-center gap-1"><Wrench size="12" /> Skill</div>
                    {viewMode === 'market' ? (
                        <>
                            <div className="text-right">P50</div>
                            <div className="text-right">P75</div>
                            <div className="text-right">P90</div>
                            <div className="text-right">Data Points</div>
                            <div className="text-right">Source</div>
                        </>
                    ) : (
                        <>
                            <div className="text-right">/Hour</div>
                            <div className="text-right">/Day</div>
                            <div className="text-right">/Visit</div>
                            <div className="text-right">Source</div>
                        </>
                    )}
                </div>

                <div className="divide-y divide-gray-100">
                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="animate-spin h-10 w-10 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4" />
                            <p className="text-gray-500">Loading rates...</p>
                        </div>
                    ) : error ? (
                        <div className="p-12 text-center text-red-500">{error}</div>
                    ) : rates.length ? (
                        rates.map((row) => renderRow(row))
                    ) : (
                        <div className="p-12 text-center text-gray-500">
                            {viewMode === 'market'
                                ? 'No live market rate rows are available yet.'
                                : 'No rate rows matched your search.'}
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {!loading && rates.length > 0 && totalPages > 1 && (
                    <div className="border-t border-orange-100 px-4 py-4 bg-orange-50/40">
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
        </div>
    );
};

// Helper CheckCircle Component
const CheckCircle = ({ size, className }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);

export default AdminMarketplaceSection;