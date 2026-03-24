// client/src/pages/shop/ShopDashboard.jsx
// UPDATED:
//   - Mobile-first design with bottom navigation bar
//   - Removed notifications bell
//   - Removed dark mode toggle
//   - Touch-friendly tap targets (min 44px)
//   - Optimized layouts for small screens
//   - Sticky bottom nav for mobile
//   - Improved mobile modals (full-screen on mobile)
//   - Better mobile forms and inputs
//   - Swipe-friendly product cards

import React, { useEffect, useState, useCallback, memo, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../../api';
import { getImageUrl, imgError } from '../../utils/imageUrl';
import toast from 'react-hot-toast';
import {
    Store, Tag, Package, History, BarChart3, Settings,
    LogOut, Menu, X, QrCode, CheckCircle, Plus, Edit2,
    Trash2, Camera, Upload, TrendingUp, Users, DollarSign,
    ShoppingBag, Search, ArrowUp, ArrowDown, Calendar,
    Eye, RefreshCw, AlertCircle, ChevronRight,
    Download, Check, Clock, Percent, Shield, Sparkles,
    Grid3x3, List
} from 'lucide-react';

// ── ANIMATED BAR CHART ─────────────────────────────────────────────────────────
const BarChart = memo(({ data, color = 'orange', height = 120, animated = true }) => {
    const max = Math.max(...data.map(d => d.value), 1);
    const [animate, setAnimate] = useState(!animated);

    useEffect(() => {
        if (animated) {
            const timer = setTimeout(() => setAnimate(true), 100);
            return () => clearTimeout(timer);
        }
    }, [animated]);

    return (
        <div className="flex items-end gap-1" style={{ height }}>
            {data.map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-1 flex-1 group">
                    <div className="relative w-full flex items-end justify-center" style={{ height: height - 20 }}>
                        <div
                            className={`w-full rounded-t-lg bg-${color}-400 group-hover:bg-${color}-500 transition-all duration-700 ease-out cursor-pointer`}
                            style={{
                                height: animate ? `${(d.value / max) * 100}%` : '0%',
                                minHeight: animate && d.value ? 4 : 0,
                                transitionDelay: `${i * 50}ms`
                            }}
                            title={`${d.label}: ₹${d.value}`}
                        />
                    </div>
                    <span className="text-[9px] text-gray-400 truncate w-full text-center">{d.label}</span>
                </div>
            ))}
        </div>
    );
});
BarChart.displayName = 'BarChart';

// ── ENHANCED DONUT CHART ──────────────────────────────────────────────────────
const DonutChart = memo(({ segments, size = 120, thickness = 22, centerText }) => {
    const r = (size - thickness) / 2;
    const cx = size / 2, cy = size / 2;
    const circumference = 2 * Math.PI * r;
    const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
    let cumulative = 0;

    return (
        <div className="relative inline-block" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
                {segments.map((seg, i) => {
                    const pct = seg.value / total;
                    const dash = pct * circumference;
                    const offset = -cumulative * circumference;
                    cumulative += pct;
                    return (
                        <circle
                            key={i}
                            cx={cx} cy={cy} r={r}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth={thickness}
                            strokeDasharray={`${dash} ${circumference - dash}`}
                            strokeDashoffset={offset}
                            className="transition-all duration-1000 ease-out"
                        />
                    );
                })}
            </svg>
            {centerText && (
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                    {centerText}
                </div>
            )}
        </div>
    );
});
DonutChart.displayName = 'DonutChart';

// ── ENHANCED STAT CARD ────────────────────────────────────────────────────────
const StatCard = memo(({ title, value, sub, icon: Icon, color, trend, trendVal, loading }) => (
    <div className={`bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 ${loading ? 'animate-pulse' : ''}`}>
        <div className="flex items-start justify-between mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} shadow-lg`}>
                <Icon size={18} className="text-white" />
            </div>
            {trendVal !== undefined && (
                <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
                    trend === 'up' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                }`}>
                    {trend === 'up' ? <ArrowUp size={10}/> : <ArrowDown size={10}/>}
                    {trendVal}%
                </div>
            )}
        </div>
        {loading ? (
            <>
                <div className="h-7 bg-gray-200 rounded w-3/4 mb-1"></div>
                <div className="h-4 bg-gray-100 rounded w-1/2"></div>
            </>
        ) : (
            <>
                <p className="text-xl font-black text-gray-900 leading-tight">{value}</p>
                <p className="text-xs font-semibold text-gray-500 mt-1">{title}</p>
                {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
            </>
        )}
    </div>
));
StatCard.displayName = 'StatCard';

// ── PRODUCT CARD ───────────────────────────────────────────────────────────────
const ProductCard = memo(({ product, onView, onEdit, onDelete, index }) => (
    <div
        className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300"
        style={{ animationDelay: `${index * 50}ms` }}
    >
        <div className="relative h-36 bg-gradient-to-br from-orange-50 to-amber-50 overflow-hidden">
            {getImageUrl(product.image, null) ? (
                <img
                    src={getImageUrl(product.image)}
                    onError={imgError()}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    alt={product.name}
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    <Package size={32} className="text-orange-200" />
                </div>
            )}
            {product.price >= 1000 && (
                <div className="absolute top-2 right-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-lg">
                    <Sparkles size={8} className="inline mr-0.5" /> ELIGIBLE
                </div>
            )}
            {product.stock === 0 && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                    <span className="text-white font-black text-xs bg-red-500 px-3 py-1 rounded-full">OUT OF STOCK</span>
                </div>
            )}
            {product.stock > 0 && product.stock <= 5 && (
                <div className="absolute top-2 left-2 bg-yellow-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                    Only {product.stock} left
                </div>
            )}
        </div>
        <div className="p-3">
            <h4 className="font-black text-gray-800 truncate text-sm group-hover:text-orange-600 transition-colors">
                {product.name}
            </h4>
            <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 min-h-[1.8rem]">{product.description || 'No description'}</p>
            <div className="flex items-center justify-between mt-2">
                <span className="text-lg font-black text-orange-600">₹{product.price.toLocaleString()}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    product.stock > 5 ? 'bg-green-50 text-green-700' :
                    product.stock > 0 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'
                }`}>
                    {product.stock > 0 ? `${product.stock} stock` : 'Out of stock'}
                </span>
            </div>
            {/* Touch-friendly action buttons */}
            <div className="flex gap-2 mt-3">
                <button onClick={() => onView(product)}
                    className="flex-1 flex items-center justify-center gap-1 bg-orange-50 text-orange-600 py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-all">
                    <Eye size={13} /> View
                </button>
                <button onClick={() => onEdit(product)}
                    className="flex-1 flex items-center justify-center gap-1 bg-blue-50 text-blue-600 py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-all">
                    <Edit2 size={13} /> Edit
                </button>
                <button onClick={() => onDelete(product._id)}
                    className="flex items-center justify-center bg-red-50 text-red-500 px-3 py-2.5 rounded-xl active:scale-95 transition-all">
                    <Trash2 size={13} />
                </button>
            </div>
        </div>
    </div>
));
ProductCard.displayName = 'ProductCard';

// ── TRANSACTION CARD ───────────────────────────────────────────────────────────
const TransactionCard = memo(({ transaction, onClick, index }) => (
    <div
        className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 flex items-center gap-3 active:scale-[0.99] transition-all duration-200 cursor-pointer"
        style={{ animationDelay: `${index * 30}ms` }}
        onClick={() => onClick(transaction)}
    >
        {getImageUrl(transaction.productPhoto, null) ? (
            <img
                src={getImageUrl(transaction.productPhoto)}
                onError={imgError()}
                className="w-14 h-14 rounded-xl object-cover border-2 border-orange-100 flex-shrink-0"
                alt=""
            />
        ) : (
            <div className="w-14 h-14 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <ShoppingBag size={18} className="text-orange-300" />
            </div>
        )}
        <div className="flex-1 min-w-0">
            <p className="font-black text-gray-800 truncate text-sm">{transaction.product?.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <p className="text-xs text-gray-500 truncate max-w-[100px]">{transaction.worker?.name}</p>
                <span className="text-gray-300">·</span>
                <p className="text-[10px] font-mono text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">
                    {transaction.coupon?.code}
                </p>
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                <Calendar size={9} />
                {new Date(transaction.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
        </div>
        <div className="text-right flex-shrink-0">
            <p className="font-black text-green-700 text-base">₹{transaction.finalPrice}</p>
            <p className="text-[10px] text-red-400 font-semibold">-₹{transaction.discountAmount}</p>
            <ChevronRight size={14} className="text-gray-300 ml-auto mt-1" />
        </div>
    </div>
));
TransactionCard.displayName = 'TransactionCard';

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────
const AnalyticsPage = memo(() => {
    const [data, setData] = useState(null);
    const [txns, setTxns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('week');

    useEffect(() => {
        Promise.all([api.getShopAnalytics(), api.getShopTransactions()])
            .then(([a, t]) => { setData(a.data); setTxns(t.data); })
            .catch(() => toast.error('Failed to load analytics.'))
            .finally(() => setLoading(false));
    }, []);

    const dailyChart = useMemo(() => {
        if (!txns.length) return [];
        const map = {};
        const daysToShow = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 90;
        txns.slice(0, daysToShow).forEach(t => {
            const d = new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            map[d] = (map[d] || 0) + t.finalPrice;
        });
        return Object.entries(map).slice(-daysToShow).map(([label, value]) => ({ label, value }));
    }, [txns, timeRange]);

    const discountChart = useMemo(() => {
        if (!txns.length) return [];
        const map = {};
        const daysToShow = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 90;
        txns.slice(0, daysToShow).forEach(t => {
            const d = new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            map[d] = (map[d] || 0) + t.discountAmount;
        });
        return Object.entries(map).slice(-daysToShow).map(([label, value]) => ({ label, value }));
    }, [txns, timeRange]);

    const donutSegs = data ? [
        { value: data.totalSales, color: '#f97316' },
        { value: data.totalDiscounts, color: '#fb923c' },
    ] : [];

    const avgTxn = txns.length ? Math.round(data?.totalSales / txns.length) : 0;
    const avgDiscount = txns.length ? Math.round(data?.totalDiscounts / txns.length) : 0;
    const conversionRate = data?.totalTxns && data?.totalWorkers ? Math.round((data.totalTxns / data.totalWorkers) * 100) : 0;

    if (loading) return (
        <div className="flex items-center justify-center py-24">
            <div className="animate-spin w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full" />
        </div>
    );
    if (!data) return null;

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-black text-gray-900">Analytics</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Business insights overview</p>
                </div>
                <div className="flex gap-1.5">
                    {[
                        { key: 'week', label: '7D' },
                        { key: 'month', label: '30D' },
                        { key: 'year', label: '90D' },
                    ].map(range => (
                        <button
                            key={range.key}
                            onClick={() => setTimeRange(range.key)}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all min-w-[44px] ${
                                timeRange === range.key
                                    ? 'bg-orange-500 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                            }`}
                        >
                            {range.label}
                        </button>
                    ))}
                    <button
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 active:bg-gray-50 transition-all"
                    >
                        <RefreshCw size={13} />
                    </button>
                </div>
            </div>

            {/* KPI Cards - 2 columns on mobile */}
            <div className="grid grid-cols-2 gap-3">
                <StatCard title="Total Revenue" value={`₹${data.totalSales?.toLocaleString()}`} sub={`Avg ₹${avgTxn}/txn`} icon={DollarSign} color="bg-gradient-to-br from-orange-500 to-orange-600" trend="up" trendVal="12" loading={loading} />
                <StatCard title="Total Discounts" value={`₹${data.totalDiscounts?.toLocaleString()}`} sub={`Avg ₹${avgDiscount}/txn`} icon={Tag} color="bg-gradient-to-br from-amber-500 to-orange-500" trend="down" trendVal="5" loading={loading} />
                <StatCard title="Workers" value={data.totalWorkers} sub="Unique customers" icon={Users} color="bg-gradient-to-br from-blue-500 to-blue-600" trend="up" trendVal="8" loading={loading} />
                <StatCard title="Transactions" value={data.totalTxns} sub={`${conversionRate}% conversion`} icon={ShoppingBag} color="bg-gradient-to-br from-purple-500 to-purple-600" trend="up" trendVal="15" loading={loading} />
            </div>

            {/* Revenue Chart */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="font-black text-gray-800 text-sm">Revenue Trend</h3>
                        <p className="text-[10px] text-gray-400">Daily sales performance</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                        <span className="text-[10px] text-gray-500">Revenue (₹)</span>
                    </div>
                </div>
                {dailyChart.length > 0
                    ? <BarChart data={dailyChart} color="orange" height={140} animated />
                    : <div className="h-32 flex items-center justify-center text-gray-300 text-sm">No data yet</div>
                }
            </div>

            {/* Donut + Distribution stacked on mobile */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <h3 className="font-black text-gray-800 text-sm mb-1">Revenue Distribution</h3>
                <p className="text-[10px] text-gray-400 mb-4">Sales vs Discounts</p>
                <div className="flex flex-col sm:flex-row items-center gap-5">
                    <DonutChart
                        segments={donutSegs}
                        size={130}
                        thickness={22}
                        centerText={
                            <>
                                <p className="text-xl font-black text-gray-900">
                                    {data.totalSales + data.totalDiscounts > 0
                                        ? `${Math.round((data.totalSales / (data.totalSales + data.totalDiscounts)) * 100)}%`
                                        : '—'}
                                </p>
                                <p className="text-[10px] text-gray-400">Net</p>
                            </>
                        }
                    />
                    <div className="space-y-3 flex-1 w-full">
                        {[
                            { label: 'Revenue Collected', val: `₹${data.totalSales?.toLocaleString()}`, color: 'bg-orange-400', pct: Math.round((data.totalSales / (data.totalSales + data.totalDiscounts)) * 100) },
                            { label: 'Discounts Given', val: `₹${data.totalDiscounts?.toLocaleString()}`, color: 'bg-amber-400', pct: Math.round((data.totalDiscounts / (data.totalSales + data.totalDiscounts)) * 100) },
                        ].map(s => (
                            <div key={s.label} className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                                        <span className="text-gray-600 text-xs">{s.label}</span>
                                    </div>
                                    <span className="font-bold text-gray-800 text-xs">{s.val}</span>
                                </div>
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-full ${s.color} rounded-full transition-all duration-700`} style={{ width: `${s.pct}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Discount chart */}
            {discountChart.length > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                    <h3 className="font-black text-gray-800 text-sm mb-1">Discount Distribution</h3>
                    <p className="text-[10px] text-gray-400 mb-4">Daily discount amounts (₹)</p>
                    <BarChart data={discountChart} color="amber" height={120} animated />
                </div>
            )}

            {/* Top products */}
            {data.mostSold?.length > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                    <h3 className="font-black text-gray-800 text-sm mb-4 flex items-center gap-2">
                        <TrendingUp size={16} className="text-orange-500" />
                        Top Selling Products
                    </h3>
                    <div className="space-y-3">
                        {data.mostSold.map((p, i) => {
                            const pct = Math.round((p.count / (data.mostSold[0]?.count || 1)) * 100);
                            return (
                                <div key={i} className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 ${
                                        i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-400' : 'bg-orange-400'
                                    }`}>{i + 1}</div>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="font-semibold text-gray-800 truncate max-w-[150px]">{p.name}</span>
                                            <span className="font-black text-orange-600 ml-2">{p.count} sold</span>
                                        </div>
                                        <div className="h-1.5 bg-orange-50 rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-orange-400 to-amber-400 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
});
AnalyticsPage.displayName = 'AnalyticsPage';

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: COUPON VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────
const CouponPage = memo(() => {
    const [code, setCode] = useState('');
    const [couponData, setCouponData] = useState(null);
    const [products, setProducts] = useState([]);
    const [selectedPid, setSelectedPid] = useState('');
    const [photo, setPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [applying, setApplying] = useState(false);
    const [success, setSuccess] = useState(null);
    const inputRef = useRef(null);

    const onCode = useCallback(e => setCode(e.target.value.toUpperCase()), []);
    const onPid = useCallback(e => setSelectedPid(e.target.value), []);

    const onPhoto = useCallback(e => {
        const f = e.target.files[0];
        if (!f) return;
        setPhoto(f);
        setPhotoPreview(URL.createObjectURL(f));
    }, []);

    useEffect(() => {
        api.getShopProducts().then(r => setProducts(r.data)).catch(() => {});
    }, []);

    const verify = useCallback(async () => {
        if (!code.trim()) return toast.error('Enter coupon code.');
        setLoading(true);
        setCouponData(null);
        try {
            const { data } = await api.verifyCoupon({ code });
            setCouponData(data);
            toast.success('Valid coupon!');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Invalid coupon.');
        } finally { setLoading(false); }
    }, [code]);

    const apply = useCallback(async () => {
        if (!selectedPid) return toast.error('Select a product.');
        if (!photo) return toast.error('Upload product photo.');
        setApplying(true);
        try {
            const fd = new FormData();
            fd.append('couponCode', code);
            fd.append('productId', selectedPid);
            fd.append('productPhoto', photo);
            const { data } = await api.applyCoupon(fd);
            setSuccess(data);
            toast.success('Sale completed!');
            setCouponData(null);
            setCode('');
            setSelectedPid('');
            setPhoto(null);
            setPhotoPreview(null);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to complete sale.');
        } finally { setApplying(false); }
    }, [code, selectedPid, photo]);

    const eligibleProducts = products.filter(p => p.price >= 1000 && p.stock > 0);

    return (
        <div className="space-y-4 sm:space-y-5">
    <div>
        <h2 className="text-base sm:text-lg font-black text-gray-900">Coupon Verify</h2>
        <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">Enter worker coupon code to apply discount</p>
    </div>

    {/* Success State */}
    {success && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl sm:rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                    <CheckCircle size={20} className="text-white" />
                </div>
                <div>
                    <p className="font-black text-green-800 text-base sm:text-lg">Sale Completed!</p>
                    <p className="text-[10px] sm:text-xs text-green-600">Transaction recorded successfully</p>
                </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white rounded-lg sm:rounded-xl p-2 sm:p-3 border border-green-100 shadow-sm">
                    <p className="text-sm sm:text-base font-black text-gray-900">₹{success.finalPrice}</p>
                    <p className="text-[8px] sm:text-[10px] text-gray-500">Final Price</p>
                </div>
                <div className="bg-white rounded-lg sm:rounded-xl p-2 sm:p-3 border border-green-100 shadow-sm">
                    <p className="text-sm sm:text-base font-black text-red-500">-₹{success.discountAmount}</p>
                    <p className="text-[8px] sm:text-[10px] text-gray-500">Discount</p>
                </div>
                <div className="bg-white rounded-lg sm:rounded-xl p-2 sm:p-3 border border-green-100 shadow-sm">
                    <p className="text-sm sm:text-base font-black text-orange-600">{couponData?.coupon?.discountPct || ''}%</p>
                    <p className="text-[8px] sm:text-[10px] text-gray-500">Discount %</p>
                </div>
            </div>
            <button
                onClick={() => setSuccess(null)}
                className="mt-3 sm:mt-4 w-full py-2.5 sm:py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-lg sm:rounded-xl text-xs sm:text-sm active:scale-95 transition-all shadow-md"
            >
                Verify Another Coupon
            </button>
        </div>
    )}

    {/* Main Form */}
    {!success && (
        <>
            {/* Code Entry Card */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm">
                <label className="block text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                    Coupon Code
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="e.g., ABCD1234"
                            value={code}
                            onChange={onCode}
                            onKeyPress={e => e.key === 'Enter' && verify()}
                            autoCapitalize="characters"
                            className="w-full border-2 border-gray-200 rounded-xl py-3 sm:py-3.5 px-4 font-mono text-sm sm:text-base uppercase tracking-widest
                                focus:border-orange-400 focus:ring-4 focus:ring-orange-50 focus:outline-none transition-all"
                        />
                    </div>
                    <button
                        onClick={verify}
                        disabled={loading}
                        className="w-full sm:w-auto px-5 sm:px-6 py-3 sm:py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-black
                            active:scale-95 transition-all disabled:opacity-50 min-w-[100px] sm:min-w-[80px] flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <span className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
                        ) : (
                            'Verify'
                        )}
                    </button>
                </div>
                <div className="flex items-center gap-1.5 mt-3 text-[10px] sm:text-xs text-gray-400">
                    <QrCode size={12} />
                    <span>Enter the code printed on the worker's coupon</span>
                </div>
            </div>

            {/* Coupon Details (Shows only after successful verification) */}
            {couponData?.valid && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl sm:rounded-2xl p-4 sm:p-5 space-y-4 sm:space-y-5 animate-in fade-in slide-in-from-top duration-300">
                    {/* Valid Badge */}
                    <div className="flex items-center gap-2 text-green-700 font-black text-xs sm:text-sm">
                        <CheckCircle size={16} /> Valid — {couponData.coupon.discountPct}% Discount Available
                    </div>

                    {/* Worker Info Card */}
                    <div className="bg-white rounded-xl p-3 sm:p-4 border border-green-100 flex items-center gap-3 sm:gap-4">
                        <img
                            src={getImageUrl(couponData.coupon.worker?.photo)}
                            onError={imgError()}
                            className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover border-2 border-orange-100 shadow-md flex-shrink-0"
                            alt="worker"
                        />
                        <div className="flex-1 min-w-0">
                            <p className="font-black text-gray-800 text-sm sm:text-base truncate">{couponData.coupon.worker?.name}</p>
                            <p className="text-[10px] sm:text-xs text-gray-500 font-mono truncate">{couponData.coupon.worker?.karigarId}</p>
                            <p className="text-[9px] sm:text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                                <Clock size={8} />
                                Expires: {new Date(couponData.coupon.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <p className="text-2xl sm:text-3xl font-black text-orange-600">{couponData.coupon.discountPct}%</p>
                            <p className="text-[8px] sm:text-[10px] text-gray-400">OFF</p>
                        </div>
                    </div>

                    {/* Product Selection */}
                    <div>
                        <label className="block text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                            Select Product <span className="text-red-500">*</span>
                        </label>
                        {eligibleProducts.length === 0 ? (
                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center gap-2 text-xs text-orange-700">
                                <AlertCircle size={14} /> No eligible products (MRP ≥ ₹1000 required)
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-80 overflow-y-auto -mx-1 px-1">
                                {eligibleProducts.map(p => {
                                    const discountedPrice = p.price - Math.round(p.price * couponData.coupon.discountPct / 100);
                                    const isSelected = selectedPid === p._id;
                                    return (
                                        <label
                                            key={p._id}
                                            className={`flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl border-2 cursor-pointer transition-all active:scale-98 ${
                                                isSelected
                                                    ? 'border-orange-400 bg-orange-50 shadow-md'
                                                    : 'border-gray-200 bg-white hover:border-orange-200'
                                            }`}
                                        >
                                            <input type="radio" name="product" value={p._id} checked={isSelected} onChange={onPid} className="sr-only" />
                                            {getImageUrl(p.image, null) && (
                                                <img 
                                                    src={getImageUrl(p.image)} 
                                                    onError={imgError()} 
                                                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover border flex-shrink-0" 
                                                    alt="" 
                                                />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-gray-800 text-xs sm:text-sm truncate">{p.name}</p>
                                                <p className="text-[9px] sm:text-[10px] text-gray-400">Stock: {p.stock}</p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-[9px] sm:text-[10px] line-through text-gray-400">₹{p.price}</p>
                                                <p className="font-black text-green-700 text-sm sm:text-base">₹{discountedPrice}</p>
                                                <p className="text-[8px] sm:text-[9px] text-orange-500">Save ₹{p.price - discountedPrice}</p>
                                            </div>
                                            {isSelected && <CheckCircle size={14} className="text-orange-500 flex-shrink-0" />}
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Photo Upload */}
                    <div>
                        <label className="block text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                            Purchase Photo <span className="text-red-500">*</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer border-2 border-dashed border-orange-300
                            rounded-xl p-3 sm:p-4 hover:bg-orange-50 transition-all group">
                            {photoPreview ? (
                                <div className="relative flex-shrink-0">
                                    <img src={photoPreview} className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover border-2 border-orange-200" alt="preview" />
                                    <div className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-green-500 rounded-full flex items-center justify-center">
                                        <Check size={8} className="text-white" />
                                    </div>
                                </div>
                            ) : (
                                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                                    <Camera size={20} className="text-orange-400" />
                                </div>
                            )}
                            <div className="flex-1">
                                <p className="font-semibold text-gray-700 text-xs sm:text-sm">
                                    {photo ? photo.name : 'Tap to upload or take photo'}
                                </p>
                                <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5">Required for record keeping</p>
                            </div>
                            <input 
                                type="file" 
                                accept="image/*" 
                                capture="environment" 
                                className="hidden" 
                                onChange={onPhoto} 
                            />
                        </label>
                    </div>

                    {/* Apply Button */}
                    <button
                        onClick={apply}
                        disabled={applying || !selectedPid || !photo}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3 sm:py-4 rounded-xl font-black text-sm sm:text-base
                            active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-200"
                    >
                        {applying ? (
                            <>
                                <span className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Sparkles size={16} /> Complete Sale
                            </>
                        )}
                    </button>
                </div>
            )}
        </>
    )}
</div>
    );
});
CouponPage.displayName = 'CouponPage';

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: PRODUCTS
// ─────────────────────────────────────────────────────────────────────────────
const ProductsPage = memo(() => {
    const [products, setProducts] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(null);
    const [viewMode, setViewMode] = useState('grid');
    const [searchTerm, setSearchTerm] = useState('');

    const [fName, setFName] = useState('');
    const [fDesc, setFDesc] = useState('');
    const [fPrice, setFPrice] = useState('');
    const [fStock, setFStock] = useState('');
    const [fImg, setFImg] = useState(null);
    const [fImgPreview, setFImgPreview] = useState(null);

    const onFImg = useCallback(e => {
        const f = e.target.files[0];
        if (!f) return;
        setFImg(f);
        setFImgPreview(URL.createObjectURL(f));
    }, []);

    const load = useCallback(() => {
        api.getShopProducts().then(r => setProducts(r.data)).catch(() => {});
    }, []);

    useEffect(() => { load(); }, [load]);

    const resetForm = useCallback(() => {
        setFName(''); setFDesc(''); setFPrice(''); setFStock('');
        setFImg(null); setFImgPreview(null); setEditing(null);
    }, []);

    const openAdd = useCallback(() => { resetForm(); setShowForm(true); }, [resetForm]);

    const openEdit = useCallback((p) => {
        setEditing(p);
        setFName(p.name);
        setFDesc(p.description || '');
        setFPrice(String(p.price));
        setFStock(String(p.stock));
        setFImg(null);
        setFImgPreview(getImageUrl(p.image, null));
        setShowForm(true);
    }, []);

    const save = useCallback(async () => {
        if (!fName || !fPrice) return toast.error('Name and price required.');
        setLoading(true);
        try {
            const fd = new FormData();
            fd.append('name', fName);
            fd.append('description', fDesc);
            fd.append('price', fPrice);
            fd.append('stock', fStock || '0');
            if (fImg) fd.append('image', fImg);
            if (editing) {
                await api.editShopProduct(editing._id, fd);
                toast.success('Product updated!');
            } else {
                await api.addShopProduct(fd);
                toast.success('Product added!');
            }
            setShowForm(false);
            resetForm();
            load();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to save.');
        } finally { setLoading(false); }
    }, [fName, fDesc, fPrice, fStock, fImg, editing, resetForm, load]);

    const del = useCallback(async (id) => {
        if (!window.confirm('Delete this product?')) return;
        try {
            await api.deleteShopProduct(id);
            toast.success('Deleted.');
            load();
        } catch { toast.error('Failed to delete.'); }
    }, [load]);

    const filteredProducts = useMemo(() => {
        if (!searchTerm) return products;
        const term = searchTerm.toLowerCase();
        return products.filter(p =>
            p.name?.toLowerCase().includes(term) ||
            p.description?.toLowerCase().includes(term)
        );
    }, [products, searchTerm]);

    const inputCls = "w-full border-2 border-gray-200 rounded-xl py-3.5 px-4 text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-50 focus:outline-none transition-all";

    return (
        <div className="space-y-4">
            {/* Product Detail Modal - full screen on mobile */}
            {selected && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg overflow-hidden">
                        {getImageUrl(selected.image, null) && (
                            <div className="relative h-52 overflow-hidden">
                                <img src={getImageUrl(selected.image)} onError={imgError()} className="w-full h-full object-cover" alt="" />
                                <button onClick={() => setSelected(null)}
                                    className="absolute top-3 right-3 bg-black/50 text-white p-2.5 rounded-full">
                                    <X size={18} />
                                </button>
                            </div>
                        )}
                        <div className="p-5 space-y-4">
                            {!getImageUrl(selected.image, null) && (
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-black text-gray-900">{selected.name}</h3>
                                    <button onClick={() => setSelected(null)} className="text-gray-400 p-1"><X size={20} /></button>
                                </div>
                            )}
                            {getImageUrl(selected.image, null) && <h3 className="text-lg font-black text-gray-900">{selected.name}</h3>}
                            <p className="text-gray-500 text-sm">{selected.description || 'No description'}</p>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="bg-orange-50 rounded-xl p-3">
                                    <p className="text-xl font-black text-orange-600">₹{selected.price}</p>
                                    <p className="text-[10px] text-gray-500">MRP</p>
                                </div>
                                <div className="bg-green-50 rounded-xl p-3">
                                    <p className="text-xl font-black text-green-600">{selected.stock}</p>
                                    <p className="text-[10px] text-gray-500">In Stock</p>
                                </div>
                                <div className={`rounded-xl p-3 ${selected.price >= 1000 ? 'bg-blue-50' : 'bg-gray-50'}`}>
                                    <p className={`text-xs font-black ${selected.price >= 1000 ? 'text-blue-600' : 'text-gray-400'}`}>
                                        {selected.price >= 1000 ? '✅ Yes' : '❌ No'}
                                    </p>
                                    <p className="text-[10px] text-gray-500">Coupon</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => { setSelected(null); openEdit(selected); }}
                                    className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3.5 rounded-xl font-bold text-sm active:scale-95 transition-all">
                                    Edit
                                </button>
                                <button onClick={() => { setSelected(null); del(selected._id); }}
                                    className="flex-1 bg-red-50 text-red-500 py-3.5 rounded-xl font-bold text-sm active:scale-95 transition-all">
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-black text-gray-900">Products ({products.length})</h2>
                    <p className="text-xs text-gray-500">Manage inventory</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                        className="p-2.5 border-2 border-gray-200 rounded-xl active:bg-gray-50 transition-all">
                        {viewMode === 'grid' ? <List size={16} /> : <Grid3x3 size={16} />}
                    </button>
                    <button onClick={openAdd}
                        className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm active:scale-95 transition-all shadow-md">
                        <Plus size={16} /> Add
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-50 focus:outline-none"
                />
            </div>

            {/* Product Form - sheet from bottom on mobile */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg overflow-y-auto max-h-[90vh]">
                        <div className="p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-black text-gray-800 text-lg">{editing ? 'Edit Product' : 'Add Product'}</h3>
                                <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 p-1 active:text-gray-700">
                                    <X size={22} />
                                </button>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Product Name *</label>
                                <input placeholder="Enter product name" value={fName} onChange={e => setFName(e.target.value)} className={inputCls} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Price (₹) *</label>
                                    <input type="number" inputMode="numeric" placeholder="0" value={fPrice} onChange={e => setFPrice(e.target.value)} className={inputCls} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Stock</label>
                                    <input type="number" inputMode="numeric" placeholder="0" value={fStock} onChange={e => setFStock(e.target.value)} className={inputCls} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Description</label>
                                <textarea placeholder="Brief product description..." value={fDesc} onChange={e => setFDesc(e.target.value)} rows={2}
                                    className="w-full border-2 border-gray-200 rounded-xl py-3 px-4 text-sm resize-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50 focus:outline-none transition-all" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Product Image</label>
                                <label className="flex items-center gap-3 cursor-pointer border-2 border-dashed border-gray-200 rounded-xl p-3 active:bg-orange-50 transition-all">
                                    {fImgPreview
                                        ? <img src={fImgPreview} className="w-14 h-14 rounded-lg object-cover border-2 border-orange-200 flex-shrink-0" alt="preview" />
                                        : <div className="w-14 h-14 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0"><Upload size={20} className="text-orange-400" /></div>
                                    }
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">{fImg ? fImg.name : 'Tap to upload image'}</p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">JPG, PNG up to 5MB</p>
                                    </div>
                                    <input type="file" accept="image/*" className="hidden" onChange={onFImg} />
                                </label>
                            </div>
                            <div className="flex gap-3 pb-safe">
                                <button onClick={save} disabled={loading}
                                    className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-4 rounded-xl font-black text-sm active:scale-95 disabled:opacity-50 transition-all">
                                    {loading ? 'Saving...' : editing ? 'Update' : 'Add Product'}
                                </button>
                                <button onClick={() => { setShowForm(false); resetForm(); }}
                                    className="px-5 py-4 border-2 border-gray-200 text-gray-600 rounded-xl font-bold text-sm active:bg-gray-50 transition-all">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Grid */}
            {filteredProducts.length === 0 ? (
                <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
                    <Package size={44} className="mx-auto mb-3 opacity-30" />
                    <p className="font-semibold">No products yet</p>
                    <p className="text-sm mt-1">Tap "Add" to get started</p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredProducts.map((p, idx) => (
                        <ProductCard key={p._id} product={p} index={idx} onView={setSelected} onEdit={openEdit} onDelete={del} />
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
                    {filteredProducts.map(p => (
                        <div key={p._id} className="flex items-center gap-3 p-3 active:bg-orange-50/40 transition-colors">
                            {getImageUrl(p.image, null)
                                ? <img src={getImageUrl(p.image)} className="w-12 h-12 rounded-xl object-cover border flex-shrink-0" alt="" />
                                : <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0"><Package size={16} className="text-orange-300" /></div>
                            }
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-800 text-sm truncate">{p.name}</p>
                                <p className="font-black text-orange-600 text-sm">₹{p.price}</p>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                    p.stock > 5 ? 'bg-green-50 text-green-700' :
                                    p.stock > 0 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'
                                }`}>{p.stock > 0 ? `${p.stock} stock` : 'Out of stock'}</span>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                                <button onClick={() => setSelected(p)} className="p-2.5 active:bg-orange-100 rounded-xl"><Eye size={16} className="text-orange-600" /></button>
                                <button onClick={() => openEdit(p)} className="p-2.5 active:bg-blue-100 rounded-xl"><Edit2 size={16} className="text-blue-600" /></button>
                                <button onClick={() => del(p._id)} className="p-2.5 active:bg-red-100 rounded-xl"><Trash2 size={16} className="text-red-500" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});
ProductsPage.displayName = 'ProductsPage';

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────────
const TransactionsPage = memo(() => {
    const [txns, setTxns] = useState([]);
    const [selected, setSelected] = useState(null);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('all');
    const onSearch = useCallback(e => setSearch(e.target.value), []);

    useEffect(() => {
        api.getShopTransactions().then(r => setTxns(r.data)).catch(() => {});
    }, []);

    const filtered = useMemo(() => {
        let d = txns;
        if (search) {
            const q = search.toLowerCase();
            d = d.filter(t =>
                t.worker?.name?.toLowerCase().includes(q) ||
                t.product?.name?.toLowerCase().includes(q) ||
                t.coupon?.code?.toLowerCase().includes(q)
            );
        }
        if (filterType !== 'all') d = d.filter(t => t.discountPct?.toString() === filterType);
        return d;
    }, [txns, search, filterType]);

    const exportToCSV = () => {
        const data = filtered.map(t => ({
            'Product': t.product?.name,
            'Worker': t.worker?.name,
            'Worker ID': t.worker?.karigarId,
            'Coupon Code': t.coupon?.code,
            'Discount %': t.discountPct,
            'Discount Amount': t.discountAmount,
            'Final Price': t.finalPrice,
            'Date': new Date(t.createdAt).toLocaleString('en-IN'),
        }));
        if (!data.length) return;
        const headers = Object.keys(data[0]);
        const csv = [headers.join(','), ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Export complete!');
    };

    const discountTiers = [...new Set(txns.map(t => t.discountPct).filter(Boolean))].sort((a, b) => a - b);

    return (
        <div className="space-y-4">
            {/* Transaction Detail Modal */}
            {selected && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md overflow-y-auto max-h-[90vh]">
                        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-4 flex items-center justify-between rounded-t-3xl sm:rounded-t-3xl">
                            <h3 className="text-white font-black">Transaction Details</h3>
                            <button onClick={() => setSelected(null)} className="text-white/80 p-1"><X size={20} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            {getImageUrl(selected.productPhoto, null) && (
                                <img src={getImageUrl(selected.productPhoto)} onError={imgError()} className="w-full h-44 object-cover rounded-xl border shadow-sm" alt="" />
                            )}
                            <div className="flex items-center gap-3 bg-orange-50 rounded-xl p-3">
                                <img src={getImageUrl(selected.worker?.photo)} onError={imgError()} className="w-12 h-12 rounded-xl object-cover border-2 border-orange-100 flex-shrink-0" alt="" />
                                <div>
                                    <p className="font-black text-gray-800">{selected.worker?.name}</p>
                                    <p className="text-xs text-orange-600 font-mono">{selected.worker?.karigarId}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="bg-gray-50 rounded-xl p-3">
                                    <p className="font-black text-gray-700 text-sm">₹{selected.originalPrice}</p>
                                    <p className="text-[10px] text-gray-400">MRP</p>
                                </div>
                                <div className="bg-red-50 rounded-xl p-3">
                                    <p className="font-black text-red-500 text-sm">-₹{selected.discountAmount}</p>
                                    <p className="text-[10px] text-gray-400">{selected.discountPct}% OFF</p>
                                </div>
                                <div className="bg-green-50 rounded-xl p-3">
                                    <p className="font-black text-green-700 text-sm">₹{selected.finalPrice}</p>
                                    <p className="text-[10px] text-gray-400">Final Paid</p>
                                </div>
                            </div>
                            <div className="space-y-2 text-sm">
                                {[
                                    ['Product', selected.product?.name],
                                    ['Coupon Code', selected.coupon?.code],
                                    ['Date', new Date(selected.createdAt).toLocaleString('en-IN')],
                                ].map(([k, v]) => (
                                    <div key={k} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                                        <span className="text-gray-500 text-xs">{k}</span>
                                        <span className="font-semibold text-gray-800 font-mono text-xs text-right break-all ml-2">{v}</span>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => setSelected(null)}
                                className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm active:scale-95 transition-all">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-black text-gray-900">Transactions</h2>
                    <p className="text-xs text-gray-500">{txns.length} total sales</p>
                </div>
                <button onClick={exportToCSV}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border-2 border-gray-200 rounded-xl text-gray-600 text-xs font-semibold active:bg-gray-50 transition-all">
                    <Download size={14} /> Export
                </button>
            </div>

            {/* Search + Filter row */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        placeholder="Search..."
                        value={search}
                        onChange={onSearch}
                        className="w-full pl-9 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-50 focus:outline-none"
                    />
                </div>
                <select value={filterType} onChange={e => setFilterType(e.target.value)}
                    className="px-3 py-3 border-2 border-gray-200 rounded-xl text-sm bg-white max-w-[130px]">
                    <option value="all">All</option>
                    {discountTiers.map(tier => <option key={tier} value={tier}>{tier}% OFF</option>)}
                </select>
            </div>

            {/* Stats */}
            {txns.length > 0 && (
                <div className="grid grid-cols-2 gap-2.5">
                    {[
                        { label: 'Total Revenue', value: `₹${txns.reduce((s, t) => s + t.finalPrice, 0).toLocaleString()}`, icon: DollarSign },
                        { label: 'Total Discount', value: `₹${txns.reduce((s, t) => s + t.discountAmount, 0).toLocaleString()}`, icon: Percent },
                        { label: 'Avg Discount', value: `${Math.round(txns.reduce((s, t) => s + t.discountPct, 0) / txns.length)}%`, icon: Tag },
                        { label: 'Avg Transaction', value: `₹${Math.round(txns.reduce((s, t) => s + t.finalPrice, 0) / txns.length)}`, icon: ShoppingBag },
                    ].map(stat => (
                        <div key={stat.label} className="bg-white rounded-xl p-3 border border-gray-100 text-center">
                            <stat.icon size={13} className="text-orange-500 mx-auto mb-1" />
                            <p className="text-base font-black text-gray-800">{stat.value}</p>
                            <p className="text-[10px] text-gray-400">{stat.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* List */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
                    <History size={44} className="mx-auto mb-3 opacity-30" />
                    <p className="font-semibold">No transactions found</p>
                    <p className="text-sm mt-1">Coupon sales will appear here</p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {filtered.map((t, idx) => (
                        <TransactionCard key={t._id} transaction={t} index={idx} onClick={setSelected} />
                    ))}
                </div>
            )}
        </div>
    );
});
TransactionsPage.displayName = 'TransactionsPage';

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: PROFILE
// ─────────────────────────────────────────────────────────────────────────────
const ProfilePage = memo(({ shop, onUpdate }) => {
    const [fShopName, setFShopName] = useState(shop?.shopName || '');
    const [fOwnerName, setFOwnerName] = useState(shop?.ownerName || '');
    const [fAddress, setFAddress] = useState(shop?.address || '');
    const [fCity, setFCity] = useState(shop?.city || '');
    const [fPincode, setFPincode] = useState(shop?.pincode || '');
    const [fLocality, setFLocality] = useState(shop?.locality || '');
    const [fGst, setFGst] = useState(shop?.gstNumber || '');
    const [fCategory, setFCategory] = useState(shop?.category || '');
    const [fLogo, setFLogo] = useState(null);
    const [fLogoPreview, setFLogoPreview] = useState(null);
    const [fPhoto, setFPhoto] = useState(null);
    const [fPhotoPreview, setFPhotoPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (saved) {
            const timer = setTimeout(() => setSaved(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [saved]);

    const onLogo = useCallback(e => {
        const f = e.target.files[0];
        if (!f) return;
        setFLogo(f);
        setFLogoPreview(URL.createObjectURL(f));
    }, []);

    const onPhoto = useCallback(e => {
        const f = e.target.files[0];
        if (!f) return;
        setFPhoto(f);
        setFPhotoPreview(URL.createObjectURL(f));
    }, []);

    const save = useCallback(async () => {
        setLoading(true);
        try {
            const fd = new FormData();
            const fields = { shopName: fShopName, ownerName: fOwnerName, address: fAddress, city: fCity, pincode: fPincode, locality: fLocality, gstNumber: fGst, category: fCategory };
            Object.entries(fields).forEach(([k, v]) => fd.append(k, v || ''));
            if (fLogo) fd.append('shopLogo', fLogo);
            if (fPhoto) fd.append('ownerPhoto', fPhoto);
            await api.updateShopProfile(fd);
            toast.success('Profile updated!');
            setSaved(true);
            onUpdate();
        } catch { toast.error('Update failed.'); }
        finally { setLoading(false); }
    }, [fShopName, fOwnerName, fAddress, fCity, fPincode, fLocality, fGst, fCategory, fLogo, fPhoto, onUpdate]);

    const inputCls = "w-full border-2 border-gray-200 rounded-xl py-3.5 px-4 text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-50 focus:outline-none transition-all";
    const labelCls = "block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5";

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-black text-gray-900">Shop Profile</h2>
                <p className="text-xs text-gray-500 mt-0.5">Manage shop info and branding</p>
            </div>

            {/* Shop banner */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-4 flex items-center gap-4">
                {(fLogoPreview || getImageUrl(shop?.shopLogo, null)) ? (
                    <img src={fLogoPreview || getImageUrl(shop.shopLogo)} onError={imgError()} className="w-16 h-16 rounded-xl object-cover border-2 border-white/30 shadow-lg flex-shrink-0" alt="" />
                ) : (
                    <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Store size={28} className="text-white" />
                    </div>
                )}
                <div className="text-white min-w-0">
                    <p className="text-lg font-black truncate">{shop?.shopName}</p>
                    <p className="text-orange-100 text-xs">{shop?.category} · {shop?.city}</p>
                    <p className="text-orange-200 text-[10px] mt-0.5">{shop?.ownerName}</p>
                </div>
            </div>

            {/* Form */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                        ['Shop Name', fShopName, setFShopName],
                        ['Owner Name', fOwnerName, setFOwnerName],
                        ['City', fCity, setFCity],
                        ['Pincode', fPincode, setFPincode],
                        ['Category', fCategory, setFCategory],
                        ['GST Number', fGst, setFGst],
                    ].map(([label, val, setter]) => (
                        <div key={label}>
                            <label className={labelCls}>{label}</label>
                            <input value={val} onChange={e => setter(e.target.value)} className={inputCls} />
                        </div>
                    ))}
                    <div className="sm:col-span-2">
                        <label className={labelCls}>Full Address</label>
                        <input value={fAddress} onChange={e => setFAddress(e.target.value)} className={inputCls} />
                    </div>
                    <div className="sm:col-span-2">
                        <label className={labelCls}>Locality</label>
                        <input value={fLocality} onChange={e => setFLocality(e.target.value)} className={inputCls} />
                    </div>
                </div>

                {/* Photo uploads */}
                <div className="grid grid-cols-2 gap-3">
                    {[
                        ['Shop Logo', fLogo, fLogoPreview, onLogo],
                        ['Owner Photo', fPhoto, fPhotoPreview, onPhoto],
                    ].map(([label, file, preview, handler]) => (
                        <div key={label}>
                            <label className={labelCls}>{label}</label>
                            <label className="flex flex-col items-center gap-2 cursor-pointer border-2 border-dashed border-gray-200 rounded-xl p-3 active:bg-orange-50 transition-all text-center">
                                {preview
                                    ? <img src={preview} className="w-14 h-14 rounded-lg object-cover border-2 border-orange-200" alt="" />
                                    : <div className="w-14 h-14 bg-orange-50 rounded-lg flex items-center justify-center"><Upload size={18} className="text-orange-400" /></div>
                                }
                                <p className="text-[10px] font-medium text-gray-600">{file ? 'Change' : 'Upload'}</p>
                                <input type="file" accept="image/*" className="hidden" onChange={handler} />
                            </label>
                        </div>
                    ))}
                </div>

                <button onClick={save} disabled={loading}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-4 rounded-xl font-black active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md">
                    {loading
                        ? <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                        : saved
                            ? <><Check size={18} /> Saved!</>
                            : <><Shield size={18} /> Save Changes</>
                    }
                </button>
            </div>
        </div>
    );
});
ProfilePage.displayName = 'ProfilePage';

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
const ShopDashboard = () => {
    const navigate = useNavigate();
    const [page, setPage] = useState('analytics');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [shop, setShop] = useState(null);

    const loadShop = useCallback(() => {
        api.getShopProfile()
            .then(r => setShop(r.data))
            .catch(() => navigate('/login'));
    }, [navigate]);

    useEffect(() => { loadShop(); }, [loadShop]);

    const logout = useCallback(() => {
        ['shopToken', 'shop', 'shopRole'].forEach(k => localStorage.removeItem(k));
        toast.success('Logged out.');
        navigate('/login');
    }, [navigate]);

    const setPageCb = useCallback(p => { setPage(p); setSidebarOpen(false); }, []);

    const NAV = [
        { key: 'analytics', label: 'Analytics', icon: BarChart3 },
        { key: 'coupon', label: 'Coupon', icon: QrCode },
        { key: 'products', label: 'Products', icon: Package },
        { key: 'history', label: 'History', icon: History },
        { key: 'profile', label: 'Profile', icon: Settings },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        {/* Mobile hamburger for sidebar (desktop only, hidden on mobile since we use bottom nav) */}
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="hidden lg:flex p-2 rounded-lg hover:bg-gray-100 transition-all"
                        >
                            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
                        </button>
                        <div className="flex items-center gap-2.5">
                            {getImageUrl(shop?.shopLogo, null) ? (
                                <img
                                    src={getImageUrl(shop.shopLogo)}
                                    onError={imgError()}
                                    className="w-9 h-9 rounded-xl object-cover border border-orange-100"
                                    alt=""
                                />
                            ) : (
                                <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center">
                                    <Store size={18} className="text-white" />
                                </div>
                            )}
                            <div>
                                <p className="font-black text-gray-900 text-sm leading-tight">
                                    {shop?.shopName || 'Shop Dashboard'}
                                </p>
                                <p className="text-gray-400 text-[10px]">{shop?.category} · {shop?.city}</p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-red-600 font-semibold px-3 py-2 rounded-lg hover:bg-red-50 active:bg-red-100 transition-all"
                    >
                        <LogOut size={15} />
                        <span className="hidden sm:inline text-xs">Logout</span>
                    </button>
                </div>
            </header>

            <div className="flex flex-1">
                {/* Desktop Sidebar */}
                <aside className={`
                    hidden lg:block w-56 bg-white border-r border-gray-200 shadow-sm flex-shrink-0
                    sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto
                `}>
                    <nav className="p-3 space-y-1">
                        {NAV.map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                onClick={() => setPageCb(key)}
                                className={[
                                    'flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-semibold transition-all',
                                    page === key
                                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                                        : 'text-gray-600 hover:bg-orange-50 hover:text-orange-700',
                                ].join(' ')}
                            >
                                <Icon size={17} className={page === key ? 'text-white' : 'text-gray-400'} />
                                {label}
                            </button>
                        ))}
                        <div className="pt-4 mt-4 border-t border-gray-100">
                            <button
                                onClick={logout}
                                className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-all"
                            >
                                <LogOut size={17} className="text-red-400" />
                                Logout
                            </button>
                        </div>
                    </nav>
                </aside>

                {/* Main Content — add bottom padding for mobile nav */}
                <main className="flex-1 p-4 lg:p-7 min-w-0 overflow-auto pb-24 lg:pb-7">
                    {page === 'analytics' && <AnalyticsPage />}
                    {page === 'coupon' && <CouponPage />}
                    {page === 'products' && <ProductsPage />}
                    {page === 'history' && <TransactionsPage />}
                    {page === 'profile' && <ProfilePage shop={shop} onUpdate={loadShop} />}
                </main>
            </div>

            {/* ── MOBILE BOTTOM NAVIGATION ─────────────────────────────────── */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40 safe-area-bottom">
                <div className="flex items-stretch">
                    {NAV.map(({ key, label, icon: Icon }) => {
                        const isActive = page === key;
                        return (
                            <button
                                key={key}
                                onClick={() => setPageCb(key)}
                                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[60px] transition-all active:scale-95 relative ${
                                    isActive ? 'text-orange-600' : 'text-gray-400'
                                }`}
                            >
                                {isActive && (
                                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-orange-500 rounded-full" />
                                )}
                                <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-orange-50' : ''}`}>
                                    <Icon size={20} className={isActive ? 'text-orange-600' : 'text-gray-400'} />
                                </div>
                                <span className={`text-[10px] font-bold leading-none ${isActive ? 'text-orange-600' : 'text-gray-400'}`}>
                                    {label}
                                </span>
                            </button>
                        );
                    })}
                </div>
                {/* Safe area spacer for iPhones */}
                <div className="h-safe-area-inset-bottom bg-white" />
            </nav>
        </div>
    );
};

export default ShopDashboard;