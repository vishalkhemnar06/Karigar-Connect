import React, { useEffect, useMemo, useState } from 'react';
import * as api from '../../api';
import { RefreshCw, Search, ArrowUpDown, MapPin, Wrench, BadgePercent, Clock3, Upload, AlertCircle } from 'lucide-react';

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
    { value: 'p50', label: 'Sort by P50' },
    { value: 'p75', label: 'Sort by P75' },
    { value: 'p90', label: 'Sort by P90' },
    { value: 'dataPoints', label: 'Sort by Data Points' },
    { value: 'confidence', label: 'Sort by Confidence' },
    { value: 'lastUpdated', label: 'Sort by Last Updated' },
];

const BASE_SORT_OPTIONS = [
    { value: 'hourRate', label: 'Sort by Hour Rate' },
    { value: 'dayRate', label: 'Sort by Day Rate' },
    { value: 'visitRate', label: 'Sort by Visit Rate' },
];

const PAGE_SIZE = 100;

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
            });
            setRates(Array.isArray(response?.data?.rates) ? response.data.rates : []);
            setTotal(Number(response?.data?.total || 0));
            setTotalPages(Math.max(1, Number(response?.data?.totalPages || 1)));
            setPage(Number(response?.data?.page || targetPage || 1));

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
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchRates(false, page);
    }, [viewMode, page, search, sortField, sortDirection]);

    useEffect(() => {
        setSortField(viewMode === 'market' ? 'p50' : 'hourRate');
        setSortDirection('desc');
        setPage(1);
    }, [viewMode]);

    useEffect(() => {
        setPage(1);
    }, [search]);

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

            // Clear file input
            const fileInput = document.getElementById('csvFileInput');
            if (fileInput) fileInput.value = '';

            // Refresh rates after 1 second
            setTimeout(() => fetchRates(true, page), 1000);
        } catch (err) {
            const errorMsg = err?.response?.data?.message || 'Failed to upload CSV file.';
            setCsvError(errorMsg);
            console.error('CSV upload error:', err);
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

            // Refresh rates after 2 seconds to allow backend processing
            setTimeout(() => fetchRates(true, page), 2000);
        } catch (err) {
            const errorMsg = err?.response?.data?.message || 'Failed to update market rates.';
            setMarketUpdateError(errorMsg);
            console.error('Market update error:', err);

            // Update next allowed time if available in error response
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

    useEffect(() => {
        setPage(1);
    }, [search]);

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

    const pageNumbers = useMemo(
        () => Array.from({ length: totalPages }, (_, index) => index + 1),
        [totalPages],
    );

    const renderRow = (row) => {
        if (viewMode === 'market') {
            return (
                <div key={row._id} className="grid grid-cols-1 md:grid-cols-6 gap-3 px-4 py-4 items-center">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 md:hidden">City</p>
                        <p className="text-sm font-bold text-gray-900">{row.city || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 md:hidden">Skill</p>
                        <p className="text-sm font-bold text-gray-900">{row.skill || 'N/A'}</p>
                    </div>
                    <div className="md:text-right">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 md:hidden">P50</p>
                        <p className="text-sm font-bold text-orange-700">{formatMoney(row.p50)}</p>
                    </div>
                    <div className="md:text-right">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 md:hidden">P75</p>
                        <p className="text-sm font-bold text-orange-700">{formatMoney(row.p75)}</p>
                    </div>
                    <div className="md:text-right">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 md:hidden">P90</p>
                        <p className="text-sm font-bold text-orange-700">{formatMoney(row.p90)}</p>
                    </div>
                    <div className="md:text-right flex md:justify-end items-center gap-2">
                        <div className="text-right md:text-right">
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 md:hidden">Data</p>
                            <p className="text-sm font-bold text-orange-700">{row.dataPoints || 0} pts</p>
                            <p className="text-[11px] text-gray-500">Conf {formatConfidence(row.confidence || 0)}</p>
                        </div>
                        <span className="hidden md:inline-flex text-[11px] font-black px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                            {row.source || 'market_rate'}
                        </span>
                    </div>
                </div>
            );
        }

        return (
            <div key={row._id} className="grid grid-cols-1 md:grid-cols-5 gap-3 px-4 py-4 items-center">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 md:hidden">City</p>
                    <p className="text-sm font-bold text-gray-900">{row.city || 'N/A'}</p>
                </div>
                <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 md:hidden">Skill</p>
                    <p className="text-sm font-bold text-gray-900">{row.skill || 'N/A'}</p>
                </div>
                <div className="md:text-right">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 md:hidden">/Hour</p>
                    <p className="text-sm font-bold text-orange-700">{formatMoney(row.hourRate)}</p>
                </div>
                <div className="md:text-right">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 md:hidden">/Day</p>
                    <p className="text-sm font-bold text-orange-700">{formatMoney(row.dayRate)}</p>
                </div>
                <div className="md:text-right flex md:justify-end items-center gap-2">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 md:hidden">/Visit</p>
                        <p className="text-sm font-bold text-orange-700">{formatMoney(row.visitRate)}</p>
                    </div>
                    <span className="hidden md:inline-flex text-[11px] font-black px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                        {row.source || 'base_rate'}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-500">Marketplace</p>
                        <h2 className="text-2xl font-black text-gray-900">City Skill Rates</h2>
                        <p className="text-sm text-gray-500">Switch between bootstrap base rates and live MarketRate rows from the pricing cron.</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setViewMode('base')}
                            className={`px-4 py-2.5 rounded-xl font-bold border transition-colors ${viewMode === 'base' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-700 border-gray-200'}`}
                        >
                            Base Rate
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('market')}
                            className={`px-4 py-2.5 rounded-xl font-bold border transition-colors ${viewMode === 'market' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-700 border-gray-200'}`}
                        >
                            Market Rate
                        </button>
                        <button
                            type="button"
                            onClick={() => fetchRates(true, page)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-500 transition-colors disabled:opacity-60"
                            disabled={refreshing}
                        >
                            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                            Refresh
                        </button>

                        {viewMode === 'base' && (
                            <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-colors cursor-pointer disabled:opacity-60">
                                <Upload size={16} />
                                <span>Import CSV</span>
                                <input
                                    id="csvFileInput"
                                    type="file"
                                    accept=".csv"
                                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                                    className="hidden"
                                />
                            </label>
                        )}

                        {viewMode === 'market' && (
                            <button
                                type="button"
                                onClick={handleManualMarketUpdate}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white font-bold hover:bg-green-500 transition-colors disabled:opacity-60"
                                disabled={marketUpdateLoading}
                            >
                                <RefreshCw size={16} className={marketUpdateLoading ? 'animate-spin' : ''} />
                                Update Market Rates
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <SummaryCard icon={viewMode === 'market' ? BadgePercent : MapPin} label={viewMode === 'market' ? 'Live Rows' : 'Base Rows'} value={summary.rows} tone="orange" />
                    <SummaryCard icon={MapPin} label="Cities" value={summary.cities} tone="amber" />
                    <SummaryCard icon={Wrench} label="Skills" value={summary.skills} tone="gray" />
                    <SummaryCard icon={Clock3} label="Last Updated" value={summary.latest ? formatDate(summary.latest) : 'N/A'} tone="emerald" />
                </div>

                {viewMode === 'base' && nextCsvAllowedTime && (
                    <div className="mt-4 p-4 rounded-2xl bg-blue-50 border border-blue-100">
                        <p className="text-sm font-bold text-blue-900">CSV import cooldown</p>
                        <p className="text-xs text-blue-700 mt-1">
                            Next CSV import allowed in: <span className="font-black">{csvCooldownText}</span>
                        </p>
                    </div>
                )}

                {/* CSV Import Section - Base Rate Mode */}
                {viewMode === 'base' && csvFile && (
                    <div className="mt-4 p-4 rounded-2xl bg-blue-50 border border-blue-100">
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2">
                                <Upload size={18} className="text-blue-600" />
                                <div>
                                    <p className="text-sm font-bold text-blue-900">{csvFile.name}</p>
                                    <p className="text-xs text-blue-700">{(csvFile.size / 1024).toFixed(2)} KB</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleCsvUpload}
                                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 transition-colors disabled:opacity-60"
                                disabled={csvUploading || isCsvCooldownActive}
                            >
                                {csvUploading ? 'Uploading...' : (isCsvCooldownActive ? 'Cooldown Active' : 'Upload')}
                            </button>
                        </div>

                        {nextCsvAllowedTime && (
                            <div className="mt-2 p-2 rounded-lg bg-yellow-50 border border-yellow-200 flex items-start gap-2">
                                <AlertCircle size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-yellow-700">
                                    Next CSV import allowed in: <span className="font-bold">{csvCooldownText}</span>
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* CSV Success/Error Messages */}
                {viewMode === 'base' && csvSuccess && (
                    <div className="mt-4 p-4 rounded-2xl bg-green-50 border border-green-200 flex items-start gap-2">
                        <AlertCircle size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-green-900">CSV Import Successful</p>
                            <p className="text-xs text-green-700 mt-1">{csvSuccess}</p>
                        </div>
                    </div>
                )}

                {viewMode === 'base' && csvError && (
                    <div className="mt-4 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2">
                        <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-red-900">CSV Import Failed</p>
                            <p className="text-xs text-red-700 mt-1">{csvError}</p>
                        </div>
                    </div>
                )}

                {/* Manual Market Update Status */}
                {viewMode === 'market' && lastMarketUpdateTime && (
                    <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                        <p className="text-sm text-emerald-900">
                            <span className="font-bold">Last Market Rate Update:</span> {formatDate(lastMarketUpdateTime)}
                        </p>
                        {nextMarketUpdateTime && (
                            <p className="text-xs text-emerald-700 mt-2">
                                Next update allowed in: <span className="font-bold">{marketCooldownText}</span>
                            </p>
                        )}
                    </div>
                )}

                {/* Market Update Success/Error Messages */}
                {viewMode === 'market' && marketUpdateSuccess && (
                    <div className="mt-4 p-4 rounded-2xl bg-green-50 border border-green-200 flex items-start gap-2">
                        <AlertCircle size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-green-900">Market Rate Update Successful</p>
                            <p className="text-xs text-green-700 mt-1">{marketUpdateSuccess}</p>
                        </div>
                    </div>
                )}

                {viewMode === 'market' && marketUpdateError && (
                    <div className="mt-4 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2">
                        <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-red-900">Market Rate Update Failed</p>
                            <p className="text-xs text-red-700 mt-1">{marketUpdateError}</p>
                        </div>
                    </div>
                )}

                <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <div className="relative lg:col-span-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search city or skill"
                            className="w-full rounded-2xl border border-gray-200 bg-white pl-10 pr-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50"
                        />
                    </div>

                    <select
                        value={sortField}
                        onChange={(event) => setSortField(event.target.value)}
                        className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50"
                    >
                        {sortOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>

                    <button
                        type="button"
                        onClick={() => setSortDirection((value) => (value === 'asc' ? 'desc' : 'asc'))}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 hover:border-orange-300 hover:text-orange-700"
                    >
                        <ArrowUpDown size={16} />
                        {sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-6 text-gray-500">Loading marketplace rates...</div>
            ) : error ? (
                <div className="bg-white rounded-2xl border border-red-100 p-6 text-red-600">{error}</div>
            ) : rates.length ? (
                <div className="bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden">
                    <div className={`hidden md:grid gap-0 bg-orange-50 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-orange-700 border-b border-orange-100 ${viewMode === 'market' ? 'grid-cols-6' : 'grid-cols-5'}`}>
                        <div className="flex items-center gap-2"><MapPin size={14} /> City</div>
                        <div className="flex items-center gap-2"><Wrench size={14} /> Skill</div>
                        {viewMode === 'market' ? (
                            <>
                                <div className="text-right">P50</div>
                                <div className="text-right">P75</div>
                                <div className="text-right">P90</div>
                                <div className="text-right">Data / Confidence</div>
                            </>
                        ) : (
                            <>
                                <div className="text-right">/Hour</div>
                                <div className="text-right">/Day</div>
                                <div className="text-right">/Visit</div>
                            </>
                        )}
                    </div>

                    <div className="divide-y divide-gray-100">
                        {rates.map((row) => renderRow(row))}
                    </div>

                    <div className="border-t border-orange-100 px-4 py-4 bg-orange-50/40">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <p className="text-sm text-gray-600">
                                Showing up to {PAGE_SIZE} rows per page. Total rows: <span className="font-bold text-gray-900">{total}</span>.
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
                    {viewMode === 'market'
                        ? 'No live market rate rows are available yet.'
                        : 'No rate rows matched your search.'}
                </div>
            )}
        </div>
    );
};

const SummaryCard = ({ icon: Icon, label, value, tone = 'gray' }) => {
    const toneClasses = {
        orange: 'from-orange-50 to-amber-50 border-orange-100 text-orange-700',
        amber: 'from-amber-50 to-yellow-50 border-amber-100 text-amber-700',
        emerald: 'from-emerald-50 to-green-50 border-emerald-100 text-emerald-700',
        gray: 'from-gray-50 to-slate-50 border-gray-100 text-gray-700',
    };

    return (
        <div className={`rounded-2xl border bg-gradient-to-br p-4 ${toneClasses[tone] || toneClasses.gray}`}>
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] opacity-80 truncate">{label}</p>
                    <p className="text-2xl font-black mt-1 break-words">{value}</p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-white/70 flex items-center justify-center shadow-sm shrink-0">
                    <Icon size={18} />
                </div>
            </div>
        </div>
    );
};

export default AdminMarketplaceSection;
