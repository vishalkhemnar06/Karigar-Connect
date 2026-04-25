// client/src/pages/admin/AdminShops.jsx
// PREMIUM VERSION - Modern design with gradients, animations, and enhanced UX

import React, { useEffect, useState, useMemo, useCallback, memo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as api from '../../api';
import { getImageUrl, imgError } from '../../utils/imageUrl';
import toast from 'react-hot-toast';
import {
    Store, Check, X, ShieldX, Trash2, Eye, Tag,
    History, Search, Clock, FileText, Image as ImageIcon,
    AlertCircle, MapPin, Phone, Mail, Hash, Calendar,
    CheckCircle, XCircle, Ban, ChevronDown, Download,
    Filter, SortAsc, SortDesc, RefreshCw, ChevronLeft,
    ChevronRight, Maximize2, Minimize2, ZoomIn, ZoomOut,
    Grid3x3, List, BarChart3, Users, Percent,
    TrendingUp, Star, Award, Printer, Building2,
    Home, Wallet, CreditCard, Gift, Heart, ThumbsUp,
    Crown, Diamond, Sparkles, Zap, Settings, Bell
} from 'lucide-react';

// Rupee Icon Component
const RupeeIcon = (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M6 3h12" />
        <path d="M6 8h12" />
        <path d="M6 13h8a4 4 0 1 1-4 4" />
        <path d="M6 17h8" />
    </svg>
);

// ── FULL SCREEN IMAGE VIEWER ──────────────────────────────────────────────────
const ImageViewer = memo(({ images, initialIndex, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [zoom, setZoom] = useState(1);
    const [isZoomed, setIsZoomed] = useState(false);

    const handlePrev = () => {
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
        setZoom(1);
        setIsZoomed(false);
    };

    const handleNext = () => {
        setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
        setZoom(1);
        setIsZoomed(false);
    };

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 3));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.5, 0.5));
    const handleZoomToggle = () => setIsZoomed(!isZoomed);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'ArrowRight') handleNext();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

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
                <button onClick={handleZoomOut} className="p-2 text-white hover:bg-white/20 rounded-full transition-all">
                    <ZoomOut size={18} />
                </button>
                <button onClick={handleZoomToggle} className="p-2 text-white hover:bg-white/20 rounded-full transition-all">
                    {isZoomed ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <button onClick={handleZoomIn} className="p-2 text-white hover:bg-white/20 rounded-full transition-all">
                    <ZoomIn size={18} />
                </button>
            </div>

            {images.length > 1 && (
                <>
                    <button onClick={handlePrev} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 rounded-full bg-black/50 hover:bg-black/70 transition-all">
                        <ChevronLeft size={28} />
                    </button>
                    <button onClick={handleNext} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 rounded-full bg-black/50 hover:bg-black/70 transition-all">
                        <ChevronRight size={28} />
                    </button>
                </>
            )}

            {images.length > 1 && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-lg px-4 py-2 rounded-full text-white text-sm font-medium">
                    {currentIndex + 1} / {images.length}
                </div>
            )}

            <div className="relative w-full h-full flex items-center justify-center cursor-pointer" onClick={isZoomed ? undefined : handleZoomToggle}>
                <img
                    src={getImageUrl(images[currentIndex])}
                    alt="Full screen"
                    className={`max-w-[95vw] max-h-[95vh] object-contain transition-transform duration-200 ${isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
                    style={{ transform: `scale(${zoom})` }}
                />
            </div>
        </motion.div>
    );
});
ImageViewer.displayName = 'ImageViewer';

// ── STATUS BADGE ──────────────────────────────────────────────────────────────
const StatusBadge = memo(({ status }) => {
    const config = {
        pending:  { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200', icon: Clock, label: 'Pending' },
        approved: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200', icon: CheckCircle, label: 'Approved' },
        rejected: { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200', icon: XCircle, label: 'Rejected' },
        blocked:  { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', icon: Ban, label: 'Blocked' },
    };
    const cfg = config[status] || config.pending;
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
            <Icon size={12} /> {cfg.label}
        </span>
    );
});
StatusBadge.displayName = 'StatusBadge';

// ── DETAIL ROW ────────────────────────────────────────────────────────────────
const DetailRow = memo(({ label, value, icon: Icon, color = 'orange' }) => {
    const colors = {
        orange: 'bg-orange-50 border-orange-100 text-orange-700',
        blue: 'bg-blue-50 border-blue-100 text-blue-700',
        green: 'bg-green-50 border-green-100 text-green-700',
        purple: 'bg-purple-50 border-purple-100 text-purple-700',
    };
    return (
        <div className={`rounded-xl p-3 border ${colors[color]}`}>
            <div className="flex items-center gap-1.5 mb-1">
                {Icon && <Icon size={12} className="opacity-70" />}
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
            </div>
            <p className="text-sm font-semibold break-words">{value || '—'}</p>
        </div>
    );
});
DetailRow.displayName = 'DetailRow';

// ── STATS CARD ────────────────────────────────────────────────────────────────
const StatsCard = memo(({ title, value, icon: Icon, gradient, trend }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
        className="bg-white rounded-xl p-5 shadow-md border border-gray-100 hover:shadow-lg transition-all"
    >
        <div className="flex items-start justify-between">
            <div>
                <p className="text-xs text-gray-500 font-medium">{title}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
                {trend && (
                    <p className={`text-xs font-medium mt-2 flex items-center gap-1 ${trend.positive ? 'text-emerald-600' : 'text-red-600'}`}>
                        <TrendingUp size={12} /> {trend.value}
                    </p>
                )}
            </div>
            <div className={`p-3 rounded-xl bg-gradient-to-r ${gradient} shadow-md`}>
                <Icon size="20" className="text-white" />
            </div>
        </div>
    </motion.div>
));
StatsCard.displayName = 'StatsCard';

// ── DOCUMENT VIEWER ───────────────────────────────────────────────────────────
const DocViewer = memo(({ path, label, idType, onImageClick }) => {
    const url = getImageUrl(path, null);
    if (!url) return <p className="text-gray-400 text-sm italic">Not uploaded</p>;

    const isPdf = typeof path === 'string' ? path.toLowerCase().endsWith('.pdf') : (path?.filePath || '').toLowerCase().endsWith('.pdf');

    const handleClick = () => {
        if (!isPdf && onImageClick) {
            onImageClick(url);
        } else if (isPdf) {
            window.open(url, '_blank');
        }
    };

    return (
        <div className="space-y-2">
            {!isPdf && (
                <div onClick={handleClick} className="cursor-pointer relative group overflow-hidden rounded-xl border border-gray-200 bg-gray-50 hover:shadow-lg transition-all">
                    <img src={url} onError={imgError()} className="w-full max-h-40 object-contain" alt={label} />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Maximize2 size={24} className="text-white" />
                    </div>
                </div>
            )}
            <a href={url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg text-sm font-semibold transition-all border border-orange-200">
                {isPdf ? <FileText size={15} /> : <ImageIcon size={15} />}
                {isPdf ? 'Open PDF' : 'View Full Image'}
                {idType && ` (${idType})`}
            </a>
        </div>
    );
});
DocViewer.displayName = 'DocViewer';

// ── SHOP DETAIL MODAL ─────────────────────────────────────────────────────────
const ShopDetailModal = memo(({ shop, onClose, onApprove, onReject, onBlock, onDelete }) => {
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [activeTab, setActiveTab] = useState('info');
    const [viewerImage, setViewerImage] = useState(null);
    const [viewerImages, setViewerImages] = useState([]);
    const [viewerIndex, setViewerIndex] = useState(0);

    const logoUrl = getImageUrl(shop?.shopLogo, null);
    const photoUrl = getImageUrl(shop?.ownerPhoto, null);
    const idProofUrl = getImageUrl(shop?.idProof?.filePath || shop?.idProof, null);
    const shopPhotoUrl = getImageUrl(shop?.shopPhoto, null);
    const gstnCertUrl = getImageUrl(shop?.gstnCertificate, null);

    const stats = useMemo(() => ({
        totalCoupons: shop?.couponsCount || 0,
        usedCoupons: shop?.usedCouponsCount || 0,
        totalSales: shop?.totalSales || 0,
        rating: shop?.rating || 0,
    }), [shop]);

    const allImages = useMemo(() => [
        ...(logoUrl ? [{ url: logoUrl, name: 'Shop Logo' }] : []),
        ...(photoUrl ? [{ url: photoUrl, name: 'Owner Photo' }] : []),
        ...(shopPhotoUrl ? [{ url: shopPhotoUrl, name: 'Shop Photo' }] : []),
        ...(idProofUrl && !idProofUrl.toLowerCase().endsWith('.pdf') ? [{ url: idProofUrl, name: 'ID Proof' }] : []),
        ...(gstnCertUrl && !gstnCertUrl.toLowerCase().endsWith('.pdf') ? [{ url: gstnCertUrl, name: 'GSTN Certificate' }] : []),
    ], [logoUrl, photoUrl, shopPhotoUrl, idProofUrl, gstnCertUrl]);

    const handleImageClick = useCallback((url, index) => {
        setViewerImages(allImages.map(img => img.url));
        setViewerIndex(index);
        setViewerImage(url);
    }, [allImages]);

    if (!shop) return null;

    return (
        <>
            <AnimatePresence>
                {viewerImage && (
                    <ImageViewer images={viewerImages} initialIndex={viewerIndex} onClose={() => setViewerImage(null)} />
                )}
            </AnimatePresence>

            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                >
                    <motion.div
                        initial={{ scale: 0.95, y: 20, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.95, y: 20, opacity: 0 }}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-5 flex items-center gap-4 flex-shrink-0">
                            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-md flex items-center justify-center flex-shrink-0 cursor-pointer hover:scale-105 transition-transform bg-white"
                                onClick={() => logoUrl && handleImageClick(logoUrl, allImages.findIndex(img => img.url === logoUrl))}>
                                {logoUrl ? (
                                    <img src={logoUrl} onError={imgError()} className="w-full h-full object-cover" alt="logo" />
                                ) : (
                                    <Store size={28} className="text-orange-400" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-xl font-bold text-white truncate">{shop.shopName}</h3>
                                <p className="text-orange-100 text-sm">{shop.category} · {shop.city}</p>
                                <div className="mt-1"><StatusBadge status={shop.verificationStatus} /></div>
                            </div>
                            <button onClick={onClose} className="text-white/80 hover:text-white p-2 hover:bg-white/20 rounded-full transition-all flex-shrink-0">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="border-b px-5 pt-3 flex gap-2 bg-white">
                            {[
                                { key: 'info', label: 'Information', icon: Store },
                                { key: 'documents', label: 'Documents', icon: FileText },
                                { key: 'statistics', label: 'Performance', icon: BarChart3 },
                            ].map(tab => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.key;
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveTab(tab.key)}
                                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-t-xl transition-all ${
                                            isActive ? 'bg-orange-50 text-orange-600 border-b-2 border-orange-500' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        <Icon size="16" /> {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Body */}
                        <div className="overflow-y-auto flex-1 p-5 space-y-5">
                            {activeTab === 'info' && (
                                <>
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <div className="w-5 h-0.5 bg-orange-400 rounded-full" /> Owner & Contact
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            <DetailRow label="Owner Name" value={shop.ownerName} icon={Users} color="orange" />
                                            <DetailRow label="Mobile" value={shop.mobile} icon={Phone} color="blue" />
                                            <DetailRow label="Email" value={shop.email} icon={Mail} color="purple" />
                                            <DetailRow label="GST No." value={shop.gstNumber || 'Not Provided'} icon={Hash} color="green" />
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <div className="w-5 h-0.5 bg-orange-400 rounded-full" /> Shop Details
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            <DetailRow label="Shop Name" value={shop.shopName} icon={Store} color="orange" />
                                            <DetailRow label="Category" value={shop.category} icon={Tag} color="blue" />
                                            <DetailRow label="Address" value={shop.address} icon={MapPin} color="purple" />
                                            <DetailRow label="City" value={shop.city} icon={Building2} color="green" />
                                            <DetailRow label="Pincode" value={shop.pincode} icon={Hash} color="orange" />
                                            <DetailRow label="Registered" value={new Date(shop.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} icon={Calendar} color="purple" />
                                        </div>
                                    </div>

                                    {shop.shopLocation?.latitude && shop.shopLocation?.longitude && (
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                <div className="w-5 h-0.5 bg-blue-400 rounded-full" /> Live Location
                                            </h4>
                                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="bg-white rounded-lg p-2">
                                                        <p className="text-[10px] font-bold text-gray-500 uppercase">Latitude</p>
                                                        <p className="text-sm font-bold text-gray-800">{shop.shopLocation.latitude.toFixed(6)}</p>
                                                    </div>
                                                    <div className="bg-white rounded-lg p-2">
                                                        <p className="text-[10px] font-bold text-gray-500 uppercase">Longitude</p>
                                                        <p className="text-sm font-bold text-gray-800">{shop.shopLocation.longitude.toFixed(6)}</p>
                                                    </div>
                                                </div>
                                                <a href={`https://maps.google.com/?q=${shop.shopLocation.latitude},${shop.shopLocation.longitude}`} target="_blank" rel="noopener noreferrer"
                                                    className="block w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 rounded-lg text-center transition-all text-sm">
                                                    Open in Google Maps
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {activeTab === 'documents' && (
                                <div>
                                    <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <div className="w-5 h-0.5 bg-orange-400 rounded-full" /> Documents & Photos
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div className="space-y-2">
                                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Shop Logo</p>
                                            {logoUrl ? (
                                                <div onClick={() => handleImageClick(logoUrl, allImages.findIndex(img => img.url === logoUrl))}
                                                    className="cursor-pointer group relative overflow-hidden rounded-xl border-2 border-orange-100 bg-orange-50">
                                                    <img src={logoUrl} onError={imgError()} className="w-full h-40 object-contain" alt="Shop Logo" />
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <Maximize2 size={24} className="text-white" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="w-full h-40 bg-gray-100 rounded-xl flex items-center justify-center">
                                                    <p className="text-gray-400 text-xs">Not uploaded</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Owner Photo</p>
                                            {photoUrl ? (
                                                <div onClick={() => handleImageClick(photoUrl, allImages.findIndex(img => img.url === photoUrl))}
                                                    className="cursor-pointer group relative overflow-hidden rounded-xl border-2 border-orange-100 bg-orange-50">
                                                    <img src={photoUrl} onError={imgError()} className="w-full h-40 object-cover" alt="Owner" />
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <Maximize2 size={24} className="text-white" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="w-full h-40 bg-gray-100 rounded-xl flex items-center justify-center">
                                                    <p className="text-gray-400 text-xs">Not uploaded</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">ID Proof {shop.idProof?.idType ? `(${shop.idProof.idType})` : ''}</p>
                                            <DocViewer path={shop.idProof?.filePath || shop.idProof} label="ID Document" idType={shop.idProof?.idType} onImageClick={handleImageClick} />
                                        </div>

                                        {gstnCertUrl && (
                                            <div className="space-y-2">
                                                <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">GSTN Certificate</p>
                                                <DocViewer path={shop.gstnCertificate} label="GSTN Certificate" onImageClick={handleImageClick} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'statistics' && (
                                <div>
                                    <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <div className="w-5 h-0.5 bg-orange-400 rounded-full" /> Shop Performance
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 text-center">
                                            <Award size="24" className="text-blue-600 mx-auto mb-2" />
                                            <p className="text-2xl font-bold text-blue-700">{stats.rating || 'N/A'}</p>
                                            <p className="text-xs text-blue-600 font-medium">Rating</p>
                                        </div>
                                        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 text-center">
                                            <Tag size="24" className="text-green-600 mx-auto mb-2" />
                                            <p className="text-2xl font-bold text-green-700">{stats.totalCoupons}</p>
                                            <p className="text-xs text-green-600 font-medium">Total Coupons</p>
                                        </div>
                                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 text-center">
                                            <CheckCircle size="24" className="text-purple-600 mx-auto mb-2" />
                                            <p className="text-2xl font-bold text-purple-700">{stats.usedCoupons}</p>
                                            <p className="text-xs text-purple-600 font-medium">Used Coupons</p>
                                        </div>
                                        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 text-center">
                                            <RupeeIcon width={24} height={24} className="text-amber-600 mx-auto mb-2" />
                                            <p className="text-2xl font-bold text-amber-700">₹{stats.totalSales.toLocaleString()}</p>
                                            <p className="text-xs text-amber-600 font-medium">Total Sales</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="border-t bg-gray-50 p-4 flex flex-wrap gap-2 justify-end flex-shrink-0">
                            {shop.verificationStatus === 'pending' && (
                                <>
                                    <button onClick={() => onApprove(shop._id)} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all hover:shadow-md">
                                        <Check size="15" /> Approve
                                    </button>
                                    <button onClick={() => setShowRejectForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm transition-all hover:shadow-md">
                                        <X size="15" /> Reject
                                    </button>
                                </>
                            )}
                            {shop.verificationStatus === 'approved' && (
                                <button onClick={() => onBlock(shop._id)} className="flex items-center gap-2 px-5 py-2.5 bg-gray-700 hover:bg-gray-800 text-white rounded-xl font-bold text-sm transition-all">
                                    <ShieldX size="15" /> Block Shop
                                </button>
                            )}
                            {shop.verificationStatus === 'blocked' && (
                                <button onClick={() => onApprove(shop._id)} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all">
                                    <Check size="15" /> Unblock
                                </button>
                            )}
                            <button onClick={() => onDelete(shop._id)} className="flex items-center gap-2 px-5 py-2.5 border-2 border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl font-bold text-sm transition-all">
                                <Trash2 size="15" /> Delete
                            </button>
                            <button onClick={onClose} className="px-5 py-2.5 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-xl text-sm font-bold transition-all">
                                Close
                            </button>
                        </div>

                        {/* Reject Form */}
                        <AnimatePresence>
                            {showRejectForm && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="border-t border-rose-200 bg-rose-50 p-4 space-y-3"
                                >
                                    <p className="font-bold text-rose-800 text-sm flex items-center gap-2">
                                        <AlertCircle size="16" /> Rejection Reason
                                    </p>
                                    <textarea
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        placeholder="State the reason for rejection..."
                                        rows={3}
                                        className="w-full border border-rose-300 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-400"
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={() => { if (!rejectReason.trim()) return toast.error('Reason required.'); onReject(shop._id, rejectReason); }}
                                            disabled={!rejectReason.trim()}
                                            className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2 rounded-xl font-bold text-sm disabled:opacity-50">
                                            Confirm Reject
                                        </button>
                                        <button onClick={() => setShowRejectForm(false)} className="px-5 py-2 border border-gray-300 rounded-xl text-sm text-gray-600 font-semibold hover:bg-gray-50">
                                            Cancel
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        </>
    );
});
ShopDetailModal.displayName = 'ShopDetailModal';

// ── MAIN ADMIN SHOPS COMPONENT ────────────────────────────────────────────────
const AdminShops = () => {
    const navigate = useNavigate();
    const [tab, setTab] = useState('shops');
    const [shops, setShops] = useState([]);
    const [coupons, setCoupons] = useState([]);
    const [unclaimed, setUnclaimed] = useState([]);
    const [history, setHistory] = useState([]);
    const [selected, setSelected] = useState(null);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilter] = useState('all');
    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState('desc');
    const [viewMode, setViewMode] = useState('grid');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedShops, setSelectedShops] = useState([]);
    const [showFilters, setShowFilters] = useState(false);
    const searchTimeout = useRef(null);

    const onSearch = useCallback((e) => {
        const value = e.target.value;
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => setSearch(value), 300);
    }, []);

    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            const [s, c, u, h] = await Promise.all([
                api.adminGetAllShops(),
                api.adminGetAllCoupons(),
                api.adminGetUnclaimedCoupons(),
                api.adminGetCouponHistory(),
            ]);
            setShops(s.data);
            setCoupons(c.data);
            setUnclaimed(u.data);
            setHistory(h.data);
        } catch {
            toast.error('Failed to load data.');
        } finally {
            setLoading(false);
        }
    }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadAll();
        setRefreshing(false);
        toast.success('Data refreshed');
    };

    useEffect(() => { loadAll(); }, [loadAll]);

    const approve = useCallback(async (id) => {
        try {
            await api.adminApproveShop(id);
            toast.success('Shop approved & SMS sent!');
            setSelected(null);
            loadAll();
        } catch {
            toast.error('Failed.');
        }
    }, [loadAll]);

    const reject = useCallback(async (id, reason) => {
        try {
            await api.adminRejectShop(id, { reason });
            toast.success('Shop rejected, deleted from DB.');
            setSelected(null);
            loadAll();
        } catch {
            toast.error('Failed.');
        }
    }, [loadAll]);

    const block = useCallback(async (id) => {
        try {
            await api.adminBlockShop(id);
            toast.success('Shop blocked.');
            setSelected(null);
            loadAll();
        } catch {
            toast.error('Failed.');
        }
    }, [loadAll]);

    const del = useCallback(async (id) => {
        if (!window.confirm('Permanently delete this shop and all its data?')) return;
        try {
            await api.adminDeleteShop(id);
            toast.success('Deleted.');
            setSelected(null);
            loadAll();
        } catch {
            toast.error('Failed.');
        }
    }, [loadAll]);

    const counts = useMemo(() => ({
        all: shops.length,
        pending: shops.filter(s => s.verificationStatus === 'pending').length,
        approved: shops.filter(s => s.verificationStatus === 'approved').length,
        blocked: shops.filter(s => s.verificationStatus === 'blocked').length,
    }), [shops]);

    const filteredShops = useMemo(() => {
        let data = filterStatus === 'all' ? shops : shops.filter(s => s.verificationStatus === filterStatus);
        if (search) {
            const q = search.toLowerCase();
            data = data.filter(s =>
                s.shopName?.toLowerCase().includes(q) ||
                s.ownerName?.toLowerCase().includes(q) ||
                s.mobile?.includes(q) ||
                s.city?.toLowerCase().includes(q) ||
                s.category?.toLowerCase().includes(q)
            );
        }
        data.sort((a, b) => {
            let aVal = a[sortBy];
            let bVal = b[sortBy];
            if (sortBy === 'createdAt') {
                aVal = new Date(aVal);
                bVal = new Date(bVal);
            }
            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        return data;
    }, [shops, filterStatus, search, sortBy, sortOrder]);

    const exportToCSV = useCallback(() => {
        if (filteredShops.length === 0) { toast.error('No data to export'); return; }
        const data = filteredShops.map(shop => ({
            'Shop Name': shop.shopName,
            'Owner Name': shop.ownerName,
            'Mobile': shop.mobile,
            'Email': shop.email,
            'Category': shop.category,
            'City': shop.city,
            'Status': shop.verificationStatus,
            'Registered': new Date(shop.createdAt).toLocaleDateString(),
        }));
        const headers = Object.keys(data[0] || {});
        const csv = [headers.join(','), ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shops_export_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Export complete!');
    }, [filteredShops]);

    const toggleShopSelection = useCallback((shopId) => {
        setSelectedShops(prev => prev.includes(shopId) ? prev.filter(id => id !== shopId) : [...prev, shopId]);
    }, []);

    const toggleSelectAll = useCallback(() => {
        if (selectedShops.length === filteredShops.length && filteredShops.length > 0) {
            setSelectedShops([]);
        } else {
            setSelectedShops(filteredShops.map(s => s._id));
        }
    }, [selectedShops, filteredShops]);

    const bulkApprove = useCallback(async () => {
        if (selectedShops.length === 0) return;
        if (!window.confirm(`Approve ${selectedShops.length} shops?`)) return;
        try {
            await Promise.all(selectedShops.map(id => api.adminApproveShop(id)));
            toast.success(`${selectedShops.length} shops approved!`);
            setSelectedShops([]);
            loadAll();
        } catch {
            toast.error('Some approvals failed.');
        }
    }, [selectedShops, loadAll]);

    const bulkDelete = useCallback(async () => {
        if (selectedShops.length === 0) return;
        if (!window.confirm(`Delete ${selectedShops.length} shops permanently?`)) return;
        try {
            await Promise.all(selectedShops.map(id => api.adminDeleteShop(id)));
            toast.success(`${selectedShops.length} shops deleted!`);
            setSelectedShops([]);
            loadAll();
        } catch {
            toast.error('Some deletions failed.');
        }
    }, [selectedShops, loadAll]);

    const tabs = [
        { key: 'shops', label: 'All Shops', icon: Store, count: shops.length },
        { key: 'coupons', label: 'Coupons', icon: Tag, count: coupons.length },
        { key: 'history', label: 'History', icon: History, count: history.length },
    ];

    const filters = [
        { v: 'all', label: 'All', count: counts.all, color: 'gray' },
        { v: 'pending', label: 'Pending', count: counts.pending, color: 'amber' },
        { v: 'approved', label: 'Approved', count: counts.approved, color: 'emerald' },
        { v: 'blocked', label: 'Blocked', count: counts.blocked, color: 'gray' },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white pb-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-8">
                
                {/* Hero Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-xl">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                    <Store size="24" className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black">Shop Management</h1>
                                    <p className="text-white/90 text-sm mt-0.5">Manage partner shops and coupons</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="bg-white/15 rounded-xl px-3 py-1.5 text-center">
                                    <p className="text-xl font-bold">{shops.length}</p>
                                    <p className="text-[10px] text-white/80">Total Shops</p>
                                </div>
                                <div className="bg-white/15 rounded-xl px-3 py-1.5 text-center">
                                    <p className="text-xl font-bold">{counts.pending}</p>
                                    <p className="text-[10px] text-white/80">Pending</p>
                                </div>
                                <div className="bg-white/15 rounded-xl px-3 py-1.5 text-center">
                                    <p className="text-xl font-bold">{coupons.length}</p>
                                    <p className="text-[10px] text-white/80">Coupons</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <StatsCard title="Total Shops" value={counts.all} icon={Store} gradient="from-orange-500 to-amber-500" trend={{ positive: true, value: '+12%' }} />
                    <StatsCard title="Pending Approval" value={counts.pending} icon={Clock} gradient="from-amber-500 to-yellow-500" />
                    <StatsCard title="Active Shops" value={counts.approved} icon={CheckCircle} gradient="from-emerald-500 to-green-500" />
                    <StatsCard title="Total Coupons" value={coupons.length} icon={Tag} gradient="from-purple-500 to-pink-500" />
                </div>

                {/* Tabs */}
                <div className="flex gap-2 bg-white rounded-xl p-1.5 mb-6 shadow-sm border border-gray-100">
                    {tabs.map(({ key, label, icon: Icon, count }) => (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
                                tab === key ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            <Icon size="16" />
                            {label}
                            {count > 0 && <span className={`px-1.5 py-0.5 rounded-full text-xs ${tab === key ? 'bg-white/20' : 'bg-gray-100'}`}>{count}</span>}
                        </button>
                    ))}
                    <button onClick={handleRefresh} disabled={refreshing} className="p-2.5 border border-gray-200 rounded-lg hover:border-orange-300 transition-all">
                        <RefreshCw size="16" className={`text-orange-500 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Shops Tab */}
                {tab === 'shops' && (
                    <div className="space-y-4">
                        {/* Toolbar */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap gap-2">
                                <div className="relative">
                                    <Search size="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input type="text" placeholder="Search shops..." onChange={onSearch}
                                        className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm w-64 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all" />
                                </div>
                                <button onClick={() => setShowFilters(!showFilters)}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${showFilters ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600 hover:border-orange-300'}`}>
                                    <Filter size="14" /> Filters <ChevronDown size="14" className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-orange-600 text-white' : 'bg-white border border-gray-200 text-gray-400'}`}>
                                    <Grid3x3 size="16" />
                                </button>
                                <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-orange-600 text-white' : 'bg-white border border-gray-200 text-gray-400'}`}>
                                    <List size="16" />
                                </button>
                                <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-600 font-semibold text-sm hover:border-orange-300 transition-all">
                                    <Download size="14" /> Export
                                </button>
                            </div>
                        </div>

                        {/* Filters Panel */}
                        <AnimatePresence>
                            {showFilters && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                                    <div className="flex flex-wrap gap-3 items-center">
                                        <span className="text-sm font-semibold text-gray-700">Status:</span>
                                        {filters.map(f => (
                                            <button key={f.v} onClick={() => setFilter(f.v)}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filterStatus === f.v ? `bg-${f.color}-600 text-white` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                                {f.label} ({f.count})
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex flex-wrap gap-3 items-center mt-3 pt-3 border-t">
                                        <span className="text-sm font-semibold text-gray-700">Sort by:</span>
                                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">
                                            <option value="createdAt">Registration Date</option>
                                            <option value="shopName">Shop Name</option>
                                            <option value="ownerName">Owner Name</option>
                                            <option value="city">City</option>
                                        </select>
                                        <button onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                            className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:border-orange-300">
                                            {sortOrder === 'asc' ? <SortAsc size="14" /> : <SortDesc size="14" />}
                                            {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Bulk Actions */}
                        {selectedShops.length > 0 && (
                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <input type="checkbox" checked={selectedShops.length === filteredShops.length && filteredShops.length > 0} onChange={toggleSelectAll}
                                        className="w-4 h-4 rounded border-orange-300 text-orange-600 focus:ring-orange-500" />
                                    <span className="text-sm font-semibold text-orange-800">{selectedShops.length} shop(s) selected</span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={bulkApprove} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">Approve All</button>
                                    <button onClick={bulkDelete} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium">Delete All</button>
                                    <button onClick={() => setSelectedShops([])} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Clear</button>
                                </div>
                            </div>
                        )}

                        {/* Shops Grid/List */}
                        {loading ? (
                            <div className="flex items-center justify-center py-20"><Loader2 size="40" className="animate-spin text-orange-500" /></div>
                        ) : filteredShops.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-xl border border-gray-100"><Store size="48" className="text-gray-300 mx-auto mb-3" /><p className="text-gray-500 font-medium">No shops found</p><p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p></div>
                        ) : viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredShops.map(shop => {
                                    const logo = getImageUrl(shop.shopLogo, null);
                                    const isSelected = selectedShops.includes(shop._id);
                                    return (
                                        <motion.div key={shop._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -4 }}
                                            className={`bg-white rounded-xl border shadow-md hover:shadow-xl transition-all overflow-hidden group ${isSelected ? 'ring-2 ring-orange-500 ring-offset-2' : 'border-gray-100'}`}>
                                            <div className="relative">
                                                <div className="h-32 flex items-center justify-center cursor-pointer bg-gradient-to-r from-orange-50 to-amber-50" onClick={() => setSelected(shop)}>
                                                    {logo ? <img src={logo} onError={imgError()} className="w-20 h-20 rounded-full object-cover border-2 border-orange-300 shadow-md group-hover:scale-110 transition-transform" alt="logo" />
                                                        : <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center"><Store size="28" className="text-orange-400" /></div>}
                                                </div>
                                                <input type="checkbox" checked={isSelected} onChange={() => toggleShopSelection(shop._id)} className="absolute top-2 left-2 w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 bg-white" onClick={(e) => e.stopPropagation()} />
                                                <div className="absolute top-2 right-2"><StatusBadge status={shop.verificationStatus} /></div>
                                            </div>
                                            <div className="p-4">
                                                <h3 className="font-bold text-gray-800 truncate">{shop.shopName}</h3>
                                                <p className="text-xs text-gray-500 mt-0.5">{shop.ownerName}</p>
                                                <div className="flex items-center gap-2 mt-2"><Tag size="12" className="text-orange-400" /><p className="text-xs text-gray-500">{shop.category}</p><MapPin size="12" className="text-orange-400 ml-1" /><p className="text-xs text-gray-500">{shop.city}</p></div>
                                                <button onClick={() => setSelected(shop)} className="w-full mt-3 flex items-center justify-center gap-2 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg text-xs font-bold transition-all">
                                                    <Eye size="13" /> View Details
                                                </button>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                                <table className="w-full text-sm">
                                                                      <thead className="bg-gray-50">
                                        <tr className="border-b border-gray-200">
                                            <th className="px-4 py-3 w-8">
                                                <input type="checkbox" checked={selectedShops.length === filteredShops.length && filteredShops.length > 0} onChange={toggleSelectAll}
                                                    className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500" />
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Shop</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Owner</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Contact</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Location</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Status</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredShops.map(shop => (
                                            <tr key={shop._id} className="hover:bg-orange-50/40 transition-colors">
                                                <td className="px-4 py-3">
                                                    <input type="checkbox" checked={selectedShops.includes(shop._id)} onChange={() => toggleShopSelection(shop._id)}
                                                        className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500" />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <img src={getImageUrl(shop.shopLogo)} onError={imgError()} className="w-8 h-8 rounded-lg object-cover border" alt="" />
                                                        <span className="font-semibold text-gray-800">{shop.shopName}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600">{shop.ownerName}</td>
                                                <td className="px-4 py-3 text-gray-500 text-xs">{shop.mobile}</td>
                                                <td className="px-4 py-3 text-gray-500 text-xs">{shop.city}</td>
                                                <td className="px-4 py-3"><StatusBadge status={shop.verificationStatus} /></td>
                                                <td className="px-4 py-3">
                                                    <button onClick={() => setSelected(shop)} className="p-1.5 hover:bg-orange-100 rounded-lg transition-colors">
                                                        <Eye size="14" className="text-orange-600" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Coupons Tab */}
                {tab === 'coupons' && (
                    <div className="space-y-5">
                        <div className="bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden">
                            <div className="px-5 py-4 border-b bg-gradient-to-r from-orange-50 to-amber-50">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    <Tag size="18" className="text-orange-500" /> All Coupons ({coupons.length})
                                </h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Worker</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Karigar ID</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Code</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Discount</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Expires</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Status</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Used By</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {coupons.map(c => {
                                            const isExpired = !c.isUsed && new Date() > new Date(c.expiresAt);
                                            const daysLeft = Math.ceil((new Date(c.expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
                                            return (
                                                <tr key={c._id} className="hover:bg-orange-50/40 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <img src={getImageUrl(c.worker?.photo)} onError={imgError()} className="w-8 h-8 rounded-full object-cover border-2 border-orange-200" alt="" />
                                                            <span className="font-semibold text-gray-800">{c.worker?.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.worker?.karigarId}</td>
                                                    <td className="px-4 py-3"><span className="font-mono font-bold text-orange-700 tracking-wider bg-orange-50 px-2 py-1 rounded-lg">{c.code}</span></td>
                                                    <td className="px-4 py-3"><span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">{c.discountPct}% OFF</span></td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs text-gray-500">{new Date(c.expiresAt).toLocaleDateString('en-IN')}</span>
                                                            {!c.isUsed && !isExpired && <span className="text-[10px] text-yellow-600 mt-0.5">{daysLeft} days left</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                                                            c.isUsed ? 'bg-emerald-100 text-emerald-700' : isExpired ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'
                                                        }`}>
                                                            {c.isUsed ? <CheckCircle size="10" /> : isExpired ? <XCircle size="10" /> : <Clock size="10" />}
                                                            {c.isUsed ? 'Used' : isExpired ? 'Expired' : 'Active'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-gray-500 font-medium">{c.usedBy?.shopName || '—'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {coupons.length === 0 && <div className="text-center py-12 text-gray-400"><Tag size="48" className="mx-auto mb-3 opacity-20" /><p className="font-semibold">No coupons generated yet.</p></div>}
                            </div>
                        </div>

                        {/* Unclaimed Coupons */}
                        {unclaimed.length > 0 && (
                            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-5">
                                <h3 className="font-bold text-amber-800 mb-4 flex items-center gap-2">
                                    <AlertCircle size="16" /> Workers with Active Unused Coupons ({unclaimed.length})
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {unclaimed.map(c => (
                                        <div key={c._id} className="bg-white rounded-lg p-3 border border-amber-100 flex items-center gap-3 hover:shadow-md transition-all">
                                            <img src={getImageUrl(c.worker?.photo)} onError={imgError()} className="w-10 h-10 rounded-full object-cover border-2 border-amber-200" alt="" />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-gray-800 text-sm truncate">{c.worker?.name}</p>
                                                <p className="text-xs text-gray-400 font-mono">{c.worker?.karigarId}</p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="font-bold text-orange-600 font-mono text-xs bg-orange-50 px-2 py-1 rounded-lg">{c.code}</p>
                                                <p className="text-[10px] text-amber-600 font-semibold">{c.discountPct}% off</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* History Tab */}
                {tab === 'history' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="font-bold text-gray-800 flex items-center gap-2"><History size="20" className="text-orange-500" /> Coupon Usage History ({history.length})</h2>
                        </div>
                        {history.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-xl border border-gray-100"><History size="48" className="text-gray-300 mx-auto mb-3" /><p className="text-gray-500 font-medium">No transactions yet</p><p className="text-sm text-gray-400 mt-1">Coupon usage will appear here</p></div>
                        ) : (
                            <div className="space-y-3">
                                {history.map(t => (
                                    <motion.div key={t._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all group">
                                        <div className="flex gap-4 items-start">
                                            <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-orange-100 bg-orange-50 flex-shrink-0 flex items-center justify-center group-hover:scale-105 transition-transform">
                                                {getImageUrl(t.productPhoto, null) ? <img src={getImageUrl(t.productPhoto)} onError={imgError()} className="w-full h-full object-cover" alt="product" /> : <Tag size="20" className="text-orange-300" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between flex-wrap gap-2">
                                                    <div>
                                                        <p className="font-bold text-gray-800 text-lg">{t.product?.name}</p>
                                                        <p className="text-sm text-gray-500 mt-0.5">Shop: <span className="font-semibold text-orange-600">{t.shop?.shopName}</span></p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <img src={getImageUrl(t.worker?.photo)} onError={imgError()} className="w-5 h-5 rounded-full object-cover border" alt="" />
                                                            <p className="text-xs text-gray-500">{t.worker?.name} <span className="font-mono text-orange-500 ml-1">({t.worker?.karigarId})</span></p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <p className="font-bold text-emerald-700 text-xl">₹{t.finalPrice}</p>
                                                        <p className="text-xs text-rose-500 font-semibold">-₹{t.discountAmount} ({t.discountPct}%)</p>
                                                        <p className="text-[10px] text-gray-400 mt-1">{new Date(t.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className="text-xs font-mono bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-bold">{t.coupon?.code}</span>
                                                    <span className="text-xs text-gray-400">MRP: ₹{t.originalPrice}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Shop Detail Modal */}
                <ShopDetailModal shop={selected} onClose={() => setSelected(null)} onApprove={approve} onReject={reject} onBlock={block} onDelete={del} />
            </div>
        </div>
    );
};

// Helper Loader Component
const Loader2 = ({ size, className }) => (
    <svg className={`animate-spin ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);

export default AdminShops;