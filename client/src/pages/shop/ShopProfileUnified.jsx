import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';
import {
    Building2, Edit2, Save, X, Upload, Check, Shield, Award, MapPin,
    Phone, Mail, Hash, FileText, Calendar, CheckCircle, AlertCircle, Clock,
    Download, Store, TrendingUp, Navigation, Eye, ExternalLink,
    Star, Sparkles, BadgeCheck, Camera, Image as ImageIcon, Loader2,
    ChevronRight, Globe, Home, Tag, User, Briefcase, Info, Copy,
    Users // Added missing Users icon
} from 'lucide-react';
import { getImageUrl, imgError } from '../../utils/imageUrl';

// Animated Skeleton Loader
const SkeletonLoader = () => (
    <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-gradient-to-r from-gray-200 to-gray-100 rounded-2xl" />
        <div className="h-24 bg-gray-100 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-100 rounded-2xl" />
            <div className="h-64 bg-gray-100 rounded-2xl" />
        </div>
    </div>
);

// Animated Card Component
const AnimatedCard = ({ children, className = "", hover = true }) => (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm transition-all duration-300 ${hover ? 'hover:shadow-xl hover:-translate-y-1' : ''} ${className}`}>
        {children}
    </div>
);

// Status Badge Component
const StatusBadge = ({ status }) => {
    const config = {
        approved: { icon: CheckCircle, text: 'Verified', color: 'green', bg: 'bg-green-50', border: 'border-green-200', textColor: 'text-green-700' },
        pending: { icon: Clock, text: 'Pending Verification', color: 'yellow', bg: 'bg-yellow-50', border: 'border-yellow-200', textColor: 'text-yellow-700' },
        rejected: { icon: AlertCircle, text: 'Rejected', color: 'red', bg: 'bg-red-50', border: 'border-red-200', textColor: 'text-red-700' },
        blocked: { icon: AlertCircle, text: 'Blocked', color: 'red', bg: 'bg-red-50', border: 'border-red-200', textColor: 'text-red-700' }
    };
    const current = config[status] || config.pending;
    const Icon = current.icon;
    
    return (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${current.bg} border ${current.border}`}>
            <Icon size={14} className={current.textColor} />
            <span className={`text-xs font-bold ${current.textColor}`}>{current.text}</span>
        </div>
    );
};

// Info Row Component with Animation
const InfoRow = ({ label, value, icon: Icon, isEmpty = false, onCopy = null }) => {
    const [copied, setCopied] = useState(false);
    
    const handleCopy = () => {
        if (onCopy && value) {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast.success('Copied to clipboard!');
        }
    };
    
    return (
        <div className={`group flex items-start gap-3 py-4 px-4 border-b border-gray-100 last:border-0 rounded-lg transition-all duration-200 hover:bg-gray-50/50 ${
            isEmpty ? 'bg-gradient-to-r from-gray-50 to-transparent' : ''
        }`}>
            {Icon && (
                <div className={`mt-0.5 p-1.5 rounded-lg transition-all duration-200 ${isEmpty ? 'bg-gray-100' : 'bg-orange-50 group-hover:bg-orange-100'}`}>
                    <Icon size={16} className={isEmpty ? 'text-gray-400' : 'text-orange-500'} />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-semibold break-words ${isEmpty ? 'text-gray-400 italic' : 'text-gray-800'}`}>
                        {value || 'Not provided'}
                    </p>
                    {value && onCopy && (
                        <button
                            onClick={handleCopy}
                            className="opacity-0 group-hover:opacity-100 transition-all duration-200 p-1 hover:bg-gray-200 rounded-lg"
                            title="Copy to clipboard"
                        >
                            {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-gray-400" />}
                        </button>
                    )}
                </div>
            </div>
            {isEmpty && (
                <div className="flex-shrink-0 animate-pulse">
                    <span className="px-2 py-1 rounded-full text-[9px] font-bold bg-yellow-100 text-yellow-700">
                        Missing
                    </span>
                </div>
            )}
        </div>
    );
};

// Image Upload Card
const ImageUploadCard = ({ label, imageUrl, preview, onUpload, onRemove }) => {
    const fileInputRef = useRef(null);
    
    return (
        <div className="group">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">{label}</label>
            <div 
                onClick={() => fileInputRef.current?.click()}
                className="relative cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-gray-200 hover:border-orange-300 hover:bg-orange-50/30 transition-all duration-200"
            >
                {preview || imageUrl ? (
                    <div className="relative aspect-square">
                        <img 
                            src={preview || imageUrl} 
                            onError={imgError()} 
                            alt={label}
                            className="w-full h-full object-cover rounded-xl"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center">
                            <div className="text-center">
                                <Camera size={24} className="text-white mx-auto mb-1" />
                                <p className="text-white text-[10px] font-bold">Change</p>
                            </div>
                        </div>
                        {preview && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemove?.();
                                }}
                                className="absolute top-2 right-2 p-1 bg-red-500 rounded-full hover:bg-red-600 transition-all shadow-lg"
                            >
                                <X size={12} className="text-white" />
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="aspect-square flex flex-col items-center justify-center gap-2 bg-gray-50 group-hover:bg-orange-50 transition-all">
                        <div className="p-3 rounded-full bg-gray-100 group-hover:bg-orange-100 transition-all">
                            <ImageIcon size={24} className="text-gray-400 group-hover:text-orange-500" />
                        </div>
                        <p className="text-xs font-medium text-gray-500">Click to upload</p>
                        <p className="text-[9px] text-gray-400">JPG, PNG, GIF</p>
                    </div>
                )}
                <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={onUpload}
                />
            </div>
        </div>
    );
};

// Stat Card for Dashboard
const StatCard = ({ icon: Icon, label, value, color, trend }) => (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all group">
        <div className="flex items-center justify-between mb-2">
            <div className={`p-2 rounded-lg bg-${color}-50 group-hover:scale-110 transition-transform`}>
                <Icon size={18} className={`text-${color}-500`} />
            </div>
            {trend && (
                <span className="text-[10px] font-bold text-green-500 bg-green-50 px-2 py-0.5 rounded-full">
                    +{trend}%
                </span>
            )}
        </div>
        <p className="text-2xl font-black text-gray-900">{value}</p>
        <p className="text-[10px] text-gray-500 font-semibold mt-1">{label}</p>
    </div>
);

const ShopProfileUnified = ({ shop: initialShop, onUpdate = () => {}, isDashboard = false }) => {
    const navigate = useNavigate();
    const [shop, setShop] = useState(initialShop);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(!initialShop);
    const [saving, setSaving] = useState(false);

    // Form fields
    const [fShopName, setFShopName] = useState(shop?.shopName || '');
    const [fOwnerName, setFOwnerName] = useState(shop?.ownerName || '');
    const [fAddress, setFAddress] = useState(shop?.address || '');
    const [fCity, setFCity] = useState(shop?.city || '');
    const [fPincode, setFPincode] = useState(shop?.pincode || '');
    const [fLocality, setFLocality] = useState(shop?.locality || '');
    const [fCategory, setFCategory] = useState(shop?.category || '');
    const [fLogo, setFLogo] = useState(null);
    const [fLogoPreview, setFLogoPreview] = useState(null);
    const [fPhoto, setFPhoto] = useState(null);
    const [fPhotoPreview, setFPhotoPreview] = useState(null);
    
    // Location fields
    const [fLatitude, setFLatitude] = useState(shop?.shopLocation?.latitude || null);
    const [fLongitude, setFLongitude] = useState(shop?.shopLocation?.longitude || null);
    const [locationError, setLocationError] = useState('');
    const [locationLoading, setLocationLoading] = useState(false);
    
    // Document preview modal
    const [docModal, setDocModal] = useState({ isOpen: false, src: '', title: '' });

    // Load shop profile if not provided
    useEffect(() => {
        if (!initialShop && !shop) {
            api.getShopProfile()
                .then(r => setShop(r.data))
                .catch(() => {
                    toast.error('Failed to load profile');
                    if (!isDashboard) navigate('/shop/dashboard');
                })
                .finally(() => setLoading(false));
        }
    }, [initialShop, shop, isDashboard, navigate]);

    // Sync form fields with shop data
    useEffect(() => {
        if (shop) {
            setFShopName(shop.shopName || '');
            setFOwnerName(shop.ownerName || '');
            setFAddress(shop.address || '');
            setFCity(shop.city || '');
            setFPincode(shop.pincode || '');
            setFLocality(shop.locality || '');
            setFCategory(shop.category || '');
            setFLatitude(shop.shopLocation?.latitude || null);
            setFLongitude(shop.shopLocation?.longitude || null);
        }
    }, [shop, isEditing]);

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

    const removeLogo = useCallback(() => {
        setFLogo(null);
        setFLogoPreview(null);
    }, []);

    const removePhoto = useCallback(() => {
        setFPhoto(null);
        setFPhotoPreview(null);
    }, []);

    const captureLocation = useCallback(async () => {
        setLocationError('');
        setLocationLoading(true);
        
        if (!navigator.geolocation) {
            setLocationError('Geolocation not supported by your browser');
            toast.error('Geolocation not supported');
            setLocationLoading(false);
            return;
        }
        
        try {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude: lat, longitude: lon } = position.coords;
                    setFLatitude(lat);
                    setFLongitude(lon);
                    toast.success(`Location captured successfully!`);
                    
                    // Reverse geocoding to get address details
                    try {
                        const response = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`
                        );
                        const data = await response.json();
                        
                        if (data.address) {
                            const roadName = data.address.road || data.address.street || '';
                            const houseNum = data.address.house_number || '';
                            const village = data.address.village || data.address.hamlet || '';
                            const city = data.address.city || data.address.town || data.address.county || '';
                            const postcode = data.address.postcode || '';
                            const state = data.address.state || '';
                            
                            const fullAddress = [houseNum, roadName].filter(Boolean).join(', ');
                            
                            if (fullAddress) setFAddress(fullAddress);
                            if (city) setFCity(city);
                            if (village) setFLocality(village);
                            if (postcode) setFPincode(postcode);
                            
                            toast.success('Address auto-filled from location!');
                        }
                    } catch (geoErr) {
                        console.log('Geocoding failed, but location captured', geoErr);
                    }
                    setLocationLoading(false);
                },
                error => {
                    let msg = 'Unable to get location';
                    if (error.code === error.PERMISSION_DENIED) msg = 'Permission denied. Please enable location in browser settings.';
                    else if (error.code === error.POSITION_UNAVAILABLE) msg = 'Location information unavailable';
                    setLocationError(msg);
                    toast.error(msg);
                    setLocationLoading(false);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } catch (err) {
            console.log('Location capture error:', err);
            setLocationError('Error capturing location');
            toast.error('Error capturing location');
            setLocationLoading(false);
        }
    }, []);

    const handleSave = useCallback(async () => {
        setSaving(true);
        try {
            const fd = new FormData();
            const fields = {
                shopName: fShopName,
                address: fAddress,
                city: fCity,
                pincode: fPincode,
                locality: fLocality,
                category: fCategory
            };
            Object.entries(fields).forEach(([k, v]) => fd.append(k, v || ''));
            if (fLatitude && fLongitude) {
                fd.append('latitude', fLatitude);
                fd.append('longitude', fLongitude);
            }
            if (fLogo) fd.append('shopLogo', fLogo);
            if (fPhoto) fd.append('ownerPhoto', fPhoto);

            const { data } = await api.updateShopProfile(fd);
            setShop(data);
            setFLogo(null);
            setFPhoto(null);
            setFLogoPreview(null);
            setFPhotoPreview(null);
            setIsEditing(false);
            toast.success('Profile updated successfully!');
            onUpdate();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Update failed');
        } finally {
            setSaving(false);
        }
    }, [fShopName, fAddress, fCity, fPincode, fLocality, fCategory, fLatitude, fLongitude, fLogo, fPhoto, onUpdate]);

    const handleCancel = () => {
        setIsEditing(false);
        setFLogo(null);
        setFPhoto(null);
        setFLogoPreview(null);
        setFPhotoPreview(null);
        setLocationError('');
    };

    const openDocModal = (src, title) => {
        setDocModal({ isOpen: true, src, title });
    };

    const closeDocModal = () => {
        setDocModal({ isOpen: false, src: '', title: '' });
    };

    if (loading) {
        return (
            <div className={isDashboard ? "space-y-4" : "max-w-7xl mx-auto p-6"}>
                <SkeletonLoader />
            </div>
        );
    }

    if (!shop) return null;

    const inputCls = "w-full border-2 border-gray-200 rounded-xl py-3.5 px-4 text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-50 focus:outline-none transition-all duration-200";
    const labelCls = "block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5";

    return (
        <div className={isDashboard ? "space-y-5" : "max-w-7xl mx-auto p-4 md:p-6"}>
            {/* Header with Gradient */}
            {!isDashboard && (
                <div className="mb-8">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl">
                                    <Store size={24} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-3xl md:text-4xl font-black text-gray-900 bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                                        Shop Profile
                                    </h1>
                                    <p className="text-gray-500 mt-1">Manage your shop information and settings</p>
                                </div>
                            </div>
                        </div>
                        {!isEditing && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="group flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-orange-200 transition-all duration-300 hover:-translate-y-0.5"
                            >
                                <Edit2 size={18} className="group-hover:rotate-12 transition-transform" />
                                Edit Profile
                                <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {isDashboard && (
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <Store size={20} className="text-orange-500" />
                            <h2 className="text-xl font-black text-gray-900">Shop Profile</h2>
                        </div>
                        <p className="text-xs text-gray-500">View and manage your shop details</p>
                    </div>
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="p-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg hover:shadow-md transition-all group"
                            title="Edit profile"
                        >
                            <Edit2 size={18} className="group-hover:rotate-12 transition-transform" />
                        </button>
                    )}
                </div>
            )}

            {!isEditing ? (
                // VIEW MODE - Enhanced
                <div className="space-y-6">
                    {/* Hero Banner */}
                    <div className="relative overflow-hidden bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 rounded-2xl shadow-xl">
                        <div className="absolute inset-0 bg-black/20" />
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
                        
                        <div className="relative p-6 md:p-8">
                            <div className="flex flex-col md:flex-row items-center gap-6">
                                {/* Shop Logo */}
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-white/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
                                    {shop.shopLogo ? (
                                        <img
                                            src={getImageUrl(shop.shopLogo)}
                                            onError={imgError()}
                                            alt={shop.shopName}
                                            className="relative w-28 h-28 md:w-32 md:h-32 rounded-2xl object-cover border-4 border-white/30 shadow-xl"
                                        />
                                    ) : (
                                        <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center border-4 border-white/30">
                                            <Store size={48} className="text-white/80" />
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex-1 text-center md:text-left">
                                    <div className="flex items-center gap-3 justify-center md:justify-start flex-wrap">
                                        <h2 className="text-2xl md:text-3xl font-black text-white">{shop.shopName}</h2>
                                        <StatusBadge status={shop.verificationStatus} />
                                    </div>
                                    <div className="flex items-center gap-2 justify-center md:justify-start mt-2 flex-wrap">
                                        <span className="px-3 py-1 bg-white/20 rounded-full text-white text-xs font-bold backdrop-blur">
                                            {shop.category || 'General Store'}
                                        </span>
                                        <span className="text-white/80 text-sm">•</span>
                                        <span className="text-white/90 text-sm flex items-center gap-1">
                                            <User size={14} /> Owner: {shop.ownerName}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 justify-center md:justify-start mt-3">
                                        <div className="flex items-center gap-1 text-white/70 text-xs">
                                            <Calendar size={12} />
                                            <span>Member since {new Date(shop.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {shop.verificationStatus === 'approved' && (
                                    <div className="hidden md:block">
                                        <div className="bg-white/20 backdrop-blur rounded-xl px-4 py-2 text-center">
                                            <BadgeCheck size={24} className="text-white mx-auto mb-1" />
                                            <p className="text-white text-xs font-bold">Verified Shop</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats - Only in Dashboard */}
                    {isDashboard && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <StatCard icon={Briefcase} label="Total Orders" value={shop.totalOrders || 0} color="blue" trend="12" />
                            <StatCard icon={Star} label="Rating" value={shop.averageRating || 0} color="yellow" />
                            <StatCard icon={TrendingUp} label="Completion Rate" value={`${shop.completionRate || 0}%`} color="green" />
                            <StatCard icon={Users} label="Customers" value={shop.totalCustomers || 0} color="purple" trend="8" />
                        </div>
                    )}

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Shop Details Card */}
                        <AnimatedCard className="overflow-hidden">
                            <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-6 py-4 border-b border-orange-100">
                                <div className="flex items-center gap-2">
                                    <Store size={18} className="text-orange-500" />
                                    <h3 className="text-lg font-black text-gray-900">Shop Details</h3>
                                </div>
                            </div>
                            <div className="divide-y divide-gray-100">
                                <InfoRow label="Shop Name" value={shop.shopName} icon={Store} onCopy={shop.shopName} />
                                <InfoRow label="Category" value={shop.category} icon={Tag} />
                                <InfoRow label="GST Number" value={shop.gstNumber} icon={Hash} onCopy={shop.gstNumber} />
                                <InfoRow label="Mobile Number" value={shop.mobile} icon={Phone} onCopy={shop.mobile} />
                                <InfoRow label="Email Address" value={shop.email} icon={Mail} onCopy={shop.email} />
                            </div>
                        </AnimatedCard>

                        {/* Owner Details Card */}
                        <AnimatedCard className="overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-blue-100">
                                <div className="flex items-center gap-2">
                                    <User size={18} className="text-blue-500" />
                                    <h3 className="text-lg font-black text-gray-900">Owner Details</h3>
                                </div>
                            </div>
                            <div className="divide-y divide-gray-100">
                                <InfoRow label="Owner Name" value={shop.ownerName} icon={User} onCopy={shop.ownerName} />
                                {shop.ownerPhoto && (
                                    <div className="py-4 px-4">
                                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-3">Owner Photo</p>
                                        <div 
                                            onClick={() => openDocModal(getImageUrl(shop.ownerPhoto), 'Owner Photo')}
                                            className="cursor-pointer group relative inline-block"
                                        >
                                            <img
                                                src={getImageUrl(shop.ownerPhoto)}
                                                onError={imgError()}
                                                alt="Owner"
                                                className="w-24 h-24 rounded-xl object-cover border-2 border-gray-200 shadow-md group-hover:shadow-xl transition-all group-hover:scale-105"
                                            />
                                            <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                                                <Eye size={20} className="text-white" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {!shop.ownerPhoto && (
                                    <div className="py-4 px-4">
                                        <div className="bg-gray-50 rounded-xl p-4 text-center border-2 border-dashed border-gray-200">
                                            <Camera size={24} className="text-gray-400 mx-auto mb-2" />
                                            <p className="text-xs text-gray-500">Owner photo not uploaded</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </AnimatedCard>

                        {/* Verification Status Card */}
                        <AnimatedCard className="overflow-hidden lg:col-span-2">
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-green-100">
                                <div className="flex items-center gap-2">
                                    <Shield size={18} className="text-green-500" />
                                    <h3 className="text-lg font-black text-gray-900">Verification Status</h3>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
                                <div className={`rounded-xl p-4 border-2 transition-all ${
                                    shop.mobileVerified 
                                        ? 'bg-green-50 border-green-200 shadow-sm' 
                                        : 'bg-yellow-50 border-yellow-200'
                                }`}>
                                    <div className="flex items-start gap-3">
                                        {shop.mobileVerified 
                                            ? <CheckCircle size={24} className="text-green-600 flex-shrink-0" /> 
                                            : <AlertCircle size={24} className="text-yellow-600 flex-shrink-0" />
                                        }
                                        <div>
                                            <p className={`font-bold text-sm ${shop.mobileVerified ? 'text-green-800' : 'text-yellow-800'}`}>
                                                Mobile Verification
                                            </p>
                                            <p className="text-xs text-gray-600 mt-1">{shop.mobile}</p>
                                            <p className={`text-xs font-semibold mt-2 ${shop.mobileVerified ? 'text-green-600' : 'text-yellow-600'}`}>
                                                {shop.mobileVerified ? '✓ Verified' : '⚠ Pending Verification'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className={`rounded-xl p-4 border-2 transition-all ${
                                    shop.emailVerified 
                                        ? 'bg-green-50 border-green-200 shadow-sm' 
                                        : 'bg-yellow-50 border-yellow-200'
                                }`}>
                                    <div className="flex items-start gap-3">
                                        {shop.emailVerified 
                                            ? <CheckCircle size={24} className="text-green-600 flex-shrink-0" /> 
                                            : <AlertCircle size={24} className="text-yellow-600 flex-shrink-0" />
                                        }
                                        <div>
                                            <p className={`font-bold text-sm ${shop.emailVerified ? 'text-green-800' : 'text-yellow-800'}`}>
                                                Email Verification
                                            </p>
                                            <p className="text-xs text-gray-600 mt-1">{shop.email}</p>
                                            <p className={`text-xs font-semibold mt-2 ${shop.emailVerified ? 'text-green-600' : 'text-yellow-600'}`}>
                                                {shop.emailVerified ? '✓ Verified' : '⚠ Pending Verification'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {shop.rejectionReason && (
                                <div className="mx-6 mb-6 p-4 bg-red-50 rounded-xl border border-red-200">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold text-red-700">Rejection Reason</p>
                                            <p className="text-xs text-red-600 mt-1">{shop.rejectionReason}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </AnimatedCard>

                        {/* Address & Location Card */}
                        <AnimatedCard className="overflow-hidden lg:col-span-2">
                            <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-purple-100">
                                <div className="flex items-center gap-2">
                                    <MapPin size={18} className="text-purple-500" />
                                    <h3 className="text-lg font-black text-gray-900">Address & Location</h3>
                                </div>
                            </div>
                            <div className="divide-y divide-gray-100">
                                <InfoRow label="Full Address" value={shop.address} icon={Home} />
                                <InfoRow label="Locality / Area" value={shop.locality} icon={MapPin} />
                                <div className="grid grid-cols-2">
                                    <InfoRow label="City" value={shop.city} icon={Building2} />
                                    <InfoRow label="Pincode" value={shop.pincode} icon={Hash} onCopy={shop.pincode} />
                                </div>
                                {shop.shopLocation?.latitude && shop.shopLocation?.longitude && (
                                    <>
                                        <div className="grid grid-cols-2">
                                            <InfoRow label="Latitude" value={`${shop.shopLocation.latitude.toFixed(6)}°`} icon={Globe} />
                                            <InfoRow label="Longitude" value={`${shop.shopLocation.longitude.toFixed(6)}°`} icon={Globe} />
                                        </div>
                                        <div className="p-4">
                                            <a 
                                                href={`https://maps.google.com/?q=${shop.shopLocation.latitude},${shop.shopLocation.longitude}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                                            >
                                                <Navigation size={14} />
                                                View on Google Maps
                                                <ExternalLink size={12} />
                                            </a>
                                        </div>
                                    </>
                                )}
                            </div>
                        </AnimatedCard>
                    </div>
                </div>
            ) : (
                // EDIT MODE - Enhanced
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                    {/* Edit Header */}
                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-black text-white">Edit Profile</h3>
                                <p className="text-orange-100 text-sm mt-1">Update your shop information</p>
                            </div>
                            <button
                                onClick={handleCancel}
                                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-all"
                            >
                                <X size={20} className="text-white" />
                            </button>
                        </div>
                    </div>

                    <div className="p-6 space-y-8">
                        {/* Live Preview Banner */}
                        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-4 flex items-center gap-4 shadow-lg">
                            {(fLogoPreview || getImageUrl(shop.shopLogo)) ? (
                                <img 
                                    src={fLogoPreview || getImageUrl(shop.shopLogo)} 
                                    onError={imgError()} 
                                    className="w-16 h-16 rounded-xl object-cover border-2 border-white/30 shadow-lg flex-shrink-0" 
                                    alt="" 
                                />
                            ) : (
                                <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <Store size={28} className="text-white" />
                                </div>
                            )}
                            <div className="text-white min-w-0 flex-1">
                                <p className="text-xl font-black truncate">{fShopName || 'Shop Name'}</p>
                                <p className="text-orange-100 text-xs mt-0.5">{fCategory || 'Category'} • {fCity || 'City'}</p>
                                <p className="text-orange-200 text-[10px] mt-0.5 flex items-center gap-1">
                                    <User size={10} /> {fOwnerName || shop.ownerName || 'Owner Name'}
                                </p>
                            </div>
                            <Sparkles size={20} className="text-white/60 animate-pulse" />
                        </div>

                        {/* Basic Information */}
                        <div>
                            <h4 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2">
                                <Info size={16} className="text-orange-500" />
                                Basic Information
                            </h4>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className={labelCls}>Shop Name *</label>
                                    <input 
                                        value={fShopName} 
                                        onChange={e => setFShopName(e.target.value)} 
                                        className={inputCls}
                                        placeholder="Enter shop name"
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Category *</label>
                                    <input 
                                        value={fCategory} 
                                        onChange={e => setFCategory(e.target.value)} 
                                        className={inputCls}
                                        placeholder="e.g., Grocery, Electronics"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className={labelCls}>Full Address *</label>
                                    <input 
                                        value={fAddress} 
                                        onChange={e => setFAddress(e.target.value)} 
                                        className={inputCls}
                                        placeholder="Street address, building name, etc."
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Locality / Area</label>
                                    <input 
                                        value={fLocality} 
                                        onChange={e => setFLocality(e.target.value)} 
                                        className={inputCls}
                                        placeholder="e.g., MG Road, Indiranagar"
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>City *</label>
                                    <input 
                                        value={fCity} 
                                        onChange={e => setFCity(e.target.value)} 
                                        className={inputCls}
                                        placeholder="City name"
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Pincode *</label>
                                    <input 
                                        value={fPincode} 
                                        onChange={e => setFPincode(e.target.value)} 
                                        className={inputCls}
                                        placeholder="6-digit pincode"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Protected Information */}
                        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5 border border-gray-200">
                            <h4 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2">
                                <Shield size={16} className="text-blue-500" />
                                Protected Information
                            </h4>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {[
                                    { label: 'Owner Name', value: shop?.ownerName || 'N/A', desc: 'Registered during sign-up', icon: User },
                                    { label: 'Phone Number', value: shop?.mobile || 'N/A', desc: 'Verified contact number', icon: Phone },
                                    { label: 'GST Number', value: shop?.gstNumber || 'N/A', desc: 'Tax registration', icon: Hash },
                                    { label: 'Email Address', value: shop?.email || 'N/A', desc: 'Official email', icon: Mail },
                                ].map(({ label, value, desc, icon: Icon }) => (
                                    <div key={label} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-blue-50 rounded-lg">
                                                <Icon size={14} className="text-blue-500" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{label}</p>
                                                <p className="text-sm font-bold text-gray-800 mt-1">{value}</p>
                                                <p className="text-[10px] text-gray-400 mt-1 italic">{desc}</p>
                                            </div>
                                            <BadgeCheck size={14} className="text-green-500 flex-shrink-0" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Location Capture */}
                        <div>
                            <h4 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2">
                                <Navigation size={16} className="text-purple-500" />
                                Shop Location
                            </h4>
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200">
                                <button
                                    type="button"
                                    onClick={captureLocation}
                                    disabled={locationLoading}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
                                >
                                    {locationLoading ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <Navigation size={18} />
                                    )}
                                    {fLatitude && fLongitude ? 'Update Shop Location' : 'Capture Current Location'}
                                </button>
                                {locationError && (
                                    <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded-lg animate-shake">
                                        <p className="text-xs font-semibold text-red-700">{locationError}</p>
                                    </div>
                                )}
                                {fLatitude && fLongitude && (
                                    <div className="mt-4 grid grid-cols-2 gap-3">
                                        <div className="bg-white p-3 rounded-lg border border-green-200 shadow-sm">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase">Latitude</p>
                                            <p className="text-sm font-mono font-semibold text-gray-800 mt-1">{fLatitude.toFixed(6)}°</p>
                                        </div>
                                        <div className="bg-white p-3 rounded-lg border border-green-200 shadow-sm">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase">Longitude</p>
                                            <p className="text-sm font-mono font-semibold text-gray-800 mt-1">{fLongitude.toFixed(6)}°</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Media Uploads */}
                        <div>
                            <h4 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2">
                                <ImageIcon size={16} className="text-pink-500" />
                                Shop Media
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <ImageUploadCard 
                                    label="Shop Logo"
                                    imageUrl={getImageUrl(shop.shopLogo)}
                                    preview={fLogoPreview}
                                    onUpload={onLogo}
                                    onRemove={removeLogo}
                                />
                                <ImageUploadCard 
                                    label="Owner Photo"
                                    imageUrl={getImageUrl(shop.ownerPhoto)}
                                    preview={fPhotoPreview}
                                    onUpload={onPhoto}
                                    onRemove={removePhoto}
                                />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-4 border-t border-gray-200">
                            <button
                                onClick={handleCancel}
                                disabled={saving}
                                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-orange-200 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Saving Changes...
                                    </>
                                ) : (
                                    <>
                                        <Save size={18} />
                                        Save Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Document Preview Modal - Enhanced */}
            {docModal.isOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" onClick={closeDocModal}>
                    <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white rounded-t-2xl">
                            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                                <Eye size={18} className="text-orange-500" />
                                {docModal.title}
                            </h3>
                            <button onClick={closeDocModal} className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                                <X size={20} className="text-gray-600" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-100 p-6">
                            {docModal.src.includes('pdf') ? (
                                <iframe src={docModal.src} className="w-full h-[70vh]" title={docModal.title} />
                            ) : (
                                <img src={docModal.src} onError={imgError()} alt={docModal.title} className="max-w-full max-h-[70vh] rounded-lg shadow-lg" />
                            )}
                        </div>
                        
                        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 bg-gray-50 rounded-b-2xl">
                            <a href={docModal.src} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-all">
                                <ExternalLink size={16} />
                                Open Full Screen
                            </a>
                            <button onClick={closeDocModal} className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition-all">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

ShopProfileUnified.displayName = 'ShopProfileUnified';
export default ShopProfileUnified;