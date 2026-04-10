// client/src/pages/worker/WorkerShops.jsx
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
    IndianRupee, ExternalLink, Copy, Check, ShoppingBag,
    Shield, Zap, Sparkles, Heart, Eye, History,
    ZoomIn, ZoomOut, ChevronLeft
} from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const imgSrc = (p) => p ? (p.startsWith('http') ? p : `${BASE_URL}/${p.replace(/^\//, '')}`) : null;

// ── ERROR BOUNDARY ─────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error, errorInfo) {
        console.error('Component error:', error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="p-4 sm:p-8 text-center">
                    <AlertCircle className="mx-auto text-red-500 mb-3" size={48} />
                    <p className="text-gray-600 text-sm sm:text-base">Something went wrong. Please refresh the page.</p>
                </div>
            );
        }
        return this.props.children;
    }
}

// ── FULL SCREEN IMAGE VIEWER ──────────────────────────────────────────────────
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

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 3));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.5, 0.5));

    return (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center">
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full bg-black/50 hover:bg-black/70 transition-all z-10 active:scale-95"
            >
                <X size={24} />
            </button>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 backdrop-blur-lg rounded-full p-2 z-10">
                <button onClick={handleZoomOut} className="p-2 text-white hover:bg-white/20 rounded-full active:scale-95">
                    <ZoomOut size={18} />
                </button>
                <button onClick={handleZoomIn} className="p-2 text-white hover:bg-white/20 rounded-full active:scale-95">
                    <ZoomIn size={18} />
                </button>
            </div>
            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                <button
                    onClick={() => setCurrentIndex(prev => prev > 0 ? prev - 1 : images.length - 1)}
                    className="p-2 text-white hover:bg-white/20 rounded-full active:scale-95"
                >
                    <ChevronLeft size={24} />
                </button>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
                <button
                    onClick={() => setCurrentIndex(prev => prev < images.length - 1 ? prev + 1 : 0)}
                    className="p-2 text-white hover:bg-white/20 rounded-full active:scale-95"
                >
                    <ChevronRight size={24} />
                </button>
            </div>
            <div style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s' }} className="max-w-full max-h-full">
                <img
                    src={imgSrc(images[currentIndex])}
                    alt=""
                    className="max-h-screen max-w-screen object-contain"
                />
            </div>
            {images.length > 1 && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white/60 text-sm">
                    {currentIndex + 1} / {images.length}
                </div>
            )}
        </div>
    );
};

// ── COUPON CARD ───────────────────────────────────────────────────────────────
const CouponCard = ({ coupon, onCopyCode }) => {
    const [copied, setCopied] = useState(false);
    const isExpired = new Date(coupon.expiresAt) < new Date();
    const daysLeft = Math.ceil((new Date(coupon.expiresAt) - new Date()) / (1000 * 60 * 60 * 24));

    const handleCopy = () => {
        navigator.clipboard.writeText(coupon.code).catch(() => {});
        setCopied(true);
        onCopyCode && onCopyCode(coupon.code);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-5 border-2 transition-all duration-300 hover:shadow-lg ${
            coupon.isUsed ? 'bg-gray-50 border-gray-200 opacity-70' :
            isExpired ? 'bg-red-50 border-red-200' :
            'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 hover:scale-[1.01] sm:hover:scale-[1.02]'
        }`}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-lg sm:text-2xl flex-shrink-0 ${
                        coupon.isUsed || isExpired ? 'bg-gray-200 text-gray-500' : 'bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg'
                    }`}>
                        {coupon.discountPct}%
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                            <span className="font-mono font-bold text-gray-800 text-base sm:text-xl tracking-wider break-all">{coupon.code}</span>
                            <button onClick={handleCopy} className="p-1 hover:bg-white/50 rounded-lg transition-all active:scale-95">
                                {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-gray-400" />}
                            </button>
                        </div>
                        <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
                            {coupon.isUsed ? 'Used' : isExpired ? 'Expired' : `Expires in ${daysLeft} days`}
                        </p>
                    </div>
                </div>
                <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap ${
                    coupon.isUsed ? 'bg-gray-200 text-gray-600' :
                    isExpired ? 'bg-red-100 text-red-700' :
                    'bg-green-100 text-green-700'
                }`}>
                    {coupon.isUsed ? 'Used' : isExpired ? 'Expired' : 'Active'}
                </span>
            </div>

            {coupon.isUsed && coupon.usedBy && (
                <div className="mt-3 bg-white/80 rounded-xl p-2 sm:p-3 text-xs sm:text-sm">
                    <p className="text-gray-600">Used at: <span className="font-semibold text-orange-600">{coupon.usedBy.shopName}</span></p>
                    <p className="text-[10px] sm:text-xs text-gray-400 mt-1 break-words">{coupon.usedBy.address}, {coupon.usedBy.city}</p>
                </div>
            )}

            {!coupon.isUsed && !isExpired && (
                <div className="mt-3 sm:mt-4 bg-white rounded-xl p-2 sm:p-3 border border-orange-100">
                    <p className="text-[10px] sm:text-xs text-orange-700 font-medium flex items-center gap-1">
                        <Sparkles size={10} /> Show this code at any KarigarConnect partner shop for {coupon.discountPct}% off on tools ≥ ₹1000
                    </p>
                </div>
            )}
        </div>
    );
};

// ── SHOP CARD SKELETON ────────────────────────────────────────────────────────
const ShopCardSkeleton = () => (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-orange-50 overflow-hidden animate-pulse">
        <div className="h-24 sm:h-28 bg-gray-100" />
        <div className="p-3 sm:p-4 space-y-2">
            <div className="h-4 bg-gray-100 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
            <div className="h-3 bg-gray-100 rounded w-1/3" />
        </div>
    </div>
);

// ── SHOP CARD ─────────────────────────────────────────────────────────────────
const ShopCard = ({ shop, onClick }) => (
    <div
        className="group bg-white rounded-xl sm:rounded-2xl shadow-sm border border-orange-50 overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 active:scale-98"
        onClick={() => onClick(shop)}
    >
        <div className="relative h-24 sm:h-28 bg-gradient-to-r from-orange-100 to-amber-100 flex items-center justify-center overflow-hidden">
            {imgSrc(shop.shopLogo) ? (
                <img src={imgSrc(shop.shopLogo)} className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg sm:rounded-xl shadow-md group-hover:scale-110 transition-transform duration-300" alt="" />
            ) : (
                <Store size={28} className="text-orange-300" />
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all" />
        </div>
        <div className="p-3 sm:p-4">
            <h4 className="font-bold text-gray-800 text-sm sm:text-base truncate group-hover:text-orange-600 transition-colors">{shop.shopName}</h4>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 truncate">{shop.ownerName}</p>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2">
                <div className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-400">
                    <MapPin size={10} /> {shop.city}
                </div>
                <span className="bg-orange-100 text-orange-600 text-[8px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full truncate max-w-[100px]">{shop.category}</span>
            </div>
        </div>
    </div>
);

// ── SHOPS MAP MODAL ───────────────────────────────────────────────────────────
const ShopsMapModal = ({ shops, onClose }) => {
    const mapContainer = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef([]);

    useEffect(() => {
        if (!mapContainer.current) return;

        if (!mapInstance.current) {
            mapInstance.current = L.map(mapContainer.current).setView([20.5937, 78.9629], 5);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap',
                maxZoom: 19,
            }).addTo(mapInstance.current);
        }

        markersRef.current.forEach(m => mapInstance.current.removeLayer(m));
        markersRef.current = [];

        const bounds = L.latLngBounds();
        shops.forEach(shop => {
            if (shop.shopLocation?.latitude && shop.shopLocation?.longitude) {
                const marker = L.marker([shop.shopLocation.latitude, shop.shopLocation.longitude])
                    .bindPopup(`
                        <div class="text-sm">
                            <h3 class="font-bold text-orange-600">${shop.shopName}</h3>
                            <p class="text-xs text-gray-600">${shop.category}</p>
                            <p class="text-xs text-gray-600">${shop.address}, ${shop.city}</p>
                            <p class="text-xs font-semibold text-blue-600 mt-1">Lat: ${shop.shopLocation.latitude.toFixed(4)}, Lng: ${shop.shopLocation.longitude.toFixed(4)}</p>
                        </div>
                    `)
                    .addTo(mapInstance.current);
                markersRef.current.push(marker);
                bounds.extend([shop.shopLocation.latitude, shop.shopLocation.longitude]);
            }
        });

        if (markersRef.current.length > 0) {
            mapInstance.current.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [shops]);

    const shopsWithLocation = shops.filter(s => s.shopLocation?.latitude).length;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full h-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-4 sm:p-6 bg-gradient-to-r from-blue-500 to-blue-600 flex-shrink-0">
                    <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                        <MapPin size={24} />
                        Shops Map View
                    </h2>
                    <button onClick={onClose} className="text-white/80 hover:text-white p-2 hover:bg-white/20 rounded-full transition-all">
                        <X size={24} />
                    </button>
                </div>
                <div ref={mapContainer} className="flex-1" style={{ minHeight: '400px' }} />
                <div className="p-4 bg-gray-50 border-t flex-shrink-0">
                    <p className="text-xs sm:text-sm text-gray-600">
                        Showing {shopsWithLocation} shop(s) with location data. Click markers for details.
                    </p>
                </div>
            </div>
        </div>
    );
};

// ── SHOP DETAIL MODAL ─────────────────────────────────────────────────────────
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
        let filtered = products.filter(p =>
            p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.description?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        filtered.sort((a, b) => {
            if (sortBy === 'price_asc') return a.price - b.price;
            if (sortBy === 'price_desc') return b.price - a.price;
            if (sortBy === 'name') return a.name?.localeCompare(b.name);
            return 0;
        });
        return filtered;
    }, [products, searchTerm, sortBy]);

    const handleImageClick = (image, allImages) => {
        setViewerImages(allImages);
        setViewerImage(image);
    };

    if (!shop) return null;

    return (
        <ErrorBoundary>
            {viewerImage && (
                <ImageViewer
                    images={viewerImages}
                    initialIndex={0}
                    onClose={() => setViewerImage(null)}
                />
            )}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                <div className="bg-white w-full sm:rounded-3xl shadow-2xl sm:max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-4 sm:p-5 flex items-start gap-3 sm:gap-4 flex-shrink-0">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl overflow-hidden border-2 border-white/30 bg-white/20 flex-shrink-0">
                            {imgSrc(shop.shopLogo) ? (
                                <img src={imgSrc(shop.shopLogo)} className="w-full h-full object-cover" alt="" />
                            ) : (
                                <Store size={24} className="text-white m-3" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base sm:text-xl font-black text-white truncate">{shop.shopName}</h3>
                            <p className="text-orange-100 text-xs sm:text-sm">{shop.category} · {shop.city}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <MapPin size={10} className="text-orange-200 flex-shrink-0" />
                                <p className="text-orange-100 text-[10px] sm:text-xs truncate">{shop.address}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-white/80 hover:text-white p-2 hover:bg-white/20 rounded-full transition-all active:scale-95">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="border-b px-4 sm:px-5 pt-3 flex gap-1 sm:gap-2 overflow-x-auto scrollbar-hide flex-shrink-0">
                        {[
                            { key: 'products', label: 'Products', icon: Package },
                            { key: 'info', label: 'Shop Info', icon: Store },
                        ].map(t => (
                            <button
                                key={t.key}
                                onClick={() => setActiveTab(t.key)}
                                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold rounded-t-xl transition-all whitespace-nowrap ${
                                    activeTab === t.key
                                        ? 'bg-orange-50 text-orange-600 border-b-2 border-orange-500'
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                <t.icon size={14} />
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Scrollable content */}
                    <div className="overflow-y-auto flex-1 p-4 sm:p-5 pb-20 sm:pb-8">
                        {/* Products Tab */}
                        {activeTab === 'products' && (
                            <div className="space-y-3 sm:space-y-4">
                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                    <div className="flex-1 relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search products..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-50"
                                        />
                                    </div>
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                        className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white"
                                    >
                                        <option value="name">Sort by Name</option>
                                        <option value="price_asc">Price: Low to High</option>
                                        <option value="price_desc">Price: High to Low</option>
                                    </select>
                                </div>

                                {loading ? (
                                    <div className="text-center py-8 sm:py-12">
                                        <div className="animate-spin h-8 w-8 sm:h-10 sm:w-10 border-4 border-orange-400 border-t-transparent rounded-full mx-auto" />
                                    </div>
                                ) : filteredProducts.length === 0 ? (
                                    <div className="text-center py-8 sm:py-12">
                                        <Package size={40} className="mx-auto text-gray-300 mb-2" />
                                        <p className="text-gray-400 text-sm">No products found</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3 sm:gap-4">
                                        {filteredProducts.map(p => {
                                            const eligible = p.price >= 1000 && discountPct > 0;
                                            const discount = eligible ? Math.round(p.price * discountPct / 100) : 0;
                                            const productImages = p.image ? [p.image] : [];

                                            return (
                                                <div key={p._id} className="group border border-gray-100 rounded-xl overflow-hidden hover:shadow-lg transition-all">
                                                    <div
                                                        className="relative h-32 sm:h-40 bg-gray-50 overflow-hidden cursor-pointer"
                                                        onClick={() => p.image && handleImageClick(p.image, productImages)}
                                                    >
                                                        {imgSrc(p.image) ? (
                                                            <>
                                                                <img src={imgSrc(p.image)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" alt="" />
                                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                                    <Maximize2 size={20} className="text-white" />
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <Package size={28} className="text-gray-300" />
                                                            </div>
                                                        )}
                                                        {eligible && (
                                                            <div className="absolute top-2 right-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full">
                                                                {discountPct}% OFF
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="p-3 sm:p-4">
                                                        <h5 className="font-bold text-gray-800 text-sm sm:text-base break-words">{p.name}</h5>
                                                        <p className="text-xs text-gray-500 line-clamp-2 mt-1">{p.description}</p>
                                                        <div className="mt-2 sm:mt-3">
                                                            {eligible ? (
                                                                <div>
                                                                    <p className="text-[10px] sm:text-xs text-gray-400 line-through">₹{p.price}</p>
                                                                    <div className="flex items-baseline gap-2 flex-wrap">
                                                                        <p className="font-black text-green-600 text-lg sm:text-xl">₹{p.price - discount}</p>
                                                                        <p className="text-[10px] sm:text-xs text-orange-600">Save ₹{discount}</p>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <p className="font-black text-gray-800 text-lg sm:text-xl">₹{p.price}</p>
                                                            )}
                                                        </div>
                                                        {p.price < 1000 && discountPct > 0 && (
                                                            <p className="text-[10px] sm:text-xs text-gray-400 mt-2 flex items-center gap-1">
                                                                <AlertCircle size={10} /> Discount applicable on ₹1000+
                                                            </p>
                                                        )}
                                                        <div className="mt-2 flex items-center justify-between">
                                                            <span className="text-[10px] sm:text-xs text-gray-400">Stock: {p.stock}</span>
                                                            {eligible && (
                                                                <span className="text-[10px] sm:text-xs text-green-600 font-medium flex items-center gap-1">
                                                                    <Zap size={10} /> Eligible
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Shop Info Tab */}
                        {activeTab === 'info' && shop && (
                            <div className="space-y-3 sm:space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                    {/* Contact Info */}
                                    <div className="bg-orange-50/60 rounded-xl p-3 sm:p-4">
                                        <p className="text-[10px] sm:text-xs font-bold text-orange-500 uppercase mb-2 sm:mb-3 flex items-center gap-1">
                                            <Phone size={10} /> Contact Information
                                        </p>
                                        <div className="space-y-2 sm:space-y-3">
                                            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm break-all">
                                                <Phone size={14} className="text-gray-400 flex-shrink-0" />
                                                <span className="text-gray-700 font-medium">{shop?.mobile || 'Not provided'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm break-all">
                                                <Mail size={14} className="text-gray-400 flex-shrink-0" />
                                                <span className="text-gray-700">{shop?.email || 'Not provided'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Business Details */}
                                    <div className="bg-blue-50/60 rounded-xl p-3 sm:p-4">
                                        <p className="text-[10px] sm:text-xs font-bold text-blue-500 uppercase mb-2 sm:mb-3 flex items-center gap-1">
                                            <Tag size={10} /> Business Details
                                        </p>
                                        <div className="space-y-2 sm:space-y-3">
                                            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                                                <Tag size={14} className="text-gray-400 flex-shrink-0" />
                                                <span className="text-gray-700">{shop?.category || 'General'}</span>
                                            </div>
                                            {shop?.gstNumber && (
                                                <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm break-all">
                                                    <Shield size={14} className="text-gray-400 flex-shrink-0" />
                                                    <span className="text-gray-700">GST: {shop.gstNumber}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                                                <Calendar size={14} className="text-gray-400 flex-shrink-0" />
                                                <span className="text-gray-700">
                                                    Member since {shop?.createdAt
                                                        ? new Date(shop.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })
                                                        : 'N/A'}
                                                </span>
                                            </div>
                                            {shop?.verificationStatus === 'approved' && (
                                                <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                                                    <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                                                    <span className="text-green-600 font-medium">Verified Shop</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Address */}
                                <div className="bg-purple-50/60 rounded-xl p-3 sm:p-4">
                                    <p className="text-[10px] sm:text-xs font-bold text-purple-500 uppercase mb-2 sm:mb-3 flex items-center gap-1">
                                        <MapPin size={10} /> Address
                                    </p>
                                    <div className="flex items-start gap-2 sm:gap-3">
                                        <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                                        <p className="text-xs sm:text-sm text-gray-700 break-words">
                                            {shop?.address}, {shop?.city}, {shop?.state || 'Maharashtra'} - {shop?.pincode}
                                        </p>
                                    </div>
                                </div>

                                {/* Live Location */}
                                {shop?.shopLocation?.latitude && shop?.shopLocation?.longitude && (
                                    <div className="bg-blue-50/60 rounded-xl p-3 sm:p-4 space-y-3">
                                        <p className="text-[10px] sm:text-xs font-bold text-blue-500 uppercase flex items-center gap-1">
                                            <MapPin size={10} /> Live Location
                                        </p>
                                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                            <div className="bg-white rounded-lg p-2 sm:p-2.5">
                                                <p className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase">Latitude</p>
                                                <p className="text-xs sm:text-sm font-semibold text-gray-800 break-all">{shop.shopLocation.latitude.toFixed(6)}</p>
                                            </div>
                                            <div className="bg-white rounded-lg p-2 sm:p-2.5">
                                                <p className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase">Longitude</p>
                                                <p className="text-xs sm:text-sm font-semibold text-gray-800 break-all">{shop.shopLocation.longitude.toFixed(6)}</p>
                                            </div>
                                        </div>
                                        <a
                                            href={`https://maps.google.com/?q=${shop.shopLocation.latitude},${shop.shopLocation.longitude}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 sm:py-2.5 rounded-lg text-center transition-all text-xs sm:text-sm active:scale-95"
                                        >
                                            View in Google Maps
                                        </a>
                                    </div>
                                )}

                                {/* About */}
                                {shop?.about && (
                                    <div className="bg-gray-50 rounded-xl p-3 sm:p-4">
                                        <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase mb-2">About Shop</p>
                                        <p className="text-xs sm:text-sm text-gray-700 break-words">{shop.about}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {discountPct > 0 && (
                        <div className="border-t bg-green-50 p-3 sm:p-4 flex-shrink-0">
                            <div className="flex items-center gap-2 text-green-700 text-xs sm:text-sm">
                                <Sparkles size={14} />
                                <p className="font-semibold">Your {discountPct}% discount applies to products with MRP ≥ ₹1000</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </ErrorBoundary>
    );
};

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
const WorkerShops = () => {
    const [tab, setTab] = useState('shops');
    const [shops, setShops] = useState([]);
    const [purchaseHistory, setPurchaseHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [myCoupons, setMyCoupons] = useState([]);
    const [selectedShop, setSelectedShop] = useState(null);
    const [showMapModal, setShowMapModal] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [loadingShops, setLoadingShops] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [showFilters, setShowFilters] = useState(false);

    const load = useCallback(() => {
        setLoadingShops(true);
        Promise.all([
            api.getApprovedShops(),
            api.getMyCoupons(),
        ]).then(([s, c]) => {
            setShops(s.data || []);
            setMyCoupons(c.data || []);
        }).catch(() => toast.error('Failed to load data'))
        .finally(() => setLoadingShops(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    // Fetch purchase history when tab is 'buyed'
    useEffect(() => {
        if (tab !== 'buyed') return;
        setLoadingHistory(true);
        api.getWorkerPurchaseHistory()
            .then(r => setPurchaseHistory(Array.isArray(r.data) ? r.data : []))
            .catch(() => toast.error('Failed to load purchase history.'))
            .finally(() => setLoadingHistory(false));
    }, [tab]);

    // Derive active coupon (not used, not expired)
    const activeCoupon = useMemo(() =>
        myCoupons.find(c => !c.isUsed && new Date(c.expiresAt) > new Date()),
    [myCoupons]);

    // Derive categories from shops
    const categories = useMemo(() => {
        const cats = new Set(shops.map(s => s.category).filter(Boolean));
        return ['all', ...Array.from(cats).sort()];
    }, [shops]);

    const filteredShops = useMemo(() => {
        let filtered = shops;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(s =>
                s.shopName?.toLowerCase().includes(term) ||
                s.category?.toLowerCase().includes(term) ||
                s.city?.toLowerCase().includes(term)
            );
        }
        if (selectedCategory !== 'all') {
            filtered = filtered.filter(s => s.category === selectedCategory);
        }
        return filtered;
    }, [shops, searchTerm, selectedCategory]);

    const generate = async () => {
        setGenerating(true);
        try {
            const { data } = await api.generateMyCoupon();
            if (data.alreadyHave) {
                toast.success('You already have a coupon this month!');
            } else {
                toast.success(`Coupon generated! ${data.discountPct}% discount.`);
            }
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Not eligible yet.');
        } finally { setGenerating(false); }
    };

    const copyCode = () => {
        toast.success('Coupon code copied!');
    };

    const tabList = [
        { key: 'shops',   label: 'Browse Shops',     icon: Store,       count: shops.length },
        { key: 'maps',    label: 'View Map',          icon: MapPin,      count: shops.filter(s => s.shopLocation?.latitude).length },
        { key: 'coupons', label: 'My Coupons',        icon: Ticket,      count: myCoupons.length },
        { key: 'buyed',   label: 'Purchase History',  icon: History,     count: purchaseHistory.length },
    ];

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50" style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.15rem' }}>
                {selectedShop && (
                    <ShopDetailModal
                        shop={selectedShop}
                        discountPct={activeCoupon?.discountPct || 0}
                        onClose={() => setSelectedShop(null)}
                    />
                )}

                {showMapModal && (
                    <ShopsMapModal
                        shops={shops}
                        onClose={() => setShowMapModal(false)}
                    />
                )}

                <div className="p-3 sm:p-4 md:p-6 max-w-6xl mx-auto pb-24 sm:pb-8">
                    {/* Header */}
                    <div className="mb-6 sm:mb-8">
                        <div className="flex items-center gap-2 sm:gap-3 mb-2">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0">
                                <Store size={20} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                                    Tool Shops
                                </h1>
                                <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
                                    Browse partner shops & use your earned coupons
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 sm:gap-2 bg-white rounded-xl sm:rounded-2xl p-1 mb-4 sm:mb-6 shadow-sm overflow-x-auto scrollbar-hide">
                        {tabList.map(({ key, label, icon: Icon, count }) => (
                            <button
                                key={key}
                                onClick={() => key === 'maps' ? setShowMapModal(true) : setTab(key)}
                                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                                    tab === key && key !== 'maps'
                                        ? 'bg-orange-600 text-white shadow-lg'
                                        : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                                }`}
                            >
                                <Icon size={14} />
                                {label}
                                {count > 0 && (
                                    <span className={`px-1 py-0.5 rounded-full text-[10px] ${
                                        tab === key ? 'bg-white/20' : 'bg-gray-100'
                                    }`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* SHOPS TAB */}
                    {tab === 'shops' && (
                        <div className="space-y-4 sm:space-y-5">
                            <div className="space-y-2">
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search shops..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2.5 sm:py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-50 transition-all"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowFilters(!showFilters)}
                                        className="flex items-center gap-1.5 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:border-orange-300 transition-all active:scale-95"
                                    >
                                        <Filter size={14} />
                                        Filter
                                        <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                                    </button>
                                    <button
                                        onClick={load}
                                        className="flex items-center gap-1.5 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:border-orange-300 transition-all active:scale-95"
                                    >
                                        <RefreshCw size={14} className={loadingShops ? 'animate-spin' : ''} />
                                        <span className="hidden xs:inline">Refresh</span>
                                    </button>
                                </div>
                                {showFilters && (
                                    <div className="space-y-2 pt-2">
                                        <select
                                            value={selectedCategory}
                                            onChange={(e) => setSelectedCategory(e.target.value)}
                                            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-orange-400 bg-white"
                                        >
                                            {categories.map(cat => (
                                                <option key={cat} value={cat}>
                                                    {cat === 'all' ? 'All Categories' : cat}
                                                </option>
                                            ))}
                                        </select>
                                        {(searchTerm || selectedCategory !== 'all') && (
                                            <button
                                                onClick={() => { setSearchTerm(''); setSelectedCategory('all'); setShowFilters(false); }}
                                                className="text-xs text-orange-500 font-semibold hover:underline"
                                            >
                                                Clear filters
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {loadingShops ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                                    {[...Array(6)].map((_, i) => <ShopCardSkeleton key={i} />)}
                                </div>
                            ) : filteredShops.length === 0 ? (
                                <div className="text-center py-12 sm:py-16 bg-white rounded-2xl border border-gray-100">
                                    <Store size={48} className="mx-auto text-gray-300 mb-3" />
                                    <p className="text-gray-400 font-medium text-sm">No shops found</p>
                                    <p className="text-xs text-gray-400 mt-1">Try adjusting your search</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
                                    {filteredShops.map(s => <ShopCard key={s._id} shop={s} onClick={setSelectedShop} />)}
                                </div>
                            )}
                        </div>
                    )}

                    {/* COUPONS TAB */}
                    {tab === 'coupons' && (
                        <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-8">
                            {/* Active Coupon Card */}
                            <div className="relative overflow-hidden bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl sm:rounded-2xl p-5 sm:p-6 text-white">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12" />
                                <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full -ml-10 -mb-10" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Gift size={18} />
                                        <h3 className="text-base sm:text-lg font-bold">Monthly Discount Coupon</h3>
                                    </div>
                                    <p className="text-orange-100 text-xs sm:text-sm mb-3 sm:mb-4">
                                        Based on your leaderboard rank and completed jobs, earn a discount coupon every month.
                                        Valid for 7 days once generated.
                                    </p>
                                    {activeCoupon ? (
                                        <div className="bg-white/20 backdrop-blur rounded-xl p-3 sm:p-4">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-orange-100 text-[10px] uppercase tracking-wider mb-1">Your Active Coupon</p>
                                                    <p className="font-mono font-black text-lg sm:text-2xl tracking-wider break-all">{activeCoupon.code}</p>
                                                    <p className="text-orange-100 text-xs sm:text-sm mt-1">{activeCoupon.discountPct}% OFF</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-orange-100 text-[10px]">Expires in</p>
                                                    <p className="font-bold text-base sm:text-lg">
                                                        {Math.ceil((new Date(activeCoupon.expiresAt) - new Date()) / (1000 * 60 * 60 * 24))} days
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={generate}
                                            disabled={generating}
                                            className="flex items-center justify-center gap-2 bg-white text-orange-600 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-sm hover:shadow-lg transition-all disabled:opacity-50 w-full sm:w-auto active:scale-95"
                                        >
                                            {generating ? (
                                                <><RefreshCw size={16} className="animate-spin" /> Generating...</>
                                            ) : (
                                                <><Gift size={16} /> Generate My Coupon</>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Eligibility Info */}
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 sm:p-5">
                                <div className="flex items-start gap-2 sm:gap-3">
                                    <Award size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-blue-800 text-sm sm:text-base mb-1">How to Earn Coupons</h4>
                                        <p className="text-xs sm:text-sm text-blue-700">Complete jobs and climb the leaderboard to earn higher discount tiers:</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-3">
                                            {[
                                                { pts: 25, discount: '5%' },
                                                { pts: 50, discount: '10%' },
                                                { pts: 100, discount: '15%' },
                                                { pts: 200, discount: '20%' },
                                            ].map(tier => (
                                                <div key={tier.pts} className="bg-white/60 rounded-lg p-1.5 sm:p-2 text-center">
                                                    <p className="font-bold text-blue-700 text-xs sm:text-sm">{tier.discount}</p>
                                                    <p className="text-[8px] sm:text-[10px] text-blue-600">{tier.pts}+ points</p>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[10px] sm:text-xs text-blue-600 mt-3 flex items-center gap-1">
                                            <Clock size={10} /> One coupon per month · Valid for 7 days · Min purchase ₹1000
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Coupon History */}
                            <div>
                                <div className="flex items-center justify-between mb-3 sm:mb-4">
                                    <h3 className="font-bold text-gray-800 text-base sm:text-lg flex items-center gap-2">
                                        <History size={16} className="text-orange-500" />
                                        Coupon History
                                    </h3>
                                    <span className="text-[10px] sm:text-xs text-gray-400">{myCoupons.length} total</span>
                                </div>
                                {myCoupons.length === 0 ? (
                                    <div className="text-center py-10 sm:py-12 bg-white rounded-2xl border border-gray-100">
                                        <Ticket size={40} className="mx-auto text-gray-300 mb-2" />
                                        <p className="text-gray-400 font-medium text-sm">No coupons yet</p>
                                        <p className="text-xs text-gray-400 mt-1">Complete jobs to earn your first coupon!</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 sm:space-y-3">
                                        {myCoupons.map(c => <CouponCard key={c._id} coupon={c} onCopyCode={copyCode} />)}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* PURCHASE HISTORY TAB */}
                    {tab === 'buyed' && (
                        <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-8">
                            <div className="flex items-center justify-between mb-3 sm:mb-4">
                                <h3 className="font-bold text-gray-800 text-base sm:text-lg flex items-center gap-2">
                                    <History size={16} className="text-orange-500" />
                                    Purchase History
                                </h3>
                                <span className="text-[10px] sm:text-xs text-gray-400">{purchaseHistory.length} total</span>
                            </div>
                            {loadingHistory ? (
                                <div className="text-center py-10 sm:py-12 bg-white rounded-2xl border border-gray-100">
                                    <RefreshCw size={40} className="mx-auto text-gray-300 mb-2 animate-spin" />
                                    <p className="text-gray-400 font-medium text-sm">Loading purchase history...</p>
                                </div>
                            ) : purchaseHistory.length === 0 ? (
                                <div className="text-center py-10 sm:py-12 bg-white rounded-2xl border border-gray-100">
                                    <ShoppingBag size={40} className="mx-auto text-gray-300 mb-2" />
                                    <p className="text-gray-400 font-medium text-sm">No purchases yet</p>
                                    <p className="text-xs text-gray-400 mt-1">Your purchases will appear here.</p>
                                </div>
                            ) : (
                                <div className="space-y-2 sm:space-y-3">
                                    {purchaseHistory.map((txn, i) => (
                                        <div key={txn._id || i} className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 flex items-center gap-3">
                                            {txn.product?.image ? (
                                                <img
                                                    src={imgSrc(txn.product.image)}
                                                    className="w-14 h-14 rounded-xl object-cover border-2 border-orange-100 flex-shrink-0"
                                                    alt={txn.product?.name || 'Product'}
                                                />
                                            ) : txn.productPhoto ? (
                                                <img
                                                    src={imgSrc(txn.productPhoto)}
                                                    className="w-14 h-14 rounded-xl object-cover border-2 border-orange-100 flex-shrink-0"
                                                    alt="Product"
                                                />
                                            ) : (
                                                <div className="w-14 h-14 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                                                    <ShoppingBag size={18} className="text-orange-300" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black text-gray-800 truncate text-sm">{txn.product?.name || 'Product'}</p>
                                                <p className="text-xs text-gray-500 truncate max-w-[180px]">{txn.product?.description}</p>
                                                <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                                    <p className="text-xs text-gray-500 truncate max-w-[100px]">{txn.shop?.shopName}</p>
                                                    <span className="text-gray-300">·</span>
                                                    <span className="text-[10px] font-mono text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">{txn.coupon?.code}</span>
                                                </div>
                                                <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                                                    <Calendar size={9} />
                                                    {new Date(txn.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="font-black text-green-700 text-base">₹{txn.finalPrice}</p>
                                                <p className="text-[10px] text-red-400 font-semibold">-₹{txn.discountAmount}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </ErrorBoundary>
    );
};

export default WorkerShops;