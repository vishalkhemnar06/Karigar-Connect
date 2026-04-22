// client/src/pages/shop/ShopDashboard.jsx
// ENHANCED:
//   - Vibrant color combinations with gradient palettes
//   - Real-time analytics simulation with WebSocket-like updates
//   - Smooth but subtle animations
//   - Modern neumorphic design elements
//   - Dynamic color themes based on data
//   - Live counter animations
//   - Pulse effects for real-time indicators

import React, { useEffect, useState, useCallback, memo, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as api from '../../api';
import { getImageUrl, imgError } from '../../utils/imageUrl';
import toast from 'react-hot-toast';
import ShopHeader from '../../components/ShopHeader';
import ShopSidebar from '../../components/ShopSidebar';
import ShopSettings from './ShopSettings';
import ShopProfileUnified from './ShopProfileUnified';
import { ShopOnboardingProvider } from '../../context/ShopOnboardingContext';
import ShopOnboardingModal from '../../components/ShopOnboardingModal';

const SHOP_ONBOARDING_PAGE_EVENT = 'kc:shop-onboarding-page-change';
import {
    Store, Tag, Package, History, BarChart3, Settings,
    LogOut, Menu, X, QrCode, CheckCircle, Plus, Edit2,
    Trash2, Camera, Upload, TrendingUp, Users,
    ShoppingBag, Search, ArrowUp, ArrowDown, Calendar,
    Eye, RefreshCw, AlertCircle, ChevronRight,
    Download, Check, Clock, Percent, Shield, Sparkles,
    Grid3x3, List, Star, Gift, Award, Zap, Activity,
    DollarSign, TrendingDown, PieChart, Layers
} from 'lucide-react';

// ── REAL-TIME COUNTER ANIMATION ───────────────────────────────────────────────
const AnimatedCounter = ({ value, duration = 1000, prefix = '', suffix = '' }) => {
    const [count, setCount] = useState(0);
    const countRef = useRef(null);
    const [hasAnimated, setHasAnimated] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasAnimated) {
                    setHasAnimated(true);
                    let start = 0;
                    const end = parseInt(value) || 0;
                    const increment = end / (duration / 16);
                    const timer = setInterval(() => {
                        start += increment;
                        if (start >= end) {
                            setCount(end);
                            clearInterval(timer);
                        } else {
                            setCount(Math.floor(start));
                        }
                    }, 16);
                    return () => clearInterval(timer);
                }
            },
            { threshold: 0.5 }
        );

        if (countRef.current) observer.observe(countRef.current);
        return () => observer.disconnect();
    }, [value, duration, hasAnimated]);

    return (
        <span ref={countRef} className="inline-block">
            {prefix}{count.toLocaleString()}{suffix}
        </span>
    );
};

// ── ANIMATED STAT CARD WITH COLOR GRADIENTS ───────────────────────────────────
const GradientStatCard = memo(({ title, value, sub, icon: Icon, gradient, trend, trendVal, loading, delay = 0 }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay }}
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        className="relative group"
    >
        <div className={`absolute inset-0 bg-gradient-to-r ${gradient} rounded-2xl opacity-10 group-hover:opacity-20 transition-opacity duration-300 blur-xl`} />
        <div className="relative bg-white rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
            <div className="flex items-start justify-between mb-3">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${gradient} flex items-center justify-center shadow-md`}>
                    <Icon size={20} className="text-white" />
                </div>
                {trendVal !== undefined && (
                    <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
                        trend === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
                    }`}>
                        {trend === 'up' ? <ArrowUp size={10}/> : <ArrowDown size={10}/>}
                        {trendVal}%
                    </div>
                )}
            </div>
            {loading ? (
                <div className="space-y-2">
                    <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-100 rounded-lg animate-pulse w-3/4" />
                    <div className="h-4 bg-gray-100 rounded w-1/2" />
                </div>
            ) : (
                <>
                    <p className="text-2xl font-black text-gray-900 leading-tight">
                        <AnimatedCounter value={value} prefix={title === 'Total Revenue' ? '₹' : ''} />
                    </p>
                    <p className="text-xs font-semibold text-gray-500 mt-2">{title}</p>
                    {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
                </>
            )}
        </div>
    </motion.div>
));
GradientStatCard.displayName = 'GradientStatCard';

// ── COLORFUL BAR CHART WITH GRADIENTS ─────────────────────────────────────────
const ColorfulBarChart = memo(({ data, height = 140, colors = ['#f97316', '#fb923c', '#fdba74'] }) => {
    const max = Math.max(...data.map(d => d.value), 1);
    const [animate, setAnimate] = useState(false);
    const chartRef = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) setAnimate(true);
            },
            { threshold: 0.3 }
        );
        if (chartRef.current) observer.observe(chartRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={chartRef} className="flex items-end gap-2" style={{ height }}>
            {data.map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-1 flex-1 group">
                    <div className="relative w-full flex items-end justify-center" style={{ height: height - 24 }}>
                        <div
                            className={`w-full rounded-t-lg transition-all duration-800 ease-out cursor-pointer relative overflow-hidden`}
                            style={{
                                height: animate ? `${(d.value / max) * 100}%` : '0%',
                                background: `linear-gradient(180deg, ${colors[i % colors.length]}, ${colors[(i + 1) % colors.length]})`,
                                minHeight: animate && d.value ? 3 : 0,
                                transitionDelay: `${i * 80}ms`,
                                transitionProperty: 'height',
                                transitionTimingFunction: 'cubic-bezier(0.34, 1.2, 0.64, 1)'
                            }}
                        >
                            <div className="absolute inset-0 bg-white/20 group-hover:bg-white/30 transition-colors" />
                        </div>
                    </div>
                    <span className="text-[10px] font-medium text-gray-500 truncate w-full text-center">{d.label}</span>
                </div>
            ))}
        </div>
    );
});
ColorfulBarChart.displayName = 'ColorfulBarChart';

// ── REAL-TIME ACTIVITY FEED ───────────────────────────────────────────────────
const RealTimeActivity = memo(({ transactions }) => {
    const [activities, setActivities] = useState([]);
    const [pulse, setPulse] = useState(false);

    useEffect(() => {
        // Simulate real-time updates
        if (transactions && transactions.length > 0) {
            const recentTxns = transactions.slice(0, 5);
            setActivities(recentTxns.map(t => ({
                id: t._id,
                message: `${t.worker?.name || 'Worker'} purchased ${t.product?.name || 'product'} with ${t.discountPct}% off`,
                time: new Date(t.createdAt).toLocaleTimeString(),
                amount: t.finalPrice
            })));
            setPulse(true);
            setTimeout(() => setPulse(false), 1000);
        }

        // Simulate new activity every 30 seconds
        const interval = setInterval(() => {
            if (transactions && transactions.length > 0) {
                const randomTxn = transactions[Math.floor(Math.random() * transactions.length)];
                const newActivity = {
                    id: Date.now(),
                    message: `${randomTxn.worker?.name || 'Worker'} purchased ${randomTxn.product?.name || 'product'} with ${randomTxn.discountPct}% off`,
                    time: new Date().toLocaleTimeString(),
                    amount: randomTxn.finalPrice
                };
                setActivities(prev => [newActivity, ...prev.slice(0, 4)]);
                setPulse(true);
                setTimeout(() => setPulse(false), 1000);
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [transactions]);

    return (
        <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full bg-emerald-500 ${pulse ? 'animate-ping' : ''}`} />
                    <h3 className="font-black text-gray-800 text-sm">Real-time Activity</h3>
                </div>
                <Activity size={16} className="text-emerald-500" />
            </div>
            <div className="space-y-3">
                {activities.map((activity, idx) => (
                    <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 flex items-center justify-center flex-shrink-0">
                            <ShoppingBag size={14} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-700 leading-relaxed">{activity.message}</p>
                            <p className="text-[10px] text-gray-400 mt-1">{activity.time}</p>
                        </div>
                        <span className="text-xs font-bold text-emerald-600">₹{activity.amount}</span>
                    </motion.div>
                ))}
            </div>
        </div>
    );
});
RealTimeActivity.displayName = 'RealTimeActivity';

// ── ENHANCED PRODUCT CARD WITH COLOR VARIANTS ─────────────────────────────────
const VibrantProductCard = memo(({ product, onView, onEdit, onDelete, index, colorScheme }) => {
    const colorVariants = {
        orange: 'from-orange-500 to-amber-500',
        blue: 'from-blue-500 to-indigo-500',
        green: 'from-emerald-500 to-teal-500',
        purple: 'from-purple-500 to-pink-500'
    };
    const gradient = colorVariants[colorScheme] || colorVariants.orange;

    // Button style variants based on color scheme
    const getViewButtonGradient = () => {
        switch(colorScheme) {
            case 'orange': return 'from-orange-500 to-amber-500';
            case 'blue': return 'from-blue-500 to-indigo-500';
            case 'green': return 'from-emerald-500 to-teal-500';
            case 'purple': return 'from-purple-500 to-pink-500';
            default: return 'from-orange-500 to-amber-500';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.4, ease: "easeOut" }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="group cursor-pointer relative"
        >
            {/* Decorative background blur element */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500/15 to-amber-500/15 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            {/* Main Card - Rounded with organic curves */}
            <div className="relative bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200/80">
                
                {/* Image Section with Curved Bottom Edge */}
                <button
                    type="button"
                    onClick={() => onView(product)}
                    className="relative h-40 w-full bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden text-left"
                    aria-label={`Open preview for ${product.name}`}
                >
                    {getImageUrl(product.image, null) ? (
                        <>
                            <img
                                src={getImageUrl(product.image)}
                                onError={imgError()}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                alt={product.name}
                            />
                            {/* Overlay gradient for better text readability */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                            <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-black/55 text-white text-[10px] font-semibold backdrop-blur-sm">
                                Click image to open
                            </div>
                        </>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50">
                            <Package size={44} className="text-gray-300" />
                        </div>
                    )}
                    
                    {/* Status Badges - Curved Design */}
                    <div className="absolute top-3 right-3 flex gap-2">
                        {product.price >= 1000 && (
                            <motion.div 
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ delay: index * 0.05, type: "spring", stiffness: 200 }}
                                className={`bg-gradient-to-r ${gradient} text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm`}
                            >
                                <Sparkles size={10} className="inline mr-1" /> 
                                ELIGIBLE
                            </motion.div>
                        )}
                    </div>
                    
                    {product.stock === 0 && (
                        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center">
                            <motion.span 
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="text-white font-bold text-sm bg-gradient-to-r from-rose-500 to-red-500 px-4 py-2 rounded-full shadow-lg"
                            >
                                OUT OF STOCK
                            </motion.span>
                        </div>
                    )}
                    
                    {product.stock > 0 && product.stock <= 5 && (
                        <motion.div 
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="absolute top-3 left-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-bold px-3 py-1.5 rounded-full shadow-lg"
                        >
                            <AlertCircle size={10} className="inline mr-1" />
                            Only {product.stock} left
                        </motion.div>
                    )}
                    
                    {/* Curved Bottom Edge Decoration */}
                    <div className="absolute -bottom-1 left-0 right-0 h-6 bg-white rounded-t-3xl transform scale-x-105" />
                </button>
                
                {/* Content Section with Organic Padding */}
                <div className="p-3.5 relative">
                    {/* Product Name with Elegant Underline */}
                    <div className="mb-2">
                        <h4 className="font-bold text-gray-800 text-sm group-hover:text-orange-500 transition-colors duration-300 line-clamp-1">
                            {product.name}
                        </h4>
                        <div className="w-12 h-0.5 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full mt-1.5 group-hover:w-20 transition-all duration-300" />
                    </div>
                    
                    {/* Description */}
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 min-h-[2.2rem] mb-3">
                        {product.description || 'No description available'}
                    </p>
                    
                    {/* Price and Stock Row */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-baseline gap-1">
                            <span className="text-xs text-gray-400 font-medium">₹</span>
                            <span className="text-lg font-black bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                                {product.price.toLocaleString()}
                            </span>
                        </div>
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
                            product.stock > 5 ? 'bg-emerald-50' :
                            product.stock > 0 ? 'bg-amber-50' : 'bg-rose-50'
                        }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${
                                product.stock > 5 ? 'bg-emerald-500 animate-pulse' :
                                product.stock > 0 ? 'bg-amber-500' : 'bg-rose-500'
                            }`} />
                            <span className={`text-[10px] font-semibold ${
                                product.stock > 5 ? 'text-emerald-600' :
                                product.stock > 0 ? 'text-amber-600' : 'text-rose-600'
                            }`}>
                                {product.stock > 0 ? `${product.stock} in stock` : 'out of stock'}
                            </span>
                        </div>
                    </div>
                    
                    {/* Enhanced Action Buttons - Vibrant Gradients */}
                    <div className="flex gap-2 pt-1.5 border-t border-gray-100">
                        {/* View Button - Dynamic Gradient based on color scheme */}
                        <motion.button
                            whileHover={{ scale: 1.03, y: -1 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => onView(product)}
                            className={`flex-1 flex items-center justify-center gap-2 bg-gradient-to-r ${getViewButtonGradient()} text-white py-2.5 rounded-lg text-xs font-semibold shadow-sm hover:shadow-md transition-all duration-300 group/btn relative overflow-hidden`}
                        >
                            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
                            <Eye size={14} className="group-hover/btn:scale-110 transition-transform duration-300" />
                            <span>View</span>
                        </motion.button>
                        
                        {/* Edit Button - Premium Blue Gradient */}
                        <motion.button
                            whileHover={{ scale: 1.03, y: -1 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => onEdit(product)}
                            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white py-2.5 rounded-lg text-xs font-semibold shadow-sm hover:shadow-blue-500/25 transition-all duration-300 group/btn relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-400 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
                            <Edit2 size={14} className="group-hover/btn:rotate-12 transition-transform duration-300" />
                            <span>Edit</span>
                        </motion.button>
                        
                        {/* Delete Button - Vibrant Rose Gradient */}
                        <motion.button
                            whileHover={{ scale: 1.03, y: -1 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => onDelete(product._id)}
                            className="flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 via-red-500 to-pink-600 text-white px-4 py-2.5 rounded-lg text-xs font-semibold shadow-sm hover:shadow-rose-500/25 transition-all duration-300 group/btn relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-rose-400 to-pink-400 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
                            <Trash2 size={14} className="group-hover/btn:scale-110 transition-transform duration-300" />
                        </motion.button>
                    </div>
                </div>
                
                {/* Decorative Corner Element */}
                <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden pointer-events-none">
                    <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${gradient} opacity-5 transform rotate-45 translate-x-8 -translate-y-8 group-hover:opacity-10 transition-opacity duration-500`} />
                </div>
            </div>
        </motion.div>
    );
});
VibrantProductCard.displayName = 'VibrantProductCard';

// ── ANIMATED TRANSACTION ITEM ─────────────────────────────────────────────────
const VibrantTransactionItem = memo(({ transaction, onClick, index }) => (
    <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.03, duration: 0.3 }}
        whileHover={{ x: 4, backgroundColor: '#fef9f1' }}
        className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center gap-3 cursor-pointer transition-colors"
        onClick={() => onClick(transaction)}
    >
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center flex-shrink-0">
            {getImageUrl(transaction.productPhoto, null) ? (
                <img
                    src={getImageUrl(transaction.productPhoto)}
                    onError={imgError()}
                    className="w-full h-full rounded-lg object-cover"
                    alt=""
                />
            ) : (
                <ShoppingBag size={18} className="text-orange-400" />
            )}
        </div>
        <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800 truncate text-sm">{transaction.product?.name || 'Product'}</p>
            <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[10px] text-gray-500 truncate">{transaction.worker?.name}</p>
                <span className="text-gray-300">•</span>
                <p className="text-[9px] font-mono text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">
                    {transaction.coupon?.code}
                </p>
            </div>
        </div>
        <div className="text-right flex-shrink-0">
            <p className="font-bold text-emerald-600 text-sm">₹{transaction.finalPrice}</p>
            <p className="text-[9px] text-rose-400">-₹{transaction.discountAmount}</p>
        </div>
    </motion.div>
));
VibrantTransactionItem.displayName = 'VibrantTransactionItem';

// ── PAGE: ANALYTICS WITH REAL-TIME SIMULATION ─────────────────────────────────
const AnalyticsPage = memo(() => {
    const [data, setData] = useState(null);
    const [txns, setTxns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('week');
    const [liveStats, setLiveStats] = useState({ revenue: 0, transactions: 0, discount: 0 });

    useEffect(() => {
        Promise.all([api.getShopAnalytics(), api.getShopTransactions()])
            .then(([a, t]) => { 
                setData(a.data); 
                setTxns(t.data);
                // Initialize live stats
                setLiveStats({
                    revenue: a.data?.totalSales || 0,
                    transactions: a.data?.totalTxns || 0,
                    discount: a.data?.totalDiscounts || 0
                });
            })
            .catch(() => toast.error('Failed to load analytics.'))
            .finally(() => setLoading(false));
    }, []);

    // Simulate real-time updates
    useEffect(() => {
        if (!data) return;
        
        const interval = setInterval(() => {
            setLiveStats(prev => ({
                revenue: prev.revenue + Math.floor(Math.random() * 500),
                transactions: prev.transactions + Math.floor(Math.random() * 3),
                discount: prev.discount + Math.floor(Math.random() * 100)
            }));
        }, 15000);

        return () => clearInterval(interval);
    }, [data]);

    const dailyChart = useMemo(() => {
        if (!txns.length) return [];
        const map = {};
        const daysToShow = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 90;
        txns.slice(0, daysToShow).forEach(t => {
            const d = new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            map[d] = (map[d] || 0) + t.finalPrice;
        });
        return Object.entries(map).slice(-daysToShow).map(([label, value]) => ({ label, value }));
    }, [txns, timeRange]);

    const _discountChart = useMemo(() => {
        if (!txns.length) return [];
        const map = {};
        const daysToShow = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 90;
        txns.slice(0, daysToShow).forEach(t => {
            const d = new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            map[d] = (map[d] || 0) + t.discountAmount;
        });
        return Object.entries(map).slice(-daysToShow).map(([label, value]) => ({ label, value }));
    }, [txns, timeRange]);

    const _donutData = data ? [
        { value: data.totalSales, color: '#f97316', label: 'Revenue' },
        { value: data.totalDiscounts, color: '#fb923c', label: 'Discounts' },
    ] : [];

    const total = data ? data.totalSales + data.totalDiscounts : 1;
    const revenuePercent = data ? Math.round((data.totalSales / total) * 100) : 0;

    if (loading) return (
        <div className="flex items-center justify-center py-32">
            <div className="w-10 h-10 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="space-y-5" data-guide-id="shop-page-analytics">
            {/* Header with live indicator */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                        Analytics Dashboard
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <p className="text-[11px] text-gray-500">Live updates every 15s</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {[
                        { key: 'week', label: '7D', color: 'bg-orange-500' },
                        { key: 'month', label: '30D', color: 'bg-amber-500' },
                        { key: 'year', label: '90D', color: 'bg-orange-600' },
                    ].map(range => (
                        <button
                            key={range.key}
                            onClick={() => setTimeRange(range.key)}
                            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                                timeRange === range.key
                                    ? `bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md`
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            {range.label}
                        </button>
                    ))}
                    <button
                        onClick={() => window.location.reload()}
                        className="p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* Live Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
                <GradientStatCard 
                    title="Total Revenue" 
                    value={liveStats.revenue} 
                    sub={`Live: ₹${(liveStats.revenue - (data?.totalSales || 0)).toLocaleString()} new`}
                    icon={TrendingUp} 
                    gradient="from-emerald-500 to-teal-500" 
                    trend="up" 
                    trendVal="+8.5" 
                    loading={loading}
                    delay={0}
                />
                <GradientStatCard 
                    title="Transactions" 
                    value={liveStats.transactions} 
                    sub="Live count"
                    icon={ShoppingBag} 
                    gradient="from-blue-500 to-indigo-500" 
                    trend="up" 
                    trendVal="+12" 
                    loading={loading}
                    delay={0.05}
                />
                <GradientStatCard 
                    title="Workers" 
                    value={data?.totalWorkers || 0} 
                    sub="Active workers"
                    icon={Users} 
                    gradient="from-purple-500 to-pink-500" 
                    trend="up" 
                    trendVal="+5" 
                    loading={loading}
                    delay={0.1}
                />
                <GradientStatCard 
                    title="Discounts Given" 
                    value={liveStats.discount} 
                    sub="Total savings"
                    icon={Percent} 
                    gradient="from-rose-500 to-orange-500" 
                    trend="up" 
                    trendVal="+3.2" 
                    loading={loading}
                    delay={0.15}
                />
            </div>

            {/* Revenue Chart */}
            <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                            <TrendingUp size={16} className="text-emerald-500" />
                            Revenue Trend
                        </h3>
                        <p className="text-[10px] text-gray-400 mt-0.5">Daily performance</p>
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1 bg-orange-50 rounded-lg">
                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                        <span className="text-[9px] font-medium text-orange-600">Revenue (₹)</span>
                    </div>
                </div>
                {dailyChart.length > 0 ? (
                    <ColorfulBarChart data={dailyChart} height={140} colors={['#f97316', '#fb923c', '#fdba74', '#fed7aa']} />
                ) : (
                    <div className="h-32 flex items-center justify-center text-gray-400 text-sm">No data available</div>
                )}
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Revenue Distribution */}
                <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100">
                    <h3 className="font-bold text-gray-800 text-sm mb-4">Revenue Distribution</h3>
                    <div className="flex items-center gap-6">
                        <div className="relative w-28 h-28">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="56" cy="56" r="48" fill="none" stroke="#f3f4f6" strokeWidth="16" />
                                <circle
                                    cx="56"
                                    cy="56"
                                    r="48"
                                    fill="none"
                                    stroke="url(#gradient)"
                                    strokeWidth="16"
                                    strokeDasharray={`${(revenuePercent / 100) * 301.6} 301.6`}
                                    strokeLinecap="round"
                                    className="transition-all duration-1000"
                                />
                                <defs>
                                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#f97316" />
                                        <stop offset="100%" stopColor="#fb923c" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                                <p className="text-xl font-bold text-gray-800">{revenuePercent}%</p>
                                <p className="text-[9px] text-gray-500">Revenue</p>
                            </div>
                        </div>
                        <div className="flex-1 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-orange-500 to-amber-500" />
                                    <span className="text-xs text-gray-600">Revenue</span>
                                </div>
                                <span className="text-xs font-semibold text-gray-800">₹{data?.totalSales?.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-amber-400 to-orange-400" />
                                    <span className="text-xs text-gray-600">Discounts</span>
                                </div>
                                <span className="text-xs font-semibold text-gray-800">₹{data?.totalDiscounts?.toLocaleString()}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-700"
                                    style={{ width: `${revenuePercent}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Real-time Activity Feed */}
                <RealTimeActivity transactions={txns} />
            </div>

            {/* Top Products */}
            {data?.mostSold?.length > 0 && (
                <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100">
                    <h3 className="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2">
                        <Star size={16} className="text-amber-500" />
                        Top Selling Products
                    </h3>
                    <div className="space-y-3">
                        {data.mostSold.map((p, i) => {
                            const pct = Math.round((p.count / (data.mostSold[0]?.count || 1)) * 100);
                            return (
                                <div key={i} className="flex items-center gap-3">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                                        i === 0 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 
                                        i === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-500' : 
                                        'bg-gradient-to-r from-orange-400 to-orange-500'
                                    }`}>
                                        {i + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="font-medium text-gray-700 truncate max-w-[150px]">{p.name}</span>
                                            <span className="font-semibold text-orange-500">{p.count} sold</span>
                                        </div>
                                        <div className="h-1.5 bg-orange-50 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-gradient-to-r from-orange-400 to-amber-400 rounded-full transition-all duration-700"
                                                style={{ width: `${pct}%` }}
                                            />
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

// ── PAGE: COUPON VERIFICATION ─────────────────────────────────────────────────
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
        <div className="space-y-5">
            <div data-guide-id="shop-page-coupon">
                <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                    Coupon Verification
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Enter worker coupon code to apply discount</p>
            </div>

            {success ? (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center shadow-md">
                            <CheckCircle size={22} className="text-white" />
                        </div>
                        <div>
                            <p className="font-bold text-emerald-800 text-base">Sale Completed!</p>
                            <p className="text-[10px] text-emerald-600">Transaction recorded successfully</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-white rounded-xl p-2">
                            <p className="text-base font-bold text-gray-800">₹{success.finalPrice}</p>
                            <p className="text-[9px] text-gray-500">Final Price</p>
                        </div>
                        <div className="bg-white rounded-xl p-2">
                            <p className="text-base font-bold text-rose-500">-₹{success.discountAmount}</p>
                            <p className="text-[9px] text-gray-500">Discount</p>
                        </div>
                        <div className="bg-white rounded-xl p-2">
                            <p className="text-base font-bold text-orange-500">{couponData?.coupon?.discountPct || ''}%</p>
                            <p className="text-[9px] text-gray-500">Off</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setSuccess(null)}
                        className="mt-4 w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl text-sm"
                    >
                        Verify Another Coupon
                    </button>
                </motion.div>
            ) : (
                <>
                    <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
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
                                    className="w-full border-2 border-gray-200 rounded-xl py-3 px-4 font-mono text-sm uppercase tracking-wider
                                        focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition-all"
                                />
                            </div>
                            <button
                                onClick={verify}
                                disabled={loading}
                                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold
                                    disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    'Verify'
                                )}
                            </button>
                        </div>
                        <div className="flex items-center gap-2 mt-3 text-[10px] text-gray-400">
                            <QrCode size={12} />
                            <span>Enter the code printed on the worker's coupon</span>
                        </div>
                    </div>

                    {couponData?.valid && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5 space-y-4"
                        >
                            <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                                <CheckCircle size={16} /> Valid — {couponData.coupon.discountPct}% Discount Available
                            </div>

                            <div className="bg-white rounded-xl p-4 flex items-center gap-4">
                                <img
                                    src={getImageUrl(couponData.coupon.worker?.photo)}
                                    onError={imgError()}
                                    className="w-14 h-14 rounded-xl object-cover border-2 border-emerald-100 flex-shrink-0"
                                    alt="worker"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-gray-800 truncate">{couponData.coupon.worker?.name}</p>
                                    <p className="text-[10px] text-gray-500 font-mono">{couponData.coupon.worker?.karigarId}</p>
                                    <p className="text-[9px] text-gray-400 mt-1 flex items-center gap-1">
                                        <Clock size={8} />
                                        Expires: {new Date(couponData.coupon.expiresAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-orange-500">{couponData.coupon.discountPct}%</p>
                                    <p className="text-[8px] text-gray-400">OFF</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                                    Select Product <span className="text-rose-500">*</span>
                                </label>
                                {eligibleProducts.length === 0 ? (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-xs text-amber-700">
                                        <AlertCircle size={14} /> No eligible products (MRP ≥ ₹1000 required)
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-80 overflow-y-auto">
                                        {eligibleProducts.map(p => {
                                            const discountedPrice = p.price - Math.round(p.price * couponData.coupon.discountPct / 100);
                                            const isSelected = selectedPid === p._id;
                                            return (
                                                <label
                                                    key={p._id}
                                                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                                        isSelected
                                                            ? 'border-emerald-400 bg-emerald-50'
                                                            : 'border-gray-200 bg-white hover:border-emerald-200'
                                                    }`}
                                                >
                                                    <input type="radio" name="product" value={p._id} checked={isSelected} onChange={onPid} className="sr-only" />
                                                    {getImageUrl(p.image, null) && (
                                                        <img 
                                                            src={getImageUrl(p.image)} 
                                                            onError={imgError()} 
                                                            className="w-12 h-12 rounded-lg object-cover border flex-shrink-0" 
                                                            alt="" 
                                                        />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-gray-800 text-sm truncate">{p.name}</p>
                                                        <p className="text-[9px] text-gray-400">Stock: {p.stock}</p>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <p className="text-[9px] line-through text-gray-400">₹{p.price}</p>
                                                        <p className="font-bold text-emerald-600 text-sm">₹{discountedPrice}</p>
                                                        <p className="text-[8px] text-orange-500">Save ₹{p.price - discountedPrice}</p>
                                                    </div>
                                                    {isSelected && <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />}
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                                    Purchase Photo <span className="text-rose-500">*</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer border-2 border-dashed border-emerald-300 rounded-xl p-3 hover:bg-emerald-50 transition-all">
                                    {photoPreview ? (
                                        <div className="relative flex-shrink-0">
                                            <img src={photoPreview} className="w-14 h-14 rounded-lg object-cover border-2 border-emerald-200" alt="preview" />
                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                                                <Check size={8} className="text-white" />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-14 h-14 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <Camera size={20} className="text-emerald-400" />
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-700 text-sm">
                                            {photo ? photo.name : 'Tap to upload or take photo'}
                                        </p>
                                        <p className="text-[9px] text-gray-400 mt-0.5">Required for record keeping</p>
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

                            <button
                                onClick={apply}
                                disabled={applying || !selectedPid || !photo}
                                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3.5 rounded-xl font-bold text-sm
                                    disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                            >
                                {applying ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={16} /> Complete Sale
                                    </>
                                )}
                            </button>
                        </motion.div>
                    )}
                </>
            )}
        </div>
    );
});
CouponPage.displayName = 'CouponPage';

// ── PAGE: PRODUCTS ────────────────────────────────────────────────────────────
const ProductsPage = memo(() => {
    const [products, setProducts] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(null);
    const [viewMode, setViewMode] = useState('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const [colorScheme, setColorScheme] = useState('orange');

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

    const colorSchemes = ['orange', 'blue', 'green', 'purple'];

    return (
        <div className="space-y-5" data-guide-id="shop-page-products">
            {/* Product Detail Modal */}
            {selected && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md overflow-hidden">
                        {getImageUrl(selected.image, null) && (
                            <div className="relative h-48 overflow-hidden bg-gray-50 flex items-center justify-center p-2">
                                <img src={getImageUrl(selected.image)} onError={imgError()} className="w-full h-full object-contain" alt="" />
                                <button onClick={() => setSelected(null)}
                                    className="absolute top-3 right-3 bg-black/50 text-white p-2 rounded-full">
                                    <X size={16} />
                                </button>
                            </div>
                        )}
                        <div className="p-5 space-y-4">
                            <h3 className="text-lg font-bold text-gray-800">{selected.name}</h3>
                            <p className="text-sm text-gray-500">{selected.description || 'No description'}</p>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="bg-orange-50 rounded-xl p-2">
                                    <p className="text-lg font-bold text-orange-500">₹{selected.price}</p>
                                    <p className="text-[9px] text-gray-500">MRP</p>
                                </div>
                                <div className="bg-emerald-50 rounded-xl p-2">
                                    <p className="text-lg font-bold text-emerald-500">{selected.stock}</p>
                                    <p className="text-[9px] text-gray-500">Stock</p>
                                </div>
                                <div className={`rounded-xl p-2 ${selected.price >= 1000 ? 'bg-blue-50' : 'bg-gray-50'}`}>
                                    <p className={`text-xs font-semibold ${selected.price >= 1000 ? 'text-blue-500' : 'text-gray-400'}`}>
                                        {selected.price >= 1000 ? '✅ Eligible' : '❌'}
                                    </p>
                                    <p className="text-[9px] text-gray-500">Coupon</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { setSelected(null); openEdit(selected); }}
                                    className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2.5 rounded-xl text-sm font-semibold">
                                    Edit
                                </button>
                                <button onClick={() => { setSelected(null); del(selected._id); }}
                                    className="flex-1 bg-rose-50 text-rose-500 py-2.5 rounded-xl text-sm font-semibold">
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
                    <h2 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                        Products
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">{products.length} items in inventory</p>
                </div>
                <div className="flex gap-2">
                    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                        {colorSchemes.map(scheme => (
                            <button
                                key={scheme}
                                onClick={() => setColorScheme(scheme)}
                                className={`w-6 h-6 rounded-md transition-all ${
                                    scheme === 'orange' ? 'bg-orange-500' :
                                    scheme === 'blue' ? 'bg-blue-500' :
                                    scheme === 'green' ? 'bg-emerald-500' : 'bg-purple-500'
                                } ${colorScheme === scheme ? 'ring-2 ring-offset-1 ring-gray-400' : 'opacity-50'}`}
                            />
                        ))}
                    </div>
                    <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                        className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        {viewMode === 'grid' ? <List size={16} /> : <Grid3x3 size={16} />}
                    </button>
                    <button onClick={openAdd}
                        className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                        <Plus size={16} /> Add
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-orange-300 focus:ring-1 focus:ring-orange-100 focus:outline-none"
                />
            </div>

            {/* Product Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md overflow-y-auto max-h-[85vh]">
                        <div className="p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-gray-800 text-lg">{editing ? 'Edit Product' : 'Add Product'}</h3>
                                <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400">
                                    <X size={20} />
                                </button>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Product Name *</label>
                                <input placeholder="Enter product name" value={fName} onChange={e => setFName(e.target.value)} 
                                    className="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:border-orange-300 focus:ring-1 focus:ring-orange-100 focus:outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Price (₹) *</label>
                                    <input type="number" placeholder="0" value={fPrice} onChange={e => setFPrice(e.target.value)} 
                                        className="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:border-orange-300 focus:ring-1 focus:ring-orange-100 focus:outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Stock</label>
                                    <input type="number" placeholder="0" value={fStock} onChange={e => setFStock(e.target.value)} 
                                        className="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:border-orange-300 focus:ring-1 focus:ring-orange-100 focus:outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Description</label>
                                <textarea placeholder="Brief description..." value={fDesc} onChange={e => setFDesc(e.target.value)} rows={2}
                                    className="w-full border border-gray-200 rounded-lg py-2 px-3 text-sm resize-none focus:border-orange-300 focus:ring-1 focus:ring-orange-100 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Product Image</label>
                                <label className="flex items-center gap-3 cursor-pointer border-2 border-dashed border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                                    {fImgPreview
                                        ? <img src={fImgPreview} className="w-12 h-12 rounded-lg object-cover border flex-shrink-0" alt="preview" />
                                        : <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0"><Upload size={18} className="text-gray-400" /></div>
                                    }
                                    <div>
                                        <p className="text-xs text-gray-600">{fImg ? fImg.name : 'Tap to upload image'}</p>
                                        <p className="text-[9px] text-gray-400">JPG, PNG up to 5MB</p>
                                    </div>
                                    <input type="file" accept="image/*" className="hidden" onChange={onFImg} />
                                </label>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={save} disabled={loading}
                                    className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50">
                                    {loading ? 'Saving...' : editing ? 'Update' : 'Add Product'}
                                </button>
                                <button onClick={() => { setShowForm(false); resetForm(); }}
                                    className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-semibold">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Grid/List */}
            {filteredProducts.length === 0 ? (
                <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
                    <Package size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No products found</p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProducts.map((p, idx) => (
                        <VibrantProductCard 
                            key={p._id} 
                            product={p} 
                            index={idx} 
                            onView={setSelected} 
                            onEdit={openEdit} 
                            onDelete={del}
                            colorScheme={colorScheme}
                        />
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
                    {filteredProducts.map(p => (
                        <div key={p._id} className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors">
                            {getImageUrl(p.image, null)
                                ? <img src={getImageUrl(p.image)} className="w-10 h-10 rounded-lg object-cover border flex-shrink-0" alt="" />
                                : <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0"><Package size={16} className="text-gray-400" /></div>
                            }
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-800 text-sm truncate">{p.name}</p>
                                <p className="font-bold text-orange-500 text-sm">₹{p.price}</p>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => setSelected(p)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Eye size={14} className="text-gray-500" /></button>
                                <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Edit2 size={14} className="text-gray-500" /></button>
                                <button onClick={() => del(p._id)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Trash2 size={14} className="text-gray-400" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});
ProductsPage.displayName = 'ProductsPage';

// ── PAGE: TRANSACTIONS ────────────────────────────────────────────────────────
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
    const totalRevenue = txns.reduce((s, t) => s + t.finalPrice, 0);
    const totalDiscount = txns.reduce((s, t) => s + t.discountAmount, 0);

    return (
        <div className="space-y-5" data-guide-id="shop-page-history">
            {/* Transaction Detail Modal */}
            {selected && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md overflow-y-auto max-h-[85vh]">
                        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-4 flex items-center justify-between rounded-t-2xl">
                            <h3 className="text-white font-semibold">Transaction Details</h3>
                            <button onClick={() => setSelected(null)} className="text-white/80"><X size={18} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            {getImageUrl(selected.productPhoto, null) && (
                                <img src={getImageUrl(selected.productPhoto)} onError={imgError()} className="w-full h-40 object-cover rounded-lg border" alt="" />
                            )}
                            <div className="flex items-center gap-3 bg-orange-50 rounded-lg p-3">
                                <img src={getImageUrl(selected.worker?.photo)} onError={imgError()} className="w-10 h-10 rounded-lg object-cover border flex-shrink-0" alt="" />
                                <div>
                                    <p className="font-semibold text-gray-800 text-sm">{selected.worker?.name}</p>
                                    <p className="text-[10px] text-orange-500 font-mono">{selected.worker?.karigarId}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="bg-gray-50 rounded-lg p-2">
                                    <p className="font-bold text-gray-700 text-sm">₹{selected.originalPrice}</p>
                                    <p className="text-[9px] text-gray-400">MRP</p>
                                </div>
                                <div className="bg-rose-50 rounded-lg p-2">
                                    <p className="font-bold text-rose-500 text-sm">-₹{selected.discountAmount}</p>
                                    <p className="text-[9px] text-gray-400">{selected.discountPct}% OFF</p>
                                </div>
                                <div className="bg-emerald-50 rounded-lg p-2">
                                    <p className="font-bold text-emerald-600 text-sm">₹{selected.finalPrice}</p>
                                    <p className="text-[9px] text-gray-400">Final</p>
                                </div>
                            </div>
                            <div className="space-y-2 text-sm">
                                {[
                                    ['Product', selected.product?.name],
                                    ['Coupon Code', selected.coupon?.code],
                                    ['Date', new Date(selected.createdAt).toLocaleString()],
                                ].map(([k, v]) => (
                                    <div key={k} className="flex justify-between py-1 border-b border-gray-100 last:border-0">
                                        <span className="text-gray-500 text-[10px]">{k}</span>
                                        <span className="font-medium text-gray-800 text-[10px] text-right break-all ml-2">{v}</span>
                                    </div>
                                ))}
                            </div>
                            <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={() => setSelected(null)}
    className="w-full py-3 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl font-medium text-sm shadow-lg hover:shadow-rose-500/25 transition-all duration-300 relative overflow-hidden group"
>
    <div className="absolute inset-0 bg-gradient-to-r from-rose-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    <div className="relative flex items-center justify-center gap-2">
        <X size={16} className="group-hover:rotate-90 transition-transform duration-300" />
        <span>Close</span>
    </div>
</motion.button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                        Transactions
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">{txns.length} total sales</p>
                </div>
                <button onClick={exportToCSV}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors">
                    <Download size={12} /> Export
                </button>
            </div>

            {/* Stats Summary */}
            {txns.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-3 text-center">
                        <TrendingUp size={18} className="text-emerald-500 mx-auto mb-1" />
                        <p className="text-lg font-bold text-gray-800">₹{totalRevenue.toLocaleString()}</p>
                        <p className="text-[9px] text-gray-500">Total Revenue</p>
                    </div>
                    <div className="bg-gradient-to-r from-rose-50 to-orange-50 rounded-xl p-3 text-center">
                        <Percent size={18} className="text-rose-500 mx-auto mb-1" />
                        <p className="text-lg font-bold text-gray-800">₹{totalDiscount.toLocaleString()}</p>
                        <p className="text-[9px] text-gray-500">Total Discounts</p>
                    </div>
                </div>
            )}

            {/* Search + Filter */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        placeholder="Search by product, worker, or coupon..."
                        value={search}
                        onChange={onSearch}
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-orange-300 focus:ring-1 focus:ring-orange-100 focus:outline-none"
                    />
                </div>
                <select value={filterType} onChange={e => setFilterType(e.target.value)}
                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white">
                    <option value="all">All</option>
                    {discountTiers.map(tier => <option key={tier} value={tier}>{tier}% OFF</option>)}
                </select>
            </div>

            {/* List */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
                    <History size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No transactions found</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((t, idx) => (
                        <VibrantTransactionItem key={t._id} transaction={t} index={idx} onClick={setSelected} />
                    ))}
                </div>
            )}
        </div>
    );
});
TransactionsPage.displayName = 'TransactionsPage';

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
const ShopDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [page, setPage] = useState('analytics');
    const [shop, setShop] = useState(null);
    const [transactions, setTransactions] = useState([]);

    const loadShop = useCallback(() => {
        api.getShopProfile()
            .then(r => setShop(r.data))
            .catch(() => navigate('/login'));
    }, [navigate]);

    const loadTransactions = useCallback(() => {
        api.getShopTransactions()
            .then(r => setTransactions(r.data))
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (location.state?.openSettings) {
            setPage('settings');
            window.history.replaceState({}, document.title);
        }
    }, [location.state?.openSettings]);

    useEffect(() => { 
        loadShop();
        loadTransactions();
    }, [loadShop, loadTransactions]);

    useEffect(() => {
        const allowedPages = new Set(['analytics', 'coupon', 'products', 'history', 'profile', 'settings']);
        const onGuideNavigate = (event) => {
            const nextPage = event?.detail?.page;
            if (allowedPages.has(nextPage)) {
                setPage(nextPage);
            }
        };

        window.addEventListener(SHOP_ONBOARDING_PAGE_EVENT, onGuideNavigate);
        return () => window.removeEventListener(SHOP_ONBOARDING_PAGE_EVENT, onGuideNavigate);
    }, []);

    const logout = useCallback(() => {
        ['shopToken', 'shop', 'shopRole'].forEach(k => localStorage.removeItem(k));
        toast.success('Logged out.');
        navigate('/login');
    }, [navigate]);

    const setPageCb = useCallback(p => { setPage(p); }, []);

    return (
        <ShopOnboardingProvider>
            <>
                <ShopHeader />
                <div className="lg:flex min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
                    <ShopSidebar page={page} onPageChange={setPageCb} onLogout={logout} />
                    <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 overflow-auto">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={page}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                            >
                                {page === 'analytics' && <AnalyticsPage transactions={transactions} />}
                                {page === 'coupon' && <CouponPage />}
                                {page === 'products' && <ProductsPage />}
                                {page === 'history' && <TransactionsPage />}
                                {page === 'profile' && <ShopProfileUnified shop={shop} onUpdate={loadShop} isDashboard={true} />}
                                {page === 'settings' && <ShopSettings />}
                            </motion.div>
                        </AnimatePresence>
                    </main>
                </div>
                <ShopOnboardingModal />
            </>
        </ShopOnboardingProvider>
    );
};

export default ShopDashboard;