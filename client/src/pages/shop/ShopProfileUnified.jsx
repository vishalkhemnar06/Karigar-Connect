import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';
import {
    Building2, Edit2, Save, X, Upload, Check, Shield, Award, MapPin,
    Phone, Mail, Hash, FileText, Calendar, CheckCircle, AlertCircle, Clock,
    Download, Store, TrendingUp, Navigation, Eye, ExternalLink
} from 'lucide-react';
import { getImageUrl, imgError } from '../../utils/imageUrl';

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

    const captureLocation = useCallback(async () => {
        setLocationError('');
        if (!navigator.geolocation) {
            setLocationError('Geolocation not supported by your browser');
            toast.error('Geolocation not supported');
            return;
        }
        
        try {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude: lat, longitude: lon } = position.coords;
                    setFLatitude(lat);
                    setFLongitude(lon);
                    toast.success(`Location captured: ${lat.toFixed(5)}, ${lon.toFixed(5)}`);
                    
                    // Reverse geocoding to get address details
                    try {
                        const response = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
                        );
                        const data = await response.json();
                        
                        if (data.address) {
                            const roadName = data.address.road || data.address.street || '';
                            const houseNum = data.address.house_number || '';
                            const village = data.address.village || data.address.hamlet || '';
                            const city = data.address.city || data.address.town || data.address.county || '';
                            const postcode = data.address.postcode || '';
                            
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
                },
                error => {
                    let msg = 'Unable to get location';
                    if (error.code === error.PERMISSION_DENIED) msg = 'Permission denied. Enable location in browser settings.';
                    else if (error.code === error.POSITION_UNAVAILABLE) msg = 'Location information unavailable';
                    setLocationError(msg);
                    toast.error(msg);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } catch (err) {
            console.log('Location capture error:', err);
            setLocationError('Error capturing location');
            toast.error('Error capturing location');
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
            <div className="flex items-center justify-center p-8">
                <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!shop) return null;

    const DetailRow = ({ label, value, icon: Icon, isEmpty = false }) => (
        <div className={`flex items-center gap-3 py-3 px-3 border-b border-gray-100 last:border-0 rounded-lg transition-colors ${
            isEmpty ? 'bg-gray-50/50' : ''
        }`}>
            {Icon && <Icon size={16} className={`${isEmpty ? 'text-gray-300' : 'text-orange-500'} flex-shrink-0`} />}
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                <p className={`text-sm font-semibold break-words mt-0.5 ${
                    isEmpty ? 'text-gray-400 italic' : 'text-gray-800'
                }`}>
                    {value || 'Not filled'}
                </p>
            </div>
            {isEmpty && (
                <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-700 flex-shrink-0">
                    EMPTY
                </span>
            )}
        </div>
    );

    const inputCls = "w-full border-2 border-gray-200 rounded-xl py-3.5 px-4 text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-50 focus:outline-none transition-all";
    const labelCls = "block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5";

    return (
        <div className={isDashboard ? "space-y-4" : ""}>
            {!isDashboard && (
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Shop Profile</h1>
                        <p className="text-gray-500 mt-1">View and manage your shop information</p>
                    </div>
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-all"
                        >
                            <Edit2 size={18} />
                            Edit Profile
                        </button>
                    )}
                </div>
            )}

            {isDashboard && (
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-black text-gray-900">Shop Profile</h2>
                        <p className="text-xs text-gray-500 mt-0.5">View and manage your shop details</p>
                    </div>
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="p-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all"
                            title="Edit profile"
                        >
                            <Edit2 size={18} />
                        </button>
                    )}
                </div>
            )}

            {!isEditing ? (
                // VIEW MODE
                <div className="space-y-6">
                    {/* Shop Header Card */}
                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-6 text-white shadow-lg">
                        <div className="flex items-center gap-4">
                            {shop.shopLogo ? (
                                <img
                                    src={getImageUrl(shop.shopLogo)}
                                    onError={imgError()}
                                    alt={shop.shopName}
                                    className="w-20 h-20 rounded-xl object-cover border-4 border-white/20"
                                />
                            ) : (
                                <div className="w-20 h-20 rounded-xl bg-white/20 flex items-center justify-center">
                                    <Store size={32} className="text-white/60" />
                                </div>
                            )}
                            <div>
                                <h2 className="text-2xl font-black">{shop.shopName}</h2>
                                <p className="text-orange-100 mt-1">{shop.category}</p>
                                <p className="text-sm text-orange-50 mt-0.5">Owner: {shop.ownerName}</p>
                            </div>
                        </div>
                    </div>

                    {/* Verification Status */}
                    <div className={`rounded-xl p-4 border-2 flex items-center gap-3 ${
                        shop.verificationStatus === 'approved'
                            ? 'bg-green-50 border-green-200'
                            : shop.verificationStatus === 'rejected'
                            ? 'bg-red-50 border-red-200'
                            : shop.verificationStatus === 'blocked'
                            ? 'bg-red-50 border-red-200'
                            : 'bg-yellow-50 border-yellow-200'
                    }`}>
                        <Award size={20} className={
                            shop.verificationStatus === 'approved'
                                ? 'text-green-600'
                                : shop.verificationStatus === 'rejected'
                                ? 'text-red-600'
                                : shop.verificationStatus === 'blocked'
                                ? 'text-red-600'
                                : 'text-yellow-600'
                        } />
                        <div>
                            <p className={`font-bold ${
                                shop.verificationStatus === 'approved'
                                    ? 'text-green-800'
                                    : shop.verificationStatus === 'rejected'
                                    ? 'text-red-800'
                                    : shop.verificationStatus === 'blocked'
                                    ? 'text-red-800'
                                    : 'text-yellow-800'
                            }`}>
                                Status: <span className="capitalize">{shop.verificationStatus}</span>
                            </p>
                            {shop.rejectionReason && (
                                <p className="text-xs text-gray-600 mt-0.5">Reason: {shop.rejectionReason}</p>
                            )}
                        </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Shop Details */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Shop Details</h3>
                            <div className="space-y-0">
                                <DetailRow label="Shop Name" value={shop.shopName} isEmpty={!shop.shopName} />
                                <DetailRow label="Category" value={shop.category} isEmpty={!shop.category} />
                                <DetailRow label="GST Number" value={shop.gstNumber} icon={Hash} isEmpty={!shop.gstNumber} />
                                <DetailRow label="Mobile" value={shop.mobile} icon={Phone} isEmpty={!shop.mobile} />
                                <DetailRow label="Email" value={shop.email} icon={Mail} isEmpty={!shop.email} />
                            </div>
                        </div>

                        {/* Owner Details */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Owner Details</h3>
                            <div className="space-y-0">
                                <DetailRow label="Owner Name" value={shop.ownerName} isEmpty={!shop.ownerName} />
                                {shop.ownerPhoto && (
                                    <div className="py-3 px-3 cursor-pointer hover:bg-orange-50 rounded-lg transition-all" onClick={() => openDocModal(getImageUrl(shop.ownerPhoto), 'Owner Photo')}>
                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                                            Owner Photo <Eye size={14} className="text-orange-500" />
                                        </p>
                                        <img
                                            src={getImageUrl(shop.ownerPhoto)}
                                            onError={imgError()}
                                            alt="Owner"
                                            className="w-20 h-20 rounded-lg object-cover border-2 border-gray-200 mt-2 hover:shadow-lg transition-all"
                                        />
                                    </div>
                                )}
                                {!shop.ownerPhoto && (
                                    <div className="flex items-center gap-3 py-3 px-3 bg-gray-50/50 rounded-lg">
                                        <Clock size={16} className="text-gray-300 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Owner Photo</p>
                                            <p className="text-sm text-gray-400 italic mt-0.5">Not uploaded</p>
                                        </div>
                                        <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-700 flex-shrink-0">
                                            EMPTY
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Account Verification */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm lg:col-span-2">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <CheckCircle size={20} className="text-orange-500" />
                                Account Verification
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className={`rounded-xl p-4 border-2 flex items-center gap-3 ${
                                    shop.mobileVerified 
                                        ? 'bg-green-50 border-green-200' 
                                        : 'bg-yellow-50 border-yellow-200'
                                }`}>
                                    {shop.mobileVerified 
                                        ? <CheckCircle size={20} className="text-green-600" /> 
                                        : <AlertCircle size={20} className="text-yellow-600" />
                                    }
                                    <div>
                                        <p className={`font-bold ${
                                            shop.mobileVerified ? 'text-green-800' : 'text-yellow-800'
                                        }`}>
                                            Mobile: {shop.mobileVerified ? 'Verified' : 'Pending'}
                                        </p>
                                        <p className="text-xs text-gray-600 mt-0.5">{shop.mobile}</p>
                                    </div>
                                </div>

                                <div className={`rounded-xl p-4 border-2 flex items-center gap-3 ${
                                    shop.emailVerified 
                                        ? 'bg-green-50 border-green-200' 
                                        : 'bg-yellow-50 border-yellow-200'
                                }`}>
                                    {shop.emailVerified 
                                        ? <CheckCircle size={20} className="text-green-600" /> 
                                        : <AlertCircle size={20} className="text-yellow-600" />
                                    }
                                    <div>
                                        <p className={`font-bold ${
                                            shop.emailVerified ? 'text-green-800' : 'text-yellow-800'
                                        }`}>
                                            Email: {shop.emailVerified ? 'Verified' : 'Pending'}
                                        </p>
                                        <p className="text-xs text-gray-600 mt-0.5">{shop.email}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Address Details */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm lg:col-span-2">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <MapPin size={20} className="text-orange-500" />
                                Address & Location
                            </h3>
                            <div className="space-y-0">
                                <DetailRow label="Full Address" value={shop.address} isEmpty={!shop.address} />
                                <DetailRow label="City" value={shop.city} isEmpty={!shop.city} />
                                <DetailRow label="Locality" value={shop.locality} isEmpty={!shop.locality} />
                                <DetailRow label="Pincode" value={shop.pincode} isEmpty={!shop.pincode} />
                                {shop.shopLocation?.latitude && shop.shopLocation?.longitude && (
                                    <>
                                        <DetailRow label="Latitude" value={`${shop.shopLocation.latitude.toFixed(6)}°`} />
                                        <DetailRow label="Longitude" value={`${shop.shopLocation.longitude.toFixed(6)}°`} />
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                // EDIT MODE
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                        <h3 className="text-lg font-bold text-gray-900">Edit Shop Profile</h3>
                        <button
                            onClick={handleCancel}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                        >
                            <X size={20} className="text-gray-600" />
                        </button>
                    </div>

                    {/* Shop Banner Preview */}
                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-4 flex items-center gap-4">
                        {(fLogoPreview || getImageUrl(shop.shopLogo)) ? (
                            <img src={fLogoPreview || getImageUrl(shop.shopLogo)} onError={imgError()} className="w-16 h-16 rounded-xl object-cover border-2 border-white/30 shadow-lg flex-shrink-0" alt="" />
                        ) : (
                            <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                <Store size={28} className="text-white" />
                            </div>
                        )}
                        <div className="text-white min-w-0">
                            <p className="text-lg font-black truncate">{fShopName || 'Shop Name'}</p>
                            <p className="text-orange-100 text-xs">{fCategory || 'Category'} · {fCity || 'City'}</p>
                            <p className="text-orange-200 text-[10px] mt-0.5">{fOwnerName || 'Owner Name'}</p>
                        </div>
                    </div>

                    {/* Form Fields */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-900 mb-4">Basic Information</h4>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 space-y-3">
                            {[
                                ['Shop Name', fShopName, setFShopName],
                                ['City', fCity, setFCity],
                                ['Pincode', fPincode, setFPincode],
                                ['Category', fCategory, setFCategory],
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
                    </div>

                    {/* Read-only Fields (Owner Name, Phone, GST) */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Shield size={16} className="text-orange-500" />
                            Protected Information (Cannot be edited)
                        </h4>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 space-y-3">
                            {[
                                ['Owner Name', shop?.ownerName || 'N/A', 'Owner name registered during sign-up'],
                                ['Phone Number', shop?.mobile || 'N/A', 'Contact number verified during registration'],
                                ['GST Number', shop?.gstNumber || 'N/A', 'GST registered during verification'],
                            ].map(([label, val, desc]) => (
                                <div key={label} className="bg-gray-50 rounded-xl p-3.5 border border-gray-200">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                                        {label}
                                    </label>
                                    <p className="text-sm font-semibold text-gray-700 mb-1">{val}</p>
                                    <p className="text-[11px] text-gray-500 italic">{desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Location Capture */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <MapPin size={16} className="text-orange-500" />
                            Shop Location
                        </h4>
                        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                            <button
                                type="button"
                                onClick={captureLocation}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all active:scale-[0.98]"
                            >
                                <Navigation size={18} />
                                {fLatitude && fLongitude ? 'Update Shop Location' : 'Capture Shop Location'}
                            </button>
                            {locationError && (
                                <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded-lg">
                                    <p className="text-xs font-semibold text-red-700">{locationError}</p>
                                </div>
                            )}
                            {fLatitude && fLongitude && (
                                <div className="mt-3 grid grid-cols-2 gap-3">
                                    <div className="bg-white p-3 rounded-lg border border-green-200">
                                        <p className="text-xs font-bold text-gray-500 uppercase">Latitude</p>
                                        <p className="text-sm font-semibold text-gray-800 mt-1">{fLatitude.toFixed(6)}°</p>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border border-green-200">
                                        <p className="text-xs font-bold text-gray-500 uppercase">Longitude</p>
                                        <p className="text-sm font-semibold text-gray-800 mt-1">{fLongitude.toFixed(6)}°</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Photo Uploads */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-900 mb-4">Media & Documents</h4>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                ['Shop Logo', fLogo, fLogoPreview, onLogo],
                                ['Owner Photo', fPhoto, fPhotoPreview, onPhoto],
                            ].map(([label, file, preview, handler]) => (
                                <div key={label}>
                                    <label className={labelCls}>{label}</label>
                                    <label className="flex flex-col items-center gap-2 cursor-pointer border-2 border-dashed border-gray-200 rounded-xl p-3 hover:border-orange-300 hover:bg-orange-50 active:bg-orange-50 transition-all text-center">
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
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-gray-200">
                        <button
                            onClick={handleCancel}
                            disabled={saving}
                            className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 rounded-xl font-bold active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {saving
                                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                                : <><Check size={18} /> Save Changes</>
                            }
                        </button>
                    </div>
                </div>
            )}

            {/* Document Preview Modal */}
            {docModal.isOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={closeDocModal}>
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900">{docModal.title}</h3>
                            <button onClick={closeDocModal} className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                                <X size={20} className="text-gray-600" />
                            </button>
                        </div>
                        
                        {/* Modal Content */}
                        <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-50 p-4">
                            {docModal.src.includes('pdf') ? (
                                <iframe src={docModal.src} className="w-full h-full" title={docModal.title} />
                            ) : (
                                <img src={docModal.src} onError={imgError()} alt={docModal.title} className="max-w-full max-h-full rounded-lg" />
                            )}
                        </div>
                        
                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
                            <a href={docModal.src} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-all">
                                <ExternalLink size={16} />
                                Open in New Tab
                            </a>
                            <button onClick={closeDocModal} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all">
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
