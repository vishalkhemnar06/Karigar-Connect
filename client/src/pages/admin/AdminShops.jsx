// client/src/pages/admin/AdminShops.jsx
// ENHANCED & FIXED:
//   - Fixed filteredShops initialization order
//   - Fixed modal display issue
//   - Full-screen image viewer with zoom and navigation
//   - Advanced filtering and sorting
//   - Bulk actions for shops
//   - Enhanced animations and transitions
//   - Export functionality (CSV)
//   - Statistics dashboard

import React, { useEffect, useState, useMemo, useCallback, memo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../../api';
import { motion } from 'framer-motion';
import { getImageUrl, imgError } from '../../utils/imageUrl';
import toast from 'react-hot-toast';
import {
    Store, Check, X, ShieldX, Trash2, Eye, Tag,
    History, Search, Clock, FileText, Image as ImageIcon,
    AlertCircle, MapPin, Phone, Mail, Hash, Calendar,
    CheckCircle, XCircle, Ban, ChevronDown, Download,
    Filter, SortAsc, SortDesc, RefreshCw, ChevronLeft,
    ChevronRight, Maximize2, Minimize2, ZoomIn, ZoomOut,
    Grid3x3, List, BarChart3, Users, Percent, DollarSign,
    TrendingUp, Star, Award, Printer
} from 'lucide-react';

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

    // Keyboard navigation
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
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center">
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full bg-black/50 hover:bg-black/70 transition-all z-10"
            >
                <X size={24} />
            </button>

            {/* Controls */}
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

            {/* Navigation buttons */}
            {images.length > 1 && (
                <>
                    <button
                        onClick={handlePrev}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 rounded-full bg-black/50 hover:bg-black/70 transition-all"
                    >
                        <ChevronLeft size={28} />
                    </button>
                    <button
                        onClick={handleNext}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 rounded-full bg-black/50 hover:bg-black/70 transition-all"
                    >
                        <ChevronRight size={28} />
                    </button>
                </>
            )}

            {/* Image counter */}
            {images.length > 1 && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-lg px-4 py-2 rounded-full text-white text-sm font-medium">
                    {currentIndex + 1} / {images.length}
                </div>
            )}

            {/* Main image */}
            <div
                className="relative w-full h-full flex items-center justify-center cursor-pointer"
                onClick={isZoomed ? undefined : handleZoomToggle}
            >
                <img
                    src={getImageUrl(images[currentIndex])}
                    alt="Full screen"
                    className={`max-w-[95vw] max-h-[95vh] object-contain transition-transform duration-200 ${
                        isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'
                    }`}
                    style={{ transform: `scale(${zoom})` }}
                />
            </div>
        </div>
    );
});
ImageViewer.displayName = 'ImageViewer';

// ── STATUS BADGE (Enhanced) ───────────────────────────────────────────────────
const StatusBadge = memo(({ status }) => {
    const map = {
        pending:  { cls: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock, label: '⏳ Pending' },
        approved: { cls: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle, label: '✅ Approved' },
        rejected: { cls: 'bg-rose-100 text-rose-800 border-rose-200', icon: XCircle, label: '❌ Rejected' },
        blocked:  { cls: 'bg-gray-100 text-gray-700 border-gray-200', icon: Ban, label: '🚫 Blocked' },
    };
    const s = map[status] || map.pending;
    const Icon = s.icon;
    return (
        <span className={`px-2.5 py-1 text-xs font-bold rounded-full border inline-flex items-center gap-1 ${s.cls}`}>
            <Icon size={12} />
            {s.label}
        </span>
    );
});
StatusBadge.displayName = 'StatusBadge';

// ── ENHANCED DOCUMENT VIEWER ──────────────────────────────────────────────────
const DocViewer = memo(({ path, label, idType, onImageClick }) => {
    const url = getImageUrl(path, null);
    if (!url) return <p className="text-gray-400 text-sm italic">Not uploaded</p>;

    const isPdf = typeof path === 'string'
        ? path.toLowerCase().endsWith('.pdf')
        : (path?.filePath || '').toLowerCase().endsWith('.pdf');

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
                <div
                    onClick={handleClick}
                    className="cursor-pointer relative group overflow-hidden rounded-xl border border-gray-200 bg-gray-50 hover:shadow-lg transition-all"
                >
                    <img
                        src={url}
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.style.display = 'none';
                            e.target.nextSibling && (e.target.nextSibling.style.display = 'flex');
                        }}
                        className="w-full max-h-48 object-contain"
                        alt={label}
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Maximize2 size={24} className="text-white" />
                    </div>
                </div>
            )}
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-orange-600 hover:text-orange-800
                    bg-orange-50 hover:bg-orange-100 border border-orange-200 px-4 py-2 rounded-lg font-semibold transition-all w-full justify-center"
            >
                {isPdf ? <FileText size={15} /> : <ImageIcon size={15} />}
                {isPdf ? 'Open PDF' : 'View Full Image'}
                {idType && ` (${idType})`}
            </a>
        </div>
    );
});
DocViewer.displayName = 'DocViewer';

// ── ENHANCED DETAIL ROW ───────────────────────────────────────────────────────
const DetailRow = memo(({ label, value, icon: Icon, color = 'orange' }) => {
    const colorClasses = {
        orange: 'bg-orange-50/60 border-orange-100',
        blue: 'bg-blue-50/60 border-blue-100',
        green: 'bg-green-50/60 border-green-100',
        purple: 'bg-purple-50/60 border-purple-100',
    };
    const iconColor = {
        orange: 'text-orange-500',
        blue: 'text-blue-500',
        green: 'text-green-500',
        purple: 'text-purple-500',
    };
    return (
        <div className={`rounded-xl p-3 border ${colorClasses[color]}`}>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-1 ${iconColor[color]}`}>
                {Icon && <Icon size={11} />}{label}
            </p>
            <p className="text-gray-800 text-sm font-medium break-all">{value || 'N/A'}</p>
        </div>
    );
});
DetailRow.displayName = 'DetailRow';

// ── ENHANCED SHOP DETAIL MODAL ────────────────────────────────────────────────
// ── ENHANCED SHOP DETAIL MODAL (FIXED) ─────────────────────────────────────────
const ShopDetailModal = memo(({ shop, onClose, onApprove, onReject, onBlock, onDelete }) => {
    // ========== ALL HOOKS MUST BE CALLED ON EVERY RENDER ==========
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [activeTab, setActiveTab] = useState('info');
    const [viewerImage, setViewerImage] = useState(null);
    const [viewerImages, setViewerImages] = useState([]);
    const [viewerIndex, setViewerIndex] = useState(0);

    // Safe data extraction with optional chaining
    const logoUrl = getImageUrl(shop?.shopLogo, null);
    const photoUrl = getImageUrl(shop?.ownerPhoto, null);
    const idProofUrl = getImageUrl(shop?.idProof?.filePath || shop?.idProof, null);

    // Memoized values
    const stats = useMemo(() => ({
        totalCoupons: shop?.couponsCount || 0,
        usedCoupons: shop?.usedCouponsCount || 0,
        totalSales: shop?.totalSales || 0,
        rating: shop?.rating || 0,
    }), [shop]);

    const allImages = useMemo(() => [
        ...(logoUrl ? [{ url: logoUrl, name: 'Shop Logo' }] : []),
        ...(photoUrl ? [{ url: photoUrl, name: 'Owner Photo' }] : []),
        ...(idProofUrl && !idProofUrl.toLowerCase().endsWith('.pdf') ? [{ url: idProofUrl, name: 'ID Proof' }] : []),
    ], [logoUrl, photoUrl, idProofUrl]);

    const handleImageClick = useCallback((url, index) => {
        setViewerImages(allImages.map(img => img.url));
        setViewerIndex(index);
        setViewerImage(url);
    }, [allImages]);

    // ========== CONDITIONAL RETURN AFTER ALL HOOKS ==========
    if (!shop) return null;

    // ========== RENDER COMPONENT ==========
    return (
        <>
            {viewerImage && (
                <ImageViewer
                    images={viewerImages}
                    initialIndex={viewerIndex}
                    onClose={() => setViewerImage(null)}
                />
            )}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">

                    {/* Header with gradient */}
                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-5 flex items-center gap-4 flex-shrink-0">
                      <div
  className="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-md flex items-center justify-center flex-shrink-0 cursor-pointer hover:scale-105 transition-transform bg-white"
  onClick={() => logoUrl && handleImageClick(logoUrl, allImages.findIndex(img => img.url === logoUrl))}
>
  {logoUrl ? (
    <img
      src={logoUrl}
      onError={imgError()}
      className="w-full h-full object-cover"
      alt="logo"
    />
  ) : (
    <Store size={28} className="text-orange-400" />
  )}
</div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-xl font-black text-white truncate">{shop.shopName}</h3>
                            <p className="text-orange-100 text-sm">{shop.category} · {shop.city}</p>
                            <div className="mt-1"><StatusBadge status={shop.verificationStatus} /></div>
                        </div>
                        <button onClick={onClose} className="text-white/80 hover:text-white p-2 hover:bg-white/20 rounded-full transition-all flex-shrink-0">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="border-b px-5 pt-3 flex gap-2">
                        {[
                            { key: 'info', label: 'Information', icon: Store },
                            { key: 'documents', label: 'Documents', icon: FileText },
                            { key: 'statistics', label: 'Statistics', icon: BarChart3 },
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-t-xl transition-all ${
                                    activeTab === tab.key
                                        ? 'bg-orange-50 text-orange-600 border-b-2 border-orange-500'
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                <tab.icon size={16} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Body with tabs content */}
                    <div className="overflow-y-auto flex-1 p-5 space-y-6">
                        {/* Info Tab */}
                        {activeTab === 'info' && (
                            <>
                                <section>
                                    <h4 className="font-black text-gray-700 text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <div className="w-5 h-0.5 bg-orange-400 rounded-full" /> Owner & Contact
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <DetailRow label="Owner Name" value={shop.ownerName} icon={Users} color="orange" />
                                        <DetailRow label="Mobile" value={shop.mobile} icon={Phone} color="blue" />
                                        <DetailRow label="Email" value={shop.email} icon={Mail} color="purple" />
                                        <DetailRow label="GST No." value={shop.gstNumber || 'Not Provided'} icon={Hash} color="green" />
                                    </div>
                                </section>

                                <section>
                                    <h4 className="font-black text-gray-700 text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <div className="w-5 h-0.5 bg-orange-400 rounded-full" /> Shop Details
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <DetailRow label="Shop Name" value={shop.shopName} icon={Store} color="orange" />
                                        <DetailRow label="Category" value={shop.category} icon={Tag} color="blue" />
                                        <DetailRow label="Address" value={shop.address} icon={MapPin} color="purple" />
                                        <DetailRow label="City" value={shop.city} icon={MapPin} color="green" />
                                        <DetailRow label="Pincode" value={shop.pincode} icon={Hash} color="orange" />
                                        <DetailRow label="Locality" value={shop.locality || '—'} icon={MapPin} color="blue" />
                                        <DetailRow label="Registered" value={new Date(shop.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} icon={Calendar} color="purple" />
                                    </div>
                                </section>
                            </>
                        )}

                        {/* Documents Tab */}
                        {activeTab === 'documents' && (
                            <section>
                                <h4 className="font-black text-gray-700 text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <div className="w-5 h-0.5 bg-orange-400 rounded-full" /> Documents & Photos
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <div className="space-y-2">
                                        <p className="text-xs font-black text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                            <ImageIcon size={12} /> Shop Logo
                                        </p>
                                        {logoUrl ? (
                                            <div
                                                className="cursor-pointer group relative overflow-hidden rounded-xl border-2 border-orange-100 bg-orange-50"
                                                onClick={() => handleImageClick(logoUrl, 0)}
                                            >
                                                <img src={logoUrl} onError={imgError()} alt="Shop Logo"
                                                    className="w-full h-40 object-contain" />
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
                                        <p className="text-xs font-black text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                            <ImageIcon size={12} /> Owner Photo
                                        </p>
                                        {photoUrl ? (
                                            <div
                                                className="cursor-pointer group relative overflow-hidden rounded-xl border-2 border-orange-100 bg-orange-50"
                                                onClick={() => handleImageClick(photoUrl, allImages.findIndex(img => img.url === photoUrl))}
                                            >
                                                <img src={photoUrl} onError={imgError()} alt="Owner"
                                                    className="w-full h-40 object-cover" />
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
                                        <p className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                            ID Proof {shop.idProof?.idType ? `(${shop.idProof.idType})` : ''}
                                        </p>
                                        <DocViewer
                                            path={shop.idProof?.filePath || shop.idProof}
                                            label="ID Document"
                                            idType={shop.idProof?.idType}
                                            onImageClick={(url) => handleImageClick(url, allImages.findIndex(img => img.url === url))}
                                        />
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Statistics Tab */}
                        {activeTab === 'statistics' && (
                            <section>
                                <h4 className="font-black text-gray-700 text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <div className="w-5 h-0.5 bg-orange-400 rounded-full" /> Shop Performance
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 text-center">
                                        <Award size={24} className="text-blue-600 mx-auto mb-2" />
                                        <p className="text-2xl font-black text-blue-700">{stats.rating || 'N/A'}</p>
                                        <p className="text-xs text-blue-600 font-medium">Rating</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 text-center">
                                        <Tag size={24} className="text-green-600 mx-auto mb-2" />
                                        <p className="text-2xl font-black text-green-700">{stats.totalCoupons}</p>
                                        <p className="text-xs text-green-600 font-medium">Total Coupons</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 text-center">
                                        <CheckCircle size={24} className="text-purple-600 mx-auto mb-2" />
                                        <p className="text-2xl font-black text-purple-700">{stats.usedCoupons}</p>
                                        <p className="text-xs text-purple-600 font-medium">Used Coupons</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 text-center">
                                        <DollarSign size={24} className="text-amber-600 mx-auto mb-2" />
                                        <p className="text-2xl font-black text-amber-700">₹{stats.totalSales.toLocaleString()}</p>
                                        <p className="text-xs text-amber-600 font-medium">Total Sales</p>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Reject Form */}
                        {showRejectForm && (
                            <section className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top duration-200">
                                <p className="font-black text-rose-700 text-sm flex items-center gap-2">
                                    <AlertCircle size={16} /> Rejection Reason
                                </p>
                                <textarea
                                    placeholder="State the reason for rejection (sent via SMS to owner)..."
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    rows={3}
                                    className="w-full border-2 border-rose-200 rounded-xl p-3 text-sm resize-none
                                        focus:border-rose-400 focus:ring-4 focus:ring-rose-50 focus:outline-none transition-all"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            if (!rejectReason.trim()) return toast.error('Reason required.');
                                            onReject(shop._id, rejectReason);
                                        }}
                                        disabled={!rejectReason.trim()}
                                        className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-xl font-black text-sm disabled:opacity-50 transition-all"
                                    >
                                        Confirm Reject & Delete
                                    </button>
                                    <button
                                        onClick={() => setShowRejectForm(false)}
                                        className="px-5 py-2.5 border-2 border-gray-200 rounded-xl text-sm text-gray-600 font-semibold hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </section>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="border-t bg-gray-50 p-4 flex flex-wrap gap-2 justify-end flex-shrink-0">
                        {shop.verificationStatus === 'pending' && (
                            <>
                                <button
                                    onClick={() => onApprove(shop._id)}
                                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-black text-sm transition-all hover:shadow-lg hover:scale-105"
                                >
                                    <Check size={15} /> Approve
                                </button>
                                <button
                                    onClick={() => setShowRejectForm(true)}
                                    className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl font-black text-sm transition-all hover:shadow-lg hover:scale-105"
                                >
                                    <X size={15} /> Reject
                                </button>
                            </>
                        )}
                        {shop.verificationStatus === 'approved' && (
                            <button
                                onClick={() => onBlock(shop._id)}
                                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl font-black text-sm transition-all hover:shadow-lg"
                            >
                                <ShieldX size={15} /> Block Shop
                            </button>
                        )}
                        {shop.verificationStatus === 'blocked' && (
                            <button
                                onClick={() => onApprove(shop._id)}
                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-black text-sm transition-all hover:shadow-lg"
                            >
                                <Check size={15} /> Unblock
                            </button>
                        )}
                        <button
                            onClick={() => onDelete(shop._id)}
                            className="flex items-center gap-2 border-2 border-rose-200 text-rose-600 hover:bg-rose-50 px-5 py-2.5 rounded-xl font-black text-sm transition-all"
                        >
                            <Trash2 size={15} /> Delete
                        </button>
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-xl text-sm font-bold transition-all"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
});
ShopDetailModal.displayName = 'ShopDetailModal';
// ── STATS CARD ────────────────────────────────────────────────────────────────
const StatsCard = memo(({ title, value, icon: Icon, color, trend }) => (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all">
        <div className="flex items-start justify-between">
            <div>
                <p className="text-sm text-gray-500 font-medium">{title}</p>
                <p className="text-3xl font-black text-gray-900 mt-2">{value}</p>
                {trend && (
                    <p className={`text-xs font-medium mt-2 flex items-center gap-1 ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
                        <TrendingUp size={12} />
                        {trend.value} from last month
                    </p>
                )}
            </div>
            <div className={`p-3 rounded-xl ${color}`}>
                <Icon size={24} className="text-white" />
            </div>
        </div>
    </div>
));
StatsCard.displayName = 'StatsCard';

// ── MAIN PAGE ──────────────────────────────────────────────────────────────────
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
    const [selectedShops, setSelectedShops] = useState([]);
    const [showBulkActions, setShowBulkActions] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const searchTimeout = useRef(null);

    // Debounced search
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
            toast.success('Shop rejected, SMS sent, deleted from DB.');
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

    // ── COMPUTED VALUES (MUST BE DEFINED BEFORE FUNCTIONS THAT USE THEM) ───────
    const counts = useMemo(() => ({
        all: shops.length,
        pending: shops.filter(s => s.verificationStatus === 'pending').length,
        approved: shops.filter(s => s.verificationStatus === 'approved').length,
        blocked: shops.filter(s => s.verificationStatus === 'blocked').length,
    }), [shops]);

    // ✅ STEP 1: Define filteredShops FIRST (before functions that depend on it)
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
        // Sort
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

    // ✅ STEP 2: Define functions that depend on filteredShops
    const exportToCSV = useCallback(() => {
        if (filteredShops.length === 0) {
            toast.error('No data to export');
            return;
        }
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
        const csv = [
            headers.join(','),
            ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
        ].join('\n');
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
        setSelectedShops(prev =>
            prev.includes(shopId)
                ? prev.filter(id => id !== shopId)
                : [...prev, shopId]
        );
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

    const TABS = [
        { key: 'shops', label: 'All Shops', icon: Store, count: shops.length },
        { key: 'coupons', label: 'Coupons', icon: Tag, count: coupons.length },
        { key: 'history', label: 'History', icon: History, count: history.length },
    ];

    const FILTERS = [
        { v: 'all', label: `All`, count: counts.all, color: 'gray' },
        { v: 'pending', label: `Pending`, count: counts.pending, color: 'amber' },
        { v: 'approved', label: `Approved`, count: counts.approved, color: 'emerald' },
        { v: 'blocked', label: `Blocked`, count: counts.blocked, color: 'gray' },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 lg:p-6">
            <ShopDetailModal
                shop={selected}
                onClose={() => setSelected(null)}
                onApprove={approve}
                onReject={reject}
                onBlock={block}
                onDelete={del}
            />

            {/* Header */}
          {/* Header Section - Clean Mobile Version */}
<div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left Section */}
        <div className="flex items-center gap-3">
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/admin/dashboard')}
                className="p-2 rounded-xl bg-gray-50 text-gray-600 hover:bg-orange-50 hover:text-orange-600 transition-all duration-200 group"
                aria-label="Go back to dashboard"
            >
                <svg className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
            </motion.button>
            
            <div>
                <h1 className="text-2xl font-bold text-gray-800">
                    Shop Management
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        Active Dashboard
                    </span>
                </div>
            </div>
        </div>

        {/* Right Section */}
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={loadAll}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
        >
            <RefreshCw size={16} className={`${loading ? 'animate-spin' : ''} transition-transform`} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
        </motion.button>
    </div>
</div>
<p className="text-xs text-gray-500 mb-4">Manage shops, verify vendors, and track performance</p>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatsCard
                    title="Total Shops"
                    value={counts.all}
                    icon={Store}
                    color="bg-gradient-to-r from-orange-500 to-amber-500"
                    trend={{ positive: true, value: '12%' }}
                />
                <StatsCard
                    title="Pending Approval"
                    value={counts.pending}
                    icon={Clock}
                    color="bg-gradient-to-r from-amber-500 to-yellow-500"
                />
                <StatsCard
                    title="Active Shops"
                    value={counts.approved}
                    icon={CheckCircle}
                    color="bg-gradient-to-r from-emerald-500 to-green-500"
                />
                <StatsCard
                    title="Total Coupons"
                    value={coupons.length}
                    icon={Tag}
                    color="bg-gradient-to-r from-purple-500 to-pink-500"
                />
            </div>

            {/* Tab Bar */}
            <div className="flex flex-wrap gap-1 bg-white rounded-2xl p-1 mb-6 shadow-sm">
                {TABS.map(({ key, label, icon: Icon, count }) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={`
                            flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all
                            ${tab === key
                                ? 'bg-orange-600 text-white shadow-lg'
                                : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                            }
                        `}
                    >
                        <Icon size={15} />
                        {label}
                        {count > 0 && (
                            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                                tab === key ? 'bg-white/20' : 'bg-gray-100'
                            }`}>
                                {count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── SHOPS TAB ── */}
            {tab === 'shops' && (
                <div className="space-y-4">
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-2">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search shops..."
                                    onChange={onSearch}
                                    className="pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm w-64
                                        focus:border-orange-400 focus:ring-4 focus:ring-orange-50 focus:outline-none transition-all"
                                />
                            </div>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                    showFilters ? 'bg-orange-600 text-white' : 'bg-white border-2 border-gray-200 text-gray-600 hover:border-orange-300'
                                }`}
                            >
                                <Filter size={14} />
                                Filters
                                <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-lg transition-all ${
                                    viewMode === 'grid' ? 'bg-orange-600 text-white' : 'bg-white border-2 border-gray-200 text-gray-400'
                                }`}
                            >
                                <Grid3x3 size={16} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-lg transition-all ${
                                    viewMode === 'list' ? 'bg-orange-600 text-white' : 'bg-white border-2 border-gray-200 text-gray-400'
                                }`}
                            >
                                <List size={16} />
                            </button>
                            <button
                                onClick={exportToCSV}
                                className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-200 rounded-xl text-gray-600 font-semibold text-sm hover:border-orange-300 transition-all"
                            >
                                <Download size={14} />
                                Export
                            </button>
                        </div>
                    </div>

                    {/* Filters Panel */}
                    {showFilters && (
                        <div className="bg-white rounded-2xl p-4 border border-gray-200 animate-in slide-in-from-top duration-200">
                            <div className="flex flex-wrap gap-3 items-center">
                                <span className="text-sm font-semibold text-gray-700">Status:</span>
                                {FILTERS.map(f => (
                                    <button
                                        key={f.v}
                                        onClick={() => setFilter(f.v)}
                                        className={`
                                            px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                                            ${filterStatus === f.v
                                                ? `bg-${f.color}-600 text-white`
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }
                                        `}
                                    >
                                        {f.label} ({f.count})
                                    </button>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-3 items-center mt-3 pt-3 border-t">
                                <span className="text-sm font-semibold text-gray-700">Sort by:</span>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="px-3 py-1.5 border-2 border-gray-200 rounded-lg text-sm"
                                >
                                    <option value="createdAt">Registration Date</option>
                                    <option value="shopName">Shop Name</option>
                                    <option value="ownerName">Owner Name</option>
                                    <option value="city">City</option>
                                </select>
                                <button
                                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                    className="flex items-center gap-1 px-3 py-1.5 border-2 border-gray-200 rounded-lg text-sm hover:border-orange-300"
                                >
                                    {sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />}
                                    {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Bulk Actions Bar */}
                    {selectedShops.length > 0 && (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center justify-between animate-in slide-in-from-top">
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={selectedShops.length === filteredShops.length && filteredShops.length > 0}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded border-orange-300 text-orange-600 focus:ring-orange-500"
                                />
                                <span className="text-sm font-semibold text-orange-800">
                                    {selectedShops.length} shop(s) selected
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={bulkApprove}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all"
                                >
                                    Approve All
                                </button>
                                <button
                                    onClick={bulkDelete}
                                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-all"
                                >
                                    Delete All
                                </button>
                                <button
                                    onClick={() => setSelectedShops([])}
                                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-24">
                            <div className="animate-spin w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full" />
                        </div>
                    ) : filteredShops.length === 0 ? (
                        <div className="text-center py-20 text-gray-400 bg-white rounded-2xl border border-gray-100">
                            <Store size={48} className="mx-auto mb-3 opacity-20" />
                            <p className="font-semibold">No shops found</p>
                            <p className="text-sm mt-1">Try adjusting your filters or search</p>
                        </div>
                    ) : viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredShops.map(shop => {
                                const logo = getImageUrl(shop.shopLogo, null);
                                const isSelected = selectedShops.includes(shop._id);
                                return (
                                    <div
                                        key={shop._id}
                                        className={`bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition-all group ${
                                            isSelected ? 'ring-2 ring-orange-500 ring-offset-2' : 'border-gray-100'
                                        }`}
                                    >
                                        <div className="relative">
                                           <div
  className="h-32 flex items-center justify-center cursor-pointer"
  onClick={() => setSelected(shop)}
>
  {logo ? (
    <img
      src={logo}
      onError={imgError()}
      alt="logo"
      className="w-24 h-24 rounded-full object-cover border-2 border-orange-300 shadow-sm group-hover:scale-110 transition-transform"
    />
  ) : (
    <div className="w-24 h-24 rounded-full bg-orange-100 flex items-center justify-center">
      <Store size={28} className="text-orange-400" />
    </div>
  )}
</div>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleShopSelection(shop._id)}
                                                className="absolute top-2 left-2 w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 bg-white"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <div className="absolute top-2 right-2">
                                                <StatusBadge status={shop.verificationStatus} />
                                            </div>
                                        </div>
                                        <div className="p-4">
                                            <h3 className="font-black text-gray-800 truncate">{shop.shopName}</h3>
                                            <p className="text-xs text-gray-500 mt-0.5">{shop.ownerName}</p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <Tag size={12} className="text-orange-400" />
                                                <p className="text-xs text-gray-500">{shop.category}</p>
                                                <MapPin size={12} className="text-orange-400 ml-1" />
                                                <p className="text-xs text-gray-500">{shop.city}</p>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                                <Phone size={10} /> {shop.mobile}
                                            </p>
                                            <button
                                                onClick={() => setSelected(shop)}
                                                className="w-full mt-3 flex items-center justify-center gap-2
                                                    bg-orange-50 hover:bg-orange-100 text-orange-700
                                                    py-2 rounded-xl text-xs font-black transition-all border border-orange-100"
                                            >
                                                <Eye size={13} /> View Details
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        // List view
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 w-8">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShops.length === filteredShops.length && filteredShops.length > 0}
                                                    onChange={toggleSelectAll}
                                                    className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                                                />
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Shop</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Owner</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Contact</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Location</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredShops.map(shop => (
                                            <tr key={shop._id} className="hover:bg-orange-50/40 transition-colors">
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedShops.includes(shop._id)}
                                                        onChange={() => toggleShopSelection(shop._id)}
                                                        className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <img
                                                            src={getImageUrl(shop.shopLogo)}
                                                            onError={imgError()}
                                                            className="w-8 h-8 rounded-lg object-cover border"
                                                            alt=""
                                                        />
                                                        <span className="font-semibold text-gray-800">{shop.shopName}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600">{shop.ownerName}</td>
                                                <td className="px-4 py-3 text-gray-500 text-xs">{shop.mobile}</td>
                                                <td className="px-4 py-3 text-gray-500 text-xs">{shop.city}</td>
                                                <td className="px-4 py-3"><StatusBadge status={shop.verificationStatus} /></td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => setSelected(shop)}
                                                        className="p-1.5 hover:bg-orange-100 rounded-lg transition-colors"
                                                    >
                                                        <Eye size={14} className="text-orange-600" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── COUPONS TAB ── */}
            {tab === 'coupons' && (
                <div className="space-y-5">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-5 border-b bg-gradient-to-r from-gray-50 to-white">
                            <h3 className="font-black text-gray-800 flex items-center gap-2">
                                <Tag size={18} className="text-orange-500" />
                                All Coupons ({coupons.length})
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-orange-50">
                                    <tr>
                                        {['Worker', 'Karigar ID', 'Code', 'Discount', 'Expires', 'Status', 'Used By'].map(h => (
                                            <th key={h} className="px-4 py-3 text-left text-[11px] font-black text-orange-600 uppercase tracking-wider">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {coupons.map(c => {
                                        const isExpired = !c.isUsed && new Date() > new Date(c.expiresAt);
                                        const daysLeft = Math.ceil((new Date(c.expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
                                        return (
                                            <tr key={c._id} className="hover:bg-orange-50/40 transition-colors group">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <img src={getImageUrl(c.worker?.photo)} onError={imgError()}
                                                            className="w-8 h-8 rounded-full object-cover border-2 border-orange-100" alt="" />
                                                        <span className="font-semibold text-gray-800">{c.worker?.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.worker?.karigarId}</td>
                                                <td className="px-4 py-3">
                                                    <span className="font-mono font-black text-orange-700 tracking-widest bg-orange-50 px-2 py-1 rounded-lg">
                                                        {c.code}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
                                                        {c.discountPct}% OFF
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs text-gray-500">
                                                            {new Date(c.expiresAt).toLocaleDateString('en-IN')}
                                                        </span>
                                                        {!c.isUsed && !isExpired && (
                                                            <span className="text-[10px] text-yellow-600 mt-0.5">
                                                                {daysLeft} days left
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black ${
                                                        c.isUsed ? 'bg-emerald-100 text-emerald-700' :
                                                        isExpired ? 'bg-rose-100 text-rose-600' :
                                                        'bg-amber-100 text-amber-700'
                                                    }`}>
                                                        {c.isUsed ? <CheckCircle size={10} /> : isExpired ? <XCircle size={10} /> : <Clock size={10} />}
                                                        {c.isUsed ? 'Used' : isExpired ? 'Expired' : 'Active'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-500 font-medium">{c.usedBy?.shopName || '—'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {coupons.length === 0 && (
                                <div className="text-center py-12 text-gray-400">
                                    <Tag size={48} className="mx-auto mb-3 opacity-20" />
                                    <p className="font-semibold">No coupons generated yet.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {unclaimed.length > 0 && (
                        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-5 animate-in fade-in">
                            <h3 className="font-black text-amber-800 mb-4 flex items-center gap-2">
                                <AlertCircle size={17} />
                                Workers with Active Unused Coupons ({unclaimed.length})
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {unclaimed.map(c => (
                                    <div key={c._id} className="bg-white rounded-xl p-3 border border-amber-100 flex items-center gap-3 hover:shadow-md transition-all">
                                        <img src={getImageUrl(c.worker?.photo)} onError={imgError()}
                                            className="w-10 h-10 rounded-full object-cover border-2 border-amber-200" alt="" />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-gray-800 text-sm truncate">{c.worker?.name}</p>
                                            <p className="text-xs text-gray-400 font-mono">{c.worker?.karigarId}</p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="font-black text-orange-600 font-mono text-xs bg-orange-50 px-2 py-1 rounded-lg">{c.code}</p>
                                            <p className="text-[10px] text-amber-600 font-semibold">{c.discountPct}% off</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── HISTORY TAB ── */}
            {tab === 'history' && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-black text-gray-900 flex items-center gap-2">
                            <History size={20} className="text-orange-500" />
                            Coupon Usage History ({history.length})
                        </h2>
                    </div>
                    {history.length === 0 ? (
                        <div className="text-center py-20 text-gray-400 bg-white rounded-2xl border border-gray-100">
                            <History size={48} className="mx-auto mb-3 opacity-20" />
                            <p className="font-semibold">No transactions yet</p>
                            <p className="text-sm mt-1">Coupon usage will appear here</p>
                        </div>
                    ) : (
                        history.map(t => (
                            <div key={t._id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                                <div className="flex gap-4 items-start">
                                    <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-orange-100 bg-orange-50 flex-shrink-0 flex items-center justify-center group-hover:scale-105 transition-transform">
                                        {getImageUrl(t.productPhoto, null)
                                            ? <img src={getImageUrl(t.productPhoto)} onError={imgError()}
                                                className="w-full h-full object-cover" alt="product" />
                                            : <Tag size={20} className="text-orange-300" />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between flex-wrap gap-2">
                                            <div>
                                                <p className="font-black text-gray-800 text-lg">{t.product?.name}</p>
                                                <p className="text-sm text-gray-500 mt-0.5">
                                                    Shop: <span className="font-semibold text-orange-600">{t.shop?.shopName}</span>
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <img src={getImageUrl(t.worker?.photo)} onError={imgError()}
                                                        className="w-5 h-5 rounded-full object-cover border" alt="" />
                                                    <p className="text-xs text-gray-500">
                                                        {t.worker?.name}
                                                        <span className="font-mono text-orange-500 ml-1">({t.worker?.karigarId})</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="font-black text-emerald-700 text-xl">₹{t.finalPrice}</p>
                                                <p className="text-xs text-rose-500 font-semibold">-₹{t.discountAmount} ({t.discountPct}%)</p>
                                                <p className="text-[10px] text-gray-400 mt-1">
                                                    {new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-xs font-mono bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-black">
                                                {t.coupon?.code}
                                            </span>
                                            <span className="text-xs text-gray-400">MRP: ₹{t.originalPrice}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminShops;