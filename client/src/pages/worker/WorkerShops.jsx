import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import * as api from '../../api';
import toast from 'react-hot-toast';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    Store, Tag, Package, Gift, RefreshCw, ChevronRight,
    MapPin, Star, Clock, CheckCircle, AlertCircle, Ticket,
    Search, Filter, ChevronDown, X, Maximize2, Phone,
    Mail, Calendar, Award, TrendingUp, Users, Percent,
    DollarSign, ExternalLink, Copy, Check, ShoppingBag,
    Shield, Zap, Sparkles, Heart, Eye, History,
    ZoomIn, ZoomOut, ChevronLeft, Instagram, Facebook,
    Globe, Clock3, CreditCard, BadgeCheck, Truck, ThumbsUp, Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const imgSrc = (p) => p ? (p.startsWith('http') ? p : `${BASE_URL}/${p.replace(/^\//, '')}`) : null;

// ── ANIMATION VARIANTS ──────────────────────────────────────────────────────────
const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.4 }
};

const staggerContainer = {
    animate: { transition: { staggerChildren: 0.05 } }
};

// ── ERROR BOUNDARY ──────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() { return { hasError: true }; }
    componentDidCatch(error, errorInfo) { console.error('Component error:', error, errorInfo); }
    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 text-center">
                    <AlertCircle className="mx-auto text-red-500 mb-3" size={48} />
                    <p className="text-gray-600">Something went wrong. Please refresh the page.</p>
                </div>
            );
        }
        return this.props.children;
    }
}

// ── MINI MAP COMPONENT (Fixed Leaflet Integration) ─────────────────────────────
const MiniMap = ({ latitude, longitude, shopName }) => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markerRef = useRef(null);

    useEffect(() => {
        if (!mapRef.current || !latitude || !longitude) return;

        // Initialize map if not already done
        if (!mapInstanceRef.current) {
            mapInstanceRef.current = L.map(mapRef.current).setView([latitude, longitude], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19,
            }).addTo(mapInstanceRef.current);

            // Add marker
            markerRef.current = L.marker([latitude, longitude])
                .bindPopup(shopName || 'Shop Location')
                .addTo(mapInstanceRef.current);
            
            markerRef.current.openPopup();
        } else {
            // Update existing map
            mapInstanceRef.current.setView([latitude, longitude], 15);
            if (markerRef.current) {
                markerRef.current.setLatLng([latitude, longitude]);
                markerRef.current.bindPopup(shopName || 'Shop Location');
                markerRef.current.openPopup();
            }
        }

        // Cleanup function
        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
                markerRef.current = null;
            }
        };
    }, [latitude, longitude, shopName]);

    if (!latitude || !longitude) return null;

    return (
        <div 
            ref={mapRef} 
            className="w-full h-64 rounded-xl overflow-hidden shadow-md"
            style={{ backgroundColor: '#f0f0f0' }}
        />
    );
};

// ── FULL SCREEN IMAGE VIEWER ────────────────────────────────────────────────────
const ImageViewer = ({ images, initialIndex, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [zoom, setZoom] = useState(1);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') setCurrentIndex(prev => prev > 0 ? prev - 1 : images.length - 1);
            if (e.key === 'ArrowRight') setCurrentIndex(prev => prev < images.length - 1 ? prev + 1 : 0);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [images.length, onClose]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center"
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full bg-black/50 hover:bg-black/70 transition-all z-10"
            >
                <X size={24} />
            </button>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 backdrop-blur-lg rounded-full p-2 z-10">
                <button onClick={() => setZoom(z => Math.max(z - 0.5, 0.5))} className="p-2 text-white hover:bg-white/20 rounded-full">
                    <ZoomOut size={18} />
                </button>
                <button onClick={() => setZoom(z => Math.min(z + 0.5, 3))} className="p-2 text-white hover:bg-white/20 rounded-full">
                    <ZoomIn size={18} />
                </button>
            </div>

            {images.length > 1 && (
                <>
                    <button onClick={() => setCurrentIndex(prev => prev > 0 ? prev - 1 : images.length - 1)}
                        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 text-white/80 p-3 rounded-full bg-black/50 hover:bg-black/70">
                        <ChevronLeft size={24} />
                    </button>
                    <button onClick={() => setCurrentIndex(prev => prev < images.length - 1 ? prev + 1 : 0)}
                        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-white/80 p-3 rounded-full bg-black/50 hover:bg-black/70">
                        <ChevronRight size={24} />
                    </button>
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-lg px-4 py-2 rounded-full text-white text-sm">
                        {currentIndex + 1} / {images.length}
                    </div>
                </>
            )}

            <motion.img
                src={imgSrc(images[currentIndex])}
                alt="Full screen"
                className="max-w-[95vw] max-h-[95vh] object-contain"
                style={{ transform: `scale(${zoom})` }}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 20 }}
            />
        </motion.div>
    );
};

// ── SKELETON LOADER ─────────────────────────────────────────────────────────────
const ShopCardSkeleton = () => (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden animate-pulse">
        <div className="h-28 bg-gradient-to-r from-gray-200 to-gray-100"></div>
        <div className="p-4 space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
        </div>
    </div>
);

// ── COUPON CARD ─────────────────────────────────────────────────────────────────
const CouponCard = ({ coupon, onCopyCode }) => {
    const isExpired = new Date() > new Date(coupon.expiresAt);
    const [copied, setCopied] = useState(false);
    const daysLeft = Math.ceil((new Date(coupon.expiresAt) - new Date()) / (1000 * 60 * 60 * 24));

    const handleCopy = () => {
        navigator.clipboard.writeText(coupon.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        onCopyCode?.();
    };

    return (
        <motion.div
            whileHover={{ y: -4, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={`relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 ${
                coupon.isUsed ? 'bg-gray-50 border-gray-200 opacity-70' :
                isExpired ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-200' :
                'bg-gradient-to-r from-amber-50 to-orange-50 border-orange-200 shadow-lg'
            }`}
        >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-orange-200/30 to-amber-200/30 rounded-full -mr-12 -mt-12" />
            <div className="relative z-10">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-4 flex-1">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl flex-shrink-0 ${
                            coupon.isUsed || isExpired ? 'bg-gray-300 text-gray-600' : 'bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg'
                        }`}>
                            {coupon.discountPct}%
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-gray-800 text-xl tracking-wider">{coupon.code}</span>
                                <motion.button whileTap={{ scale: 0.9 }} onClick={handleCopy} className="p-1.5 hover:bg-white/50 rounded-lg transition-all">
                                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-gray-400" />}
                                </motion.button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                {coupon.isUsed ? 'Used' : isExpired ? 'Expired' : `Expires in ${daysLeft} days`}
                            </p>
                        </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        coupon.isUsed ? 'bg-gray-200 text-gray-600' :
                        isExpired ? 'bg-red-100 text-red-700' :
                        'bg-green-100 text-green-700'
                    }`}>
                        {coupon.isUsed ? 'Used' : isExpired ? 'Expired' : 'Active'}
                    </span>
                </div>

                {!coupon.isUsed && !isExpired && (
                    <div className="mt-4 bg-white/80 rounded-xl p-3 border border-orange-100">
                        <p className="text-xs text-orange-700 font-medium flex items-center gap-2">
                            <Sparkles size={12} /> Show this code at any partner shop for {coupon.discountPct}% off on tools ≥ ₹1000
                        </p>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

// ── COUPON HISTORY SECTION ──────────────────────────────────────────────────────
// Enhanced Coupon History Section with Circular Logo and Professional Layout
const CouponHistorySection = () => {
    const [searchCode, setSearchCode] = useState('');
    const [couponDetails, setCouponDetails] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searched, setSearched] = useState(false);
    const [copied, setCopied] = useState(false);
    const [viewerImage, setViewerImage] = useState(null);
    const [viewerImages, setViewerImages] = useState([]);

    const handleSearchCoupon = async (e) => {
        e.preventDefault();
        if (!searchCode.trim()) {
            setError('Please enter a coupon code');
            return;
        }

        setLoading(true);
        setError('');
        setCouponDetails(null);
        setSearched(true);

        try {
            const { data } = await api.getCouponByCode(searchCode.toUpperCase());
            setCouponDetails(data);
        } catch (err) {
            const errorMsg = err.response?.data?.message || 'Failed to retrieve coupon details';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('Copied to clipboard!');
    };

    return (
        <motion.div initial="initial" animate="animate" variants={staggerContainer} className="space-y-6 pb-16">
            {/* Premium Search Section */}
            <motion.div 
                variants={fadeInUp}
                className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-purple-500 to-pink-500 rounded-2xl p-6 text-white shadow-2xl"
            >
                {/* Animated Background Elements */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20 animate-pulse" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mb-16" />
                <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-2xl" />
                
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur">
                            <History size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black">Coupon History Lookup</h3>
                            <p className="text-purple-100 text-sm mt-0.5">Track your past purchases and shop details</p>
                        </div>
                    </div>
                    
                    <form onSubmit={handleSearchCoupon} className="mt-5 space-y-3">
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-300 group-focus-within:text-white transition-colors">
                                <Ticket size={18} />
                            </div>
                            <input
                                type="text"
                                value={searchCode}
                                onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                                placeholder="Enter coupon code (e.g., ABC12345)"
                                className="w-full pl-11 pr-4 py-3.5 rounded-xl text-gray-800 bg-white/95 backdrop-blur placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-purple-300/50 font-mono font-semibold text-center tracking-widest transition-all"
                                autoCapitalize="characters"
                            />
                        </div>
                        <motion.button
                            whileTap={{ scale: 0.98 }}
                            whileHover={{ scale: 1.02 }}
                            type="submit"
                            disabled={loading}
                            className="w-full bg-white text-purple-600 px-6 py-3.5 rounded-xl font-bold text-sm hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
                        >
                            {loading ? (
                                <>
                                    <RefreshCw size={18} className="animate-spin" />
                                    Searching Coupon...
                                </>
                            ) : (
                                <>
                                    <Search size={18} className="group-hover:scale-110 transition-transform" />
                                    Search Coupon
                                </>
                            )}
                        </motion.button>
                    </form>
                </div>
            </motion.div>

            {/* Error Message */}
            <AnimatePresence>
                {error && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-2xl p-5 flex items-start gap-3 shadow-sm"
                    >
                        <div className="p-1 bg-red-500 rounded-full">
                            <AlertCircle size={18} className="text-white" />
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-red-700">Coupon Not Found</p>
                            <p className="text-red-600 text-sm mt-0.5">{error}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Coupon Details Card */}
            {searched && !error && couponDetails && (
                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300"
                >
                    {/* Premium Coupon Header */}
                    <div className="relative bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 p-6 overflow-hidden">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mb-16" />
                        
                        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                                    <Ticket size={32} className="text-white" />
                                </div>
                                <div>
                                    <p className="text-purple-200 text-xs uppercase tracking-wider font-semibold">Coupon Code</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <p className="font-mono font-black text-2xl sm:text-3xl tracking-wider text-white">{couponDetails.code}</p>
                                        <motion.button
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => copyToClipboard(couponDetails.code)}
                                            className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-all"
                                        >
                                            {copied ? <Check size={14} className="text-green-300" /> : <Copy size={14} className="text-white" />}
                                        </motion.button>
                                    </div>
                                </div>
                            </div>
                            <div className="text-center sm:text-right">
                                <p className="text-purple-200 text-xs uppercase tracking-wider">Discount</p>
                                <p className="font-black text-5xl text-white">{couponDetails.discountPct}%</p>
                                <p className="text-purple-200 text-xs mt-1">off on tools ≥ ₹1000</p>
                            </div>
                        </div>
                    </div>

                    {/* Status & Usage Timeline */}
                    <div className="p-6 border-b border-gray-100">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                <div className="p-2 bg-blue-100 rounded-full">
                                    <Calendar size={16} className="text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Valid Until</p>
                                    <p className="font-semibold text-gray-800 text-sm">
                                        {new Date(couponDetails.expiresAt).toLocaleDateString('en-IN', { 
                                            day: 'numeric', 
                                            month: 'long', 
                                            year: 'numeric' 
                                        })}
                                    </p>
                                </div>
                            </div>
                            <div className={`flex items-center gap-3 p-3 rounded-xl ${
                                couponDetails.isUsed ? 'bg-green-50' : 'bg-yellow-50'
                            }`}>
                                <div className={`p-2 rounded-full ${
                                    couponDetails.isUsed ? 'bg-green-100' : 'bg-yellow-100'
                                }`}>
                                    {couponDetails.isUsed ? 
                                        <CheckCircle size={16} className="text-green-600" /> : 
                                        <Clock size={16} className="text-yellow-600" />
                                    }
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Status</p>
                                    <p className={`font-semibold text-sm ${
                                        couponDetails.isUsed ? 'text-green-700' : 'text-yellow-700'
                                    }`}>
                                        {couponDetails.isUsed ? 'Redeemed' : 'Active'}
                                    </p>
                                </div>
                            </div>
                            {couponDetails.isUsed && couponDetails.usedAt && (
                                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl">
                                    <div className="p-2 bg-purple-100 rounded-full">
                                        <History size={16} className="text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Redeemed On</p>
                                        <p className="font-semibold text-gray-800 text-sm">
                                            {new Date(couponDetails.usedAt).toLocaleDateString('en-IN', { 
                                                day: 'numeric', 
                                                month: 'short', 
                                                year: 'numeric' 
                                            })}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {new Date(couponDetails.usedAt).toLocaleTimeString()}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Shop Details Section */}
                    {couponDetails.isUsed && couponDetails.shop && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="p-6 space-y-5"
                        >
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-orange-100 rounded-lg">
                                    <Store size={18} className="text-orange-600" />
                                </div>
                                <h4 className="font-bold text-gray-800 text-lg">Shop Details</h4>
                            </div>

                            {/* Shop Header with Circular Logo */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-5 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl border border-orange-100">
                                <div className="flex-shrink-0">
                                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-orange-300 shadow-lg bg-white">
                                        {imgSrc(couponDetails.shop.shopLogo) ? (
                                            <img 
                                                src={imgSrc(couponDetails.shop.shopLogo)} 
                                                alt={couponDetails.shop.shopName}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center">
                                                <Store size={32} className="text-white" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-black text-gray-800 text-xl sm:text-2xl">{couponDetails.shop.shopName}</h3>
                                    {couponDetails.shop.category && (
                                        <span className="inline-flex items-center gap-1 mt-2 bg-orange-200 text-orange-700 text-xs font-bold px-3 py-1 rounded-full">
                                            <Tag size={10} />
                                            {couponDetails.shop.category}
                                        </span>
                                    )}
                                    {couponDetails.shop.verificationStatus === 'approved' && (
                                        <span className="inline-flex items-center gap-1 ml-2 bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">
                                            <BadgeCheck size={10} />
                                            Verified Shop
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Shop Info Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Owner Info */}
                                <div className="group bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-all">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 bg-blue-50 rounded-lg">
                                            <Users size={14} className="text-blue-600" />
                                        </div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Owner / Manager</p>
                                    </div>
                                    <p className="font-bold text-gray-800 text-base">{couponDetails.shop.ownerName || 'Not specified'}</p>
                                </div>

                                {/* Contact Info */}
                                {couponDetails.shop.mobile && (
                                    <div className="group bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-all">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="p-1.5 bg-green-50 rounded-lg">
                                                <Phone size={14} className="text-green-600" />
                                            </div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Contact Number</p>
                                        </div>
                                        <a 
                                            href={`tel:${couponDetails.shop.mobile}`}
                                            className="font-bold text-green-700 flex items-center gap-2 text-base hover:underline group"
                                        >
                                            <Phone size={14} className="group-hover:animate-pulse" />
                                            {couponDetails.shop.mobile}
                                        </a>
                                    </div>
                                )}

                                {/* Email */}
                                {couponDetails.shop.email && (
                                    <div className="group bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-all">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="p-1.5 bg-purple-50 rounded-lg">
                                                <Mail size={14} className="text-purple-600" />
                                            </div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Email Address</p>
                                        </div>
                                        <a 
                                            href={`mailto:${couponDetails.shop.email}`}
                                            className="font-medium text-purple-700 text-sm break-all hover:underline"
                                        >
                                            {couponDetails.shop.email}
                                        </a>
                                    </div>
                                )}

                                {/* Address */}
                                {couponDetails.shop.address && (
                                    <div className="md:col-span-2 group bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-all">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="p-1.5 bg-red-50 rounded-lg">
                                                <MapPin size={14} className="text-red-600" />
                                            </div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Complete Address</p>
                                        </div>
                                        <p className="text-gray-800 font-medium text-sm leading-relaxed">
                                            {couponDetails.shop.address}
                                            {couponDetails.shop.city && `, ${couponDetails.shop.city}`}
                                            {couponDetails.shop.state && `, ${couponDetails.shop.state}`}
                                            {couponDetails.shop.pincode && ` - ${couponDetails.shop.pincode}`}
                                        </p>
                                        {/* Google Maps Link */}
                                        {couponDetails.shop.shopLocation?.latitude && couponDetails.shop.shopLocation?.longitude && (
                                            <a 
                                                href={`https://maps.google.com/?q=${couponDetails.shop.shopLocation.latitude},${couponDetails.shop.shopLocation.longitude}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
                                            >
                                                <ExternalLink size={12} />
                                                View on Google Maps
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Shop Photo Gallery */}
                            {(imgSrc(couponDetails.shop.shopPhoto) || couponDetails.shop.shopImages?.length > 0) && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-gray-100 rounded-lg">
                                            <Camera size={14} className="text-gray-600" />
                                        </div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Shop Photos</p>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {imgSrc(couponDetails.shop.shopPhoto) && (
                                            <div className="relative group cursor-pointer rounded-xl overflow-hidden h-32 bg-gray-100">
                                                <img 
                                                    src={imgSrc(couponDetails.shop.shopPhoto)} 
                                                    alt="Shop front"
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all" />
                                            </div>
                                        )}
                                        {couponDetails.shop.shopImages?.slice(0, 2).map((img, idx) => (
                                            <div key={idx} className="relative group cursor-pointer rounded-xl overflow-hidden h-32 bg-gray-100">
                                                <img 
                                                    src={imgSrc(img)} 
                                                    alt={`Shop view ${idx + 1}`}
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Business Hours (if available) */}
                            {couponDetails.shop.businessHours && (
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Clock size={14} className="text-gray-500" />
                                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Business Hours</p>
                                    </div>
                                    <p className="text-gray-700 text-sm">{couponDetails.shop.businessHours}</p>
                                </div>
                            )}

                            {/* Product Details Section */}
                            {couponDetails.product && (
                                <motion.div 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className="border-t border-gray-100 pt-6"
                                >
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="p-2 bg-green-100 rounded-lg">
                                            <ShoppingBag size={18} className="text-green-600" />
                                        </div>
                                        <h4 className="font-bold text-gray-800 text-lg">Purchase Details</h4>
                                    </div>

                                    {/* Product Card with Image and Info */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-100">
                                        {/* Product Image */}
                                        <div className="flex items-center justify-center">
                                            {couponDetails.product.productImage ? (
                                                <div 
                                                    onClick={() => {
                                                        setViewerImage(couponDetails.product.productImage);
                                                        setViewerImages([couponDetails.product.productImage]);
                                                    }}
                                                    className="relative group w-full max-w-sm rounded-xl overflow-hidden shadow-lg bg-white cursor-pointer"
                                                >
                                                    <img 
                                                        src={imgSrc(couponDetails.product.productImage)} 
                                                        alt={couponDetails.product.productName}
                                                        className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-300"
                                                    />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center" >
                                                        <div className="p-3 bg-white/90 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Maximize2 size={24} className="text-gray-800" />
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="w-full max-w-sm h-64 bg-gradient-to-br from-gray-300 to-gray-400 rounded-xl flex items-center justify-center">
                                                    <Package size={48} className="text-white" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Product Info */}
                                        <div className="flex flex-col justify-between">
                                            <div className="space-y-4">
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Product Name</p>
                                                    <p className="font-black text-gray-800 text-xl">{couponDetails.product.productName}</p>
                                                </div>

                                                {/* Pricing Info */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200">
                                                        <span className="text-xs text-gray-500 uppercase">Original Price</span>
                                                        <span className="font-bold text-gray-700">₹{couponDetails.product.productPrice?.toLocaleString('en-IN') || '0'}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between p-2 bg-red-50 rounded-lg border border-red-200">
                                                        <span className="text-xs text-red-600 uppercase font-semibold">Discount ({couponDetails.discountPct}%)</span>
                                                        <span className="font-bold text-red-700">-₹{couponDetails.product.discountAmount?.toLocaleString('en-IN') || '0'}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg border border-green-300">
                                                        <span className="text-xs text-green-700 uppercase font-bold">Final Price</span>
                                                        <span className="font-black text-green-800 text-lg">₹{couponDetails.product.finalPrice?.toLocaleString('en-IN') || '0'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </motion.div>
                    )}

                    {/* Image Viewer Modal */}
                    {viewerImage && <ImageViewer images={viewerImages} initialIndex={0} onClose={() => setViewerImage(null)} />}

                    {/* Unused Coupon Message */}
                    {!couponDetails.isUsed && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="p-6 border-t border-gray-100"
                        >
                            <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-5 flex items-start gap-3">
                                <div className="p-2 bg-yellow-100 rounded-full">
                                    <Sparkles size={18} className="text-yellow-600" />
                                </div>
                                <div>
                                    <p className="font-bold text-yellow-800">Coupon is Ready to Use!</p>
                                    <p className="text-yellow-700 text-sm mt-1">
                                        This coupon hasn't been redeemed yet. Visit any partner shop and present the code to get 
                                        <span className="font-bold"> {couponDetails.discountPct}% discount</span> on your purchase (minimum ₹1000).
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                            onClick={() => copyToClipboard(couponDetails.code)}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg text-xs font-medium hover:bg-yellow-200 transition-all"
                                        >
                                            <Copy size={12} />
                                            Copy Code
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </motion.div>
            )}

            {/* No Results State */}
            {searched && !error && !couponDetails && loading === false && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-16 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-100"
                >
                    <div className="w-24 h-24 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
                        <Search size={40} className="text-purple-400" />
                    </div>
                    <p className="text-gray-600 font-medium text-lg">No Results Found</p>
                    <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
                        We couldn't find a coupon with the code <span className="font-mono font-semibold text-purple-600">{searchCode}</span>. Please verify the code and try again.
                    </p>
                </motion.div>
            )}

            {/* Empty State */}
            {!searched && !error && !couponDetails && (
                <motion.div 
                    variants={fadeInUp}
                    className="text-center py-20 bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 rounded-2xl border border-purple-100"
                >
                    <div className="relative">
                        <div className="w-28 h-28 mx-auto mb-5 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center shadow-lg">
                            <Ticket size={48} className="text-white" />
                        </div>
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
                            <Search size={14} className="text-white" />
                        </div>
                    </div>
                    <h3 className="text-gray-700 font-bold text-xl">Coupon History Lookup</h3>
                    <p className="text-gray-500 text-sm mt-2 max-w-md mx-auto">
                        Enter any coupon code to view detailed information including shop details, redemption status, and purchase history.
                    </p>
                    <div className="mt-6 flex justify-center gap-3 text-xs text-gray-400">
                        <span className="px-3 py-1 bg-white rounded-full shadow-sm">Track purchases</span>
                        <span className="px-3 py-1 bg-white rounded-full shadow-sm">View shop details</span>
                        <span className="px-3 py-1 bg-white rounded-full shadow-sm">Check validity</span>
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
};

// ── SHOP CARD (Enhanced) ────────────────────────────────────────────────────────
const ShopCard = ({ shop, onClick }) => (
    <motion.div
        whileHover={{ y: -8, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="group cursor-pointer"
        onClick={() => onClick(shop)}
    >
        <div className="relative bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-2xl">
            <div className="relative h-32 bg-gradient-to-r from-orange-400 to-amber-400 flex items-center justify-center overflow-hidden">
                {imgSrc(shop.shopLogo) ? (
                    <img src={imgSrc(shop.shopLogo)} className="w-24 h-24 object-cover rounded-xl shadow-md group-hover:scale-110 transition-transform duration-500" alt="" />
                ) : (
                    <Store size={40} className="text-white/80" />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300" />
                {shop.verificationStatus === 'approved' && (
                    <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1 shadow-lg">
                        <CheckCircle size={12} className="text-white" />
                    </div>
                )}
            </div>
            <div className="p-4">
                <h4 className="font-bold text-gray-800 text-base truncate group-hover:text-orange-600 transition-colors">{shop.shopName}</h4>
                <p className="text-xs text-gray-500 mt-0.5">{shop.ownerName}</p>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                        <MapPin size={12} /> {shop.city}
                    </div>
                    <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{shop.category}</span>
                </div>
            </div>
        </div>
    </motion.div>
);

// ── SHOPS MAP MODAL ─────────────────────────────────────────────────────────────
const ShopsMapModal = ({ shops, onClose }) => {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const markers = useRef([]);

    useEffect(() => {
        if (!mapContainer.current) return;
        
        setTimeout(() => {
            if (!map.current && mapContainer.current) {
                map.current = L.map(mapContainer.current).setView([20.5937, 78.9629], 5);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap',
                    maxZoom: 19,
                }).addTo(map.current);
            }

            if (map.current) {
                markers.current.forEach(m => map.current.removeLayer(m));
                markers.current = [];

                const bounds = L.latLngBounds();
                shops.forEach(shop => {
                    if (shop.shopLocation?.latitude && shop.shopLocation?.longitude) {
                        const marker = L.marker([shop.shopLocation.latitude, shop.shopLocation.longitude])
                            .bindPopup(`
                                <div class="text-sm">
                                    <h3 class="font-bold text-orange-600">${shop.shopName}</h3>
                                    <p class="text-xs text-gray-600">${shop.category}</p>
                                    <p class="text-xs text-gray-600">${shop.address}, ${shop.city}</p>
                                </div>
                            `)
                            .addTo(map.current);
                        markers.current.push(marker);
                        bounds.extend([shop.shopLocation.latitude, shop.shopLocation.longitude]);
                    }
                });

                if (markers.current.length > 0) map.current.fitBounds(bounds, { padding: [50, 50] });
            }
        }, 100);

        return () => {
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
        };
    }, [shops]);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full h-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-5 bg-gradient-to-r from-orange-500 to-amber-500">
                    <h2 className="text-xl font-black text-white flex items-center gap-2"><MapPin size={24} /> Shops Map View</h2>
                    <button onClick={onClose} className="text-white/80 hover:text-white p-2 hover:bg-white/20 rounded-full"><X size={24} /></button>
                </div>
                <div ref={mapContainer} className="flex-1 bg-gray-100" style={{ minHeight: '400px' }} />
                <div className="p-4 bg-gray-50 border-t"><p className="text-xs text-gray-600">Showing {shops.filter(s => s.shopLocation?.latitude).length} shop(s) with location data.</p></div>
            </motion.div>
        </motion.div>
    );
};

// ── PROFESSIONAL SHOP DETAIL MODAL (Enhanced) ───────────────────────────────────
const ShopDetailModal = ({ shop, discountPct, onClose }) => {
    const [activeTab, setActiveTab] = useState('products');
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('name');
    const [viewerImage, setViewerImage] = useState(null);
    const [viewerImages, setViewerImages] = useState([]);

    useEffect(() => {
        if (!shop) return;
        setLoading(true);
        api.getShopPublicProducts(shop._id)
            .then(r => setProducts(r.data || []))
            .catch(() => toast.error('Failed to load products.'))
            .finally(() => setLoading(false));
    }, [shop]);

    const filteredProducts = useMemo(() => {
        let filtered = products.filter(p => p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || p.description?.toLowerCase().includes(searchTerm.toLowerCase()));
        filtered.sort((a, b) => {
            if (sortBy === 'price_asc') return a.price - b.price;
            if (sortBy === 'price_desc') return b.price - a.price;
            if (sortBy === 'name') return a.name?.localeCompare(b.name);
            return 0;
        });
        return filtered;
    }, [products, searchTerm, sortBy]);

    if (!shop) return null;

    return (
        <ErrorBoundary>
            <AnimatePresence>
                {viewerImage && <ImageViewer images={viewerImages} initialIndex={0} onClose={() => setViewerImage(null)} />}
            </AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25 }} className="bg-white w-full sm:rounded-3xl shadow-2xl sm:max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                    {/* Premium Header */}
                    <div className="relative bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 p-5 flex-shrink-0">
                        <div className="absolute inset-0 bg-black/10" />
                        <div className="relative flex items-start gap-4">
                            <motion.div whileHover={{ scale: 1.05 }} className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/30 bg-white/20 flex-shrink-0 shadow-lg">
                                {imgSrc(shop.shopLogo) ? <img src={imgSrc(shop.shopLogo)} className="w-full h-full object-cover" alt="" /> : <Store size={28} className="text-white m-4" />}
                            </motion.div>
                            <div className="flex-1">
                                <h3 className="text-xl font-black text-white">{shop.shopName}</h3>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <span className="bg-white/20 backdrop-blur px-2 py-0.5 rounded-full text-white text-xs">{shop.category}</span>
                                    <span className="bg-white/20 backdrop-blur px-2 py-0.5 rounded-full text-white text-xs flex items-center gap-1"><MapPin size={10} /> {shop.city}</span>
                                    {shop.verificationStatus === 'approved' && <span className="bg-green-500/80 backdrop-blur px-2 py-0.5 rounded-full text-white text-xs flex items-center gap-1"><CheckCircle size={10} /> Verified</span>}
                                </div>
                            </div>
                            <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="text-white/80 hover:text-white p-2 hover:bg-white/20 rounded-full">
                                <X size={20} />
                            </motion.button>
                        </div>
                    </div>

                    {/* Modern Tabs */}
                    <div className="border-b px-5 pt-3 flex gap-1 overflow-x-auto scrollbar-hide bg-white">
                        {[
                            { key: 'products', label: 'Products', icon: Package },
                            { key: 'info', label: 'Shop Info', icon: Store },
                            { key: 'location', label: 'Location', icon: MapPin },
                        ].map(tab => (
                            <motion.button
                                key={tab.key}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-t-xl transition-all whitespace-nowrap ${
                                    activeTab === tab.key ? 'bg-orange-50 text-orange-600 border-b-2 border-orange-500' : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <tab.icon size={16} />
                                {tab.label}
                            </motion.button>
                        ))}
                    </div>

                    {/* Scrollable Content */}
                    <div className="overflow-y-auto flex-1 p-5 pb-24">
                        {/* Products Tab */}
                        {activeTab === 'products' && (
                            <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <div className="flex-1 relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input type="text" placeholder="Search products..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-50" />
                                    </div>
                                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white">
                                        <option value="name">Sort by Name</option>
                                        <option value="price_asc">Price: Low to High</option>
                                        <option value="price_desc">Price: High to Low</option>
                                    </select>
                                </div>

                                {loading ? (
                                    <div className="text-center py-12"><div className="animate-spin h-10 w-10 border-4 border-orange-400 border-t-transparent rounded-full mx-auto" /></div>
                                ) : filteredProducts.length === 0 ? (
                                    <div className="text-center py-12"><Package size={48} className="mx-auto text-gray-300 mb-2" /><p className="text-gray-400">No products found</p></div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {filteredProducts.map(p => {
                                            const eligible = p.price >= 1000 && discountPct > 0;
                                            const discount = eligible ? Math.round(p.price * discountPct / 100) : 0;
                                            return (
                                                <motion.div key={p._id} whileHover={{ y: -4 }} className="group border border-gray-100 rounded-xl overflow-hidden hover:shadow-xl transition-all bg-white">
                                                    <div className="relative h-40 bg-gray-50 overflow-hidden cursor-pointer" onClick={() => p.image && setViewerImage(p.image) & setViewerImages([p.image])}>
                                                        {imgSrc(p.image) ? <img src={imgSrc(p.image)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" /> : <div className="w-full h-full flex items-center justify-center"><Package size={32} className="text-gray-300" /></div>}
                                                        {eligible && <div className="absolute top-2 right-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">{discountPct}% OFF</div>}
                                                    </div>
                                                    <div className="p-4">
                                                        <h5 className="font-bold text-gray-800">{p.name}</h5>
                                                        <p className="text-xs text-gray-500 line-clamp-2 mt-1">{p.description}</p>
                                                        <div className="mt-3">
                                                            {eligible ? (
                                                                <div><p className="text-xs text-gray-400 line-through">₹{p.price}</p><p className="font-black text-green-600 text-xl">₹{p.price - discount}</p></div>
                                                            ) : (
                                                                <p className="font-black text-gray-800 text-xl">₹{p.price}</p>
                                                            )}
                                                        </div>
                                                        <div className="mt-2 flex items-center justify-between"><span className="text-xs text-gray-400">Stock: {p.stock}</span>{eligible && <span className="text-xs text-green-600 flex items-center gap-1"><Zap size={12} /> Eligible</span>}</div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Professional Shop Info Tab */}
                        {activeTab === 'info' && (
                            <div className="space-y-6">
                                {/* Contact & Business Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-5">
                                        <h4 className="text-sm font-bold text-orange-600 uppercase tracking-wider mb-4 flex items-center gap-2"><Phone size={14} /> Contact Information</h4>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3 text-sm"><Phone size={16} className="text-gray-500" /><span className="text-gray-700">{shop?.mobile || 'Not provided'}</span></div>
                                            <div className="flex items-center gap-3 text-sm"><Mail size={16} className="text-gray-500" /><span className="text-gray-700 break-all">{shop?.email || 'Not provided'}</span></div>
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5">
                                        <h4 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4 flex items-center gap-2"><BadgeCheck size={14} /> Business Details</h4>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3 text-sm"><Tag size={16} className="text-gray-500" /><span className="text-gray-700">{shop?.category || 'General'}</span></div>
                                            {shop?.gstNumber && <div className="flex items-center gap-3 text-sm"><Shield size={16} className="text-gray-500" /><span className="text-gray-700">GST: {shop.gstNumber}</span></div>}
                                            <div className="flex items-center gap-3 text-sm"><Calendar size={16} className="text-gray-500" /><span className="text-gray-700">Member since {shop?.createdAt ? new Date(shop.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' }) : 'N/A'}</span></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Address Card */}
                                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-5">
                                    <h4 className="text-sm font-bold text-purple-600 uppercase tracking-wider mb-4 flex items-center gap-2"><MapPin size={14} /> Address</h4>
                                    <p className="text-gray-700 text-sm">{shop?.address}, {shop?.city}, {shop?.state || 'Maharashtra'} - {shop?.pincode}</p>
                                </div>

                                {/* About Section */}
                                {shop?.about && (
                                    <div className="bg-gray-50 rounded-2xl p-5">
                                        <h4 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-2"><Globe size={14} /> About Shop</h4>
                                        <p className="text-gray-700 text-sm leading-relaxed">{shop.about}</p>
                                    </div>
                                )}

                                {/* Shop Stats */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-white border border-gray-100 rounded-xl p-3 text-center shadow-sm">
                                        <Users size={18} className="mx-auto text-orange-500 mb-1" />
                                        <p className="text-xs text-gray-500">Products</p>
                                        <p className="font-bold text-gray-800">{products.length}</p>
                                    </div>
                                    <div className="bg-white border border-gray-100 rounded-xl p-3 text-center shadow-sm">
                                        <ThumbsUp size={18} className="mx-auto text-orange-500 mb-1" />
                                        <p className="text-xs text-gray-500">Verified</p>
                                        <p className="font-bold text-gray-800">{shop.verificationStatus === 'approved' ? 'Yes' : 'No'}</p>
                                    </div>
                                    <div className="bg-white border border-gray-100 rounded-xl p-3 text-center shadow-sm">
                                        <Truck size={18} className="mx-auto text-orange-500 mb-1" />
                                        <p className="text-xs text-gray-500">Partner Since</p>
                                        <p className="font-bold text-gray-800 text-xs">{shop?.createdAt ? new Date(shop.createdAt).getFullYear() : 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Location Tab with MiniMap (Fixed) */}
                        {activeTab === 'location' && (
                            <div className="space-y-4">
                                {shop?.shopLocation?.latitude && shop?.shopLocation?.longitude ? (
                                    <>
                                        <MiniMap 
                                            latitude={shop.shopLocation.latitude} 
                                            longitude={shop.shopLocation.longitude} 
                                            shopName={shop.shopName}
                                        />
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-gray-50 rounded-xl p-3">
                                                <p className="text-xs text-gray-500">Latitude</p>
                                                <p className="font-mono text-sm font-semibold">{shop.shopLocation.latitude.toFixed(6)}</p>
                                            </div>
                                            <div className="bg-gray-50 rounded-xl p-3">
                                                <p className="text-xs text-gray-500">Longitude</p>
                                                <p className="font-mono text-sm font-semibold">{shop.shopLocation.longitude.toFixed(6)}</p>
                                            </div>
                                        </div>
                                        <a 
                                            href={`https://maps.google.com/?q=${shop.shopLocation.latitude},${shop.shopLocation.longitude}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="block w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl text-center transition-all flex items-center justify-center gap-2"
                                        >
                                            <ExternalLink size={16} /> Open in Google Maps
                                        </a>
                                    </>
                                ) : (
                                    <div className="text-center py-12 bg-gray-50 rounded-xl">
                                        <MapPin size={48} className="mx-auto text-gray-300 mb-2" />
                                        <p className="text-gray-400">Location not available for this shop</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {discountPct > 0 && (
                        <div className="border-t bg-green-50 p-4 pb-safe">
                            <div className="flex items-center gap-2 text-green-700 text-sm">
                                <Sparkles size={16} />
                                <p className="font-semibold">Your {discountPct}% discount applies to products with MRP ≥ ₹1000</p>
                            </div>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </ErrorBoundary>
    );
};

// ── MAIN COMPONENT ──────────────────────────────────────────────────────────────
const WorkerShops = () => {
    const [tab, setTab] = useState('shops');
    const [shops, setShops] = useState([]);
    const [myCoupons, setMyCoupons] = useState([]);
    const [purchaseHistory, setPurchaseHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const [selectedShop, setSelectedShop] = useState(null);
    const [showMapModal, setShowMapModal] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [loadingShops, setLoadingShops] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [showFilters, setShowFilters] = useState(false);

    const load = useCallback(() => {
        setLoadingShops(true);
        Promise.all([api.getApprovedShops(), api.getMyCoupons()])
            .then(([s, c]) => { setShops(s.data || []); setMyCoupons(c.data || []); })
            .catch(() => toast.error('Failed to load data'))
            .finally(() => setLoadingShops(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const activeCoupon = myCoupons.find(c => !c.isUsed && new Date() < new Date(c.expiresAt));
    const categories = useMemo(() => ['all', ...new Set(shops.map(s => s.category).filter(Boolean))], [shops]);

    const filteredShops = useMemo(() => {
        let filtered = shops;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(s => s.shopName?.toLowerCase().includes(term) || s.category?.toLowerCase().includes(term) || s.city?.toLowerCase().includes(term));
        }
        if (selectedCategory !== 'all') filtered = filtered.filter(s => s.category === selectedCategory);
        return filtered;
    }, [shops, searchTerm, selectedCategory]);

    const generate = async () => {
        setGenerating(true);
        try {
            const { data } = await api.generateMyCoupon();
            if (data.alreadyHave) toast.success('You already have a coupon this month!');
            else toast.success(`Coupon generated! ${data.discountPct}% discount.`);
            load();
        } catch (err) { toast.error(err.response?.data?.message || 'Not eligible yet.'); }
        finally { setGenerating(false); }
    };

    const loadPurchaseHistory = useCallback(async () => {
        setLoadingHistory(true);
        try {
            const { data } = await api.getWorkerPurchaseHistory();
            setPurchaseHistory(Array.isArray(data) ? data : []);
            setHistoryLoaded(true);
        } catch {
            toast.error('Failed to load shopping history');
        } finally {
            setLoadingHistory(false);
        }
    }, []);

    useEffect(() => {
        if (tab === 'shopping-history' && !historyLoaded) loadPurchaseHistory();
    }, [tab, historyLoaded, loadPurchaseHistory]);

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
                <AnimatePresence>
                    {selectedShop && <ShopDetailModal shop={selectedShop} discountPct={activeCoupon?.discountPct || 0} onClose={() => setSelectedShop(null)} />}
                    {showMapModal && <ShopsMapModal shops={shops} onClose={() => setShowMapModal(false)} />}
                </AnimatePresence>

                <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto pb-28">
                    {/* Header */}
                    <motion.div data-guide-id="worker-page-shops" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg">
                                <Store size={24} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">Tool Shops</h1>
                                <p className="text-gray-500 text-sm">Browse partner shops & use your earned coupons</p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Tabs */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 bg-white rounded-2xl p-1.5 mb-6 shadow-sm overflow-x-auto scrollbar-hide">
                        {[
                            { key: 'shops', label: 'Browse Shops', icon: Store, count: shops.length },
                            { key: 'maps', label: 'View Map', icon: MapPin, count: shops.filter(s => s.shopLocation?.latitude).length },
                            { key: 'coupons', label: 'My Coupons', icon: Ticket, count: myCoupons.length },
                            { key: 'shopping-history', label: 'Bought History', icon: ShoppingBag, count: historyLoaded ? purchaseHistory.length : null },
                            { key: 'coupon-history', label: 'Coupon History', icon: History, count: null },
                        ].map(({ key, label, icon: Icon, count }) => (
                            <motion.button
                                key={key}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => key === 'maps' ? setShowMapModal(true) : setTab(key)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                                    tab === key ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md' : 'text-gray-600 hover:bg-orange-50'
                                }`}
                            >
                                <Icon size={16} />
                                {label}
                                {count !== null && count > 0 && <span className={`px-1.5 py-0.5 rounded-full text-xs ${tab === key ? 'bg-white/20' : 'bg-gray-100'}`}>{count}</span>}
                            </motion.button>
                        ))}
                    </motion.div>

                    {/* Shops Tab */}
                    {tab === 'shops' && (
                        <motion.div initial="initial" animate="animate" variants={staggerContainer} className="space-y-5">
                            <div className="space-y-3">
                                <div className="relative">
                                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input type="text" placeholder="Search shops by name, category or city..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-50 transition-all" />
                                </div>
                                <div className="flex gap-2">
                                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:border-orange-300">
                                        <Filter size={14} /> Filter <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                                    </motion.button>
                                    <motion.button whileTap={{ scale: 0.95 }} onClick={load} className="flex items-center gap-2 px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:border-orange-300">
                                        <RefreshCw size={14} className={loadingShops ? 'animate-spin' : ''} /> <span className="hidden sm:inline">Refresh</span>
                                    </motion.button>
                                </div>
                                <AnimatePresence>
                                    {showFilters && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                                            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm bg-white">
                                                {categories.map(cat => <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>)}
                                            </select>
                                            {(searchTerm || selectedCategory !== 'all') && (
                                                <button onClick={() => { setSearchTerm(''); setSelectedCategory('all'); setShowFilters(false); }} className="text-xs text-orange-500 font-semibold hover:underline">
                                                    Clear filters
                                                </button>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {loadingShops ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {[...Array(8)].map((_, i) => <ShopCardSkeleton key={i} />)}
                                </div>
                            ) : filteredShops.length === 0 ? (
                                <motion.div variants={fadeInUp} className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                    <Store size={56} className="mx-auto text-gray-300 mb-3" />
                                    <p className="text-gray-400 font-medium">No shops found</p>
                                    <p className="text-sm text-gray-400 mt-1">Try adjusting your search</p>
                                </motion.div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {filteredShops.map((shop, idx) => (
                                        <motion.div key={shop._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                                            <ShopCard shop={shop} onClick={setSelectedShop} />
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Coupons Tab */}
                    {tab === 'coupons' && (
                        <motion.div initial="initial" animate="animate" variants={staggerContainer} className="space-y-6 pb-16">
                            <motion.div variants={fadeInUp} className="relative overflow-hidden bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 rounded-2xl p-6 text-white shadow-xl">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
                                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-2"><Gift size={20} /><h3 className="text-xl font-bold">Monthly Discount Coupon</h3></div>
                                    <p className="text-orange-100 text-sm mb-4">Based on your leaderboard rank and completed jobs, earn a discount coupon every month. Valid for 7 days once generated.</p>
                                    {activeCoupon ? (
                                        <div className="bg-white/20 backdrop-blur rounded-xl p-4">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div><p className="text-orange-100 text-xs uppercase tracking-wider">Your Active Coupon</p><p className="font-mono font-black text-2xl tracking-wider">{activeCoupon.code}</p><p className="text-orange-100 text-sm mt-1">{activeCoupon.discountPct}% OFF</p></div>
                                                <div className="text-right"><p className="text-orange-100 text-xs">Expires in</p><p className="font-bold text-xl">{Math.ceil((new Date(activeCoupon.expiresAt) - new Date()) / (1000 * 60 * 60 * 24))} days</p></div>
                                            </div>
                                        </div>
                                    ) : (
                                        <motion.button whileTap={{ scale: 0.95 }} onClick={generate} disabled={generating} className="flex items-center justify-center gap-2 bg-white text-orange-600 px-6 py-3 rounded-xl font-bold text-sm hover:shadow-lg transition-all disabled:opacity-50 w-full sm:w-auto">
                                            {generating ? <><RefreshCw size={16} className="animate-spin" /> Generating...</> : <><Gift size={16} /> Generate My Coupon</>}
                                        </motion.button>
                                    )}
                                </div>
                            </motion.div>

                            <motion.div variants={fadeInUp} className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5">
                                <div className="flex items-start gap-3"><Award size={20} className="text-blue-600 flex-shrink-0 mt-0.5" /><div><h4 className="font-bold text-blue-800">How to Earn Coupons</h4><p className="text-sm text-blue-700">Complete jobs and climb the leaderboard to earn higher discount tiers:</p><div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3"><div className="bg-white/60 rounded-lg p-2 text-center"><p className="font-bold text-blue-700">5%</p><p className="text-xs text-blue-600">25+ points</p></div><div className="bg-white/60 rounded-lg p-2 text-center"><p className="font-bold text-blue-700">10%</p><p className="text-xs text-blue-600">50+ points</p></div><div className="bg-white/60 rounded-lg p-2 text-center"><p className="font-bold text-blue-700">15%</p><p className="text-xs text-blue-600">100+ points</p></div><div className="bg-white/60 rounded-lg p-2 text-center"><p className="font-bold text-blue-700">20%</p><p className="text-xs text-blue-600">200+ points</p></div></div><p className="text-xs text-blue-600 mt-3 flex items-center gap-1"><Clock size={10} /> One coupon per month · Valid for 7 days · Min purchase ₹1000</p></div></div>
                            </motion.div>

                            <div><div className="flex items-center justify-between mb-4"><h3 className="font-bold text-gray-800 text-lg flex items-center gap-2"><History size={18} className="text-orange-500" /> Coupon History</h3><span className="text-xs text-gray-400">{myCoupons.length} total</span></div>
                                {myCoupons.length === 0 ? (<div className="text-center py-12 bg-white rounded-2xl border border-gray-100"><Ticket size={48} className="mx-auto text-gray-300 mb-2" /><p className="text-gray-400 font-medium">No coupons yet</p><p className="text-sm text-gray-400 mt-1">Complete jobs to earn your first coupon!</p></div>) : (<div className="space-y-3">{myCoupons.map(c => <CouponCard key={c._id} coupon={c} onCopyCode={() => toast.success('Coupon code copied!')} />)}</div>)}
                            </div>
                        </motion.div>
                    )}

                    {/* Shopping History Tab */}
                    {tab === 'shopping-history' && (
                        <motion.div initial="initial" animate="animate" variants={staggerContainer} className="space-y-4 pb-16">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                                        <ShoppingBag size={18} className="text-orange-500" /> Bought / Shopping History
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-1">Your previous purchases with coupon and shop details</p>
                                </div>
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={loadPurchaseHistory}
                                    className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:border-orange-300"
                                >
                                    <RefreshCw size={13} className={loadingHistory ? 'animate-spin' : ''} /> Refresh
                                </motion.button>
                            </div>

                            {loadingHistory ? (
                                <div className="grid grid-cols-1 gap-3">
                                    {[...Array(4)].map((_, i) => <ShopCardSkeleton key={`history-skel-${i}`} />)}
                                </div>
                            ) : purchaseHistory.length === 0 ? (
                                <div className="text-center py-14 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                    <ShoppingBag size={48} className="mx-auto text-gray-300 mb-2" />
                                    <p className="text-gray-500 font-semibold">No shopping history yet</p>
                                    <p className="text-sm text-gray-400 mt-1">Your purchases will appear here after using coupons at partner shops.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {purchaseHistory.map((txn) => {
                                        const productImage = txn.productPhoto || txn.product?.image;
                                        const boughtAt = txn.createdAt ? new Date(txn.createdAt) : null;
                                        return (
                                            <motion.div
                                                key={txn._id}
                                                initial={{ opacity: 0, y: 18 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                                            >
                                                <div className="p-4 border-b bg-gradient-to-r from-orange-50 to-amber-50">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="font-black text-gray-800 text-sm">{txn.product?.name || 'Product'}</p>
                                                        <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                                                            {txn.coupon?.discountPct ?? txn.discountPct ?? 0}% OFF
                                                        </span>
                                                    </div>
                                                    {txn.product?.description && (
                                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{txn.product.description}</p>
                                                    )}
                                                </div>

                                                <div className="p-4 space-y-3">
                                                    <div className="flex gap-3">
                                                        <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border">
                                                            {productImage ? (
                                                                <img src={imgSrc(productImage)} alt="Product" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-gray-400"><Package size={18} /></div>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 space-y-1 text-xs">
                                                            <p className="font-semibold text-gray-700 flex items-center gap-1"><Store size={12} /> {txn.shop?.shopName || 'Unknown shop'}</p>
                                                            <p className="text-gray-500">{txn.shop?.category || 'General Tools'}</p>
                                                            <p className="text-gray-500 line-clamp-2">{[txn.shop?.address, txn.shop?.city].filter(Boolean).join(', ') || 'Address unavailable'}</p>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                        <div className="bg-gray-50 rounded-lg p-2">
                                                            <p className="text-gray-400">Original Price</p>
                                                            <p className="font-bold text-gray-800">₹{Number(txn.originalPrice || 0).toLocaleString('en-IN')}</p>
                                                        </div>
                                                        <div className="bg-green-50 rounded-lg p-2">
                                                            <p className="text-green-600">Discount</p>
                                                            <p className="font-bold text-green-700">-₹{Number(txn.discountAmount || 0).toLocaleString('en-IN')}</p>
                                                        </div>
                                                        <div className="bg-orange-50 rounded-lg p-2">
                                                            <p className="text-orange-600">Final Price</p>
                                                            <p className="font-black text-orange-700">₹{Number(txn.finalPrice || 0).toLocaleString('en-IN')}</p>
                                                        </div>
                                                        <div className="bg-purple-50 rounded-lg p-2">
                                                            <p className="text-purple-600">Coupon</p>
                                                            <p className="font-mono font-bold text-purple-700">{txn.coupon?.code || 'N/A'}</p>
                                                        </div>
                                                    </div>

                                                    <div className="pt-1 border-t text-xs text-gray-500 flex items-center justify-between gap-2">
                                                        <span className="flex items-center gap-1"><Calendar size={12} /> {boughtAt ? boughtAt.toLocaleDateString('en-IN') : 'N/A'}</span>
                                                        <span className="flex items-center gap-1"><Clock3 size={12} /> {boughtAt ? boughtAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Coupon History Tab */}
                    {tab === 'coupon-history' && (
                        <CouponHistorySection />
                    )}
                </div>
            </div>
        </ErrorBoundary>
    );
};

export default WorkerShops;